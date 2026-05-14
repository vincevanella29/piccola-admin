import asyncio
import logging
import time
from typing import Dict, Set, Optional, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Presence status constants
STATUS_ONLINE = "online"
STATUS_IDLE = "idle"
STATUS_OFFLINE = "offline"

IDLE_TIMEOUT = 300      # 5 minutes without heartbeat → idle
OFFLINE_TIMEOUT = 600   # 10 minutes without heartbeat → offline


class ConnectionManager:
    def __init__(self) -> None:
        # conv_id -> set of client websockets
        self.chat_clients: Dict[int, Set[WebSocket]] = {}
        # conv_id -> set of admin websockets
        self.admin_clients: Dict[int, Set[WebSocket]] = {}
        # ─── Community: channel_slug -> set of websockets ───
        self.channel_clients: Dict[str, Set[WebSocket]] = {}
        # ─── Community: group_id -> set of websockets ───
        self.group_clients: Dict[str, Set[WebSocket]] = {}
        # ─── Community: dm conv_key -> set of websockets ───
        self.dm_clients: Dict[str, Set[WebSocket]] = {}
        # ─── Presence: wallet -> user info + timestamps ───
        self.presence: Dict[str, dict] = {}
        # wallet -> set of websockets (for broadcasting presence updates)
        self.presence_clients: Set[WebSocket] = set()
        # Async lock for thread-safety in async context
        self._lock = asyncio.Lock()
        # Start background presence cleanup
        self._cleanup_task = None

    def start_presence_cleanup(self):
        """Start the background task for idle/offline detection. Call once after event loop is running."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._presence_cleanup_loop())

    async def _presence_cleanup_loop(self):
        """Background loop: check presence timestamps and transition idle/offline."""
        while True:
            try:
                await asyncio.sleep(30)
                now = time.time()
                changed = []
                async with self._lock:
                    for wallet, info in list(self.presence.items()):
                        last = info.get("last_heartbeat", 0)
                        current_status = info.get("status", STATUS_ONLINE)
                        elapsed = now - last

                        if elapsed > OFFLINE_TIMEOUT and current_status != STATUS_OFFLINE:
                            info["status"] = STATUS_OFFLINE
                            changed.append((wallet, STATUS_OFFLINE))
                        elif IDLE_TIMEOUT < elapsed <= OFFLINE_TIMEOUT and current_status == STATUS_ONLINE:
                            info["status"] = STATUS_IDLE
                            changed.append((wallet, STATUS_IDLE))

                # Broadcast changes
                for wallet, new_status in changed:
                    info = self.presence.get(wallet, {})
                    await self._broadcast_presence_update(wallet, new_status, info)

                # Prune truly offline users (offline > 1 hour)
                async with self._lock:
                    for wallet in list(self.presence.keys()):
                        info = self.presence[wallet]
                        if info.get("status") == STATUS_OFFLINE and now - info.get("last_heartbeat", 0) > 3600:
                            del self.presence[wallet]

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Presence cleanup error: {e}")

    # ─── Presence Management ──────────────────────────────────────

    async def set_online(self, wallet: str, user_info: dict) -> None:
        """Mark user as online with their profile info."""
        wallet = wallet.lower()
        was_new = wallet not in self.presence
        was_offline = self.presence.get(wallet, {}).get("status") != STATUS_ONLINE

        async with self._lock:
            self.presence[wallet] = {
                "wallet": wallet,
                "name": user_info.get("name", wallet),
                "cargo": user_info.get("cargo"),
                "seccion": user_info.get("seccion"),
                "profile_image_url": user_info.get("profile_image_url"),
                "status": STATUS_ONLINE,
                "last_heartbeat": time.time(),
            }

        if was_new or was_offline:
            await self._broadcast_presence_update(wallet, STATUS_ONLINE, self.presence[wallet])

    async def heartbeat(self, wallet: str, user_info: dict = None) -> None:
        """Update heartbeat timestamp. If user was idle, transition back to online."""
        wallet = wallet.lower()
        if wallet not in self.presence:
            await self.set_online(wallet, user_info or {})
            return

        was_idle = self.presence[wallet].get("status") == STATUS_IDLE
        async with self._lock:
            self.presence[wallet]["last_heartbeat"] = time.time()
            if user_info:
                for k in ("name", "cargo", "seccion", "profile_image_url"):
                    if user_info.get(k):
                        self.presence[wallet][k] = user_info[k]
            if was_idle:
                self.presence[wallet]["status"] = STATUS_ONLINE

        if was_idle:
            await self._broadcast_presence_update(wallet, STATUS_ONLINE, self.presence[wallet])

    async def set_offline(self, wallet: str) -> None:
        """Mark user as offline."""
        wallet = wallet.lower()
        if wallet in self.presence:
            async with self._lock:
                self.presence[wallet]["status"] = STATUS_OFFLINE
            await self._broadcast_presence_update(wallet, STATUS_OFFLINE, self.presence.get(wallet, {}))

    def get_all_presence(self) -> List[dict]:
        """Return all presence entries."""
        return list(self.presence.values())

    def get_section_presence(self, seccion: str) -> List[dict]:
        """Return presence entries for a specific section."""
        seccion_lower = seccion.lower()
        return [
            p for p in self.presence.values()
            if (p.get("seccion") or "").lower() == seccion_lower
        ]

    def get_online_count(self) -> int:
        return sum(1 for p in self.presence.values() if p.get("status") == STATUS_ONLINE)

    # ─── Presence WebSocket Broadcasting ──────────────────────────

    async def connect_presence(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.presence_clients.add(websocket)
        # Send initial sync
        try:
            await websocket.send_json({
                "type": "presence_sync",
                "members": self.get_all_presence(),
            })
        except Exception:
            pass

    async def disconnect_presence(self, websocket: WebSocket, wallet: str = None) -> None:
        async with self._lock:
            self.presence_clients.discard(websocket)
        if wallet:
            await self.set_offline(wallet)

    async def _broadcast_presence_update(self, wallet: str, status: str, info: dict) -> None:
        """Broadcast a single presence change to all connected presence clients."""
        msg = {
            "type": "presence_update",
            "wallet": wallet,
            "status": status,
            "name": info.get("name", ""),
            "cargo": info.get("cargo"),
            "seccion": info.get("seccion"),
            "profile_image_url": info.get("profile_image_url"),
        }
        stale = []
        for ws in list(self.presence_clients):
            try:
                await ws.send_json(msg)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    self.presence_clients.discard(ws)

    # ─── 1:1 Chat (existing) ──────────────────────────────────────

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

    # ─── Channel WebSocket ────────────────────────────────────────

    async def connect_channel(self, slug: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if slug not in self.channel_clients:
                self.channel_clients[slug] = set()
            self.channel_clients[slug].add(websocket)
        logger.info(f"WebSocket connected: channel={slug}")

    async def disconnect_channel(self, slug: str, websocket: WebSocket) -> None:
        async with self._lock:
            if slug in self.channel_clients and websocket in self.channel_clients[slug]:
                self.channel_clients[slug].remove(websocket)
                if not self.channel_clients[slug]:
                    del self.channel_clients[slug]
        logger.info(f"WebSocket disconnected: channel={slug}")

    async def broadcast_channel(self, slug: str, message: dict) -> None:
        targets = self.channel_clients.get(slug, set())
        if not targets:
            return
        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Broadcast error channel={slug}: {e}")
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    if slug in self.channel_clients and ws in self.channel_clients[slug]:
                        self.channel_clients[slug].remove(ws)
                        if not self.channel_clients[slug]:
                            del self.channel_clients[slug]

    def channel_online_count(self, slug: str) -> int:
        return len(self.channel_clients.get(slug, set()))

    # ─── Group WebSocket ──────────────────────────────────────────

    async def connect_group(self, group_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if group_id not in self.group_clients:
                self.group_clients[group_id] = set()
            self.group_clients[group_id].add(websocket)
        logger.info(f"WebSocket connected: group={group_id}")

    async def disconnect_group(self, group_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            if group_id in self.group_clients and websocket in self.group_clients[group_id]:
                self.group_clients[group_id].remove(websocket)
                if not self.group_clients[group_id]:
                    del self.group_clients[group_id]
        logger.info(f"WebSocket disconnected: group={group_id}")

    async def broadcast_group(self, group_id: str, message: dict) -> None:
        targets = self.group_clients.get(group_id, set())
        if not targets:
            return
        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Broadcast error group={group_id}: {e}")
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    if group_id in self.group_clients and ws in self.group_clients[group_id]:
                        self.group_clients[group_id].remove(ws)
                        if not self.group_clients[group_id]:
                            del self.group_clients[group_id]

    def group_online_count(self, group_id: str) -> int:
        return len(self.group_clients.get(group_id, set()))

    # ─── DM WebSocket ─────────────────────────────────────────

    async def connect_dm(self, conv_key: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if conv_key not in self.dm_clients:
                self.dm_clients[conv_key] = set()
            self.dm_clients[conv_key].add(websocket)
        logger.info(f"WebSocket connected: dm={conv_key}")

    async def disconnect_dm(self, conv_key: str, websocket: WebSocket) -> None:
        async with self._lock:
            if conv_key in self.dm_clients and websocket in self.dm_clients[conv_key]:
                self.dm_clients[conv_key].remove(websocket)
                if not self.dm_clients[conv_key]:
                    del self.dm_clients[conv_key]
        logger.info(f"WebSocket disconnected: dm={conv_key}")

    async def broadcast_dm(self, conv_key: str, message: dict) -> None:
        targets = self.dm_clients.get(conv_key, set())
        if not targets:
            return
        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Broadcast error dm={conv_key}: {e}")
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    if conv_key in self.dm_clients and ws in self.dm_clients[conv_key]:
                        self.dm_clients[conv_key].remove(ws)
                        if not self.dm_clients[conv_key]:
                            del self.dm_clients[conv_key]

manager = ConnectionManager()
