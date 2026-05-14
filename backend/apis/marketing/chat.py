import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Optional, List

from utils.time_utils import get_chile_time

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel

from utils.auth.session import verify_session
from utils.web3mongo import db
from utils.chat.realtime import manager
from utils.chat.schemas import (
    ChatSessionStartRequest,
    ChatSessionStartResponse,
    ChatMessageRequest,
    AdminReplyRequest,
    AdminToggleRequest,
    ChatMessageOut,
    AdminConversationListItem,
    AdminParticipantOut,
)
from utils.bot.engine import chat_complete

# Reuse role level logic
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

# Constants
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# Ensure indexes on import
try:
    db.chat_conversations.create_index("conv_id", unique=True)
    db.chat_conversations.create_index([("status", 1), ("updated_at", -1)])
    db.chat_conversations.create_index("assigned_admin")
    db.chat_conversations.create_index("wallet")
    db.chat_conversations.create_index("privy_id")

    db.chat_messages.create_index([("conv_id", 1), ("created_at", 1)])
    db.chat_messages.create_index("conv_id")

    # Optional TTL for typing indicators
    if "ttl" not in [ix.get("name") for ix in db.chat_typing.list_indexes()]:
        db.chat_typing.create_index("updated_at", expireAfterSeconds=60, name="ttl")
except Exception as e:
    logger.warning(f"Index creation warning: {e}")


# Helpers
async def _get_or_init_counter(name: str) -> int:
    doc = db.chat_counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    return int(doc.get("value", 1))


def _identity_from_session(user: dict) -> dict:
    # Always include privy_id (sub). Wallet is optional and lowercased when present.
    wallet = user.get("wallet")
    sub = user.get("sub")
    return {"wallet": wallet.lower() if wallet else None, "privy_id": sub}

def _assert_owner(conv: dict, user: dict):
    ident = _identity_from_session(user)
    if conv.get("wallet"):
        if not ident.get("wallet") or ident["wallet"] != conv.get("wallet"):
            raise HTTPException(status_code=403, detail="Forbidden: not your conversation")
    else:
        if not ident.get("privy_id") or ident["privy_id"] != conv.get("privy_id"):
            raise HTTPException(status_code=403, detail="Forbidden: not your conversation")


def _admin_guard(user: dict):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=403, detail="Admin endpoints require wallet session")
    level = require_admin_level(user, "admin")
    return wallet.lower(), level


# ─── Single source of truth: trabajadores_vpn profile ────────────
_profile_cache: dict = {}  # wallet → {name, profile_image_url, seccion, cargo} — lives per-process, refreshes on restart

def _resolve_worker_profile(wallet: str) -> tuple:
    """Look up employee name + avatar from empleados_usuarios → trabajadores_vpn.
    Returns (name: str, avatar_url: str|None).
    This is THE ONLY place that resolves employee identity.
    """
    if not wallet:
        logger.warning("[AVATAR] wallet is None/empty — skipping")
        return None, None
    wallet = wallet.lower()
    if wallet in _profile_cache:
        cached = _profile_cache[wallet]
        logger.info(f"[AVATAR] CACHE HIT wallet={wallet} → name={cached['name']} avatar={cached['profile_image_url']}")
        return cached["name"], cached["profile_image_url"]
    # empleados_usuarios maps wallet → rut
    eu = db.empleados_usuarios.find_one({"wallet": wallet}, {"rut": 1})
    if not eu or not eu.get("rut"):
        logger.warning(f"[AVATAR] wallet={wallet} → NOT FOUND in empleados_usuarios")
        _profile_cache[wallet] = {"name": wallet, "profile_image_url": None}
        return wallet, None
    # trabajadores_vpn.rut is stored as int, empleados_usuarios.rut as string
    # Try both types to handle the mismatch
    rut_raw = eu["rut"]
    logger.info(f"[AVATAR] wallet={wallet} → rut={rut_raw} (type={type(rut_raw).__name__})")
    tv = db.trabajadores_vpn.find_one(
        {"rut": rut_raw, "activo": 1},
        {"nombres": 1, "apellidopaterno": 1, "profile_image_url": 1}
    )
    if not tv:
        # Type mismatch: try int if string, or string if int
        try:
            rut_alt = int(rut_raw) if isinstance(rut_raw, str) else str(rut_raw)
        except (ValueError, TypeError):
            rut_alt = None
        logger.info(f"[AVATAR] String match failed, trying rut_alt={rut_alt} (type={type(rut_alt).__name__ if rut_alt else 'None'})")
        if rut_alt is not None:
            tv = db.trabajadores_vpn.find_one(
                {"rut": rut_alt, "activo": 1},
                {"nombres": 1, "apellidopaterno": 1, "profile_image_url": 1}
            )
    if not tv:
        logger.warning(f"[AVATAR] wallet={wallet} rut={rut_raw} → NOT FOUND in trabajadores_vpn")
        _profile_cache[wallet] = {"name": wallet, "profile_image_url": None}
        return wallet, None
    name = " ".join(p.strip() for p in [tv.get("nombres", ""), tv.get("apellidopaterno", "")] if p.strip()) or wallet
    avatar = tv.get("profile_image_url")
    logger.info(f"[AVATAR] ✅ wallet={wallet} → name={name} avatar={avatar}")
    _profile_cache[wallet] = {"name": name, "profile_image_url": avatar}
    return name, avatar


# Client APIs
@router.get("/chat/conversations")
async def chat_conversations(user: dict = Depends(verify_session)):
    """
    List conversations for current user (by wallet if present, else privy_id),
    sorted by updated_at desc.
    """
    ident = _identity_from_session(user)
    q = {"$or": []}
    if ident.get("wallet"):
        q["$or"].append({"wallet": ident["wallet"]})
    if ident.get("privy_id"):
        q["$or"].append({"privy_id": ident["privy_id"]})
    if not q["$or"]:
        # Should not happen due to verify_session, but guard
        return []
    cur = db.chat_conversations.find(q).sort("updated_at", -1)
    out = []
    for c in cur:
        out.append({
            "conv_id": c["conv_id"],
            "status": c.get("status", "open"),
            "mode": c.get("mode", "bot"),
            "assigned_admin": c.get("assigned_admin"),
            "wallet": c.get("wallet"),
            "privy_id": c.get("privy_id"),
            "updated_at": c.get("updated_at"),
            "created_at": c.get("created_at"),
        })
    return out


@router.get("/chat/last")
async def chat_last(user: dict = Depends(verify_session)):
    """
    Return the latest conversation for the user.
    Prefer an open conversation; if none open, return the most recently updated one.
    """
    ident = _identity_from_session(user)
    ors = []
    if ident.get("wallet"):
        ors.append({"wallet": ident["wallet"]})
    if ident.get("privy_id"):
        ors.append({"privy_id": ident["privy_id"]})
    if not ors:
        return None
    # Try open first
    conv = db.chat_conversations.find_one({"$and": [{"$or": ors}, {"status": "open"}]}, sort=[("updated_at", -1)])
    if not conv:
        conv = db.chat_conversations.find_one({"$or": ors}, sort=[("updated_at", -1)])
    if not conv:
        return None
    return {
        "conv_id": conv["conv_id"],
        "status": conv.get("status", "open"),
        "mode": conv.get("mode", "bot"),
        "assigned_admin": conv.get("assigned_admin"),
        "wallet": conv.get("wallet"),
        "privy_id": conv.get("privy_id"),
        "updated_at": conv.get("updated_at"),
        "created_at": conv.get("created_at"),
    }
@router.post("/chat/session/start", response_model=ChatSessionStartResponse)
async def chat_session_start(data: ChatSessionStartRequest, user: dict = Depends(verify_session)):
    ident = _identity_from_session(user)
    # Support explicit new conversation creation via metadata.force_new
    force_new = False
    try:
        force_new = bool((data.metadata or {}).get("force_new"))
    except Exception:
        force_new = False

    existing = None
    if not force_new:
        # Do NOT blindly create if the user already has an open conversation.
        ors = []
        if ident.get("wallet"):
            ors.append({"wallet": ident["wallet"]})
        if ident.get("privy_id"):
            ors.append({"privy_id": ident["privy_id"]})
        if ors:
            existing = db.chat_conversations.find_one({"$and": [{"$or": ors}, {"status": "open"}]}, sort=[("updated_at", -1)])
    if existing:
        return ChatSessionStartResponse(conv_id=existing["conv_id"], mode=existing.get("mode", "bot"), status=existing.get("status", "open"))

    conv_id = await _get_or_init_counter("chat_conv_id")
    now = get_chile_time()
    conv_doc = {
        "conv_id": conv_id,
        "status": "open",
        "mode": "bot",
        "assigned_admin": None,
        "wallet": ident["wallet"],
        "privy_id": ident["privy_id"],
        "created_at": now,
        "updated_at": now,
    }
    db.chat_conversations.insert_one(conv_doc)

    await manager.broadcast(conv_id, {"type": "conversation_created", "conv_id": conv_id}, to_admins=True)
    return ChatSessionStartResponse(conv_id=conv_id, mode="bot", status="open")


@router.post("/chat/message")
async def chat_message(data: ChatMessageRequest, user: dict = Depends(verify_session)):
    conv = db.chat_conversations.find_one({"conv_id": data.conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, user)

    if conv.get("status") != "open":
        raise HTTPException(status_code=400, detail="Conversation is closed")

    now = get_chile_time()
    msg_doc = {
        "conv_id": data.conv_id,
        "role": "user",
        "text": data.text,
        "created_at": now,
        "sender_wallet": conv.get("wallet"),
        "sender_privy_id": conv.get("privy_id"),
    }
    db.chat_messages.insert_one(msg_doc)
    db.chat_conversations.update_one({"conv_id": data.conv_id}, {"$set": {"updated_at": now}})

    user_wallet = conv.get("wallet")
    sender_name, sender_avatar_url = _resolve_worker_profile(user_wallet)
    sender_name = sender_name or user_wallet or "User"
    await manager.broadcast(
        data.conv_id,
        {
            "type": "message",
            "role": "user",
            "text": data.text,
            "at": now.isoformat(),
            "sender_wallet": user_wallet,
            "sender_privy_id": conv.get("privy_id"),
            "sender_profile": None,
            "sender_name": sender_name,
            "sender_avatar_url": sender_avatar_url,
        },
        to_admins=None,
    )

    # If bot mode and no admin assigned, generate bot reply async
    if conv.get("mode") == "bot" and not conv.get("assigned_admin"):
        asyncio.create_task(_bot_reply(data.conv_id))

    return {"ok": True}


async def _bot_reply(conv_id: int):
    try:
        # Build last N messages context (DB calls in thread to avoid blocking loop)
        last_msgs = await asyncio.to_thread(
            lambda: list(db.chat_messages.find({"conv_id": conv_id}).sort("created_at", 1))[-12:]
        )
        messages = [
            {"role": "user" if m["role"] == "user" else "assistant", "content": m["text"]}
            for m in last_msgs
        ]
        # Add user context as system primer for the bot (Grok/LLM)
        conv = await asyncio.to_thread(lambda: db.chat_conversations.find_one({"conv_id": conv_id}) or {})
        safe_ctx = {k: conv.get(k) for k in [
            "conv_id","wallet","privy_id","status","mode","assigned_admin","updated_at","created_at"
        ]}
        system_ctx = {
            "role": "system",
            "content": (
                "User context (JSON): " + json.dumps(safe_ctx, ensure_ascii=False, default=str)
            ),
        }
        messages = [system_ctx] + messages
        # Single entry point: engine.chat_complete decides DB vs LLM
        # Protect the chat completion with a timeout so it never blocks indefinitely
        try:
            reply = await asyncio.wait_for(chat_complete(messages), timeout=45)
        except asyncio.TimeoutError:
            reply = {"type": "text_block_list", "intent": "chat", "lines": [
                "Estoy tardando más de lo normal en responder. Intentemos de nuevo en un momento."
            ]}
        payload = None
        summary_text = None
        if isinstance(reply, dict):
            payload = reply
            # Prefer explicit text provided by handlers (menus/locations/club)
            if isinstance(reply.get("text"), str) and reply.get("text").strip():
                summary_text = reply.get("text").strip()
            else:
                summary_text = "(respuesta estructurada)"
        else:
            summary_text = str(reply)
        now = get_chile_time()
        await asyncio.to_thread(lambda: db.chat_messages.insert_one({
            "conv_id": conv_id,
            "role": "assistant",
            "text": summary_text,
            "payload": payload,
            "created_at": now,
        }))
        await asyncio.to_thread(lambda: db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"updated_at": now}}))
        out_evt = {
            "type": "message",
            "role": "assistant",
            "text": summary_text,
            "at": now.isoformat(),
            "sender_wallet": None,
            "sender_privy_id": None,
            "sender_profile": None,
            "sender_name": "Bot",
            "sender_avatar_url": None,
        }
        if payload is not None:
            out_evt["payload"] = payload
        await manager.broadcast(conv_id, out_evt, to_admins=None)
    except Exception as e:
        logger.error(f"Bot reply error for conv {conv_id}: {e}")


@router.get("/chat/history", response_model=List[ChatMessageOut])
async def chat_history(conv_id: int, user: dict = Depends(verify_session)):
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, user)

    msgs = list(db.chat_messages.find({"conv_id": conv_id}).sort("created_at", 1))
    # Map ObjectId to str for _id
    out = []
    # Get conversation for identity mapping
    wallet = conv.get("wallet")
    privy_id = conv.get("privy_id")
    for m in msgs:
        sender_wallet = m.get("sender_wallet")
        sender_privy_id = m.get("sender_privy_id")
        # Infer sender for older records
        if m.get("role") == "user" and (not sender_wallet and not sender_privy_id):
            sender_wallet = wallet
            sender_privy_id = privy_id
        # Determine display fields without profiles
        if m.get("role") == "user":
            sender_name = sender_wallet or "User"
            sender_avatar_url = None
            sender_prof = None
        elif m.get("role") == "admin":
            sender_name = m.get("admin_wallet") or "Admin"
            sender_avatar_url = None
            sender_prof = None
        else:
            sender_name = "Bot"
            sender_avatar_url = None
            sender_prof = None
        out.append({
            "_id": str(m.get("_id")),
            "conv_id": m["conv_id"],
            "role": m["role"],
            "text": m["text"],
            "payload": m.get("payload"),
            "created_at": m["created_at"],
            "sender_wallet": sender_wallet,
            "sender_privy_id": sender_privy_id,
            "sender_profile": sender_prof,
            "sender_name": sender_name,
            "sender_avatar_url": sender_avatar_url,
            "image_url": m.get("image_url"),
            "media_urls": m.get("media_urls"),
        })
    return out


# Admin APIs
class AdminListQuery(BaseModel):
    status: Optional[str] = None  # open / closed
    limit: int = 50


@router.get("/admin/chats", response_model=List[AdminConversationListItem])
async def admin_list_chats(request: Request, status: Optional[str] = None, limit: int = 50, offset: int = 0, user: dict = Depends(verify_session)):
    admin_wallet, _ = _admin_guard(user)

    q = {}
    if status in ("open", "closed"):
        q["status"] = status
    cur = db.chat_conversations.find(q).sort("updated_at", -1).skip(max(0, int(offset))).limit(int(limit))
    return [{
        "conv_id": c["conv_id"],
        "last_text": db.chat_messages.find_one({"conv_id": c["conv_id"]}, sort=[("created_at", -1)])["text"] if db.chat_messages.find_one({"conv_id": c["conv_id"]}, sort=[("created_at", -1)]) else None,
        "status": c.get("status", "open"),
        "mode": c.get("mode", "bot"),
        "assigned_admin": c.get("assigned_admin"),
        "wallet": c.get("wallet"),
        "privy_id": c.get("privy_id"),
        "updated_at": c.get("updated_at", get_chile_time()),
    } for c in cur]


@router.post("/admin/chats/{conv_id}/take")
async def admin_take(conv_id: int, _: AdminToggleRequest, user: dict = Depends(verify_session)):
    admin_wallet, _ = _admin_guard(user)
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("status") != "open":
        raise HTTPException(status_code=400, detail="Conversation is closed")

    now = get_chile_time()
    db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"assigned_admin": admin_wallet, "mode": "human", "updated_at": now}})
    await manager.broadcast(conv_id, {"type": "mode", "mode": "human", "assigned_admin": admin_wallet}, to_admins=None)
    return {"ok": True}


@router.post("/admin/chats/{conv_id}/release")
async def admin_release(conv_id: int, _: AdminToggleRequest, user: dict = Depends(verify_session)):
    admin_wallet, _ = _admin_guard(user)
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = get_chile_time()
    db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"assigned_admin": None, "mode": "bot", "updated_at": now}})
    await manager.broadcast(conv_id, {"type": "mode", "mode": "bot", "assigned_admin": None}, to_admins=None)
    return {"ok": True}


@router.post("/admin/chats/{conv_id}/close")
async def admin_close(conv_id: int, user: dict = Depends(verify_session)):
    admin_wallet, _ = _admin_guard(user)
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = get_chile_time()
    db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"status": "closed", "updated_at": now}})
    await manager.broadcast(conv_id, {"type": "status", "status": "closed"}, to_admins=None)
    return {"ok": True}


@router.post("/admin/chats/{conv_id}/reply")
async def admin_reply(conv_id: int, data: AdminReplyRequest, user: dict = Depends(verify_session)):
    admin_wallet, _ = _admin_guard(user)
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("assigned_admin") and conv.get("assigned_admin") != admin_wallet:
        raise HTTPException(status_code=403, detail="Conversation assigned to another admin")
    if conv.get("status") != "open":
        raise HTTPException(status_code=400, detail="Conversation is closed")

    now = get_chile_time()
    db.chat_messages.insert_one({
        "conv_id": conv_id,
        "role": "admin",
        "text": data.text,
        "image_url": data.image_url,
        "media_urls": data.media_urls,
        "created_at": now,
        "admin_wallet": admin_wallet,
    })
    db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"updated_at": now, "assigned_admin": admin_wallet, "mode": "human"}})
    admin_name, admin_avatar_url = _resolve_worker_profile(admin_wallet)
    admin_name = admin_name or admin_wallet or "Admin"
    await manager.broadcast(
        conv_id,
        {
            "type": "message",
            "role": "admin",
            "text": data.text,
            "image_url": data.image_url,
            "media_urls": data.media_urls,
            "created_at": now.isoformat(),
            "sender_wallet": admin_wallet,
            "sender_privy_id": None,
            "sender_profile": None,
            "sender_name": admin_name,
            "sender_avatar_url": admin_avatar_url,
        },
        to_admins=None,
    )
    return {"ok": True}




@router.get("/admin/chats/{conv_id}/history", response_model=List[ChatMessageOut])
async def admin_chat_history(conv_id: int, user: dict = Depends(verify_session)):
    """Admin can read conversation history regardless of ownership."""
    admin_wallet, _ = _admin_guard(user)
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = list(db.chat_messages.find({"conv_id": conv_id}).sort("created_at", 1))
    out = []
    wallet = conv.get("wallet")
    privy_id = conv.get("privy_id")
    for m in msgs:
        sender_wallet = m.get("sender_wallet")
        sender_privy_id = m.get("sender_privy_id")
        if m.get("role") == "user" and (not sender_wallet and not sender_privy_id):
            sender_wallet = wallet
            sender_privy_id = privy_id
        if m.get("role") == "admin":
            sender_wallet = m.get("admin_wallet")
        # ONE source: trabajadores_vpn
        sender_name, sender_avatar_url = _resolve_worker_profile(sender_wallet)
        if m.get("role") == "assistant":
            sender_name = "Bot"
            sender_avatar_url = None
        elif not sender_name:
            sender_name = sender_wallet or "Usuario"

        logger.info(f"[CHAT HISTORY] msg_role={m.get('role')} wallet={sender_wallet} resolved_avatar={sender_avatar_url}")

        out.append({
            "_id": str(m.get("_id")),
            "conv_id": m["conv_id"],
            "role": m["role"],
            "text": m["text"],
            "payload": m.get("payload"),
            "created_at": m["created_at"],
            "sender_wallet": sender_wallet,
            "sender_privy_id": sender_privy_id,
            "sender_profile": None,
            "sender_name": sender_name,
            "sender_avatar_url": sender_avatar_url,
        })
    return out


@router.get("/admin/chats/{conv_id}/participants", response_model=List[AdminParticipantOut])
async def admin_chat_participants(conv_id: int, user: dict = Depends(verify_session)):
    """Admin-only: return all participants' profiles for a conversation.
    Includes the end user, all admins who wrote, and the assistant (bot).
    """
    admin_wallet, _ = _admin_guard(user)
    conv = db.chat_conversations.find_one({"conv_id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    wallet = conv.get("wallet")
    privy_id = conv.get("privy_id")
    participants: List[AdminParticipantOut] = []
    # End user — resolve from trabajadores_vpn
    user_name, user_avatar = _resolve_worker_profile(wallet)
    participants.append(AdminParticipantOut(
        role="user",
        wallet=wallet,
        privy_id=privy_id,
        profile=None,
        display_name=user_name or wallet or "User",
        avatar_url=user_avatar,
    ))
    # Admins who wrote — resolve each from trabajadores_vpn
    admin_wallets = db.chat_messages.distinct("admin_wallet", {"conv_id": conv_id, "role": "admin"})
    for aw in [w for w in admin_wallets if w]:
        a_name, a_avatar = _resolve_worker_profile(aw)
        participants.append(AdminParticipantOut(
            role="admin",
            wallet=aw,
            profile=None,
            display_name=a_name or aw,
            avatar_url=a_avatar,
        ))
    # Assistant
    participants.append(AdminParticipantOut(
        role="assistant",
        display_name="Bot",
        avatar_url=None,
    ))
    return participants


@router.websocket("/ws/chat/{conv_id}")
async def ws_chat(websocket: WebSocket, conv_id: int):
    await manager.connect(conv_id, websocket, is_admin=False)
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "typing":
                now = get_chile_time()
                db.chat_typing.update_one(
                    {"conv_id": conv_id, "side": "client"},
                    {"$set": {"conv_id": conv_id, "side": "client", "state": bool(data.get("state", True)), "updated_at": now}},
                    upsert=True,
                )
                await manager.broadcast(
                    conv_id,
                    {"type": "typing", "side": "client", "state": bool(data.get("state", True))},
                    to_admins=True
                )
    except WebSocketDisconnect:
        await manager.disconnect(conv_id, websocket, is_admin=False)


@router.websocket("/ws/admin/{conv_id}")
async def ws_admin(websocket: WebSocket, conv_id: int):
    await manager.connect(conv_id, websocket, is_admin=True)
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "typing":
                now = get_chile_time()
                db.chat_typing.update_one(
                    {"conv_id": conv_id, "side": "admin"},
                    {"$set": {"conv_id": conv_id, "side": "admin", "state": bool(data.get("state", True)), "updated_at": now}},
                    upsert=True,
                )
                await manager.broadcast(
                    conv_id,
                    {"type": "typing", "side": "admin", "state": bool(data.get("state", True))},
                    to_admins=False
                )
    except WebSocketDisconnect:
        await manager.disconnect(conv_id, websocket, is_admin=True)
