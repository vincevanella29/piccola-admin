import os
import logging
import asyncio
import json
import uuid
import websockets

"""Script simple para testear el WebSocket de Alchemy usando JSON-RPC directo.

Uso rápido (desde /backend):

  export ALCHEMY_WS_URL="wss://polygon-amoy.g.alchemy.com/v2/TU_API_KEY"
  export WS_TEST_CONTRACT_ADDRESS="0xTuContrato"
  python utils/alchemy_ws_test.py

Hace:
- Conecta al WebSocket de Alchemy.
- eth_subscribe a "newHeads" (nuevos bloques).
- eth_subscribe a "logs" del contrato dado.
- Imprime cada notificación que llega.
"""

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

ALCHEMY_WS_URL = os.getenv("ALCHEMY_WS_URL") or "wss://polygon-amoy.g.alchemy.com/v2/vuTJtIniZakp9dZhptNjM"
CONTRACT_ADDRESS = os.getenv("WS_TEST_CONTRACT_ADDRESS") or "0xECe6da1C29895BFaC35A97c9f6924d8377703A78"


def _rpc(id_: str, method: str, params):
    return json.dumps({
        "jsonrpc": "2.0",
        "id": id_,
        "method": method,
        "params": params,
    })


async def main():
    if not ALCHEMY_WS_URL:
        logger.error("ALCHEMY_WS_URL no está seteada. Exporta la WSS URL de Alchemy en el entorno.")
        return

    logger.info(f"Conectando a Alchemy WSS: {ALCHEMY_WS_URL}")

    async with websockets.connect(ALCHEMY_WS_URL) as ws:
        # Suscribirse a nuevos bloques (newHeads)
        sub_newheads_id = str(uuid.uuid4())
        await ws.send(_rpc(sub_newheads_id, "eth_subscribe", ["newHeads"]))

        # Suscribirse a logs del contrato
        sub_logs_id = None
        if CONTRACT_ADDRESS:
            sub_logs_id = str(uuid.uuid4())
            params = [
                "logs",
                {
                    "address": CONTRACT_ADDRESS,
                },
            ]
            await ws.send(_rpc(sub_logs_id, "eth_subscribe", params))

        logger.info("Suscrito. Esperando notificaciones (Ctrl+C para salir)...")

        try:
            while True:
                msg_raw = await ws.recv()
                try:
                    msg = json.loads(msg_raw)
                except Exception:
                    logger.info(f"[RAW] {msg_raw}")
                    continue

                # Respuestas a suscripciones
                if "id" in msg and "result" in msg:
                    logger.info(f"[SUB-ACK] id={msg['id']} result={msg['result']}")
                    continue

                # Notificaciones de eventos
                if msg.get("method") == "eth_subscription":
                    params = msg.get("params", {})
                    sub_id = params.get("subscription")
                    data = params.get("result")

                    if sub_id and data:
                        if sub_id == msg.get("id"):
                            # raro, pero lo ignoramos
                            pass

                        if isinstance(data, dict) and data.get("number") is not None:
                            # newHeads
                            logger.info(f"[BLOCK] number={int(data['number'], 16)} hash={data['hash'][:10]}")
                        else:
                            # logs
                            addr = data.get("address")
                            blk = data.get("blockNumber")
                            tx = data.get("transactionHash")
                            topics = data.get("topics")
                            blk_num = int(blk, 16) if isinstance(blk, str) else blk
                            tx_short = tx[:10] if isinstance(tx, str) else str(tx)
                            logger.info(f"[LOG] addr={addr} block={blk_num} tx={tx_short} topics={topics}")
                    continue

                logger.info(f"[MSG] {msg}")
        except KeyboardInterrupt:
            logger.info("Cerrando listener de WebSocket (Ctrl+C)")


if __name__ == "__main__":
    asyncio.run(main())
