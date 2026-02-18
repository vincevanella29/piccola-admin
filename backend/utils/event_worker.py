import redis
import json
import time
import asyncio
import logging
import os
import threading
import importlib
import traceback
import argparse
from datetime import datetime
from zoneinfo import ZoneInfo
from pymongo.errors import DuplicateKeyError
from utils.web3_utils import sync_company_data
from utils.web3mongo import db
from utils.companies_tokens import sync_token_pairs
from utils.payment_token import sync_payment_tokens
from utils.event_config import CONFIGS
from utils.event_listener import listen_events
from utils.web3mongo import setup_event_collections_indexes

# --- Configuración de Redis ---
REDIS_HOST = os.getenv("REDIS_HOST", "redis")  # Por defecto, usa el nombre del servicio en Docker
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_QUEUE = os.getenv("REDIS_QUEUE", "blockchain_events")
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Ejecutar grupos 4AM en el arranque del contenedor si está activado
RUN_GROUPS_ON_START = os.getenv("RUN_GROUPS_ON_START", "0") == "1"

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def launch_listener_worker(config):
    logger.info(f"[EVENT LISTENER WORKER] Starting listener for {getattr(config, 'contract_name', 'unknown')} ({getattr(config, 'event_names', [])})...")
    # listen_events espera una lista de configs
    listen_events([config])

def get_current_mesano_chile() -> str:
    """Return current mesano (YYYYMM) in Chile timezone."""
    try:
        chile_tz = ZoneInfo('America/Santiago')
    except Exception:
        import pytz
        chile_tz = pytz.timezone('America/Santiago')
    now_chile = datetime.now(tz=chile_tz)
    return now_chile.strftime('%Y%m')

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
        # Prevent tight loop hammering — sync only every 30 min (was 60s!)
        await asyncio.sleep(1800)

async def periodic_sync_token_pairs():
    while True:
        try:
            sync_token_pairs(logger=logger)
        except Exception as e:
            logger.error(f"[PERIODIC SYNC] Error in sync_token_pairs: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(900)  # every 15 min (was 60s)

async def periodic_update_pair_reserves():
    """Use WebSocket-only reserve updater (NO HTTP RPC calls)."""
    try:
        from utils.ws_reserve_updater import reserve_updater_loop
        await reserve_updater_loop()
    except Exception as e:
        logger.error(f"[PERIODIC SYNC] Error in WS reserve updater: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(30)  # wait before retry

async def periodic_sync_payment_tokens():
    while True:
        try:
            sync_payment_tokens()
        except Exception as e:
            logger.error(f"[PERIODIC SYNC] Error in sync_payment_tokens: {e}\n{traceback.format_exc()}")
        await asyncio.sleep(3600)  # every 1 hour (was 60s)

async def periodic_menu_data_worker():
    last_run_date = None  # 'YYYY-MM-DD' en Chile
    while True:
        try:
            # Hora de Chile
            try:
                chile_tz = ZoneInfo('America/Santiago')
            except Exception:
                import pytz
                chile_tz = pytz.timezone('America/Santiago')
            now_chile = datetime.now(tz=chile_tz)
            today = now_chile.strftime('%Y-%m-%d')
            # Ejecutar una vez después de las 04:00 AM cada día
            if (now_chile.hour >= 4) and (last_run_date != today):
                logger.info('[MENU DATA WORKER] Ejecutando run_worker de menu_data_worker.py (>= 4:00 AM Chile)')
                menu_data_worker = importlib.import_module('utils.menu_data_worker')
                menu_data_worker.run_worker()
                last_run_date = today
                # Evitar re-ejecuciones inmediatas
                await asyncio.sleep(90)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f'[MENU DATA WORKER] Error: {e}\n{traceback.format_exc()}')
            await asyncio.sleep(60)

async def periodic_sales_kpis_cache_worker():
    """Compute and cache sales KPIs daily.

    Runs once per day in Chile time after 04:00. If RUN_GROUPS_ON_START=1, also runs once at startup.
    It calls utils.kpis.worker_sales_kpis_cache.run_worker(), which computes current month
    and, during the first 15 days, also computes the previous month to keep it fresh.
    """
    started_once = False
    last_run_date = None  # 'YYYY-MM-DD' en Chile
    while True:
        try:
            try:
                chile_tz = ZoneInfo('America/Santiago')
            except Exception:
                import pytz
                chile_tz = pytz.timezone('America/Santiago')
            now_chile = datetime.now(tz=chile_tz)

            # Ejecutar una vez al inicio si así se configuró
            if RUN_GROUPS_ON_START and not started_once:
                try:
                    logger.info('[SALES KPIS CACHE] Ejecutando en arranque (RUN_GROUPS_ON_START=1)')
                    worker = importlib.import_module('utils.kpis.worker_sales_kpis_cache')
                    if hasattr(worker, 'run_worker'):
                        worker.run_worker()
                        logger.info('[SALES KPIS CACHE] Finalizado OK en arranque')
                    else:
                        logger.warning('[SALES KPIS CACHE] Saltado (sin run_worker)')
                except Exception as e:
                    logger.error(f"[SALES KPIS CACHE] Error en arranque: {e}\n{traceback.format_exc()}")
                started_once = True
                await asyncio.sleep(61)
                continue

            today = now_chile.strftime('%Y-%m-%d')
            if (now_chile.hour >= 4) and (last_run_date != today):
                try:
                    logger.info('[SALES KPIS CACHE] Ejecutando run_worker (>= 4:00 AM Chile)')
                    worker = importlib.import_module('utils.kpis.worker_sales_kpis_cache')
                    if hasattr(worker, 'run_worker'):
                        worker.run_worker()
                        logger.info('[SALES KPIS CACHE] Finalizado OK')
                    else:
                        logger.warning('[SALES KPIS CACHE] Saltado (sin run_worker)')
                except Exception as e:
                    logger.error(f"[SALES KPIS CACHE] Error: {e}\n{traceback.format_exc()}")
                last_run_date = today
                await asyncio.sleep(90)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"[SALES KPIS CACHE] Error del scheduler: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(60)

def run_async_task(task_func):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(task_func())

# --- Utilidades para consumir eventos desde Redis y persistir en Mongo ---

def convert_big_ints_to_str(obj):
    if isinstance(obj, dict):
        return {k: convert_big_ints_to_str(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_big_ints_to_str(v) for v in obj]
    if isinstance(obj, int) and abs(obj) > 2**63 - 1:
        return str(obj)
    return obj

def process_event(event_data: dict):
    event_data = convert_big_ints_to_str(event_data)
    collection_name = event_data.get('collection', 'staking_events')
    try:
        db[collection_name].insert_one(event_data)
        logger.info(f"[EVENT WORKER] Inserted {event_data.get('event')} into {collection_name} tx={event_data.get('transactionHash')} idx={event_data.get('logIndex')}")
    except DuplicateKeyError:
        logger.info(f"[EVENT WORKER] Duplicate {event_data.get('event')} in {collection_name} tx={event_data.get('transactionHash')} idx={event_data.get('logIndex')}")
    except Exception as e:
        logger.error(f"[EVENT WORKER] Mongo insert failed: {e}\n{traceback.format_exc()}")

async def event_worker_loop():
    logger.info("[EVENT WORKER] Starting Redis event consumer loop...")
    while True:
        try:
            result = redis_client.blpop(REDIS_QUEUE, timeout=5)
            if result:
                _, raw = result
                try:
                    payload = json.loads(raw)
                except Exception:
                    logger.error(f"[EVENT WORKER] Invalid JSON payload: {raw}")
                    await asyncio.sleep(0.1)
                    continue
                process_event(payload)
            else:
                await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"[EVENT WORKER] Error: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(1)

async def periodic_intranet_group_worker():
    """Run all intranet workers at 4:00 AM Chile time.

    Discovers and executes each worker module under `utils.intranet.archivos.*`
    by importing the module and calling its `main()` function.
    """
    # Explicit order of intranet workers
    intranet_worker_modules = [
        'utils.intranet.archivos.worker_trabajadores_intranet',
        'utils.intranet.archivos.worker_cargos_intranet',
        'utils.intranet.archivos.worker_asistencia_diaria_intranet',
        'utils.intranet.archivos.worker_asistencia_extra_intranet',
        'utils.intranet.archivos.worker_modificadores_sueldo_intranet',
        'utils.intranet.archivos.worker_ingreso_modificadores_sueldo_intranet',
        'utils.intranet.archivos.worker_pago_sueldos_intranet',
        'utils.intranet.archivos.worker_gastos_intranet',
    ]

    started_once = False
    last_run_date = None  # 'YYYY-MM-DD' en Chile
    while True:
        try:
            # Hora de Chile
            try:
                chile_tz = ZoneInfo('America/Santiago')
            except Exception:
                import pytz
                chile_tz = pytz.timezone('America/Santiago')
            now_chile = datetime.now(tz=chile_tz)

            # Ejecutar una vez al inicio si así se configuró
            if RUN_GROUPS_ON_START and not started_once:
                logger.info('[INTRANET GROUP] Ejecutando en arranque (RUN_GROUPS_ON_START=1)')
                mesano = now_chile.strftime('%Y%m')
                ok_modules = []
                err_modules = []
                for mod_path in intranet_worker_modules:
                    try:
                        logger.info(f"[INTRANET GROUP] Ejecutando {mod_path}.main() ...")
                        mod = importlib.import_module(mod_path)
                        if hasattr(mod, 'process_period'):
                            mod.process_period(mesano)
                            logger.info(f"[INTRANET GROUP] Finalizado OK (process_period): {mod_path}")
                            ok_modules.append(mod_path)
                        elif hasattr(mod, 'main'):
                            import builtins as _builtins
                            _orig_input = _builtins.input
                            try:
                                _builtins.input = lambda prompt='': mesano
                                mod.main()
                                logger.info(f"[INTRANET GROUP] Finalizado OK (main con input mesano): {mod_path}")
                            finally:
                                _builtins.input = _orig_input
                            ok_modules.append(mod_path)
                        else:
                            logger.warning(f"[INTRANET GROUP] Saltado (sin main ni process_period): {mod_path}")
                    except Exception as e:
                        logger.error(f"[INTRANET GROUP] Error en {mod_path}: {e}\n{traceback.format_exc()}")
                        err_modules.append(mod_path)
                logger.info(f"[INTRANET GROUP] Resumen arranque: OK={len(ok_modules)} ERR={len(err_modules)} | OK: {ok_modules} | ERR: {err_modules}")
                started_once = True
                await asyncio.sleep(61)
                continue

            today = now_chile.strftime('%Y-%m-%d')
            if (now_chile.hour >= 6) and (last_run_date != today):
                logger.info('[INTRANET GROUP] Ejecutando workers de intranet (>= 6:00 AM Chile)')
                mesano = now_chile.strftime('%Y%m')
                ok_modules = []
                err_modules = []
                for mod_path in intranet_worker_modules:
                    try:
                        logger.info(f"[INTRANET GROUP] Ejecutando {mod_path}.main() ...")
                        mod = importlib.import_module(mod_path)
                        # Si el módulo expone process_period(periodo), úsalo directamente
                        if hasattr(mod, 'process_period'):
                            mod.process_period(mesano)
                            logger.info(f"[INTRANET GROUP] Finalizado OK (process_period): {mod_path}")
                            ok_modules.append(mod_path)
                        elif hasattr(mod, 'main'):
                            # Monkeypatch input() para entregar mesano cuando el worker lo pida
                            import builtins as _builtins
                            _orig_input = _builtins.input
                            try:
                                _builtins.input = lambda prompt='': mesano
                                mod.main()
                                logger.info(f"[INTRANET GROUP] Finalizado OK (main con input mesano): {mod_path}")
                            finally:
                                _builtins.input = _orig_input
                            ok_modules.append(mod_path)
                        else:
                            logger.warning(f"[INTRANET GROUP] Saltado (sin main ni process_period): {mod_path}")
                    except Exception as e:
                        logger.error(f"[INTRANET GROUP] Error en {mod_path}: {e}\n{traceback.format_exc()}")
                        err_modules.append(mod_path)

                logger.info('[INTRANET GROUP] Todos los workers de intranet ejecutados.')
                logger.info(f"[INTRANET GROUP] Resumen diario: OK={len(ok_modules)} ERR={len(err_modules)} | OK: {ok_modules} | ERR: {err_modules}")
                last_run_date = today
                # Evitar re-ejecución inmediata
                await asyncio.sleep(90)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"[INTRANET GROUP] Error del scheduler: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(60)


async def periodic_tiempo_group_worker():
    """Run weather worker at 4:00 AM Chile passing current mesano (YYYYMM)."""
    started_once = False
    last_run_date = None  # 'YYYY-MM-DD' en Chile
    while True:
        try:
            try:
                chile_tz = ZoneInfo('America/Santiago')
            except Exception:
                import pytz
                chile_tz = pytz.timezone('America/Santiago')
            now_chile = datetime.now(tz=chile_tz)

            # Ejecutar una vez al inicio si así se configuró
            if RUN_GROUPS_ON_START and not started_once:
                mesano = now_chile.strftime('%Y%m')
                try:
                    logger.info('[TIEMPO GROUP] Ejecutando en arranque (RUN_GROUPS_ON_START=1)')
                    clima = importlib.import_module('utils.tiempo.worker_clima')
                    if hasattr(clima, 'run_worker'):
                        clima.run_worker(mesano)
                        logger.info('[TIEMPO GROUP] Finalizado OK: worker_clima')
                    else:
                        logger.warning('[TIEMPO GROUP] Saltado (sin run_worker): utils.tiempo.worker_clima')
                except Exception as e:
                    logger.error(f"[TIEMPO GROUP] Error en worker_clima: {e}\n{traceback.format_exc()}")
                logger.info('[TIEMPO GROUP] Resumen arranque: intentado=1 (verificar logs OK/ERR arriba)')
                started_once = True
                await asyncio.sleep(61)
                continue

            today = now_chile.strftime('%Y-%m-%d')
            if (now_chile.hour >= 4) and (last_run_date != today):
                mesano = now_chile.strftime('%Y%m')
                try:
                    logger.info('[TIEMPO GROUP] Ejecutando worker_clima.run_worker(...) (>= 4:00 AM Chile)')
                    clima = importlib.import_module('utils.tiempo.worker_clima')
                    if hasattr(clima, 'run_worker'):
                        clima.run_worker(mesano)
                        logger.info('[TIEMPO GROUP] Finalizado OK: worker_clima')
                    else:
                        logger.warning('[TIEMPO GROUP] Saltado (sin run_worker): utils.tiempo.worker_clima')
                except Exception as e:
                    logger.error(f"[TIEMPO GROUP] Error en worker_clima: {e}\n{traceback.format_exc()}")
                logger.info('[TIEMPO GROUP] Resumen diario: intentado=1 (verificar logs OK/ERR arriba)')
                last_run_date = today
                await asyncio.sleep(90)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"[TIEMPO GROUP] Error del scheduler: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(60)


async def periodic_mtz_group_worker():
    """Run MTZ workers at 4:00 AM Chile, passing current mesano (YYYYMM) when required.

    Strategy per module:
    - Call process_period(mesano) if present
    - Else call run_worker(mesano) if present
    - Else call main() with input() monkeypatched to return mesano
    """
    mtz_worker_modules = [
        'utils.mtz.worker_sucursales',
        'utils.mtz.worker_ventas_locales',
        'utils.mtz.worker_compras_bodega_gastos',
        'utils.mtz.worker_consumo_locales',
        'utils.mtz.worker_recetas_productos',
        'utils.mtz.worker_rentabilidad_por_producto_mtz',
        'utils.mtz.worker_rentabilidad_por_producto_locales',
        'utils.mtz.worker_sales_by_waiter_hour_vpn',
        'utils.mtz.worker_cargos',
    ]

    started_once = False
    last_run_date = None  # 'YYYY-MM-DD' en Chile
    while True:
        try:
            try:
                chile_tz = ZoneInfo('America/Santiago')
            except Exception:
                import pytz
                chile_tz = pytz.timezone('America/Santiago')
            now_chile = datetime.now(tz=chile_tz)

            # Ejecutar una vez al inicio si así se configuró
            if RUN_GROUPS_ON_START and not started_once:
                mesano = now_chile.strftime('%Y%m')
                logger.info('[MTZ GROUP] Ejecutando en arranque (RUN_GROUPS_ON_START=1)')
                ok_modules = []
                err_modules = []
                for mod_path in mtz_worker_modules:
                    try:
                        logger.info(f"[MTZ GROUP] Ejecutando {mod_path} ...")
                        mod = importlib.import_module(mod_path)
                        if hasattr(mod, 'process_period'):
                            mod.process_period(mesano)
                            logger.info(f"[MTZ GROUP] OK (process_period): {mod_path}")
                            ok_modules.append(mod_path)
                        elif hasattr(mod, 'run_worker'):
                            mod.run_worker(mesano)
                            logger.info(f"[MTZ GROUP] OK (run_worker): {mod_path}")
                            ok_modules.append(mod_path)
                        elif hasattr(mod, 'main'):
                            import builtins as _builtins
                            _orig_input = _builtins.input
                            try:
                                _builtins.input = lambda prompt='': mesano
                                mod.main()
                                logger.info(f"[MTZ GROUP] OK (main con input mesano): {mod_path}")
                            finally:
                                _builtins.input = _orig_input
                            ok_modules.append(mod_path)
                        else:
                            logger.warning(f"[MTZ GROUP] Saltado (sin main/process_period/run_worker): {mod_path}")
                    except Exception as e:
                        logger.error(f"[MTZ GROUP] Error en {mod_path}: {e}\n{traceback.format_exc()}")
                        err_modules.append(mod_path)
                logger.info(f"[MTZ GROUP] Resumen arranque: OK={len(ok_modules)} ERR={len(err_modules)} | OK: {ok_modules} | ERR: {err_modules}")
                started_once = True
                await asyncio.sleep(61)
                continue

            today = now_chile.strftime('%Y-%m-%d')
            if (now_chile.hour >= 4) and (last_run_date != today):
                mesano = now_chile.strftime('%Y%m')
                logger.info('[MTZ GROUP] Ejecutando workers de MTZ (>= 4:00 AM Chile)')
                ok_modules = []
                err_modules = []
                for mod_path in mtz_worker_modules:
                    try:
                        logger.info(f"[MTZ GROUP] Ejecutando {mod_path} ...")
                        mod = importlib.import_module(mod_path)
                        if hasattr(mod, 'process_period'):
                            mod.process_period(mesano)
                            logger.info(f"[MTZ GROUP] OK (process_period): {mod_path}")
                            ok_modules.append(mod_path)
                        elif hasattr(mod, 'run_worker'):
                            mod.run_worker(mesano)
                            logger.info(f"[MTZ GROUP] OK (run_worker): {mod_path}")
                            ok_modules.append(mod_path)
                        elif hasattr(mod, 'main'):
                            import builtins as _builtins
                            _orig_input = _builtins.input
                            try:
                                _builtins.input = lambda prompt='': mesano
                                mod.main()
                                logger.info(f"[MTZ GROUP] OK (main con input mesano): {mod_path}")
                            finally:
                                _builtins.input = _orig_input
                            ok_modules.append(mod_path)
                        else:
                            logger.warning(f"[MTZ GROUP] Saltado (sin main/process_period/run_worker): {mod_path}")
                    except Exception as e:
                        logger.error(f"[MTZ GROUP] Error en {mod_path}: {e}\n{traceback.format_exc()}")
                        err_modules.append(mod_path)
                logger.info(f"[MTZ GROUP] Resumen diario: OK={len(ok_modules)} ERR={len(err_modules)} | OK: {ok_modules} | ERR: {err_modules}")
                last_run_date = today
                await asyncio.sleep(90)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"[MTZ GROUP] Error del scheduler: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Central Worker Manager")
    parser.add_argument('--list', action='store_true', help='List available workers')
    parser.add_argument('--run', nargs='+', help='Run specific workers by name (default: all)')
    args = parser.parse_args()

    def event_listener_worker():
        """Uses WebSocket subscriptions (NO HTTP polling). Zero eth_getLogs calls."""
        logger.info("[EVENT LISTENER] 🟢 Starting WebSocket-based listener (NO HTTP polling)")
        try:
            from utils.ws_event_listener import start_ws_listeners_for_all_contracts
            start_ws_listeners_for_all_contracts()
        except Exception as e:
            logger.error(f"[EVENT LISTENER] WebSocket listener failed: {e}")
            import traceback
            traceback.print_exc()

    worker_map = {
        'intranet_group_4am': periodic_intranet_group_worker,
        'mtz_group_4am': periodic_mtz_group_worker,
        'tiempo_group_4am': periodic_tiempo_group_worker,
        'sales_kpis_cache': periodic_sales_kpis_cache_worker,
        'event_listener': event_listener_worker,
        'sync_companies': periodic_sync_companies,
        'update_pair_reserves': periodic_update_pair_reserves,
        'sync_payment_tokens': periodic_sync_payment_tokens,
        'menu_data_worker': periodic_menu_data_worker,
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
        # Detectar si el worker es async o sync
        if asyncio.iscoroutinefunction(func):
            target = (lambda f=func: run_async_task(f))
        else:
            target = func
        t = WorkerThread(target=target, name=name)
        t.start()
        worker_threads[name] = t

    try:
        while True:
            time.sleep(10)
            for name, t in list(worker_threads.items()):
                if not t.is_alive():
                    logger.warning(f"[SUPERVISOR] Worker '{name}' murió. Reiniciando...")
                    # Reconstruir target con la misma lógica async/sync
                    _idx = [f.__name__ for f in selected].index(name)
                    _f = selected[_idx]
                    if asyncio.iscoroutinefunction(_f):
                        new_target = (lambda f=_f: run_async_task(f))
                    else:
                        new_target = _f
                    new_t = WorkerThread(target=new_target, name=name)
                    new_t.start()
                    worker_threads[name] = new_t
    except KeyboardInterrupt:
        logger.info("[SUPERVISOR] Deteniendo todos los workers...")
        for t in worker_threads.values():
            t.stop()
        for t in worker_threads.values():
            t.join()