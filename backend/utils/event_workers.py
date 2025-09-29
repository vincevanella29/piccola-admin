# utils/event_workers.py
"""
Biblioteca de Tareas (Workers) para el sistema de Compañía.

Este archivo centraliza la definición de todas las tareas y procesos
que el enqueuer.py debe gestionar, incluyendo los grupos de tareas
de Intranet, MTZ y Tiempo.
"""

import asyncio
import json
import logging
import traceback
import importlib
import threading
import time
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pymongo.errors import DuplicateKeyError

import redis
from utils.web3_utils import sync_company_data
from utils.web3mongo import db, setup_event_collections_indexes
from utils.companies_tokens import sync_token_pairs, update_pair_reserves
from utils.payment_token import sync_payment_tokens
from utils.event_config import CONFIGS
from utils.event_listener import listen_events

# --- Configuración del Logger con Zona Horaria de Chile ---
class ChileTimeFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=ZoneInfo("America/Santiago"))
        return dt.strftime(datefmt or "%Y-%m-%d %H:%M:%S %Z")

logger = logging.getLogger(__name__)
if not logger.handlers:
    stream_handler = logging.StreamHandler()
    formatter = ChileTimeFormatter('%(asctime)s (Chile) [%(levelname)s] (%(threadName)s) %(message)s')
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)
    logger.setLevel(logging.INFO)

# --- Clientes y Helpers ---
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_QUEUE_BLOCKCHAIN = os.getenv("REDIS_QUEUE", "blockchain_events")
redis_client_blocking = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)

def get_current_mesano_chile() -> str:
    """Devuelve el mes/año actual (YYYYMM) en la zona horaria de Chile."""
    return datetime.now(tz=ZoneInfo('America/Santiago')).strftime('%Y%m')

def convert_big_ints_to_str(obj):
    if isinstance(obj, dict): return {k: convert_big_ints_to_str(v) for k, v in obj.items()}
    if isinstance(obj, list): return [convert_big_ints_to_str(i) for i in obj]
    if isinstance(obj, int) and abs(obj) > 2**63 - 1: return str(obj)
    return obj

def process_event(event_data: dict):
    event_data = convert_big_ints_to_str(event_data)
    collection_name = event_data.get('collection', 'default_events')
    try:
        db[collection_name].insert_one(event_data)
        logger.info(f"[EVENT WORKER] Inserted {event_data.get('event')} into {collection_name}")
    except DuplicateKeyError:
        logger.info(f"[EVENT WORKER] Duplicate {event_data.get('event')} in {collection_name}")
    except Exception as e:
        logger.error(f"[EVENT WORKER] Mongo insert failed: {e}\n{traceback.format_exc()}")

# --- Tareas Periódicas (Single-shot) ---

async def sync_companies_task():
    logger.info("Iniciando tarea: sync_companies_task")
    company_ids = db["token_factory_events"].distinct("args.companyId", {"event": "CompanyTokenCreated"})
    for company_id in company_ids:
        await sync_company_data(company_id)
    return {"status": "completed", "companies_synced": len(company_ids)}

async def sync_token_pairs_task():
    logger.info("Iniciando tarea: sync_token_pairs_task")
    sync_token_pairs(logger=logger)
    return {"status": "completed"}

async def update_pair_reserves_task():
    logger.info("Iniciando tarea: update_pair_reserves_task")
    update_pair_reserves(logger=logger)
    return {"status": "completed"}

async def sync_payment_tokens_task():
    logger.info("Iniciando tarea: sync_payment_tokens_task")
    sync_payment_tokens()
    return {"status": "completed"}

# --- Tareas de Grupo (ejecutadas por schedule y/o al arranque) ---

async def menu_data_task():
    logger.info("Iniciando tarea de grupo: menu_data_task")
    menu_data_worker = importlib.import_module('utils.menu_data_worker')
    menu_data_worker.run_worker()
    return {"status": "completed"}

async def sales_kpis_cache_task():
    logger.info("Iniciando tarea de grupo: sales_kpis_cache_task")
    worker = importlib.import_module('utils.kpis.worker_sales_kpis_cache')
    worker.run_worker()
    return {"status": "completed"}

async def intranet_group_task():
    logger.info("Iniciando tarea de grupo: intranet_group_task")
    intranet_modules = [
        'utils.intranet.archivos.worker_trabajadores_intranet',
        'utils.intranet.archivos.worker_cargos_intranet',
        'utils.intranet.archivos.worker_asistencia_diaria_intranet',
        'utils.intranet.archivos.worker_asistencia_extra_intranet',
        'utils.intranet.archivos.worker_modificadores_sueldo_intranet',
        'utils.intranet.archivos.worker_ingreso_modificadores_sueldo_intranet',
        'utils.intranet.archivos.worker_pago_sueldos_intranet',
        'utils.intranet.archivos.worker_gastos_intranet',
    ]
    mesano = get_current_mesano_chile()
    for mod_path in intranet_modules:
        try:
            logger.info(f"[INTRANET GROUP] Ejecutando {mod_path}...")
            mod = importlib.import_module(mod_path)
            if hasattr(mod, 'process_period'):
                mod.process_period(mesano)
            elif hasattr(mod, 'main'):
                import builtins as _builtins
                _orig_input = getattr(_builtins, 'input', None)
                try:
                    _builtins.input = lambda prompt='': mesano
                    mod.main()
                finally:
                    if _orig_input is not None: _builtins.input = _orig_input
            else:
                logger.warning(f"[INTRANET GROUP] Saltado (sin main/process_period): {mod_path}")
        except Exception as e:
            logger.error(f"Error en sub-tarea {mod_path}: {e}")
    return {"status": "completed"}

async def tiempo_group_task():
    logger.info("Iniciando tarea de grupo: tiempo_group_task")
    mesano = get_current_mesano_chile()
    try:
        clima = importlib.import_module('utils.tiempo.worker_clima')
        if hasattr(clima, 'run_worker'):
            clima.run_worker(mesano)
        else:
            logger.warning("[TIEMPO GROUP] Saltado (sin run_worker): utils.tiempo.worker_clima")
    except Exception as e:
        logger.error(f"Error en tarea de tiempo: {e}")
    return {"status": "completed"}

async def mtz_group_task():
    logger.info("Iniciando tarea de grupo: mtz_group_task")
    mtz_modules = [
        'utils.mtz.worker_sucursales',
        'utils.mtz.worker_ventas_locales',
        'utils.mtz.worker_compras_bodega_gastos',
        'utils.mtz.worker_consumo_locales',
        'utils.mtz.worker_recetas_productos',
        'utils.mtz.worker_rentabilidad_por_producto_mtz',
        'utils.mtz.worker_rentabilidad_por_producto_locales',
        'utils.mtz.worker_sales_by_waiter_hour_vpn',
        'utils.mtz.worker_cargos',
        'utils.mtz.worker_restaurant_data',
    ]
    mesano = get_current_mesano_chile()
    for mod_path in mtz_modules:
        try:
            logger.info(f"[MTZ GROUP] Ejecutando {mod_path}...")
            mod = importlib.import_module(mod_path)
            if hasattr(mod, 'process_period'):
                mod.process_period(mesano)
            elif hasattr(mod, 'run_worker'):
                mod.run_worker(mesano)
            elif hasattr(mod, 'main'):
                import builtins as _builtins
                _orig_input = getattr(_builtins, 'input', None)
                try:
                    _builtins.input = lambda prompt='': mesano
                    mod.main()
                finally:
                    if _orig_input is not None: _builtins.input = _orig_input
            else:
                logger.warning(f"[MTZ GROUP] Saltado (sin método de ejecución): {mod_path}")
        except Exception as e:
            logger.error(f"Error en sub-tarea {mod_path}: {e}")
    return {"status": "completed"}

# --- Workers Persistentes ---

def event_listener_persistent():
    logger.info("Iniciando worker persistente: event_listener...")
    setup_event_collections_indexes(CONFIGS)
    threads = []
    for config in CONFIGS:
        target_func = lambda c=config: listen_events([c])
        t = threading.Thread(target=target_func, name=f"Listener-{config.contract_name}", daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

def event_processor_consumer_persistent():
    logger.info("Iniciando worker persistente: event_processor_consumer...")
    while True:
        try:
            result = redis_client_blocking.blpop(REDIS_QUEUE_BLOCKCHAIN, timeout=30)
            if result:
                _, event_json = result
                process_event(json.loads(event_json))
        except Exception as e:
            logger.error(f"Error en event_processor_consumer: {e}")
            time.sleep(5)

# --- 🚀 Catálogo de Workers para el Enqueuer ---
ALL_WORKERS = {
    # Tareas Periódicas
    "sync_companies":       {"func": sync_companies_task,       "type": "io", "schedule": timedelta(minutes=5)},
    "sync_token_pairs":     {"func": sync_token_pairs_task,     "type": "io", "schedule": timedelta(minutes=2)},
    "update_pair_reserves": {"func": update_pair_reserves_task, "type": "io", "schedule": timedelta(seconds=10)},
    "sync_payment_tokens":  {"func": sync_payment_tokens_task,  "type": "io", "schedule": timedelta(minutes=10)},
    
    # Tareas de Grupo Diarias (con ejecución opcional al arranque)
    "menu_data":            {"func": menu_data_task,            "type": "cpu", "schedule": "daily@08:00"},
    "tiempo_group":         {"func": tiempo_group_task,         "type": "cpu", "schedule": "daily@08:00", "run_on_start": True},
    "mtz_group":            {"func": mtz_group_task,            "type": "cpu", "schedule": "daily@08:00", "run_on_start": True},
    "intranet_group":       {"func": intranet_group_task,       "type": "cpu", "schedule": "daily@08:00", "run_on_start": True},
    "sales_kpis_cache":     {"func": sales_kpis_cache_task,     "type": "cpu", "schedule": "daily@08:00", "run_on_start": True},

    # Workers Persistentes (corren constantemente)
    "event_listener":           {"func": event_listener_persistent,           "type": "persistent", "schedule": None},
    "event_processor_consumer": {"func": event_processor_consumer_persistent, "type": "persistent", "schedule": None},
}