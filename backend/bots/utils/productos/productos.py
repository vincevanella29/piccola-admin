import re
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any
from collections import defaultdict
from zoneinfo import ZoneInfo

from utils.web3mongo import db
from ..common.common import get_link_info
from ..common.filters import grok_filters

logger = logging.getLogger(__name__)

# Colecciones base
RENTAB_COLL = "rentabilidad_producto_locales"       # mensual (mesano, codig, familia, subfamilia, centroproduccion, total_venta, total_margen, total_costo, cantidad, [local?])
DAILY_COLL  = "rentabilidad_producto_diaria"        # opcional: (date, local, codig, total_venta, total_margen, total_costo, cantidad)
WEATHER_COLL = "weather_daily"                      # (permalink_slug=local, date)

def _has_daily_products() -> bool:
    try:
        return DAILY_COLL in db.list_collection_names()
    except Exception:
        return False

def _prev_yyyymm(yyyymm: str) -> str:
    y, m = int(yyyymm[:4]), int(yyyymm[4:])
    if m == 1: return f"{y-1}12"
    return f"{y}{m-1:02d}"

def _yoy_yyyymm(yyyymm: str) -> str:
    y, m = int(yyyymm[:4]), int(yyyymm[4:])
    return f"{y-1}{m:02d}"

def _pct(new: float, old: float) -> str:
    try:
        if old == 0: return "∞"
        return f"{(new/old - 1)*100:.1f}%"
    except Exception:
        return "—"

def _map_categories() -> Tuple[Dict[str,str], Dict[str,List[str]]]:
    """Devuelve: id->name y name(lower)->[ids]"""
    ids2name, name2ids = {}, {}
    for c in db.categories.find({}, {"id":1, "nombre":1, "name":1}):
        cid = str(c.get("id") or c.get("_id") or "").strip()
        nm  = str(c.get("nombre") or c.get("name") or "").strip()
        if cid and nm:
            ids2name[cid] = nm
            key = nm.lower()
            name2ids.setdefault(key, []).append(cid)
    return ids2name, name2ids

def _menus_by_code() -> Dict[str,dict]:
    out = {}
    for m in db.menus.find({}, {"codigo":1,"nombre":1,"category_ids":1}):
        code = str(m.get("codigo") or "").strip()
        if code: out[code] = m
    return out

def _resolve_code_set(by: str, q: str, include_categories: List[str]) -> List[str]:
    """Delimita códigos por texto/categoría (opcional). Si no hay filtros, retorna []."""
    menus = _menus_by_code()
    ids2name, name2ids = _map_categories()
    codes = set()

    if by == "codigo" and q:
        codes.add(q.strip().upper())

    elif by == "nombre" and q:
        ql = q.lower()
        for code, m in menus.items():
            name = str(m.get("nombre") or "").lower()
            if ql in name: codes.add(code)

    elif by == "categoria" and q:
        # aceptar ID o nombre
        wanted_ids = set()
        if q.lower() in name2ids: wanted_ids.update(name2ids[q.lower()])
        if q in ids2name:         wanted_ids.add(q)
        if include_categories:
            for x in include_categories:
                if x.lower() in name2ids: wanted_ids.update(name2ids[x.lower()])
                if x in ids2name:         wanted_ids.add(x)
        for code, m in menus.items():
            cids = m.get("category_ids") or []
            if any(cid in cids for cid in wanted_ids):
                codes.add(code)
    else:
        # texto libre
        if q:
            ql = q.lower()
            for code, m in menus.items():
                if ql in code.lower() or ql in str(m.get("nombre") or "").lower():
                    codes.add(code)

        # sólo categorías via filters
        if include_categories and not codes:
            wanted_ids = set()
            for x in include_categories:
                if x.lower() in name2ids: wanted_ids.update(name2ids[x.lower()])
                if x in ids2name:         wanted_ids.add(x)
            for code, m in menus.items():
                cids = m.get("category_ids") or []
                if any(cid in cids for cid in wanted_ids):
                    codes.add(code)

    return list(sorted(codes))

def _build_group_key(group_by: str) -> Tuple[Dict,str]:
    """
    Devuelve (group_id_expr, label) para pipelines sobre RENTAB_COLL o DAILY_COLL.
    Campos disponibles en RENTAB_COLL: codig, familia, subfamilia, centroproduccion, mesano, [local?]
    En DAILY_COLL: codig, local, date (-> %Y-%m, %Y-%m-%d)
    """
    if group_by == "producto":         return ({"$ifNull":["$codig","-"]}, "producto")
    if group_by == "categoria":        return ({"$ifNull":["$categoria","-"]}, "categoria")  # se llena por lookup a menus
    if group_by == "familia":          return ({"$ifNull":["$familia","-"]}, "familia")
    if group_by == "subfamilia":       return ({"$ifNull":["$subfamilia","-"]}, "subfamilia")
    if group_by == "centroproduccion": return ({"$ifNull":["$centroproduccion","-"]}, "centroproduccion")
    if group_by == "mes":              return ({"$ifNull":["$mesano","-"]}, "mes")
    if group_by == "local":            return ({"$ifNull":["$local","-"]}, "local")
    if group_by == "weather":          return ({"$ifNull":["$weather_tag","sin_dato"]}, "weather")
    if group_by == "mes_weather":      return ({"$concat":[{"$ifNull":["$mesano","-"]}, " | ", {"$ifNull":["$weather_tag","sin_dato"]}]}, "mes_weather")
    if group_by == "local_weather":    return ({"$concat":[{"$ifNull":["$local","-"]}, " | ", {"$ifNull":["$weather_tag","sin_dato"]}]}, "local_weather")
    return ({"$ifNull":["$codig","-"]}, "producto")

def _add_weather_join_if_possible(stages: List[dict], using_daily: bool):
    """En DAILY, une por (local, date) al clima y taguea."""
    if not using_daily: return stages
    stages += [
        {"$addFields": {"date_str": {"$dateToString":{"format":"%Y-%m-%d","date":"$date"}}}},
        {"$lookup": {
            "from": WEATHER_COLL,
            "let": {"slug":"$local","d":"$date_str"},
            "pipeline":[
                {"$match":{"$expr":{"$and":[
                    {"$eq":["$permalink_slug","$$slug"]},
                    {"$eq":[{"$dateToString":{"format":"%Y-%m-%d","date":"$date"}},"$$d"]}
                ]}}}
            ],
            "as":"w"
        }},
        {"$addFields":{"w0":{"$arrayElemAt":["$w",0]}}},
        {"$addFields":{
            "weather_tag":{
                "$let":{
                    "vars":{"w":"$w0"},
                    "in":{
                        "$cond":[
                            {"$or":[{"$ifNull":["$$w.was_snowing",False]},{"$gt":[{"$ifNull":["$$w.snowfall_sum",0]},0]}]},
                            "nieve",
                            {"$cond":[
                                {"$or":[{"$ifNull":["$$w.was_raining",False]},{"$gt":[{"$ifNull":["$$w.rain_sum",0]},0]},{"$gt":[{"$ifNull":["$$w.precipitation_sum",0]},0]}]},
                                "lluvia",
                                {"$cond":[
                                    {"$and":[{"$eq":[{"$ifNull":["$$w.precipitation_sum",0]},0]},{"$eq":[{"$ifNull":["$$w.was_raining",False]},False]}]},
                                    "soleado",
                                    {"$cond":[{"$gt":[{"$strLenCP":{"$toString":"$$w"}},0]},"otro","sin_dato"]}
                                ]}
                            ]}
                        ]
                    }
                }
            }
        }},
        {"$project":{"w":0,"w0":0}}
    ]
    return stages

def _value_expr(measure: str) -> Dict:
    if measure == "venta":       return {"$sum":"$total_venta"}
    if measure == "cantidad":    return {"$sum":"$cantidad"}
    if measure == "margen":      return {"$sum":"$total_margen"}
    if measure == "costo":       return {"$sum":"$total_costo"}
    if measure == "margen_pct":  # margen / venta
        return {"$divide":[{"$sum":"$total_margen"}, {"$max":[{"$sum":"$total_venta"},1]}]}
    return {"$sum":"$total_venta"}

def _fmt_value(measure: str, v: float) -> str:
    if measure in {"venta","margen","costo"}:
        return f"$ {v:,.0f}"
    if measure == "cantidad":
        return f"{int(v):,} uds"
    if measure == "margen_pct":
        return f"{v*100:.1f}%"
    return f"$ {v:,.0f}"

def _compare_period(mm: str, mode: str) -> str:
    return _yoy_yyyymm(mm) if mode=="yoy" else _prev_yyyymm(mm)

async def handle_productos(update, context):
    text = update.message.text or ""
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[productos_handler] tg_id={tg_id} text='{text}'")

    link = get_link_info(tg_id) if tg_id else None
    if not link or link.get("expired"):
        return update, ["Primero conecta tu cuenta con Privy para ver ventas de productos. Usa /link."]

    f = await grok_filters("productos", text) or {}
    by       = (f.get("by") or "").lower()
    q        = (f.get("q") or "").strip()
    period   = (f.get("period") or "").strip()       # YYYYMM actual
    group_by = (f.get("group_by") or "producto").lower()
    measure  = (f.get("measure") or "venta").lower()
    order_by = (f.get("order_by") or "value_desc").lower()
    top      = bool(f.get("top", False))
    hide_vals= bool(f.get("hide_values", False))
    view     = f.get("view") or {}
    limit    = int(view.get("limit", 20))
    compare  = (view.get("compare") or "mom").lower()
    detail   = bool(view.get("detail", False))
    include_measures = [str(x).lower() for x in (view.get("include_measures") or [])]

    ff = f.get("filters") or {}
    include_categories = ff.get("include_categories") or []
    include_locals = ff.get("include_locals") or []
    include_siglas = [s[:3].upper() for s in (ff.get("include_siglas") or [])]
    weather_in = (ff.get("weather_in") or [])
    min_uds = int(ff.get("min_uds") or 0)

    # Códigos por búsqueda/categoría
    codes = _resolve_code_set(by, q, include_categories)

    # Heurísticas de lenguaje natural (sin romper SPEC)
    mention_renta  = bool(re.search(r"\brent(a|abilidad)\b", text, re.I))
    mention_centro = bool(re.search(r"centro\s*(de\s*)?costo|centro\s*producci[oó]n|cocina(\s*(fr[ií]a|caliente))?", text, re.I))
    if mention_centro and group_by not in {"centroproduccion"}:
        group_by = "centroproduccion"
    # 'con la renta' cuando piden ventas ⇒ agrega margen/margen%
    if mention_renta and measure == "venta" and not include_measures:
        include_measures = ["margen", "margen_pct"]
    # Si piden rentabilidad (margen) explícita, acompaña con venta, costo y margen%
    if mention_renta and measure == "margen" and not include_measures:
        include_measures = ["venta", "costo", "margen_pct"]
    # 'rentabilidad' a secas ⇒ si no viene measure válido, usar margen
    if mention_renta and measure not in {"venta","cantidad","margen","costo","margen_pct"}:
        measure = "margen"
    # =========================
    # Selección de dataset
    # =========================
    using_daily = _has_daily_products() and (weather_in or group_by in {"weather","mes_weather","local_weather"} or detail)
    coll = db[DAILY_COLL] if using_daily else db[RENTAB_COLL]

    # =========================
    # Periodos actual/previo
    # =========================
    tz = ZoneInfo("America/Santiago")
    if not period or len(period)!=6:  # si no vino, usa mes actual (recorta por carga 04:00)
        now = datetime.now(tz)
        period = now.strftime("%Y%m")
    prev_period = _compare_period(period, compare) if compare in {"yoy","mom"} else None

    # =========================
    # Pipeline base (match)
    # =========================
    stages: List[dict] = []
    if using_daily:
        # DAILY: filtra por mes YYYYMM -> date range
        y, m = int(period[:4]), int(period[4:])
        start = datetime(y, m, 1)
        end   = datetime(y+1,1,1) if m==12 else datetime(y, m+1, 1)
        stages += [
            {"$match":{"date":{"$gte":start, "$lt":end}}},
            {"$project":{
                "_id":0,"codig":1,"local":1,"date":1,
                "total_venta":{"$ifNull":["$total_venta",0]},
                "total_margen":{"$ifNull":["$total_margen",0]},
                "total_costo":{"$ifNull":["$total_costo",0]},
                "cantidad":{"$ifNull":["$cantidad",0]}
            }},
        ]
    else:
        stages += [
            {"$match":{"mesano":str(period)}},
            {"$project":{
                "_id":0,"codig":1,"familia":1,"subfamilia":1,"centroproduccion":1,"mesano":1,
                "local":{"$ifNull":["$local", None]},
                "total_venta":{"$ifNull":["$total_venta",0]},
                "total_margen":{"$ifNull":["$total_margen",0]},
                "total_costo":{"$ifNull":["$total_costo",0]},
                "cantidad":{"$ifNull":["$cantidad",0]}
            }},
        ]

    # Filtros por códigos/categorías
    if codes:
        stages += [{"$match":{"codig":{"$in":codes}}}]
    # Filtros por locales/siglas (si existen)
    if include_locals:
        stages += [{"$match":{"local":{"$in":include_locals}}}]
    if include_siglas:
        stages += [{"$addFields":{"_sigla":{"$toUpper":{"$substrCP":[{"$ifNull":["$local",""]},0,3]}}}},
                   {"$match":{"_sigla":{"$in":include_siglas}}}]
    # Join clima (solo DAILY)
    if using_daily:
        stages = _add_weather_join_if_possible(stages, using_daily)
        if weather_in:
            stages += [{"$match":{"weather_tag":{"$in":weather_in}}}]

    # Enriquecer con categoría desde menus (para group_by=categoria)
    if group_by == "categoria":
        stages += [
            {"$lookup":{
                "from":"menus",
                "localField":"codig",
                "foreignField":"codigo",
                "as":"m"
            }},
            {"$addFields":{"_m":{"$arrayElemAt":["$m",0]}}},
            {"$addFields":{"categoria":{"$ifNull":[{"$arrayElemAt":["$_m.category_ids",0]},""]}}},
            {"$project":{"m":0,"_m":0}}
        ]

    # =========================
    # Group + value
    # =========================
    gid, _ = _build_group_key(group_by)
    stages += [
        {"$addFields":{"_g":gid}},
        {"$group":{
            "_id":"$_g",
            "venta":{"$sum":"$total_venta"},
            "cantidad":{"$sum":"$cantidad"},
            "margen":{"$sum":"$total_margen"},
            "costo":{"$sum":"$total_costo"},
            "count":{"$sum":1},
            "sample_local":{"$first":"$local"},
            "sample_mes":{"$first":{"$ifNull":["$mesano", str(period)]}},
            "sample_weather":{"$first":{"$ifNull":["$weather_tag", None]}}
        }},
    ]
    if min_uds>0:
        stages += [{"$match":{"cantidad":{"$gte":min_uds}}}]
    # agrega 'value' según measure
    if measure == "venta":
        stages += [{"$addFields":{"value":"$venta"}}]
    elif measure == "cantidad":
        stages += [{"$addFields":{"value":"$cantidad"}}]
    elif measure == "margen":
        stages += [{"$addFields":{"value":"$margen"}}]
    elif measure == "costo":
        stages += [{"$addFields":{"value":"$costo"}}]
    else:  # margen_pct
        stages += [{"$addFields":{"value":{"$cond":[{"$gt":["$venta",0]},{"$divide":["$margen","$venta"]},0]}}}]

    # sort/limit
    if order_by == "group_asc":
        stages += [{"$sort":{"_id":1}}]
    elif order_by == "value_asc":
        stages += [{"$sort":{"value":1}}]
    else:
        stages += [{"$sort":{"value":-1}}]
    stages += [{"$limit": int(limit if top else max(limit, 50))}]  # si no es top, mostramos hasta 50

    cur = list(coll.aggregate(stages))

    # =========================
    # Comparativo (prev period)
    # =========================
    comp_line = ""
    prev_map: Dict[str,dict] = {}
    if compare in {"yoy","mom"} and prev_period:
        prev_stages = []
        if using_daily:
            y, m = int(prev_period[:4]), int(prev_period[4:])
            start = datetime(y,m,1); end = datetime(y+1,1,1) if m==12 else datetime(y,m+1,1)
            prev_stages += [{"$match":{"date":{"$gte":start,"$lt":end}}}]
            prev_stages += [{"$project":{"_id":0,"codig":1,"local":1,"date":1,
                                         "total_venta":{"$ifNull":["$total_venta",0]},
                                         "total_margen":{"$ifNull":["$total_margen",0]},
                                         "total_costo":{"$ifNull":["$total_costo",0]},
                                         "cantidad":{"$ifNull":["$cantidad",0]}}}]
            prev_stages = _add_weather_join_if_possible(prev_stages, True)
            if include_locals: prev_stages += [{"$match":{"local":{"$in":include_locals}}}]
            if include_siglas: prev_stages += [{"$addFields":{"_sigla":{"$toUpper":{"$substrCP":[{"$ifNull":["$local",""]},0,3]}}}},
                                               {"$match":{"_sigla":{"$in":include_siglas}}}]
            if weather_in:     prev_stages += [{"$match":{"weather_tag":{"$in":weather_in}}}]
        else:
            prev_stages += [{"$match":{"mesano":str(prev_period)}}]
            prev_stages += [{"$project":{"_id":0,"codig":1,"familia":1,"subfamilia":1,"centroproduccion":1,"mesano":1,"local":{"$ifNull":["$local", None]},
                                         "total_venta":{"$ifNull":["$total_venta",0]},"total_margen":{"$ifNull":["$total_margen",0]},"total_costo":{"$ifNull":["$total_costo",0]},"cantidad":{"$ifNull":["$cantidad",0]}}}]
            if include_locals: prev_stages += [{"$match":{"local":{"$in":include_locals}}}]
            if include_siglas: prev_stages += [{"$addFields":{"_sigla":{"$toUpper":{"$substrCP":[{"$ifNull":["$local",""]},0,3]}}}},
                                               {"$match":{"_sigla":{"$in":include_siglas}}}]
        # categoría?
        if group_by == "categoria":
            prev_stages += [
                {"$lookup":{"from":"menus","localField":"codig","foreignField":"codigo","as":"m"}},
                {"$addFields":{"_m":{"$arrayElemAt":["$m",0]}}},
                {"$addFields":{"categoria":{"$ifNull":[{"$arrayElemAt":["$_m.category_ids",0]},""]}}},
                {"$project":{"m":0,"_m":0}}
            ]
        gid_prev, _ = _build_group_key(group_by)
        prev_stages += [
            {"$addFields":{"_g":gid_prev}},
            {"$group":{"_id":"$_g",
                       "venta":{"$sum":"$total_venta"},
                       "cantidad":{"$sum":"$cantidad"},
                       "margen":{"$sum":"$total_margen"},
                       "costo":{"$sum":"$total_costo"}}}
        ]
        prev = list(coll.aggregate(prev_stages))
        # índice rápido
        for r in prev:
            v = r.get("venta",0); c = r.get("cantidad",0); m = r.get("margen",0)
            if measure == "venta": prev_map[r["_id"]] = v
            elif measure == "cantidad": prev_map[r["_id"]] = c
            elif measure == "margen": prev_map[r["_id"]] = m
            elif measure == "costo": prev_map[r["_id"]] = r.get("costo",0)
            else:
                prev_map[r["_id"]] = (m / v) if v else 0.0
        comp_tag = "YoY" if compare=="yoy" else "MoM"
        comp_line = f" | {comp_tag}"

    # =========================
    # Render
    # =========================
    # Encabezado
    nice_measure = {"venta":"Ventas","cantidad":"Unidades","margen":"Margen","costo":"Costo","margen_pct":"Margen %"}[measure]
    title_q = f" — {q}" if q else ""
    clima_q = f" — clima:{','.join(weather_in)}" if weather_in else ""
    head = [f"TOP {limit} — {nice_measure} — {period[:4]}-{period[4:]}{title_q}{clima_q}{comp_line}"]

    # Filas
    lines: List[str] = head
    menus = _menus_by_code()
    for i, r in enumerate(cur, start=1):
        key = r.get("_id")
        v   = r.get("value",0.0)
        name = str(key)
        # nombre bonito si es producto
        if group_by == "producto":
            mdoc = menus.get(key, {})
            if mdoc:
                nm = mdoc.get("nombre") or ""
                name = f"{nm} ({key})"
        if hide_vals:
            main = f"{i}. {name}"
        else:
            prev_v = prev_map.get(key)
            if prev_v is not None and measure!="margen_pct":
                delta_pct = _pct(v, prev_v)
                main = f"{i}. {name}\n   { _fmt_value(measure, v) } vs { _fmt_value(measure, prev_v) } (Δ {delta_pct})"
            elif prev_v is not None and measure=="margen_pct":
                delta = (v - prev_v) * 100.0
                main = f"{i}. {name}\n   { _fmt_value(measure, v) } vs { _fmt_value(measure, prev_v) } (Δ {delta:+.1f} pp)"
            else:
                main = f"{i}. {name}\n   { _fmt_value(measure, v) }"
        # Extras: margen, margen%, unidades, costo si lo piden
        if not hide_vals and include_measures:
            extras = []
            if "venta" in include_measures:
                extras.append(f"venta { _fmt_value('venta', r.get('venta',0)) }")
            if "margen" in include_measures:
                extras.append(f"margen { _fmt_value('margen', r.get('margen',0)) }")
            if "margen_pct" in include_measures:
                mp = (r.get("margen",0) / r.get("venta",1)) if r.get("venta",0) else 0
                extras.append(f"{mp*100:.1f}%")
            if "cantidad" in include_measures:
                extras.append(f"{ int(r.get('cantidad',0)):,} uds")
            if "costo" in include_measures:
                extras.append(f"costo { _fmt_value('costo', r.get('costo',0)) }")
            if extras:
                main += "\n   " + " | ".join(extras)
        lines.append(main)

    # Totales generales (solo si no hide_vals)
    if not hide_vals and cur:
        tot_v = sum(float(r.get("value",0)) for r in cur)
        if compare in {"yoy","mom"} and prev_map:
            prev_sum = sum(float(prev_map.get(r.get("_id"),0)) for r in cur)
            dp = _pct(tot_v, prev_sum) if measure!="margen_pct" else f"{(tot_v-prev_sum)*100:.1f} pp"
            lines += ["", "TOTAL:", f"   { _fmt_value(measure, tot_v) }" + (f" vs { _fmt_value(measure, prev_sum) } (Δ {dp})" if prev_map else "")]
        else:
            lines += ["", "TOTAL:", f"   { _fmt_value(measure, tot_v) }"]
        # Totales de extras, si corresponde
        if include_measures:
            t_extras = []
            if "venta" in include_measures:
                t_extras.append(f"venta { _fmt_value('venta', sum(float(r.get('venta',0)) for r in cur)) }")
            if "margen" in include_measures:
                t_extras.append(f"margen { _fmt_value('margen', sum(float(r.get('margen',0)) for r in cur)) }")
            if "margen_pct" in include_measures:
                tv = sum(float(r.get('venta',0)) for r in cur) or 1
                tm = sum(float(r.get('margen',0)) for r in cur)
                t_extras.append(f"{(tm/tv)*100:.1f}%")
            if "cantidad" in include_measures:
                t_extras.append(f"{ int(sum(float(r.get('cantidad',0)) for r in cur)):,} uds")
            if "costo" in include_measures:
                t_extras.append(f"costo { _fmt_value('costo', sum(float(r.get('costo',0)) for r in cur)) }")
            if t_extras:
                lines.append("   " + " | ".join(t_extras))

    # =========================
    # Related recipes table (una por producto listado)
    # =========================
    related_tables = []
    try:
        if group_by == "producto" and cur:
            codes = []
            for r in cur:
                code = str(r.get("_id") or "")
                if code and code not in codes:
                    codes.append(code)
            recipes_rows = []
            if codes:
                # mesano preferido: periodo actual; si no hay receta en ese mes, usar último disponible por código
                for code in codes:
                    use_mesano = str(period) if period else None
                    if use_mesano:
                        any_in_period = db.recetas_productos.count_documents({"producto_codigo": code, "mesano": use_mesano})
                        if not any_in_period:
                            use_mesano = None
                    if not use_mesano:
                        latest = db.recetas_productos.find({"producto_codigo": code}, {"mesano":1}).sort("mesano", -1).limit(1)
                        latest_doc = next(iter(latest), None)
                        use_mesano = str(latest_doc.get("mesano")) if latest_doc and latest_doc.get("mesano") else None
                    if not use_mesano:
                        continue
                    cur_rec = db.recetas_productos.find({"producto_codigo": code, "mesano": use_mesano}).sort([("producto_codigo",1),("linea",1)])
                    for rr in cur_rec:
                        ing = str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo") or "").strip()
                        qty = rr.get("cantidad_ingrediente")
                        unit = str(rr.get("u_medida_compra") or rr.get("u_medida_base") or "").strip()
                        recipes_rows.append({
                            "code": code,
                            "ingredient": ing,
                            "qty": float(qty) if isinstance(qty,(int,float)) else None,
                            "qty_text": (f"{qty:.3f}" if isinstance(qty,(int,float)) else (str(qty) if qty is not None else "")),
                            "unit": unit,
                            "mesano": use_mesano,
                        })
            if recipes_rows:
                related_tables.append({
                    "type":"data_table",
                    "key":"recipes",
                    "title":"Recetas",
                    "columns":[
                        {"key":"code","label":"Código","type":"text","align":"left"},
                        {"key":"ingredient","label":"Ingrediente","type":"text","align":"left"},
                        {"key":"qty_text","label":"Cantidad","type":"text","align":"right"},
                        {"key":"unit","label":"Unidad","type":"text","align":"left"},
                    ],
                    "rows": recipes_rows,
                })
    except Exception:
        related_tables = []

    # Si hay tablas relacionadas, devolver payload estructurado junto al texto
    if related_tables:
        payload = {"type":"text_block_list","intent":"productos","lines": lines, "related_tables": related_tables}
        return update, payload

    return update, lines
