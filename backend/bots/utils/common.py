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


def _coerce_period_to_yyyymm(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = s.strip()
    if len(s) == 6 and s.isdigit():
        return s
    if len(s) >= 7 and s[4] == '-':
        y = s[0:4]
        m = s[5:7]
        return (y + m) if (y.isdigit() and m.isdigit()) else ""
    return ""


async def grok_route_intent(user_text: str) -> Optional[dict]:
    api_url, model, api_key = get_env_xai()
    if not api_key:
        return None

    today = datetime.now().strftime('%Y-%m-%d')
    # pequeños catálogos (opcionales)
    try:
        _cats = list(db.categories.find({}, {"_id": 0, "id": 1, "nombre": 1, "name": 1}))
        _menus = list(db.menus.find({}, {"_id": 0, "codigo": 1, "nombre": 1}))
    except Exception:
        _cats, _menus = [], []

    _cat_names = []
    for c in _cats[:500]:
        _n = (c.get("nombre") or c.get("name") or "").strip()
        if _n:
            _cat_names.append(_n)

    _menu_pairs = []
    for m in _menus[:800]:
        _code = (m.get("codigo") or "").strip()
        _name = (m.get("nombre") or "").strip()
        if _code or _name:
            _menu_pairs.append(f"{_code}|{_name}" if _code else f"|{_name}")

    catalogs = []
    if _cat_names:
        catalogs.append("CATEGORIAS_DISPONIBLES:\n" + ", ".join(_cat_names))
    if _menu_pairs:
        catalogs.append("MENUS_CODIGO_NOMBRE:\n" + "; ".join(_menu_pairs))
    _catalogs_text = "\n\n".join(catalogs)

    system = (
        "Devuelve SOLO JSON: "
        '{"intent":"sueldos|ventas|menus|locations|productos|gastos|chat",'
        '"mode":"detalle|resumen|debug|","period":"YYYYMM|","by":"","q":"","reason":""}. '
        "Prioridad: gastos > menús > productos > ventas > sueldos > locations > chat. "
        "Reglas clave:\n"
        "- 'productos' = ventas por producto (ranking, top, montos, cantidades, márgenes, periodos/fechas).\n"
        "- 'menus' = info de platos (descripción, ingredientes, foto, detalle del menú) SIN pedir ventas.\n"
        "- Si el texto contiene 'más vendidos', 'mas vendidos', 'top', 'ventas', 'por producto' => intent='productos'.\n"
        "- Si pregunta '¿cómo es?', 'qué es', 'foto', 'imagen', 'detalle' o termina en '?' y coincide con un nombre/código de menú => intent='menus' con by='producto' y q=<nombre o código>.\n"
        "- Si coincide con una categoría de menú => intent='menus' con by='categoria'.\n"
        f"Hoy es {today}."
    )

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": (user_text if not _catalogs_text else (user_text + "\n\n" + _catalogs_text))},
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
            if not (isinstance(obj, dict) and obj.get("intent") in {"sueldos","ventas","menus","locations","productos","gastos","chat"}):
                return None

            mode = (obj.get("mode") or "").lower()
            if mode not in {"resumen","detalle","debug",""}:
                obj["mode"] = ""

            period = obj.get("period") or ""
            if obj.get("intent") in {"sueldos","productos"}:
                obj["period"] = _coerce_period_to_yyyymm(period)
            else:
                obj["period"] = ""

            by = (obj.get("by") or "").lower()
            if by not in {"categoria","producto","texto","codigo","nombre",""}:
                by = ""
            obj["by"] = by
            q = obj.get("q") or ""
            obj["q"] = q.strip() if isinstance(q, str) else ""
            return obj
    except Exception:
        return None


async def grok_parse_dates(user_text: str, now: datetime) -> Optional[Tuple[datetime, datetime, str]]:
    """Devuelve (start, end_exclusive, preset) o None."""
    api_url, model, api_key = get_env_xai()
    if not api_key:
        return None

    system = (
        "Sos un parser de fechas. Devuelve SOLO JSON: "
        '{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","preset":"hoy|ayer|este_mes|mes_pasado|custom"}. '
        "end es INCLUSIVO. Si no se entiende: {\"error\":\"no_parse\"}. "
        f"Hoy es {now.strftime('%Y-%m-%d')}. Español. Sin texto extra. "
        "Soporta: hoy, ayer, este mes, mes pasado, este año, año pasado, 'YYYY-MM-DD a YYYY-MM-DD', "
        "y 'últimos N días/meses/años' (1..120). Para 'últimos N meses/años', end=hoy e inicio retrocede N meses/años completos."
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
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(api_url, headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }, json=body)
            r.raise_for_status()
            data = r.json()
            content = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content") or ""
            try:
                obj = json.loads(content)
            except Exception:
                obj = None

            if isinstance(obj, dict):
                if obj.get("error") == "no_parse":
                    # Fallback local: reconoce 'últimos N ...'
                    t = (user_text or "").lower()
                    m = re.search(r"\b(ultimos|últimos)\s+(\d{1,3})\s+(dias|días|meses|anos|años)\b", t)
                    if m:
                        try:
                            n = max(1, min(120, int(m.group(2))))
                            unit = m.group(3)
                            end_incl = now.replace(hour=0, minute=0, second=0, microsecond=0)
                            if unit in {"dias", "días"}:
                                start_dt = end_incl - timedelta(days=n - 1)
                            elif unit == "meses":
                                y, mth = end_incl.year, end_incl.month
                                total_months = y * 12 + (mth - 1)
                                target = total_months - (n - 1)
                                ty, tm = divmod(target, 12)
                                start_dt = datetime(int(ty), int(tm) + 1, 1)
                            else:  # años
                                start_dt = datetime(end_incl.year - (n - 1), 1, 1)
                            s, e = start_dt, (end_incl + timedelta(days=1))
                            return s, e, "custom"
                        except Exception:
                            return None
                    return None

                if "start" in obj and "end" in obj:
                    s = datetime.strptime(obj["start"], "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
                    e_incl = datetime.strptime(obj["end"], "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
                    e = e_incl + timedelta(days=1)
                    preset = obj.get("preset") or "custom"
                    return s, e, preset
            return None
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
