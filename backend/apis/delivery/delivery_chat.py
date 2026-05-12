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
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.time_utils import get_chile_time
from utils.bot.engine import chat_complete

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

    async def connect(self, order_number: str, ws: WebSocket, is_admin: bool = False):
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
        targets: set[WebSocket] = set()
        if to_admins is None or to_admins is False:
            targets |= self.client_conns.get(order_number, set())
        if to_admins is None or to_admins is True:
            targets |= self.admin_conns.get(order_number, set())
        stale = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    for bucket in (self.client_conns, self.admin_conns):
                        for on, conns in list(bucket.items()):
                            conns.discard(ws)
                            if not conns:
                                del bucket[on]


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

    return {
        "order_number": order.get("order_number", ""),
        "customer_name": order.get("customer_name") or order.get("contact_name", "Cliente"),
        "items_summary": items_summary,
        "items": items,
        "status": order.get("status", "unknown"),
        "status_label": STATUS_LABELS.get(order.get("status", ""), order.get("status", "")),
        "address": address_str,
        "courier_info": order.get("courier_info"),
    }


def _get_admin_location_filter(user: dict, level: int) -> dict:
    """Build MongoDB query filter for level 6 admins (only their locations)."""
    if level == 6:
        perms = (user or {}).get("permissions") or {}
        allowed_sucs = perms.get("sucursal_ids", [])
        if allowed_sucs:
            return {"location_id": {"$in": [str(s) for s in allowed_sucs]}}
    return {}


def _ensure_chat_state(order_number: str, order: dict) -> dict:
    """Get or create delivery_chat_state for an order."""
    state = CHAT_STATE.find_one({"order_number": order_number})
    if state:
        return state

    now = get_chile_time()
    state_doc = {
        "order_number": order_number,
        "location_id": str(order.get("location_id", "")),
        "customer_name": order.get("customer_name") or order.get("contact_name", "Cliente"),
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

class AdminToggle(BaseModel):
    wallet: Optional[str] = None


@router.get("/delivery/chats", summary="Listar chats delivery (admin)")
async def list_delivery_chats(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(verify_session),
):
    rl = require_admin_level(user, "delivery")
    query = {}

    # Level 6 location filter
    loc_filter = _get_admin_location_filter(user, rl)
    query.update(loc_filter)

    if status in ("open", "closed"):
        query["status"] = status

    cursor = CHAT_STATE.find(query).sort("opened_at", -1).skip(max(0, offset)).limit(min(limit, 100))
    items = []
    for state in cursor:
        # Get last message for preview
        last_msg = CHAT_MSGS.find_one(
            {"order_number": state["order_number"]},
            sort=[("created_at", -1)],
        )
        items.append({
            "order_number": state["order_number"],
            "location_id": state.get("location_id"),
            "customer_name": state.get("customer_name", "Cliente"),
            "status": state.get("status", "open"),
            "mode": state.get("mode", "bot"),
            "admin_id": state.get("admin_id"),
            "opened_at": state.get("opened_at"),
            "last_text": (last_msg or {}).get("text"),
            "last_role": (last_msg or {}).get("role"),
            "last_at": (last_msg or {}).get("created_at"),
            "unread": CHAT_MSGS.count_documents({
                "order_number": state["order_number"],
                "role": "user",
                "read": {"$ne": True},
            }),
        })

    return {"success": True, "items": items}


@router.get("/delivery/chats/{order_number}/history", summary="Historial de chat delivery")
async def delivery_chat_history(order_number: str, user: dict = Depends(verify_session)):
    rl = require_admin_level(user, "delivery")

    # Verify location access for level 6
    state = CHAT_STATE.find_one({"order_number": order_number})
    if not state:
        raise HTTPException(status_code=404, detail="Chat no encontrado")

    if rl == 6:
        loc_filter = _get_admin_location_filter(user, rl)
        if loc_filter and state.get("location_id") not in [
            str(s) for s in ((user or {}).get("permissions") or {}).get("sucursal_ids", [])
        ]:
            raise HTTPException(status_code=403, detail="No tienes acceso a este chat")

    msgs = list(CHAT_MSGS.find({"order_number": order_number}).sort("created_at", 1))

    # Mark as read
    CHAT_MSGS.update_many(
        {"order_number": order_number, "role": "user", "read": {"$ne": True}},
        {"$set": {"read": True}},
    )

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
            }
            for m in msgs
        ],
        "state": {
            "status": state.get("status", "open"),
            "mode": state.get("mode", "bot"),
            "admin_id": state.get("admin_id"),
            "customer_name": state.get("customer_name"),
        },
    }


@router.post("/delivery/chats/{order_number}/reply", summary="Admin responde en chat delivery")
async def delivery_chat_reply(
    order_number: str,
    data: AdminReplyPayload,
    user: dict = Depends(verify_session),
):
    rl = require_admin_level(user, "delivery")
    admin_wallet = (user.get("wallet") or "").lower()
    if not admin_wallet:
        raise HTTPException(status_code=403, detail="Requiere wallet para responder")

    state = CHAT_STATE.find_one({"order_number": order_number})
    if not state:
        raise HTTPException(status_code=404, detail="Chat no encontrado")
    if state.get("status") != "open":
        raise HTTPException(status_code=400, detail="Chat cerrado")
    if state.get("admin_id") and state.get("admin_id") != admin_wallet:
        raise HTTPException(status_code=403, detail="Chat asignado a otro admin")

    now = get_chile_time()
    msg_doc = {
        "order_number": order_number,
        "role": "admin",
        "text": data.text,
        "created_at": now,
        "admin_wallet": admin_wallet,
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
        "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
        "sender_name": "La Nonna",
    }, to_admins=None)

    return {"ok": True}


@router.post("/delivery/chats/{order_number}/take", summary="Admin toma chat delivery")
async def delivery_chat_take(order_number: str, user: dict = Depends(verify_session)):
    rl = require_admin_level(user, "delivery")
    admin_wallet = (user.get("wallet") or "").lower()
    if not admin_wallet:
        raise HTTPException(status_code=403, detail="Requiere wallet")

    state = CHAT_STATE.find_one({"order_number": order_number})
    if not state:
        raise HTTPException(status_code=404, detail="Chat no encontrado")
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


@router.post("/delivery/chats/{order_number}/release", summary="Admin libera chat delivery al bot")
async def delivery_chat_release(order_number: str, user: dict = Depends(verify_session)):
    rl = require_admin_level(user, "delivery")

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
    rl = require_admin_level(user, "delivery")
    now = get_chile_time()

    CHAT_STATE.update_one(
        {"order_number": order_number},
        {"$set": {"status": "closed", "closed_at": now}},
    )

    await dchat_manager.broadcast(order_number, {
        "type": "status", "status": "closed",
    }, to_admins=None)


# ─── REST: Delivery Backend → Admin (Dilithium-signed message proxy) ──

class DeliveryMessagePayload(BaseModel):
    order_number: str
    privy_id: str
    content: str
    order_status: Optional[str] = None
    order_items: Optional[list] = None
    timestamp: Optional[str] = None


@router.post("/delivery/chat/message", summary="Delivery backend forwards customer message (Dilithium-signed)")
async def delivery_chat_message(
    payload: DeliveryMessagePayload,
    request: Request,
):
    """
    Called by the delivery backend when a customer sends a chat message.
    Authenticated via Dilithium signature + API key (same as order creation).
    Processes the message through the bot engine and returns the response.
    """
    from utils.vanellix_crypto import verify_dilithium_request

    from apis.apikeys import validate_api_key

    # Verify API key (same format as delivery/orders: keyId.secret)
    api_key = request.headers.get("X-Api-Key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")

    key_doc = validate_api_key(api_key)
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Verify Dilithium signature
    await verify_dilithium_request(request, key_doc, context="delivery/chat")

    # Find order
    order = DELIVERY_COLL.find_one({"order_number": payload.order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Ensure chat state
    _ensure_chat_state(payload.order_number, order)

    now = get_chile_time()

    # Store user message
    CHAT_MSGS.insert_one({
        "order_number": payload.order_number,
        "role": "user",
        "text": payload.content,
        "created_at": now,
        "privy_id": payload.privy_id,
        "source": "delivery_proxy",
    })

    # Broadcast to admin WS clients
    order_context = _build_order_context(order)
    await dchat_manager.broadcast(payload.order_number, {
        "type": "message",
        "role": "user",
        "text": payload.content,
        "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
        "sender_name": order_context.get("customer_name", "Cliente"),
    }, to_admins=True)

    # Check chat mode
    state = CHAT_STATE.find_one({"order_number": payload.order_number})
    mode = (state or {}).get("mode", "bot")

    response_text = None

    if mode == "bot":
        # Get recent messages for context
        last_msgs = list(CHAT_MSGS.find(
            {"order_number": payload.order_number}
        ).sort("created_at", 1))[-12:]

        messages = [
            {"role": "user" if m["role"] == "user" else "assistant", "content": m.get("text", "")}
            for m in last_msgs
        ]

        try:
            reply = await asyncio.wait_for(
                chat_complete(messages, delivery_mode=True, order_context=order_context),
                timeout=30,
            )

            if isinstance(reply, dict):
                response_text = reply.get("text") or " ".join(reply.get("lines", []))
            elif isinstance(reply, str):
                response_text = reply

            if not response_text or not response_text.strip():
                response_text = f"Tu pedido #{payload.order_number[-6:]} está en estado: {order.get('status', 'procesando')}. ¿En qué más te puedo ayudar?"

        except asyncio.TimeoutError:
            response_text = "Estoy tardando más de lo normal. Intenta de nuevo en un momento."
        except Exception as e:
            logger.error(f"[delivery_chat] Bot reply error: {e}")
            response_text = f"Tu pedido #{payload.order_number[-6:]} está en estado: {order.get('status', 'procesando')}. Un miembro del equipo te responderá pronto."

        # Store bot reply
        CHAT_MSGS.insert_one({
            "order_number": payload.order_number,
            "role": "assistant",
            "text": response_text,
            "created_at": get_chile_time(),
        })

        # Broadcast bot reply to admin
        await dchat_manager.broadcast(payload.order_number, {
            "type": "message",
            "role": "assistant",
            "text": response_text,
            "at": get_chile_time().isoformat(),
            "sender_name": "La Nonna",
        }, to_admins=True)

    else:
        # Human mode — admin will reply manually
        response_text = None

    logger.info(f"[delivery_chat] Message from {payload.privy_id[:20]}… for order {payload.order_number} mode={mode}")

    return {
        "success": True,
        "response": response_text,
        "mode": mode,
    }




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
                dt = datetime.fromtimestamp(delivered_at, tz=timezone.utc)
            else:
                dt = datetime.fromisoformat(str(delivered_at).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - dt > timedelta(hours=1):
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
            CHAT_MSGS.insert_one(msg_doc)

            # Broadcast user message
            await dchat_manager.broadcast(order_number, {
                "type": "message",
                "role": "user",
                "text": text,
                "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
                "sender_name": order_context.get("customer_name", "Cliente"),
            }, to_admins=None)

            # Bot reply if in bot mode
            state = CHAT_STATE.find_one({"order_number": order_number})
            if state and state.get("mode") == "bot":
                asyncio.create_task(_delivery_bot_reply(order_number, order_context))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[delivery_chat] Client WS error: {e}")
    finally:
        await dchat_manager.disconnect(order_number, websocket, is_admin=False)


async def _delivery_bot_reply(order_number: str, order_context: dict):
    """Generate bot reply using delivery_chat_complete (fire-and-forget)."""
    try:
        # Get last N messages for context
        last_msgs = await asyncio.to_thread(
            lambda: list(CHAT_MSGS.find({"order_number": order_number}).sort("created_at", 1))[-12:]
        )
        messages = [
            {"role": "user" if m["role"] == "user" else "assistant", "content": m.get("text", "")}
            for m in last_msgs
        ]

        # Refresh order data for latest status
        fresh_order = await asyncio.to_thread(
            lambda: DELIVERY_COLL.find_one({"order_number": order_number})
        )
        if fresh_order:
            order_context = _build_order_context(fresh_order)

        # Call the engine with delivery_mode flag (walled garden)
        reply = await asyncio.wait_for(
            chat_complete(messages, delivery_mode=True, order_context=order_context),
            timeout=30,
        )

        # Extract text from reply
        reply_text = ""
        payload = None
        if isinstance(reply, dict):
            payload = reply
            reply_text = reply.get("text") or " ".join(reply.get("lines", []))
        elif isinstance(reply, str):
            reply_text = reply

        if not reply_text.strip():
            reply_text = "Disculpa, no pude procesar tu consulta."

        now = get_chile_time()
        await asyncio.to_thread(lambda: CHAT_MSGS.insert_one({
            "order_number": order_number,
            "role": "assistant",
            "text": reply_text,
            "payload": payload,
            "created_at": now,
        }))

        await dchat_manager.broadcast(order_number, {
            "type": "message",
            "role": "assistant",
            "text": reply_text,
            "payload": payload,
            "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
            "sender_name": "La Nonna",
        }, to_admins=None)

    except asyncio.TimeoutError:
        now = get_chile_time()
        timeout_text = "Estoy tardando más de lo normal. Intenta de nuevo en un momento."
        await asyncio.to_thread(lambda: CHAT_MSGS.insert_one({
            "order_number": order_number, "role": "assistant",
            "text": timeout_text, "created_at": now,
        }))
        await dchat_manager.broadcast(order_number, {
            "type": "message", "role": "assistant", "text": timeout_text,
            "at": now.isoformat() if hasattr(now, "isoformat") else str(now),
            "sender_name": "La Nonna",
        }, to_admins=None)
    except Exception as e:
        logger.error(f"[delivery_chat] Bot reply error for {order_number}: {e}")


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
