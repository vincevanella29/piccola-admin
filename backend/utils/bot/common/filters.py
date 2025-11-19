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


# ---------------------
# Global helpers de acceso / scope
# ---------------------

def _apply_sucursal_scope(filters: dict, perms: dict, role_level: Optional[int]) -> dict:
    """Aplica scope de sucursales para niveles 6+.

    - 1-5: no toca nada.
    - 6+: si no tiene can_view_all_sucursales, limita include_siglas a las sucursales
      permitidas por access (sucursal_ids / own_id_sucursal).
    """
    try:
        if role_level is None or int(role_level) < 6:
            return filters or {}
    except Exception:
        return filters or {}

    f = dict(filters or {})
    include_siglas = [str(s).upper() for s in (f.get("include_siglas") or [])]

    sucursal_ids = perms.get("sucursal_ids") or []
    own_id_sucursal = perms.get("own_id_sucursal")
    can_view_all_sucursales = bool(perms.get("can_view_all_sucursales"))

    allowed_siglas: list[str] = []
    if not can_view_all_sucursales:
        try:
            suc_ids = [int(x) for x in (sucursal_ids or [])]
        except Exception:
            suc_ids = []
        if suc_ids:
            try:
                refs = list(db.gastos_refs_sucursales.find({"id_sucursal": {"$in": suc_ids}}, {"sigla": 1}))
                allowed_siglas = [str(r.get("sigla")).upper() for r in refs if r.get("sigla")]
            except Exception:
                allowed_siglas = []
        if not allowed_siglas and own_id_sucursal is not None:
            try:
                ref = db.gastos_refs_sucursales.find_one({"id_sucursal": int(own_id_sucursal)}, {"sigla": 1})
                sigla = (ref or {}).get("sigla")
                if sigla:
                    allowed_siglas = [str(sigla).upper()]
            except Exception:
                allowed_siglas = []

        # Fallback: si access no trae sucursal_ids ni own_id_sucursal pero sí tenemos rut
        # en trabajadores_vpn y está activo, usamos la sucursal de la ficha.
        if not allowed_siglas and not suc_ids and own_id_sucursal is None:
            try:
                rut_val = perms.get("rut")
                if rut_val:
                    try:
                        rut_int = int(rut_val)
                    except Exception:
                        rut_int = None
                    q = {"activo": 1}
                    if rut_int is not None:
                        q["rut"] = rut_int
                    else:
                        q["rut"] = str(rut_val)
                    trab = db.trabajadores_vpn.find_one(q, {"sucursal": 1}) or {}
                    suc_sigla = trab.get("sucursal")
                    if suc_sigla:
                        allowed_siglas = [str(suc_sigla).upper()]
            except Exception:
                allowed_siglas = []

    if allowed_siglas:
        if include_siglas:
            include_siglas = [s for s in include_siglas if s in allowed_siglas]
        else:
            include_siglas = allowed_siglas
    f["include_siglas"] = include_siglas
    return f


def resolve_allowed_codes_lvl7_from_centros(period_ym: str, perms: dict) -> set[str]:
    """Devuelve el set de códigos de producto permitidos para nivel 7,
    usando KPIs de tiempos por centro + rentabilidad_producto_locales.

    - period_ym: "YYYYMM" del período relevante.
    - perms: dict de permisos que incluye rut.
    """
    rut = perms.get("rut")
    if not rut or not period_ym:
        return set()

    # Normalizar período a YYYYMM para rentabilidad (mesano)
    try:
        ym_str = f"{period_ym[:4]}{period_ym[4:]}"
    except Exception:
        return set()

    # 1) Resolver ficha del trabajador (trabajadores_vpn) para obtener el cargo
    trab = None
    try:
        # Lookup robusto por rut (int o str) y activo=1
        candidates = []
        try:
            rut_int = int(rut)
            candidates.append({"rut": rut_int, "activo": 1})
            candidates.append({"rut": str(rut_int), "activo": 1})
        except Exception:
            candidates.append({"rut": str(rut), "activo": 1})
        for q in candidates:
            doc = db.trabajadores_vpn.find_one(q, {"cargo": 1})
            if doc:
                trab = doc
                break
    except Exception:
        trab = None

    cargo = (trab or {}).get("cargo")
    if not cargo:
        return set()

    # 2) cargo -> id_cargo en cargos_intranet
    try:
        cargo_doc = db.cargos_intranet.find_one(
            {"cargo": cargo},
            {"id_cargo": 1, "id": 1},
        ) or {}
    except Exception:
        cargo_doc = {}

    id_cargo = cargo_doc.get("id_cargo") or cargo_doc.get("id")
    try:
        id_cargo_int = int(id_cargo) if id_cargo is not None else None
    except Exception:
        id_cargo_int = None
    if id_cargo_int is None:
        return set()

    # 3) id_cargo -> centros_produccion_config.cargo_ids (centros activos)
    try:
        cfg_docs = list(
            db.centros_produccion_config.find(
                {"cargo_ids": id_cargo_int, "active": True},
                {"centro_nombre": 1},
            )
        )
        centros_nombres = [
            str(d.get("centro_nombre") or "").strip() for d in cfg_docs if d.get("centro_nombre")
        ]
    except Exception:
        centros_nombres = []

    if not centros_nombres:
        return set()

    # 4) Consultar rentabilidad_producto_locales por mesano y centroproduccion
    #    Soportar mesano guardado como string o como int.
    try:
        ym_int = int(ym_str)
    except Exception:
        ym_int = None

    mesano_filter = {"$in": [ym_str]} if ym_int is None else {"$in": [ym_str, ym_int]}

    try:
        q = {"mesano": mesano_filter, "centroproduccion": {"$in": centros_nombres}}
        codes_cur = db.rentabilidad_producto_locales.distinct("codig", q)
        return {str(c).upper() for c in codes_cur if c}
    except Exception:
        return set()


def is_worker_in_sales_kpis(period_ym: str, perms: dict) -> bool:
    """Indica si el trabajador (por rut en perms) aparece en kpis_empleado_mensual
    para el período dado (YYYYMM).

    Esto lo usamos para distinguir lvl 7 garzón (tiene ventas -> True) vs
    lvl 7 cocina (no tiene ventas -> False).
    """
    rut = perms.get("rut")
    if not rut or not period_ym:
        return False

    try:
        ym_dash = f"{period_ym[:4]}-{period_ym[4:]}"
    except Exception:
        return False

    try:
        # es_competidor=True es obligatorio para considerarlo garzón/ventas.
        doc = db.kpis_empleado_mensual.find_one(
            {"periodo": ym_dash, "rut": str(rut), "es_competidor": True},
            {"sales.total": 1, "es_competidor": 1},
        ) or {}
    except Exception:
        return False

    if not doc.get("es_competidor"):
        return False

    sales = (doc.get("sales") or {}).get("total")
    try:
        return bool(sales) and float(sales) > 0
    except Exception:
        return False


def apply_access_filters_for_product_like_intent(
    key: str,
    spec_obj: dict,
    perms: dict,
    role_level: Optional[int],
    period_ym: Optional[str] = None,
) -> dict:
    """Helper global para intents tipo productos/menus/ventas_hora.

    - Aplica scope de sucursales (lvl 6+).
    - Para lvl 7, si se entrega period_ym (YYYYMM), intersecta include_codigos
      con los códigos permitidos por centros de producción del trabajador.

    No modifica otras partes del spec; devuelve una copia segura.
    """
    obj = dict(spec_obj or {})
    filters = dict((obj.get("filters") or {}))

    # 1) Sucursal scope (niveles 6+)
    filters = _apply_sucursal_scope(filters, perms or {}, role_level)

    # 2) Scope por centros / RUT para nivel 7 (si tenemos período)
    try:
        lvl = int(role_level) if role_level is not None else None
    except Exception:
        lvl = None
    if lvl == 7 and period_ym:
        allowed_codes = resolve_allowed_codes_lvl7_from_centros(period_ym, perms or {})
        if allowed_codes:
            include_codigos = [str(x).upper() for x in (filters.get("include_codigos") or [])]
            if include_codigos:
                intersect = [c for c in include_codigos if c in allowed_codes]
                if not intersect:
                    # No hay intersección entre lo pedido y lo permitido por centros:
                    # marcamos deny explícito para que el handler pueda bloquear la receta.
                    filters["include_codigos"] = []
                    filters["_lvl7_denied"] = True
                else:
                    filters["include_codigos"] = intersect
            else:
                # Sin códigos previos: usamos todos los permitidos por centros
                filters["include_codigos"] = sorted(list(allowed_codes))

    obj["filters"] = filters
    return obj
