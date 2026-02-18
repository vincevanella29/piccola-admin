import time
import logging
from utils.web3mongo import db, w3
from pymongo.errors import DuplicateKeyError

# Hardcoded image paths for known symbols
IMAGE_PATHS = {
    "USDC": "/token-logos/usdc.png",
    "WETH": "/token-logos/weth.png",
    "WMATIC": "/token-logos/wmatic.png",
    "MATIC": "/token-logos/matic.png",
}

logger = logging.getLogger("payment_token")
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

def sync_payment_tokens():
    """
    Syncs payment tokens. Only makes Web3 calls for tokens whose
    symbol/name is not already cached in MongoDB.
    """
    token_sale_events = db['token_sale_events']
    events = list(token_sale_events.find(
        {"event": {"$in": ["PaymentTokenAdded", "PaymentTokenRemoved"]}}
    ).sort([("blockNumber", 1), ("logIndex", 1)]))
    last_event_by_token = {}
    for event in events:
        token = event.get("args", {}).get("token", "").lower()
        if not token:
            continue
        last_event_by_token[token] = event
    active_tokens = [t for t, e in last_event_by_token.items() if e["event"] == "PaymentTokenAdded"]
    
    for token in active_tokens:
        # Check if we already have metadata cached
        existing = db['payment_tokens'].find_one({"address": token})
        if existing and existing.get("symbol") and existing.get("symbol") != "UNKNOWN":
            # Already have good metadata, skip Web3 call
            logger.debug(f"[sync_payment_tokens] Skipping {token}, metadata already cached: {existing.get('symbol')}")
            continue

        symbol = None
        name = None
        imagePath = None
        try:
            erc20_contract = w3.eth.contract(address=w3.to_checksum_address(token), abi=[
                {"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "payable": False, "stateMutability": "view", "type": "function"},
                {"constant": True, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "payable": False, "stateMutability": "view", "type": "function"},
            ])
            symbol = erc20_contract.functions.symbol().call()
            name = erc20_contract.functions.name().call()
            imagePath = IMAGE_PATHS.get(symbol)
        except Exception as e:
            logger.warning(f"[sync_payment_tokens] No se pudo obtener symbol/name para {token}: {e}")
            symbol = "UNKNOWN"
            name = "UNKNOWN"
            imagePath = None
        doc = {
            "address": token,
            "symbol": symbol,
            "name": name,
            "imagePath": imagePath,
            "type": "payment_token"
        }
        try:
            db['payment_tokens'].update_one({"address": token}, {"$set": doc}, upsert=True)
        except DuplicateKeyError:
            pass
        except Exception as e:
            logger.error(f"[sync_payment_tokens] Error al guardar token {token}: {e}")
    # Token nativo (MATIC)
    NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000001010"
    exists = db['payment_tokens'].find_one({"address": NATIVE_TOKEN_ADDRESS})
    if not exists:
        native_doc = {
            "address": NATIVE_TOKEN_ADDRESS,
            "symbol": "MATIC",
            "name": "Polygon",
            "imagePath": IMAGE_PATHS["MATIC"],
            "type": "native"
        }
        db['payment_tokens'].insert_one(native_doc)
    logger.info(f"[sync_payment_tokens] Sincronización completa de payment tokens.")

if __name__ == "__main__":
    while True:
        sync_payment_tokens()
        time.sleep(60)
