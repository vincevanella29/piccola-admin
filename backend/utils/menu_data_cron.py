import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, time as dtime
import subprocess
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

MENU_WORKER_PATH = os.path.join(os.path.dirname(__file__), 'menu_data_worker.py')

async def run_worker():
    logger.info("[CRON] Sincronizador cron deshabilitado (ya no usa la API antigua).")
    return
    proc = await asyncio.create_subprocess_exec('python3', MENU_WORKER_PATH)
    await proc.communicate()
    logger.info("[CRON] menu_data_worker.py terminado.")

async def main():
    scheduler = AsyncIOScheduler()
    # Corre todos los días a las 4am
    scheduler.add_job(run_worker, 'cron', hour=4, minute=0)
    scheduler.start()
    logger.info("[CRON] Scheduler iniciado. Esperando tareas...")
    # También puedes correr manualmente
    await run_worker()
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
