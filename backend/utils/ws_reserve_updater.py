# /backend/utils/ws_reserve_updater.py
"""
WebSocket-based reserve updater.
Uses WSS (Alchemy or Infura) to get reserves — NO HTTP RPC calls.
Supports failover between Alchemy WSS and Infura WSS.
"""
import asyncio
import logging
import os
import time
from typing import Dict, Optional
import websockets
import json
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Configuration
WEB3_ALCHEMY_WSS = os.getenv("WEB3_ALCHEMY_WSS")
WEB3_INFURA_WSS = os.getenv("WEB3_INFURA_WSS")
MONGODB_URI = os.getenv("MONGODB_URI")
UPDATE_INTERVAL = 30  # seconds (was 10s — reduced to save RPC credits)
MAX_RETRIES = 3
RETRY_DELAY = 5

# Build WSS provider list (failover order)
WSS_PROVIDERS = [url for url in [WEB3_ALCHEMY_WSS, WEB3_INFURA_WSS] if url]

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# MongoDB setup
client = MongoClient(MONGODB_URI)
db = client['piccola_italia_admin']

def safe_mongo_int(val):
    return str(val) if abs(val) > 2**63 - 1 else int(val)

def _rpc(id_: str, method: str, params):
    return json.dumps({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})

async def get_reserves_ws(ws, pair_address: str) -> Dict:
    """Get reserves for a single pair using WebSocket"""
    call_id = str(int(time.time() * 1000))  # ms precision for unique IDs
    await ws.send(_rpc(call_id, "eth_call", [{
        "to": pair_address,
        "data": "0x0902f1ac"  # getReserves() function selector
    }, "latest"]))
    
    response = await asyncio.wait_for(ws.recv(), timeout=10)
    data = json.loads(response)
    if "error" in data:
        raise ValueError(f"RPC error: {data['error']}")
    
    result = data.get("result")
    if not result or result == "0x" or len(result) < 130:
        raise ValueError(f"Invalid reserves response for {pair_address}")
    
    # Parse the reserves from the response
    reserves_data = result[2:]  # Remove 0x prefix
    reserve0 = int(reserves_data[:64], 16)
    reserve1 = int(reserves_data[64:128], 16)
    timestamp = int(reserves_data[128:192], 16) if len(reserves_data) >= 192 else 0
    
    return {
        "reserve0": safe_mongo_int(reserve0),
        "reserve1": safe_mongo_int(reserve1),
        "timestamp": timestamp
    }

async def _update_with_provider(wss_url: str) -> bool:
    """Try to update reserves using a specific WSS provider. Returns True on success."""
    provider_name = "Alchemy" if "alchemy" in wss_url.lower() else "Infura" if "infura" in wss_url.lower() else "Unknown"
    
    try:
        async with websockets.connect(wss_url, ping_interval=20, ping_timeout=10) as ws:
            logger.info(f"[WS] Connected to {provider_name} WSS for reserve updates")
            
            token_pairs = list(db['token_pairs'].find({"exists": True}))
            updated = 0
            errors = 0
            
            for pair in token_pairs:
                pair_addr = pair.get('pairAddress')
                if not pair_addr or pair_addr == "0x0000000000000000000000000000000000000000":
                    continue
                
                try:
                    reserves_data = await get_reserves_ws(ws, pair_addr)
                    db['token_pairs'].update_one(
                        {"_id": pair["_id"]},
                        {"$set": {"reserves": reserves_data}}
                    )
                    updated += 1
                except Exception as e:
                    errors += 1
                    logger.warning(f"[WS] Failed to update reserves for {pair_addr} via {provider_name}: {e}")
            
            logger.info(f"[WS] Updated reserves for {updated}/{len(token_pairs)} pairs via {provider_name} ({errors} errors)")
            return updated > 0 or errors == 0  # Success if we updated something or had nothing to update
            
    except Exception as e:
        logger.error(f"[WS] {provider_name} WSS connection error: {e}")
        return False

async def reserve_updater_loop():
    """Main WebSocket update loop with provider failover."""
    if not WSS_PROVIDERS:
        logger.error("[WS] No WSS providers configured (need WEB3_ALCHEMY_WSS or WEB3_INFURA_WSS)")
        return

    logger.info(f"[WS] Reserve updater starting with {len(WSS_PROVIDERS)} WSS providers, interval={UPDATE_INTERVAL}s")
    
    while True:
        success = False
        
        # Try each WSS provider in order (failover)
        for wss_url in WSS_PROVIDERS:
            success = await _update_with_provider(wss_url)
            if success:
                break
            logger.warning(f"[WS] Provider failed, trying next...")
        
        if not success:
            logger.error("[WS] All WSS providers failed for reserve update")
        
        await asyncio.sleep(UPDATE_INTERVAL)

def start_ws_reserve_updater():
    """Start the WebSocket reserve updater"""
    logger.info("Starting WebSocket reserve updater...")
    asyncio.run(reserve_updater_loop())

if __name__ == "__main__":
    start_ws_reserve_updater()