"""
Community Groups API — Private group chats.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from bson import ObjectId
from pydantic import BaseModel

from utils.auth.session import verify_session
from utils.web3mongo import db
from utils.chat.realtime import manager
from utils.chat.schemas import (
    DmSendRequest,
    GroupCreateRequest,
    GroupUpdateRequest,
    GroupMemberRequest,
    GroupMessageRequest,
    GroupOut,
    ReactionRequest,
)
from utils.time_utils import get_chile_time
from config.roles.access import compute_permissions_for_identity

# Import logic from config
from config.community.identity_manager import _user_identity, _get_user_perms, _enrich_sender
from config.community.membership_manager import _is_group_member, _get_member_role
from config.community.message_formatter import _msg_to_out, _nonna_group_reply
from config.community.dm_service import _dm_conv_key, get_dm_conversations, get_dm_messages, resolve_peer_name
from config.community.directory_service import get_community_catalogs, get_community_members, get_community_presence
from config.community.section_service import get_all_section_perms, update_section_permissions

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# ─── Indexes ──────────────────────────────────────────────────────
try:
    db.chat_groups.create_index("group_id", unique=True)
    db.chat_groups.create_index("owner_wallet")
    db.chat_groups.create_index("members.wallet")
    db.chat_groups.create_index("section_filter")
    db.chat_group_messages.create_index([("group_id", 1), ("created_at", 1)])
except Exception as e:
    logger.warning(f"Group index creation warning: {e}")

# ─── Group CRUD ───────────────────────────────────────────────────

@router.post("/community/groups")
async def create_group(data: GroupCreateRequest, user: dict = Depends(verify_session)):
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 0:
        raise HTTPException(status_code=403, detail="Necesitas un rol activo para crear grupos")

    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="Se requiere wallet")

    if data.is_section_based and (data.allowed_secciones or data.allowed_cargos):
        user_section = (perms.get("seccion") or "").strip().lower()
        user_cargo = (perms.get("cargo") or "").strip().lower()
        allowed_sec = [s.strip().lower() for s in data.allowed_secciones]
        allowed_car = [c.strip().lower() for c in data.allowed_cargos]
        if rl not in (3, 4) and user_section not in allowed_sec and user_cargo not in allowed_car:
            raise HTTPException(status_code=403, detail="Solo puedes crear grupos con filtros de tu propia sección o cargo")

    group_id = uuid.uuid4().hex[:12]
    now = get_chile_time()

    display_name = wallet
    avatar_url = None
    try:
        cu = db.community_users.find_one({"wallet": wallet})
        if cu:
            profile = cu.get("profile") or {}
            display_name = profile.get("name") or display_name
            avatar_url = profile.get("profile_image_url") or cu.get("profile_image_url")
    except Exception:
        pass

    doc = {
        "group_id": group_id,
        "name": data.name,
        "icon": data.icon,
        "allowed_secciones": data.allowed_secciones,
        "allowed_cargos": data.allowed_cargos,
        "is_section_based": data.is_section_based,
        "owner_wallet": wallet,
        "created_at": now,
        "member_count": 1,
        "members": [{
            "wallet": wallet,
            "privy_id": ident.get("privy_id"),
            "role": "owner",
            "display_name": display_name,
            "avatar_url": avatar_url,
            "cargo": perms.get("cargo"),
            "seccion": perms.get("seccion"),
            "joined_at": now,
        }],
    }
    db.chat_groups.insert_one(doc)
    return {"ok": True, "group_id": group_id}


@router.get("/community/groups", response_model=List[GroupOut])
async def list_groups(user: dict = Depends(verify_session)):
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    privy_id = ident.get("privy_id")
    perms = _get_user_perms(user)

    ors = []
    if wallet:
        ors.append({"members.wallet": wallet})
    if privy_id:
        ors.append({"members.privy_id": privy_id})

    user_section = (perms.get("seccion") or "").strip().lower()
    user_cargo = (perms.get("cargo") or "").strip().lower()
    is_active = perms.get("is_active_worker", False)
    
    if is_active and (user_section or user_cargo):
        section_conds = []
        if user_section:
            section_conds.append({"allowed_secciones": {"$regex": f"^{user_section}$", "$options": "i"}})
        if user_cargo:
            section_conds.append({"allowed_cargos": {"$regex": f"^{user_cargo}$", "$options": "i"}})
            
        if section_conds:
            ors.append({
                "is_section_based": True,
                "$or": section_conds
            })

    if not ors:
        return []

    groups = list(db.chat_groups.find({"$or": ors}).sort("created_at", -1))
    out = []
    for g in groups:
        members = []
        for m in (g.get("members") or []):
            members.append({
                "wallet": m.get("wallet"),
                "privy_id": m.get("privy_id"),
                "role": m.get("role", "member"),
                "display_name": m.get("display_name"),
                "avatar_url": m.get("avatar_url"),
                "cargo": m.get("cargo"),
                "seccion": m.get("seccion"),
                "joined_at": m.get("joined_at"),
            })
        out.append({
            "group_id": g["group_id"],
            "name": g.get("name", ""),
            "icon": g.get("icon"),
            "allowed_secciones": g.get("allowed_secciones", []),
            "allowed_cargos": g.get("allowed_cargos", []),
            "is_section_based": g.get("is_section_based", False),
            "owner_wallet": g.get("owner_wallet"),
            "created_at": g.get("created_at"),
            "member_count": g.get("member_count", len(members)),
            "unread_count": 0,
            "members": members,
        })
    return out


@router.put("/community/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdateRequest, user: dict = Depends(verify_session)):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    member_role = _get_member_role(group, user)

    if member_role not in ("owner", "mod") and rl not in (3, 4):
        raise HTTPException(status_code=403, detail="Solo el owner, mods o admins pueden editar")

    update = {}
    if data.name is not None:
        update["name"] = data.name
    if data.icon is not None:
        update["icon"] = data.icon
    if data.allowed_secciones is not None:
        update["allowed_secciones"] = data.allowed_secciones
    if data.allowed_cargos is not None:
        update["allowed_cargos"] = data.allowed_cargos
    if data.is_section_based is not None:
        update["is_section_based"] = data.is_section_based
    
    if update:
        db.chat_groups.update_one({"group_id": group_id}, {"$set": update})
    return {"ok": True}


# ─── Member CRUD ──────────────────────────────────────────────────

@router.post("/community/groups/{group_id}/members")
async def add_group_member(group_id: str, data: GroupMemberRequest, user: dict = Depends(verify_session)):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    perms = _get_user_perms(user)
    inviter_section = (perms.get("seccion") or "").strip().lower()

    target_wallet = (data.wallet or "").lower()
    if not target_wallet:
        raise HTTPException(status_code=400, detail="Se requiere wallet del invitado")

    for m in (group.get("members") or []):
        if (m.get("wallet") or "").lower() == target_wallet:
            raise HTTPException(status_code=409, detail="Ya es miembro del grupo")

    rl = perms.get("role_level", -1)
    if rl not in (3, 4):
        try:
            target_perms = compute_permissions_for_identity(target_wallet)
            target_section = (target_perms.get("seccion") or "").strip().lower()
            if inviter_section and target_section and inviter_section != target_section:
                raise HTTPException(status_code=403, detail="Solo puedes invitar personas de tu sección")
        except Exception:
            pass

    now = get_chile_time()
    display_name = target_wallet
    avatar_url = None
    try:
        cu = db.community_users.find_one({"wallet": target_wallet})
        if cu:
            profile = cu.get("profile") or {}
            display_name = profile.get("name") or display_name
            avatar_url = profile.get("profile_image_url") or cu.get("profile_image_url")
    except Exception:
        pass

    member_doc = {
        "wallet": target_wallet,
        "privy_id": data.privy_id,
        "role": data.role if rl in (3, 4) else "member",
        "display_name": display_name,
        "avatar_url": avatar_url,
        "cargo": None,
        "seccion": None,
        "joined_at": now,
    }
    db.chat_groups.update_one(
        {"group_id": group_id},
        {"$push": {"members": member_doc}, "$inc": {"member_count": 1}}
    )

    await manager.broadcast_group(group_id, {"type": "member_joined", "member": member_doc})
    return {"ok": True}


@router.delete("/community/groups/{group_id}/members/{wallet}")
async def remove_group_member(group_id: str, wallet: str, user: dict = Depends(verify_session)):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    member_role = _get_member_role(group, user)

    ident = _user_identity(user)
    is_self = ident.get("wallet") == wallet.lower()

    if not is_self and member_role not in ("owner", "mod") and rl not in (3, 4):
        raise HTTPException(status_code=403, detail="Sin permisos para remover")

    target_wallet = wallet.lower()
    db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$pull": {"members": {"wallet": target_wallet}},
            "$inc": {"member_count": -1},
        }
    )

    await manager.broadcast_group(group_id, {"type": "member_left", "wallet": target_wallet})
    return {"ok": True}


@router.put("/community/groups/{group_id}/roles")
async def update_member_role(group_id: str, data: GroupMemberRequest, user: dict = Depends(verify_session)):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    member_role = _get_member_role(group, user)

    if member_role != "owner" and rl not in (3, 4):
        raise HTTPException(status_code=403, detail="Solo el owner o admin puede cambiar roles")

    target_wallet = (data.wallet or "").lower()
    db.chat_groups.update_one(
        {"group_id": group_id, "members.wallet": target_wallet},
        {"$set": {"members.$.role": data.role}}
    )
    return {"ok": True}


# ─── Group Messaging ──────────────────────────────────────────────

@router.get("/community/groups/{group_id}/messages")
async def group_messages(
    group_id: str, limit: int = 50, before: Optional[str] = None, user: dict = Depends(verify_session)
):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    q = {"group_id": group_id}
    if before:
        try:
            q["_id"] = {"$lt": ObjectId(before)}
        except Exception:
            pass

    limit = min(max(1, limit), 100)
    msgs = list(db.chat_group_messages.find(q).sort("_id", -1).limit(limit))
    msgs.reverse()

    return [_msg_to_out(m, group_id) for m in msgs]


@router.post("/community/groups/{group_id}/messages")
async def send_group_message(group_id: str, data: GroupMessageRequest, user: dict = Depends(verify_session)):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    perms = _get_user_perms(user)
    now = get_chile_time()
    sender = _enrich_sender(user, perms)

    mentions = list(data.mentions or [])
    if "@nonna" in data.text.lower() and "@nonna" not in mentions:
        mentions.append("@nonna")

    reply_preview = None
    if data.reply_to:
        try:
            parent = db.chat_group_messages.find_one({"_id": ObjectId(data.reply_to)})
            if parent:
                reply_preview = {
                    "text": (parent.get("text") or "")[:200],
                    "sender_name": parent.get("sender_name", ""),
                }
        except Exception:
            pass

    msg_doc = {
        "group_id": group_id,
        "text": data.text,
        "mentions": mentions,
        "reply_to": data.reply_to,
        "reply_preview": reply_preview,
        "reactions": {},
        "media_urls": data.media_urls or [],
        "payload": None,
        "created_at": now,
        **sender,
    }
    result = db.chat_group_messages.insert_one(msg_doc)
    msg_doc["_id"] = result.inserted_id

    out = _msg_to_out(msg_doc, group_id)
    await manager.broadcast_group(group_id, {"type": "message", **out})

    if "@nonna" in mentions:
        asyncio.create_task(_nonna_group_reply(group_id, group, data.text, sender))

    if "@all" in data.text.lower():
        rl = perms.get("role_level", -1)
        user_seccion = perms.get("seccion", "")
        allowed_secciones = group.get("allowed_secciones") or []
        is_authorized = rl in (3, 4, 5) or (user_seccion and any(user_seccion.lower() == s.strip().lower() for s in allowed_secciones))
        if is_authorized:
            from services.automation_engine import trigger_event
            asyncio.create_task(trigger_event(
                "community_announcement",
                "employees",
                {
                    "message": data.text,
                    "channel_name": group.get("name", group_id),
                    "sender_name": sender.get("sender_name", "Admin")
                }
            ))

    return {"ok": True, "id": str(result.inserted_id)}


@router.post("/community/groups/{group_id}/messages/{message_id}/react")
async def react_to_group_message(
    group_id: str, message_id: str, data: ReactionRequest, user: dict = Depends(verify_session)
):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro")

    ident = _user_identity(user)
    wallet = ident.get("wallet") or ident.get("privy_id") or "anon"
    emoji = data.emoji

    try:
        msg = db.chat_group_messages.find_one({"_id": ObjectId(message_id), "group_id": group_id})
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

    db.chat_group_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"reactions": reactions}}
    )

    await manager.broadcast_group(group_id, {
        "type": "reaction",
        "message_id": message_id,
        "emoji": emoji,
        "wallet": wallet,
        "action": action,
        "reactions": reactions,
    })
    return {"ok": True, "action": action}


@router.post("/community/groups/{group_id}/upload")
async def upload_group_media(group_id: str, file: UploadFile = File(...), user: dict = Depends(verify_session)):
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro")

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 25MB)")

    import io
    from utils.r2_upload import upload_to_r2
    ext = (file.filename or "file").rsplit(".", 1)[-1].lower() if file.filename else "bin"
    key = f"community/groups/{group_id}/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "application/octet-stream"

    url = upload_to_r2(io.BytesIO(content), key, content_type=content_type, public=True)
    return {"ok": True, "url": url, "content_type": content_type, "size": len(content)}


# ─── Direct Messages ──────────────────────────────────────────────

@router.get("/community/dm/conversations")
async def dm_conversations(user: dict = Depends(verify_session)):
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet")
    return get_dm_conversations(wallet)


@router.get("/community/dm/messages")
async def list_dm_messages(peer: str, limit: int = 50, before: Optional[str] = None, user: dict = Depends(verify_session)):
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet")
    return get_dm_messages(wallet, peer, limit, before)


@router.post("/community/dm/send")
async def dm_send(data: DmSendRequest, user: dict = Depends(verify_session)):
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet")

    peer_wallet = data.peer.lower()
    if peer_wallet == wallet:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    perms = _get_user_perms(user)
    sender = _enrich_sender(user, perms)
    peer_name = resolve_peer_name(peer_wallet)

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

    out_msg = {
        "type": "dm_message",
        "id": str(result.inserted_id),
        "conv_key": conv_key,
        "sender_wallet": wallet,
        "sender_name": sender.get("sender_name", wallet),
        "peer_wallet": peer_wallet,
        "peer_name": peer_name,
        "text": data.text,
        "created_at": now.isoformat() if hasattr(now, 'isoformat') else str(now),
    }
    await manager.broadcast_dm(conv_key, out_msg)

    # ─── Enviar Push Notification al peer ───
    try:
        from apis.marketing.notifications import send_fcm_notification
        api_config = db.notification_api_configs.find_one({"service": "firebase"})
        if api_config:
            wallet_regex = {"$regex": f"^{peer_wallet}$", "$options": "i"}
            # Buscamos tokens del peer receptor
            tokens = list(db.user_notification_tokens.find({"wallet": wallet_regex, "permissions_granted": True}).sort("_id", -1))
            if tokens:
                sender_display_name = sender.get("sender_name", wallet)
                title = f"Nuevo mensaje de {sender_display_name}"
                body_text = data.text[:100] + ("..." if len(data.text) > 100 else "")
                for t_doc in tokens:
                    try:
                        await send_fcm_notification(
                            api_config=api_config,
                            title=title,
                            body=body_text,
                            image_url=None,
                            target_type="user",
                            target_value=t_doc["token"]
                        )
                        logger.info(f"Push DM enviado exitosamente a {peer_wallet} (dispositivo {t_doc['token'][:10]}...)")
                    except Exception as e:
                        logger.warning(f"Fallo al enviar push DM al token {t_doc['token']}: {e}")
                        err_str = str(e).lower()
                        if "senderid mismatch" in err_str or "notregistered" in err_str or "unregistered" in err_str or "invalid registration" in err_str:
                            db.user_notification_tokens.delete_one({"_id": t_doc["_id"]})
    except Exception as e:
        logger.error(f"Error general en el proceso de notificaciones Push para DMs: {e}")

    return {"ok": True, "id": str(result.inserted_id)}


# ─── Community Directory ──────────────────────────────────────────

@router.get("/community/catalogs")
async def community_catalogs(user: dict = Depends(verify_session)):
    return get_community_catalogs()


@router.get("/community/members")
async def list_community_members(
    seccion: Optional[str] = None, cargo: Optional[str] = None, q: Optional[str] = None, user: dict = Depends(verify_session)
):
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 3:
        raise HTTPException(status_code=403, detail="No access")
    return {"ok": True, "members": get_community_members(seccion, cargo, q)}


@router.get("/community/presence")
async def get_presence_rest(user: dict = Depends(verify_session)):
    all_p = manager.get_all_presence()
    presence_map = {(p.get("wallet") or "").lower(): p for p in all_p if p.get("wallet")}
    return get_community_presence(presence_map)


# ─── Section Permissions ──────────────────────────────────────────

class SectionPermsUpdate(BaseModel):
    can_create_groups: Optional[bool] = None
    can_create_channels: Optional[bool] = None
    can_post_announcements: Optional[bool] = None
    can_upload_media: Optional[bool] = None
    can_invite_members: Optional[bool] = None
    can_pin_messages: Optional[bool] = None
    max_groups: Optional[int] = None
    color: Optional[str] = None


@router.get("/community/section-perms")
async def list_section_perms_route(user: dict = Depends(verify_session)):
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 3:
        raise HTTPException(status_code=403, detail="No access")
    return {"ok": True, "sections": get_all_section_perms()}


@router.put("/community/section-perms/{seccion}")
async def update_section_perms_route(seccion: str, data: SectionPermsUpdate, user: dict = Depends(verify_session)):
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 3:
        raise HTTPException(status_code=403, detail="No access")
    
    admin_wallet = (user.get("wallet") or "").lower()
    
    updated = update_section_permissions(seccion, data.model_dump(exclude_unset=True), admin_wallet)
    if not updated:
        return {"ok": True, "message": "No changes"}
    return {"ok": True, "seccion": seccion}


# ─── WebSockets ───────────────────────────────────────────────────

@router.websocket("/ws/group/{group_id}")
async def ws_group(websocket: WebSocket, group_id: str):
    await manager.connect_group(group_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "typing":
                await manager.broadcast_group(group_id, {
                    "type": "typing",
                    "wallet": data.get("wallet"),
                    "name": data.get("name"),
                    "state": bool(data.get("state", True)),
                })
    except WebSocketDisconnect:
        await manager.disconnect_group(group_id, websocket)


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


@router.websocket("/ws/dm/{wallet}")
async def ws_dm(websocket: WebSocket, wallet: str):
    wallet = wallet.lower()
    conv_key = None
    try:
        await websocket.accept()
        init_data = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        peer = (init_data.get("peer") or "").lower()
        if not peer:
            await websocket.close(1008, "Missing peer")
            return
        conv_key = _dm_conv_key(wallet, peer)

        async with manager._lock:
            if conv_key not in manager.dm_clients:
                manager.dm_clients[conv_key] = set()
            manager.dm_clients[conv_key].add(websocket)

        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "typing":
                await manager.broadcast_dm(conv_key, {
                    "type": "typing",
                    "wallet": wallet,
                    "name": data.get("name"),
                    "state": bool(data.get("state", True)),
                })
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:
        logger.error(f"DM WS error: {e}")
    finally:
        if conv_key:
            await manager.disconnect_dm(conv_key, websocket)


@router.websocket("/ws/community/presence")
async def ws_presence(websocket: WebSocket):
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
