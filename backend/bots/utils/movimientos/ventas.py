import logging, re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional, Tuple

from utils.web3mongo import db
from ..common.common import get_link_info
from ..common.filters import grok_filters

logger = logging.getLogger(__name__)

# ---------------------------
# Helpers de fechas/periodo
# ---------------------------

def _resolve_period(per: Dict) -> Tuple[datetime, datetime, str, str, ZoneInfo]:
    """
    Recibe period = {"preset","start","end","tz"} y entrega start/end (aware, end exclusivo),
    más strings YYYY-MM-DD y tz.
    """
    tz = ZoneInfo((per.get("tz") or "America/Santiago"))
    now = datetime.now(tz).date()
    preset = (per.get("preset") or "").lower()
    s = e = None

    def _parse(d: str):
        return datetime.fromisoformat(d).date()

    try:
        if preset == "hoy":
            s = e = now
        elif preset == "ayer":
            s = e = (now - timedelta(days=1))
        elif preset == "este_mes":
            s = now.replace(day=1)
            if s.month == 12:
                next_first = s.replace(year=s.year + 1, month=1, day=1)
            else:
                next_first = s.replace(month=s.month + 1, day=1)
            e = next_first - timedelta(days=1)
        elif preset == "mes_pasado":
            first_this = now.replace(day=1)
            last_month_last = first_this - timedelta(days=1)
            s = last_month_last.replace(day=1); e = last_month_last
        elif preset == "este_ano":
            s = now.replace(month=1, day=1); e = now
        else:  # custom
            st = (per.get("start") or "").strip()
            en = (per.get("end") or "").strip()
            if st and en:
                s = _parse(st); e = _parse(en)
    except Exception:
        s = e = None

    if not s or not e:
        # fallback: este mes
        s = now.replace(day=1)
        if s.month == 12:
            next_first = s.replace(year=s.year + 1, month=1, day=1)
        else:
            next_first = s.replace(month=s.month + 1, day=1)
        e = next_first - timedelta(days=1)

    start_dt = datetime.combine(s, datetime.min.time()).replace(tzinfo=tz)
    end_excl = datetime.combine(e, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)
    return start_dt, end_excl, s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d"), tz

def _cap_loaded_end(end_excl: datetime, tz: ZoneInfo) -> datetime:
    """
    Capa por carga nocturna (Chile ~04:00). Si piden futuro o día en curso no cargado, recorta.
    """
    now = datetime.now(tz)
    if now.hour >= 4:
        loaded_until = now.date() - timedelta(days=1)
    else:
        loaded_until = now.date() - timedelta(days=2)
    cap_end = datetime.combine(loaded_until, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)
    return min(end_excl, cap_end)

# ---------------------------
# Otros helpers
# ---------------------------

def _derive_sigla_expr_from_local():
    # "ALMLOC" -> "ALM"
    return {"$toUpper": {"$substrCP": [{"$ifNull": ["$local",""]}, 0, 3]}}

def _date_str_expr():
    return {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}

def _weather_tag_expr():
    """
    Compute tag desde doc de weather (ya en '$weather').
    Orden de prioridad: nieve > lluvia > soleado > otro > sin_dato
    """
    return {
        "$let": {
            "vars": {
                "w": {"$ifNull": ["$weather", {}]},
                "prec": {"$ifNull": ["$weather.precipitation_sum", 0]},
                "rain": {"$ifNull": ["$weather.rain_sum", 0]},
                "snow": {"$ifNull": ["$weather.snowfall_sum", 0]},
                "wr": {"$ifNull": ["$weather.was_raining", False]},
                "ws": {"$ifNull": ["$weather.was_snowing", False]},
            },
            "in": {
                "$cond": [
                    {"$or": ["$$ws", {"$gt": ["$$snow", 0]}]},
                    "nieve",
                    {
                        "$cond": [
                            {"$or": ["$$wr", {"$gt": ["$$rain", 0]}, {"$gt": ["$$prec", 0]}]},
                            "lluvia",
                            {
                                "$cond": [
                                    {"$and": [{"$eq": ["$$prec", 0]}, {"$eq": ["$$wr", False]}]},
                                    "soleado",
                                    {
                                        "$cond": [
                                            {"$gt": [{"$strLenCP": {"$toString": "$$w"}}, 0]},
                                            "otro",
                                            "sin_dato"
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    }

def _weekday_short_es(date_str: str) -> str:
    """Devuelve abreviatura del día de la semana en español (lun, mar, mié, jue, vie, sáb, dom)."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        i = d.weekday()  # 0=lun .. 6=dom
        names = ["lun","mar","mié","jue","vie","sáb","dom"]
        return names[i]
    except Exception:
        return ""

def _build_group_expr(group_by: str):
    if group_by == "none": return {"$literal":"-"}
    if group_by == "dia":  return {"$dateToString":{"format":"%Y-%m-%d","date":"$fecha_norm"}}
    if group_by == "mes":  return {"$dateToString":{"format":"%Y-%m","date":"$fecha_norm"}}
    if group_by == "local": return {"$ifNull": ["$local","-"]}
    if group_by == "weather": return {"$ifNull": ["$weather_tag","sin_dato"]}
    if group_by == "dia_local":
        return {"$concat":[{"$dateToString":{"format":"%Y-%m-%d","date":"$fecha_norm"}}, " | ", {"$ifNull":["$local","-"]}]}
    if group_by == "mes_local":
        return {"$concat":[{"$dateToString":{"format":"%Y-%m","date":"$fecha_norm"}}, " | ", {"$ifNull":["$local","-"]}]}
    if group_by == "local_weather":
        return {"$concat":[{"$ifNull":["$local","-"]}, " | ", {"$ifNull":["$weather_tag","sin_dato"]}]}
    if group_by == "mes_weather":
        return {"$concat":[{"$dateToString":{"format":"%Y-%m","date":"$fecha_norm"}}, " | ", {"$ifNull":["$weather_tag","sin_dato"]}]}
    if group_by == "dia_weather":
        return {"$concat":[{"$dateToString":{"format":"%Y-%m-%d","date":"$fecha_norm"}}, " | ", {"$ifNull":["$weather_tag","sin_dato"]}]}
    if group_by == "dia_local_weather":
        return {"$concat":[
            {"$dateToString":{"format":"%Y-%m-%d","date":"$fecha_norm"}}, " | ",
            {"$ifNull":["$local","-"]}, " | ",
            {"$ifNull":["$weather_tag","sin_dato"]}
        ]}
    return {"$literal":"-"}

# ---------------------------
# Comparatives helpers (MoM/YoY)
# ---------------------------

def _days_in_month(y:int, m:int)->int:
    import calendar
    return calendar.monthrange(y, m)[1]

def _shift_month(d: datetime, delta: int) -> datetime:
    y = d.year + (d.month - 1 + delta) // 12
    m = (d.month - 1 + delta) % 12 + 1
    day = min(d.day, _days_in_month(y, m))
    return d.replace(year=y, month=m, day=day)

def _previous_period(start_dt: datetime, end_excl: datetime, mode: str) -> tuple[datetime, datetime]:
    """Devuelve rango anterior (end exclusivo) para 'yoy' o 'mom'."""
    if mode == "yoy":
        try:
            return start_dt.replace(year=start_dt.year-1), end_excl.replace(year=end_excl.year-1)
        except ValueError:
            delta = end_excl - start_dt
            from datetime import timedelta as _td
            return start_dt - _td(days=365), end_excl - _td(days=365)
    if mode == "mom":
        s = start_dt
        e = end_excl
        # si es mes completo (1..primer día mes siguiente) -> mes previo completo
        if s.day == 1 and e.time() == datetime.min.time() and _shift_month(s, 1).date() == e.date():
            s_prev = _shift_month(s, -1)
            e_prev = s  # end exclusivo
            return s_prev, e_prev
        # general: mismo largo de días
        delta = e - s
        return s - delta, e - delta
    return None, None

# ---------------------------
# Handler principal (SPEC-driven)
# ---------------------------

async def handle_ventas(update, context):
    text = update.message.text or ""

    # Link
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[ventas_handler] incoming tg_id={tg_id}, text='{text}'")
    link = get_link_info(tg_id) if tg_id else None
    if not link:
        return update, ["Primero conecta tu cuenta con Privy para ver ventas. Usa /link."]
    if link.get("expired"):
        return update, ["Tu sesión de Privy expiró. Usa /link para volver a conectar y después pide 'ventas'."]

    # 1) SPEC
    vf = await grok_filters("ventas", text) or {}
    logger.info(f"[ventas] spec_raw => {vf}")

    per = vf.get("period") or {}
    start_dt, end_excl, s_str, e_str, tz = _resolve_period(per)
    end_excl = _cap_loaded_end(end_excl, tz)
    # Asegura rango no vacío si recortó de más
    if end_excl <= start_dt:
        start_dt = end_excl - timedelta(days=1)

    group_by = (vf.get("group_by") or "auto").lower()
    metric   = (vf.get("metric") or "sum").lower()
    measure  = (vf.get("measure") or "total").lower()
    order_by = (vf.get("order_by") or "value_desc").lower()
    view     = vf.get("view") or {}
    detail   = bool(view.get("detail", False))
    limit_groups = int(view.get("limit_groups", 120))
    limit_rows   = int(view.get("limit_rows", 300))
    yoy      = bool(view.get("yoy", True))
    compare  = (view.get("compare") or ("yoy" if yoy else "none")).lower()
    include_fields = [str(x).lower() for x in (view.get("include_fields") or [])]

    f = vf.get("filters") or {}
    include_locals = [str(x) for x in (f.get("include_locals") or [])]
    include_siglas = [str(x).upper() for x in (f.get("include_siglas") or [])]
    weather_in     = [str(x).lower() for x in (f.get("weather_in") or [])]

    # Resolver 'auto'
    if group_by == "auto":
        # si mencionan weather y no piden 'detalle', agrupa por weather
        group_by = "weather" if (weather_in or re.search(r"lluvia|solead|nieve", text, flags=re.I)) and not detail else ("mes_local" if not detail else "none")

    # Forzar orden cronológico cuando el agrupamiento contiene fecha (día/mes)
    date_based_groups = {"dia","mes","dia_local","mes_local","mes_weather","dia_weather","dia_local_weather"}
    if group_by in date_based_groups:
        order_by = "group_asc"

    # 2) Pipeline base (ventas + clima)
    stages: List[Dict] = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha"}, "date"]},
                    "$fecha",
                    {"$toDate": "$fecha"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start_dt.replace(tzinfo=None), "$lt": end_excl.replace(tzinfo=None)}}},
        {"$addFields": {"_sigla": _derive_sigla_expr_from_local(), "date_str": _date_str_expr()}},
        # Join con clima por (permalink_slug==local) y fecha YYYY-MM-DD
        {"$lookup": {
            "from": "weather_daily",
            "let": {"slug": "$local", "d": "$date_str"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$permalink_slug", "$$slug"]},
                    {"$eq": [{"$dateToString":{"format":"%Y-%m-%d","date":"$date"}}, "$$d"]}
                ]}}},
                {"$project": {"_id":0, "temp_max":1,"temp_min":1,"precipitation_sum":1,"rain_sum":1,"snowfall_sum":1,"was_raining":1,"was_snowing":1}}
            ],
            "as": "w"
        }},
        {"$addFields": {"weather": {"$arrayElemAt": ["$w", 0]}}},
        {"$addFields": {"weather_tag": _weather_tag_expr()}},
        {"$project": {
            "local": 1, "fecha_norm": 1, "date_str":1, "_sigla":1, "weather_tag":1,
            "total": {"$ifNull": ["$total", 0]},
            "subtotal": {"$ifNull": ["$subtotal", 0]},
            "mesas": {"$ifNull": ["$mesas", 0]},
            "personas": {"$ifNull": ["$personas", 0]},
        }}
    ]

    # Filtros
    if include_locals:
        stages += [{"$match": {"local": {"$in": include_locals}}}]
    if include_siglas:
        stages += [{"$match": {"_sigla": {"$in": include_siglas}}}]
    if weather_in:
        stages += [{"$match": {"weather_tag": {"$in": weather_in}}}]

    # 3) Detalle o agrupado
    pretty_range = f"{s_str} a {e_str}"

    # ---- Detalle (filas crudas día/local) ----
    if detail:
        stages_detail = stages + [
            {"$sort": {"local":1, "date_str":1}},
            {"$limit": int(max(10, limit_rows))}
        ]
        rows = list(db.ventas_locales.aggregate(stages_detail))
        total = sum(r.get("total",0) for r in rows)
        lines = [f"Nonna Marriana dice: Ventas {pretty_range} (detalle, máx {limit_rows}).",
                 f"Total ${total:,.0f}, ítems {len(rows)}.",
                 "", "Detalle:"]
        for r in rows:
            extra = []
            if "mesas" in include_fields: extra.append(f"mesas {int(r.get('mesas',0))}")
            if "personas" in include_fields: extra.append(f"pers {int(r.get('personas',0))}")
            if "ticket_persona" in include_fields and r.get("personas",0):
                extra.append(f"tck/pers ${ (r['total']/max(r['personas'],1)) :,.0f}")
            if "ticket_mesa" in include_fields and r.get("mesas",0):
                extra.append(f"tck/mesa ${ (r['total']/max(r['mesas'],1)) :,.0f}")
            extr = (" | " + " · ".join(extra)) if extra else ""
            ds = r.get('date_str')
            dow = _weekday_short_es(ds)
            wd = f" ({dow})" if dow else ""
            lines.append(f"- {ds}{wd} [{r.get('local')}] clima {r.get('weather_tag')}: ${r.get('total',0):,.0f}{extr}")
        
        return update,lines

    # ---- Agrupado ----
    group_expr = _build_group_expr(group_by)
    stages_group = stages + [
        {"$addFields": {"group": group_expr}},
        {"$group": {
            "_id": "$group",
            "sum_total": {"$sum": "$total"},
            "sum_personas": {"$sum": "$personas"},
            "sum_mesas": {"$sum": "$mesas"},
            "count": {"$sum": 1},
            "weather_first": {"$first": "$weather_tag"}
        }},
        {"$addFields": {
            "ticket_persona": {
                "$cond":[{"$gt":["$sum_personas",0]}, {"$divide":["$sum_total", "$sum_personas"]}, 0]
            },
            "ticket_mesa": {
                "$cond":[{"$gt":["$sum_mesas",0]}, {"$divide":["$sum_total", "$sum_mesas"]}, 0]
            }
        }}
    ]
    # 'value' según measure+metric
    if measure == "total":
        value_expr = {"sum":"$sum_total", "avg":{"$divide":["$sum_total", {"$max":["$count",1]}]}, "count":"$count"}[metric]
    elif measure == "personas":
        value_expr = {"sum":"$sum_personas", "avg":{"$divide":["$sum_personas", {"$max":["$count",1]}]}, "count":"$count"}[metric]
    elif measure == "mesas":
        value_expr = {"sum":"$sum_mesas", "avg":{"$divide":["$sum_mesas", {"$max":["$count",1]}]}, "count":"$count"}[metric]
    elif measure == "ticket_persona":
        value_expr = "$ticket_persona"
    else:
        value_expr = "$ticket_mesa"
    stages_group += [{"$addFields": {"value": value_expr}}]
    if order_by == "group_asc":
        stages_group += [{"$sort": {"_id": 1}}]
    elif order_by == "value_asc":
        stages_group += [{"$sort": {"value": 1}}]
    else:
        stages_group += [{"$sort": {"value": -1}}]
    stages_group += [{"$limit": int(max(5, limit_groups))}]
    grouped = list(db.ventas_locales.aggregate(stages_group))

    # Comparativo (yoy/mom/none)
    yoy_line = ""
    if compare != "none":
        s_prev, e_prev = _previous_period(start_dt, end_excl, compare)
        base_prev = [
            {"$addFields": {
                "fecha_norm": {
                    "$cond": [
                        {"$eq": [{"$type": "$fecha"}, "date"]},
                        "$fecha",
                        {"$toDate": "$fecha"}
                    ]
                }
            }},
            {"$match": {"fecha_norm": {"$gte": s_prev.replace(tzinfo=None), "$lt": e_prev.replace(tzinfo=None)}}},
            {"$addFields": {"_sigla": _derive_sigla_expr_from_local(), "date_str": _date_str_expr()}},
        ]
        if include_locals:
            base_prev += [{"$match": {"local": {"$in": include_locals}}}]
        if include_siglas:
            base_prev += [{"$match": {"_sigla": {"$in": include_siglas}}}]
        if weather_in:
            base_prev += [
                {"$lookup": {
                    "from": "weather_daily",
                    "let": {"slug": "$local", "d": "$date_str"},
                    "pipeline": [
                        {"$match": {"$expr": {"$and": [
                            {"$eq": ["$permalink_slug", "$$slug"]},
                            {"$eq": [{"$dateToString":{"format":"%Y-%m-%d","date":"$date"}}, "$$d"]}
                        ]}}}
                    ],
                    "as": "w"
                }},
                {"$addFields": {"weather": {"$arrayElemAt": ["$w", 0]}}},
                {"$addFields": {"weather_tag": _weather_tag_expr()}},
                {"$match": {"weather_tag": {"$in": weather_in}}}
            ]
        base_prev += [{"$group": {
            "_id": None,
            "sum_total": {"$sum": {"$ifNull":["$total",0]}},
            "sum_personas": {"$sum": {"$ifNull":["$personas",0]}},
            "sum_mesas": {"$sum": {"$ifNull":["$mesas",0]}},
            "count": {"$sum": 1}
        }}]
        prev_doc = next(iter(db.ventas_locales.aggregate(base_prev)), None) or {}
        base_cur = stages + [
            {"$group": {
                "_id": None,
                "sum_total": {"$sum": "$total"},
                "sum_personas": {"$sum": "$personas"},
                "sum_mesas": {"$sum": "$mesas"},
                "count": {"$sum": 1}
            }}
        ]
        cur_doc = next(iter(db.ventas_locales.aggregate(base_cur)), None) or {}
        def _value_total(doc: dict)->float:
            st = float(doc.get("sum_total",0))
            sp = float(doc.get("sum_personas",0))
            sm = float(doc.get("sum_mesas",0))
            c  = float(doc.get("count",0) or 1)
            if measure == "total":     return st if metric!="avg" else (st/max(c,1))
            if measure == "personas":  return sp if metric!="avg" else (sp/max(c,1))
            if measure == "mesas":     return sm if metric!="avg" else (sm/max(c,1))
            if measure == "ticket_persona": return (st/max(sp,1))
            return (st/max(sm,1))
        prev_total = _value_total(prev_doc)
        cur_total  = _value_total(cur_doc)
        delta = cur_total - prev_total
        tag = "YoY" if compare=="yoy" else "MoM"
        def fmt(v):
            if measure in {"personas","mesas"} and metric!="count": return f"{int(v):,}"
            return f"${v:,.0f}"
        yoy_line = f" | {tag}: {fmt(prev_total)} → {fmt(cur_total)} (Δ {fmt(delta)})"

    label_by = group_by.replace("_"," y ")
    nice_meas = {"total":"ventas","personas":"personas","mesas":"mesas","ticket_persona":"ticket promedio (persona)","ticket_mesa":"ticket promedio (mesa)"}[measure]
    lines = [f"Nonna Marriana dice: {nice_meas.capitalize()} {pretty_range} agrupado por {label_by}{yoy_line}."]
    for g in grouped:
        v = g.get("value", 0)
        extra = []
        if "mesas" in include_fields: extra.append(f"mesas {int(g.get('sum_mesas',0))}")
        if "personas" in include_fields: extra.append(f"pers {int(g.get('sum_personas',0))}")
        if "ticket_persona" in include_fields: extra.append(f"tck/pers ${g.get('ticket_persona',0):,.0f}")
        if "ticket_mesa" in include_fields: extra.append(f"tck/mesa ${g.get('ticket_mesa',0):,.0f}")
        if "weather" in include_fields and g.get("weather_first"):
            extra.append(f"clima {g['weather_first']}")
        extr = (" | " + " · ".join(extra)) if extra else ""
        if measure.startswith("ticket"):
            main = f"${v:,.0f}"
        elif measure in {"personas","mesas"} and metric != "count":
            main = f"{int(v):,}"
        else:
            main = f"${v:,.0f}" if measure=="total" or metric=="count" else f"{v:,.0f}"
        gid = g.get('_id')
        # Si el grupo empieza con fecha YYYY-MM-DD, añade día de semana.
        dow_sfx = ""
        if isinstance(gid, str) and re.match(r"^\d{4}-\d{2}-\d{2}", gid):
            ds = gid.split(" | ")[0]
            dwn = _weekday_short_es(ds)
            dow_sfx = f" ({dwn})" if dwn else ""
        lines.append(f"- {gid}{dow_sfx}: {main}{extr} ({g.get('count',0)} días)")

    return update, lines
