import os
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple

import httpx
from dotenv import load_dotenv
from utils.web3mongo import db

logger = logging.getLogger(__name__)

try:
    load_dotenv()
except Exception:
    pass

XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY = os.getenv("XAI_API_KEY")


def get_env_xai():
    return XAI_API_URL, XAI_MODEL, XAI_API_KEY

# Centralized intent spec for the chatbot
INTENT_PRIORITY = [
    "gastos", "menus", "productos", "consumos", "ventas_hora", "ventas", "sueldos", "locations", "chat"
]
INTENTS = [
    {"key": "gastos", "desc": "Consultas de egresos/costos/boletas/facturas, por cuenta/sucursal/mes/RUT."},
    {"key": "menus", "desc": "Información descriptiva de menús/platos/productos (nombre, ingredientes, foto)."},
    {"key": "productos", "desc": "Ventas por producto/menú (top/más vendidos, montos, cantidades, por período)."},
    {"key": "consumos", "desc": "Consultas de consumo de artículos de productos, por producto/familia/subfamilia (top/más consumidos, cantidades, por período), consumo segun venta."},
    {"key": "ventas_hora", "desc": "Ventas por hora (por garzón/RUT, por producto, por local, por día de semana/semana del mes, con clima, anulaciones)."},
    {"key": "ventas", "desc": "Ventas generales por fecha/rango (totales, tendencias)."},
    {"key": "sueldos", "desc": "Remuneraciones/pagos de sueldos por período y opcionalmente por RUT."},
    {"key": "locations", "desc": "Ubicación/tiendas/sucursales (búsqueda por nombre/ciudad/barrio)."},
    {"key": "chat", "desc": "Cualquier otra conversación general."},
]


async def ask_grok(prompt: str) -> str:
    _, model, api_key = get_env_xai()
    api_url = XAI_API_URL
    if not api_key:
        return "No hay clave XAI configurada (XAI_API_KEY)."
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": (
                "Sos la Nonna Marriana: cálida, directa, con humor. "
                "Siempre responde en español chileno."
            )},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(api_url, headers=headers, json=body)
        r.raise_for_status()
        data = r.json()
        return (data.get("choices", [{}])[0].get("message", {}) or {}).get("content") or "(sin respuesta)"


async def grok_route_intent(user_text: str) -> Optional[dict]:
    api_url, model, api_key = get_env_xai()
    if not api_key:
        return None

    today = datetime.now().strftime('%Y-%m-%d')
    intents_text = "\n".join([f"- {i['key']}: {i['desc']}" for i in INTENTS])
    priority_text = " > ".join(INTENT_PRIORITY)

    system = (
        "Estás dentro de un chatbot de negocio. Tu tarea es CLASIFICAR la intención del usuario.\n"
        "Devuelve SOLO JSON exacto con este esquema: {\"intent\":\"sueldos|ventas_hora|ventas|menus|locations|productos|consumos|gastos|chat\"}.\n"
        "Ningún otro campo.\n\n"
        "Intenciones disponibles:\n" + intents_text + "\n\n"
        "Reglas:\n"
        f"- Prioridad: {priority_text}.\n"
        "- NO extraigas filtros ni parámetros (fechas, RUT, cuentas, etc.).\n"
        "- Si piden gastos por RUT/cuenta/sucursal/mes => 'gastos'.\n"
        "- Si piden sueldos/remuneraciones por período/RUT => 'sueldos'.\n"
        "- Ventas por producto/top/más vendidos o similares, pero relacionado a la venta, no consumo => 'productos'.\n"
        "- Si mencionan frases como 'consumo según venta', 'cuánto se consumió de X según ventas', 'consumo de X según ventas', o similares => 'consumos'.\n"
        "- Pedidos que mencionan horas específicas (ej. 'a las 4 pm'), día de semana ('lunes'), 'por garzón/RUT', 'por hora', 'semana del mes' => 'ventas_hora'.\n"
        "- Ventas generales por fecha/rango sin granularidad horaria => 'ventas'.\n"
        "- Descripciones/fotos/ingredientes de platos => 'menus'. Ubicación de tiendas => 'locations'.\n"
        f"Hoy es {today}."
    )

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(api_url, headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }, json=body)
            r.raise_for_status()
            data = r.json()
            content = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content") or ""
            obj = json.loads(content)
            if not (isinstance(obj, dict) and obj.get("intent") in {"sueldos","ventas_hora","ventas","menus","locations","productos","consumos","gastos","chat"}):
                return None
            # Return ONLY the intent field
            return {"intent": obj.get("intent")}
    except Exception:
        return None


def get_link_info(tg_id: int):
    """Fetch Telegram-Privy link info. Returns dict (sin _id). Marca 'expired' si exp ya pasó."""
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
