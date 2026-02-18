# /backend/utils/ws_reserve_updater.py
"""
Event-driven reserve updater.

Uses the EXISTING ws_event_listener infrastructure to subscribe to
Sync events on pair contracts that are ALREADY in MongoDB (token_pairs collection).

Architecture:
  - Reads pair addresses from db.token_pairs (synced by sync_token_pairs)
  - Subscribes to Sync events via WSS using the same provider list as ws_event_listener
  - Parses reserve0/reserve1 DIRECTLY from event data (zero eth_call)
  - Updates db.token_pairs.reserves on each Sync event
  - Safety-net poll (update_reserves_once) available as scheduler fallback

Zero hardcoded topics — uses the UniswapV2Pair ABI already in contracts/.
"""
import asyncio
import logging
import os
import time
import json
from typing import Dict, Optional
import websockets
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Use existing infrastructure
from utils.web3mongo import db, w3

WEB3_ALCHEMY_WSS = os.getenv("WEB3_ALCHEMY_WSS")
WEB3_INFURA_WSS = os.getenv("WEB3_INFURA_WSS")
WSS_PROVIDERS = [url for url in [WEB3_ALCHEMY_WSS, WEB3_INFURA_WSS] if url]

PROVIDER_COOLDOWN = 300  # 5 min blacklist on 429
_provider_blacklist: Dict[str, float] = {}
_subscription_running = False


# ─── Helpers ────────────────────────────────────────────────────────────────

def _provider_name(url: str) -> str:
    if "alchemy" in url.lower(): return "Alchemy"
    if "infura" in url.lower(): return "Infura"
    return "Unknown"


def _is_provider_healthy(url: str) -> bool:
    return time.time() >= _provider_blacklist.get(url, 0)


def _blacklist_provider(url: str):
    _provider_blacklist[url] = time.time() + PROVIDER_COOLDOWN
    logger.warning(f"[RESERVES] ⛔ {_provider_name(url)} blacklisted for {PROVIDER_COOLDOWN}s")


def _rpc(id_: str, method: str, params):
    return json.dumps({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})


def safe_mongo_int(val):
    return str(val) if abs(val) > 2**63 - 1 else int(val)


def _get_active_pairs() -> list:
    """Get active pair contracts from MongoDB (already synced by sync_token_pairs)."""
    return list(db['token_pairs'].find({
        "exists": True,
        "pairAddress": {"$nin": [None, "", "0x0000000000000000000000000000000000000000"]}
    }))


def _build_sync_topic() -> str:
    """Build Sync event topic hash from the UniswapV2Pair ABI in contracts/.
    Falls back to manual keccak if ABI not found."""
    try:
        from utils.contracts.loader import load_contract_abi
        abi = load_contract_abi("UniswapV2Pair")
        for item in abi:
            if item.get("type") == "event" and item.get("name") == "Sync":
                types = ",".join(inp["type"] for inp in item.get("inputs", []))
                sig = f"Sync({types})"
                topic = Web3.keccak(text=sig).hex()
                logger.info(f"[RESERVES] Sync topic from ABI: {sig} → {topic}")
                return topic
    except Exception as e:
        logger.warning(f"[RESERVES] Could not load Sync topic from ABI: {e}")

    # Fallback: compute manually
    topic = Web3.keccak(text="Sync(uint112,uint112)").hex()
    logger.info(f"[RESERVES] Sync topic (computed): {topic}")
    return topic


def _parse_sync_data(data_hex: str) -> Optional[Dict]:
    """Parse reserve0/reserve1 from Sync event data (ABI-encoded uint112s as uint256)."""
    try:
        raw = data_hex[2:] if data_hex.startswith("0x") else data_hex
        if len(raw) < 128:
            return None
        reserve0 = int(raw[:64], 16)
        reserve1 = int(raw[64:128], 16)
        return {
            "reserve0": safe_mongo_int(reserve0),
            "reserve1": safe_mongo_int(reserve1),
            "timestamp": int(time.time()),
        }
    except Exception as e:
        logger.error(f"[RESERVES] Failed to parse Sync data: {e}")
        return None


# ─── Event-Driven Subscription (PRIMARY) ────────────────────────────────────

async def _subscribe_sync_events(wss_url: str) -> None:
    """Subscribe to Sync events on all pair addresses from db.token_pairs."""
    provider = _provider_name(wss_url)
    sync_topic = _build_sync_topic()

    # Build address → pair doc map from MongoDB
    pairs = _get_active_pairs()
    if not pairs:
        logger.warning("[RESERVES] No active pairs in db.token_pairs — nothing to subscribe")
        return

    addr_map: Dict[str, dict] = {}
    for p in pairs:
        addr = p.get("pairAddress", "").lower()
        if addr:
            addr_map[addr] = p

    try:
        async with websockets.connect(wss_url, ping_interval=20, ping_timeout=10) as ws:
            # Subscribe to Sync logs on all pair addresses
            sub_id = f"reserves-{int(time.time())}"
            await ws.send(_rpc(sub_id, "eth_subscribe", [
                "logs",
                {
                    "address": [Web3.to_checksum_address(a) for a in addr_map.keys()],
                    "topics": [sync_topic],
                }
            ]))

            logger.info(f"[RESERVES] 🟢 Subscribed to Sync events on {len(addr_map)} pairs via {provider}")
            logger.info(f"[RESERVES] 📡 Mode: event-driven (zero polling, zero eth_call)")

            update_count = 0

            while True:
                msg_raw = await ws.recv()
                try:
                    msg = json.loads(msg_raw)
                except Exception:
                    continue

                # ACK
                if "id" in msg and "result" in msg:
                    logger.debug(f"[RESERVES] Subscription confirmed: {msg.get('result')}")
                    continue

                if msg.get("method") != "eth_subscription":
                    continue

                result = msg.get("params", {}).get("result")
                if not isinstance(result, dict):
                    continue

                log_addr = (result.get("address") or "").lower()
                if log_addr not in addr_map:
                    continue

                reserves = _parse_sync_data(result.get("data", ""))
                if not reserves:
                    continue

                pair = addr_map[log_addr]
                try:
                    db['token_pairs'].update_one(
                        {"_id": pair["_id"]},
                        {"$set": {"reserves": reserves}}
                    )
                    update_count += 1
                    if update_count <= 3 or update_count % 50 == 0:
                        block_hex = result.get("blockNumber", "0x0")
                        block = int(block_hex, 16) if isinstance(block_hex, str) else block_hex
                        ct = pair.get("companyToken", {})
                        pt = pair.get("paymentToken", {})
                        logger.info(
                            f"[RESERVES] 📡 #{update_count}: "
                            f"{ct.get('symbol','?')}/{pt.get('symbol','?')} "
                            f"r0={reserves['reserve0']} r1={reserves['reserve1']} "
                            f"(block {block}, {provider})"
                        )
                except Exception as e:
                    logger.error(f"[RESERVES] DB update failed for {log_addr}: {e}")

    except Exception as e:
        err_str = str(e)
        logger.error(f"[RESERVES] {provider} WSS error: {err_str}")
        if "429" in err_str or "rejected" in err_str:
            _blacklist_provider(wss_url)
        raise


async def reserve_subscription_loop():
    """Persistent event-driven loop with auto-reconnect and provider failover."""
    global _subscription_running

    if _subscription_running:
        logger.warning("[RESERVES] ⚠️ Already running — skipping duplicate")
        return

    _subscription_running = True

    if not WSS_PROVIDERS:
        logger.error("[RESERVES] No WSS providers configured")
        _subscription_running = False
        return

    logger.info("=" * 60)
    logger.info("[RESERVES] 📡 Event-driven reserve updater starting")
    logger.info(f"[RESERVES] Providers: {[_provider_name(u) for u in WSS_PROVIDERS]}")
    logger.info(f"[RESERVES] Pairs source: db.token_pairs (synced by sync_token_pairs)")
    logger.info(f"[RESERVES] Mode: Sync event subscription (ZERO polling)")
    logger.info("=" * 60)

    try:
        while True:
            healthy = [u for u in WSS_PROVIDERS if _is_provider_healthy(u)]
            providers = healthy if healthy else WSS_PROVIDERS

            if not healthy:
                names = [_provider_name(u) for u in WSS_PROVIDERS]
                logger.warning(f"[RESERVES] All providers blacklisted ({names}), retrying anyway...")

            for wss_url in providers:
                try:
                    await _subscribe_sync_events(wss_url)
                except Exception as e:
                    logger.error(f"[RESERVES] {_provider_name(wss_url)} failed: {e}")
                    await asyncio.sleep(5)
                    continue

            logger.warning("[RESERVES] All providers failed. Retrying in 30s...")
            await asyncio.sleep(30)
    finally:
        _subscription_running = False


# ─── Safety-Net Poll (BACKUP, called by scheduler every 5 min) ──────────────

async def update_reserves_once() -> bool:
    """One-shot poll of reserves via eth_call over WSS. Safety net only."""
    if not WSS_PROVIDERS:
        logger.error("[RESERVES] No WSS providers")
        return False

    healthy = [u for u in WSS_PROVIDERS if _is_provider_healthy(u)]
    providers = healthy if healthy else WSS_PROVIDERS

    for wss_url in providers:
        provider = _provider_name(wss_url)
        try:
            async with websockets.connect(wss_url, ping_interval=20, ping_timeout=10) as ws:
                pairs = _get_active_pairs()
                updated = 0
                for pair in pairs:
                    addr = pair.get("pairAddress")
                    if not addr:
                        continue
                    try:
                        call_id = str(int(time.time() * 1000))
                        await ws.send(_rpc(call_id, "eth_call", [{
                            "to": addr,
                            "data": "0x0902f1ac"  # getReserves()
                        }, "latest"]))
                        response = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(response)
                        if "error" in data:
                            continue
                        result = data.get("result", "")
                        reserves = _parse_sync_data(result)
                        if reserves:
                            db['token_pairs'].update_one(
                                {"_id": pair["_id"]},
                                {"$set": {"reserves": reserves}}
                            )
                            updated += 1
                    except Exception as e:
                        logger.warning(f"[RESERVES] Safety poll failed for {addr}: {e}")

                logger.info(f"[RESERVES] 🔄 Safety poll: {updated}/{len(pairs)} pairs via {provider}")
                return True
        except Exception as e:
            err_str = str(e)
            logger.error(f"[RESERVES] Safety poll {provider} error: {err_str}")
            if "429" in err_str or "rejected" in err_str:
                _blacklist_provider(wss_url)

    logger.error("[RESERVES] Safety poll: all providers failed")
    return False


# ─── Entry Point ────────────────────────────────────────────────────────────

def start_ws_reserve_updater():
    """Start the event-driven reserve updater (blocking)."""
    asyncio.run(reserve_subscription_loop())

if __name__ == "__main__":
    start_ws_reserve_updater()