import re
import logging
from typing import List, Any
from utils.web3mongo import db
from ..common.common import get_link_info
from ..common.filters import grok_filters

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

async def handle_consumos(update, context):
    text = (update.message.text or "").strip()
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[consumos_handler] tg_id={tg_id} text='{text}'")

    link = get_link_info(tg_id) if tg_id else None
    if not link or link.get("expired"):
        return update, ["Primero conecta tu cuenta con Privy para ver consumos. Usa /link."]

    # 1) Grok decide TODO → plan (incluye unit)
    plan = await grok_filters("consumos", text) or {}
    m = plan.get("match") or {}
    dates       = m.get("dates") or []
    mesanos     = m.get("mesanos") or []
    locals_     = m.get("locals") or []
    articles    = m.get("articles") or []
    families    = m.get("families") or []
    subfamilies = m.get("subfamilies") or []
    art_regex   = m.get("article_regex") or []

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
    }]

    match_and = []

    if dates:
        match_and.append({"_dia_str": {"$in": dates}})
    if mesanos:
        match_and.append(_periods_str_or_int_match(mesanos))
    if locals_:
        match_and.append({"local": {"$in": locals_}})
    # Artículo: exacto o substring (fallback)
    if articles or art_regex:
        ors = []
        if articles:
            ors.append({"articulo": {"$in": articles}})
            ors += [{"articulo": {"$regex": re.escape(t), "$options": "i"}} for t in articles]
        if art_regex:
            ors += [{"articulo": {"$regex": re.escape(t), "$options": "i"}} for t in art_regex]
        match_and.append({"$or": ors})
    if families:
        match_and.append({"familia": {"$in": families}})
    if subfamilies:
        match_and.append({"subfamilia": {"$in": subfamilies}})
    # (art_regex integrado arriba)

    if match_and:
        stages += [{"$match": {"$and": match_and}}]

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
    stages += [{
        "$group": {
            "_id": gid,
            "uds": {"$sum": "$cantidad"},
            "kg_raw": {"$sum": {"$ifNull": ["$total_consumo", 0]}},
            "sample_fecha": {"$first": "$_dia_str"},
            "sample_articulo": {"$first": "$articulo"}
        }
    }]

    # kg efectivo: si unit='kg' y no hay kg_raw, usa uds (caso artículos por peso donde 'cantidad' viene en kg)
    stages += [{
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
    stages += [{
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
        stages += [{"$sort": {sort_key: 1 if order == "asc" else -1}}]
    else:
        stages += [{"$sort": {"value": -1 if order == "desc" else 1}}]
    stages += [{"$limit": max(1, min(limit, 200))}]

    logger.info(f"[consumos plan] {plan}")
    logger.info(f"[consumos stages] {stages}")
    rows = list(coll.aggregate(stages))
    if not rows:
        return update, ["Sin resultados para ese pedido."]

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

    # Encabezado con contexto
    head_lines = []
    title = "📊 Consumos"
    if articles:
        title += f" · {' · '.join(articles)}"
    head_lines.append(title)
    meta = []
    if dates:
        meta.append("Fechas: " + ", ".join(dates))
    if locals_:
        meta.append("Locales: " + ", ".join(locals_))
    if valid_gbs:
        meta.append("Agrupación: " + ", ".join(valid_gbs))
    meta.append("Unidad: " + ("kg" if value_label == "kg" else "unidades"))
    if meta:
        head_lines.append(" · ".join(meta))

    out = ["\n".join(head_lines), ""]

    # Encabezado de tabla
    metric_header = "Consumo (kg)" if value_label == "kg" else "Cantidad (uds)"
    out.append(f"Grupo | {metric_header}")
    out.append("--- | ---")

    # Filas de tabla
    for r in rows:
        gid_val = r.get("_id")
        if isinstance(gid_val, dict):
            parts = []
            for g in valid_gbs:
                parts.append(f"{g}={gid_val.get(g, '-')}")
            gid_val = " · ".join(parts)
        val = float(r.get("value") or 0)
        if value_label == "kg":
            cell = f"{val:.2f} kg"
        else:
            cell = f"{int(round(val))} uds"
        out.append(f"{gid_val} | {cell}")

    # Totales
    try:
        sum_val = sum(float(r.get("value") or 0) for r in rows)
        if value_label == "kg":
            tot_text = f"{sum_val:.2f} kg"
        else:
            tot_text = f"{int(round(sum_val))} uds"
        out += ["", f"TOTAL | {tot_text}"]
    except Exception:
        pass

    return update, out
