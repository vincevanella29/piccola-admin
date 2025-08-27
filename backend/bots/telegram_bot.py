import os
import logging
import threading
from typing import Optional
from datetime import datetime, timedelta
import json

import httpx
from pymongo.collection import Collection
from dotenv import load_dotenv
from utils.web3mongo import db

# Telegram bot (async) - python-telegram-bot v21
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

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
    from bots.utils.productos import handle_productos
    from bots.utils.common import ask_grok, grok_route_intent
    from bots.utils.menus import handle_menus
    from bots.utils.ventas import handle_ventas
    from bots.utils.gastos import handle_gastos
    from bots.utils.locations import handle_locations
    from bots.utils.sueldos import handle_sueldos
    from bots.utils.filters import grok_filters
except Exception:
    from .utils.productos import handle_productos
    from .utils.common import ask_grok, grok_route_intent
    from .utils.menus import handle_menus
    from .utils.ventas import handle_ventas
    from .utils.gastos import handle_gastos
    from .utils.locations import handle_locations
    from .utils.sueldos import handle_sueldos
    from .utils.filters import grok_filters


async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Ciao! Soy La Nonna Bot. Pídeme: 'ventas de ayer', 'top productos este mes', 'menús lasagna', 'categoría pastas', 'ubicaciones'."
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
        f"\n{link_url}\n\nLuego vuelve y pide 'ventas'."
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

    intent = await grok_route_intent(text)
    if intent and isinstance(intent, dict):
        itype = intent.get("intent")
        mode = (intent.get("mode") or "").lower()
        period = (intent.get("period") or "").strip()

        if itype == "sueldos":
            if period:
                context.user_data["sueldos_period"] = period
            if mode:
                context.user_data["sueldos_mode"] = mode
            await handle_sueldos(update, context)
            return

        if itype == "ventas":
            context.user_data["ventas_mode"] = mode
            await handle_ventas(update, context)
            return

        if itype == "productos":
            f = await grok_filters("productos", text) or {}
            context.user_data["productos_by"] = (f.get("by") or "").lower()
            context.user_data["productos_q"] = (f.get("q") or "").strip()
            if f.get("period"):
                context.user_data["productos_period"] = f["period"]
            context.user_data["productos_top"] = bool(f.get("top", False))
            context.user_data["productos_hide_values"] = bool(f.get("hide_values", False))
            await handle_productos(update, context)
            return

        if itype == "menus":
            f = await grok_filters("menus", text) or {}
            context.user_data["menus_by"] = (f.get("by") or "").lower()
            context.user_data["menus_q"] = (f.get("q") or "").strip()
            context.user_data["menus_detail"] = bool(f.get("detail", False))
            await handle_menus(update, context)
            return

        if itype == "locations":
            q = (intent.get("q") or "").strip()
            if q:
                context.user_data["locations_q"] = q
            await handle_locations(update, context)
            return

        if itype == "gastos":
            gf = await grok_filters("gastos", text) or {}
            context.user_data["gastos_by"] = gf.get("by") or ""
            context.user_data["gastos_q"] = gf.get("q") or ""
            context.user_data["gastos_siglas"] = gf.get("include_siglas") or []
            context.user_data["gastos_siglas_excl"] = gf.get("exclude_siglas") or []
            context.user_data["gastos_cuentas"] = gf.get("include_cuentas") or []
            context.user_data["gastos_rut"] = gf.get("rut")
            await handle_gastos(update, context)
            return

    # Fallbacks por keywords
    if "sueldo" in text_l or context.user_data.get("awaiting_sueldos_dates"):
        await handle_sueldos(update, context); return
    if any(k in text_l for k in ["productos", "producto", "ventas de productos", "venta de productos", "por producto", "más vendidos", "mas vendidos", "top"]):
        await handle_productos(update, context); return
    if any(k in text_l for k in ["gasto", "gastos", "cuenta", "resumen2", "tipo de gasto", "sucursal", "sucursales", "siglas", "arriendo", "alquiler"]):
        for k in ["gastos_by", "gastos_q", "gastos_siglas", "gastos_cuentas"]:
            context.user_data.pop(k, None)
        await handle_gastos(update, context); return
    if "venta" in text_l or context.user_data.get("awaiting_sales_dates"):
        await handle_ventas(update, context); return
    if any(k in text_l for k in ["sucursal", "sucursales", "local", "locales", "ubicacion", "ubicación", "ubicaciones", "tienda", "tiendas"]):
        await handle_locations(update, context); return

    # Chat general
    reply = await ask_grok(text)
    await update.message.reply_text(reply)

def run_bot():
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN no configurado. Bot no iniciado.")
        return
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
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
