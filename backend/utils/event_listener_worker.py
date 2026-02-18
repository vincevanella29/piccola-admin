"""
event_listener_worker.py — WebSocket-only event listener launcher.

🟢 MODE: WebSocket (eth_subscribe via WSS)
🔴 HTTP polling (eth_getLogs) has been REMOVED.

If WSS fails, ws_event_listener.py has built-in HTTP fallback
that ONLY activates after 120s of WS downtime and logs it clearly.
"""
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("=" * 70)
    logger.info("🟢 EVENT LISTENER WORKER: WebSocket mode (ZERO HTTP polling)")
    logger.info("🔴 HTTP polling (eth_getLogs) is DISABLED")
    logger.info("🟡 HTTP fallback: ONLY after 120s WS downtime (with explicit log)")
    logger.info("=" * 70)

    from utils.ws_event_listener import start_ws_listeners_for_all_contracts
    start_ws_listeners_for_all_contracts()
