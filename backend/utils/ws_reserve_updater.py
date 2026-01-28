# /backend/utils/ws_reserve_updater.py
import asyncio
import logging
import os
from typing import Dict, List
import websockets
from web3 import Web3
from web3.providers.websocket import WebsocketProvider  # Correct import path
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

async def get_reserves_ws(w3_ws: Web3, pair_address: str) -> Dict:
    """Get reserves for a single pair using WebSocket"""
    pair_contract = w3_ws.eth.contract(
        address=w3_ws.to_checksum_address(pair_address),
        abi=UNISWAP_PAIR_ABI
    )
    reserves = await pair_contract.functions.getReserves().call()
    return {
        "reserve0": safe_mongo_int(reserves[0]),
        "reserve1": safe_mongo_int(reserves[1]),
        "timestamp": int(reserves[2])
    }

async def update_reserves_with_retry(w3_ws: Web3, pair: Dict) -> bool:
    """Update reserves with retry logic"""
    pair_addr = pair.get('pairAddress')
    if not pair_addr or pair_addr == "0x0000000000000000000000000000000000000000":
        return False

    for attempt in range(MAX_RETRIES):
        try:
            reserves_data = await get_reserves_ws(w3_ws, pair_addr)
            db['token_pairs'].update_one(
                {"_id": pair["_id"]},
                {"$set": {"reserves": reserves_data}}
            )
            return True
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY * (attempt + 1))
            logger.warning(f"[WS] Attempt {attempt+1} failed for {pair_addr}: {e}")
    return False

async def reserve_updater_loop():
    """Main WebSocket update loop"""
    if not WEB3_ALCHEMY_WSS:
        logger.error("WEB3_ALCHEMY_WSS not configured")
        return

    async with websockets.connect(WEB3_ALCHEMY_WSS) as ws:
        w3_ws = Web3(WebsocketProvider(WEB3_ALCHEMY_WSS))  # Correct initialization
        
        while True:
            try:
                token_pairs = list(db['token_pairs'].find({"exists": True}))
                updated = 0
                
                for pair in token_pairs:
                    if await update_reserves_with_retry(w3_ws, pair):
                        updated += 1
                
                logger.info(f"[WS] Updated reserves for {updated}/{len(token_pairs)} pairs")
                await asyncio.sleep(UPDATE_INTERVAL)
                
            except Exception as e:
                logger.error(f"[WS] Reserve updater error: {e}")
                await asyncio.sleep(5)

def start_ws_reserve_updater():
    """Start the WebSocket reserve updater"""
    logger.info("Starting WebSocket reserve updater...")
    asyncio.run(reserve_updater_loop())

if __name__ == "__main__":
    start_ws_reserve_updater()