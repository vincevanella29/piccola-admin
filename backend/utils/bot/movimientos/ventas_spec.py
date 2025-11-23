import re
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm

# -----------------------------
# Catálogos (ayudan a Grok)
# -----------------------------

def _catalog_locales(limit=200) -> List[str]:
    """
    Devuelve entradas tipo: LOCAL:SIGLA:NOMBRE
    Ej: 'ALMLOC:ALM:Alameda'
    Toma nombres desde gastos_refs_sucursales si coincide la sigla.
    """
    try:
        locals_list = sorted(list({str(x) for x in db.ventas_locales.distinct("local") if x}), key=str)
    except Exception:
        locals_list = []
    # mapa sigla->nombre
    sig2name = {}
    try:
        for r in db.gastos_refs_sucursales.find({}, {"_id":0,"sigla":1,"location.nombre":1}).limit(500):
            s = (_norm(r.get("sigla")) or "").upper()
            n = _norm((r.get("location") or {}).get("nombre"))
            if s:
                sig2name[s] = n
    except Exception:
        pass
    out = []
    for loc in locals_list[:limit]:
        sig = loc[:3].upper()
        nom = sig2name.get(sig, "")
        out.append(f"{loc}:{sig}:{nom}")
    return out

def _catalog_weather_tags() -> List[str]:
    """
    Tags de clima soportados por el handler.
    """
    return ["lluvia","soleado","nieve","otro","sin_dato"]

# -----------------------------
# Helpers
# -----------------------------

_ALLOWED_GROUPS = {
    "auto","none","dia","mes","local","weather",
    "dia_local","mes_local","local_weather","mes_weather",
    "dia_weather","dia_local_weather"
}
_ALLOWED_METRICS = {"sum","avg","count"}  # por ahora usamos sum de 'total'; avg => ticket medio pronto
_ALLOWED_ORDERS  = {"value_desc","value_asc","group_asc"}

def _iso_date(s: str) -> str:
    s = (_norm(s) or "").strip()
    # Acepta 'YYYY-MM-DD' o 'YYYY/MM/DD'
    s = s.replace("/", "-")
    return s if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) else ""

def _postprocess(obj: dict) -> dict:
    # ------------- period -------------
    per = obj.get("period") or {}
    if not isinstance(per, dict): per = {}
    start = _iso_date(per.get("start") or "")
    end   = _iso_date(per.get("end") or "")
    preset = (_norm(per.get("preset")) or "").lower()  # hoy|ayer|este_mes|mes_pasado|este_ano|custom
    tz = _norm(per.get("tz") or "America/Santiago")
    # normaliza preset si no hay fechas
    if preset not in {"hoy","ayer","este_mes","mes_pasado","este_ano","custom"}:
        preset = "custom" if (start and end) else "este_mes"
    obj["period"] = {"start": start, "end": end, "preset": preset, "tz": tz}

    # ------------- group_by / metric / order -------------
    gb = (_norm(obj.get("group_by")) or "auto").lower()
    if gb not in _ALLOWED_GROUPS: gb = "auto"
    obj["group_by"] = gb

    met = (_norm(obj.get("metric")) or "sum").lower()
    if met not in _ALLOWED_METRICS: met = "sum"
    obj["metric"] = met

    ob = (_norm(obj.get("order_by")) or "value_desc").lower()
    if ob not in _ALLOWED_ORDERS: ob = "value_desc"
    obj["order_by"] = ob
    # ------------- measure -------------
    meas = (_norm(obj.get("measure")) or "total").lower()
    if meas not in {"total","personas","mesas","ticket_persona","ticket_mesa"}:
        meas = "total"
    obj["measure"] = meas

    # ------------- filters -------------
    f = obj.get("filters") or {}
    if not isinstance(f, dict): f = {}
    def _norm_list(xs):
        if not isinstance(xs, list): return []
        out = []
        for x in xs:
            s = _norm(x)
            if s: out.append(s)
        return out
    f["include_locals"] = _norm_list(f.get("include_locals"))[:60]  # ALMLOC, PRVLOC, ...
    f["include_siglas"] = [s.upper() for s in _norm_list(f.get("include_siglas"))][:40]  # ALM, PRV...
    f["weather_in"]     = [s.lower() for s in _norm_list(f.get("weather_in")) if s.lower() in {"lluvia","soleado","nieve","otro","sin_dato"}][:5]
    obj["filters"] = f

    # ------------- view -------------
    v = obj.get("view") or {}
    if not isinstance(v, dict): v = {}
    v["detail"] = bool(v.get("detail", False))
    try:
        lg = int(v.get("limit_groups", 120))
    except Exception:
        lg = 120
    v["limit_groups"] = max(5, min(lg, 400))
    try:
        lr = int(v.get("limit_rows", 300))
    except Exception:
        lr = 300
    v["limit_rows"] = max(10, min(lr, 1000))
    v["yoy"] = bool(v.get("yoy", True))
    cmpv = (_norm(v.get("compare")) or "").lower()
    if cmpv not in {"yoy","mom","none"}:
        cmpv = "yoy" if v["yoy"] else "none"
    v["compare"] = cmpv
    inc = v.get("include_fields") or []
    if not isinstance(inc, list): inc = []
    v["include_fields"] = [str(x).lower().strip() for x in inc][:6]
    obj["view"] = v

    obj["reason"] = _norm(obj.get("reason"))
    return obj

SPEC = FilterSpec(
    key="ventas",
    schema_text=(
        '{'
          '"period":{"preset":"hoy"|"ayer"|"este_mes"|"mes_pasado"|"este_ano"|"custom","start":"YYYY-MM-DD","end":"YYYY-MM-DD","tz":"America/Santiago"},'
          '"group_by":"auto"|"none"|"dia"|"mes"|"local"|"weather"|"dia_local"|"mes_local"|"local_weather"|"mes_weather"|"dia_weather"|"dia_local_weather",'
          '"metric":"sum"|"avg"|"count",'
          '"measure":"total"|"personas"|"mesas"|"ticket_persona"|"ticket_mesa",'
          '"order_by":"value_desc"|"value_asc"|"group_asc",'
          '"filters":{"include_locals":["ALMLOC"],"include_siglas":["ALM"],"weather_in":["lluvia","soleado"]},'
          '"view":{"detail":false,"limit_groups":120,"limit_rows":300,"include_fields":["mesas","personas","ticket_persona","ticket_mesa","weather"],"yoy":true,"compare":"yoy"|"mom"|"none"},'
          '"reason":""'
        '}'
    ),
    rules_text=(
        "- Si dicen 'este año' => period.preset='este_ano'.\n"
        "- Si dan rango ('2025-01-01 a 2025-03-15') => preset='custom' con start/end.\n"
        "- 'por día' => group_by='dia'; 'por mes' => 'mes'; 'por local' => 'local'; "
        "'por día y por local' => 'dia_local'; 'por mes y por local' => 'mes_local'; "
        "'por día y clima' => 'dia_weather'; 'por día, local y clima' => 'dia_local_weather'.\n"
        "- Si mencionan lluvia/soleado/nieve (o sinónimos: 'llovió/lloviendo', 'despejado/soleados', 'nevó/nevando') => "
        "   si piden 'en ... y ...' agrupa por 'weather'; si piden 'en días de lluvia' filtra weather_in=['lluvia'].\n"
        "- Si preguntan por PERSONAS: usar measure='personas' (p. ej. '¿cuántas personas este mes?').\n"
        "- Si preguntan por MESAS: measure='mesas'.\n"
        "- 'ticket promedio' => por defecto measure='ticket_persona'. Si dicen 'por mesa', usar 'ticket_mesa'.\n"
        "- 'local con mejor ticket promedio' => group_by='local', measure='ticket_persona', order_by='value_desc'.\n"
        "- 'día con más personas' => group_by='dia', measure='personas', order_by='value_desc', view.limit_groups=1.\n"
        "- Comparativos: 'vs año pasado' => view.compare='yoy'; 'vs mes pasado' => view.compare='mom'.\n"
        "- 'Alameda/Providencia/...' mapear a include_siglas=['ALM','PRV']; si dice 'ALMLOC' directo => include_locals.\n"
        "- 'detalle' => view.detail=true.\n"
        "- Devuelve SOLO el JSON exacto del esquema."
    ),
    catalogs=[
        ("LOCALES(local:sigla:nombre)", _catalog_locales),
        ("WEATHER_TAGS", _catalog_weather_tags),
    ],
    postprocess=_postprocess,
)
register_filter_spec(SPEC)


# Metadata declarativa de la intent 'ventas' para el router de intents (common.grok_route_intent)
INTENT_META = {
    "key": "ventas",
    "desc": "Ventas generales por fecha/rango (totales, personas, mesas, ticket promedio), sin granularidad horaria.",
    "classification_hints": [
        "- Usa 'ventas' cuando pregunten por ventas totales de un periodo (día/mes/año/semana) o por local, sin énfasis en 'por hora'.",
        "- Preguntas típicas: 'ventas totales de este mes', 'cuántas personas atendimos la semana pasada', 'ticket promedio por local en octubre'.",
        "- 'ventas' usa period.preset/start/end, group_by dia/mes/local/weather y measures total/personas/mesas/ticket_persona/ticket_mesa.",
        "- Si piden ventas por hora, por garzón, por día de semana u hora específica, clasifica como 'ventas_hora'.",
    ],
}


ENGINE_ROUTES = {
    "ventas": {
        "intent": "ventas",
        "kind": "filter_handler",
        "filter_key": "ventas",
        "filter_timeout": 2.5,
        "handler": "utils.bot.movimientos.ventas:handle_ventas",
        "handler_timeout": 6.0,
        # Pasamos el spec completo al contexto para evitar reparsear dentro del handler.
        "filter_to_context": {"__full__": "ventas_spec"},
        # Acceso: solo niveles 1-6. Nivel 6 verá solo sus sucursales permitidas (scope interno en handler).
        # Para niveles que no tengan acceso directo (p. ej. nivel 7 garzón), el engine puede intentar
        # redirigir a intents relacionados declarados en "related_intents".
        "access": {
            "min_role_level": 1,
            "max_role_level": 6,
        },
        # Intents relacionados: si el usuario no tiene acceso a 'ventas' pero sí a alguno de estos,
        # el engine puede rutear automáticamente a ese intent alternativo (p. ej. ventas_hora para lvl7).
        "related_intents": ["ventas_hora"],
        # Config declarativa de qué partes del payload son relevantes para el resumen con Grok.
        # El engine sólo recorre estas secciones, sin conocer la semántica de "ventas".
        "summary": {
            # Payload principal de handle_ventas es un data_table agrupado
            "data_table": {
                "include_generic": True,
                "sections": {
                    # Totales agregados (para que Grok vea monto/personas/mesas globales)
                    "totals": {
                        "root_key": "totals",
                        "fields": ["value", "personas", "mesas"],
                    },
                },
            },
        },
        "default_payload": {
            "type": "text_block_list",
            "intent": "ventas",
            "lines": [
                "No hay datos de ventas ahora.",
            ],
        },
    },
}
