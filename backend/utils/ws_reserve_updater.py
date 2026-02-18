# /backend/utils/ws_reserve_updater.py
"""
EVENT-DRIVEN reserve updater via WebSocket subscriptions.
Subscribes to Sync(uint112,uint112) events on all Uniswap V2 pairs.
When a swap/liquidity event fires, reserves are extracted DIRECTLY from the
event data — ZERO eth_call, ZERO polling.

Fallback: one-shot update_reserves_once() can be called periodically (e.g. every 5 min)
as a safety net in case we miss a WS event.

Provider strategy:
- Smart failover: Alchemy → Infura (with 5-min blacklist on 429)
- Persistent WSS connection with auto-reconnect
"""
import asyncio
import logging
import os
import time
from typing import Dict, Optional, Set
import websockets
import json
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Configuration
WEB3_ALCHEMY_WSS = os.getenv("WEB3_ALCHEMY_WSS")
WEB3_INFURA_WSS = os.getenv("WEB3_INFURA_WSS")
MONGODB_URI = os.getenv("MONGODB_URI")
PROVIDER_COOLDOWN = 300  # seconds to blacklist a 429'd provider
SAFETY_POLL_INTERVAL = 300  # 5 min safety-net poll (only if WS is down)

# Uniswap V2 Sync event: Sync(uint112 reserve0, uint112 reserve1)
# keccak256("Sync(uint112,uint112)")
SYNC_TOPIC = "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1"

# Build WSS provider list (failover order)
WSS_PROVIDERS = [url for url in [WEB3_ALCHEMY_WSS, WEB3_INFURA_WSS] if url]

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# MongoDB setup
client = MongoClient(MONGODB_URI)
db = client['piccola_italia_admin']

# Provider health tracking
_provider_blacklist: Dict[str, float] = {}

# Singleton guard
_subscription_running = False


def _provider_name(url: str) -> str:
    if "alchemy" in url.lower():
        return "Alchemy"
    if "infura" in url.lower():
        return "Infura"
    return "Unknown"


def _is_provider_healthy(url: str) -> bool:
    return time.time() >= _provider_blacklist.get(url, 0)


def _blacklist_provider(url: str):
    name = _provider_name(url)
    _provider_blacklist[url] = time.time() + PROVIDER_COOLDOWN
    logger.warning(f"[RESERVES] ⛔ {name} blacklisted for {PROVIDER_COOLDOWN}s")


def safe_mongo_int(val):
    return str(val) if abs(val) > 2**63 - 1 else int(val)


def _rpc(id_: str, method: str, params):
    return json.dumps({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})


def _get_active_pairs() -> list:
    """Get all active token pairs from MongoDB."""
    return list(db['token_pairs'].find(
        {"exists": True, "pairAddress": {"$nin": [None, "", "0x0000000000000000000000000000000000000000"]}}
    ))


def _parse_sync_event(data_hex: str) -> Optional[Dict]:
    """Parse reserve0 and reserve1 from Sync event data.
    
    Sync event: Sync(uint112 reserve0, uint112 reserve1)
    Data is two uint112 values, ABI-encoded as uint256 (32 bytes each).
    """
    try:
        raw = data_hex
        if raw.startswith("0x"):
            raw = raw[2:]
        if len(raw) < 128:  # 64 chars per uint256, 2 values
            return None
        reserve0 = int(raw[:64], 16)
        reserve1 = int(raw[64:128], 16)
        return {
            "reserve0": safe_mongo_int(reserve0),
            "reserve1": safe_mongo_int(reserve1),
            "timestamp": int(time.time()),
        }
    except Exception as e:
        logger.error(f"[RESERVES] Failed to parse Sync event data: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# EVENT-DRIVEN: Subscribe to Sync events via WSS (PRIMARY method)
# ─────────────────────────────────────────────────────────────────────────────

async def _subscribe_to_sync_events(wss_url: str, pair_addresses: list) -> None:
    """Subscribe to Sync events for all pair addresses and update reserves in real-time."""
    provider = _provider_name(wss_url)
    
    # Build address→pair_id map for fast lookup
    addr_map: Dict[str, dict] = {}
    for pair in _get_active_pairs():
        addr = pair.get("pairAddress", "").lower()
        if addr:
            addr_map[addr] = pair

    if not addr_map:
        logger.warning("[RESERVES] No active pairs found — nothing to subscribe to")
        return

    try:
        async with websockets.connect(wss_url, ping_interval=20, ping_timeout=10) as ws:
            # Subscribe to Sync events on ALL pair addresses at once
            sub_id = f"sync-{int(time.time())}"
            await ws.send(_rpc(sub_id, "eth_subscribe", [
                "logs",
                {
                    "address": list(addr_map.keys()),
                    "topics": [SYNC_TOPIC],
                }
            ]))
            
            logger.info(f"[RESERVES] 🟢 Subscribed to Sync events on {len(addr_map)} pairs via {provider} WSS")
            logger.info(f"[RESERVES] 📡 Event-driven mode: ZERO polling, ZERO eth_call")
            
            update_count = 0
            
            while True:
                msg_raw = await ws.recv()
                try:
                    msg = json.loads(msg_raw)
                except Exception:
                    continue

                # Subscription acknowledgment
                if "id" in msg and "result" in msg:
                    logger.debug(f"[RESERVES] Subscription confirmed: {msg.get('result')}")
                    continue

                if msg.get("method") != "eth_subscription":
                    continue

                params = msg.get("params", {})
                result = params.get("result")
                if not isinstance(result, dict):
                    continue

                # Extract pair address from the log
                log_address = (result.get("address") or "").lower()
                if log_address not in addr_map:
                    continue

                # Parse Sync event data
                event_data = result.get("data", "")
                reserves = _parse_sync_event(event_data)
                if not reserves:
                    continue

                # Update MongoDB
                pair = addr_map[log_address]
                try:
                    db['token_pairs'].update_one(
                        {"_id": pair["_id"]},
                        {"$set": {"reserves": reserves}}
                    )
                    update_count += 1
                    # Log every 10th update to avoid spam, always log first
                    if update_count <= 3 or update_count % 10 == 0:
                        block_hex = result.get("blockNumber", "0x0")
                        block = int(block_hex, 16) if isinstance(block_hex, str) else block_hex
                        logger.info(
                            f"[RESERVES] 📡 Sync event #{update_count}: "
                            f"{pair.get('token0Symbol','?')}/{pair.get('token1Symbol','?')} "
                            f"r0={reserves['reserve0']} r1={reserves['reserve1']} "
                            f"(block {block}, via {provider})"
                        )
                except Exception as e:
                    logger.error(f"[RESERVES] Failed to save reserves for {log_address}: {e}")

    except Exception as e:
        err_str = str(e)
        logger.error(f"[RESERVES] {provider} WSS error: {err_str}")
        if "429" in err_str or "rejected" in err_str:
            _blacklist_provider(wss_url)
        raise  # Re-raise to trigger reconnect


async def reserve_subscription_loop():
    """Main event-driven loop with provider failover and auto-reconnect.
    
    This is the PRIMARY method — subscribes to Sync events.
    Reconnects automatically on disconnection.
    """
    global _subscription_running
    
    if _subscription_running:
        logger.warning("[RESERVES] ⚠️ Subscription loop already running — skipping")
        return
    
    _subscription_running = True
    
    if not WSS_PROVIDERS:
        logger.error("[RESERVES] No WSS providers configured")
        _subscription_running = False
        return

    logger.info("=" * 60)
    logger.info("[RESERVES] 📡 Event-driven reserve updater starting")
    logger.info(f"[RESERVES] 📡 Providers: {[_provider_name(u) for u in WSS_PROVIDERS]}")
    logger.info(f"[RESERVES] 📡 Mode: Sync event subscription (ZERO polling)")
    logger.info("=" * 60)
    
    try:
        while True:
            # Pick best provider (healthy first)
            healthy = [u for u in WSS_PROVIDERS if _is_provider_healthy(u)]
            providers = healthy if healthy else WSS_PROVIDERS
            
            for wss_url in providers:
                try:
                    pairs = _get_active_pairs()
                    if not pairs:
                        logger.warning("[RESERVES] No active pairs — waiting 60s")
                        await asyncio.sleep(60)
                        break
                    
                    pair_addrs = [p["pairAddress"].lower() for p in pairs if p.get("pairAddress")]
                    await _subscribe_to_sync_events(wss_url, pair_addrs)
                except Exception as e:
                    logger.error(f"[RESERVES] Subscription failed ({_provider_name(wss_url)}): {e}")
                    # Short delay before trying next provider
                    await asyncio.sleep(5)
                    continue
            
            # All providers failed — wait before full retry
            logger.warning("[RESERVES] All providers failed. Retrying in 30s...")
            await asyncio.sleep(30)
    finally:
        _subscription_running = False


# ─────────────────────────────────────────────────────────────────────────────
# SAFETY NET: One-shot poll (used as fallback by scheduler every 5 min)
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_reserves_ws(ws, pair_address: str) -> Dict:
    """Get reserves for a single pair using eth_call over WebSocket."""
    call_id = str(int(time.time() * 1000))
    await ws.send(_rpc(call_id, "eth_call", [{
        "to": pair_address,
        "data": "0x0902f1ac"
    }, "latest"]))
    
    response = await asyncio.wait_for(ws.recv(), timeout=10)
    data = json.loads(response)
    if "error" in data:
        raise ValueError(f"RPC error: {data['error']}")
    
    result = data.get("result")
    if not result or result == "0x" or len(result) < 130:
        raise ValueError(f"Invalid reserves response for {pair_address}")
    
    raw = result[2:]
    reserve0 = int(raw[:64], 16)
    reserve1 = int(raw[64:128], 16)
    timestamp = int(raw[128:192], 16) if len(raw) >= 192 else 0
    
    return {
        "reserve0": safe_mongo_int(reserve0),
        "reserve1": safe_mongo_int(reserve1),
        "timestamp": timestamp
    }


async def update_reserves_once() -> bool:
    """Safety-net: one-shot poll of ALL reserves. Used by scheduler as fallback.
    
    This should rarely be needed if the event subscription is working.
    """
    if not WSS_PROVIDERS:
        logger.error("[RESERVES] No WSS providers configured")
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
                        reserves = await _fetch_reserves_ws(ws, addr)
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


# ─────────────────────────────────────────────────────────────────────────────
# Entry points
# ─────────────────────────────────────────────────────────────────────────────

def start_ws_reserve_updater():
    """Start the event-driven reserve updater (blocking)."""
    logger.info("Starting event-driven WebSocket reserve updater...")
    asyncio.run(reserve_subscription_loop())

if __name__ == "__main__":
    start_ws_reserve_updater()