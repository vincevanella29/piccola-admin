import re
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm

# -----------------------------
# Catálogos (opcionales)
# -----------------------------

def _catalog_gastos_cuentas(limit=400) -> List[str]:
    rows = list(db.gastos_refs_cuentas.find({}, {"_id": 0}).sort("count_docs", -1).limit(limit))
    out = []
    for r in rows:
        if r.get("cuenta"):
            out.append(f"{r.get('cuenta')}:{_norm(r.get('resumen2'))}:{_norm(r.get('resumen'))}:{_norm(r.get('nombre_cuenta'))}")
    return out

def _catalog_gastos_sucursales(limit=300) -> List[str]:
    rows = list(db.gastos_refs_sucursales.find({}, {"_id": 0, "sigla": 1, "location.nombre": 1}).limit(limit))
    out = []
    for r in rows:
        sig = _norm(r.get("sigla")).upper()
        nom = _norm((r.get("location") or {}).get("nombre"))
        if sig:
            out.append(f"{sig}:{nom}")
    return out

# -----------------------------
# Post-proceso/normalización
# -----------------------------

_ALLOWED_GROUPS = {"auto", "none", "mes", "sigla", "cuenta", "mes_sigla"}
_ALLOWED_SEARCH_FIELDS = {"resumen", "resumen2", "tipo_gasto", "glosa", "detalle"}
_ALLOWED_INCLUDE_FIELDS = {"glosa", "detalle", "tipo_gasto", "resumen", "resumen2"}
_ALLOWED_TEXT_MODES = {"contains", "word", "prefix", "suffix", "regex"}
_ALLOWED_SEARCH_LOGIC = {"any", "all"}

def _looks_like_period(s: str) -> bool:
    return bool(
        re.fullmatch(r"\d{4}$", s) or
        re.fullmatch(r"\d{4}-\d{2}$", s) or
        re.fullmatch(r"\d{6}$", s) or
        re.fullmatch(r"\d{4}/\d{1,2}$", s)
    )

def _postprocess(obj: dict) -> dict:
    # period
    period = obj.get("period") or {}
    if not isinstance(period, dict):
        period = {}
    start = _norm(period.get("start"))
    end   = _norm(period.get("end"))
    period = {"start": start, "end": end, "tz": _norm(period.get("tz") or "America/Santiago")}
    obj["period"] = period

    # group_by
    group_by = _norm(obj.get("group_by") or "auto").lower()
    if group_by not in _ALLOWED_GROUPS:
        group_by = "auto"
    obj["group_by"] = group_by

    # filters
    f = obj.get("filters") or {}
    if not isinstance(f, dict):
        f = {}

    text = _norm(f.get("text"))
    if text and (_looks_like_period(text) or not re.search(r"[A-Za-zÁ-Üá-üÑñ]", text)):
        text = ""
    f["text"] = text

    search_in = f.get("search_in") or []
    if not isinstance(search_in, list):
        search_in = []
    search_in = [s for s in {str(x).lower().strip() for x in search_in} if s in _ALLOWED_SEARCH_FIELDS]
    if not search_in:
        search_in = ["resumen2", "resumen", "tipo_gasto", "glosa", "detalle"]
    f["search_in"] = search_in

    # NUEVOS: modo, lógica, flags
    mode = _norm(f.get("text_mode") or "contains").lower()
    if mode not in _ALLOWED_TEXT_MODES:
        mode = "contains"
    f["text_mode"] = mode

    logic = _norm(f.get("search_logic") or "any").lower()
    if logic not in _ALLOWED_SEARCH_LOGIC:
        logic = "any"
    f["search_logic"] = logic

    f["case_insensitive"] = bool(f.get("case_insensitive", True))
    f["is_regex"] = bool(f.get("is_regex", False))

    include_siglas = f.get("include_siglas") or []
    if not isinstance(include_siglas, list):
        include_siglas = []
    include_siglas = [str(x).upper().strip() for x in include_siglas if str(x).strip()]
    if len(include_siglas) > 20:
        include_siglas = []
    f["include_siglas"] = include_siglas

    exclude_siglas = f.get("exclude_siglas") or []
    if not isinstance(exclude_siglas, list):
        exclude_siglas = []
    exclude_siglas = [str(x).upper().strip() for x in exclude_siglas if str(x).strip()]
    if len(exclude_siglas) > 20:
        exclude_siglas = []
    f["exclude_siglas"] = exclude_siglas

    ctas = []
    for x in (f.get("include_cuentas") or []):
        try:
            n = int(str(x).strip())
            if n > 0:
                ctas.append(n)
        except Exception:
            pass
    if len(ctas) > 30:
        ctas = []
    f["include_cuentas"] = ctas

    rut = f.get("rut")
    try:
        rut = int(str(rut))
        if rut <= 0:
            rut = None
    except Exception:
        rut = None
    if rut is None and "rut" in f:
        f.pop("rut", None)
    else:
        f["rut"] = rut

    obj["filters"] = f

    # view
    v = obj.get("view") or {}
    if not isinstance(v, dict):
        v = {}
    v["detail"] = bool(v.get("detail", False))
    v["yoy"] = bool(v.get("yoy", True))

    try:
        lg = int(v.get("limit_groups", 60))
    except Exception:
        lg = 60
    v["limit_groups"] = max(5, min(lg, 200))

    try:
        lr = int(v.get("limit_rows", 120))
    except Exception:
        lr = 120
    v["limit_rows"] = max(10, min(lr, 500))

    include_fields = v.get("include_fields") or []
    if not isinstance(include_fields, list):
        include_fields = []
    include_fields = [s for s in {str(x).lower().strip() for x in include_fields} if s in _ALLOWED_INCLUDE_FIELDS]
    if "glosa" in (text or "").lower():
        if "glosa" not in include_fields:
            include_fields = ["glosa"] + include_fields
        if "detalle" not in include_fields:
            include_fields.append("detalle")
    v["include_fields"] = include_fields[:4]

    obj["view"] = v
    obj["reason"] = _norm(obj.get("reason"))
    return obj

# -----------------------------
# SPEC
# -----------------------------

SPEC = FilterSpec(
    key="gastos",
    schema_text=(
        '{'
        '"period":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","tz":"America/Santiago"},'
        '"group_by":"auto"|"none"|"mes"|"sigla"|"cuenta"|"mes_sigla",'
        '"filters":{'
            '"text":"",'
            '"search_in":["resumen2"|"resumen"|"tipo_gasto"|"glosa"|"detalle"],'
            '"text_mode":"contains"|"word"|"prefix"|"suffix"|"regex",'
            '"search_logic":"any"|"all",'
            '"case_insensitive":true,'
            '"is_regex":false,'
            '"include_siglas":["..."],'
            '"exclude_siglas":["..."],'
            '"include_cuentas":[123],'
            '"rut":12345678'
        '},'
        '"view":{'
            '"detail":false,'
            '"yoy":true,'
            '"limit_groups":60,'
            '"limit_rows":120,'
            '"include_fields":["glosa"|"detalle"|"tipo_gasto"|"resumen"|"resumen2"]'
        '},'
        '"reason":""'
        '}'
    ),
    rules_text=(
        "- Interpreta fechas NATURALES a period.start/end (ISO). "
        "'este año' => start='YYYY-01-01', end='YYYY-MM-DD' (hoy).\n"
        "- group_by: 'por mes'->'mes'; 'por local/sucursal/sigla'->'sigla'; "
        "'por mes y por local'->'mes_sigla'; 'por cuenta'->'cuenta'; 'sin agrupar'->'none'.\n"
        "- filters.text busca en 'search_in'; controla modo con 'text_mode' y 'search_logic'. "
        "NO pongas fechas en 'text'.\n"
        "- No expandas siglas/cuentas si el usuario no las pide.\n"
        "- view.limit_* para evitar textos gigantes; view.yoy activa/desactiva YoY."
    ),
    catalogs=[
        ("CUENTAS(cuenta:resumen2:resumen:nombre)", _catalog_gastos_cuentas),
        ("SUCURSALES(sigla:nombre)", _catalog_gastos_sucursales),
    ],
    postprocess=_postprocess,
)
register_filter_spec(SPEC)


ENGINE_ROUTES = {
    "gastos": {
        "intent": "gastos",
        "kind": "filter_handler",
        "filter_key": "gastos",
        "filter_timeout": 2.5,
        "handler": "utils.bot.movimientos.gastos:handle_gastos",
        "handler_timeout": 6.0,
        # Pasamos el spec completo al contexto para evitar reparsear dentro del handler.
        "filter_to_context": {"__full__": "gastos_spec"},
        # Acceso: niveles 1-7. El handler interno restringe lvl6 por sucursal y lvl7 por RUT.
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Config declarativa de qué partes del payload son relevantes para el resumen con Grok.
        # El engine sólo sigue estas secciones; no sabe nada de "gastos".
        "summary": {
            "data_table": {
                "include_generic": True,
                "sections": {
                    # Totales agregados en ambos modos (agrupado/detalle)
                    "totals": {
                        "root_key": "totals",
                        # cargo/abono/count siempre existen; prev_cargo sólo en YoY.
                        "fields": ["cargo", "abono", "count", "prev_cargo"],
                    },
                },
            },
        },
        "default_payload": {
            "type": "text_block_list",
            "intent": "gastos",
            "lines": [
                "No hay datos de gastos ahora.",
            ],
        },
    },
}
