import re
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm

# -----------------------------
# Catálogos opcionales (ligeros)
# -----------------------------

def _catalog_sucursales(limit=300) -> List[str]:
    rows = list(db.gastos_refs_sucursales.find({}, {"_id": 0, "sigla": 1, "location.nombre": 1}).limit(limit))
    out = []
    for r in rows:
        sig = _norm(r.get("sigla")).upper()
        nom = _norm((r.get("location") or {}).get("nombre"))
        if sig:
            out.append(f"{sig}:{nom}")
    return out

def _catalog_cargos(limit=300) -> List[str]:
    rows = list(db.cargos_intranet.find({}, {"_id": 0, "cargo": 1, "seccion": 1}).limit(limit))
    return [f"{_norm(r.get('cargo'))}:{_norm(r.get('seccion'))}" for r in rows if r.get("cargo")]

# -----------------------------
# Helpers
# -----------------------------

_ALLOWED_GROUPS = {
    "auto","none","mes","ano","sigla","seccion","cargo","sexo","afp","isapre","rut",
    "mes_sigla","sigla_seccion","sigla_afp","sigla_cargo","rut_sigla"
}
_ALLOWED_METRICS = {"sum","avg","count"}
_ALLOWED_ORDERS  = {"value_desc","value_asc","group_asc"}
_ALLOWED_NAME_FIELDS = {"nombres","apellidopaterno","apellidomaterno"}

def _yyyymm_ok(s: str) -> bool:
    return bool(re.fullmatch(r"\d{6}", s))

def _norm_month(s: str) -> str:
    s = (_norm(s) or "").replace("-", "")
    return s if _yyyymm_ok(s) else ""

def _postprocess(obj: dict) -> dict:
    # ---------------- period ----------------
    # Soportamos: yyyymm, year, start/end, months[], preset
    per = obj.get("period") or {}
    if not isinstance(per, dict):
        per = {"yyyymm": _norm_month(str(per))}
    yyyymm = _norm_month(per.get("yyyymm") or "")
    year   = _norm(per.get("year"))
    try:
        year = int(year) if str(year).isdigit() else None
    except Exception:
        year = None
    start  = _norm_month(per.get("start") or "")
    end    = _norm_month(per.get("end") or "")
    months = per.get("months") or []
    if not isinstance(months, list): months = []
    months = [_norm_month(m) for m in months if _norm_month(m)]
    preset = (_norm(per.get("preset")) or "").lower()  # "este_mes","mes_pasado","este_ano","ano_pasado","custom"

    per_norm = {"yyyymm": yyyymm, "year": year, "start": start, "end": end, "months": months, "preset": preset, "tz": _norm(per.get("tz") or "America/Santiago")}
    obj["period"] = per_norm

    # ---------------- group_by/metric/order ----------------
    gb = (_norm(obj.get("group_by")) or "auto").lower()
    if gb not in _ALLOWED_GROUPS:
        gb = "auto"
    obj["group_by"] = gb

    metric = (_norm(obj.get("metric")) or "sum").lower()
    if metric not in _ALLOWED_METRICS:
        metric = "sum"
    obj["metric"] = metric

    order_by = (_norm(obj.get("order_by")) or "value_desc").lower()
    if order_by not in _ALLOWED_ORDERS:
        order_by = "value_desc"
    obj["order_by"] = order_by

    # ---------------- filters ----------------
    f = obj.get("filters") or {}
    if not isinstance(f, dict): f = {}

    def _norm_list(xs):
        if not isinstance(xs, list): return []
        out = []
        for x in xs:
            s = _norm(x)
            if s: out.append(s)
        return out

    f["include_siglas"]    = [s.upper() for s in _norm_list(f.get("include_siglas"))][:30]
    f["include_secciones"] = _norm_list(f.get("include_secciones"))[:40]
    f["include_cargos"]    = _norm_list(f.get("include_cargos"))[:60]

    # RUTs sin DV
    inc_ruts = []
    for x in _norm_list(f.get("include_ruts")):
        try:
            rs = re.sub(r"[\.\-kK]", "", x)
            if len(rs) > 8: rs = rs[:-1]
            v = int(rs)
            if v > 0: inc_ruts.append(v)
        except Exception:
            pass
    f["include_ruts"] = inc_ruts

    f["sexo_in"]   = [s.lower() for s in _norm_list(f.get("sexo_in")) if s.lower() in {"m","f"}]
    f["afp_in"]    = _norm_list(f.get("afp_in"))
    f["isapre_in"] = _norm_list(f.get("isapre_in"))

    name_text = _norm(f.get("name_text"))
    if name_text and not re.search(r"[A-Za-zÁ-Üá-üÑñ]", name_text):
        name_text = ""
    f["name_text"] = name_text

    nf = f.get("name_fields") or ["nombres","apellidopaterno","apellidomaterno"]
    if not isinstance(nf, list): nf = []
    nf = [s for s in {str(x).lower().strip() for x in nf} if s in _ALLOWED_NAME_FIELDS]
    if not nf:
        nf = ["nombres","apellidopaterno","apellidomaterno"]
    f["name_fields"] = nf

    obj["filters"] = f

    # ---------------- view ----------------
    v = obj.get("view") or {}
    if not isinstance(v, dict): v = {}
    v["detail"] = bool(v.get("detail", False))
    try:
        lg = int(v.get("limit_groups", 80))
    except Exception:
        lg = 80
    v["limit_groups"] = max(5, min(lg, 300))
    try:
        lr = int(v.get("limit_rows", 200))
    except Exception:
        lr = 200
    v["limit_rows"] = max(10, min(lr, 800))
    inc = v.get("include_fields") or []
    if not isinstance(inc, list): inc = []
    v["include_fields"] = [str(x).lower().strip() for x in inc][:6]
    v["yoy"] = bool(v.get("yoy", False))
    obj["view"] = v

    obj["reason"] = _norm(obj.get("reason"))
    return obj

SPEC = FilterSpec(
    key="sueldos",
    schema_text=(
        '{'
          '"period":{'
            '"yyyymm":"YYYYMM",'
            '"year":2025,'
            '"start":"YYYYMM","end":"YYYYMM",'
            '"months":["YYYYMM","YYYYMM"],'
            '"preset":"este_mes"|"mes_pasado"|"este_ano"|"ano_pasado"|"custom",'
            '"tz":"America/Santiago"'
          '},'
          '"group_by":"auto"|"none"|"mes"|"ano"|"sigla"|"seccion"|"cargo"|"sexo"|"afp"|"isapre"|"rut"|"mes_sigla"|"sigla_seccion"|"sigla_afp"|"sigla_cargo"|"rut_sigla",'
          '"metric":"sum"|"avg"|"count",'
          '"order_by":"value_desc"|"value_asc"|"group_asc",'
          '"filters":{'
            '"include_siglas":["ALM","POE"],'
            '"include_secciones":["cocina","sala"],'
            '"include_cargos":["Copero","Maestro Cocina"],'
            '"include_ruts":[12345678],'
            '"sexo_in":["m","f"],'
            '"afp_in":["Habitat"],'
            '"isapre_in":["Fonasa"],'
            '"name_text":"Pilar",'
            '"name_fields":["nombres","apellidopaterno","apellidomaterno"]'
          '},'
          '"view":{"detail":false,"limit_groups":80,"limit_rows":200,"include_fields":["cargo","seccion"],"yoy":false},'
          '"reason":""'
        '}'
    ),
    rules_text=(
        "- Si el usuario dice 'este año', devuelve period.preset='este_ano' y period.year=<año actual> y period.months enumerado de ENE al mes actual.\n"
        "- Si dice 'año pasado', devuelve preset='ano_pasado' y months con los 12 meses del año pasado.\n"
        "- Si da un rango ('2024-11 a 2025-02'), usa start/end y months completo del rango.\n"
        "- Si da un mes específico, usa yyyymm y también months:[yyyymm].\n"
        "- Si menciona 'rut 12345678' o 'RUT 12.345.678-9', pon filters.include_ruts:[12345678] (sin DV).\n"
        "- 'por local/sucursal/sigla' => group_by='sigla'; 'por mes y por local' => 'mes_sigla'; 'por año' => 'ano'; 'por rut y local' => 'rut_sigla'; "
        "'por seccion' => 'seccion'; 'por cargo' => 'cargo'; 'por AFP' => 'afp'.\n"
        "- 'promedio' => metric='avg'; 'cantidad' => 'count'; por defecto 'sum'.\n"
        "- Devuelve SOLO el JSON del esquema."
    ),
    catalogs=[
        ("SUCURSALES(sigla:nombre)", _catalog_sucursales),
        ("CARGOS(cargo:seccion)", _catalog_cargos),
    ],
    postprocess=_postprocess,
)
register_filter_spec(SPEC)


# Metadata declarativa de la intent 'sueldos' para el router de intents (common.grok_route_intent)
INTENT_META = {
    "key": "sueldos",
    "desc": "Remuneraciones/pagos de sueldos por período (mes/año), sucursal, cargo, sección o RUT.",
    "classification_hints": [
        "- Usa 'sueldos' cuando el usuario pregunte por sueldos, remuneraciones, liquidaciones, montos líquidos o imponibles de trabajadores.",
        "- Preguntas típicas: 'sueldos del personal de cocina este año', 'cuánto se ha pagado en sueldos en Rancagua', 'detalle de sueldo del RUT 12.345.678'.",
        "- 'sueldos' trabaja con periodos YYYYMM/year/months y filtros por sigla, seccion, cargo, rut, sexo, AFP, isapre y name_text.",
        "- No uses 'sueldos' para consultas de ventas ni gastos contables; sólo para remuneraciones de trabajadores.",
    ],
}


ENGINE_ROUTES = {
    "sueldos": {
        "intent": "sueldos",
        "kind": "filter_handler",
        "filter_key": "sueldos",
        "filter_timeout": 2.5,
        "handler": "utils.bot.movimientos.sueldos:handle_sueldos",
        "handler_timeout": 8.0,
        # Pasamos el spec completo al contexto para evitar reparsear dentro del handler.
        "filter_to_context": {"__full__": "sueldos_spec"},
        # Acceso: niveles 1-7. El handler interno restringe lvl6 por sucursal y lvl7 por RUT.
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Config declarativa de qué partes del payload son relevantes para el resumen con Grok.
        # El engine sólo sigue estas secciones; no sabe nada de "sueldos".
        "summary": {
            # Tanto _handle_detail_view como _handle_grouped_view devuelven data_table
            "data_table": {
                "include_generic": True,
                "sections": {
                    # Totales agregados (monto o valor y cantidad de registros)
                    "totals": {
                        "root_key": "totals",
                        # Algunos payloads usan 'amount', otros 'value' + 'count'; mandamos todos.
                        "fields": ["amount", "value", "count"],
                    },
                },
            },
        },
        "default_payload": {
            "type": "text_block_list",
            "intent": "sueldos",
            "lines": [
                "No hay datos de sueldos ahora.",
            ],
        },
    },
}
