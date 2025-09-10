import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Optional, List

from utils.time_utils import get_chile_time

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel

from main import verify_session
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
from utils.bot.common.common import (
    fetch_enriched_profile as _common_fetch_enriched_profile,
    build_user_context as _common_build_user_context,
    build_grok_user_context as _common_build_grok_user_context,
)

# Reuse role level logic
from apis.roles import get_company_role_level

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


def _fetch_profile(wallet: Optional[str], privy_id: Optional[str]) -> Optional[dict]:
    try:
        if wallet:
            prof = db.user_profiles.find_one({"wallet": wallet})
        elif privy_id:
            prof = db.user_profiles.find_one({"privy_id": privy_id})
        else:
            prof = None
        if not prof:
            return None
        # Minimal snapshot for chat
        return {
            "wallet": prof.get("wallet"),
            "name": prof.get("name"),
            "profile_image_url": prof.get("profile_image_url"),
            "twitter": prof.get("twitter"),
            "discord": prof.get("discord"),
            "instagram": prof.get("instagram"),
            "favorite_location": prof.get("favorite_location"),
            "liked_products": prof.get("liked_products", {}),
            "public_profile": prof.get("public_profile", False),
        }
    except Exception:
        return None


def _fetch_enriched_profile(wallet: Optional[str], privy_id: Optional[str]) -> Optional[dict]:
    return _common_fetch_enriched_profile(wallet, privy_id)
    
def _build_user_context(conv: dict) -> dict:
    return _common_build_user_context(conv)


def _build_grok_user_context(user_ctx: dict) -> dict:
    return _common_build_grok_user_context(user_ctx)

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
    level = get_company_role_level(wallet)
    if level not in (3, 4):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return wallet.lower(), level


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
        ctx = _build_user_context(c)
        out.append({
            "conv_id": c["conv_id"],
            "status": c.get("status", "open"),
            "mode": c.get("mode", "bot"),
            "assigned_admin": c.get("assigned_admin"),
            "wallet": c.get("wallet"),
            "privy_id": c.get("privy_id"),
            "updated_at": c.get("updated_at"),
            "created_at": c.get("created_at"),
            "user_profile": ctx.get("profile"),
            "user_promotions": ctx.get("promotions"),
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
    ctx = _build_user_context(conv)
    return {
        "conv_id": conv["conv_id"],
        "status": conv.get("status", "open"),
        "mode": conv.get("mode", "bot"),
        "assigned_admin": conv.get("assigned_admin"),
        "wallet": conv.get("wallet"),
        "privy_id": conv.get("privy_id"),
        "updated_at": conv.get("updated_at"),
        "created_at": conv.get("created_at"),
        "user_profile": ctx.get("profile"),
        "user_promotions": ctx.get("promotions"),
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

    sender_profile = _fetch_enriched_profile(conv.get("wallet"), conv.get("privy_id"))
    sender_name = (sender_profile or {}).get("name") or (conv.get("wallet") or "User")
    # If enriched, avatar is nested under profile
    sender_avatar_url = None
    if sender_profile:
        if isinstance(sender_profile.get("profile"), dict):
            sender_avatar_url = sender_profile["profile"].get("profile_image_url")
        sender_name = (sender_profile.get("profile") or {}).get("name") or sender_name
    await manager.broadcast(
        data.conv_id,
        {
            "type": "message",
            "role": "user",
            "text": data.text,
            "at": now.isoformat(),
            "sender_wallet": conv.get("wallet"),
            "sender_privy_id": conv.get("privy_id"),
            "sender_profile": sender_profile,
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
        # Build last N messages context
        last_msgs = list(db.chat_messages.find({"conv_id": conv_id}).sort("created_at", 1))[-12:]
        messages = [
            {"role": "user" if m["role"] == "user" else "assistant", "content": m["text"]}
            for m in last_msgs
        ]
        # Add user context as system primer for the bot (Grok/LLM)
        conv = db.chat_conversations.find_one({"conv_id": conv_id}) or {}
        user_ctx = _build_user_context(conv)
        grok_ctx = _build_grok_user_context(user_ctx)
        system_ctx = {
            "role": "system",
            "content": (
                "User context (JSON): " + json.dumps(grok_ctx, ensure_ascii=False)
            ),
        }
        messages = [system_ctx] + messages
        # Single entry point: engine.chat_complete decides DB vs LLM
        reply = await chat_complete(messages)
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
        db.chat_messages.insert_one({
            "conv_id": conv_id,
            "role": "assistant",
            "text": summary_text,
            "payload": payload,
            "created_at": now,
        })
        db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"updated_at": now}})
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
    min_profile = _fetch_enriched_profile(wallet, privy_id)
    for m in msgs:
        sender_wallet = m.get("sender_wallet")
        sender_privy_id = m.get("sender_privy_id")
        # Infer sender for older records
        if m.get("role") == "user" and (not sender_wallet and not sender_privy_id):
            sender_wallet = wallet
            sender_privy_id = privy_id
        # Determine display fields
        if m.get("role") == "user":
            # For enriched, display info comes from nested profile
            prof = (min_profile or {}).get("profile") if isinstance(min_profile, dict) else None
            sender_name = (prof or {}).get("name") or (sender_wallet or "User")
            sender_avatar_url = (prof or {}).get("profile_image_url")
            sender_prof = min_profile
        elif m.get("role") == "admin":
            admin_enriched = _fetch_enriched_profile(m.get("admin_wallet"), None)
            admin_prof_node = (admin_enriched or {}).get("profile") if isinstance(admin_enriched, dict) else None
            sender_name = (admin_prof_node or {}).get("name") or m.get("admin_wallet") or "Admin"
            sender_avatar_url = (admin_prof_node or {}).get("profile_image_url")
            sender_prof = admin_enriched
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
        "user_profile": _build_user_context(c).get("profile"),
        "user_promotions": _build_user_context(c).get("promotions"),
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
        "created_at": now,
        "admin_wallet": admin_wallet,
    })
    db.chat_conversations.update_one({"conv_id": conv_id}, {"$set": {"updated_at": now, "assigned_admin": admin_wallet, "mode": "human"}})
    # Admin display fields and profile (enriched)
    admin_enriched = _fetch_enriched_profile(admin_wallet, None)
    admin_prof_node = (admin_enriched or {}).get("profile") if isinstance(admin_enriched, dict) else None
    admin_name = (admin_prof_node or {}).get("name") or admin_wallet or "Admin"
    admin_avatar_url = (admin_prof_node or {}).get("profile_image_url")
    await manager.broadcast(
        conv_id,
        {
            "type": "message",
            "role": "admin",
            "text": data.text,
            "at": now.isoformat(),
            "sender_wallet": None,
            "sender_privy_id": None,
            "sender_profile": admin_enriched,
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
    # Pull user profile for display fields (enriched)
    wallet = conv.get("wallet")
    privy_id = conv.get("privy_id")
    min_profile = _fetch_enriched_profile(wallet, privy_id)
    for m in msgs:
        sender_wallet = m.get("sender_wallet")
        sender_privy_id = m.get("sender_privy_id")
        if m.get("role") == "user" and (not sender_wallet and not sender_privy_id):
            sender_wallet = wallet
            sender_privy_id = privy_id
        if m.get("role") == "user":
            prof = (min_profile or {}).get("profile") if isinstance(min_profile, dict) else None
            sender_name = (prof or {}).get("name") or (sender_wallet or "User")
            sender_avatar_url = (prof or {}).get("profile_image_url")
            sender_prof = min_profile
        elif m.get("role") == "admin":
            admin_min = _fetch_profile(m.get("admin_wallet"), None)
            sender_name = (admin_min or {}).get("name") or m.get("admin_wallet") or "Admin"
            sender_avatar_url = (admin_min or {}).get("profile_image_url")
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
    # Use enriched profile for the end user to match CommunityRankingResponse
    user_profile = _fetch_enriched_profile(wallet, privy_id) or {}
    participants: List[AdminParticipantOut] = []
    # End user
    prof = (user_profile or {}).get("profile") if isinstance(user_profile, dict) else None
    participants.append(AdminParticipantOut(
        role="user",
        wallet=wallet,
        privy_id=privy_id,
        profile=user_profile,
        display_name=(prof or {}).get("name") or wallet or "User",
        avatar_url=(prof or {}).get("profile_image_url"),
    ))
    # Admins who wrote
    admin_wallets = db.chat_messages.distinct("admin_wallet", {"conv_id": conv_id, "role": "admin"})
    for aw in [w for w in admin_wallets if w]:
        admin_enriched = _fetch_enriched_profile(aw, None) or {}
        admin_prof_node = (admin_enriched or {}).get("profile") if isinstance(admin_enriched, dict) else None
        participants.append(AdminParticipantOut(
            role="admin",
            wallet=aw,
            profile=admin_enriched,
            display_name=(admin_prof_node or {}).get("name") or aw,
            avatar_url=(admin_prof_node or {}).get("profile_image_url"),
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
