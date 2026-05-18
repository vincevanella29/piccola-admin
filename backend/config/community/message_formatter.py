import logging
import json
import asyncio
from datetime import datetime
from typing import Optional
from utils.web3mongo import db

logger = logging.getLogger(__name__)

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


async def _nonna_group_reply(group_id: str, group: dict, text: str, sender: dict):
    """Generate an AI reply in group context when @nonna is mentioned."""
    try:
        from utils.bot.engine import chat_complete
        from utils.chat.realtime import manager
        from config.roles.access import compute_permissions_for_identity

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

        for m in recent:
            role = "assistant" if (m.get("sender_wallet") == "nonna" or m.get("sender_name") == "Nonna") else "user"
            msg_text = m.get("text", "")
            if role == "user":
                msg_sender = m.get("sender_name", "Usuario")
                msg_text = f"[{msg_sender}]: {msg_text}"
            messages.append({"role": role, "content": msg_text})

        # Add the final trigger message if not already there
        if not messages or messages[-1]["content"] != text:
            messages.append({"role": "user", "content": f"[Usuario actual]: {text}"})

        # Calculate max role level among members to prevent data leaks
        max_role_level = 1
        for m in group.get("members", []):
            m_wallet = m.get("wallet")
            if m_wallet:
                try:
                    m_perms = await asyncio.to_thread(compute_permissions_for_identity, m_wallet)
                    m_rl = m_perms.get("role_level", -1)
                    if m_rl and 1 <= m_rl <= 7:
                        max_role_level = max(max_role_level, m_rl)
                    else:
                        max_role_level = 7
                except Exception:
                    max_role_level = 7
        
        # In groups with no members (shouldn't happen) or if max_role_level is somehow 1
        # we still want to be safe if the group has no restrictions.
        if not allowed_secciones and not allowed_cargos and not group.get("is_section_based"):
            max_role_level = 7

        ctx = {
            "wallet": sender.get("sender_wallet"),
            "privy_id": sender.get("sender_privy_id"),
            "max_group_role_level": max_role_level
        }
        
        system_prompt += f"\n\nUser context (JSON):\n{json.dumps(ctx)}"

        # Ensure system prompt is first
        messages.insert(0, {"role": "system", "content": system_prompt})

        reply = await chat_complete(messages)
        
        reply_text, reply_payload = _format_bot_reply(reply)

        from utils.time_utils import get_chile_time
        now = get_chile_time()

        bot_doc = {
            "group_id": group_id,
            "text": reply_text,
            "payload": reply_payload,
            "sender_wallet": "nonna",
            "sender_privy_id": None,
            "sender_name": "Nonna (AI)",
            "sender_avatar_url": None,
            "sender_cargo": "Asistente AI",
            "sender_seccion": "Central",
            "mentions": [],
            "reply_to": None,
            "reply_preview": None,
            "reactions": {},
            "media_urls": [],
            "created_at": now,
        }
        result = db.chat_group_messages.insert_one(bot_doc)
        bot_doc["_id"] = result.inserted_id

        out = _msg_to_out(bot_doc, group_id)
        await manager.broadcast_group(group_id, {"type": "message", **out})

    except Exception as e:
        logger.error(f"Error in group @nonna reply: {e}", exc_info=True)


async def _nonna_dm_reply(conv_key: str, text: str, sender: dict):
    """Generate an AI reply in a Direct Message context with Nonna."""
    try:
        from utils.bot.engine import chat_complete
        from utils.chat.realtime import manager
        from config.roles.access import compute_permissions_for_identity

        recent = list(
            db.chat_dm_messages.find({"conv_key": conv_key})
            .sort("created_at", -1)
            .limit(8)
        )
        recent.reverse()

        messages = []
        system_prompt = (
            "Estás en un mensaje directo (DM) con un empleado de Piccola Italia. "
            "Eres Nonna, la asistente de IA experta. Responde de forma concisa, amable y en español chileno. "
            "Tu objetivo es asistir al usuario con cualquier consulta relacionada al ecosistema."
        )

        for m in recent:
            role = "assistant" if m.get("sender_wallet") == "nonna" else "user"
            msg_text = m.get("text", "")
            messages.append({"role": role, "content": msg_text})

        # Add the final trigger message if not already there
        if not messages or messages[-1]["content"] != text:
            messages.append({"role": "user", "content": text})

        sender_wallet = sender.get("sender_wallet")
        max_role_level = 7
        if sender_wallet:
            try:
                m_perms = await asyncio.to_thread(compute_permissions_for_identity, sender_wallet)
                m_rl = m_perms.get("role_level", -1)
                if m_rl and 1 <= m_rl <= 7:
                    max_role_level = m_rl
            except Exception:
                pass

        ctx = {
            "wallet": sender_wallet,
            "privy_id": sender.get("sender_privy_id"),
            "max_group_role_level": max_role_level
        }
        
        system_prompt += f"\n\nUser context (JSON):\n{json.dumps(ctx)}"

        messages.insert(0, {"role": "system", "content": system_prompt})

        reply = await chat_complete(messages)
        
        reply_text, reply_payload = _format_bot_reply(reply)

        from utils.time_utils import get_chile_time
        now = get_chile_time()

        bot_doc = {
            "conv_key": conv_key,
            "sender_wallet": "nonna",
            "sender_name": "Nonna (AI)",
            "peer_wallet": sender_wallet,
            "peer_name": sender.get("sender_name", sender_wallet),
            "text": reply_text,
            "payload": reply_payload,
            "created_at": now,
        }
        result = db.chat_dm_messages.insert_one(bot_doc)

        out_msg = {
            "type": "dm_message",
            "id": str(result.inserted_id),
            "conv_key": conv_key,
            "sender_wallet": "nonna",
            "sender_name": "Nonna (AI)",
            "peer_wallet": sender_wallet,
            "peer_name": sender.get("sender_name", sender_wallet),
            "text": reply_text,
            "payload": reply_payload,
            "created_at": now.isoformat() if hasattr(now, 'isoformat') else str(now),
        }
        await manager.broadcast_dm(conv_key, out_msg)

    except Exception as e:
        logger.error(f"Error in DM nonna reply: {e}", exc_info=True)
