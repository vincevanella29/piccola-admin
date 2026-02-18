# /backend/utils/ws_reserve_updater.py
"""
Event-driven reserve updater via WSS Sync events.

100% WebSocket. ZERO polling.
Fallback poll ONLY if WSS has been down for 10+ minutes

Uses existing infra:
  - Pairs from db.token_pairs (synced by sync_token_pairs)
  - Sync topic from UniswapV2Pair ABI in contracts/
  - Providers from env vars (WEB3_ALCHEMY_WSS, WEB3_INFURA_WSS)
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

from utils.web3mongo import db, w3

WEB3_ALCHEMY_WSS = os.getenv("WEB3_ALCHEMY_WSS")
WEB3_INFURA_WSS = os.getenv("WEB3_INFURA_WSS")
WSS_PROVIDERS = [url for url in [WEB3_ALCHEMY_WSS, WEB3_INFURA_WSS] if url]

PROVIDER_COOLDOWN = 300  # 5 min blacklist on 429
FALLBACK_POLL_AFTER = 600  # 10 min — poll ONLY after this much WSS downtime
_provider_blacklist: Dict[str, float] = {}
_subscription_running = False


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
    return list(db['token_pairs'].find({
        "exists": True,
        "pairAddress": {"$nin": [None, "", "0x0000000000000000000000000000000000000000"]}
    }))

def _build_sync_topic() -> str:
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
        logger.warning(f"[RESERVES] Could not load Sync from ABI: {e}")
    topic = Web3.keccak(text="Sync(uint112,uint112)").hex()
    logger.info(f"[RESERVES] Sync topic (computed): {topic}")
    return topic

def _parse_sync_data(data_hex: str) -> Optional[Dict]:
    try:
        raw = data_hex[2:] if data_hex.startswith("0x") else data_hex
        if len(raw) < 128:
            return None
        return {
            "reserve0": safe_mongo_int(int(raw[:64], 16)),
            "reserve1": safe_mongo_int(int(raw[64:128], 16)),
            "timestamp": int(time.time()),
        }
    except Exception as e:
        logger.error(f"[RESERVES] Failed to parse Sync data: {e}")
        return None


# ─── WSS Sync Subscription (THE ONLY METHOD) ───────────────────────────────

async def _subscribe_sync_events(wss_url: str) -> None:
    """Subscribe to Sync events on all pair addresses from db.token_pairs."""
    provider = _provider_name(wss_url)
    sync_topic = _build_sync_topic()

    pairs = _get_active_pairs()
    if not pairs:
        logger.warning("[RESERVES] No active pairs in db.token_pairs")
        return

    addr_map: Dict[str, dict] = {}
    for p in pairs:
        addr = p.get("pairAddress", "").lower()
        if addr:
            addr_map[addr] = p

    try:
        async with websockets.connect(wss_url, ping_interval=20, ping_timeout=10) as ws:
            sub_id = f"reserves-{int(time.time())}"
            await ws.send(_rpc(sub_id, "eth_subscribe", [
                "logs",
                {
                    "address": [Web3.to_checksum_address(a) for a in addr_map.keys()],
                    "topics": [sync_topic],
                }
            ]))

            logger.info(f"[RESERVES] 🟢 Subscribed to Sync on {len(addr_map)} pairs via {provider}")
            update_count = 0

            while True:
                msg_raw = await ws.recv()
                try:
                    msg = json.loads(msg_raw)
                except Exception:
                    continue

                if "id" in msg and "result" in msg:
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


# ─── Fallback Poll (ONLY after 10 min WSS downtime) ────────────────────────

async def _fallback_poll() -> bool:
    """One-shot poll via eth_call. ONLY called when WSS is down 10+ min."""
    logger.warning("[RESERVES] 🔴 WSS down 10+ min — running ONE fallback poll")

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
                            "data": "0x0902f1ac"
                        }, "latest"]))
                        response = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(response)
                        if "error" in data:
                            continue
                        reserves = _parse_sync_data(data.get("result", ""))
                        if reserves:
                            db['token_pairs'].update_one(
                                {"_id": pair["_id"]},
                                {"$set": {"reserves": reserves}}
                            )
                            updated += 1
                    except Exception as e:
                        logger.warning(f"[RESERVES] Fallback poll failed for {addr}: {e}")

                logger.info(f"[RESERVES] 🔄 Fallback poll: {updated}/{len(pairs)} pairs via {provider}")
                return True
        except Exception as e:
            err_str = str(e)
            logger.error(f"[RESERVES] Fallback poll {provider} error: {err_str}")
            if "429" in err_str or "rejected" in err_str:
                _blacklist_provider(wss_url)

    logger.error("[RESERVES] Fallback poll: all providers failed")
    return False


# ─── Main Loop ──────────────────────────────────────────────────────────────

async def reserve_subscription_loop():
    """Persistent event-driven loop.
    
    100% WSS. Fallback poll ONLY after 10 min of continuous WSS failure.
    """
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
    logger.info("[RESERVES] 📡 Event-driven reserve updater (100% WSS)")
    logger.info(f"[RESERVES] Providers: {[_provider_name(u) for u in WSS_PROVIDERS]}")
    logger.info(f"[RESERVES] Fallback poll: ONLY after {FALLBACK_POLL_AFTER}s of WSS downtime")
    logger.info("=" * 60)

    ws_down_since: Optional[float] = None
    last_fallback_poll: float = 0

    try:
        while True:
            healthy = [u for u in WSS_PROVIDERS if _is_provider_healthy(u)]
            providers = healthy if healthy else WSS_PROVIDERS

            connected = False
            for wss_url in providers:
                try:
                    await _subscribe_sync_events(wss_url)
                    # If we get here, connection was made and then dropped
                    ws_down_since = time.time()
                    connected = True
                except Exception as e:
                    logger.error(f"[RESERVES] {_provider_name(wss_url)} failed: {e}")
                    if ws_down_since is None:
                        ws_down_since = time.time()

            # All providers failed this round
            if ws_down_since is None:
                ws_down_since = time.time()

            down_for = time.time() - ws_down_since
            time_since_last_poll = time.time() - last_fallback_poll

            # Fallback poll ONLY if WSS down 10+ min AND we haven't polled in last 10 min
            if down_for >= FALLBACK_POLL_AFTER and time_since_last_poll >= FALLBACK_POLL_AFTER:
                logger.warning(f"[RESERVES] WSS down for {int(down_for)}s — triggering fallback poll")
                await _fallback_poll()
                last_fallback_poll = time.time()

            # Wait before retry (shorter if just disconnected, longer if all failing)
            await asyncio.sleep(10 if connected else 30)
    finally:
        _subscription_running = False


# ─── Entry Point ────────────────────────────────────────────────────────────

def start_ws_reserve_updater():
    asyncio.run(reserve_subscription_loop())

if __name__ == "__main__":
    start_ws_reserve_updater()