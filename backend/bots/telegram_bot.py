import os
import logging
import threading
from typing import Optional, List, Union
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json

import httpx
import asyncio
from pymongo.collection import Collection
from dotenv import load_dotenv
from utils.web3mongo import db

# Telegram bot (async) - python-telegram-bot v21
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters, Defaults
from telegram.constants import ParseMode
from telegram.error import RetryAfter, TimedOut, NetworkError

logger = logging.getLogger(__name__)

try:
    load_dotenv()
except Exception:
    pass

XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY = os.getenv("XAI_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_LINK_URL_BASE = os.getenv("TELEGRAM_LINK_URL_BASE", "http://localhost:5173/")

# Preferir import del paquete; fallback relativo si corre standalone
try:
    from bots.utils.productos.productos import handle_productos
    from bots.utils.consumos.consumos import handle_consumos
    from bots.utils.consumos import consumos_spec as _consumos_spec  # noqa: F401
    from bots.utils.common.common import ask_grok, grok_route_intent, INTENT_PRIORITY, INTENTS
    from bots.utils.productos.menus import handle_menus
    from bots.utils.movimientos.ventas import handle_ventas
    from bots.utils.movimientos.ventas_hora import handle_ventas_hora
    from bots.utils.movimientos.gastos import handle_gastos
    from bots.utils.sucursales.locations import handle_locations
    from bots.utils.movimientos.sueldos import handle_sueldos
    from bots.utils.common.filters import grok_filters
    # Register FilterSpecs for intents (side-effect imports)
    from bots.utils.movimientos import gastos_spec as _gastos_spec  # noqa: F401
    from bots.utils.movimientos import ventas_spec as _ventas_spec  # noqa: F401
    from bots.utils.movimientos import ventas_hora_spec as _ventas_hora_spec  # noqa: F401
    from bots.utils.movimientos import sueldos_spec as _sueldos_spec  # noqa: F401
    from bots.utils.productos import menus_spec as _menus_spec  # noqa: F401
    from bots.utils.productos import productos_spec as _productos_spec  # noqa: F401
    from bots.utils.sucursales import locations_spec as _locations_spec  # noqa: F401
except Exception:
    from .utils.productos.productos import handle_productos
    from .utils.common.common import ask_grok, grok_route_intent, INTENT_PRIORITY, INTENTS
    from .utils.productos.menus import handle_menus
    from .utils.movimientos.ventas import handle_ventas
    from .utils.movimientos.ventas_hora import handle_ventas_hora
    from .utils.movimientos.gastos import handle_gastos
    from .utils.sucursales.locations import handle_locations
    from .utils.movimientos.sueldos import handle_sueldos
    from .utils.common.filters import grok_filters
    # Register FilterSpecs for intents (side-effect imports)
    from .utils.movimientos import gastos_spec as _gastos_spec  # noqa: F401
    from .utils.movimientos import ventas_spec as _ventas_spec  # noqa: F401
    from .utils.movimientos import ventas_hora_spec as _ventas_hora_spec  # noqa: F401
    from .utils.movimientos import sueldos_spec as _sueldos_spec  # noqa: F401
    from .utils.productos import menus_spec as _menus_spec  # noqa: F401
    from .utils.productos import productos_spec as _productos_spec  # noqa: F401
    from .utils.sucursales import locations_spec as _locations_spec  # noqa: F401


# Escape helper: keep below imports, before runtime logic
def _escape_md(text: str) -> str:
    """Escape Telegram Markdown special characters to avoid entity parse errors.
    Applies to dynamically generated content. Keeps semantics simple by escaping broadly.
    """
    if not isinstance(text, str):
        text = str(text)
    # Escape characters that frequently break Markdown parsing
    for ch in ("_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"):
        text = text.replace(ch, f"\\{ch}")
    return text

# Centralized accepted intents from common
ACCEPTED_INTENTS = {i.get("key") for i in INTENTS}

# Conversation logging collection and indexes
TELEGRAM_MSGS = db["telegram_messages"]
try:
    TELEGRAM_MSGS.create_index([("chat_id", 1), ("message.id", 1)], unique=True, background=True, name="chat_msg_unique")
    TELEGRAM_MSGS.create_index([("user.tg_user_id", 1)], background=True, name="idx_user")
    TELEGRAM_MSGS.create_index([("wallet", 1)], background=True, name="idx_wallet")
    TELEGRAM_MSGS.create_index([("ts", -1)], background=True, name="idx_ts_desc")
    TELEGRAM_MSGS.create_index([("corr_id", 1), ("ts", -1)], background=True, name="idx_corr_ts")
except Exception as _e_idx:
    logger.warning(f"[telegram_messages] index creation warning: {_e_idx}")


def _safe_user_from_update(update: Update) -> dict:
    u = update.effective_user
    return {
        "tg_user_id": getattr(u, "id", None),
        "username": getattr(u, "username", None),
        "first_name": getattr(u, "first_name", None),
        "last_name": getattr(u, "last_name", None),
        "language_code": getattr(u, "language_code", None),
        "is_bot": getattr(u, "is_bot", None),
    }


def _safe_chat_from_update(update: Update) -> dict:
    c = update.effective_chat
    return {
        "tg_chat_id": getattr(c, "id", None),
        "type": getattr(c, "type", None),
        "title": getattr(c, "title", None),
        "username": getattr(c, "username", None),
    }


def _resolve_wallet_for_update(update: Update) -> Optional[str]:
    try:
        u = update.effective_user
        tg_id = u.id if u else None
        if not tg_id:
            return None
        link = _get_link_info(tg_id)
        if not link or link.get("expired"):
            return None
        return link.get("wallet")
    except Exception:
        return None


async def _log_user_message(update: Update, text: str, meta: Optional[dict] = None, corr_id: Optional[str] = None):
    try:
        msg = update.message
        chat_id = getattr(update.effective_chat, "id", None)
        # correlation id: prefer explicit, else chat_id:message_id
        corr = corr_id or (f"{chat_id}:{getattr(msg, 'message_id', None)}")
        doc = {
            "ts": datetime.utcnow(),
            "chat_id": chat_id,
            "user": _safe_user_from_update(update),
            "chat": _safe_chat_from_update(update),
            "wallet": _resolve_wallet_for_update(update),
            "corr_id": corr,
            "direction": "in",  # user -> bot
            "message": {
                "id": getattr(msg, "message_id", None),
                "text": text,
                "type": "text",
            },
            "meta": {**(meta or {}), "corr_id": corr},
        }
        TELEGRAM_MSGS.update_one(
            {"chat_id": doc["chat_id"], "message.id": doc["message"]["id"]},
            {"$set": doc},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"[_log_user_message] Failed to log user message: {e}")


async def _reply_and_log(update: Update, context: ContextTypes.DEFAULT_TYPE, content: Union[str, List[Union[str, dict]], dict], meta: Optional[dict] = None):
    """Send a reply (text chunks and/or media) and log it.
    Supported content forms:
      - str
      - [str, ...]
      - {"type":"photo", "url": str, "caption": str}
      - [str | {media dict}, ...]
    """
    try:
        # Normalize to list of items
        items: List[Union[str, dict]]
        if isinstance(content, (str,)):
            items = [content]
        elif isinstance(content, dict):
            items = [content]
        else:
            items = content  # assumed list

        last_sent = None
        logged_texts: List[str] = []  # kept for backward compatibility (not used for logging per-message)
        sent_msgs: List[tuple] = []  # (telegram.Message, text_or_caption, type: 'text'|'photo')

        async def _safe_send_text(text: str):
            nonlocal last_sent
            attempts = 0
            while True:
                try:
                    # Send as plain text to avoid Markdown parse issues per message
                    last_sent = await update.message.reply_text(text, parse_mode=None)
                    return last_sent
                except RetryAfter as e:
                    await asyncio.sleep(getattr(e, "retry_after", 2) or 2)
                except TimedOut:
                    attempts += 1
                    if attempts >= 3:
                        raise
                    await asyncio.sleep(1.5 * attempts)
                except NetworkError:
                    attempts += 1
                    if attempts >= 3:
                        raise
                    await asyncio.sleep(1.5 * attempts)

        async def _safe_send_photo(url: str, caption: str = ""):
            nonlocal last_sent
            attempts = 0
            while True:
                try:
                    # Send caption as plain text (no Markdown)
                    last_sent = await update.message.reply_photo(photo=url, caption=(caption or ""), parse_mode=None)
                    return last_sent
                except RetryAfter as e:
                    await asyncio.sleep(getattr(e, "retry_after", 2) or 2)
                except TimedOut:
                    attempts += 1
                    if attempts >= 3:
                        raise
                    await asyncio.sleep(1.5 * attempts)
                except NetworkError:
                    attempts += 1
                    if attempts >= 3:
                        raise
                    await asyncio.sleep(1.5 * attempts)

        async def _send_text_chunks(lines: List[str], max_len: int = 3500):
            nonlocal last_sent
            chunk: List[str] = []
            acc = 0
            for ln in lines:
                ln = ln if ln is not None else ""
                add = len(ln) + 1
                if acc + add > max_len and chunk:
                    await _safe_send_text("\n".join(chunk))
                    chunk, acc = [], 0
                chunk.append(ln)
                acc += add
            if chunk:
                text_out = "\n".join(chunk)
                await _safe_send_text(text_out)
                sent_msgs.append((last_sent, text_out, "text"))

        # Dispatch items
        buffer_lines: List[str] = []
        for it in items:
            if isinstance(it, dict) and (it.get("type") == "photo" or "url" in it or "photo_url" in it):
                # flush buffered text
                if buffer_lines:
                    await _send_text_chunks(buffer_lines)
                    logged_texts.append("\n".join(buffer_lines))
                    buffer_lines = []
                url = it.get("url") or it.get("photo_url")
                caption = it.get("caption") or ""
                # Telegram caption max ~1024
                if caption and len(caption) > 1024:
                    caption = caption[:1023] + "…"
                await _safe_send_photo(url, caption)
                sent_msgs.append((last_sent, caption or f"<photo:{url}>", "photo"))
            else:
                # treat as text line
                if isinstance(it, str):
                    buffer_lines.append(it)
                else:
                    buffer_lines.append(str(it))
        # flush remaining text
        if buffer_lines:
            await _send_text_chunks(buffer_lines)
            logged_texts.append("\n".join(buffer_lines))

        # Log each sent message individually with its own message_id
        chat_id = getattr(update.effective_chat, "id", None)
        # Resolve correlation id from context if present; fallback to chat_id:reply_to
        reply_to_id = getattr(update.message, "message_id", None)
        corr = (context.user_data.get("corr_id") if hasattr(context, "user_data") else None) or f"{chat_id}:{reply_to_id}"
        base_meta = {**(meta or {}), "corr_id": corr}
        for msg_obj, msg_text, msg_type in sent_msgs:
            doc = {
                "ts": datetime.now(tz=ZoneInfo("America/Santiago")),
                "chat_id": chat_id,
                "user": _safe_user_from_update(update),
                "chat": _safe_chat_from_update(update),
                "wallet": _resolve_wallet_for_update(update),
                "corr_id": corr,
                "direction": "out",
                "message": {
                    "id": getattr(msg_obj, "message_id", None),
                    "text": msg_text,
                    "type": msg_type,
                    "reply_to": getattr(update.message, "message_id", None),
                },
                "meta": base_meta,
            }
            TELEGRAM_MSGS.update_one(
                {"chat_id": doc["chat_id"], "message.id": doc["message"]["id"]},
                {"$set": doc},
                upsert=True,
            )
        return last_sent
    except Exception as e:
        logger.warning(f"[_reply_and_log] Failed to send/log reply: {e}")
        try:
            if isinstance(content, str):
                return await update.message.reply_text(content, parse_mode=None)
            elif isinstance(content, dict) and (content.get("type") == "photo" or content.get("url")):
                cap = content.get("caption") or ""
                return await update.message.reply_photo(photo=content.get("url"), caption=cap, parse_mode=None)
            else:
                # assume list of strings
                joined = "\n".join([str(x) for x in content])
                return await update.message.reply_text(joined, parse_mode=None)
        except Exception:
            return None


async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "**Ciao! Soy La Nonna Bot.**\nPídeme: `ventas de ayer`, `top productos este mes`, `menús lasagna`, `categoría pastas`, `ubicaciones`."
    )

async def link_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    tg_id = user.id if user else None
    if not tg_id:
        await update.message.reply_text("No pude leer tu ID de Telegram. Intenta de nuevo.")
        return
    from secrets import token_urlsafe
    state = token_urlsafe(12)
    link_url = f"{TELEGRAM_LINK_URL_BASE.rstrip('/')}/?tg_id={tg_id}&state={state}"
    logger.info(f"[link_cmd] Generated link for tg_id={tg_id}: {link_url}")
    await update.message.reply_text(
        "Para conectar tu cuenta, abre este enlace y autentícate con Privy:"
        f"\n{link_url}\n\nLuego vuelve y pide `ventas`.",
        parse_mode=None
    )

async def unlink_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    tg_id = user.id if user else None
    if not tg_id:
        await update.message.reply_text("No pude leer tu ID de Telegram.")
        return
    db.telegram_links.delete_one({"tg_id": str(tg_id)})
    await update.message.reply_text("Listo. Desvinculé tu cuenta de Privy. Usa /link para volver a conectar.")

def _get_link_info(tg_id: int):
    doc = db.telegram_links.find_one({"tg_id": str(tg_id)})
    if not doc:
        logger.info(f"[_get_link_info] No link found for tg_id={tg_id}")
        return None
    exp = doc.get("exp")
    if isinstance(exp, int):
        from time import time as _now
        if exp < int(_now()):
            logger.info(f"[_get_link_info] Link expired for tg_id={tg_id}")
            return {"expired": True, **{k: v for k, v in doc.items() if k != "_id"}}
    logger.info(f"[_get_link_info] Link OK for tg_id={tg_id}, wallet={doc.get('wallet')}")
    return {k: v for k, v in doc.items() if k != "_id"}

async def sales_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text or ""
    text_l = text.lower()

    # Log incoming user message early
    chat_id = getattr(update.effective_chat, "id", None)
    msg_id = getattr(update.message, "message_id", None)
    corr_id = f"{chat_id}:{msg_id}"
    context.user_data["corr_id"] = corr_id
    await _log_user_message(update, text, corr_id=corr_id)

    intent = await grok_route_intent(text)
    await _reply_and_log(update, context, [f"Intent: {intent}"], meta={"stage": "intent_detected", "intent": intent.get("intent")})
    if intent and isinstance(intent, dict):
        itype = intent.get("intent")
        if itype not in ACCEPTED_INTENTS:
            itype = "chat"

        if itype == "ventas_hora":
            # Igual que gastos: parséalo acá y pásalo al handler
            vhf = await grok_filters("ventas_hora", text) or {}
            context.user_data["ventas_hora_filters"] = vhf
            (u, lines) = await handle_ventas_hora(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "ventas_hora_response", "intent": itype})
            return

        if itype == "sueldos":
            sf = await grok_filters("sueldos", text) or {}
            if sf.get("period"):
                context.user_data["sueldos_period"] = sf["period"]
            if sf.get("mode"):
                context.user_data["sueldos_mode"] = sf["mode"]
            if sf.get("rut") is not None:
                context.user_data["sueldos_rut"] = sf["rut"]
            (u, lines) = await handle_sueldos(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "sueldos_response", "intent": itype})
            return

        if itype == "ventas":
            vf = await grok_filters("ventas", text) or {}
            # period can be a dict (e.g., {type, from, to}) or a string like "hoy"; store safely
            _vp = vf.get("period")
            context.user_data["ventas_period"] = (_vp.lower() if isinstance(_vp, str) else _vp) or ""
            (u, lines) = await handle_ventas(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "ventas_response", "intent": itype})
            return

        if itype == "productos":
            f = await grok_filters("productos", text) or {}
            context.user_data["productos_by"] = (f.get("by") or "").lower()
            context.user_data["productos_q"] = (f.get("q") or "").strip()
            if f.get("period"):
                context.user_data["productos_period"] = f["period"]
            context.user_data["productos_top"] = bool(f.get("top", False))
            context.user_data["productos_hide_values"] = bool(f.get("hide_values", False))
            (u, lines) = await handle_productos(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "productos_response", "intent": itype})
            return

        if itype == "consumos":
            f = await grok_filters("consumos", text) or {}
            context.user_data["consumos_by"] = (f.get("by") or "").lower()
            context.user_data["consumos_q"] = (f.get("q") or "").strip()
            if f.get("period"):
                context.user_data["consumos_period"] = f["period"]
            context.user_data["consumos_top"] = bool(f.get("top", False))
            context.user_data["consumos_hide_values"] = bool(f.get("hide_values", False))
            (u, lines) = await handle_consumos(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "consumos_response", "intent": itype})
            return

        if itype == "menus":
            f = await grok_filters("menus", text) or {}
            context.user_data["menus_by"] = (f.get("by") or "").lower()
            context.user_data["menus_q"] = (f.get("q") or "").strip()
            context.user_data["menus_detail"] = bool(f.get("detail", False))
            # pasar flags estructurados para recetas
            context.user_data["menus_recipe"] = bool(f.get("recipe", False))
            context.user_data["menus_mesanos"] = list(f.get("mesanos") or [])
            (u, lines) = await handle_menus(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "menus_response", "intent": itype})
            return

        if itype == "locations":
            lf = await grok_filters("locations", text) or {}
            q = (lf.get("q") or "").strip()
            if q:
                context.user_data["locations_q"] = q
            (u, lines) = await handle_locations(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "locations_response", "intent": itype})
            return

        if itype == "gastos":
            gf = await grok_filters("gastos", text) or {}
            context.user_data["gastos_by"] = gf.get("by") or ""
            context.user_data["gastos_q"] = gf.get("q") or ""
            context.user_data["gastos_siglas"] = gf.get("include_siglas") or []
            context.user_data["gastos_siglas_excl"] = gf.get("exclude_siglas") or []
            context.user_data["gastos_cuentas"] = gf.get("include_cuentas") or []
            context.user_data["gastos_rut"] = gf.get("rut")
            (u, lines) = await handle_gastos(update, context)
            await _reply_and_log(u, context, lines, meta={"stage": "gastos_response", "intent": itype})
            return

        if itype == "chat":
            reply = await ask_grok(text)
            await _reply_and_log(update, context, [reply], meta={"stage": "chat_response", "intent": itype})
            return

    # Chat general
    reply = await ask_grok(text)
    await _reply_and_log(update, context, [reply], meta={"stage": "chat_fallback"})

def run_bot():
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN no configurado. Bot no iniciado.")
        return
    application = (
        Application.builder()
        .token(TELEGRAM_BOT_TOKEN)
        # PRO UI: Markdown y sin previews en mensajes de texto
        .defaults(Defaults(parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True))
        .build()
    )
    application.add_handler(CommandHandler("start", start_cmd))
    application.add_handler(CommandHandler("link", link_cmd))
    application.add_handler(CommandHandler("unlink", unlink_cmd))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, sales_handler))
    logger.info("Iniciando Telegram bot (polling)...")
    application.run_polling()

def start_bot_background():
    t = threading.Thread(target=run_bot, name="telegram-bot", daemon=True)
    t.start()
    return t

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
    try:
        run_bot()
    except KeyboardInterrupt:
        logger.info("Bot detenido por el usuario")
