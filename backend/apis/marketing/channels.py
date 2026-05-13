"""
Community Channels API — Discord-style text/announcement channels.

Channels are scoped by section_filter and min_role_level.
Auto-join: workers whose section matches the channel's section_filter are considered members.
@nonna mentions trigger the AI agent with channel-context.
"""
import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel
from bson import ObjectId

from utils.auth.session import verify_session
from utils.web3mongo import db
from utils.chat.realtime import manager
from utils.chat.schemas import (
    ChannelCreateRequest,
    ChannelUpdateRequest,
    ChannelMessageRequest,
    ChannelMessageOut,
    ChannelOut,
    ReactionRequest,
)
from utils.time_utils import get_chile_time
from config.roles.access import require_admin_level, compute_permissions_for_identity

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

try:
    db.chat_channels.create_index("slug", unique=True)
    db.chat_channels.create_index("section_filter")
    db.chat_channel_messages.create_index([("channel_slug", 1), ("created_at", 1)])
    db.chat_channel_messages.create_index("channel_slug")
    db.chat_dm_messages.create_index([("conv_key", 1), ("created_at", 1)])
except Exception as e:
    logger.warning(f"Channel index creation warning: {e}")


# ─── Community Directory (catalogs + members) ────────────────────

@router.get("/community/catalogs")
async def community_catalogs(user: dict = Depends(verify_session)):
    """Return cargos and secciones from cargos_intranet for selectors."""
    cursor = db.cargos_intranet.find({}, {"_id": 0, "cargo": 1, "seccion": 1})
    cargos_set = set()
    secciones_set = set()
    for doc in cursor:
        c = (doc.get("cargo") or "").strip()
        s = (doc.get("seccion") or "").strip()
        if c:
            cargos_set.add(c)
        if s:
            secciones_set.add(s)
    return {
        "ok": True,
        "cargos": sorted(list(cargos_set)),
        "secciones": sorted(list(secciones_set)),
    }


@router.get("/community/members")
async def community_members(
    seccion: Optional[str] = None,
    cargo: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    """List active community workers (for DMs and group invite).

    Returns wallet, name, cargo, seccion, profile_image_url, and online status.
    """
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 3:
        raise HTTPException(status_code=403, detail="No access")

    # Build aggregation pipeline to join trabajadores_vpn + cargos_intranet + empleados_usuarios
    pipeline = [
        {"$match": {"activo": 1}},
        {
            "$lookup": {
                "from": "cargos_intranet",
                "localField": "cargo",
                "foreignField": "cargo",
                "as": "_ci",
            }
        },
        {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$_ci.seccion", 0]}, ""]}}},
        {
            "$lookup": {
                "from": "empleados_usuarios",
                "localField": "rut",
                "foreignField": "rut",
                "as": "_eu",
            }
        },
        {
            "$addFields": {
                "wallet": {"$ifNull": [{"$arrayElemAt": ["$_eu.wallet", 0]}, None]},
            }
        },
        {
            "$project": {
                "_id": 0,
                "rut": 1,
                "nombres": 1,
                "apellidopaterno": 1,
                "cargo": 1,
                "seccion": 1,
                "wallet": 1,
                "profile_image_url": 1,
            }
        },
    ]

    if seccion:
        pipeline.append({"$match": {"seccion": {"$regex": f"^{seccion}$", "$options": "i"}}})
    if cargo:
        pipeline.append({"$match": {"cargo": {"$regex": f"^{cargo}$", "$options": "i"}}})
    if q:
        pipeline.append({"$match": {
            "$or": [
                {"nombres": {"$regex": q, "$options": "i"}},
                {"apellidopaterno": {"$regex": q, "$options": "i"}},
                {"cargo": {"$regex": q, "$options": "i"}},
            ]
        }})

    pipeline.append({"$sort": {"nombres": 1}})
    pipeline.append({"$limit": 200})

    workers = list(db.trabajadores_vpn.aggregate(pipeline))

    members = []
    for w in workers:
        name_parts = [w.get("nombres", ""), w.get("apellidopaterno", "")]
        name = " ".join(p.strip() for p in name_parts if p.strip()) or "Worker"
        wallet = w.get("wallet")
        if wallet:
            wallet = wallet.lower()
        members.append({
            "name": name,
            "wallet": wallet,
            "cargo": w.get("cargo", ""),
            "seccion": w.get("seccion", ""),
            "profile_image_url": w.get("profile_image_url"),
            "rut": w.get("rut"),
        })

    return {"ok": True, "members": members}



# ─── Helpers ──────────────────────────────────────────────────────

def _format_bot_reply(reply) -> tuple[str, Optional[dict]]:
    """Convert a structured AI reply into readable text for the simple community chat."""
    if not isinstance(reply, dict):
        return str(reply), None

    text = reply.get("text") or reply.get("assistant_text") or reply.get("message")
    if text:
        return str(text), reply

    lines = reply.get("lines")
    if isinstance(lines, list) and lines:
        return "\n".join(str(x) for x in lines), reply

    title = reply.get("title") or reply.get("subtitle") or "Datos encontrados"
    items = reply.get("items") or reply.get("rows") or reply.get("groups") or []
    if isinstance(items, list):
        return f"📊 **{title}** ({len(items)} resultados)\n_Nota: Las tablas complejas se ven mejor en el chat principal._", reply

    return "(respuesta estructurada sin texto)", reply


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from channel name."""
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s or f"channel-{uuid.uuid4().hex[:8]}"


def _user_identity(user: dict) -> dict:
    wallet = user.get("wallet")
    sub = user.get("sub")
    return {"wallet": wallet.lower() if wallet else None, "privy_id": sub}


def _get_user_perms(user: dict) -> dict:
    """Get permissions from session or compute them."""
    perms = user.get("permissions")
    if perms:
        return perms
    ident = _user_identity(user)
    identity = ident.get("wallet") or ident.get("privy_id")
    if identity:
        try:
            return compute_permissions_for_identity(identity)
        except Exception:
            pass
    return {}


def _can_access_channel(channel: dict, perms: dict) -> bool:
    """Check if user can access a channel based on role_level and section."""
    min_rl = channel.get("min_role_level", 6)
    user_rl = perms.get("role_level", -1)
    if user_rl is None or user_rl < 0:
        return False

    # Levels 3-5 (on-chain members) can access anything
    if 3 <= user_rl <= 5:
        return True

    # Levels 6-7: must meet min_role_level AND have matching section if channel has one
    if user_rl < min_rl:
        return False

    section = channel.get("section_filter")
    if section:
        user_section = (perms.get("seccion") or "").strip().lower()
        if user_section != section.strip().lower():
            # Also check cargo for flexibility
            user_cargo = (perms.get("cargo") or "").strip().lower()
            if section.strip().lower() not in user_cargo:
                return False
    return True


def _enrich_sender(user: dict, perms: dict) -> dict:
    """Build sender fields for a message."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")

    # Try to get profile info from trabajadores_vpn / empleados_usuarios
    display_name = wallet or "User"
    avatar_url = None
    try:
        if wallet:
            eu = db.empleados_usuarios.find_one({"wallet": wallet.lower()}, {"rut": 1})
            if eu and eu.get("rut"):
                tv = db.trabajadores_vpn.find_one({"rut": eu["rut"]})
                if tv:
                    name_parts = [tv.get("nombres", ""), tv.get("apellidopaterno", "")]
                    display_name = " ".join(p.strip() for p in name_parts if p.strip()) or display_name
                    avatar_url = tv.get("profile_image_url")
    except Exception:
        pass

    return {
        "sender_wallet": wallet,
        "sender_privy_id": ident.get("privy_id"),
        "sender_name": display_name,
        "sender_avatar_url": avatar_url,
        "sender_cargo": perms.get("cargo"),
        "sender_seccion": perms.get("seccion"),
        "sender_role_level": perms.get("role_level"),
    }


def _msg_to_out(m: dict, channel_slug: str) -> dict:
    """Convert a MongoDB message doc to output dict."""
    pinned_ids = set()
    try:
        ch = db.chat_channels.find_one({"slug": channel_slug}, {"pinned_message_ids": 1})
        if ch:
            pinned_ids = set(str(x) for x in (ch.get("pinned_message_ids") or []))
    except Exception:
        pass

    msg_id = str(m.get("_id", ""))
    return {
        "id": msg_id,
        "channel_slug": m.get("channel_slug", channel_slug),
        "sender_wallet": m.get("sender_wallet"),
        "sender_privy_id": m.get("sender_privy_id"),
        "sender_name": m.get("sender_name"),
        "sender_avatar_url": m.get("sender_avatar_url"),
        "sender_cargo": m.get("sender_cargo"),
        "sender_seccion": m.get("sender_seccion"),
        "sender_role_level": m.get("sender_role_level"),
        "text": m.get("text", ""),
        "payload": m.get("payload"),
        "media_urls": m.get("media_urls") or [],
        "mentions": m.get("mentions") or [],
        "reply_to": m.get("reply_to"),
        "reply_preview": m.get("reply_preview"),
        "reactions": m.get("reactions") or {},
        "is_pinned": msg_id in pinned_ids,
        "created_at": m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at"),
    }


# ─── CRUD ─────────────────────────────────────────────────────────

@router.post("/community/channels")
async def create_channel(data: ChannelCreateRequest, user: dict = Depends(verify_session)):
    """Create a new channel. Admin only (level 3-4)."""
    require_admin_level(user, "admin")
    admin_wallet = (user.get("wallet") or "").lower()
    slug = data.slug or _slugify(data.name)

    # Ensure unique slug
    existing = db.chat_channels.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Channel slug '{slug}' already exists")

    now = get_chile_time()
    doc = {
        "slug": slug,
        "name": data.name,
        "channel_type": data.channel_type,
        "section_filter": data.section_filter,
        "description": data.description,
        "icon": data.icon,
        "is_public": data.is_public,
        "min_role_level": data.min_role_level,
        "created_by": admin_wallet,
        "created_at": now,
        "pinned_message_ids": [],
        "member_count": 0,
    }
    db.chat_channels.insert_one(doc)
    logger.info(f"Channel created: {slug} by {admin_wallet}")
    return {"ok": True, "slug": slug}


@router.get("/community/channels", response_model=List[ChannelOut])
async def list_channels(user: dict = Depends(verify_session)):
    """List channels accessible to the current user."""
    perms = _get_user_perms(user)
    channels = list(db.chat_channels.find().sort("created_at", 1))
    out = []
    for ch in channels:
        if not _can_access_channel(ch, perms):
            continue
        out.append({
            "slug": ch["slug"],
            "name": ch.get("name", ""),
            "channel_type": ch.get("channel_type", "text"),
            "section_filter": ch.get("section_filter"),
            "description": ch.get("description"),
            "icon": ch.get("icon"),
            "is_public": ch.get("is_public", True),
            "min_role_level": ch.get("min_role_level", 6),
            "created_by": ch.get("created_by"),
            "created_at": ch.get("created_at"),
            "member_count": manager.channel_online_count(ch["slug"]),
            "unread_count": 0,  # TODO: per-user read cursors
            "pinned_message_ids": [str(x) for x in (ch.get("pinned_message_ids") or [])],
        })
    return out


@router.get("/community/channels/suggested")
async def suggested_channels(user: dict = Depends(verify_session)):
    """Return suggested channel templates for admins creating new channels."""
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl not in (3, 4):
        raise HTTPException(status_code=403, detail="Solo admins")

    existing_slugs = set(
        ch["slug"] for ch in db.chat_channels.find({}, {"slug": 1})
    )

    suggestions = [
        {"name": "General", "slug": "general", "icon": "💬", "section_filter": None, "description": "Chat general de la comunidad Piccola"},
        {"name": "Anuncios", "slug": "anuncios", "icon": "📢", "section_filter": None, "description": "Anuncios oficiales", "channel_type": "announcement"},
        {"name": "Cocina", "slug": "cocina", "icon": "🍳", "section_filter": "cocina", "description": "Canal del equipo de cocina"},
        {"name": "Delivery", "slug": "delivery", "icon": "🍕", "section_filter": "delivery", "description": "Coordinación de delivery"},
        {"name": "Sala", "slug": "sala", "icon": "🍽️", "section_filter": "sala", "description": "Equipo de sala y atención"},
        {"name": "Recetas", "slug": "recetas", "icon": "📖", "section_filter": "cocina", "description": "Compartir y discutir recetas"},
        {"name": "Off-Topic", "slug": "off-topic", "icon": "🎮", "section_filter": None, "description": "Todo lo que no sea trabajo"},
    ]

    return [s for s in suggestions if s["slug"] not in existing_slugs]


@router.put("/community/channels/{slug}")
async def update_channel(slug: str, data: ChannelUpdateRequest, user: dict = Depends(verify_session)):
    """Update channel settings. Admin only."""
    require_admin_level(user, "admin")
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    update = {}
    if data.name is not None:
        update["name"] = data.name
    if data.description is not None:
        update["description"] = data.description
    if data.icon is not None:
        update["icon"] = data.icon
    if data.is_public is not None:
        update["is_public"] = data.is_public
    if data.min_role_level is not None:
        update["min_role_level"] = data.min_role_level
    if data.section_filter is not None:
        update["section_filter"] = data.section_filter

    if update:
        db.chat_channels.update_one({"slug": slug}, {"$set": update})
    return {"ok": True}


@router.delete("/community/channels/{slug}")
async def delete_channel(slug: str, user: dict = Depends(verify_session)):
    """Archive/delete a channel. Admin only."""
    require_admin_level(user, "admin")
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    db.chat_channels.delete_one({"slug": slug})
    # Don't delete messages — keep for audit
    logger.info(f"Channel deleted: {slug}")
    return {"ok": True}


# ─── Messaging ────────────────────────────────────────────────────

@router.get("/community/channels/{slug}/messages")
async def channel_messages(
    slug: str,
    limit: int = 50,
    before: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    """Get channel message history with cursor-based pagination."""
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    perms = _get_user_perms(user)
    if not _can_access_channel(ch, perms):
        raise HTTPException(status_code=403, detail="No access to this channel")

    q = {"channel_slug": slug}
    if before:
        try:
            q["_id"] = {"$lt": ObjectId(before)}
        except Exception:
            pass

    limit = min(max(1, limit), 100)
    msgs = list(
        db.chat_channel_messages.find(q)
        .sort("_id", -1)
        .limit(limit)
    )
    msgs.reverse()  # oldest first

    return [_msg_to_out(m, slug) for m in msgs]


@router.post("/community/channels/{slug}/messages")
async def send_channel_message(slug: str, data: ChannelMessageRequest, user: dict = Depends(verify_session)):
    """Send a message to a channel. Triggers @nonna if mentioned."""
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    perms = _get_user_perms(user)
    if not _can_access_channel(ch, perms):
        raise HTTPException(status_code=403, detail="No access to this channel")

    # Announcement channels: only admins can post
    if ch.get("channel_type") == "announcement":
        rl = perms.get("role_level", -1)
        if rl not in (3, 4):
            raise HTTPException(status_code=403, detail="Solo admins pueden publicar en canales de anuncios")

    now = get_chile_time()
    sender = _enrich_sender(user, perms)

    # Parse @nonna mentions
    mentions = list(data.mentions or [])
    text_lower = data.text.lower()
    if "@nonna" in text_lower and "@nonna" not in mentions:
        mentions.append("@nonna")

    # Build reply preview if replying to a message
    reply_preview = None
    if data.reply_to:
        try:
            parent = db.chat_channel_messages.find_one({"_id": ObjectId(data.reply_to)})
            if parent:
                reply_preview = {
                    "text": (parent.get("text") or "")[:200],
                    "sender_name": parent.get("sender_name", ""),
                }
        except Exception:
            pass

    msg_doc = {
        "channel_slug": slug,
        "text": data.text,
        "mentions": mentions,
        "reply_to": data.reply_to,
        "reply_preview": reply_preview,
        "reactions": {},
        "media_urls": [],
        "payload": None,
        "created_at": now,
        **sender,
    }
    result = db.chat_channel_messages.insert_one(msg_doc)
    msg_doc["_id"] = result.inserted_id

    # Broadcast via WebSocket
    out = _msg_to_out(msg_doc, slug)
    await manager.broadcast_channel(slug, {"type": "message", **out})

    # Trigger @nonna bot reply if mentioned
    if "@nonna" in mentions:
        asyncio.create_task(_nonna_channel_reply(slug, ch, data.text, perms))

    return {"ok": True, "id": str(result.inserted_id)}


@router.post("/community/channels/{slug}/messages/{message_id}/react")
async def react_to_channel_message(
    slug: str, message_id: str, data: ReactionRequest, user: dict = Depends(verify_session)
):
    """Toggle a reaction on a channel message."""
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    perms = _get_user_perms(user)
    if not _can_access_channel(ch, perms):
        raise HTTPException(status_code=403, detail="No access")

    ident = _user_identity(user)
    wallet = ident.get("wallet") or ident.get("privy_id") or "anon"
    emoji = data.emoji

    try:
        msg = db.chat_channel_messages.find_one({"_id": ObjectId(message_id), "channel_slug": slug})
    except Exception:
        raise HTTPException(status_code=404, detail="Message not found")
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = msg.get("reactions") or {}
    reactors = reactions.get(emoji, [])

    if wallet in reactors:
        reactors.remove(wallet)
        action = "removed"
    else:
        reactors.append(wallet)
        action = "added"

    if reactors:
        reactions[emoji] = reactors
    else:
        reactions.pop(emoji, None)

    db.chat_channel_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"reactions": reactions}}
    )

    await manager.broadcast_channel(slug, {
        "type": "reaction",
        "message_id": message_id,
        "emoji": emoji,
        "wallet": wallet,
        "action": action,
        "reactions": reactions,
    })

    return {"ok": True, "action": action}


@router.post("/community/channels/{slug}/pin/{message_id}")
async def pin_channel_message(slug: str, message_id: str, user: dict = Depends(verify_session)):
    """Pin/unpin a message in a channel. Admin only."""
    require_admin_level(user, "admin")
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    pinned = ch.get("pinned_message_ids") or []
    if message_id in pinned:
        pinned.remove(message_id)
        action = "unpinned"
    else:
        pinned.append(message_id)
        action = "pinned"

    db.chat_channels.update_one({"slug": slug}, {"$set": {"pinned_message_ids": pinned}})

    await manager.broadcast_channel(slug, {
        "type": "pin",
        "message_id": message_id,
        "action": action,
    })
    return {"ok": True, "action": action}


@router.get("/community/channels/{slug}/pinned")
async def get_pinned_messages(slug: str, user: dict = Depends(verify_session)):
    """Get all pinned messages for a channel."""
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    perms = _get_user_perms(user)
    if not _can_access_channel(ch, perms):
        raise HTTPException(status_code=403, detail="No access")

    pinned_ids = ch.get("pinned_message_ids") or []
    if not pinned_ids:
        return []

    try:
        oids = [ObjectId(pid) for pid in pinned_ids]
    except Exception:
        return []

    msgs = list(db.chat_channel_messages.find({"_id": {"$in": oids}}).sort("created_at", 1))
    return [_msg_to_out(m, slug) for m in msgs]


# ─── Media Upload ─────────────────────────────────────────────────

@router.post("/community/channels/{slug}/upload")
async def upload_channel_media(
    slug: str,
    file: UploadFile = File(...),
    user: dict = Depends(verify_session),
):
    """Upload media (image/video/file) to a channel message. Returns the CDN URL."""
    ch = db.chat_channels.find_one({"slug": slug})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    perms = _get_user_perms(user)
    if not _can_access_channel(ch, perms):
        raise HTTPException(status_code=403, detail="No access")

    # Max 25MB
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 25MB)")

    import io
    from utils.r2_upload import upload_to_r2

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower() if file.filename else "bin"
    key = f"community/channels/{slug}/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "application/octet-stream"

    url = upload_to_r2(io.BytesIO(content), key, content_type=content_type, public=True)

    return {"ok": True, "url": url, "content_type": content_type, "size": len(content)}


# ─── @Nonna Bot Reply in Channel Context ─────────────────────────

async def _nonna_channel_reply(slug: str, channel: dict, text: str, user_perms: dict):
    """Generate an AI reply in channel context when @nonna is mentioned."""
    try:
        from utils.bot.engine import chat_complete

        # Build recent messages context (last 8)
        recent = list(
            db.chat_channel_messages.find({"channel_slug": slug})
            .sort("created_at", -1)
            .limit(8)
        )
        recent.reverse()

        messages = []
        section = channel.get("section_filter")
        channel_name = channel.get("name", slug)

        # System prompt with channel context
        system_prompt = (
            f"Estás en el canal comunitario '#{channel_name}' de Piccola Italia. "
        )
        if section:
            system_prompt += (
                f"Este canal es de la sección '{section}'. "
                f"PRIORIZA respuestas relacionadas con {section}. "
                f"Si te preguntan algo fuera del contexto de {section}, responde pero nota que es el canal de {section}. "
            )
        system_prompt += (
            "Los usuarios te mencionan con @nonna. Responde de forma concisa, amable y en español chileno. "
            "No incluyas '@nonna' en tu respuesta."
        )

        messages.append({"role": "system", "content": system_prompt})

        # Add user context
        wallet = user_perms.get("wallet") or ""
        ctx = {
            "role_level": user_perms.get("role_level"),
            "cargo": user_perms.get("cargo"),
            "seccion": user_perms.get("seccion"),
            "wallet": wallet,
            "channel": slug,
            "section_filter": section,
        }
        messages.append({
            "role": "system",
            "content": f"User context (JSON): {json.dumps(ctx, ensure_ascii=False, default=str)}"
        })

        for m in recent:
            role = "user"
            content = m.get("text", "")
            if m.get("sender_name") == "La Nonna" or m.get("sender_wallet") is None:
                role = "assistant"
            messages.append({"role": role, "content": content})

        # Call chat_complete with channel_mode context
        try:
            reply = await asyncio.wait_for(chat_complete(messages), timeout=30)
        except asyncio.TimeoutError:
            reply = "Estoy un poco ocupada ahora, intentemos de nuevo en un momento 👵"

        # Extract text from reply using our helper
        reply_text, payload = _format_bot_reply(reply)

        now = get_chile_time()
        bot_msg = {
            "channel_slug": slug,
            "text": reply_text,
            "payload": payload,
            "mentions": [],
            "reply_to": None,
            "reply_preview": None,
            "reactions": {},
            "media_urls": [],
            "sender_wallet": None,
            "sender_privy_id": None,
            "sender_name": "La Nonna 👵",
            "sender_avatar_url": None,
            "sender_cargo": None,
            "sender_seccion": None,
            "sender_role_level": None,
            "created_at": now,
        }
        result = db.chat_channel_messages.insert_one(bot_msg)
        bot_msg["_id"] = result.inserted_id

        out = _msg_to_out(bot_msg, slug)
        await manager.broadcast_channel(slug, {"type": "message", **out})

    except Exception as e:
        logger.error(f"@nonna channel reply error for {slug}: {e}")

# ─── Direct Messages ──────────────────────────────────────────────

def _dm_conv_key(w1: str, w2: str) -> str:
    """Symmetric conversation key for two wallets."""
    pair = sorted([w1.lower(), w2.lower()])
    return f"dm:{pair[0]}:{pair[1]}"


@router.get("/community/dm/conversations")
async def dm_conversations(user: dict = Depends(verify_session)):
    """List DM conversations for the current user."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet")

    # Find all DMs where this user is sender or receiver
    pipeline = [
        {"$match": {"$or": [
            {"sender_wallet": wallet},
            {"peer_wallet": wallet},
        ]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conv_key",
            "last_text": {"$first": "$text"},
            "last_at": {"$first": "$created_at"},
            "peer_wallet": {"$first": {
                "$cond": [{"$eq": ["$sender_wallet", wallet]}, "$peer_wallet", "$sender_wallet"]
            }},
            "peer_name": {"$first": {
                "$cond": [{"$eq": ["$sender_wallet", wallet]}, "$peer_name", "$sender_name"]
            }},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 50},
    ]
    convos = list(db.chat_dm_messages.aggregate(pipeline))
    return [
        {
            "conv_key": c["_id"],
            "peer_wallet": c.get("peer_wallet"),
            "peer_name": c.get("peer_name"),
            "last_text": c.get("last_text"),
            "last_at": c.get("last_at"),
        }
        for c in convos
    ]


@router.get("/community/dm/messages")
async def dm_messages(
    peer: str,
    limit: int = 50,
    before: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    """Get message history with a specific peer."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet")

    conv_key = _dm_conv_key(wallet, peer)
    q = {"conv_key": conv_key}
    if before:
        try:
            q["_id"] = {"$lt": ObjectId(before)}
        except Exception:
            pass

    limit = min(max(1, limit), 100)
    msgs = list(
        db.chat_dm_messages.find(q)
        .sort("_id", -1)
        .limit(limit)
    )
    msgs.reverse()

    return [
        {
            "id": str(m["_id"]),
            "conv_key": m.get("conv_key"),
            "sender_wallet": m.get("sender_wallet"),
            "sender_name": m.get("sender_name"),
            "peer_wallet": m.get("peer_wallet"),
            "peer_name": m.get("peer_name"),
            "text": m.get("text", ""),
            "created_at": m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at"),
        }
        for m in msgs
    ]


class DmSendRequest(BaseModel):
    peer: str
    text: str


@router.post("/community/dm/send")
async def dm_send(data: DmSendRequest, user: dict = Depends(verify_session)):
    """Send a direct message to another worker."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet")

    peer_wallet = data.peer.lower()
    if peer_wallet == wallet:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    perms = _get_user_perms(user)
    sender = _enrich_sender(user, perms)

    # Resolve peer name
    peer_name = peer_wallet
    try:
        eu = db.empleados_usuarios.find_one({"wallet": peer_wallet})
        if eu and eu.get("rut"):
            trab = db.trabajadores_vpn.find_one({"rut": eu["rut"]})
            if trab:
                peer_name = f"{trab.get('nombres', '')} {trab.get('apellidopaterno', '')}".strip() or peer_wallet
    except Exception:
        pass

    conv_key = _dm_conv_key(wallet, peer_wallet)
    now = get_chile_time()

    msg_doc = {
        "conv_key": conv_key,
        "sender_wallet": wallet,
        "sender_name": sender.get("sender_name", wallet),
        "peer_wallet": peer_wallet,
        "peer_name": peer_name,
        "text": data.text,
        "created_at": now,
    }
    result = db.chat_dm_messages.insert_one(msg_doc)
    return {"ok": True, "id": str(result.inserted_id)}


# ─── WebSocket ────────────────────────────────────────────────────

@router.websocket("/ws/channel/{slug}")
async def ws_channel(websocket: WebSocket, slug: str):
    await manager.connect_channel(slug, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "typing":
                await manager.broadcast_channel(slug, {
                    "type": "typing",
                    "wallet": data.get("wallet"),
                    "name": data.get("name"),
                    "state": bool(data.get("state", True)),
                })
    except WebSocketDisconnect:
        await manager.disconnect_channel(slug, websocket)


# ─── Presence WebSocket ───────────────────────────────────────────

@router.websocket("/ws/community/presence")
async def ws_presence(websocket: WebSocket):
    """Presence WebSocket: client sends heartbeats, receives presence updates."""
    # Start cleanup loop if not already running
    manager.start_presence_cleanup()

    wallet = None
    await manager.connect_presence(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "heartbeat":
                wallet = (data.get("wallet") or "").lower()
                if wallet:
                    user_info = {
                        "name": data.get("name", wallet),
                        "cargo": data.get("cargo"),
                        "seccion": data.get("seccion"),
                        "profile_image_url": data.get("profile_image_url"),
                    }
                    await manager.heartbeat(wallet, user_info)
    except WebSocketDisconnect:
        await manager.disconnect_presence(websocket, wallet)


@router.get("/community/presence")
async def get_presence(user: dict = Depends(verify_session)):
    """REST fallback: returns all presence data grouped by section, including all offline workers."""
    # 1. Real-time presence from memory manager
    all_p = manager.get_all_presence()
    presence_map = { (p.get("wallet") or "").lower(): p for p in all_p if p.get("wallet") }

    # 2. Get all active workers from DB
    pipeline = [
        {"$match": {"activo": 1}},
        {
            "$lookup": {
                "from": "cargos_intranet",
                "localField": "cargo",
                "foreignField": "cargo",
                "as": "_ci",
            }
        },
        {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$_ci.seccion", 0]}, ""]}}},
        {
            "$lookup": {
                "from": "empleados_usuarios",
                "localField": "rut",
                "foreignField": "rut",
                "as": "_eu",
            }
        },
        {
            "$addFields": {
                "wallet": {"$ifNull": [{"$arrayElemAt": ["$_eu.wallet", 0]}, None]},
            }
        },
        {
            "$project": {
                "_id": 0,
                "rut": 1,
                "nombres": 1,
                "apellidopaterno": 1,
                "cargo": 1,
                "seccion": 1,
                "wallet": 1,
                "profile_image_url": 1,
            }
        },
    ]

    workers = list(db.trabajadores_vpn.aggregate(pipeline))

    online = []
    idle = []
    offline = []

    # Iterate all active DB workers
    for w in workers:
        name_parts = [w.get("nombres", ""), w.get("apellidopaterno", "")]
        name = " ".join(p.strip() for p in name_parts if p.strip()) or "Trabajador"
        wallet = (w.get("wallet") or f"rut_{w.get('rut')}").lower()

        # Check if they are in real-time presence
        p_data = presence_map.get(wallet)
        status = p_data.get("status") if p_data else "offline"

        entry = {
            "wallet": wallet,
            "name": name,
            "status": status,
            "cargo": w.get("cargo", ""),
            "seccion": w.get("seccion", ""),
            "profile_image_url": w.get("profile_image_url"),
            "rut": w.get("rut")
        }

        if status == "online":
            online.append(entry)
        elif status == "idle":
            idle.append(entry)
        else:
            offline.append(entry)

    # 3. Get all community users and generic users
    COMPANY_ID = 1 # Assuming COMPANY_ID = 1 for Piccola Italia as per env
    com_users = list(db.community_users.find())
    reg_users = list(db.users.find({"company_id": COMPANY_ID}))
    
    seen_wallets = {e["wallet"] for e in online + idle + offline}
    
    for cu in com_users + reg_users:
        c_wallet = (cu.get("wallet") or cu.get("address") or "").lower()
        if not c_wallet or c_wallet in seen_wallets:
            continue
            
        profile = cu.get("profile") or {}
        c_name = profile.get("name") or cu.get("name") or cu.get("display_name") or "Usuario Registrado"
        
        # Check if they are in real-time presence
        p_data = presence_map.get(c_wallet)
        status = p_data.get("status") if p_data else "offline"
        
        entry = {
            "wallet": c_wallet,
            "name": c_name,
            "status": status,
            "cargo": "Comunidad",
            "seccion": "Comunidad",
            "profile_image_url": profile.get("profile_image_url") or cu.get("profile_image_url"),
            "rut": None
        }
        
        seen_wallets.add(c_wallet)
        
        if status == "online":
            online.append(entry)
        elif status == "idle":
            idle.append(entry)
        else:
            offline.append(entry)

    # Group by section
    def group_by_section(members):
        sections = {}
        for m in members:
            sec = (m.get("seccion") or "General").strip()
            if sec not in sections:
                sections[sec] = []
            sections[sec].append(m)
        return sections

    return {
        "ok": True,
        "online_count": len(online),
        "idle_count": len(idle),
        "online": group_by_section(online),
        "idle": group_by_section(idle),
        "offline": group_by_section(offline),
    }


# ─── Section Permissions ──────────────────────────────────────────

DEFAULT_SECTION_PERMS = {
    "can_create_groups": True,
    "can_create_channels": False,
    "can_post_announcements": False,
    "can_upload_media": True,
    "can_invite_members": True,
    "can_pin_messages": False,
    "max_groups": 5,
}


class SectionPermsUpdate(BaseModel):
    can_create_groups: Optional[bool] = None
    can_create_channels: Optional[bool] = None
    can_post_announcements: Optional[bool] = None
    can_upload_media: Optional[bool] = None
    can_invite_members: Optional[bool] = None
    can_pin_messages: Optional[bool] = None
    max_groups: Optional[int] = None


@router.get("/community/section-perms")
async def list_section_perms(user: dict = Depends(verify_session)):
    """List all section permission configs. Returns defaults for unconfigured sections."""
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 3:
        raise HTTPException(status_code=403, detail="No access")

    # Get all known sections from cargos_intranet
    cursor = db.cargos_intranet.find({}, {"_id": 0, "seccion": 1})
    all_sections = sorted({(doc.get("seccion") or "").strip() for doc in cursor if doc.get("seccion")})

    # Get stored perms
    stored = {
        doc["seccion"]: doc
        for doc in db.community_section_perms.find({}, {"_id": 0})
        if doc.get("seccion")
    }

    result = []
    for sec in all_sections:
        doc = stored.get(sec, {})
        entry = {"seccion": sec}
        for k, default_val in DEFAULT_SECTION_PERMS.items():
            entry[k] = doc.get(k, default_val)
        entry["updated_by"] = doc.get("updated_by")
        entry["updated_at"] = doc.get("updated_at")
        result.append(entry)

    return {"ok": True, "sections": result}


@router.put("/community/section-perms/{seccion}")
async def update_section_perms(seccion: str, data: SectionPermsUpdate, user: dict = Depends(verify_session)):
    """Update permissions for a section. Admin only (level 3-4)."""
    require_admin_level(user, "admin")
    admin_wallet = (user.get("wallet") or "").lower()

    update = {}
    for field in ("can_create_groups", "can_create_channels", "can_post_announcements",
                  "can_upload_media", "can_invite_members", "can_pin_messages", "max_groups"):
        val = getattr(data, field, None)
        if val is not None:
            update[field] = val

    if not update:
        return {"ok": True, "message": "No changes"}

    update["updated_by"] = admin_wallet
    update["updated_at"] = get_chile_time()

    db.community_section_perms.update_one(
        {"seccion": seccion},
        {"$set": {**update, "seccion": seccion}},
        upsert=True,
    )

    logger.info(f"Section perms updated: {seccion} by {admin_wallet}")
    return {"ok": True, "seccion": seccion}


def get_section_perms(seccion: str) -> dict:
    """Helper: get effective perms for a section (with defaults)."""
    if not seccion:
        return dict(DEFAULT_SECTION_PERMS)
    doc = db.community_section_perms.find_one({"seccion": seccion}, {"_id": 0})
    result = dict(DEFAULT_SECTION_PERMS)
    if doc:
        for k in DEFAULT_SECTION_PERMS:
            if k in doc:
                result[k] = doc[k]
    return result
