# /backend/utils/ws_reserve_updater.py
import asyncio
import logging
import os
import time
from typing import Dict, List
import websockets
import json
from web3 import Web3
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Configuration
WEB3_ALCHEMY_WSS = os.getenv("WEB3_ALCHEMY_WSS")
MONGODB_URI = os.getenv("MONGODB_URI")
UPDATE_INTERVAL = 10  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 5

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# MongoDB setup
client = MongoClient(MONGODB_URI)
db = client['piccola_italia_admin']

# Uniswap Pair ABI
UNISWAP_PAIR_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "getReserves",
        "outputs": [
            {"name": "_reserve0", "type": "uint112"},
            {"name": "_reserve1", "type": "uint112"},
            {"name": "_blockTimestampLast", "type": "uint32"}
        ],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    }
]

def safe_mongo_int(val):
    return str(val) if abs(val) > 2**63 - 1 else int(val)

def _rpc(id_: str, method: str, params):
    return json.dumps({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})

async def get_reserves_ws(ws, pair_address: str) -> Dict:
    """Get reserves for a single pair using WebSocket"""
    call_id = str(int(time.time()))
    await ws.send(_rpc(call_id, "eth_call", [{
        "to": pair_address,
        "data": "0x0902f1ac"  # getReserves() function selector
    }, "latest"]))
    
    response = await ws.recv()
    data = json.loads(response)
    if "error" in data:
        raise ValueError(f"RPC error: {data['error']}")
    
    # Parse the reserves from the response
    reserves_data = data["result"][2:]  # Remove 0x prefix
    reserve0 = int(reserves_data[:64], 16)
    reserve1 = int(reserves_data[64:128], 16)
    timestamp = int(reserves_data[128:], 16)
    
    return {
        "reserve0": safe_mongo_int(reserve0),
        "reserve1": safe_mongo_int(reserve1),
        "timestamp": timestamp
    }

async def reserve_updater_loop():
    """Main WebSocket update loop"""
    if not WEB3_ALCHEMY_WSS:
        logger.error("WEB3_ALCHEMY_WSS not configured")
        return

    while True:
        try:
            async with websockets.connect(WEB3_ALCHEMY_WSS) as ws:
                logger.info("[WS] Connected to WebSocket for reserve updates")
                
                while True:
                    token_pairs = list(db['token_pairs'].find({"exists": True}))
                    updated = 0
                    
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
                            logger.warning(f"[WS] Failed to update reserves for {pair_addr}: {e}")
                    
                    logger.info(f"[WS] Updated reserves for {updated}/{len(token_pairs)} pairs")
                    await asyncio.sleep(UPDATE_INTERVAL)
                    
        except Exception as e:
            logger.error(f"[WS] Connection error: {e}")
            await asyncio.sleep(5)

def start_ws_reserve_updater():
    """Start the WebSocket reserve updater"""
    logger.info("Starting WebSocket reserve updater...")
    asyncio.run(reserve_updater_loop())

if __name__ == "__main__":
    start_ws_reserve_updater()