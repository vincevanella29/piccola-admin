import re
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm

# -----------------------------
# Catálogos (ayudan a Grok)
# -----------------------------

def _catalog_locales(limit=200) -> List[str]:
    try:
        locals_list = sorted(list({str(x) for x in db.ventas_locales.distinct("local") if x}), key=str)
    except Exception:
        locals_list = []
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

def _catalog_waiters(limit=400) -> List[str]:
    """RUT|Nombre|Cargo desde sales_by_waiter_hour"""
    rows = list(db.sales_by_waiter_hour.find(
        {"trabajador_resumen": {"$exists": True}},
        {"_id":0, "RUT":1, "trabajador_resumen.nombres":1, "trabajador_resumen.apellidopaterno":1, "trabajador_resumen.cargo":1}
    ).limit(2000))
    seen, out = set(), []
    for r in rows:
        rut = str(r.get("RUT") or "")
        if rut and rut not in seen:
            seen.add(rut)
            tr = r.get("trabajador_resumen") or {}
            nom = " ".join([_norm(tr.get("nombres")), _norm(tr.get("apellidopaterno"))]).strip()
            cargo = _norm(tr.get("cargo"))
            out.append(f"{rut}|{nom}|{cargo}")
            if len(out) >= limit: break
    return out

def _catalog_weather_tags() -> List[str]:
    return ["lluvia","soleado","nieve","otro","sin_dato"]

# -----------------------------
# Helpers
# -----------------------------

def _catalog_doc_example() -> List[str]:
    """Ejemplo de documento en sales_by_waiter_hour (ayuda a Grok a mapear campos)."""
    example = {
        "_id": {"$oid": "689b82038e4b0a920ffe222d"},
        "CANTIDAD": 1,
        "CARGO": "Garzon",
        "CODIGO_PRODUCTO": "0102014",
        "EMPLEADO": "27231747 Biachi Larrarte Rivas",
        "FAMILIA": "01 ENTRADAS",
        "FECHA": "Tue, 01 Jul 2025 00:00:00 GMT",
        "LOCAL": "PRVLOC",
        "MESANO": 202507,
        "PRODUCTO": "0102014 AROS MILAN UN",
        "RUT": 27231747,
        "SEMANA_MES": 1,
        "SUBFAMILIA": "0102 CALIENTES",
        "TOTAL": 3999,
        "trabajador_resumen": {
            "rut": 27231747,
            "nombres": "Biachi",
            "apellidopaterno": "Larrarte",
            "apellidomaterno": "Rivas",
            "cargo": "Garzon",
            "profile_image_url": "https://cdn.lapiccolaitalia.cl/trabajadores/27231747.jpg"
        }
    }
    import json as _json
    # lo devolvemos como líneas para el catálogo
    txt = _json.dumps(example, ensure_ascii=False)
    return [txt]

_ALLOWED_GROUPS = {
    "auto","none",
    "hora","dow","dia","semana_mes","mes",
    "local","rut","producto","familia","subfamilia",
    "hora_local","dow_local","dia_local","semana_mes_local",
    "rut_hora","producto_hora","rut_local",
    "weather","dia_weather","hora_weather","dow_weather"
}
_ALLOWED_MEASURES = {"total","cantidad","avg_precio"}
_ALLOWED_ORDERS  = {"value_desc","value_asc","group_asc"}

def _iso_date(s: str) -> str:
    s = (_norm(s) or "").strip().replace("/", "-")
    return s if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) else ""

def _postprocess(obj: dict) -> dict:
    # period
    per = obj.get("period") or {}
    if not isinstance(per, dict): per = {}
    start = _iso_date(per.get("start") or "")
    end   = _iso_date(per.get("end") or "")
    preset = (_norm(per.get("preset")) or "").lower()  # hoy|ayer|este_mes|mes_pasado|este_ano|custom
    tz = _norm(per.get("tz") or "America/Santiago")
    if preset not in {"hoy","ayer","este_mes","mes_pasado","este_ano","custom"}:
        preset = "custom" if (start and end) else "este_mes"
    obj["period"] = {"start": start, "end": end, "preset": preset, "tz": tz}

    # group_by / measure / order
    gb = (_norm(obj.get("group_by")) or "auto").lower()
    if gb not in _ALLOWED_GROUPS: gb = "auto"
    obj["group_by"] = gb

    meas = (_norm(obj.get("measure")) or "total").lower()
    if meas not in _ALLOWED_MEASURES: meas = "total"
    obj["measure"] = meas

    ob = (_norm(obj.get("order_by")) or "value_desc").lower()
    if ob not in _ALLOWED_ORDERS: ob = "value_desc"
    obj["order_by"] = ob

    # filters
    f = obj.get("filters") or {}
    if not isinstance(f, dict): f = {}
    def _norm_list(xs):
        if not isinstance(xs, list): return []
        out = []
        for x in xs:
            s = _norm(x); 
            if s: out.append(s)
        return out
    f["include_locals"]     = _norm_list(f.get("include_locals"))[:60]
    f["include_siglas"]     = [s.upper() for s in _norm_list(f.get("include_siglas"))][:40]
    f["include_ruts"]       = [int(s) if str(s).isdigit() else str(s) for s in _norm_list(f.get("include_ruts"))][:200]
    f["include_codigos"]    = [s.upper() for s in _norm_list(f.get("include_codigos"))][:400]
    f["include_familias"]   = [s.upper() for s in _norm_list(f.get("include_familias"))][:100]
    f["include_subfamilias"]= [s.upper() for s in _norm_list(f.get("include_subfamilias"))][:200]
    # hora y dow
    def _coerce_hour(h):
        try:
            hh = int(str(h).strip())
            return max(0, min(23, hh))
        except Exception:
            return None
    f["hour_in"]   = [h for h in [_coerce_hour(x) for x in _norm_list(f.get("hour_in"))] if h is not None][:24]
    f["dow_in"]    = [s.lower() for s in _norm_list(f.get("dow_in")) if s.lower() in {"lunes","martes","miercoles","miércoles","jueves","viernes","sabado","sábado","domingo"}][:7]
    try:
        sm = [int(x) for x in _norm_list(f.get("semana_mes_in"))]
        f["semana_mes_in"] = [x for x in sm if 1 <= x <= 5][:5]
    except Exception:
        f["semana_mes_in"] = []
    f["weather_in"]= [s.lower() for s in _norm_list(f.get("weather_in")) if s.lower() in {"lluvia","soleado","nieve","otro","sin_dato"}][:5]
    # anulaciones (TOTAL<0)
    try:
        only_canc = f.get("only_cancellations")
        f["only_cancellations"] = bool(only_canc)
    except Exception:
        f["only_cancellations"] = False
    obj["filters"] = f

    # view
    v = obj.get("view") or {}
    if not isinstance(v, dict): v = {}
    try: lg = int(v.get("limit_groups", 120))
    except Exception: lg = 120
    v["limit_groups"] = max(5, min(lg, 400))
    try: lr = int(v.get("limit_rows", 300))
    except Exception: lr = 300
    v["limit_rows"] = max(10, min(lr, 1000))
    cmpv = (_norm(v.get("compare")) or "none").lower()
    if cmpv not in {"yoy","mom","none"}: cmpv = "none"
    v["compare"] = cmpv
    v["detail"] = bool(v.get("detail", False))
    inc = v.get("include_fields") or []
    if not isinstance(inc, list): inc = []
    v["include_fields"] = [str(x).lower().strip() for x in inc][:8]  # p.ej.: ["cantidad","avg_precio","weather"]
    obj["view"] = v

    obj["reason"] = _norm(obj.get("reason"))
    return obj

SPEC = FilterSpec(
    key="ventas_hora",
    schema_text=(
        '{'
          '"period":{"preset":"hoy"|"ayer"|"este_mes"|"mes_pasado"|"este_ano"|"custom","start":"YYYY-MM-DD","end":"YYYY-MM-DD","tz":"America/Santiago"},'
          '"group_by":"auto"|"none"|"hora"|"dow"|"dia"|"semana_mes"|"mes"|"local"|"rut"|"producto"|"familia"|"subfamilia"|"hora_local"|"dow_local"|"dia_local"|"semana_mes_local"|"rut_hora"|"producto_hora"|"weather"|"dia_weather"|"hora_weather"|"dow_weather",'
          '"measure":"total"|"cantidad"|"avg_precio",'
          '"order_by":"value_desc"|"value_asc"|"group_asc",'
          '"filters":{"include_locals":["ALMLOC"],"include_siglas":["ALM"],"include_ruts":[12345678],"include_codigos":["0204047"],"include_familias":["01 ENTRADAS"],"include_subfamilias":["0102 CALIENTES"],"hour_in":[16,17],"dow_in":["lunes","jueves"],"semana_mes_in":[2],"weather_in":["lluvia"],"only_cancellations":false},'
          '"view":{"detail":false,"limit_groups":120,"limit_rows":300,"include_fields":["cantidad","avg_precio","weather"],"compare":"mom"},'
          '"reason":""'
        '}'
    ),
    rules_text=(
        "- Dimensiones principales de agrupación: 'familia', 'subfamilia', 'producto', 'local', 'rut', 'hora', 'dow', 'dia', 'semana_mes', 'mes'.\n"
        "- Si el usuario dice explícitamente 'agrupadas por familia' o 'por familia', usa group_by='familia' incluso si también menciona 'por hora' en la frase.\n"
        "- Si dice 'agrupadas por subfamilia' o menciona una subfamilia (p.ej. 'platos calientes/frías'), usa group_by='subfamilia'.\n"
        "- 'por hora' => group_by='hora'; 'por día de semana' => 'dow'; 'por día' => 'dia'; 'por semana del mes' => 'semana_mes'; 'por mes' => 'mes'.\n"
        "- 'agrupado por local' suma con 'hora_local'/'dow_local'/'dia_local' según corresponda.\n"
        "- 'por garzón' / 'por RUT 12345678' => group_by='rut' y filters.include_ruts=[...].\n"
        "- 'por RUT y local' / 'por garzón y local' => group_by='rut_local'.\n"
        "- 'por producto/código 0204047' => group_by='producto' y filters.include_codigos.\n"
        "- 'Alameda/Providencia/...' (nombres) => usar filters.include_siglas=['ALM','PRV'] cuando no entreguen códigos ALMLOC explícitos.\n"
        "- 'platos calientes/frías' => usar include_subfamilias=['0102 CALIENTES'] etc; 'familia 01 ENTRADAS' => include_familias y group_by='familia' si dicen 'agrupado por familia'.\n"
        "- 'a las 4 pm' => filters.hour_in=[16]; 'entre 4 y 6 pm' => [16,17,18].\n"
        "- 'lunes'/'fin de semana' => filters.dow_in=['lunes'] o ['sábado','domingo'].\n"
        "- 'segunda semana' => filters.semana_mes_in=[2].\n"
        "- 'con lluvia/soleado/nieve' => filters.weather_in=[...]; si piden comparar climas => group_by='weather' o variantes *_weather.\n"
        "- Medidas: 'venta' => measure='total'; 'unidades' => 'cantidad'; 'precio promedio' => 'avg_precio' (total/cantidad).\n"
        "- Fechas naturales (hoy/ayer/este mes/mes pasado/este año) o rango 'YYYY-MM-DD a YYYY-MM-DD'.\n"
        "- Comparación: por defecto NO compares => 'view.compare'='none'. Si el usuario pide comparar (palabras: 'compara','comparar','vs','versus','contra') y no especifica tipo => 'view.compare'='yoy'. Si especifica 'año pasado' o 'YoY' => 'yoy'. Si especifica 'mes pasado','MoM','mes vs mes' => 'mom'.\n"
        "- 'anulación/anulaciones/anulado/anular/nota de crédito' => filters.only_cancellations=true. 'excluir anulaciones' => filters.only_cancellations=false.\n"
        "- Devuelve SOLO el JSON exacto del esquema."
    ),
    catalogs=[
        ("LOCALES(local:sigla:nombre)", _catalog_locales),
        ("GARZONES(rut|nombre|cargo)", _catalog_waiters),
        ("WEATHER_TAGS", _catalog_weather_tags),
        ("VENTAS_HORA_DOC_EXAMPLE(json)", _catalog_doc_example),
    ],
    postprocess=_postprocess,
)
register_filter_spec(SPEC)


ENGINE_ROUTES = {
    "ventas_hora": {
        "intent": "ventas_hora",
        "kind": "filter_handler",
        "filter_key": "ventas_hora",
        "filter_timeout": 2.5,
        "handler": "utils.bot.movimientos.ventas_hora:handle_ventas_hora",
        "handler_timeout": 6.0,
        # Pasamos el spec completo al contexto para evitar reparsear dentro del handler.
        "filter_to_context": {"__full__": "ventas_hora_filters"},
        # Acceso: niveles 1-7. El handler interno aplica más restricciones (sucursal/RUT) según permisos.
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Config declarativa de qué partes del payload son relevantes para el resumen con Grok.
        # El engine sólo sigue estas secciones; no sabe nada de "ventas por hora".
        "summary": {
            "data_table": {
                "include_generic": True,
                "sections": {
                    # Totales de la métrica principal (value) y cantidad de ítems agregados
                    "totals": {
                        "root_key": "totals",
                        "fields": ["value", "count"],
                    },
                },
            },
        },
        "default_payload": {
            "type": "text_block_list",
            "intent": "ventas_hora",
            "lines": [
                "No hay datos de ventas por hora ahora.",
            ],
        },
    },
}
