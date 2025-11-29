import re
import logging
import asyncio
from typing import List, Any
from utils.web3mongo import db
from ..common.filters import grok_filters, _apply_sucursal_scope, resolve_allowed_codes_lvl7_from_centros

logger = logging.getLogger(__name__)
CONSUMO_COLL = "consumo_locales"

def _dia_str_expr():
    return {
        "$cond": [
            {"$eq": [{"$type": "$fecha"}, "date"]},
            {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha", "timezone": "America/Santiago"}},
            "$fecha"
        ]
    }

def _periods_str_or_int_match(periods: List[str]) -> dict:
    in_list: List[Any] = []
    for p in (periods or []):
        if not p: 
            continue
        in_list.append(p)
        try:
            in_list.append(int(p))
        except Exception:
            pass
    return {"$expr": {"$in": ["$mesano", in_list]}} if in_list else {}


def _weather_tag_expr():
    """Clasifica clima básico a partir de campos de weather_daily."""
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

async def handle_consumos(update, context):
    text = (update.message.text or "").strip()

    # 1) Plan desde el engine (si viene en el contexto) o, en su defecto, desde grok_filters
    try:
        plan = getattr(context, "user_data", {}).get("consumos_spec")
    except Exception:
        plan = None
    if not isinstance(plan, dict) or not plan:
        plan = await grok_filters("consumos", text) or {}
    m = plan.get("match") or {}
    dates       = m.get("dates") or []
    mesanos     = m.get("mesanos") or []
    locals_     = m.get("locals") or []
    articles    = m.get("articles") or []
    families    = m.get("families") or []
    subfamilies = m.get("subfamilies") or []
    art_regex   = m.get("article_regex") or []

    # Derivar codigos de 7 digitos desde los articulos (primer token del string)
    article_codes: list[str] = []
    for a in articles:
        try:
            m_code = re.match(r"\s*(\d{7})\b", str(a))
            if m_code:
                article_codes.append(m_code.group(1))
        except Exception:
            continue

    # 1.1) Scope de acceso según permisos y nivel de rol
    perms = getattr(context, "user_data", {}).get("permissions") or {}
    try:
        role_level = int(getattr(context, "user_data", {}).get("role_level"))
    except Exception:
        role_level = None

    # Para niveles 6+ restringir locales a sus sucursales
    # Usamos _apply_sucursal_scope sobre un filtro sintético de siglas y
    # tratamos los "locals" como siglas para compatibilidad.
    if role_level is not None and role_level >= 6:
        tmp_filters = {"include_siglas": list(locals_)}
        tmp_filters = _apply_sucursal_scope(tmp_filters, perms or {}, role_level)
        locals_scoped = tmp_filters.get("include_siglas") or []
        if locals_scoped:
            locals_ = locals_scoped

    # Para nivel 7 cocina: limitar productos al centro de costo asignado
    # usando la misma resolución que en menus/productos: resolve_allowed_codes_lvl7_from_centros.
    allowed_codes_lvl7: set[str] | None = None
    if role_level == 7:
        # Derivar periodo YYYYMM desde mesanos o dates
        period_ym = None
        if mesanos:
            try:
                period_ym = str(mesanos[0]).replace("-", "")[:6]
            except Exception:
                period_ym = None
        elif dates:
            try:
                d = str(dates[0])  # "YYYY-MM-DD"
                period_ym = d.replace("-", "")[:6]
            except Exception:
                period_ym = None
        if period_ym:
            try:
                allowed_codes_lvl7 = resolve_allowed_codes_lvl7_from_centros(period_ym, perms or {})
            except Exception:
                allowed_codes_lvl7 = None

    group_by = plan.get("group_by") or "local"
    # Permitir lista de agrupaciones (e.g., ["local","dia"]) o string
    if isinstance(group_by, str):
        group_by_list = [group_by]
    else:
        try:
            group_by_list = [g for g in (group_by or []) if isinstance(g, str) and g]
        except Exception:
            group_by_list = ["local"]
    measure  = plan.get("measure") or "auto"
    unit     = plan.get("unit") or "auto"
    order    = plan.get("order") or "desc"
    order_by = plan.get("order_by") or ""
    limit    = int(plan.get("limit") or 50)
    mode     = ((plan.get("output") or {}).get("mode")) or "table"

    coll = db[CONSUMO_COLL]

    # 2) Pipeline construido SOLO desde el plan
    stages: List[dict] = []
    # Proyeccion base + normalizacion de fecha y codigo de articulo
    stages += [{
        "$project": {
            "_id": 0,
            "articulo": 1,
            "familia": 1,
            "subfamilia": 1,
            "mesano": 1,
            "local": {"$ifNull": ["$local", None]},
            "total_consumo": {"$ifNull": ["$total_consumo", None]},
            "cantidad": {"$ifNull": ["$cantidad", 0]},
            "fecha": 1,
            "_dia_str": _dia_str_expr()
        }
    },
    {"$addFields": {
        "fecha_norm": {
            "$cond": [
                {"$eq": [{"$type": "$fecha"}, "date"]},
                "$fecha",
                {"$toDate": "$fecha"}
            ]
        }
    }},
    {"$addFields": {"date_str": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}}},
    # Codigo normalizado del articulo (primer token, en mayusculas)
    {"$addFields": {
        "_codigo": {
            "$toUpper": {
                "$arrayElemAt": [
                    {"$split": [{"$ifNull": ["$articulo", ""]}, " "]},
                    0
                ]
            }
        }
    }}
    ]

    # Filtro extra para nivel 7 cocina: solo códigos de producto permitidos
    # Los códigos se extraen como el primer token del campo "articulo".
    if allowed_codes_lvl7:
        codes_list = [str(c).upper() for c in allowed_codes_lvl7]
        stages += [
            {"$match": {"_codigo": {"$in": codes_list}}},
        ]

    match_and = []

    if dates:
        match_and.append({"_dia_str": {"$in": dates}})
    if mesanos:
        match_and.append(_periods_str_or_int_match(mesanos))
    if locals_:
        match_and.append({"local": {"$in": locals_}})
    # Artículo: combinar match por codigo (_codigo) con nombre/regex en un solo OR.
    # Si hay codigos claros, evitamos regex para esos articulos para no forzar scans pesados.
    if article_codes or articles or art_regex:
        ors = []
        if article_codes:
            # Filtro principal por codigo normalizado
            ors.append({"_codigo": {"$in": [c.upper() for c in article_codes]}})
            # Opcionalmente, permitir match exacto por articulo si viene en el plan
            if articles:
                ors.append({"articulo": {"$in": articles}})
        else:
            # Sin codigos: usamos nombre + regex como antes
            if articles:
                ors.append({"articulo": {"$in": articles}})
                ors += [{"articulo": {"$regex": re.escape(t), "$options": "i"}} for t in articles]
            if art_regex:
                ors += [{"articulo": {"$regex": re.escape(t), "$options": "i"}} for t in art_regex]
        if ors:
            match_and.append({"$or": ors})
    # Si estamos filtrando por codigo de articulo, ignorar families/subfamilies del plan
    # para no descartar productos validos por una clasificacion mal inferida.
    fam_filters = [] if article_codes else families
    subfam_filters = [] if article_codes else subfamilies
    if fam_filters:
        match_and.append({"familia": {"$in": fam_filters}})
    if subfam_filters:
        match_and.append({"subfamilia": {"$in": subfam_filters}})
    # (art_regex integrado arriba)

    if match_and:
        stages += [{"$match": {"$and": match_and}}]

    # Join con clima SOLO despues de filtrar por fechas/locales/articulo
    stages += [
        {"$lookup": {
            "from": "weather_daily",
            "let": {"slug": "$local", "d": "$date_str"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$permalink_slug", "$$slug"]},
                    {"$eq": [{"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}}, "$$d"]}
                ]}}},
                {"$project": {"_id":0, "temp_max":1,"temp_min":1,"precipitation_sum":1,"rain_sum":1,"snowfall_sum":1,"was_raining":1,"was_snowing":1}}
            ],
            "as": "w"
        }},
        {"$addFields": {"weather": {"$arrayElemAt": ["$w", 0]}}},
        {"$addFields": {"weather_tag": _weather_tag_expr()}},
        {"$project": {"w":0}}
    ]

    # Guardar base antes de agrupar (para reutilizar en detalle)
    stages_base = list(stages)

    gb_map = {
        "local": {"$ifNull": ["$local", "-"]},
        "articulo": {"$ifNull": ["$articulo", "-"]},
        "familia": {"$ifNull": ["$familia", "-"]},
        "subfamilia": {"$ifNull": ["$subfamilia", "-"]},
        "mes": {"$ifNull": ["$mesano", "-"]},
        "dia": {"$ifNull": ["$_dia_str", "-"]},
    }
    # Construir _id: dict si hay múltiples claves, o escalar si solo 1
    valid_gbs = [g for g in group_by_list if g in gb_map]
    if not valid_gbs:
        valid_gbs = ["local"]
    if len(valid_gbs) == 1:
        gid = gb_map[valid_gbs[0]]
    else:
        gid = {g: gb_map[g] for g in valid_gbs}

    # Sumas base
    stages_group: List[dict] = list(stages_base)
    stages_group += [{
        "$group": {
            "_id": gid,
            "uds": {"$sum": "$cantidad"},
            "kg_raw": {"$sum": {"$ifNull": ["$total_consumo", 0]}},
            "sample_fecha": {"$first": "$_dia_str"},
            "sample_articulo": {"$first": "$articulo"},
            "weather_first": {"$first": "$weather_tag"}
        }
    }]

    # kg efectivo: si unit='kg' y no hay kg_raw, usa uds (caso artículos por peso donde 'cantidad' viene en kg)
    stages_group += [{
        "$addFields": {
            "kg_eff": {
                "$cond": [
                    {"$and": [
                        {"$eq": [unit, "kg"]},          # literal desde plan
                        {"$eq": ["$kg_raw", 0]}
                    ]},
                    "$uds",                            # usa uds como kg
                    "$kg_raw"                          # si hay kg_raw, úsalo
                ]
            }
        }
    }]

    # Valor final según unit/measure
    stages_group += [{
        "$addFields": {
            "value": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": [unit, "kg"]}, "then": "$kg_eff"},
                        {"case": {"$eq": [unit, "unidad"]}, "then": "$uds"},
                    ],
                    "default": {
                        "$cond": [{"$gt": ["$kg_eff", 0]}, "$kg_eff", "$uds"]
                    }
                }
            },
            "value_label": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": [unit, "kg"]}, "then": "kg"},
                        {"case": {"$eq": [unit, "unidad"]}, "then": "uds"},
                    ],
                    "default": {
                        "$cond": [{"$gt": ["$kg_eff", 0]}, "kg", "uds"]
                    }
                }
            }
        }
    }]

    # Ordenamiento
    if (order_by == "dia") and ("dia" in valid_gbs):
        # clave de orden: si solo 'dia', el _id es string; si multiclave, usar _id.dia
        sort_key = "_id" if (len(valid_gbs) == 1 and valid_gbs[0] == "dia") else "_id.dia"
        stages_group += [{"$sort": {sort_key: 1 if order == "asc" else -1}}]
    else:
        stages_group += [{"$sort": {"value": -1 if order == "desc" else 1}}]
    stages_group += [{"$limit": max(1, min(limit, 200))}]

    rows = await asyncio.to_thread(lambda: list(coll.aggregate(stages_group)))
    if not rows:
        # Payload estructurado sin texto; el resumen final lo hará siempre el motor común
        # (engine._attach_summary + ask_grok) en base al payload.
        return update, {
            "type": "data_table",
            "title": "Consumos",
            "subtitle": "Sin datos para los filtros pedidos",
            "kpis": [],
            "columns": [],
            "rows": [],
            "totals": {"value": 0},
            "charts": [],
        }

    # 3) Render bonito en Markdown: encabezado compacto + una sola métrica según unidad
    # Unidad efectiva de salida
    value_label = (rows[0].get("value_label") or unit or "").lower()
    if value_label not in ("kg", "uds"):
        # Elegir automáticamente según datos
        any_kg = any((r.get("kg_eff") if r.get("kg_eff") is not None else r.get("kg_raw") or 0) > 0 for r in rows)
        value_label = "kg" if any_kg else "uds"

    # Modo 'single': respuesta resumida y elegante
    if (mode or "table") == "single":
        total_val = sum(float(r.get("value") or 0) for r in rows)
        if value_label == "kg":
            val_text = f"{total_val:.2f} kg"
        else:
            val_text = f"{int(round(total_val))} uds"
        title = "📊 Consumos"
        if articles:
            title += f" · {' · '.join(articles)}"
        ctx = []
        if dates:
            ctx.append(", ".join(dates))
        if locals_:
            ctx.append("Locales: " + ", ".join(locals_))
        ctx_str = (" · ".join(ctx)) if ctx else ""
        summary = f"{title}\nResultado: {val_text}"
        if ctx_str:
            summary += f"\n{ctx_str}"
        return update, [summary]

    # Structured payload for table mode
    # Columns: per each grouping key + value column
    columns: List[dict] = []
    for g in valid_gbs:
        label = g.title()
        align = "left" if g not in ("uds","kg","value") else "right"
        columns.append({"key": g, "label": label, "align": align})
    if "dia" in valid_gbs and "local" in valid_gbs:
        columns.append({"key": "weather", "label": "Clima", "align": "center", "format": "weather"})
    columns.append({"key": "value", "label": ("Consumo (kg)" if value_label == "kg" else "Cantidad (uds)"), "align": "right", "format": "number"})

    rows_out: List[dict] = []
    sum_val = 0.0
    for r in rows:
        row_obj = {}
        gid_val = r.get("_id")
        if isinstance(gid_val, dict):
            for g in valid_gbs:
                row_obj[g] = gid_val.get(g, "-")
        else:
            # single grouping key
            row_obj[valid_gbs[0]] = gid_val
        val = float(r.get("value") or 0)
        row_obj["value"] = val
        if "dia" in valid_gbs and "local" in valid_gbs:
            row_obj["weather"] = r.get("weather_first")
        sum_val += val
        rows_out.append(row_obj)

    # If grouping is aggregated (does not include 'dia'), compute per-group daily detail
    # Solo habilitar este detalle cuando el group_by efectivo tenga una sola clave
    # (p.ej. ['local']), para evitar aggregates muy pesados con muchas combinaciones.
    detail_map = {}
    if ("dia" not in valid_gbs) and (len(valid_gbs) == 1):
        # Build detail grouping = valid_gbs + ['dia']
        gb_map = {
            "local": {"$ifNull": ["$local", "-"]},
            "articulo": {"$ifNull": ["$articulo", "-"]},
            "familia": {"$ifNull": ["$familia", "-"]},
            "subfamilia": {"$ifNull": ["$subfamilia", "-"]},
            "mes": {"$ifNull": ["$mesano", "-"]},
            "dia": {"$ifNull": ["$_dia_str", "-"]},
        }
        detail_gbs = list(valid_gbs) + ["dia"]
        gid_detail = {g: gb_map[g] for g in detail_gbs}
        stages_detail: List[dict] = list(stages_base)
        stages_detail += [{"$group": {
            "_id": gid_detail,
            "uds": {"$sum": "$cantidad"},
            "kg_raw": {"$sum": {"$ifNull": ["$total_consumo", 0]}},
            "weather_first": {"$first": "$weather_tag"}
        }}]
        stages_detail += [{"$addFields": {
            "kg_eff": {
                "$cond": [
                    {"$and": [
                        {"$eq": [unit, "kg"]},
                        {"$eq": ["$kg_raw", 0]}
                    ]},
                    "$uds",
                    "$kg_raw"
                ]
            },
            "value": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": [unit, "kg"]}, "then": "$kg_eff"},
                        {"case": {"$eq": [unit, "unidad"]}, "then": "$uds"},
                    ],
                    "default": {"$cond": [{"$gt": ["$kg_eff", 0]}, "$kg_eff", "$uds"]}
                }
            }
        }}]
        stages_detail += [{"$sort": {"_id.dia": 1}}]
        detail_rows = await asyncio.to_thread(lambda: list(coll.aggregate(stages_detail)))
        # Build map key from group values (excluding 'dia')
        def _key_from_id(_id: dict):
            return tuple((_id.get(g) if isinstance(_id, dict) else None) for g in valid_gbs)
        for dr in detail_rows:
            _id = dr.get("_id") or {}
            key = _key_from_id(_id)
            arr = detail_map.setdefault(key, [])
            arr.append({
                **{g: _id.get(g, "-") for g in valid_gbs},
                "dia": _id.get("dia", "-"),
                "weather": dr.get("weather_first"),
                "value": float(dr.get("value") or 0)
            })
        # attach counts and detail_rows into rows_out
        # Add rainy/normal columns in table if not present
        columns.insert(len(valid_gbs), {"key": "lluvia_dias", "label": "Lluviosos", "align": "right", "format": "number"})
        columns.insert(len(valid_gbs)+1, {"key": "normal_dias", "label": "Normales", "align": "right", "format": "number"})
        for ro in rows_out:
            key = tuple(ro.get(g) for g in valid_gbs)
            det = detail_map.get(key, [])
            ro["detail_rows"] = det
            rainy = sum(1 for x in det if str(x.get("weather") or "").lower() in ("lluvia","nieve"))
            normal = sum(1 for x in det if str(x.get("weather") or "").lower() in ("soleado","otro","sin_dato"))
            ro["lluvia_dias"] = rainy
            ro["normal_dias"] = normal

    # Default ordering: by date (dia) then local if those keys exist
    def _safe_key(x, k):
        v = x.get(k)
        try:
            return str(v)
        except Exception:
            return ""
    if any("dia" in r for r in rows_out) and any("local" in r for r in rows_out):
        rows_out.sort(key=lambda x: (_safe_key(x, "dia"), _safe_key(x, "local")))

    # KPIs
    kpis = []
    kpis.append({"label": "Total", "value": round(sum_val, 2) if value_label == "kg" else int(round(sum_val)), "isMoney": False})
    kpis.append({"label": "Unidad", "value": ("kg" if value_label == "kg" else "uds")})
    if dates:
        kpis.append({"label": "Fechas", "value": ", ".join(dates)})
    if articles:
        kpis.append({"label": "Artículos", "value": ", ".join(articles)})

    # Build optional charts: pie by local (summing across other dims)
    charts = []
    if "local" in valid_gbs:
        # sum by local
        agg_by_local = {}
        for r in rows_out:
            loc = r.get("local") or "-"
            agg_by_local[loc] = agg_by_local.get(loc, 0.0) + float(r.get("value") or 0)
        # top 10 slices + others
        items = sorted(agg_by_local.items(), key=lambda kv: kv[1], reverse=True)
        top = items[:10]
        rest = items[10:]
        if rest:
            top.append(("Otros", sum(v for _, v in rest)))
        charts.append({
            "type": "pie",
            "title": "Participación por local",
            "data": [{"label": k, "value": round(v, 2) if value_label == "kg" else int(round(v))} for k, v in top]
        })

    payload = {
        "type": "data_table",
        "title": "Consumos",
        "subtitle": f"Agrupación: {', '.join(valid_gbs)} · Unidad: {'kg' if value_label == 'kg' else 'unidades'}",
        "kpis": kpis,
        "columns": columns,
        "rows": rows_out,
        "totals": {"value": round(sum_val, 2) if value_label == "kg" else int(round(sum_val))},
        "charts": charts,
    }
    return update, payload
