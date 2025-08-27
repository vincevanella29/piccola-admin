import os
import json
import logging
from datetime import datetime
from typing import Optional, Tuple, Dict, Any, List, Callable

import httpx
from dotenv import load_dotenv
from utils.web3mongo import db

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

def _norm(s) -> str:
    return ("" if s is None else str(s)).strip()

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

# --- Catálogos dinámicos (desde BD) ---
def _catalog_categories(limit=1000) -> List[str]:
    rows = list(db.categories.find({}, {"_id": 0, "id": 1, "nombre": 1, "name": 1}).limit(limit))
    out = []
    for r in rows:
        cid = _norm(r.get("id"))
        n   = _norm(r.get("nombre") or r.get("name"))
        if n:
            out.append(f"{cid}|{n}")
    return out

def _catalog_menus(limit=3000) -> List[str]:
    rows = list(db.menus.find({}, {"_id": 0, "codigo": 1, "nombre": 1, "descripcion": 1}).limit(limit))
    out = []
    for r in rows:
        code = _norm(r.get("codigo"))
        name = _norm(r.get("nombre"))
        descr = _norm(r.get("descripcion"))
        if code or name or descr:
            out.append(f"{code}|{name}|{descr[:120]}")
    return out

def _catalog_gastos_cuentas(limit=500):
    rows = list(db.gastos_refs_cuentas.find({}, {"_id": 0}).sort("count_docs", -1).limit(limit))
    out = []
    for r in rows:
        if r.get("cuenta"):
            out.append(f"{r.get('cuenta')}:{_norm(r.get('resumen2'))}:{_norm(r.get('resumen'))}:{_norm(r.get('nombre_cuenta'))}")
    return out

def _catalog_gastos_sucursales(limit=400):
    rows = list(db.gastos_refs_sucursales.find({}, {"_id": 0, "sigla": 1, "location.nombre": 1}).limit(limit))
    out = []
    for r in rows:
        sig = _norm(r.get("sigla")).upper()
        nom = _norm((r.get("location") or {}).get("nombre"))
        if sig:
            out.append(f"{sig}:{nom}")
    return out

def _catalog_locations(limit=800):
    rows = list(db.locations.find({}, {"_id": 0, "nombre":1, "permalink_slug":1}).limit(limit))
    out = []
    for r in rows:
        out.append(f"{_norm(r.get('permalink_slug'))}|{_norm(r.get('nombre'))}")
    return out

SPEC: Dict[str, Dict[str, Any]] = {
    "gastos": {
        "schema_text": (
            '{"by":""|"mes"|"sigla"|"cuenta","q":"",'
            '"include_siglas":["..."],"exclude_siglas":["..."],"include_cuentas":[123],'
            '"rut":12345678,"reason":""}'
        ),
        "rules_text": (
            "- Si dice 'total' => by=\"\".\n"
            "- 'por mes' => by='mes'; 'por sucursal'/'por sigla' => by='sigla'; 'por cuenta' => by='cuenta'.\n"
            "- Si menciona sucursales (por nombre/sigla) => mete en include_siglas; si 'sin X' => exclude_siglas.\n"
            "- Si menciona categoría que corresponde a cuentas (resumen/resumen2) => llena include_cuentas."
        ),
        "catalogs": [
            ("CUENTAS(cuenta:resumen2:resumen:nombre)", _catalog_gastos_cuentas),
            ("SUCURSALES(sigla:nombre)", _catalog_gastos_sucursales),
        ],
    },
    "menus": {
        "schema_text": '{"by":"categoria"|"producto"|"texto","q":"","detail":false}',
        "rules_text": (
            "- Si coincide con NOMBRE de categoría => by='categoria', q=ese nombre.\n"
            "- Si aparece un CÓDIGO exacto => by='producto', q=código.\n"
            "- Si coincide claramente con NOMBRE de menú => by='producto'; en duda => by='texto'.\n"
            "- 'detail' true si piden detalles/foto."
        ),
        "catalogs": [
            ("CATEGORIAS(id|nombre)", _catalog_categories),
            ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
        ],
    },
    "productos": {
        "schema_text": (
            '{"by":"codigo"|"nombre"|"categoria"|"", "q":"", "period":"YYYYMM|", '
            '"top":false,"hide_values":false}'
        ),
        "rules_text": (
            "- Código exacto => by='codigo'. Nombre de menú => by='nombre'. "
            "Nombre de categoría => by='categoria'. Duda => by=''.\n"
            "- Fechas naturales (hoy/ayer/este mes/mes pasado/YYYY-MM/DD) => 'period' en YYYYMM. "
            "Si cruza meses, usa el mes del límite final.\n"
            "- 'más vendidos' => top=true. 'sin valores' => hide_values=true."
        ),
        "catalogs": [
            ("CATEGORIAS(id|nombre)", _catalog_categories),
            ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
        ],
    },
    "ventas": {
        "schema_text": (
            '{"preset":"hoy"|"ayer"|"este_mes"|"mes_pasado"|"custom","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}'
        ),
        "rules_text": "- Normaliza fechas naturales; si rango => preset='custom', start/end inclusivas.",
        "catalogs": [],
    },
    "locations": {
        "schema_text": '{"q":""}',
        "rules_text": "- Devuelve 'q' con texto para filtrar por nombre/ciudad/barrio.",
        "catalogs": [("LOCALES(slug|nombre)", _catalog_locations)],
    },
    "sueldos": {
        "schema_text": '{"period":"YYYYMM|","mode":""|"resumen"|"detalle"|"debug"}',
        "rules_text": "- Si hay referencia temporal, 'period' en YYYYMM; 'mode' si piden resumen/detalle/debug.",
        "catalogs": [],
    },
}

async def grok_filters(intent: str, user_text: str) -> Optional[dict]:
    intent = (intent or "").lower()
    if intent not in SPEC:
        return None
    api_url, model, api_key = get_env_xai()
    if not api_key:
        return None

    spec = SPEC[intent]
    schema_text = spec["schema_text"]
    rules_text  = spec["rules_text"]
    catalogs_cfg: List[Tuple[str, Callable[[], List[str]]]] = spec.get("catalogs", [])

    catalogs_parts: List[str] = []
    for label, fn in catalogs_cfg:
        try:
            rows = fn() or []
        except Exception:
            rows = []
        if rows:
            catalogs_parts.append(label + ":\n" + "\n".join(rows))
    catalogs_text = "\n\n".join(catalogs_parts)

    today = datetime.now().strftime("%Y-%m-%d")
    system = (
        "Eres un resolutor de filtros. Devuelve SOLO JSON EXACTO con este esquema:\n"
        f"{schema_text}\n"
        "Reglas:\n"
        f"{rules_text}\n"
        f"Hoy es {today}. Sin comentarios extra, SOLO JSON."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": (user_text if not catalogs_text else (user_text + "\n\n" + catalogs_text))},
    ]

    body = {
        "model": model,
        "messages": messages,
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
    except Exception:
        return None

    obj = _json_first_object(content or "")
    if not isinstance(obj, dict):
        return None

    if intent in {"sueldos", "productos"}:
        p = _coerce_period_to_yyyymm(obj.get("period") or "")
        obj["period"] = p

    if intent == "menus":
        by = (_norm(obj.get("by"))).lower()
        if by not in {"categoria", "producto", "texto"}:
            by = "texto"
        obj["by"] = by
        obj["q"]  = _norm(obj.get("q"))
        obj["detail"] = bool(obj.get("detail", False))

    if intent == "productos":
        by = (_norm(obj.get("by"))).lower()
        if by not in {"codigo", "nombre", "categoria", ""}:
            by = ""
        obj["by"] = by
        obj["q"]  = _norm(obj.get("q"))
        obj["top"] = bool(obj.get("top", False))
        obj["hide_values"] = bool(obj.get("hide_values", False))

    if intent == "gastos":
        by = (_norm(obj.get("by"))).lower()
        if by not in {"", "mes", "sigla", "cuenta"}:
            by = ""
        obj["by"] = by
        obj["q"]  = _norm(obj.get("q"))
        obj["include_siglas"] = [str(x).upper().strip() for x in obj.get("include_siglas", []) if str(x).strip()]
        obj["exclude_siglas"] = [str(x).upper().strip() for x in obj.get("exclude_siglas", []) if str(x).strip()]
        ctas = []
        for x in obj.get("include_cuentas", []):
            try:
                ctas.append(int(str(x).strip()))
            except Exception:
                pass
        obj["include_cuentas"] = ctas
        rut = obj.get("rut")
        try:
            rut = int(str(rut))
            if rut <= 0:
                rut = None
        except Exception:
            rut = None
        if rut is None and "rut" in obj:
            obj.pop("rut", None)
        else:
            obj["rut"] = rut

    if intent == "ventas":
        preset = (_norm(obj.get("preset"))).lower()
        if preset not in {"hoy", "ayer", "este_mes", "mes_pasado", "custom"}:
            preset = "custom" if (_norm(obj.get("start")) and _norm(obj.get("end"))) else "este_mes"
        obj["preset"] = preset

    if intent == "locations":
        obj["q"] = _norm(obj.get("q"))

    if intent == "sueldos":
        mode = (_norm(obj.get("mode"))).lower()
        if mode not in {"resumen", "detalle", "debug", ""}:
            mode = ""
        obj["mode"] = mode

    return obj
