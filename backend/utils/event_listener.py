import logging
import time
from typing import List
from web3.contract import Contract
from web3._utils.events import get_event_data
from web3.datastructures import AttributeDict
from utils.web3mongo import w3, db, load_contract_abi, setup_event_collections_indexes
import os
import redis
import json
from hexbytes import HexBytes

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
POLL_INTERVAL = 10  # Poll every 10 seconds
INITIAL_BLOCK = 26419000  # As per your FastAPI startup
BLOCK_CHUNK_SIZE = 100  # Process 200 blocks at a time (reduce for RPC compatibility)
MAX_RETRIES = 3  # Retry failed RPC calls
RETRY_DELAY = 5  # Seconds between retries

class EventListenerConfig:
    def __init__(self, contract: Contract, event_names: List[str], collection_name: str, contract_name: str):
        self.contract = contract
        self.event_names = event_names
        self.collection_name = collection_name
        self.contract_name = contract_name

def log_abi_structure(configs: List[EventListenerConfig]):
    """Log the ABI structure for the specified events of each contract."""
    for config in configs:
        contract_name = config.contract_name
        event_names = config.event_names
        
        try:
            abi = load_contract_abi(contract_name)
            for event_name in event_names:
                event_abi = next(
                    (item for item in abi if item.get("type") == "event" and item.get("name") == event_name),
                    None
                )
                if not event_abi:
                    logger.error(f"Event '{event_name}' not found in ABI for {contract_name}")
                    continue
                
        except Exception as e:
            logger.error(f"Failed to load ABI for {contract_name}: {e}")

def get_last_processed_block(contract_address: str, event_name: str, default_initial_block: int) -> int:
    """Retrieve the last processed block for a contract-event pair from MongoDB."""
    state = db.event_listener_state.find_one({"_id": f"{contract_address}:{event_name}"})
    if state and "last_processed_block" in state:
        return state["last_processed_block"] + 1
    return default_initial_block

def update_last_processed_block(contract_address: str, event_name: str, block_number: int):
    """Update the last processed block for a contract-event pair in MongoDB."""
    try:
        db.event_listener_state.update_one(
            {"_id": f"{contract_address}:{event_name}"},
            {"$set": {"last_processed_block": block_number}},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to update last processed block for {contract_address}:{event_name}: {e}")

def _convert_to_plain_dict(item):
    if isinstance(item, AttributeDict):
        return {k: _convert_to_plain_dict(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [_convert_to_plain_dict(i) for i in item]
    elif isinstance(item, tuple):
        return tuple(_convert_to_plain_dict(i) for i in item)
    return item

def convert_big_ints_to_str(obj):
    """
    Recursively convert all ints > 2**63-1 to string for MongoDB compatibility.
    """
    if isinstance(obj, dict):
        return {k: convert_big_ints_to_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_big_ints_to_str(i) for i in obj]
    elif isinstance(obj, int):
        # MongoDB max int64: 9223372036854775807
        if abs(obj) > 2**63 - 1:
            return str(obj)
        else:
            return obj
    else:
        return obj

def convert_hexbytes(obj):
    if isinstance(obj, dict):
        return {k: convert_hexbytes(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_hexbytes(i) for i in obj]
    elif isinstance(obj, (HexBytes, bytes)):
        # Convert HexBytes or raw bytes to hex string
        return obj.hex()
    else:
        return obj  

def fetch_and_store_events(config: EventListenerConfig, event_name: str, from_block: int, to_block: int):
    """Fetch events, store them in MongoDB, and update the checkpoint."""
    contract_address = config.contract.address
    collection_name = config.collection_name
    target_collection = db[collection_name]
    
    try:
        # Load event ABI
        event_abi = next(
            (item for item in load_contract_abi(config.contract_name)
             if item.get("type") == "event" and item.get("name") == event_name),
            None
        )
        if not event_abi:
            logger.error(f"ABI not found for {event_name} in {config.contract_name}")
            return

        # Helper function to get canonical type string for an ABI input
        def get_canonical_type(abi_input_component):
            if abi_input_component['type'].startswith('tuple'):
                # Recursively get types for components of the tuple
                component_types = ','.join([get_canonical_type(comp) for comp in abi_input_component['components']])
                # For a top-level tuple in the signature, it's just (type1,type2)
                # If it's a nested tuple, the 'tuple' keyword itself is omitted in favor of just the parentheses
                # However, the abi_to_signature from web3 usually produces `tuple(type1,type2)` for non-anonymous tuples
                # and `(type1,type2)` for anonymous ones or when they are part of a larger signature.
                # For event signatures, the common practice is (type1,type2,...).
                return f"({component_types})"
            return abi_input_component['type']

        # Generate event topic
        input_types_str = ','.join([get_canonical_type(inp) for inp in event_abi['inputs']])
        event_signature_text = f"{event_name}({input_types_str})"
        topic_hash = w3.keccak(text=event_signature_text)
        topic = topic_hash.hex()
        
        if topic.startswith('0x') and len(topic) == 66:
            pass
        elif not topic.startswith('0x') and len(topic) == 64:
            topic = "0x" + topic
        else:
            logger.error(f"Unexpected topic format for {event_name}: '{topic}' (length {len(topic)}), expected 66 chars")
            return
        

        if len(topic[2:]) != 64:
            logger.error(f"Invalid topic length for {event_name}: {len(topic[2:])} chars, expected 64")
            return

        # Process blocks in chunks
        current_from_block = from_block
        while current_from_block <= to_block:
            current_to_block = min(current_from_block + BLOCK_CHUNK_SIZE - 1, to_block)

            for attempt in range(MAX_RETRIES):
                try:
                    # Fetch logs
                    log_filter = {
                        "fromBlock": current_from_block,
                        "toBlock": current_to_block,
                        "address": w3.to_checksum_address(contract_address),
                        "topics": [topic]
                    }
                    try:
                        logs = w3.eth.get_logs(log_filter)
                    except Exception as e:
                        if hasattr(e, 'args') and any('invalid block range params' in str(arg) for arg in e.args):
                            logger.error(f"invalid block range params: from_block={current_from_block}, to_block={current_to_block}, chunk_size={BLOCK_CHUNK_SIZE}. Reduce BLOCK_CHUNK_SIZE if this persists. Error: {e}")
                        else:
                            logger.error(f"Error fetching logs: from_block={current_from_block}, to_block={current_to_block}, Error: {e}")
                        raise

                    # Process and store events
                    for log in logs:
                        try:
                            event = get_event_data(w3.codec, event_abi, log)
                            tx_hash = event["transactionHash"].hex()
                            log_index = event["logIndex"]
                            block_number = event["blockNumber"]
                            
                            # Check for duplicates
                            event_doc_id = {"transactionHash": tx_hash, "logIndex": log_index, "contract": contract_address}
                            if target_collection.count_documents(event_doc_id, limit=1) > 0:
                                continue

                            # Prepare event data
                            event_data = {
                                "_id": f"{tx_hash}-{log_index}-{contract_address}",
                                "event": event_name,
                                "contract": contract_address,
                                "transactionHash": tx_hash,
                                "args": _convert_to_plain_dict(event["args"]),
                                "blockNumber": block_number,
                                "logIndex": log_index,
                                "raw_log": dict(log)
                            }
                            try:
                                block_info = w3.eth.get_block(block_number)
                                event_data["timestamp"] = block_info.get("timestamp", int(time.time()))
                            except Exception as e:
                                logger.warning(f"Failed to fetch timestamp for block {block_number}: {e}")
                                # Push event to Redis queue for async processing
                            event_data = _convert_to_plain_dict(event_data)
                            event_data = convert_big_ints_to_str(event_data)
                            event_data = convert_hexbytes(event_data)
                            event_data['collection'] = collection_name  # Pass collection info to worker
                            try:
                                redis_client = redis.Redis(host=os.getenv("REDIS_HOST", "redis"), port=int(os.getenv("REDIS_PORT", 6379)), db=int(os.getenv("REDIS_DB", 0)) )
                                redis_client.rpush(os.getenv("REDIS_QUEUE", "blockchain_events"), json.dumps(event_data))
                                logger.info(f"[LISTENER] Pushed event {event_name} (Tx: {tx_hash}, LogIndex: {log_index}) to Redis queue")
                            except Exception as e:
                                logger.error(f"[LISTENER] Failed to push event {event_name} (Tx: {tx_hash}, LogIndex: {log_index}) to Redis: {e}\nEvent data: {event_data}")

                            # Log event details
                            logger.info(f"\n=== Event Captured: {event_name} ===")
                            logger.info(f"Contract: {contract_address}")
                            logger.info(f"Transaction Hash: {tx_hash}")
                            logger.info(f"Block Number: {block_number}")
                            logger.info(f"Log Index: {log_index}")
                            logger.info(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(event_data['timestamp']))}")
                            logger.info(f"Arguments: {event_data['args']}")
                            logger.info(f"Raw Log: {event_data['raw_log']}")
                            logger.info(f"====================\n")

                        except Exception as e:
                            logger.error(f"Failed to process log for {event_name}: {e}")

                    # Siempre actualiza el checkpoint al terminar el rango, aunque no haya logs
                    update_last_processed_block(contract_address, event_name, current_to_block)
                    break  # Success, exit retry loop

                except Exception as e:
                    logger.warning(f"Attempt {attempt + 1}/{MAX_RETRIES} failed for {event_name} ({current_from_block}-{current_to_block}): {e}")
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY)
                    else:
                        logger.error(f"All retries failed for {event_name} in {contract_address} ({current_from_block}-{current_to_block}): {e}")
                        break  # Move to next chunk

            current_from_block = current_to_block + 1

    except Exception as e:
        logger.error(f"Failed to process {event_name} in {contract_address}: {e}")

def listen_events(configs: List[EventListenerConfig]):
    """Main loop to log ABI structures, create collections, and listen for events."""
    # Log ABI structures at startup
    log_abi_structure(configs)

    # Create collections and setup indexes
    for config in configs:
        collection_name = config.collection_name
        if collection_name not in db.list_collection_names():
            db.create_collection(collection_name)
    
    # Setup indexes for all collections
    setup_event_collections_indexes(configs)

    while True:
        try:
            current_block = w3.eth.block_number

            for config in configs:
                contract_address = config.contract.address
                for event_name in config.event_names:
                    from_block = get_last_processed_block(contract_address, event_name, INITIAL_BLOCK)
                    if from_block <= current_block:
                        fetch_and_store_events(config, event_name, from_block, current_block)
                    else:
                        pass
        except Exception as e:
            logger.error(f"Main loop error: {e}")
            time.sleep(POLL_INTERVAL * 2)  # Backoff on main loop errors

        time.sleep(POLL_INTERVAL)