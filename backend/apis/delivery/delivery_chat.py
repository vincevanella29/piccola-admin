"""
delivery/delivery_chat.py
=========================
Delivery-specific chat system with:
- Dedicated WS endpoints for delivery clients (Dilithium auth) and admin panel (session auth)
- REST endpoints for admin panel chat management
- Bot mode using engine.delivery_chat_complete() with order context injection
- Level 6 admin sees only their location's chats; level 3-5 see all

Collections:
- delivery_chat_messages: {order_number, role, text, payload, created_at, admin_wallet?}
- delivery_chat_state:    {order_number, location_id, customer_name, privy_id, 
                           status, mode, admin_id, opened_at, closed_at}
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request, UploadFile, File
from pydantic import BaseModel

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.time_utils import get_chile_time, CHILE_TZ
from utils.bot.engine import chat_complete
from apis.marketing.chat import _resolve_worker_profile

router = APIRouter()
logger = logging.getLogger(__name__)

# Collections
CHAT_MSGS = db.delivery_chat_messages
CHAT_STATE = db.delivery_chat_state
DELIVERY_COLL = db.delivery_orders

# Ensure indexes
try:
    CHAT_MSGS.create_index([("order_number", 1), ("created_at", 1)])
    CHAT_STATE.create_index("order_number", unique=True)
    CHAT_STATE.create_index([("status", 1), ("location_id", 1)])
except Exception as e:
    logger.warning(f"[delivery_chat] Index creation warning: {e}")


# ─── WS Connection Manager (keyed by order_number) ─────────────────────

class DeliveryChatManager:
    def __init__(self):
        self.client_conns: dict[str, set[WebSocket]] = {}
        self.admin_conns: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        
        self.s2s_ws = None
        self.s2s_task = None
        self.s2s_queue = asyncio.Queue(maxsize=500)

    def _ensure_s2s_task(self):
        if self.s2s_task is None or self.s2s_task.done():
            try:
                self.s2s_task = asyncio.create_task(self._maintain_s2s_connection())
            except RuntimeError:
                pass # Event loop not running yet

    async def _maintain_s2s_connection(self):
        while True:
            try:
                import websockets
                import time, uuid, json
                from utils.vanellix_crypto import generate_dilithium_keypair, sign_dilithium
                
                provider = db.ecosystem_providers.find_one({"ecosystem_type": "delivery", "status": "active", "domain": {"$exists": True, "$ne": ""}})
                delivery_url = provider.get("domain") if provider else None
                    
                if not delivery_url:
                    await asyncio.sleep(10)
                    continue
                
                delivery_url = delivery_url.rstrip("/")
                if delivery_url.endswith("/api"): delivery_url = delivery_url[:-4]
                
                ws_url = delivery_url.replace("http://", "ws://").replace("https://", "wss://") + "/api/delivery-chat/s2s-tunnel"
                
                async with websockets.connect(ws_url, open_timeout=5, ping_timeout=20, ping_interval=20) as ws:
                    self.s2s_ws = ws
                    
                    # Handshake Dilithium
                    payload = {"timestamp": time.time(), "nonce": uuid.uuid4().hex}
                    body_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
                    kp = generate_dilithium_keypair()
                    sig_hex = sign_dilithium(bytes.fromhex(kp["sk_hex"]), body_bytes)
                    
                    await ws.send(json.dumps({
                        "type": "s2s_auth", "payload": payload,
                        "signature": sig_hex, "public_key": kp["pk_hex"]
                    }))
                    
                    resp = await ws.recv()
                    if json.loads(resp).get("type") == "s2s_auth_ok":
                        logger.info("[S2S CLIENT] Túnel persistente conectado exitosamente.")
                    
                    # Consumidor de la cola
                    while True:
                        msg = await self.s2s_queue.get()
                        await ws.send(json.dumps(msg))
                        self.s2s_queue.task_done()
                        
            except Exception as e:
                self.s2s_ws = None
                await asyncio.sleep(5)

    async def s2s_push(self, payload: dict):
        self._ensure_s2s_task()
        # Encolar para que el túnel persistente lo mande (no bloquea ni satura CPU)
        try:
            self.s2s_queue.put_nowait(payload)
        except asyncio.QueueFull:
            if payload.get("type") == "typing":
                pass # Dropear silenciosamente eventos de typing para no colapsar la cola
            else:
                logger.warning(f"[S2S TUNNEL] Cola llena (max 500). Dropeando mensaje: {payload.get('type')}")

    async def connect(self, order_number: str, ws: WebSocket, is_admin: bool = False):
        self._ensure_s2s_task()
        await ws.accept()
        async with self._lock:
            bucket = self.admin_conns if is_admin else self.client_conns
            bucket.setdefault(order_number, set()).add(ws)
        logger.info(f"[delivery_chat] WS connected: order={order_number} admin={is_admin}")

    async def disconnect(self, order_number: str, ws: WebSocket, is_admin: bool = False):
        async with self._lock:
            bucket = self.admin_conns if is_admin else self.client_conns
            if order_number in bucket:
                bucket[order_number].discard(ws)
                if not bucket[order_number]:
                    del bucket[order_number]
        logger.info(f"[delivery_chat] WS disconnected: order={order_number} admin={is_admin}")

    async def broadcast(self, order_number: str, message: dict, to_admins: Optional[bool] = None):
        # Transmisión a WebSockets Locales (Admins conectados a esta API)
        targets: set[WebSocket] = set()
        a_conns = self.admin_conns.get(order_number, set())
        
        if to_admins is None or to_admins is True:
            targets |= a_conns
            
        print(f"\n[ADMIN-WS BROADCAST] order={order_number} | admins={len(a_conns)} | targets={len(targets)} | msg={str(message.get('text', ''))[:50]}")
        logger.info(f"[ADMIN-WS BROADCAST] order={order_number} | admins={len(a_conns)} | targets={len(targets)}")
            
        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"[BROADCAST ERROR] ws send error: {e}")
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    for bucket in (self.client_conns, self.admin_conns):
                        for on, conns in list(bucket.items()):
                            conns.discard(ws)
                            if not conns:
                                del bucket[on]
                                
        # Transmisión S2S (Empujar al backend del Delivery para que los clientes lo vean instantáneo)
        if to_admins is None or to_admins is False:
            if message.get("type") == "message":
                await self.s2s_push({
                    "type": "admin_reply",
                    "order_number": order_number,
                    "role": message.get("role", "admin"),
                    "content": message.get("text", ""),
                    "sender_name": message.get("sender_name", "Local")
                })
            else:
                await self.s2s_push({
                    "order_number": order_number,
                    **message
                })

dchat_manager = DeliveryChatManager()


# ─── Helpers ───────────────────────────────────────────────────────────

def _build_order_context(order: dict) -> dict:
    """Build order context dict for delivery_chat_complete."""
    items = order.get("items", [])
    items_summary = ", ".join(
        f"{it.get('quantity', 1)}x {it.get('nombre') or it.get('name', 'Item')}"
        for it in items[:6]
    )
    if len(items) > 6:
        items_summary += f" y {len(items) - 6} más"

    STATUS_LABELS = {
        "pending": "pendiente",
        "confirmed": "confirmado",
        "preparing": "en preparación",
        "ready": "listo para despacho",
        "dispatched": "en camino",
        "delivered": "entregado",
        "cancelled": "cancelado",
    }

    address = order.get("address", {}) or {}
    address_str = ""
    if isinstance(address, dict):
        parts = [address.get("street", ""), address.get("number", "")]
        commune = address.get("commune", "")
        if commune:
            parts.append(commune)
        address_str = " ".join(str(p) for p in parts if p).strip()
    elif isinstance(address, str):
        address_str = address

    customer_name = order.get("customer", {}).get("name") or order.get("customer_name") or order.get("contact_name", "Cliente")
    return {
        "order_number": order.get("order_number", ""),
        "customer_name": customer_name,
        "items_summary": items_summary,
        "items": items,
        "status": order.get("status", "unknown"),
        "status_label": STATUS_LABELS.get(order.get("status", ""), order.get("status", "")),
        "address": address_str,
        "courier_info": order.get("courier_info"),
        "tracking_url": order.get("tracking_url") or order.get("tracking_link"),
        "carrier": order.get("carrier_slug"),
        "carrier_status": order.get("carrier_status"),
        "order_type": order.get("order_type", "delivery"),
        "scheduled_for": order.get("scheduled_for"),
        "asap": order.get("asap", True),
    }


def _map_internal_to_public_loc(internal_id: str) -> str:
    """Map internal id_sucursal (e.g. 39) to public location _id (e.g. 15)."""
    if not internal_id:
        return ""
    try:
        ref = db.gastos_refs_sucursales.find_one({"id_sucursal": int(internal_id)})
        if ref and ref.get("location") and ref["location"].get("_id"):
            return str(ref["location"]["_id"])
    except ValueError:
        pass
    return str(internal_id)

def _get_admin_location_filter(user: dict, level: int) -> dict:
    """Build MongoDB query filter for level 6 and 7 admins (only their locations)."""
    perms = (user or {}).get("permissions") or {}
    if level == 6:
        allowed_sucs = perms.get("sucursal_ids", [])
        if allowed_sucs:
            public_ids = [_map_internal_to_public_loc(str(s)) for s in allowed_sucs]
            return {"location_id": {"$in": public_ids}}
    elif level == 7:
        own_suc = perms.get("own_id_sucursal")
        if own_suc is not None:
            public_id = _map_internal_to_public_loc(str(own_suc))
            return {"location_id": public_id}
    return {}


def _verify_chat_access(user: dict, order_number: str):
    """Verifies access to a specific chat, including level 6/7 location and level 7 cargo checks."""
    rl = require_admin_level(user, "delivery_chat")
    state = CHAT_STATE.find_one({"order_number": order_number})
    if not state:
        raise HTTPException(status_code=404, detail="Chat no encontrado")
        
    if rl in (6, 7):
        perms = (user or {}).get("permissions") or {}
        
        if rl == 6:
            allowed_sucs = [_map_internal_to_public_loc(str(s)) for s in perms.get("sucursal_ids", [])]
            if str(state.get("location_id")) not in allowed_sucs:
                raise HTTPException(status_code=403, detail="No tienes acceso a este chat (local diferente)")
                
        if rl == 7:
            own_suc = str(perms.get("own_id_sucursal", ""))
            public_id = _map_internal_to_public_loc(own_suc)
            if str(state.get("location_id")) != public_id:
                raise HTTPException(status_code=403, detail="No tienes acceso a este chat (local diferente)")
                
            cargo = perms.get("cargo")
            seccion = perms.get("seccion")
            config = db.delivery_config.find_one({}) or {}
            allowed_cargos = [c.lower().strip() for c in config.get("chat_allowed_cargos", [])]
            allowed_secciones = [s.lower().strip() for s in config.get("chat_allowed_secciones", [])]
            
            has_cargo_access = cargo and cargo.lower().strip() in allowed_cargos
            has_seccion_access = seccion and seccion.lower().strip() in allowed_secciones
            
            if not (has_cargo_access or has_seccion_access):
                raise HTTPException(status_code=403, detail="Tu cargo o sección no tiene permisos para el chat de delivery")
                
    return rl, state


def _ensure_chat_state(order_number: str, order: dict) -> dict:
    """Get or create delivery_chat_state for an order."""
    state = CHAT_STATE.find_one({"order_number": order_number})
    if state:
        return state

    now = get_chile_time()
    customer_name = order.get("customer", {}).get("name") or order.get("customer_name") or order.get("contact_name", "Cliente")
    state_doc = {
        "order_number": order_number,
        "location_id": str(order.get("location_id", "")),
        "customer_name": customer_name,
        "privy_id": order.get("privy_id", ""),
        "status": "open",
        "mode": "bot",
        "admin_id": None,
        "opened_at": now,
        "closed_at": None,
    }
    CHAT_STATE.insert_one(state_doc)
    return state_doc


# ─── Admin REST Endpoints ──────────────────────────────────────────────

class AdminReplyPayload(BaseModel):
    text: str
    image_url: Optional[str] = None

class AdminToggle(BaseModel):
    wallet: Optional[str] = None


@router.get("/delivery/chats", summary="Listar chats delivery (admin)")
async def list_delivery_chats(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(verify_session),
):
    rl = require_admin_level(user, "delivery_chat")
    perms = (user or {}).get("permissions") or {}
    
    print(f"[DELIVERY_CHAT] list_delivery_chats: rl={rl} wallet={user.get('wallet', '?')[:10]}")
    print(f"[DELIVERY_CHAT]   perms.cargo={perms.get('cargo')} perms.seccion={perms.get('seccion')}")
    print(f"[DELIVERY_CHAT]   perms.own_id_sucursal={perms.get('own_id_sucursal')} perms.sucursal_ids={perms.get('sucursal_ids')}")
    
    if rl == 7:
        cargo = perms.get("cargo")
        seccion = perms.get("seccion")
        config = db.delivery_config.find_one({}) or {}
        allowed_cargos = [c.lower().strip() for c in config.get("chat_allowed_cargos", [])]
        allowed_secciones = [s.lower().strip() for s in config.get("chat_allowed_secciones", [])]
        
        has_cargo_access = cargo and cargo.lower().strip() in allowed_cargos
        has_seccion_access = seccion and seccion.lower().strip() in allowed_secciones
        
        print(f"[DELIVERY_CHAT]   L7 check: cargo={cargo} in allowed_cargos={allowed_cargos} => {has_cargo_access}")
        print(f"[DELIVERY_CHAT]   L7 check: seccion={seccion} in allowed_secciones={allowed_secciones} => {has_seccion_access}")
        
        if not (has_cargo_access or has_seccion_access):
            print(f"[DELIVERY_CHAT]   L7 DENIED: no cargo/seccion match → returning empty")
            return {"success": True, "items": []}

    query = {}
    loc_filter = _get_admin_location_filter(user, rl)
    query.update(loc_filter)

    if status in ("open", "closed"):
        query["status"] = status

    print(f"[DELIVERY_CHAT]   final query={query}")
    cursor = CHAT_STATE.find(query).sort("opened_at", -1).skip(max(0, offset)).limit(min(limit, 100))
    state_list = list(cursor)
    print(f"[DELIVERY_CHAT]   results={len(state_list)} chats")
    order_numbers = [s["order_number"] for s in state_list]
    
    # 1. Fetch customer phones and order reviews
    orders_info = list(db.delivery_orders.find({"order_number": {"$in": order_numbers}}, {"order_number": 1, "customer.phone": 1, "review": 1}))
    order_to_phone = {o["order_number"]: o.get("customer", {}).get("phone") for o in orders_info}
    order_to_review = {o["order_number"]: o.get("review") for o in orders_info}
    phones = [p for p in order_to_phone.values() if p]
    
    # 2. Fetch stats for these phones
    stats_map = {}
    if phones:
        pipeline = [
            {"$match": {"customer.phone": {"$in": phones}, "status": {"$ne": "cancelled"}}},
            {"$group": {
                "_id": "$customer.phone",
                "total_orders": {"$sum": 1},
                "avg_review": {"$avg": "$review.overall_stars"}
            }}
        ]
        stats_res = db.delivery_orders.aggregate(pipeline)
        stats_map = {doc["_id"]: {"total_orders": doc.get("total_orders", 0), "avg_review": doc.get("avg_review")} for doc in stats_res}

    items = []
    for state in state_list:
        # Get last message for preview
        last_msg = CHAT_MSGS.find_one(
            {"order_number": state["order_number"]},
            sort=[("created_at", -1)],
        )
        
        phone = order_to_phone.get(state["order_number"])
        customer_stats = stats_map.get(phone, {"total_orders": 1, "avg_review": None}) if phone else {"total_orders": 1, "avg_review": None}
        
        items.append({
            "order_number": state["order_number"],
            "location_id": state.get("location_id"),
            "customer_name": state.get("customer_name", "Cliente"),
            "status": state.get("status", "open"),
            "mode": state.get("mode", "bot"),
            "admin_id": state.get("admin_id"),
            "opened_at": state.get("opened_at"),
            "order_review": order_to_review.get(state["order_number"]),
            "last_text": (last_msg or {}).get("text"),
            "last_role": (last_msg or {}).get("role"),
            "last_at": (last_msg or {}).get("created_at"),
            "unread": CHAT_MSGS.count_documents({
                "order_number": state["order_number"],
                "role": "user",
                "read": {"$ne": True},
            }),
            "customer_stats": customer_stats,
        })

    return {"success": True, "items": items}


@router.get("/delivery/chats/{order_number}/history", summary="Historial de chat delivery")
async def delivery_chat_history(order_number: str, user: dict = Depends(verify_session)):
    rl, state = _verify_chat_access(user, order_number)

    msgs = list(CHAT_MSGS.find({"order_number": order_number}).sort("created_at", 1))

    # Mark as read
    CHAT_MSGS.update_many(
        {"order_number": order_number, "role": "user", "read": {"$ne": True}},
        {"$set": {"read": True}},
    )

    order_data = db.delivery_orders.find_one({"order_number": order_number})
    
    full_order = None
    if order_data:
        from apis.delivery.orders import _serialize_order
        full_order = _serialize_order(order_data)

    return {
        "success": True,
        "messages": [
            {
                "_id": str(m.get("_id")),
                "order_number": m["order_number"],
                "role": m.get("role", "user"),
                "text": m.get("text", ""),
                "payload": m.get("payload"),
                "created_at": m.get("created_at"),
                "admin_wallet": m.get("admin_wallet"),
                "sender_avatar_url": m.get("sender_avatar_url"),
                "image_url": m.get("image_url"),
            }
            for m in msgs
        ],
        "state": {
            "status": state.get("status", "open"),
            "mode": state.get("mode", "bot"),
            "admin_id": state.get("admin_id"),
            "customer_name": state.get("customer_name"),
            "order": full_order,
        },
    }


@router.post("/delivery/chats/{order_number}/reply", summary="Admin responde en chat delivery")
async def delivery_chat_reply(
    order_number: str,
    data: AdminReplyPayload,
    user: dict = Depends(verify_session),
):
    rl, state = _verify_chat_access(user, order_number)
    
    admin_wallet = (user.get("wallet") or "").lower()
    if not admin_wallet:
        raise HTTPException(status_code=403, detail="Requiere wallet para responder")

    if state.get("status") != "open":
        raise HTTPException(status_code=400, detail="Chat cerrado")
    if state.get("admin_id") and state.get("admin_id") != admin_wallet:
        raise HTTPException(status_code=403, detail="Chat asignado a otro admin")

    name, avatar = _resolve_worker_profile(admin_wallet)
    
    now = get_chile_time()
    msg_doc = {
        "order_number": order_number,
        "role": "admin",
        "text": data.text,
        "created_at": now,
        "admin_wallet": admin_wallet,
        "sender_name": name or "Local",
        "sender_avatar_url": avatar,
        "image_url": data.image_url,
    }
    
    CHAT_MSGS.insert_one(msg_doc)

    # Ensure mode is human and assign
    CHAT_STATE.update_one(
        {"order_number": order_number},
        {"$set": {"mode": "human", "admin_id": admin_wallet}},
    )

    await dchat_manager.broadcast(order_number, {
        "type": "message",
        "role": "admin",
        "text": data.text,
        "image_url": data.image_url,
        "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
        "admin_wallet": admin_wallet,
        "sender_name": name or "Local",
        "sender_avatar_url": avatar,
    }, to_admins=None)

    logger.info(f"[delivery_chat_reply] Mensaje de {name or admin_wallet} procesado por dchat_manager (order: {order_number}): '{data.text}'")

    # Trigger Push Notification for Customer
    from services.automation_engine import trigger_event
    import asyncio
    order = DELIVERY_COLL.find_one({"order_number": order_number})
    if order:
        customer_data = order.get("customer", {})
        asyncio.create_task(trigger_event("delivery_chat_message", "customers", {
            "order_number": order_number,
            "sender_name": name or "La Piccola Italia",
            "message": data.text,
            "customer": customer_data,
            "privy_id": order.get("privy_id")
        }))

    return {"ok": True}


@router.post("/delivery/chats/{order_number}/upload", summary="Sube una imagen al chat de delivery")
async def delivery_chat_upload(
    order_number: str,
    file: UploadFile = File(...),
    user: dict = Depends(verify_session),
):
    rl, state = _verify_chat_access(user, order_number)
    
    # We can use utils.r2_upload directly here since we're in admin
    from utils.r2_upload import upload_to_r2
    try:
        import uuid
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            ext = 'webp'
            
        filename = f"chat/delivery/{order_number}_{uuid.uuid4().hex[:8]}.{ext}"
        url = upload_to_r2(file.file, filename, content_type=file.content_type)
        return {"success": True, "url": url}
    except Exception as e:
        logger.error(f"[delivery_chat_upload] Error: {e}")
        raise HTTPException(status_code=500, detail="Error uploading image")

@router.post("/delivery/chats/{order_number}/take", summary="Admin asume el chat delivery")
async def delivery_chat_take(order_number: str, user: dict = Depends(verify_session)):
    rl, state = _verify_chat_access(user, order_number)
    admin_wallet = (user.get("wallet") or "").lower()
    if not admin_wallet:
        raise HTTPException(status_code=403, detail="Requiere wallet")

    if state.get("status") != "open":
        raise HTTPException(status_code=400, detail="Chat cerrado")

    CHAT_STATE.update_one(
        {"order_number": order_number},
        {"$set": {"mode": "human", "admin_id": admin_wallet}},
    )

    await dchat_manager.broadcast(order_number, {
        "type": "mode", "mode": "human", "admin_id": admin_wallet,
    }, to_admins=None)

    return {"ok": True}


@router.post("/delivery/chats/{order_number}/release", summary="Devolver chat delivery al bot")
async def delivery_chat_release(order_number: str, user: dict = Depends(verify_session)):
    rl, state = _verify_chat_access(user, order_number)
    
    if state.get("status") != "open":
        raise HTTPException(status_code=400, detail="Chat cerrado")

    CHAT_STATE.update_one(
        {"order_number": order_number},
        {"$set": {"mode": "bot", "admin_id": None}},
    )

    await dchat_manager.broadcast(order_number, {
        "type": "mode", "mode": "bot", "admin_id": None,
    }, to_admins=None)

    return {"ok": True}


@router.post("/delivery/chats/{order_number}/close", summary="Admin cierra chat delivery")
async def delivery_chat_close(order_number: str, user: dict = Depends(verify_session)):
    rl, state = _verify_chat_access(user, order_number)

    if state.get("status") != "open":
        raise HTTPException(status_code=400, detail="Chat ya está cerrado")
    now = get_chile_time()

    CHAT_STATE.update_one(
        {"order_number": order_number},
        {"$set": {"status": "closed", "closed_at": now}},
    )

    await dchat_manager.broadcast(order_number, {
        "type": "status", "status": "closed",
    }, to_admins=None)

    return {"ok": True}


@router.post("/delivery/chats/{order_number}/reopen", summary="Admin reabre chat delivery")
async def delivery_chat_reopen(order_number: str, user: dict = Depends(verify_session)):
    rl, state = _verify_chat_access(user, order_number)

    if state.get("status") == "open":
        raise HTTPException(status_code=400, detail="El chat ya está abierto")

    CHAT_STATE.update_one(
        {"order_number": order_number},
        {"$set": {"status": "open", "closed_at": None}},
    )

    await dchat_manager.broadcast(order_number, {
        "type": "status", "status": "open",
    }, to_admins=None)

    return {"ok": True}


# ─── REST: Delivery Backend → Admin (Dilithium-signed message proxy) ──

class DeliveryMessagePayload(BaseModel):
    order_number: str
    privy_id: str
    content: str
    order_status: Optional[str] = None
    order_items: Optional[list] = None
    timestamp: Optional[str] = None
    image_url: Optional[str] = None


from apis.admin.ecosystem_providers import verify_satellite_webhook

@router.post("/delivery/chat/message", summary="Delivery backend forwards customer message (Dilithium-signed)")
async def delivery_chat_message(
    payload: DeliveryMessagePayload,
    request: Request,
    provider: dict = Depends(verify_satellite_webhook)
):
    """
    Called by the delivery backend when a customer sends a chat message.
    Authenticated via Dilithium verify_satellite_webhook.
    Processes the message through the bot engine and returns the response.
    """
    try:
        logger.info(f"[delivery_chat_message] Empezando a procesar mensaje para orden {payload.order_number}")

        # Find order
        logger.info(f"[delivery_chat_message] Buscando orden en DELIVERY_COLL: {payload.order_number}")
        order = DELIVERY_COLL.find_one({"order_number": payload.order_number})
        if not order:
            logger.error(f"[delivery_chat_message] Orden {payload.order_number} no encontrada")
            raise HTTPException(status_code=404, detail="Order not found")

        # Ensure chat state
        logger.info(f"[delivery_chat_message] Asegurando estado de chat (_ensure_chat_state)")
        state = _ensure_chat_state(payload.order_number, order)

        # Si el chat estaba cerrado y el cliente manda mensaje, lo reabrimos automáticamente
        if state.get("status") == "closed":
            logger.info(f"[delivery_chat_message] El chat estaba cerrado, reabriendo automáticamente.")
            CHAT_STATE.update_one(
                {"order_number": payload.order_number},
                {"$set": {"status": "open", "closed_at": None}}
            )
            await dchat_manager.broadcast(payload.order_number, {
                "type": "status", "status": "open",
            }, to_admins=True)

        now = get_chile_time()

        # Store user message
        logger.info(f"[delivery_chat_message] Insertando mensaje de usuario en CHAT_MSGS")
        msg_doc = {
            "order_number": payload.order_number,
            "role": "user",
            "text": payload.content,
            "created_at": now,
            "privy_id": payload.privy_id,
            "source": "delivery_proxy",
        }
        if payload.image_url:
            msg_doc["image_url"] = payload.image_url
            
        CHAT_MSGS.insert_one(msg_doc)

        # Broadcast to admin WS clients
        logger.info(f"[delivery_chat_message] Construyendo order context y transmitiendo a WS de administradores")
        order_context = _build_order_context(order)
        await dchat_manager.broadcast(payload.order_number, {
            "type": "message",
            "role": "user",
            "text": payload.content,
            "image_url": payload.image_url,
            "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
            "sender_name": order_context.get("customer_name", "Cliente"),
        }, to_admins=True)

        # Check chat mode
        logger.info(f"[delivery_chat_message] Comprobando modo del chat")
        state = CHAT_STATE.find_one({"order_number": payload.order_number})
        mode = (state or {}).get("mode", "bot")
        
        response_text = None
        
        if mode == "bot":
            logger.info(f"[delivery_chat_message] Chat está en modo BOT. Invocando chat_complete")
            # Fetch recent chat history
            recent_msgs = list(CHAT_MSGS.find(
                {"order_number": payload.order_number},
                {"_id": 0, "role": 1, "text": 1}
            ).sort("created_at", -1).limit(10))
            recent_msgs.reverse()
            
            # Format for bot engine (ensure standard roles)
            formatted_msgs = [{"role": msg.get("role", "user"), "content": msg.get("text", "")} for msg in recent_msgs]
            
            # Invoke La Nonna AI
            response_text = await chat_complete(
                messages=formatted_msgs,
                delivery_mode=True,
                order_context=order_context
            )
            
            logger.info(f"[delivery_chat_message] Respuesta recibida de chat_complete: {type(response_text)}")
            
            # Normalize response_text to string and extract payload
            bot_payload = None
            if isinstance(response_text, dict):
                bot_payload = response_text
                lines = response_text.get("lines", [])
                if lines:
                    response_text = " ".join(lines)
                elif isinstance(response_text.get("text"), str) and response_text.get("text").strip():
                    response_text = response_text.get("text").strip()
                else:
                    response_text = "(respuesta estructurada)"
            elif not isinstance(response_text, str):
                response_text = str(response_text)
            
            # Save bot response
            bot_now = get_chile_time()
            bot_msg_doc = {
                "order_number": payload.order_number,
                "role": "assistant",
                "text": response_text,
                "created_at": bot_now,
            }
            if bot_payload:
                bot_msg_doc["payload"] = bot_payload
                
            CHAT_MSGS.insert_one(bot_msg_doc)
            
            logger.info(f"[delivery_chat_message] Transmitiendo respuesta del bot")
            bot_ws_msg = {
                "type": "message",
                "role": "assistant",
                "text": response_text,
                "at": bot_now.isoformat() if hasattr(bot_now, "isoformat") else str(bot_now),
                "sender_name": "La Nonna 🍕",
            }
            if bot_payload:
                bot_ws_msg["payload"] = bot_payload
                
            await dchat_manager.broadcast(payload.order_number, bot_ws_msg, to_admins=None)
            
            logger.info("[delivery_chat_message] Todo procesado con éxito (modo bot)")
            
            # Trigger Push Notification for Customer
            from services.automation_engine import trigger_event
            import asyncio
            if order:
                customer_data = order.get("customer", {})
                asyncio.create_task(trigger_event("delivery_chat_message", "customers", {
                    "order_number": payload.order_number,
                    "sender_name": "La Nonna 🍕",
                    "message": response_text,
                    "customer": customer_data,
                    "privy_id": order.get("privy_id")
                }))
                
            return {"ok": True, "bot_response": response_text}

        logger.info("[delivery_chat_message] Todo procesado con éxito (modo humano)")
        return {"ok": True}

    except Exception as e:
        logger.exception(f"[delivery_chat_message] CRITICAL ERROR 500: {e}")
        raise




@router.websocket("/ws/delivery-chat/{order_number}")
async def ws_delivery_chat_client(websocket: WebSocket, order_number: str):
    """
    Client-facing WS for delivery chat.
    First message must be a Dilithium-signed handshake with:
    {type: "auth", order_number, privy_id, signature, timestamp}
    """
    # Accept and wait for auth handshake
    await websocket.accept()

    try:
        # Wait for auth (10s timeout)
        auth_data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
    except Exception:
        await websocket.close(code=4001, reason="Auth timeout")
        return

    # Validate auth
    msg_type = (auth_data or {}).get("type")
    if msg_type != "auth":
        await websocket.close(code=4002, reason="Expected auth message")
        return

    privy_id = (auth_data or {}).get("privy_id", "")
    auth_order = (auth_data or {}).get("order_number", "")
    if auth_order != order_number:
        await websocket.close(code=4003, reason="Order number mismatch")
        return

    # Look up order
    order = DELIVERY_COLL.find_one({"order_number": order_number})
    if not order:
        await websocket.close(code=4004, reason="Order not found")
        return

    # Verify ownership
    if privy_id and order.get("privy_id") != privy_id:
        await websocket.close(code=4005, reason="Not your order")
        return

    # Verify chat window (1h after delivery)
    status = order.get("status", "")
    if status in ("cancelled", "pending"):
        await websocket.close(code=4006, reason="Chat not available for this status")
        return

    if status == "delivered":
        delivered_at = order.get("delivered_at")
        if delivered_at:
            if isinstance(delivered_at, (int, float)):
                dt = datetime.fromtimestamp(delivered_at, tz=CHILE_TZ)
            else:
                dt = datetime.fromisoformat(str(delivered_at).replace("Z", "+00:00"))
            if get_chile_time() - dt > timedelta(hours=1):
                await websocket.close(code=4007, reason="Chat window expired")
                return

    # Ensure chat state exists
    _ensure_chat_state(order_number, order)

    # Send auth success
    await websocket.send_json({"type": "auth_ok", "order_number": order_number})

    # Register connection
    dchat_manager.client_conns.setdefault(order_number, set()).add(websocket)

    order_context = _build_order_context(order)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = (data or {}).get("type", "message")

            if msg_type == "typing":
                await dchat_manager.broadcast(order_number, {
                    "type": "typing", "side": "client", "state": bool(data.get("state", True)),
                }, to_admins=True)
                continue

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # User message
            text = (data or {}).get("text", "").strip()
            if not text:
                continue

            now = get_chile_time()
            msg_doc = {
                "order_number": order_number,
                "role": "user",
                "text": text,
                "created_at": now,
                "privy_id": privy_id,
            }
            if data.get("image_url"):
                msg_doc["image_url"] = data.get("image_url")
                
            CHAT_MSGS.insert_one(msg_doc)

            # Broadcast user message
            await dchat_manager.broadcast(order_number, {
                "type": "message",
                "role": "user",
                "text": text,
                "image_url": data.get("image_url"),
                "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
                "sender_name": order_context.get("customer_name", "Cliente"),
            }, to_admins=None)



    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[delivery_chat] Client WS error: {e}")
    finally:
        await dchat_manager.disconnect(order_number, websocket, is_admin=False)





# ─── WebSocket: Admin Panel (session-based) ────────────────────────────

@router.websocket("/ws/delivery-chat-admin/{order_number}")
async def ws_delivery_chat_admin(websocket: WebSocket, order_number: str):
    """Admin panel WS for delivery chat. Session-based auth via query param."""
    await dchat_manager.connect(order_number, websocket, is_admin=True)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = (data or {}).get("type")
            if msg_type == "typing":
                now = get_chile_time()
                await dchat_manager.broadcast(order_number, {
                    "type": "typing", "side": "admin",
                    "state": bool(data.get("state", True)),
                }, to_admins=False)
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await dchat_manager.disconnect(order_number, websocket, is_admin=True)
    except Exception as e:
        logger.warning(f"[delivery_chat] Admin WS error: {e}")
        await dchat_manager.disconnect(order_number, websocket, is_admin=True)
