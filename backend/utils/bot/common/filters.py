# utils/common/filters.py
import os
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, List, Optional, Tuple

import httpx
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

try:
    load_dotenv()
except Exception:
    pass

XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
XAI_MODEL   = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY = os.getenv("XAI_API_KEY")

def get_env_xai():
    return XAI_API_URL, XAI_MODEL, XAI_API_KEY

# ---------------------
# Utils
# ---------------------

def _norm(s) -> str:
    return ("" if s is None else str(s)).strip()

def _json_first_object(text: str) -> Optional[dict]:
    try:
        return json.loads(text)
    except Exception:
        pass
    if text.startswith("```"):
        import re
        try:
            t = re.sub(r"^```(?:json)?\s*\n", "", text, flags=re.I)
            t = re.sub(r"\n```\s*$", "", t)
            return json.loads(t)
        except Exception:
            pass
    first = text.find("{")
    if first != -1:
        depth, end = 0, None
        for i, ch in enumerate(text[first:], start=first):
            if ch == "{": depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end:
            try:
                return json.loads(text[first:end])
            except Exception:
                return None
    return None

def _coerce_period_to_yyyymm(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = s.strip()
    if len(s) == 6 and s.isdigit():
        return s
    if len(s) >= 7 and s[4] == "-":
        y, m = s[:4], s[5:7]
        return (y + m) if (y.isdigit() and m.isdigit()) else ""
    return ""

# ---------------------
# Especificación genérica
# ---------------------

# Cada intent define su spec y la registra. filters NO sabe nada de reglas concretas.
CatalogFn = Callable[[], List[str]]
PostprocessFn = Callable[[dict], dict]

@dataclass
class FilterSpec:
    key: str                                     # p.ej. "gastos"
    schema_text: str                             # JSON schema en texto
    rules_text: str                              # Reglas en texto
    catalogs: List[Tuple[str, CatalogFn]] = field(default_factory=list)
    preamble: str = ("Eres un resolutor de filtros. Devuelve SOLO JSON EXACTO con este esquema:\n"
                     "{schema}\nReglas:\n{rules}\n"
                     "Sin comentarios extra, SOLO JSON.")
    add_today: bool = True                       # agrega “Hoy es YYYY-MM-DD”
    postprocess: Optional[PostprocessFn] = None  # normalizador opcional (del intent)

# Registro global de specs
_REGISTRY: dict[str, FilterSpec] = {}

def register_filter_spec(spec: FilterSpec):
    _REGISTRY[spec.key] = spec
    logger.info(f"[filters] Registered FilterSpec for '{spec.key}'")

# ---------------------
# Prompt builder + call
# ---------------------

async def grok_filters(spec_or_key, user_text: str) -> Optional[dict]:
    """
    Uso:
      - grok_filters("gastos", text)            # busca spec desde el registro
      - grok_filters(spec_obj, text)            # pasa el spec directo
    """
    # Resolver spec
    if isinstance(spec_or_key, str):
        spec = _REGISTRY.get(spec_or_key)
        if not spec:
            logger.warning(f"[filters] No FilterSpec registered for key='{spec_or_key}'")
            return None
    elif isinstance(spec_or_key, FilterSpec):
        spec = spec_or_key
    else:
        logger.warning(f"[filters] grok_filters recibió tipo inválido: {type(spec_or_key)}")
        return None

    # Concatenar catálogos dinámicos
    catalogs_parts: List[str] = []
    for label, fn in (spec.catalogs or []):
        try:
            rows = fn() or []
        except Exception:
            rows = []
        if rows:
            catalogs_parts.append(label + ":\n" + "\n".join(rows))
    catalogs_text = "\n\n".join(catalogs_parts)

    # System + user messages
    tz = ZoneInfo("America/Santiago")
    today = datetime.now(tz).strftime("%Y-%m-%d")
    system = spec.preamble.format(schema=spec.schema_text, rules=spec.rules_text)
    if spec.add_today:
        system += f"\nHoy es {today}."

    user_content = user_text if not catalogs_text else (user_text + "\n\n" + catalogs_text)

    # Llamar Grok
    api_url, model, api_key = get_env_xai()
    if not api_key:
        logger.warning("[filters] XAI_API_KEY no configurada")
        return None

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
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
    except Exception as e:
        logger.warning(f"[filters] Grok call failed: {e}")
        return None

    obj = _json_first_object(content or "")
    if not isinstance(obj, dict):
        return None

    # Postprocesamiento delegado al intent (si lo definió)
    if callable(spec.postprocess):
        try:
            obj = spec.postprocess(obj) or obj
        except Exception as e:
            logger.warning(f"[filters] postprocess error for '{spec.key}': {e}")

    return obj
