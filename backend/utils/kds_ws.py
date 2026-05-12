"""
delivery/kds_ws.py
==================
WebSocket manager for Kitchen Display System.
Broadcasts order events (new, status_change, item_done) to all connected KDS clients.
"""
import asyncio
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class KDSConnectionManager:
    """Manages WebSocket connections for KDS clients."""

    def __init__(self):
        # location_id -> set of connected KDS websockets
        # "all" is a special key for admins watching all locations
        self.clients: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, location_id: str = "all"):
        await websocket.accept()
        async with self._lock:
            if location_id not in self.clients:
                self.clients[location_id] = set()
            self.clients[location_id].add(websocket)
        total = sum(len(v) for v in self.clients.values())
        logger.info(f"[KDS-WS] Connected: location={location_id} total_clients={total}")

    async def disconnect(self, websocket: WebSocket, location_id: str = "all"):
        async with self._lock:
            if location_id in self.clients:
                self.clients[location_id].discard(websocket)
                if not self.clients[location_id]:
                    del self.clients[location_id]
        total = sum(len(v) for v in self.clients.values())
        logger.info(f"[KDS-WS] Disconnected: location={location_id} total_clients={total}")

    async def broadcast(self, event: dict, location_id: str = None):
        """
        Broadcast an event to KDS clients.
        - location_id=None: broadcast to ALL connected clients
        - location_id="xyz": broadcast to clients subscribed to that location + "all" watchers
        """
        targets: Set[WebSocket] = set()

        if location_id is None:
            # Broadcast to everyone
            for conns in self.clients.values():
                targets |= conns
        else:
            # Specific location + "all" watchers
            targets |= self.clients.get(location_id, set())
            targets |= self.clients.get("all", set())

        if not targets:
            return

        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(event)
            except Exception as e:
                logger.warning(f"[KDS-WS] Send error: {e}")
                stale.append(ws)

        # Clean up stale connections
        if stale:
            async with self._lock:
                for ws in stale:
                    for loc, conns in list(self.clients.items()):
                        conns.discard(ws)
                        if not conns:
                            del self.clients[loc]


# Singleton
kds_manager = KDSConnectionManager()
