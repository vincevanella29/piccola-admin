import re
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any
from collections import defaultdict
from zoneinfo import ZoneInfo

from utils.web3mongo import db
from ..common.filters import grok_filters, apply_access_filters_for_product_like_intent

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
    """Mapa codigo -> documento de menú con campos útiles para UI."""
    out = {}
    for m in db.menus.find({}, {
        "codigo": 1,
        "nombre": 1,
        "category_ids": 1,
        "option_ids": 1,
        "precio": 1,
        "currency": 1,
        "media_r2": 1,
        "media_url": 1,
        "media_local": 1,
    }):
        code = str(m.get("codigo") or "").strip()
        if code:
            out[code] = m
    return out


def _menu_image_url(m: dict) -> str:
    """Elige una URL de imagen simple y segura si existe."""
    for key in ("media_r2", "media_url"):
        v = str(m.get(key) or "").strip()
        if v and (v.startswith("https://") or v.startswith("http://")):
            return v
    return ""

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

    # -----------------
    # Permisos / acceso (solo para reglas de negocio generales)
    # -----------------
    perms = getattr(context, "user_data", {}).get("permissions") or {}
    # Tomar SIEMPRE el nivel efectivo ya resuelto por el engine (1..7),
    # y sólo caer a perms["role_level"] si no viene en el contexto.
    raw_ctx_level = getattr(context, "user_data", {}).get("role_level") if hasattr(context, "user_data") else None
    raw_perm_level = perms.get("role_level")
    try:
        role_level = int(raw_ctx_level) if raw_ctx_level is not None else (
            int(raw_perm_level) if raw_perm_level is not None else None
        )
    except Exception:
        role_level = None

    own_id_sucursal = perms.get("own_id_sucursal")
    sucursal_ids = perms.get("sucursal_ids") or []
    has_sucursal_scope = bool(own_id_sucursal is not None or (isinstance(sucursal_ids, list) and len(sucursal_ids) > 0))

    # Regla de negocio simplificada para 'productos':
    # - SOLO nivel 6 con sucursal asignada puede ver montos (venta/margen/costo/margen%).
    # - Todos los demás niveles (1-5, 7, y 6 sin sucursal) sólo ven cantidades.

    if role_level is not None:
        can_see_money = (role_level == 6 and has_sucursal_scope)
        if not can_see_money:
            if measure in {"venta", "margen", "costo", "margen_pct"}:
                measure = "cantidad"
            include_measures = [m for m in include_measures if m == "cantidad"]

    # Aplicar scope global de acceso por sucursal usando helpers de filters
    try:
        before_filters = f.get("filters") or {}
    except Exception:
        before_filters = {}
    try:
        # En 'productos' no hacemos scoping por centros/códigos; sólo sucursales.
        # Por eso no pasamos period_ym (None) para desactivar el recorte lvl7 by centro.
        f = apply_access_filters_for_product_like_intent("productos", f, perms or {}, role_level, None)
    except Exception:
        f = f or {}

    ff = f.get("filters") or {}
    include_categories = ff.get("include_categories") or []
    include_locals = ff.get("include_locals") or []
    include_siglas = [s[:3].upper() for s in (ff.get("include_siglas") or [])]
    weather_in = (ff.get("weather_in") or [])
    min_uds = int(ff.get("min_uds") or 0)

    # Códigos por búsqueda/categoría
    codes = _resolve_code_set(by, q, include_categories)

    try:
        logger.info(
            "[productos.handle_productos] role_level=%s period=%s is_garzon=%s "
            "filters_before=%s filters_after=%s codes=%s",
            role_level,
            period,
            is_lvl7_garzon,
            {
                "include_categories": before_filters.get("include_categories"),
                "include_locals": before_filters.get("include_locals"),
                "include_siglas": before_filters.get("include_siglas"),
                "include_codigos": before_filters.get("include_codigos"),
            },
            {
                "include_categories": include_categories,
                "include_locals": include_locals,
                "include_siglas": ff.get("include_siglas"),
                "include_codigos": ff.get("include_codigos"),
            },
            codes,
        )
    except Exception:
        pass
    # Heurística: si solo obtuvimos 0/1 código con búsqueda por nombre/texto, intenta ampliar por término base (p.ej. 'lasagna')
    if (by in {"", "nombre"}) and q and len(codes) <= 1:
        menus_all = _menus_by_code()
        ql = q.lower()
        # toma la palabra más larga del query como núcleo de búsqueda
        parts = [p for p in re.split(r"\W+", ql) if p]
        if parts:
            core = max(parts, key=len)
            # ignore adjetivos comunes
            stop = {"grande","bambino","clasica","clásica","familiar","personal","de","la","el"}
            if core in stop and len(parts) > 1:
                core = sorted([p for p in parts if p not in stop], key=len)[-1]
            broaden = [code for code, m in menus_all.items() if core in str(m.get("nombre") or "").lower()]
            if len(broaden) >= 2:
                codes = sorted(set(broaden))

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
    # Render estructurado para UI
    # =========================
    nice_measure = {"venta": "Ventas", "cantidad": "Unidades", "margen": "Margen", "costo": "Costo", "margen_pct": "Margen %"}[measure]
    title_q = f" — {q}" if q else ""
    clima_q = f" — clima:{','.join(weather_in)}" if weather_in else ""
    title = f"TOP {limit} — {nice_measure} — {period[:4]}-{period[4:]}{title_q}{clima_q}{comp_line}"

    menus = _menus_by_code()
    # Role gating para métricas sensibles: niveles 1-6 pueden ver métricas completas;
    # nivel 7 solo si es garzón (tiene ventas en KPIs); resto nivel 7 solo cantidades/recetas.
    authorized = bool(role_level is not None and (role_level <= 6 or (role_level == 7 and is_lvl7_garzon)))

    # Si no autorizado: no exponer métricas. Entregar lista de productos o una card con receta si hay detalle o 1 match
    if not authorized and group_by == "producto" and cur:
        # Muchos resultados => lista
        if len(cur) > 1 and not detail:
            items = []
            for r in cur[:50]:
                code = str(r.get("_id") or "")
                mdoc = menus.get(code) or {}
                items.append({
                    "id": str(mdoc.get("id") or mdoc.get("_id") or code),
                    "name": str(mdoc.get("nombre") or code),
                    "code": code,
                    "price": mdoc.get("precio"),
                    "currency": str(mdoc.get("currency") or "$"),
                    "categories": list(mdoc.get("category_ids") or []),
                    "options": list(mdoc.get("option_ids") or []),
                    "image_url": _menu_image_url(mdoc),
                })
            return update, {
                "type": "product_list",
                "text": f"{len(items)}/{len(cur)} productos" + (f" para '{q}'" if q else ""),
                "query": q,
                "total": len(cur),
                "shown": len(items),
                "items": items,
            }
        # Un producto o piden detalle => card con receta básica
        candidate_code = cur[0].get("_id")
        mdoc = menus.get(candidate_code or "") or {}
        prod = {
            "id": str(mdoc.get("id") or mdoc.get("_id") or mdoc.get("codigo") or ""),
            "name": str(mdoc.get("nombre") or ""),
            "code": str(mdoc.get("codigo") or candidate_code or ""),
            "price": mdoc.get("precio"),
            "currency": str(mdoc.get("currency") or "$"),
            "categories": list(mdoc.get("category_ids") or []),
            "options": list(mdoc.get("option_ids") or []),
            "description": str(mdoc.get("descripcion") or mdoc.get("description") or ""),
            "image_url": _menu_image_url(mdoc),
        }
        # Adjuntar receta del periodo si existe
        try:
            codigo = prod.get("code") or ""
            mesano = period
            rec_rows = list(db.recetas_productos.find({"producto_codigo": codigo, "mesano": mesano}).sort("linea", 1))
            rec_lines = []
            for rr in rec_rows[:50]:
                ing = str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo") or "").strip()
                qty = rr.get("cantidad_ingrediente")
                unit = str(rr.get("u_medida_compra") or rr.get("u_medida_base") or "").strip()
                qty_s = (f"{qty:.3f}" if isinstance(qty, (int, float)) else str(qty))
                rec_lines.append(f"- {ing} — {qty_s} {unit}".strip())
        except Exception:
            rec_lines = []
        return update, {
            "type": "product_card",
            "text": prod["name"],
            "product": prod,
            "recipe": {"mesano": period, "lines": rec_lines} if rec_lines else None,
        }

    # Si autorizado y piden detalle de un único producto => product_card
    if authorized and group_by == "producto" and cur:
        candidate_code = cur[0].get("_id")
        mdoc = menus.get(candidate_code or "")
        if detail and mdoc:
            prod = {
                "id": str(mdoc.get("id") or mdoc.get("_id") or mdoc.get("codigo") or ""),
                "name": str(mdoc.get("nombre") or ""),
                "code": str(mdoc.get("codigo") or ""),
                "price": mdoc.get("precio"),
                "currency": str(mdoc.get("currency") or "$"),
                "categories": list(mdoc.get("category_ids") or []),
                "options": list(mdoc.get("option_ids") or []),
                "description": str(mdoc.get("descripcion") or mdoc.get("description") or ""),
                "image_url": _menu_image_url(mdoc),
            }
            # Adjuntar receta del periodo si existe (igual que en no autorizado)
            try:
                codigo = prod.get("code") or ""
                mesano = period
                rec_rows = list(db.recetas_productos.find({"producto_codigo": codigo, "mesano": mesano}).sort("linea", 1))
                rec_lines = []
                for rr in rec_rows[:50]:
                    ing = str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo") or "").strip()
                    qty = rr.get("cantidad_ingrediente")
                    unit = str(rr.get("u_medida_compra") or rr.get("u_medida_base") or "").strip()
                    qty_s = (f"{qty:.3f}" if isinstance(qty, (int, float)) else str(qty))
                    rec_lines.append(f"- {ing} — {qty_s} {unit}".strip())
            except Exception:
                rec_lines = []
            return update, {
                "type": "product_card",
                "text": f"{prod['name']} — {prod['price']}" if prod.get("price") is not None else prod['name'],
                "product": prod,
                "recipe": {"mesano": period, "lines": rec_lines} if rec_lines else None,
            }

    # Nota: preferimos data_table para incluir totales/KPIs; sólo usamos product_card cuando piden detail.

    # Tabla de datos para cualquier agrupación (solo autorizados)
    columns = [
        {"key": "group", "label": group_by, "type": "text", "align": "left"},
        {"key": "venta", "label": "Venta", "type": "number", "align": "right"},
        {"key": "cantidad", "label": "Unidades", "type": "number", "align": "right"},
        {"key": "margen", "label": "Margen", "type": "number", "align": "right"},
        {"key": "costo", "label": "Costo", "type": "number", "align": "right"},
        {"key": "margen_pct", "label": "Margen %", "type": "number", "align": "right"},
    ]
    rows = []
    for r in cur:
        key = r.get("_id")
        name = str(key)
        if group_by == "producto":
            mdoc = menus.get(str(key) or "") or {}
            nm = mdoc.get("nombre") or ""
            if nm:
                name = f"{nm} ({key})"
        venta = float(r.get("venta", 0) or 0)
        cantidad = float(r.get("cantidad", 0) or 0)
        margen = float(r.get("margen", 0) or 0)
        costo = float(r.get("costo", 0) or 0)
        mpct = (margen / venta) if venta else 0.0
        row = {
            "group": name,
            "venta": venta,
            "cantidad": int(cantidad),
            "margen": margen,
            "costo": costo,
            "margen_pct": round(mpct * 100.0, 2),
        }
        # Adjunta metadata útil para modales/detalle
        if group_by == "producto":
            row["code"] = str(key)
            mdoc = menus.get(str(key) or "") or {}
            row["name"] = str(mdoc.get("nombre") or "")
            row["image_url"] = _menu_image_url(mdoc)
            row["price"] = mdoc.get("precio")
            row["currency"] = str(mdoc.get("currency") or "$")
        rows.append(row)

    totals = {
        "venta": sum(float(r.get("venta", 0) or 0) for r in cur),
        "cantidad": int(sum(float(r.get("cantidad", 0) or 0) for r in cur)),
        "margen": sum(float(r.get("margen", 0) or 0) for r in cur),
        "costo": sum(float(r.get("costo", 0) or 0) for r in cur),
    }
    tv = totals["venta"] or 1
    totals["margen_pct"] = round((totals["margen"] / tv) * 100.0, 2)

    if not authorized:
        # fallback extremo: lista simple de productos si algo escapó
        items = []
        for r in cur[:50]:
            code = str(r.get("_id") or "")
            mdoc = menus.get(code) or {}
            items.append({
                "id": str(mdoc.get("id") or mdoc.get("_id") or code),
                "name": str(mdoc.get("nombre") or code),
                "code": code,
                "price": mdoc.get("precio"),
                "currency": str(mdoc.get("currency") or "$"),
                "categories": list(mdoc.get("category_ids") or []),
                "options": list(mdoc.get("option_ids") or []),
                "image_url": _menu_image_url(mdoc),
            })
        return update, {
            "type": "product_list",
            "text": f"{len(items)}/{len(cur)} productos" + (f" para '{q}'" if q else ""),
            "query": q,
            "total": len(cur),
            "shown": len(items),
            "items": items,
        }

    payload = {
        "type": "data_table",
        "title": title,
        "text": title,
        "subtitle": None,
        "kpis": [
            {"label": "Total venta", "value": _fmt_value("venta", totals["venta"])},
            {"label": "Total unidades", "value": _fmt_value("cantidad", totals["cantidad"])},
            {"label": "Margen %", "value": f"{totals['margen_pct']:.1f}%"},
        ],
        "columns": columns,
        "rows": rows,
        "totals": totals,
        "charts": None,
    }

    # Related recipes: una por producto del listado (no duplicar)
    if group_by == "producto" and rows:
        try:
            codes = []
            for r in rows:
                code = str(r.get("code") or r.get("group") or "").strip()
                # 'group' viene como "Nombre (CODE)"; extrae CODE si es el caso
                if code and "(" in code and ")" in code and not r.get("code"):
                    try:
                        code = code.split("(")[-1].split(")")[0].strip()
                    except Exception:
                        pass
                if code and code not in codes:
                    codes.append(code)
            recipes_rows = []
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
                payload["related_tables"] = payload.get("related_tables") or []
                payload["related_tables"].append({
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
            pass

    return update, payload
