import logging
import time
from typing import List, Dict, Any
from web3.contract import Contract
from web3._utils.events import get_event_data
from web3.datastructures import AttributeDict
from utils.web3mongo import (
    w3,
    db,
    load_contract_abi,
    setup_event_collections_indexes,
    switch_to_alternate_provider,
    get_current_provider_url,
    contracts  # <-- ¡IMPORTANTE! Usamos los contratos de web3mongo
)
import os
import redis
import json
from hexbytes import HexBytes
import random
from pymongo.errors import DuplicateKeyError

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DEL LISTENER INTELIGENTE ---
POLL_INTERVAL = 15  # Segundos entre cada ciclo de escaneo
INITIAL_BLOCK = 26419000 # El bloque inicial que definiste
BLOCK_CHUNK_SIZE = 2000 # <-- ¡EL CAMBIO CLAVE! (antes era 8)
MAX_RETRIES = 3
RETRY_DELAY = 5
REDIS_LOCK_KEY = "vanellix_listener_lock_v3"
REDIS_LOCK_TIMEOUT = 120 # 2 minutos

# Mapeo de Nombres de Contrato a Colecciones de MongoDB
# (Esto lo sacamos de tu web3mongo.py y roles.py)
CONTRACT_TO_COLLECTION_MAP = {
    "VanellixCompanyMultiToken": "company_events",
    "VanellixTokenFactory": "token_factory_events",
    "VanellixStakingMultiToken": "staking_events",
    "VanellixLaunchpad": "launchpad_events",
    "VanellixTokenSale": "token_sale_events",
    "GlobalMeritocracy": "global_meritocracy_events",
    "CompanyStaking": "staking_events", # Apunta a la misma
    
    # --- Default ---
    # (El resto se irá a 'company_events' por defecto si no se especifica)
}

# --- Helpers de Conversión (los mismos que tenías) ---

def _convert_to_plain_dict(item):
    if isinstance(item, AttributeDict):
        return {k: _convert_to_plain_dict(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [_convert_to_plain_dict(i) for i in item]
    elif isinstance(item, tuple):
        return tuple(_convert_to_plain_dict(i) for i in item)
    return item

def convert_big_ints_to_str(obj):
    if isinstance(obj, dict): return {k: convert_big_ints_to_str(v) for k, v in obj.items()}
    if isinstance(obj, list): return [convert_big_ints_to_str(i) for i in obj]
    if isinstance(obj, int) and abs(obj) > 2**63 - 1: return str(obj)
    return obj

def convert_hexbytes(obj):
    if isinstance(obj, dict): return {k: convert_hexbytes(v) for k, v in obj.items()}
    if isinstance(obj, list): return [convert_hexbytes(i) for i in obj]
    if isinstance(obj, (HexBytes, bytes)): return obj.hex()
    return obj
# --- Fin de helpers ---


def get_last_processed_block(listener_id: str, default_initial_block: int) -> int:
    """Obtiene el último bloque procesado para este listener."""
    state = db.event_listener_state.find_one({"_id": listener_id})
    if state and "last_processed_block" in state:
        return state["last_processed_block"] + 1
    return default_initial_block

def update_last_processed_block(listener_id: str, block_number: int):
    """Actualiza el último bloque procesado para este listener."""
    try:
        db.event_listener_state.update_one(
            {"_id": listener_id},
            {"$set": {"last_processed_block": block_number}},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to update last processed block for {listener_id}: {e}")

def _get_block_number_with_retries(max_retries: int = 3):
    """Obtiene el número de bloque actual con reintentos."""
    for attempt in range(max_retries):
        try:
            return w3.eth.block_number
        except Exception as e:
            msg = str(e)
            if '429' in msg:
                new_url = switch_to_alternate_provider()
                logger.warning(f"Switched provider due to 429. Now using: {new_url}")
            sleep_s = min(30, RETRY_DELAY * (2 ** attempt)) + random.uniform(0, 1)
            logger.warning(f"block_number attempt {attempt+1}/{max_retries} failed: {e}. Sleeping {sleep_s:.2f}s")
            time.sleep(sleep_s)
    raise RuntimeError("Failed to get block_number after retries")

def build_global_maps() -> (Dict[str, Any], Dict[str, Any]):
    """
    Construye dos mapeos globales para todos los contratos en web3mongo.py:
    1. address_map: "0xAddress" -> (contract_name, collection_name, contract_instance)
    2. topic_map: "0xTopicHash" -> (event_name, event_abi)
    """
    address_map = {}
    topic_map = {}
    
    logger.info("Building global address and topic maps...")
    
    # Usamos los contratos ya cargados de web3mongo
    for contract_name, contract_instance in contracts.items():
        address = contract_instance.address
        # Usamos el mapeo o un default
        collection_name = CONTRACT_TO_COLLECTION_MAP.get(contract_name, "company_events") 
        
        address_map[w3.to_checksum_address(address)] = (contract_name, collection_name, contract_instance)
        
        # Iteramos el ABI para construir el topic_map
        for item in contract_instance.abi:
            if item.get('type') == 'event':
                event_name = item['name']
                event_abi = item
                
                # Función para generar la firma canónica
                def get_canonical_type(abi_input_component):
                    if abi_input_component['type'].startswith('tuple'):
                        component_types = ','.join([get_canonical_type(comp) for comp in abi_input_component['components']])
                        return f"({component_types})"
                    return abi_input_component['type']
                
                try:
                    input_types_str = ','.join([get_canonical_type(inp) for inp in event_abi['inputs']])
                    event_signature_text = f"{event_name}({input_types_str})"
                    topic_hash = w3.keccak(text=event_signature_text).hex()
                    
                    if topic_hash not in topic_map:
                        topic_map[topic_hash] = (event_name, event_abi)
                    else:
                        pass # Evento con misma firma en otro contrato (ej. Transfer), está bien
                except Exception as e:
                    logger.error(f"Could not generate topic hash for {contract_name}.{event_name}: {e}")

    logger.info(f"Maps built. {len(address_map)} contracts, {len(topic_map)} unique event topics.")
    return address_map, topic_map

def listen_events(configs: List[Any] = None):
    """
    Loop principal del listener.
    Ignora 'configs' y corre un solo scanner global.
    Usa un lock de Redis para asegurar que solo un worker corra.
    """
    try:
        redis_client = redis.Redis(host=os.getenv("REDIS_HOST", "redis"), port=int(os.getenv("REDIS_PORT", 6379)), db=int(os.getenv("REDIS_DB", 0)))
        redis_client.ping()
    except Exception as e:
        logger.error(f"Could not connect to Redis for listener lock: {e}. Listener exiting.")
        return

    # --- Construimos los mapas una sola vez ---
    try:
        address_map, topic_map = build_global_maps()
        all_addresses = list(address_map.keys())
        if not all_addresses:
            logger.error("No contracts found in web3mongo.py. Listener exiting.")
            return
    except Exception as e:
        logger.error(f"Failed to build contract maps: {e}. Listener exiting.")
        return

    LISTENER_ID = "global_listener_v2" # ID para guardar el checkpoint en Mongo

    logger.info(f"--- 🚀 Event Listener Inteligente V2 Iniciado ---")
    logger.info(f"Escuchando {len(all_addresses)} contratos.")
    logger.info(f"Chunk size: {BLOCK_CHUNK_SIZE} bloques.")

    while True:
        # --- 1. Intentar tomar el Lock ---
        try:
            if not redis_client.set(REDIS_LOCK_KEY, "1", nx=True, ex=REDIS_LOCK_TIMEOUT):
                # Otro worker (otro thread) tiene el lock. Dormimos.
                logger.debug("Another listener thread has the lock. Sleeping.")
                time.sleep(POLL_INTERVAL)
                continue
        except Exception as e:
            logger.error(f"Redis lock failed: {e}. Sleeping.")
            time.sleep(POLL_INTERVAL * 2)
            continue
            
        logger.info("Lock acquired. Running scan cycle.")

        try:
            # --- 2. Definir el Rango de Bloques ---
            current_block = _get_block_number_with_retries()
            from_block = get_last_processed_block(LISTENER_ID, INITIAL_BLOCK)
            
            if from_block > current_block:
                logger.info(f"Already synced up to block {current_block}. Sleeping.")
                redis_client.delete(REDIS_LOCK_KEY) # Soltar el lock
                time.sleep(POLL_INTERVAL)
                continue
                
            # Escaneamos un chunk, o hasta el bloque actual
            to_block = min(from_block + BLOCK_CHUNK_SIZE - 1, current_block)

            # --- 3. ¡UN SOLO LLAMADO A LA API! ---
            log_filter = {
                "fromBlock": from_block,
                "toBlock": to_block,
                "address": all_addresses # <-- ¡La magia! Un array de todas tus direcciones
            }
            
            logger.info(f"Fetching logs from {from_block} to {to_block}...")
            logs = w3.eth.get_logs(log_filter)
            logger.info(f"Found {len(logs)} logs in range.")

            # --- 4. Procesar los Logs ---
            for log in logs:
                try:
                    log_address_checksum = w3.to_checksum_address(log.get('address'))
                    log_topic0 = log.get('topics', [None])[0]
                    
                    if not log_address_checksum or not log_topic0:
                        continue
                        
                    # Mapear el log al contrato y evento
                    contract_info = address_map.get(log_address_checksum)
                    event_info = topic_map.get(log_topic0.hex())
                    
                    if not contract_info or not event_info:
                        # Log de un contrato o evento que no nos interesa
                        continue
                        
                    contract_name, collection_name, _ = contract_info
                    event_name, event_abi = event_info
                    
                    # Decodificar el evento
                    event = get_event_data(w3.codec, event_abi, log)
                    
                    tx_hash = event["transactionHash"].hex()
                    log_index = event["logIndex"]
                    block_number = event["blockNumber"]
                    
                    # Preparar data (formato compatible con tu apis/roles.py)
                    event_data = {
                        "_id": f"{tx_hash}-{log_index}-{log_address_checksum}",
                        "event": event_name,
                        "contract": log_address_checksum, # Guardamos checksummed
                        "contractName": contract_name, 
                        "transactionHash": tx_hash,
                        "args": _convert_to_plain_dict(event["args"]),
                        "blockNumber": block_number,
                        "logIndex": log_index,
                        "raw_log": dict(log) # Guardamos el log crudo por si acaso
                    }
                    
                    # Limpiar data para Mongo
                    event_data = _convert_to_plain_dict(event_data)
                    event_data = convert_big_ints_to_str(event_data)
                    event_data = convert_hexbytes(event_data)
                    
                    # --- 5. Guardar en la Colección Correcta (Directo a Mongo) ---
                    target_collection = db[collection_name]
                    try:
                        target_collection.insert_one(event_data)
                        logger.info(f"[LISTENER] Saved event {contract_name}.{event_name} (Tx: {tx_hash[:10]}...) to collection '{collection_name}'")
                    except DuplicateKeyError:
                        logger.warning(f"Duplicate event {contract_name}.{event_name} (Tx: {tx_hash[:10]}...)")
                    except Exception as e:
                         logger.error(f"Failed to insert event {contract_name}.{event_name} to Mongo: {e}")

                except Exception as e:
                    logger.error(f"Failed to process log: {e}. Log: {log}")

            # --- 6. Actualizar Checkpoint ---
            # Siempre actualizamos al 'to_block', incluso si no hubo logs
            update_last_processed_block(LISTENER_ID, to_block)
            logger.info(f"Cycle complete. Checkpoint updated to block {to_block}.")

        except Exception as e:
            logger.error(f"Main listener loop error: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            # --- 7. Soltar el Lock ---
            try:
                redis_client.delete(REDIS_LOCK_KEY)
            except Exception as e:
                logger.error(f"Failed to release Redis lock: {e}")

        # Dormir antes del próximo ciclo
        time.sleep(POLL_INTERVAL)