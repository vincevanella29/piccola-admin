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
from utils.web3_utils import sync_company_data
from utils.web3mongo import db
from utils.companies_tokens import sync_token_pairs, update_pair_reserves
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

            if now_chile.hour == 4 and now_chile.minute == 0:
                logger.info('[INTRANET GROUP] Ejecutando workers de intranet (4:00 AM Chile)')
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
                logger.info(f"[INTRANET GROUP] Resumen 4AM: OK={len(ok_modules)} ERR={len(err_modules)} | OK: {ok_modules} | ERR: {err_modules}")
                # Evitar doble ejecución en el mismo minuto
                await asyncio.sleep(61)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"[INTRANET GROUP] Error del scheduler: {e}\n{traceback.format_exc()}")
            await asyncio.sleep(60)


async def periodic_tiempo_group_worker():
    """Run weather worker at 4:00 AM Chile passing current mesano (YYYYMM)."""
    started_once = False
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

            if now_chile.hour == 4 and now_chile.minute == 0:
                mesano = now_chile.strftime('%Y%m')
                try:
                    logger.info('[TIEMPO GROUP] Ejecutando worker_clima.run_worker(...) (4:00 AM Chile)')
                    clima = importlib.import_module('utils.tiempo.worker_clima')
                    if hasattr(clima, 'run_worker'):
                        clima.run_worker(mesano)
                        logger.info('[TIEMPO GROUP] Finalizado OK: worker_clima')
                    else:
                        logger.warning('[TIEMPO GROUP] Saltado (sin run_worker): utils.tiempo.worker_clima')
                except Exception as e:
                    logger.error(f"[TIEMPO GROUP] Error en worker_clima: {e}\n{traceback.format_exc()}")
                logger.info('[TIEMPO GROUP] Resumen 4AM: intentado=1 (verificar logs OK/ERR arriba)')
                await asyncio.sleep(61)
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
        'utils.mtz.worker_rentabilidad_por_producto_mtz',
        'utils.mtz.worker_rentabilidad_por_producto_locales',
        'utils.mtz.worker_sales_by_waiter_hour_vpn',
        'utils.mtz.worker_cargos',
    ]

    started_once = False
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

            if now_chile.hour == 4 and now_chile.minute == 0:
                mesano = now_chile.strftime('%Y%m')
                logger.info('[MTZ GROUP] Ejecutando workers de MTZ (4:00 AM Chile)')
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
                logger.info(f"[MTZ GROUP] Resumen 4AM: OK={len(ok_modules)} ERR={len(err_modules)} | OK: {ok_modules} | ERR: {err_modules}")
                await asyncio.sleep(61)
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
        setup_event_collections_indexes(CONFIGS)
        threads = []
        for config in CONFIGS:
            t = threading.Thread(target=listen_events, args=([config],), daemon=True)
            t.start()
            threads.append(t)
        for t in threads:
            t.join()

    worker_map = {
        'intranet_group_4am': periodic_intranet_group_worker,
        'mtz_group_4am': periodic_mtz_group_worker,
        'tiempo_group_4am': periodic_tiempo_group_worker,
        'event_listener': event_listener_worker,
        'sync_companies': periodic_sync_companies,
        'update_pair_reserves': periodic_update_pair_reserves,
        'sync_payment_tokens': periodic_sync_payment_tokens,
        'menu_data_worker': periodic_menu_data_worker,
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