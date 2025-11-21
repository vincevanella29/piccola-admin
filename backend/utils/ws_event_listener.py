import logging
import os
import threading
import time
import json
import asyncio
import uuid
from typing import Dict, Any

import websockets
from web3 import Web3
from web3._utils.events import get_event_data
from web3.datastructures import AttributeDict

from utils.web3mongo import (
    w3,
    db,
    load_contract_abi,
    contracts,
)
from utils.event_listener import (
    CONTRACT_TO_COLLECTION_MAP,
    _convert_to_plain_dict,
    convert_big_ints_to_str,
    convert_hexbytes,
)


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

WEB3_ALCHEMY_WSS = os.getenv("WEB3_ALCHEMY_WSS")
INITIAL_BLOCK = int(os.getenv("INITIAL_BLOCK", "26419000"))
WS_HTTP_FALLBACK_DELAY_SEC = int(os.getenv("WS_HTTP_FALLBACK_DELAY_SEC", "60"))
WS_HTTP_RECOVERY_WINDOW_BLOCKS = int(os.getenv("WS_HTTP_RECOVERY_WINDOW_BLOCKS", "300"))


def _build_event_topic_map(contract_name: str):
    topic_map = {}
    try:
        abi = load_contract_abi(contract_name)
    except Exception as e:
        logger.error(f"[WS] Failed to load ABI for {contract_name}: {e}")
        return topic_map

    def get_canonical_type(abi_input_component):
        if abi_input_component["type"].startswith("tuple"):
            return "(" + ",".join(get_canonical_type(c) for c in abi_input_component["components"]) + ")"
        return abi_input_component["type"]

    for item in abi:
        if item.get("type") != "event":
            continue
        event_name = item.get("name")
        try:
            input_types_str = ",".join(get_canonical_type(inp) for inp in item["inputs"])
            event_sig = f"{event_name}({input_types_str})"
            topic_hash = Web3.to_hex(w3.keccak(text=event_sig))
            topic_map[topic_hash] = (event_name, item)
        except Exception as e:
            logger.error(f"[WS] Error building topic hash for {contract_name}.{event_name}: {e}")
    return topic_map


def _current_contract_tip_block(collection_name: str, contract_address: str) -> int:
    doc = (
        db[collection_name]
        .find({"contract": contract_address}, {"blockNumber": 1})
        .sort("blockNumber", -1)
        .limit(1)
    )
    docs = list(doc)
    if not docs:
        return INITIAL_BLOCK
    return docs[0].get("blockNumber", INITIAL_BLOCK)


def _rpc(id_: str, method: str, params):
    return json.dumps({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})


async def _ws_loop_for_contract(contract_name: str, contract_address: str):
    if not WEB3_ALCHEMY_WSS:
        logger.error("WEB3_ALCHEMY_WSS no está seteado. No se puede usar WebSocket.")
        return

    collection_name = CONTRACT_TO_COLLECTION_MAP.get(contract_name, "company_events")
    target_collection = db[collection_name]
    topic_map = _build_event_topic_map(contract_name)

    last_tip = _current_contract_tip_block(collection_name, contract_address)
    ws_down_since: float | None = None

    logger.info(f"[WS] Iniciando listener WS para {contract_name} en {contract_address} desde bloque {last_tip}...")

    while True:
        try:
            async with websockets.connect(WEB3_ALCHEMY_WSS) as ws:
                sub_id = str(uuid.uuid4())
                params = [
                    "logs",
                    {
                        "address": contract_address,
                    },
                ]
                await ws.send(_rpc(sub_id, "eth_subscribe", params))
                logger.info(f"[WS] Suscrito a logs de {contract_name} ({contract_address})")

                ws_down_since = None

                while True:
                    msg_raw = await ws.recv()
                    try:
                        msg = json.loads(msg_raw)
                    except Exception:
                        logger.debug(f"[WS][RAW] {msg_raw}")
                        continue

                    if "id" in msg and "result" in msg:
                        logger.debug(f"[WS][ACK] {contract_name} sub_id={msg['id']} -> {msg['result']}")
                        continue

                    if msg.get("method") != "eth_subscription":
                        logger.debug(f"[WS][MSG] {contract_name}: {msg}")
                        continue

                    params_msg = msg.get("params", {})
                    data = params_msg.get("result")
                    if not isinstance(data, dict):
                        continue

                    try:
                        topic0 = data.get("topics", [None])[0]
                        if not topic0:
                            continue

                        mapped = topic_map.get(topic0)
                        if not mapped:
                            continue

                        event_name, event_abi = mapped
                        block_number_hex = data.get("blockNumber")
                        if not block_number_hex:
                            continue
                        block_number = int(block_number_hex, 16)

                        tx_hash = data.get("transactionHash")
                        log_index_hex = data.get("logIndex")
                        log_index = int(log_index_hex, 16) if isinstance(log_index_hex, str) else log_index_hex

                        log_for_decode: Dict[str, Any] = {
                            "address": data.get("address"),
                            "blockHash": data.get("blockHash"),
                            "blockNumber": block_number,
                            "data": data.get("data"),
                            "logIndex": log_index,
                            "topics": data.get("topics", []),
                            "transactionHash": tx_hash,
                            "transactionIndex": data.get("transactionIndex"),
                        }

                        event = get_event_data(w3.codec, event_abi, AttributeDict(log_for_decode))

                        event_data = {
                            "_id": f"{tx_hash}-{log_index}-{contract_address}",
                            "event": event_name,
                            "contract": contract_address,
                            "contractName": contract_name,
                            "transactionHash": tx_hash,
                            "args": _convert_to_plain_dict(event["args"]),
                            "blockNumber": block_number,
                            "logIndex": log_index,
                            "raw_log": log_for_decode,
                        }

                        event_data = _convert_to_plain_dict(event_data)
                        event_data = convert_big_ints_to_str(event_data)
                        event_data = convert_hexbytes(event_data)

                        try:
                            target_collection.insert_one(event_data)
                            last_tip = max(last_tip, block_number)
                            logger.info(
                                f"[WS][{contract_name}] Saved {event_name} (block {block_number}, tx {str(tx_hash)[:10]}...) a '{collection_name}'"
                            )
                        except Exception as e:
                            logger.debug(f"[WS][{contract_name}] Insert fallida (posible duplicado): {e}")
                    except Exception as e:
                        logger.error(f"[WS][{contract_name}] Error procesando log: {e}")
        except Exception as e:
            logger.error(f"[WS][{contract_name}] WebSocket error/desconexión: {e}")
            if ws_down_since is None:
                ws_down_since = time.time()

            down_for = time.time() - ws_down_since
            if down_for >= WS_HTTP_FALLBACK_DELAY_SEC:
                try:
                    current_block = w3.eth.block_number
                    from_block = last_tip + 1
                    to_block = min(current_block, from_block + WS_HTTP_RECOVERY_WINDOW_BLOCKS)
                    if from_block <= to_block:
                        log_filter = {
                            "fromBlock": from_block,
                            "toBlock": to_block,
                            "address": Web3.to_checksum_address(contract_address),
                        }
                        logger.info(
                            f"[WS-FALLBACK][{contract_name}] HTTP get_logs desde {from_block} hasta {to_block} (tip actual {current_block})"
                        )
                        logs = w3.eth.get_logs(log_filter)
                        for log in logs:
                            try:
                                topic0 = log.get("topics", [None])[0]
                                if not topic0:
                                    continue
                                if isinstance(topic0, bytes):
                                    topic0_key = Web3.to_hex(topic0)
                                else:
                                    topic0_key = topic0

                                mapped = topic_map.get(topic0_key)
                                if not mapped:
                                    continue

                                event_name, event_abi = mapped
                                block_number = log["blockNumber"]
                                tx_hash = log["transactionHash"].hex()
                                log_index = log["logIndex"]

                                event = get_event_data(w3.codec, event_abi, log)

                                event_data = {
                                    "_id": f"{tx_hash}-{log_index}-{contract_address}",
                                    "event": event_name,
                                    "contract": contract_address,
                                    "contractName": contract_name,
                                    "transactionHash": tx_hash,
                                    "args": _convert_to_plain_dict(event["args"]),
                                    "blockNumber": block_number,
                                    "logIndex": log_index,
                                    "raw_log": dict(log),
                                }

                                event_data = _convert_to_plain_dict(event_data)
                                event_data = convert_big_ints_to_str(event_data)
                                event_data = convert_hexbytes(event_data)

                                try:
                                    target_collection.insert_one(event_data)
                                    last_tip = max(last_tip, block_number)
                                    logger.info(
                                        f"[WS-FALLBACK][{contract_name}] Saved {event_name} (block {block_number}, tx {tx_hash[:10]}...)"
                                    )
                                except Exception:
                                    pass
                            except Exception as inner_e:
                                logger.error(f"[WS-FALLBACK][{contract_name}] Error procesando log HTTP: {inner_e}")
                except Exception as http_e:
                    logger.error(f"[WS-FALLBACK][{contract_name}] Error en fallback HTTP: {http_e}")

            time.sleep(5)


def start_ws_listeners_for_all_contracts():
    if not WEB3_ALCHEMY_WSS:
        logger.error("WEB3_ALCHEMY_WSS no está seteado. No se puede iniciar ws_event_listener.")
        return

    threads = []
    for contract_name, contract_instance in contracts.items():
        if not contract_instance or not contract_instance.address:
            continue
        addr = Web3.to_checksum_address(contract_instance.address)
        t = threading.Thread(
            target=lambda n=contract_name, a=addr: asyncio.run(_ws_loop_for_contract(n, a)),
            daemon=True,
        )
        t.start()
        threads.append(t)
        logger.info(f"[WS] Thread iniciado para contrato {contract_name} ({addr})")

    logger.info(f"[WS] Iniciados {len(threads)} threads de WebSocket para contratos.")

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info("[WS] Saliendo de ws_event_listener (Ctrl+C)")


if __name__ == "__main__":
    start_ws_listeners_for_all_contracts()
