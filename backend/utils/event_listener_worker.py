import threading
import logging
from utils.event_config import CONFIGS
from utils.event_listener import listen_events
from utils.web3mongo import setup_event_collections_indexes

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def launch_listener_worker(config):
    logger.info(f"[EVENT LISTENER WORKER] Starting listener for {config.contract_name} ({config.event_names})...")
    listen_events([config])

if __name__ == "__main__":
    setup_event_collections_indexes(CONFIGS)
    threads = []
    for config in CONFIGS:
        t = threading.Thread(target=launch_listener_worker, args=(config,), daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join()
