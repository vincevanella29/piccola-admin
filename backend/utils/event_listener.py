# /utils/event_listener.py (V4 - BACKUP ONLY)
# ⚠️  THIS FILE IS NOT THE PRIMARY LISTENER.
# ⚠️  Primary listener: ws_event_listener.py (WebSocket, zero HTTP polling)
# ⚠️  This file is only imported for CONTRACT_TO_COLLECTION_MAP and helpers.
# ⚠️  The listen_events() function is HTTP polling and should NOT be called directly.

import logging
import time
from typing import List, Dict, Any
from web3 import Web3  # <--- 1. IMPORTAR Web3
from web3.contract import Contract
from web3._utils.events import get_event_data
from web3.datastructures import AttributeDict
from utils.web3mongo import (
    w3,
    db,
    load_contract_abi,
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
from utils.index.index import ensure_event_indexes, seed_event_listener_state # <-- Importamos el seeder

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DEL LISTENER V4 ---
POLL_INTERVAL = 300  # 5 minutes between scan cycles (was 120s — saved ~60% eth_getLogs)
INITIAL_BLOCK = int(os.getenv("INITIAL_BLOCK", "26419000"))
BLOCK_CHUNK_SIZE = 10000  # 10K blocks per query (was 2K — 5x fewer calls per catch-up)
MAX_RETRIES = 3
RETRY_DELAY = 5
REDIS_LOCK_KEY = "vanellix_listener_lock_v4"
REDIS_LOCK_TIMEOUT = 300  # Match POLL_INTERVAL

# Mapeo de Nombres de Contrato a Colecciones de MongoDB
CONTRACT_TO_COLLECTION_MAP = {
    "VanellixCompanyMultiToken": "company_events",
    "VanellixTokenFactory": "token_factory_events",
    "VanellixStakingMultiToken": "staking_events",
    "VanellixLaunchpad": "launchpad_events",
    "VanellixTokenSale": "token_sale_events",
    "GlobalMeritocracy": "global_meritocracy_events",
    "CompanyStaking": "staking_events",
    "VanellixDAOController": "dao_events"
}

# --- Helpers de Conversión (Sin cambios) ---
def _convert_to_plain_dict(item):
    if isinstance(item, AttributeDict): return {k: _convert_to_plain_dict(v) for k, v in item.items()}
    if isinstance(item, list): return [_convert_to_plain_dict(i) for i in item]
    if isinstance(item, tuple): return tuple(_convert_to_plain_dict(i) for i in item)
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

# --- Checkpointing (Granular, el que te gusta) ---
def get_last_processed_block(contract_address: str, event_name: str) -> int:
    """Obtiene el último bloque procesado para UN evento específico."""
    _id = f"{contract_address}:{event_name}"
    state = db.event_listener_state.find_one({"_id": _id})
    if state and "last_processed_block" in state:
        return state["last_processed_block"] + 1
    # Si no existe, el seeder ya debió crearlo.
    logger.warning(f"No se encontró estado para {_id}. Usando INITIAL_BLOCK {INITIAL_BLOCK}.")
    return INITIAL_BLOCK

def update_last_processed_block(contract_address: str, event_name: str, block_number: int):
    """Actualiza el último bloque procesado para UN evento específico."""
    try:
        db.event_listener_state.update_one(
            {"_id": f"{contract_address}:{event_name}"},
            {"$set": {"last_processed_block": block_number}}
        )
    except Exception as e:
        logger.error(f"Failed to update last processed block for {contract_address}:{event_name}: {e}")

# --- Web3 Helpers (Sin cambios) ---
def _get_block_number_with_retries(max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            return w3.eth.block_number
        except Exception as e:
            msg = str(e); sleep_s = 0
            if ('429' in msg) or ('403' in msg) or ('401' in msg) or ('Forbidden' in msg):
                new_url = switch_to_alternate_provider()
                logger.warning(f"Switched provider due to 429. Now using: {new_url}")
                sleep_s = min(30, RETRY_DELAY * (2 ** attempt)) + random.uniform(0, 1)
            else:
                 sleep_s = min(10, 2 * (2 ** attempt)) + random.uniform(0, 1)
            logger.warning(f"block_number attempt {attempt+1}/{max_retries} failed: {e}. Sleeping {sleep_s:.2f}s")
            time.sleep(sleep_s)
    raise RuntimeError("Failed to get block_number after retries")

# --- Generador de Topic Map (Helper) ---
def _build_event_topic_map(contract_name: str, event_names: List[str]):
    topic_map = {}
    try:
        abi = load_contract_abi(contract_name)
    except Exception as e:
        logger.error(f"Failed to load ABI for {contract_name}: {e}")
        return topic_map

    def get_canonical_type(abi_input_component):
        if abi_input_component['type'].startswith('tuple'):
            return f"({','.join([get_canonical_type(comp) for comp in abi_input_component['components']])})"
        return abi_input_component['type']

    for event_name in event_names:
        event_abi = next((item for item in abi if item.get("type") == "event" and item.get("name") == event_name), None)
        if not event_abi:
            logger.error(f"Event '{event_name}' not found in ABI for {contract_name}")
            continue
        try:
            input_types_str = ','.join([get_canonical_type(inp) for inp in event_abi['inputs']])
            event_signature_text = f"{event_name}({input_types_str})"
            # Aseguramos prefijo 0x usando to_hex
            topic_hash = Web3.to_hex(w3.keccak(text=event_signature_text))
            if not topic_hash.startswith("0x"):
                topic_hash = "0x" + topic_hash  # redundancia defensiva
            topic_map[topic_hash] = (event_name, event_abi)
        except Exception as e:
            logger.error(f"Error al generar topic hash para {contract_name}.{event_name}: {e}")
    return topic_map

# --- El Loop Principal (El Fino) ---
def listen_events(configs: List[Any] = None):
    """
    Loop principal del listener (V4).
    Corre en un solo thread, controlado por Redis lock.
    Escanea contrato por contrato, respetando los checkpoints granulares
    de 'event_listener_state' y el flag 'active'.
    """
    try:
        redis_client = redis.Redis(host=os.getenv("REDIS_HOST", "redis"), port=int(os.getenv("REDIS_PORT", 6379)), db=int(os.getenv("REDIS_DB", 0)))
        redis_client.ping()
    except Exception as e:
        logger.error(f"No se pudo conectar a Redis para el lock: {e}. Saliendo.")
        return

    # --- 1. Seed & Index (Una sola vez al inicio) ---
    try:
        ensure_event_indexes()
        seed_event_listener_state(start_block=INITIAL_BLOCK)
    except Exception as _e:
        logger.warning(f"Fallo al asegurar índices o sembrar (continuando): {_e}")

    logger.info(f"--- 🚀 Event Listener Fino V4 Iniciado ---")
    logger.info(f"Chunk size: {BLOCK_CHUNK_SIZE} bloques.")

    while True:
        # --- 2. Tomar el Lock de Redis ---
        try:
            if not redis_client.set(REDIS_LOCK_KEY, "1", nx=True, ex=REDIS_LOCK_TIMEOUT):
                logger.debug("Otro worker tiene el lock. Durmiendo.")
                time.sleep(POLL_INTERVAL)
                continue
        except Exception as e:
            logger.error(f"Fallo el lock de Redis: {e}. Durmiendo.")
            time.sleep(POLL_INTERVAL * 2)
            continue
            
        logger.info(f"Lock adquirido. Corriendo ciclo de escaneo...")

        try:
            current_block = _get_block_number_with_retries()
            
            # --- 3. Iterar por CADA Contrato (de web3mongo.py) ---
            for contract_name, contract_instance in contracts.items():
                if not contract_instance or not contract_instance.address:
                    continue
                
                contract_address = Web3.to_checksum_address(contract_instance.address)
                collection_name = CONTRACT_TO_COLLECTION_MAP.get(contract_name, "company_events")
                target_collection = db[collection_name]

                # --- 4. Encontrar Eventos ACTIVOS y su bloque más bajo ---
                active_events_checkpoints = {}
                query = {
                    "_id": {"$regex": f"^{contract_address}:"},
                    "active": True # ¡Solo los activos!
                }
                for state in db.event_listener_state.find(query, {"_id": 1, "last_processed_block": 1}):
                    event_name = state["_id"].split(":")[-1]
                    active_events_checkpoints[event_name] = state["last_processed_block"] + 1

                if not active_events_checkpoints:
                    logger.debug(f"No hay eventos activos para {contract_name}. Saltando.")
                    continue

                # --- 5. Definir Rango y Topics para ESTE contrato ---
                min_from_block = min(active_events_checkpoints.values())
                
                if min_from_block > current_block:
                    logger.debug(f"Contrato {contract_name} ya está sincronizado. Saltando.")
                    continue

                to_block = min(current_block, min_from_block + BLOCK_CHUNK_SIZE - 1)
                
                # Construir topic map solo para los eventos activos
                topic_map = _build_event_topic_map(contract_name, list(active_events_checkpoints.keys()))
                if not topic_map:
                    continue
                
                topics_or = list(topic_map.keys())

                # --- 6. Hacer 1 Call por Contrato ---
                log_filter = {
                    "fromBlock": min_from_block,
                    "toBlock": to_block,
                    "address": contract_address,
                    "topics": [topics_or]
                }
                
                logger.info(f"Fetching {contract_name} (activos: {len(topics_or)}) logs from {min_from_block} to {to_block}...")
                
                try:
                    logs = w3.eth.get_logs(log_filter)
                except Exception as e:
                    msg = str(e)
                    logger.error(f"Error en eth_get_logs para {contract_name}: {e}")
                    # Si es rate limit o forbidden, intentamos un switch y un retry único
                    if ('429' in msg) or ('403' in msg) or ('401' in msg) or ('Forbidden' in msg):
                        new_url = switch_to_alternate_provider()
                        logger.warning(f"eth_get_logs retry tras switch de provider -> {new_url}")
                        try:
                            time.sleep(0.2)
                            logs = w3.eth.get_logs(log_filter)
                        except Exception as e2:
                            logger.error(f"Retry get_logs falló para {contract_name}: {e2}")
                            continue
                    else:
                        continue # Saltamos al siguiente contrato
                
                logger.info(f"Found {len(logs)} logs for {contract_name}.")
                
                latest_block_processed_for_event = {}

                # --- 7. Procesar Logs ---
                for log in logs:
                    try:
                        log_topic0 = log.get('topics', [None])[0]
                        if not log_topic0: continue
                        
                        mapped = topic_map.get(log_topic0.hex())
                        if not mapped: continue
                        
                        event_name, event_abi = mapped
                        block_number = log['blockNumber']

                        # Doble check: solo procesamos si el bloque es nuevo PARA ESE EVENTO
                        if block_number < active_events_checkpoints[event_name]:
                            continue

                        event = get_event_data(w3.codec, event_abi, log)
                        tx_hash = event["transactionHash"].hex()
                        log_index = event["logIndex"]

                        event_data = {
                            "_id": f"{tx_hash}-{log_index}-{contract_address}",
                            "event": event_name,
                            "contract": contract_address,
                            "contractName": contract_name,
                            "transactionHash": tx_hash,
                            "args": _convert_to_plain_dict(event["args"]),
                            "blockNumber": block_number,
                            "logIndex": log_index,
                            "raw_log": dict(log)
                        }
                        
                        event_data = _convert_to_plain_dict(event_data)
                        event_data = convert_big_ints_to_str(event_data)
                        event_data = convert_hexbytes(event_data)
                        
                        try:
                            target_collection.insert_one(event_data)
                            logger.info(f"[LISTENER] Saved {contract_name}.{event_name} (Tx: {tx_hash[:10]}...) to '{collection_name}'")
                        except DuplicateKeyError:
                            logger.warning(f"Duplicate event {contract_name}.{event_name} (Tx: {tx_hash[:10]}...)")
                        
                        # Guardamos el bloque más alto VISTO para este evento
                        latest_block_processed_for_event[event_name] = max(
                            latest_block_processed_for_event.get(event_name, 0),
                            block_number
                        )
                    except Exception as e:
                        logger.error(f"Failed to process log: {e}")

                # --- 8. Actualizar Checkpoints Granulares ---
                for event_name in active_events_checkpoints.keys():
                    last_seen_block = latest_block_processed_for_event.get(event_name)
                    
                    if last_seen_block:
                        update_last_processed_block(contract_address, event_name, last_seen_block)
                    elif to_block >= active_events_checkpoints[event_name]:
                        update_last_processed_block(contract_address, event_name, to_block)
                
                # Pausa entre contratos para no ahogar el RPC
                time.sleep(2)

            logger.info("Scan cycle complete.")

        except Exception as e:
            logger.error(f"Main listener loop error: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            # --- 9. Soltar el Lock ---
            try:
                redis_client.delete(REDIS_LOCK_KEY)
            except Exception as e:
                logger.error(f"Failed to release Redis lock: {e}")

        # Dormir antes del próximo ciclo
        time.sleep(POLL_INTERVAL)