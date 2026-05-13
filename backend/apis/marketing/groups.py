"""
Community Groups API — Private group chats.

Groups can be section-based (auto-join for matching section workers)
or manually managed. Any active worker can create groups.
@nonna mentions work with group context.
"""
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from bson import ObjectId

from utils.auth.session import verify_session
from utils.web3mongo import db
from utils.chat.realtime import manager
from utils.chat.schemas import (
    GroupCreateRequest,
    GroupUpdateRequest,
    GroupMemberRequest,
    GroupMessageRequest,
    GroupOut,
    GroupMemberOut,
    GroupMessageOut,
    ReactionRequest,
)
from utils.time_utils import get_chile_time
from config.roles.access import compute_permissions_for_identity

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

def _user_identity(user: dict) -> dict:
    wallet = user.get("wallet")
    sub = user.get("sub")
    if not wallet and sub:
        # Fallback to rut_... if they are an employee without wallet
        eu = db.empleados_usuarios.find_one({"sub": sub})
        if eu and eu.get("rut"):
            wallet = f"rut_{eu['rut']}"
            print(f"[_user_identity] Solved missing wallet via sub {sub} -> {wallet}", flush=True)
    print(f"[_user_identity] Result: wallet={wallet}, privy_id={sub}", flush=True)
    return {"wallet": wallet.lower() if wallet else None, "privy_id": sub}


def _get_user_perms(user: dict) -> dict:
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


def _is_group_member(group: dict, user: dict) -> bool:
    """Check if user is a member of the group (or auto-joined via section)."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    privy_id = ident.get("privy_id")

    # Explicit member check
    for m in (group.get("members") or []):
        if wallet and (m.get("wallet") or "").lower() == wallet:
            return True
        if privy_id and m.get("privy_id") == privy_id:
            return True

    # Section-based auto-join
    if group.get("is_section_based"):
        perms = _get_user_perms(user)
        user_section = (perms.get("seccion") or "").strip().lower()
        user_cargo = (perms.get("cargo") or "").strip().lower()
        is_active = perms.get("is_active_worker", False)
        
        allowed_secciones = [s.strip().lower() for s in group.get("allowed_secciones") or []]
        allowed_cargos = [c.strip().lower() for c in group.get("allowed_cargos") or []]

        if is_active and (user_section in allowed_secciones or user_cargo in allowed_cargos):
            # Auto-add to members list
            _auto_add_member(group, user, perms)
            return True

    return False


def _auto_add_member(group: dict, user: dict, perms: dict):
    """Auto-add a user to a group's members list (section-based join)."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        return

    # Check if already in members
    for m in (group.get("members") or []):
        if (m.get("wallet") or "").lower() == wallet:
            return

    now = get_chile_time()
    display_name = wallet
    avatar_url = None
    try:
        if wallet.startswith("rut_"):
            rut_val = wallet.replace("rut_", "")
            try:
                rut_val = int(rut_val)
            except:
                pass
            tv = db.trabajadores_vpn.find_one({"rut": rut_val})
            if tv:
                nombres = (tv.get("nombres") or "").strip()
                ap_pat = (tv.get("apellidopaterno") or "").strip()
                display_name = f"{nombres} {ap_pat}".strip() or display_name
                avatar_url = tv.get("profile_image_url")
        else:
            # Check empleados_usuarios for wallet first
            eu = db.empleados_usuarios.find_one({"wallet": wallet})
            if eu and eu.get("rut"):
                tv = db.trabajadores_vpn.find_one({"rut": eu["rut"]})
                if tv:
                    nombres = (tv.get("nombres") or "").strip()
                    ap_pat = (tv.get("apellidopaterno") or "").strip()
                    display_name = f"{nombres} {ap_pat}".strip() or display_name
                    avatar_url = tv.get("profile_image_url")
            
            if display_name == wallet:
                cu = db.community_users.find_one({"wallet": wallet})
                if cu:
                    profile = cu.get("profile") or {}
                    display_name = profile.get("name") or display_name
                    avatar_url = profile.get("profile_image_url") or cu.get("profile_image_url")
        print(f"[_auto_add_member] Resolved profile for {wallet}: name={display_name}, cargo={perms.get('cargo')}, seccion={perms.get('seccion')}", flush=True)
    except Exception as e:
        logger.error(f"Error resolving profile in auto_add: {e}")

    member_doc = {
        "wallet": wallet,
        "privy_id": ident.get("privy_id"),
        "role": "member",
        "display_name": display_name,
        "avatar_url": avatar_url,
        "cargo": perms.get("cargo"),
        "seccion": perms.get("seccion"),
        "joined_at": now,
    }
    db.chat_groups.update_one(
        {"group_id": group["group_id"]},
        {"$push": {"members": member_doc}, "$inc": {"member_count": 1}}
    )


def _get_member_role(group: dict, user: dict) -> Optional[str]:
    """Get the user's role within a group."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    for m in (group.get("members") or []):
        if wallet and (m.get("wallet") or "").lower() == wallet:
            return m.get("role", "member")
    return None


def _enrich_sender(user: dict, perms: dict) -> dict:
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    display_name = wallet or "User"
    avatar_url = None
    try:
        if wallet:
            if wallet.startswith("rut_"):
                rut_val = wallet.replace("rut_", "")
                try:
                    rut_val = int(rut_val)
                except:
                    pass
                tv = db.trabajadores_vpn.find_one({"rut": rut_val})
                if tv:
                    nombres = (tv.get("nombres") or "").strip()
                    ap_pat = (tv.get("apellidopaterno") or "").strip()
                    display_name = f"{nombres} {ap_pat}".strip() or display_name
                    avatar_url = tv.get("profile_image_url")
            else:
                eu = db.empleados_usuarios.find_one({"wallet": wallet})
                if eu and eu.get("rut"):
                    tv = db.trabajadores_vpn.find_one({"rut": eu["rut"]})
                    if tv:
                        nombres = (tv.get("nombres") or "").strip()
                        ap_pat = (tv.get("apellidopaterno") or "").strip()
                        display_name = f"{nombres} {ap_pat}".strip() or display_name
                        avatar_url = tv.get("profile_image_url")
                
                if display_name == wallet:
                    cu = db.community_users.find_one({"wallet": wallet})
                    if cu:
                        profile = cu.get("profile") or {}
                        display_name = profile.get("name") or display_name
                        avatar_url = profile.get("profile_image_url") or cu.get("profile_image_url")
        
        print(f"[_enrich_sender] Resolved for {wallet}: name={display_name}, cargo={perms.get('cargo')}", flush=True)
    except Exception as e:
        logger.error(f"Error enriching sender: {e}")
    return {
        "sender_wallet": wallet,
        "sender_privy_id": ident.get("privy_id"),
        "sender_name": display_name,
        "sender_avatar_url": avatar_url,
        "sender_cargo": perms.get("cargo"),
        "sender_seccion": perms.get("seccion"),
    }


def _msg_to_out(m: dict, group_id: str) -> dict:
    return {
        "id": str(m.get("_id", "")),
        "group_id": m.get("group_id", group_id),
        "sender_wallet": m.get("sender_wallet"),
        "sender_privy_id": m.get("sender_privy_id"),
        "sender_name": m.get("sender_name"),
        "sender_avatar_url": m.get("sender_avatar_url"),
        "sender_cargo": m.get("sender_cargo"),
        "sender_seccion": m.get("sender_seccion"),
        "text": m.get("text", ""),
        "payload": m.get("payload"),
        "media_urls": m.get("media_urls") or [],
        "mentions": m.get("mentions") or [],
        "reply_to": m.get("reply_to"),
        "reply_preview": m.get("reply_preview"),
        "reactions": m.get("reactions") or {},
        "created_at": m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at"),
    }


# ─── CRUD ─────────────────────────────────────────────────────────

@router.post("/community/groups")
async def create_group(data: GroupCreateRequest, user: dict = Depends(verify_session)):
    """Create a new group. Any active worker can create groups."""
    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    if rl is None or rl < 0:
        raise HTTPException(status_code=403, detail="Necesitas un rol activo para crear grupos")

    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="Se requiere wallet")

    # For section-based groups, only allow if user is in one of those sections/cargos OR is admin
    if data.is_section_based and (data.allowed_secciones or data.allowed_cargos):
        user_section = (perms.get("seccion") or "").strip().lower()
        user_cargo = (perms.get("cargo") or "").strip().lower()
        allowed_sec = [s.strip().lower() for s in data.allowed_secciones]
        allowed_car = [c.strip().lower() for c in data.allowed_cargos]
        if rl not in (3, 4) and user_section not in allowed_sec and user_cargo not in allowed_car:
            raise HTTPException(status_code=403, detail="Solo puedes crear grupos con filtros de tu propia sección o cargo")

    group_id = uuid.uuid4().hex[:12]
    now = get_chile_time()

    # Get display info
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
    logger.info(f"Group created: {group_id} by {wallet}")
    return {"ok": True, "group_id": group_id}


@router.get("/community/groups", response_model=List[GroupOut])
async def list_groups(user: dict = Depends(verify_session)):
    """List groups the user belongs to (explicit + section-based)."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    privy_id = ident.get("privy_id")
    perms = _get_user_perms(user)

    # Query: explicit member OR section-based auto-join
    ors = []
    if wallet:
        ors.append({"members.wallet": wallet})
    if privy_id:
        ors.append({"members.privy_id": privy_id})

    # Section-based groups
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
        
    print(f"\\n\\n========== DEBUG GRUPOS ==========")
    print(f"[_get_groups] Returned {len(out)} groups. Config & Members:")
    for g in out:
        print(f"  Group '{g['name']}' ({g['group_id']}) - is_section_based={g['is_section_based']}, allowed_secciones={g['allowed_secciones']}, allowed_cargos={g['allowed_cargos']}")
        for m in g['members']:
            print(f"    -> Member: {m['display_name']} | wallet={m['wallet']} | role={m['role']} | cargo={m['cargo']} | sec={m['seccion']}")
    print(f"==================================\\n\\n", flush=True)
            
    return out


@router.put("/community/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdateRequest, user: dict = Depends(verify_session)):
    """Update group settings. Owner or admin only."""
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


@router.post("/community/groups/{group_id}/members")
async def add_group_member(group_id: str, data: GroupMemberRequest, user: dict = Depends(verify_session)):
    """Add a member to a group. Owner/mod/admin only. Members can only invite from their section."""
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    perms = _get_user_perms(user)
    inviter_section = (perms.get("seccion") or "").strip().lower()

    # Get target user's info
    target_wallet = (data.wallet or "").lower()
    if not target_wallet:
        raise HTTPException(status_code=400, detail="Se requiere wallet del invitado")

    # Check if already member
    for m in (group.get("members") or []):
        if (m.get("wallet") or "").lower() == target_wallet:
            raise HTTPException(status_code=409, detail="Ya es miembro del grupo")

    # Check inviter can invite (same section or admin)
    rl = perms.get("role_level", -1)
    if rl not in (3, 4):
        # Non-admins can only invite from their own section
        try:
            target_perms = compute_permissions_for_identity(target_wallet)
            target_section = (target_perms.get("seccion") or "").strip().lower()
            if inviter_section and target_section and inviter_section != target_section:
                raise HTTPException(status_code=403, detail="Solo puedes invitar personas de tu sección")
        except HTTPException:
            raise
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
        "role": data.role if rl in (3, 4) else "member",  # Only admins can set role
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

    await manager.broadcast_group(group_id, {
        "type": "member_joined",
        "member": member_doc,
    })
    return {"ok": True}


@router.delete("/community/groups/{group_id}/members/{wallet}")
async def remove_group_member(group_id: str, wallet: str, user: dict = Depends(verify_session)):
    """Remove a member from a group."""
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    member_role = _get_member_role(group, user)

    # Can remove if: admin, owner, or removing self
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

    await manager.broadcast_group(group_id, {
        "type": "member_left",
        "wallet": target_wallet,
    })
    return {"ok": True}


@router.put("/community/groups/{group_id}/roles")
async def update_member_role(group_id: str, data: GroupMemberRequest, user: dict = Depends(verify_session)):
    """Change a member's role within the group. Owner/admin only."""
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    perms = _get_user_perms(user)
    rl = perms.get("role_level", -1)
    member_role = _get_member_role(group, user)

    if member_role != "owner" and rl not in (3, 4):
        raise HTTPException(status_code=403, detail="Solo el owner o admin puede cambiar roles")

    target_wallet = (data.wallet or "").lower()
    if not target_wallet:
        raise HTTPException(status_code=400, detail="Se requiere wallet")

    db.chat_groups.update_one(
        {"group_id": group_id, "members.wallet": target_wallet},
        {"$set": {"members.$.role": data.role}}
    )
    return {"ok": True}


# ─── Messaging ────────────────────────────────────────────────────

@router.get("/community/groups/{group_id}/messages")
async def group_messages(
    group_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    """Get group message history."""
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
    msgs = list(
        db.chat_group_messages.find(q)
        .sort("_id", -1)
        .limit(limit)
    )
    msgs.reverse()

    return [_msg_to_out(m, group_id) for m in msgs]


@router.post("/community/groups/{group_id}/messages")
async def send_group_message(group_id: str, data: GroupMessageRequest, user: dict = Depends(verify_session)):
    """Send a message to a group."""
    group = db.chat_groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not _is_group_member(group, user):
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    perms = _get_user_perms(user)
    now = get_chile_time()
    sender = _enrich_sender(user, perms)

    # Parse @nonna
    mentions = list(data.mentions or [])
    if "@nonna" in data.text.lower() and "@nonna" not in mentions:
        mentions.append("@nonna")

    # Reply preview
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
        "media_urls": [],
        "payload": None,
        "created_at": now,
        **sender,
    }
    result = db.chat_group_messages.insert_one(msg_doc)
    msg_doc["_id"] = result.inserted_id

    out = _msg_to_out(msg_doc, group_id)
    await manager.broadcast_group(group_id, {"type": "message", **out})

    # Trigger @nonna if mentioned
    if "@nonna" in mentions:
        section = group.get("section_filter")
        asyncio.create_task(_nonna_group_reply(group_id, group, data.text, perms))

    return {"ok": True, "id": str(result.inserted_id)}


@router.post("/community/groups/{group_id}/messages/{message_id}/react")
async def react_to_group_message(
    group_id: str, message_id: str, data: ReactionRequest, user: dict = Depends(verify_session)
):
    """Toggle a reaction on a group message."""
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


# ─── Media Upload ─────────────────────────────────────────────────

@router.post("/community/groups/{group_id}/upload")
async def upload_group_media(
    group_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(verify_session),
):
    """Upload media to a group."""
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


# ─── @Nonna Bot Reply in Group Context ───────────────────────────

async def _nonna_group_reply(group_id: str, group: dict, text: str, user_perms: dict):
    """Generate an AI reply in group context when @nonna is mentioned."""
    try:
        from utils.bot.engine import chat_complete

        recent = list(
            db.chat_group_messages.find({"group_id": group_id})
            .sort("created_at", -1)
            .limit(8)
        )
        recent.reverse()

        messages = []
        allowed_secciones = group.get("allowed_secciones", [])
        allowed_cargos = group.get("allowed_cargos", [])
        group_name = group.get("name", group_id)

        system_prompt = (
            f"Estás en el grupo '{group_name}' de Piccola Italia. "
        )
        if allowed_secciones or allowed_cargos:
            system_prompt += (
                f"Este grupo incluye secciones {allowed_secciones} y cargos {allowed_cargos}. "
                f"PRIORIZA respuestas relacionadas a ellos. "
            )
        system_prompt += (
            "Los usuarios te mencionan con @nonna. Responde de forma concisa, amable y en español chileno."
        )

        messages.append({"role": "system", "content": system_prompt})

        wallet = user_perms.get("wallet") or ""
        ctx = {
            "role_level": user_perms.get("role_level"),
            "cargo": user_perms.get("cargo"),
            "seccion": user_perms.get("seccion"),
            "wallet": wallet,
            "group_id": group_id,
            "allowed_secciones": allowed_secciones,
            "allowed_cargos": allowed_cargos,
        }
        messages.append({
            "role": "system",
            "content": f"User context (JSON): {json.dumps(ctx, ensure_ascii=False, default=str)}"
        })

        for m in recent:
            role = "user"
            if m.get("sender_name") == "La Nonna 👵" or m.get("sender_wallet") is None:
                role = "assistant"
            messages.append({"role": role, "content": m.get("text", "")})

        try:
            reply = await asyncio.wait_for(chat_complete(messages), timeout=30)
        except asyncio.TimeoutError:
            reply = "Estoy un poco ocupada, intentemos de nuevo 👵"

        reply_text, payload = _format_bot_reply(reply)

        now = get_chile_time()
        bot_msg = {
            "group_id": group_id,
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
            "created_at": now,
        }
        result = db.chat_group_messages.insert_one(bot_msg)
        bot_msg["_id"] = result.inserted_id

        out = _msg_to_out(bot_msg, group_id)
        await manager.broadcast_group(group_id, {"type": "message", **out})

    except Exception as e:
        logger.error(f"@nonna group reply error for {group_id}: {e}")


# ─── WebSocket ────────────────────────────────────────────────────

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
