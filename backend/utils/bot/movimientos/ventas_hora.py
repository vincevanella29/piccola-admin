import re
import logging
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from utils.web3mongo import db
# OJO: este handler NO llama a grok_filters; el bot lo hace antes y mete
# el resultado en context.user_data["ventas_hora_filters"].

logger = logging.getLogger(__name__)

COLL = "sales_by_waiter_hour"
WEATHER_COLL = "weather_daily"

DOW_ES = {1:"lunes",2:"martes",3:"miercoles",4:"jueves",5:"viernes",6:"sabado",7:"domingo"}

def _resolve_period(per: Dict) -> Tuple[datetime, datetime, str, str, ZoneInfo]:
    tz = ZoneInfo((per.get("tz") or "America/Santiago"))
    now = datetime.now(tz).date()
    preset = (per.get("preset") or "").lower()
    s = e = None
    def _parse(d: str): return datetime.fromisoformat(d).date()
    try:
        if preset == "hoy": s=e=now
        elif preset == "ayer": s=e=(now - timedelta(days=1))
        elif preset == "este_mes":
            s = now.replace(day=1)
            n1 = s.replace(year=s.year+1,month=1,day=1) if s.month==12 else s.replace(month=s.month+1,day=1)
            e = n1 - timedelta(days=1)
        elif preset == "mes_pasado":
            f = now.replace(day=1); lp = f - timedelta(days=1)
            s = lp.replace(day=1); e = lp
        elif preset == "este_ano":
            s = now.replace(month=1, day=1); e = now
        else:
            st = (per.get("start") or "").strip()
            en = (per.get("end") or "").strip()
            if st and en:
                s = _parse(st); e = _parse(en)
    except Exception:
        s = e = None
    if not s or not e:
        s = now.replace(day=1)
        n1 = s.replace(year=s.year+1,month=1,day=1) if s.month==12 else s.replace(month=s.month+1,day=1)
        e = n1 - timedelta(days=1)

    start_dt = datetime.combine(s, datetime.min.time()).replace(tzinfo=tz)
    end_excl = datetime.combine(e, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)
    return start_dt, end_excl, s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d"), tz

def _cap_loaded_end(end_excl: datetime, tz: ZoneInfo) -> datetime:
    now = datetime.now(tz)
    loaded_until = now.date() - timedelta(days=(1 if now.hour>=4 else 2))
    cap_end = datetime.combine(loaded_until, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)
    return min(end_excl, cap_end)

def _weather_tag_expr():
    return {
        "$let": {
            "vars": {"w": {"$ifNull": ["$weather", {}]}},
            "in": {
                "$cond":[
                    {"$or":[{"$ifNull":["$$w.was_snowing",False]},{"$gt":[{"$ifNull":["$$w.snowfall_sum",0]},0]}]}, "nieve",
                    {"$cond":[
                        {"$or":[{"$ifNull":["$$w.was_raining",False]},{"$gt":[{"$ifNull":["$$w.rain_sum",0]},0]},{"$gt":[{"$ifNull":["$$w.precipitation_sum",0]},0]}]}, "lluvia",
                        {"$cond":[
                            {"$and":[{"$eq":[{"$ifNull":["$$w.precipitation_sum",0]},0]},{"$eq":[{"$ifNull":["$$w.was_raining",False]},False]}]}, "soleado",
                            {"$cond":[{"$gt":[{"$strLenCP":{"$toString":"$$w"}},0]},"otro","sin_dato"]}
                        ]}
                    ]}
                ]
            }
        }
    }

def _build_group_expr(gb: str):
    if gb == "none": return {"$literal":"-"}
    if gb == "hora": return {"$toString":"$H"}
    if gb == "dow":  return {"$ifNull":["$DOW_NAME","-"]}
    if gb == "dia":  return {"$ifNull":["$DATE_STR","-"]}
    if gb == "mes":  return {"$ifNull":["$MONTH_STR","-"]}
    if gb == "semana_mes": return {"$toString":"$SEMANA_MES2"}
    if gb == "local": return {"$ifNull":["$LOCAL","-"]}
    if gb == "rut":   return {"$toString":{"$ifNull":["$RUT","-"]}}
    if gb == "producto": return {"$ifNull":["$CODIGO_PRODUCTO","-"]}
    if gb == "familia":  return {"$ifNull":["$FAMILIA","-"]}
    if gb == "subfamilia": return {"$ifNull":["$SUBFAMILIA","-"]}
    if gb == "hora_local": return {"$concat":[{"$toString":"$H"}," | ",{"$ifNull":["$LOCAL","-"]}]}
    if gb == "dow_local":  return {"$concat":[{"$ifNull":["$DOW_NAME","-"]}," | ",{"$ifNull":["$LOCAL","-"]}]}
    if gb == "dia_local":  return {"$concat":[{"$ifNull":["$DATE_STR","-"]}," | ",{"$ifNull":["$LOCAL","-"]}]}
    if gb == "semana_mes_local": return {"$concat":[{"$toString":"$SEMANA_MES2"}," | ",{"$ifNull":["$LOCAL","-"]}]}
    if gb == "rut_hora": return {"$concat":[{"$toString":{"$ifNull":["$RUT","-"]}}," | ",{"$toString":"$H"}]}
    if gb == "rut_local": return {"$concat":[{"$toString":{"$ifNull":["$RUT","-"]}}," | ",{"$ifNull":["$LOCAL","-"]}]}
    if gb == "producto_hora": return {"$concat":[{"$ifNull":["$CODIGO_PRODUCTO","-"]}," | ",{"$toString":"$H"}]}
    if gb == "weather": return {"$ifNull":["$WEATHER_TAG","sin_dato"]}
    if gb == "dia_weather": return {"$concat":[{"$ifNull":["$DATE_STR","-"]}," | ",{"$ifNull":["$WEATHER_TAG","sin_dato"]}]}
    if gb == "hora_weather": return {"$concat":[{"$toString":"$H"}," | ",{"$ifNull":["$WEATHER_TAG","sin_dato"]}]}
    if gb == "dow_weather":  return {"$concat":[{"$ifNull":["$DOW_NAME","-"]}," | ",{"$ifNull":["$WEATHER_TAG","sin_dato"]}]}
    return {"$literal":"-"}

def _fmt(measure: str, v: float) -> str:
    # CLP estilo chileno: miles con punto
    if measure == "cantidad":
        return f"{int(v):,} uds".replace(",", ".")
    # total y avg_precio con formato $ 9.999
    return f"$ {v:,.0f}".replace(",", ".")

async def handle_ventas_hora(update, context):
    text = update.message.text or ""
    # Web context: skip Telegram link enforcement (handled at API layer)
    tg_user = getattr(update, 'effective_user', None)
    tg_id = getattr(tg_user, 'id', None) if tg_user else None

    # Filtros: vienen centralizados desde el bot (como en gastos).
    vf = context.user_data.get("ventas_hora_filters")
    if not isinstance(vf, dict) or not vf:
        # Si llegamos acá sin filtros, es uso incorrecto del handler.
        return update, [
            "Nonna no recibió filtros para ventas por hora. (Bug de orquestación: el bot debe llamar a grok_filters('ventas_hora') antes)."
        ]
    per = vf.get("period") or {}
    start_dt, end_excl, s_str, e_str, tz = _resolve_period(per)
    end_excl = _cap_loaded_end(end_excl, tz)
    if end_excl <= start_dt: start_dt = end_excl - timedelta(days=1)
    # Mongo guarda Date en UTC: matchear con ventana en UTC naive
    from zoneinfo import ZoneInfo as _ZI
    _UTC = _ZI("UTC")
    match_start = start_dt.astimezone(_UTC).replace(tzinfo=None)
    match_end   = end_excl.astimezone(_UTC).replace(tzinfo=None)

    group_by = (vf.get("group_by") or "auto").lower()
    measure  = (vf.get("measure") or "total").lower()
    order_by = (vf.get("order_by") or "value_desc").lower()
    view     = vf.get("view") or {}
    limit_groups = int(view.get("limit_groups", 120))
    compare  = (view.get("compare") or "none").lower()
    detail   = bool(view.get("detail", False))
    include_fields = [str(x).lower() for x in (view.get("include_fields") or [])]

    f = vf.get("filters") or {}
    include_locals     = [str(x) for x in (f.get("include_locals") or [])]
    include_siglas     = [str(x).upper() for x in (f.get("include_siglas") or [])]
    # normaliza nombres a sigla si el usuario puso “alameda/providencia/...”. Si no hay siglas ya, derivar de nombres
    if not include_siglas and include_locals:
        guess = [x[:3].upper() for x in include_locals if isinstance(x, str) and len(x) >= 3]
        include_siglas = list({*include_siglas, *guess})
    include_ruts       = f.get("include_ruts") or []
    include_codigos    = [str(x).upper() for x in (f.get("include_codigos") or [])]
    include_familias   = [str(x).upper() for x in (f.get("include_familias") or [])]
    include_subfamilias= [str(x).upper() for x in (f.get("include_subfamilias") or [])]
    hour_in            = f.get("hour_in") or []
    dow_in             = [("miercoles" if d in {"miércoles","miercoles"} else d) for d in (f.get("dow_in") or [])]
    semana_mes_in      = f.get("semana_mes_in") or []
    weather_in         = f.get("weather_in") or []

    # Resolver 'auto'
    if group_by == "auto":
        if hour_in and not detail: group_by = "hora"
        elif dow_in and not detail: group_by = "dow"
        else: group_by = "hora_local"  # default útil para comparativos rápidos

    # Base pipeline
    tz_name = str(tz)
    stages: List[Dict] = [
        {"$addFields": {
            "_ts": {
                "$cond":[
                    {"$eq":[{"$type":"$FECHA"},"date"]},
                    "$FECHA",
                    {"$toDate":"$FECHA"}
                ]
            }
        }},
        {"$match": {"_ts": {"$gte": match_start, "$lt": match_end}}},
        {"$addFields": {
            "H": {"$ifNull": ["$HORA", {"$hour": {"date":"$_ts", "timezone": tz_name}}]},
            "DOW": {"$isoDayOfWeek": {"date":"$_ts", "timezone": tz_name}},
            "DATE_STR": {"$dateToString":{"format":"%Y-%m-%d","date":"$_ts","timezone":tz_name}},
            "MONTH_STR": {"$dateToString":{"format":"%Y-%m","date":"$_ts","timezone":tz_name}},
            "SEMANA_MES2": {"$ifNull": ["$SEMANA_MES", {"$ceil":{"$divide":[{"$dayOfMonth":{"date":"$_ts","timezone":tz_name}},7]}}]},
            "_SIGLA": {"$toUpper": {"$substrCP":[{"$ifNull":["$LOCAL",""]},0,3]}},
        }},
        {"$addFields": {
            "DOW_NAME": {
                "$switch":{
                    "branches":[
                        {"case":{"$eq":["$DOW",1]},"then":"lunes"},
                        {"case":{"$eq":["$DOW",2]},"then":"martes"},
                        {"case":{"$eq":["$DOW",3]},"then":"miercoles"},
                        {"case":{"$eq":["$DOW",4]},"then":"jueves"},
                        {"case":{"$eq":["$DOW",5]},"then":"viernes"},
                        {"case":{"$eq":["$DOW",6]},"then":"sabado"},
                        {"case":{"$eq":["$DOW",7]},"then":"domingo"},
                    ],
                    "default":"-"
                }
            }
        }},
        {"$addFields": {
            "RUT_STR": {"$toString": {"$ifNull": ["$RUT", ""]}},
            "_name_from_trab": {
                "$trim": {"input": {"$concat": [
                    {"$ifNull": ["$trabajador_resumen.nombres", ""]},
                    " ",
                    {"$ifNull": ["$trabajador_resumen.apellidopaterno", ""]},
                    " ",
                    {"$ifNull": ["$trabajador_resumen.apellidomaterno", ""]}
                ]}}
            },
            "_name_from_empleado": {"$ifNull": ["$EMPLEADO", ""]}
        }},
        {"$addFields": {
            "WAITER_NAME": {"$cond": [
                {"$gt": [{"$strLenCP": {"$toString": {"$ifNull": ["$_name_from_trab", ""]}}}, 0]},
                "$_name_from_trab",
                {"$cond": [
                    {"$gt": [{"$strLenCP": {"$toString": {"$ifNull": ["$_name_from_empleado", ""]}}}, 0]},
                    "$_name_from_empleado",
                    {"$ifNull": ["$EMPLEADO", "-"]}
                ]}
            ]}
        }},
        {"$addFields": {
            "WAITER_PHOTO": {"$ifNull": ["$trabajador_resumen.profile_image_url", None]}
        }},
        {"$project": {
            "_id":0, "LOCAL":1, "RUT":1, "CODIGO_PRODUCTO":1, "FAMILIA":1, "SUBFAMILIA":1,
            "TOTAL": {"$ifNull":["$TOTAL",0]},
            "CANTIDAD": {"$ifNull":["$CANTIDAD",0]},
            "H":1, "DOW":1, "DOW_NAME":1, "DATE_STR":1, "MONTH_STR":1, "SEMANA_MES2":1, "_SIGLA":1,
            "RUT_STR":1, "WAITER_NAME":1, "WAITER_PHOTO":1
        }},
    ]

    # Join clima si piden clima o agrupan por weather
    if weather_in or ("weather" in group_by):
        stages += [
            {"$lookup": {
                "from": WEATHER_COLL,
                "let": {"slug":"$LOCAL","d":"$DATE_STR"},
                "pipeline":[
                    {"$match":{"$expr":{"$and":[
                        {"$eq":["$permalink_slug","$$slug"]},
                        {"$eq":[{"$dateToString":{"format":"%Y-%m-%d","date":"$date"}}, "$$d"]}
                    ]}}},
                    {"$project":{"_id":0,"precipitation_sum":1,"rain_sum":1,"snowfall_sum":1,"was_raining":1,"was_snowing":1}}
                ],
                "as":"w"
            }},
            {"$addFields":{"weather":{"$arrayElemAt":["$w",0]}}},
            {"$addFields":{"WEATHER_TAG": _weather_tag_expr()}},
            {"$project":{"w":0}}
        ]

    # Filtros
    if include_locals:
        # sólo matchea LOCAL si te mandaron códigos reales tipo ALMLOC/PRVLOC
        real_loc_codes = [x for x in include_locals if isinstance(x, str) and x.upper().endswith("LOC")]
        if real_loc_codes:
            stages += [{"$match":{"LOCAL":{"$in": real_loc_codes}}}]
    if include_siglas: stages += [{"$match":{"_SIGLA":{"$in": include_siglas}}}]
    if include_ruts:   stages += [{"$match":{"RUT":{"$in": include_ruts}}}]
    if include_codigos: stages += [{"$match":{"CODIGO_PRODUCTO":{"$in": include_codigos}}}]
    if include_familias: stages += [{"$match":{"FAMILIA":{"$in": include_familias}}}]
    if include_subfamilias: stages += [{"$match":{"SUBFAMILIA":{"$in": include_subfamilias}}}]
    if hour_in: stages += [{"$match":{"H":{"$in": hour_in}}}]
    if dow_in:
        _nums = []
        for d in dow_in:
            d = d.lower()
            if d == "miércoles": d = "miercoles"
            for k,v in DOW_ES.items():
                if v == d: _nums.append(k)
        if _nums:
            stages += [{"$match":{"DOW":{"$in": _nums}}}]
    if semana_mes_in: stages += [{"$match":{"SEMANA_MES2":{"$in": semana_mes_in}}}]
    if weather_in: stages += [{"$match":{"WEATHER_TAG":{"$in": weather_in}}}]
    # solo anulaciones (TOTAL<0)
    if bool((f.get("only_cancellations") or False)):
        stages += [{"$match": {"TOTAL": {"$lt": 0}}}]

    # Group
    gid = _build_group_expr(group_by)
    stages += [
        {"$addFields":{"_g": gid}},
        {"$group":{
            "_id":"$_g",
            "total":{"$sum":"$TOTAL"},
            "cantidad":{"$sum":"$CANTIDAD"},
            "count":{"$sum":1},
            "sample_local":{"$first":"$LOCAL"},
            "sample_date":{"$first":"$DATE_STR"},
            "sample_hour":{"$first":"$H"},
            "sample_dow":{"$first":"$DOW_NAME"},
            "sample_weather":{"$first":{"$ifNull":["$WEATHER_TAG", None]}},
            "sample_rut":{"$first":"$RUT_STR"},
            "sample_waiter_name":{"$first":"$WAITER_NAME"}
            ,"sample_waiter_photo":{"$first":"$WAITER_PHOTO"}
        }}
    ]
    # value segun medida
    if measure == "total":
        stages += [{"$addFields":{"value":"$total"}}]
    elif measure == "cantidad":
        stages += [{"$addFields":{"value":"$cantidad"}}]
    else:  # avg_precio
        stages += [{"$addFields":{"value":{"$cond":[{"$gt":["$cantidad",0]}, {"$divide":["$total","$cantidad"]}, 0]}}}]

    # order/limit
    if order_by == "group_asc": stages += [{"$sort":{"_id":1}}]
    elif order_by == "value_asc": stages += [{"$sort":{"value":1}}]
    else: stages += [{"$sort":{"value":-1}}]
    stages += [{"$limit": int(max(5, min(limit_groups, 400)))}]

    cur = list(db[COLL].aggregate(stages))
    if not cur:
        logger.info("[ventas_hora] vacío: %s", {
            "period": (s_str, e_str),
            "include_siglas": include_siglas,
            "include_locals": include_locals,
            "hour_in": hour_in, "dow_in": dow_in, "semana_mes_in": semana_mes_in
        })

    # Comparativo (mismo grupo) — MoM o YoY
    prev_map: Dict[str, float] = {}
    if (compare in {"mom","yoy"}) and cur:
        try:
            if compare == "yoy":
                s_prev = start_dt.replace(year=start_dt.year-1)
                e_prev = end_excl.replace(year=end_excl.year-1)
            else:
                # un mes atrás
                s = start_dt; e = end_excl
                first = s.replace(day=1)
                last_prev = first - timedelta(days=1)
                s_prev = last_prev.replace(day=1).replace(tzinfo=start_dt.tzinfo)
                e_prev = first.replace(tzinfo=end_excl.tzinfo)
        except Exception:
            s_prev = start_dt - timedelta(days=365)
            e_prev = end_excl - timedelta(days=365)

        prev_st = [
            {"$addFields":{"_ts":{"$cond":[{"$eq":[{"$type":"$FECHA"},"date"]},"$FECHA",{"$toDate":"$FECHA"}]}}},
            {"$match":{"_ts":{"$gte": s_prev.astimezone(_UTC).replace(tzinfo=None), "$lt": e_prev.astimezone(_UTC).replace(tzinfo=None)}}},
            {"$addFields":{
                "H": {"$ifNull": ["$HORA", {"$hour": {"date":"$_ts", "timezone": tz_name}}]},
                "DOW":{"$isoDayOfWeek":{"date":"$_ts","timezone": tz_name}},
                "DATE_STR":{"$dateToString":{"format":"%Y-%m-%d","date":"$_ts","timezone": tz_name}},
                "MONTH_STR":{"$dateToString":{"format":"%Y-%m","date":"$_ts","timezone": tz_name}},
                "SEMANA_MES2":{"$ifNull":["$SEMANA_MES", {"$ceil":{"$divide":[{"$dayOfMonth":{"date":"$_ts","timezone":tz_name}},7]}}]},
                "_SIGLA":{"$toUpper":{"$substrCP":[{"$ifNull":["$LOCAL",""]},0,3]}},
                "DOW_NAME":{
                    "$switch":{"branches":[
                        {"case":{"$eq":["$DOW",1]},"then":"lunes"},
                        {"case":{"$eq":["$DOW",2]},"then":"martes"},
                        {"case":{"$eq":["$DOW",3]},"then":"miercoles"},
                        {"case":{"$eq":["$DOW",4]},"then":"jueves"},
                        {"case":{"$eq":["$DOW",5]},"then":"viernes"},
                        {"case":{"$eq":["$DOW",6]},"then":"sabado"},
                        {"case":{"$eq":["$DOW",7]},"then":"domingo"},
                    ], "default":"-"}
                }
            }},
            {"$project":{
                "_id":0,"LOCAL":1,"RUT":1,"CODIGO_PRODUCTO":1,"FAMILIA":1,"SUBFAMILIA":1,
                "TOTAL":{"$ifNull":["$TOTAL",0]},"CANTIDAD":{"$ifNull":["$CANTIDAD",0]},
                "H":1,"DOW":1,"DOW_NAME":1,"DATE_STR":1,"MONTH_STR":1,"SEMANA_MES2":1,"_SIGLA":1
            }},
        ]
        if weather_in or ("weather" in group_by):
            prev_st += [
                {"$lookup":{
                    "from": WEATHER_COLL,
                    "let":{"slug":"$LOCAL","d":"$DATE_STR"},
                    "pipeline":[{"$match":{"$expr":{"$and":[
                        {"$eq":["$permalink_slug","$$slug"]},
                        {"$eq":[{"$dateToString":{"format":"%Y-%m-%d","date":"$date"}},"$$d"]}
                    ]}}}],
                    "as":"w"
                }},
                {"$addFields":{"weather":{"$arrayElemAt":["$w",0]}}},
                {"$addFields":{"WEATHER_TAG": _weather_tag_expr()}},
                {"$project":{"w":0}}
            ]
        # repetir filtros
        if include_locals:
            real_loc_codes = [x for x in include_locals if isinstance(x, str) and x.upper().endswith("LOC")]
            if real_loc_codes:
                prev_st += [{"$match":{"LOCAL":{"$in": real_loc_codes}}}]
        if include_siglas: prev_st += [{"$match":{"_SIGLA":{"$in": include_siglas}}}]
        if include_ruts: prev_st += [{"$match":{"RUT":{"$in": include_ruts}}}]
        if include_codigos: prev_st += [{"$match":{"CODIGO_PRODUCTO":{"$in": include_codigos}}}]
        if include_familias: prev_st += [{"$match":{"FAMILIA":{"$in": include_familias}}}]
        if include_subfamilias: prev_st += [{"$match":{"SUBFAMILIA":{"$in": include_subfamilias}}}]
        if hour_in: prev_st += [{"$match":{"H":{"$in": hour_in}}}]
        if dow_in:
            _nums=[]
            for d in dow_in:
                d = "miercoles" if d in {"miércoles","miercoles"} else d
                for k,v in DOW_ES.items():
                    if v==d: _nums.append(k)
            if _nums: prev_st += [{"$match":{"DOW":{"$in": _nums}}}]
        if semana_mes_in: prev_st += [{"$match":{"SEMANA_MES2":{"$in": semana_mes_in}}}]
        if weather_in: prev_st += [{"$match":{"WEATHER_TAG":{"$in": weather_in}}}]
        # solo anulaciones en prev
        if bool((f.get("only_cancellations") or False)):
            prev_st += [{"$match": {"TOTAL": {"$lt": 0}}}]

        gid_prev = _build_group_expr(group_by)
        prev_st += [
            {"$addFields":{"_g": gid_prev}},
            {"$group":{"_id":"$_g", "total":{"$sum":"$TOTAL"}, "cantidad":{"$sum":"$CANTIDAD"}}}
        ]
        prev_rows = list(db[COLL].aggregate(prev_st))
        for r in prev_rows:
            if measure == "total": prev_map[r["_id"]] = r.get("total",0) or 0
    pretty_range = f"{s_str} a {e_str}"
    label_by = "hora" if group_by == "hora" else group_by.replace("_"," y ")
    cmp_tag = "" if compare=="none" else (" · YoY" if compare=="yoy" else " · MoM")
    includes_rut = group_by in {"rut","rut_hora","rut_local"}

    columns = []
    if includes_rut:
        columns.append({"key":"image_url","label":"","type":"text","align":"left","format":"image","round":True})
        columns.append({"key":"waiter","label":"Garzón","type":"text","align":"left"})
    columns.append({"key":"group","label":label_by.title(),"type":"text","align":"left"})
    # Value column
    if measure == "cantidad":
        columns.append({"key":"value","label":"Unidades","type":"number","align":"right","format":"number"})
    elif measure == "avg_precio":
        columns.append({"key":"value","label":"Precio prom.","type":"number","align":"right","format":"money"})
    else:
        columns.append({"key":"value","label":"Total","type":"number","align":"right","format":"money"})
    columns.append({"key":"count","label":"Ítems","type":"number","align":"right","format":"number"})
    # Optional extras
    if "cantidad" in include_fields and measure != "cantidad":
        columns.append({"key":"cantidad","label":"Unidades","type":"number","align":"right","format":"number"})
    if "avg_precio" in include_fields and measure != "avg_precio":
        columns.append({"key":"avg_precio","label":"Precio prom.","type":"number","align":"right","format":"money"})
    if "weather" in include_fields:
        columns.append({"key":"weather","label":"Clima","type":"text","align":"left"})

    rows_out: List[Dict] = []
    total_value = 0.0
    total_count = 0
    for g in cur:
        key = g.get("_id")
        v = float(g.get("value", 0))
        row = {
            "group": key,
            "value": v,
            "count": int(g.get("count", 0) or 0),
        }
        if includes_rut:
            nm = g.get("sample_waiter_name") or ""
            try:
                nm = re.sub(r"^\d+\s*", "", nm)
            except Exception:
                pass
            nm = nm.strip()
            rut = g.get("sample_rut") or ""
            row["waiter"] = f"{nm} ({rut})" if nm or rut else (nm or rut or "-")
            photo = g.get("sample_waiter_photo") or None
            if photo:
                row["image_url"] = photo
        if "cantidad" in include_fields and measure != "cantidad":
            row["cantidad"] = int(g.get("cantidad", 0) or 0)
        if "avg_precio" in include_fields and measure != "avg_precio":
            c = float(g.get("cantidad", 0) or 0)
            ap = (float(g.get("total", 0)) / c) if c else 0.0
            row["avg_precio"] = ap
        if "weather" in include_fields:
            row["weather"] = g.get("sample_weather") or ""
        rows_out.append(row)
        total_value += v
        total_count += int(g.get("count", 0) or 0)

    payload = {
        "type": "data_table",
        "intent": "ventas_hora",
        "title": f"Ventas por hora — {pretty_range}",
        "subtitle": f"Agrupado por {label_by}{cmp_tag}",
        "columns": columns,
        "rows": rows_out,
        "kpis": [
            {"label": "Total", "value": int(total_value), "isMoney": measure in {"total", "avg_precio"}},
            {"label": "Grupos", "value": len(rows_out)},
            {"label": "Ítems", "value": int(total_count)},
        ],
        "totals": {"value": int(total_value), "count": int(total_count)}
    }
    return update, payload
