import redis
import json
import time
import asyncio
import logging
import os
import threading
import importlib
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pymongo.errors import DuplicateKeyError
import traceback
from utils.web3_utils import sync_company_data
from utils.web3mongo import db
from utils.companies_tokens import sync_token_pairs, update_pair_reserves
from utils.payment_token import sync_payment_tokens

# --- Configuración de Redis ---
REDIS_HOST = os.getenv("REDIS_HOST", "redis")  # Por defecto, usa el nombre del servicio en Docker
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_QUEUE = os.getenv("REDIS_QUEUE", "blockchain_events")
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- Utilidad para compatibilidad MongoDB (bigint a str) ---
def convert_big_ints_to_str(obj):
    if isinstance(obj, dict):
        return {k: convert_big_ints_to_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_big_ints_to_str(i) for i in obj]
    elif isinstance(obj, int):
        if abs(obj) > 2**63 - 1:
            return str(obj)
        else:
            return obj
    else:
        return obj

# --- Inserción robusta en MongoDB ---
def process_event(event_data):
    """
    Inserta un evento en la colección MongoDB indicada, con manejo de duplicados y logs claros.
    """
    event_data = convert_big_ints_to_str(event_data)
    collection_name = event_data.get('collection', 'staking_events')
    collection = db[collection_name]
    try:
        collection.insert_one(event_data)
        print(f"[WORKER] Inserted event {event_data.get('event')} (Tx: {event_data.get('transactionHash')}, LogIndex: {event_data.get('logIndex')}) into {collection_name}")
    except DuplicateKeyError:
        print(f"[WORKER] Duplicate event {event_data.get('event')} (Tx: {event_data.get('transactionHash')}, LogIndex: {event_data.get('logIndex')}) in {collection_name}")
    except Exception as e:
        print(f"[WORKER] Failed to insert event into {collection_name}: {e}\n{traceback.format_exc()}")

async def periodic_sync_companies():
    """Periodically sync company data based on companyIds present in token_factory_events.

    Instead of relying on `get_all_companies_tokens`, we query MongoDB for distinct
    `data.companyId` values inside the `token_factory_events` collection. This works even
    if the token is not created yet (isCreated == false).
    """
    while True:
        try:
            # Get distinct companyIds from token_factory_events where companyId is not None
            company_ids = list(
                db["token_factory_events"].distinct(
                    "args.companyId",
                    {"event": "CompanyTokenCreated", "args.companyId": {"$ne": None}}
                )
            )
            logger.info(
                f"[PERIODIC SYNC] Running sync_company_data for {len(company_ids)} companies (from token_factory_events)..."
            )
            for company_id in company_ids:
                logger.info(f"[PERIODIC SYNC] Syncing company_id {company_id}...")
                try:
                    result = await sync_company_data(company_id)
                    logger.info(
                        f"[PERIODIC SYNC] Finished sync_company_data for company_id {company_id}: {'OK' if result else 'FAILED'}"
                    )
                except Exception as e:
                    logger.error(
                        f"[PERIODIC SYNC] Error syncing company_id {company_id}: {e}\n{traceback.format_exc()}"
                    )
            logger.info("[PERIODIC SYNC] sync_company_data completed for all companies.")
        except Exception as e:
            logger.error(f"[PERIODIC SYNC] Error: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(60)

async def event_worker_loop():
    print("[WORKER] Starting event worker. Waiting for events...")
    while True:
        try:
            result = redis_client.blpop(REDIS_QUEUE, timeout=5)  # 5 second timeout
            if result:
                _, event_json = result
                event_data = json.loads(event_json)
                process_event(event_data)
            else:
                await asyncio.sleep(0.1)  # yield to event loop
        except Exception as e:
            logger.error(f"[WORKER] Error: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(1)

async def periodic_sync_token_pairs():
    while True:
        try:
            sync_token_pairs(logger=logger)
        except Exception as e:
            logger.error(f"[PERIODIC SYNC] Error in sync_token_pairs: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(60)

async def periodic_update_pair_reserves():
    while True:
        try:
            update_pair_reserves(logger=logger)
        except Exception as e:
            logger.error(f"[PERIODIC SYNC] Error in update_pair_reserves: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(10)

async def periodic_sync_payment_tokens():
    while True:
        try:
            sync_payment_tokens()
        except Exception as e:
            logger.error(f"[PERIODIC SYNC] Error in sync_payment_tokens: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(60)

async def periodic_menu_data_worker():
    while True:
        try:
            # Hora de Chile
            try:
                chile_tz = ZoneInfo('America/Santiago')
            except Exception:
                import pytz
                chile_tz = pytz.timezone('America/Santiago')
            now_chile = datetime.now(tz=chile_tz)
            # Ejecutar solo a las 4:00 AM
            if now_chile.hour == 4 and now_chile.minute == 0:
                logger.info('[MENU DATA WORKER] Ejecutando run_worker de menu_data_worker.py (4:00 AM Chile)')
                menu_data_worker = importlib.import_module('utils.menu_data_worker')
                menu_data_worker.run_worker()
                # Dormir 61 segundos para evitar doble ejecución en el mismo minuto
                await asyncio.sleep(61)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f'[MENU DATA WORKER] Error: {e}\n{traceback.format_exc()}')
            await asyncio.sleep(60)

def run_async_task(task_func):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(task_func())

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Central Worker Manager")
    parser.add_argument('--list', action='store_true', help='List available workers')
    parser.add_argument('--run', nargs='+', help='Run specific workers by name (default: all)')
    args = parser.parse_args()

    # Map worker names to functions
    from utils.event_config import CONFIGS
    from utils.event_listener import listen_events
    from utils.web3mongo import setup_event_collections_indexes

    def event_listener_worker():
        setup_event_collections_indexes(CONFIGS)
        threads = []
        for config in CONFIGS:
            t = threading.Thread(target=listen_events, args=([config],), daemon=True)
            t.start()
            threads.append(t)
        for t in threads:
            t.join()

    worker_map = {
        'sync_companies': periodic_sync_companies,
        'sync_token_pairs': periodic_sync_token_pairs,
        'update_pair_reserves': periodic_update_pair_reserves,
        'sync_payment_tokens': periodic_sync_payment_tokens,
        'menu_data_worker': periodic_menu_data_worker,
        'event_listener': event_listener_worker,
        'event_worker_loop': event_worker_loop,
    }

    if args.list:
        print("Available workers:")
        for name in worker_map:
            print(f"- {name}")
        exit(0)

    # Determine which workers to run
    if args.run:
        selected = [worker_map[n] for n in args.run if n in worker_map]
        if not selected:
            print("No valid worker names given. Use --list to see available workers.")
            exit(1)
    else:
        selected = list(worker_map.values())

    import time
    import traceback

    # Estructura para reinicio automático
    class WorkerThread(threading.Thread):
        def __init__(self, target, name):
            super().__init__(daemon=True)
            self._target = target
            self._name = name
            self._should_run = True

        def run(self):
            while self._should_run:
                try:
                    self._target()
                except Exception as e:
                    logger.error(f"[SUPERVISOR] Worker '{self._name}' crashed: {e}\n{traceback.format_exc()}")
                    time.sleep(3)  # Espera antes de reiniciar
                else:
                    logger.warning(f"[SUPERVISOR] Worker '{self._name}' terminó sin excepción. Reiniciando en 3s...")
                    time.sleep(3)

        def stop(self):
            self._should_run = False

    # Lanzar y supervisar los workers
    worker_threads = {}
    for func in selected:
        name = func.__name__
        t = WorkerThread(target=lambda: run_async_task(func), name=name)
        t.start()
        worker_threads[name] = t

    try:
        while True:
            time.sleep(10)
            for name, t in list(worker_threads.items()):
                if not t.is_alive():
                    logger.warning(f"[SUPERVISOR] Worker '{name}' murió. Reiniciando...")
                    new_t = WorkerThread(target=lambda: run_async_task(selected[[f.__name__ for f in selected].index(name)]), name=name)
                    new_t.start()
                    worker_threads[name] = new_t
    except KeyboardInterrupt:
        logger.info("[SUPERVISOR] Deteniendo todos los workers...")
        for t in worker_threads.values():
            t.stop()
        for t in worker_threads.values():
            t.join()