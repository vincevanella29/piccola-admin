# enqueuer.py (Actualizado para manejar RUN_GROUPS_ON_START)
import redis
import json
import time
import logging
import traceback
import asyncio
import os
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Thread, Event

from utils.resource_monitor import get_system_load, cleanup as cleanup_monitor
from utils.event_workers import ALL_WORKERS

# --- Configuración ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] (%(threadName)s) %(message)s')
logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_QUEUE = "task_queue"
MAX_WORKERS = os.cpu_count() or 4
RUN_GROUPS_ON_START = os.getenv("RUN_GROUPS_ON_START", "0") == "1"

# --- Conexión a Redis ---
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)

# ... (La clase TaskRunner no cambia) ...
class TaskRunner:
    def __init__(self, task_name: str, task_info: dict):
        self.name = task_name
        self.func = task_info['func']
        self.is_async = asyncio.iscoroutinefunction(self.func)
    def run(self, *args, **kwargs):
        try:
            logger.info(f"Ejecutando tarea '{self.name}'...")
            if self.is_async: result = asyncio.run(self.func(*args, **kwargs))
            else: result = self.func(*args, **kwargs)
            logger.info(f"Tarea '{self.name}' finalizada con éxito.")
            return result
        except Exception as e:
            logger.error(f"Error en la tarea '{self.name}': {e}\n{traceback.format_exc()}")
            raise

class Supervisor:
    def __init__(self):
        self.shutdown_event = Event()
        self.persistent_threads = {}
        self.scheduler_thread = Thread(target=self._scheduler_loop, name="Scheduler")
        self.dispatcher_thread = Thread(target=self._dispatcher_loop, name="Dispatcher")

    # ... (_scheduler_loop y _dispatcher_loop no cambian) ...
    def _scheduler_loop(self):
        last_run = {}
        while not self.shutdown_event.is_set():
            now = datetime.now()
            for name, info in ALL_WORKERS.items():
                schedule = info.get("schedule")
                if not schedule: continue
                if isinstance(schedule, str) and schedule.startswith("daily@"):
                    run_time_str = schedule.split('@')[1]
                    run_hour, run_min = map(int, run_time_str.split(':'))
                    last_run_date = last_run.get(name)
                    if last_run_date is None or (now.date() > last_run_date.date()):
                        if now.hour == run_hour and now.minute == run_min:
                             task = {'name': name, 'args': [], 'kwargs': {}}
                             redis_client.lpush(REDIS_QUEUE, json.dumps(task))
                             logger.info(f"Tarea programada '{name}' encolada (Daily).")
                             last_run[name] = now
                elif isinstance(schedule, timedelta):
                    if name not in last_run or (now - last_run[name]) > schedule:
                        task = {'name': name, 'args': [], 'kwargs': {}}
                        redis_client.lpush(REDIS_QUEUE, json.dumps(task))
                        logger.info(f"Tarea programada '{name}' encolada (Interval).")
                        last_run[name] = now
            self.shutdown_event.wait(60)

    def _dispatcher_loop(self):
        with ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="TaskWorker") as executor:
            while not self.shutdown_event.is_set():
                try:
                    load = get_system_load()
                    logger.debug(f"Carga del sistema: CPU {load['cpu_percent']}% | RAM {load['ram_percent']}%")
                    if not load['cpu_available'] or not load['ram_available']:
                        logger.warning("Carga alta, pausando dispatcher por 10s...")
                        self.shutdown_event.wait(10)
                        continue
                    item = redis_client.blpop(REDIS_QUEUE, timeout=5)
                    if not item: continue
                    _, task_json = item
                    task_data = json.loads(task_json)
                    task_name = task_data['name']
                    task_info = ALL_WORKERS.get(task_name)
                    if not task_info:
                        logger.error(f"Tarea desconocida '{task_name}' recibida. Descartando.")
                        continue
                    runner = TaskRunner(task_name, task_info)
                    executor.submit(runner.run, *task_data.get('args', []), **task_data.get('kwargs', {}))
                except redis.exceptions.RedisError as e:
                    logger.error(f"Error de Redis en dispatcher: {e}")
                    self.shutdown_event.wait(5)
                except Exception as e:
                    logger.critical(f"Error inesperado en dispatcher: {e}\n{traceback.format_exc()}")
    
    def _run_persistent_worker(self, name, func):
        is_async = asyncio.iscoroutinefunction(func)
        while not self.shutdown_event.is_set():
            try:
                logger.info(f"Iniciando worker persistente '{name}'...")
                if is_async: asyncio.run(func())
                else: func()
            except Exception as e:
                logger.error(f"Worker persistente '{name}' ha fallado: {e}. Reiniciando en 10s.\n{traceback.format_exc()}")
                self.shutdown_event.wait(10)
            else:
                logger.warning(f"Worker persistente '{name}' terminó inesperadamente sin error. Reiniciando en 10s...")
                self.shutdown_event.wait(10)

    def start(self):
        logger.info("Iniciando Supervisor de Workers...")
        
        # --- ✅ NUEVA LÓGICA PARA TAREAS AL ARRANQUE ---
        if RUN_GROUPS_ON_START:
            logger.info("RUN_GROUPS_ON_START=1. Encolando tareas marcadas para ejecución inicial...")
            for name, info in ALL_WORKERS.items():
                if info.get("run_on_start", False):
                    task = {'name': name, 'args': [], 'kwargs': {}}
                    redis_client.lpush(REDIS_QUEUE, json.dumps(task))
                    logger.info(f"Tarea de arranque '{name}' encolada.")
        
        # Iniciar workers persistentes
        for name, info in ALL_WORKERS.items():
            if info.get('type') == 'persistent':
                thread = Thread(target=self._run_persistent_worker, args=(name, info['func']), name=f"Persistent-{name}")
                thread.start()
                self.persistent_threads[name] = thread
        
        self.scheduler_thread.start()
        self.dispatcher_thread.start()
        logger.info("✅ Supervisor y todos los hilos iniciados.")

    def stop(self):
        # ... (sin cambios)
        logger.info("Recibida señal de apagado. Deteniendo todos los workers...")
        self.shutdown_event.set()
        threads_to_join = [self.scheduler_thread, self.dispatcher_thread] + list(self.persistent_threads.values())
        for thread in threads_to_join:
            try:
                thread.join(timeout=5)
            except Exception as e:
                logger.error(f"Error al hacer join en el thread {thread.name}: {e}")
        cleanup_monitor()
        logger.info("✅ Todos los workers detenidos. Adiós.")

if __name__ == "__main__":
    supervisor = Supervisor()
    try:
        supervisor.start()
        supervisor.shutdown_event.wait()
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt recibido. Iniciando apagado...")
    finally:
        supervisor.stop()