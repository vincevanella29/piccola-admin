import asyncio
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self) -> None:
        # conv_id -> set of client websockets
        self.chat_clients: Dict[int, Set[WebSocket]] = {}
        # conv_id -> set of admin websockets
        self.admin_clients: Dict[int, Set[WebSocket]] = {}
        # Async lock for thread-safety in async context
        self._lock = asyncio.Lock()

    async def connect(self, conv_id: int, websocket: WebSocket, is_admin: bool = False) -> None:
        await websocket.accept()
        async with self._lock:
            bucket = self.admin_clients if is_admin else self.chat_clients
            if conv_id not in bucket:
                bucket[conv_id] = set()
            bucket[conv_id].add(websocket)
        logger.info(f"WebSocket connected: conv={conv_id} admin={is_admin}")

    async def disconnect(self, conv_id: int, websocket: WebSocket, is_admin: bool = False) -> None:
        async with self._lock:
            bucket = self.admin_clients if is_admin else self.chat_clients
            if conv_id in bucket and websocket in bucket[conv_id]:
                bucket[conv_id].remove(websocket)
                if not bucket[conv_id]:
                    del bucket[conv_id]
        logger.info(f"WebSocket disconnected: conv={conv_id} admin={is_admin}")

    async def broadcast(self, conv_id: int, message: dict, to_admins: Optional[bool] = None) -> None:
        # to_admins=None -> both; True -> admins; False -> clients
        targets: Set[WebSocket] = set()
        if to_admins is None or to_admins is False:
            targets |= self.chat_clients.get(conv_id, set())
        if to_admins is None or to_admins is True:
            targets |= self.admin_clients.get(conv_id, set())
        if not targets:
            return
        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Broadcast error conv={conv_id}: {e}")
                stale.append(ws)
        # Cleanup stale
        async with self._lock:
            for ws in stale:
                for bucket in (self.chat_clients, self.admin_clients):
                    for cid, conns in list(bucket.items()):
                        if ws in conns:
                            conns.remove(ws)
                            if not conns:
                                del bucket[cid]

manager = ConnectionManager()
