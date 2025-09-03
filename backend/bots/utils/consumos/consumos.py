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
            {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha"}},
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
    measure  = plan.get("measure") or "auto"
    unit     = plan.get("unit") or "auto"
    order    = plan.get("order") or "desc"
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
    }
    gid = gb_map.get(group_by, {"$ifNull": ["$local", "-"]})

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

    stages += [{"$sort": {"value": -1 if order == "desc" else 1}}, {"$limit": max(1, min(limit, 200))}]

    logger.info(f"[consumos plan] {plan}")
    logger.info(f"[consumos stages] {stages}")
    rows = list(coll.aggregate(stages))
    if not rows:
        return update, ["Sin resultados para ese pedido."]

    # 3) Render claro: producto, fechas, unit, agrupación
    # Encabezado informativo
    head = []
    if articles:
        head.append("Producto(s): " + " · ".join(articles))
    if dates:
        head.append("Fechas: " + ", ".join(dates))
    if locals_:
        head.append("Locales: " + ", ".join(locals_))
    head.append(f"Agrupación: {group_by}")
    head.append(f"Unidad pedida: {unit}")
    out = [" | ".join(head), ""]

    # Tabla
    out.append("Grupo | Valor | Uds | Kg")
    for r in rows:
        gid_val = r.get("_id")
        val = float(r.get("value") or 0)
        lab = (r.get("value_label") or "").lower()
        uds = int(r.get("uds") or 0)
        kg  = float(r.get("kg_eff") if r.get("kg_eff") is not None else r.get("kg_raw") or 0)
        # Valor con etiqueta
        if lab == "kg":
            val_str = f"{val:.2f} kg"
        else:
            val_str = f"{uds} uds" if lab == "uds" else f"{val:.2f}"
        out.append(f"{gid_val} | {val_str} | {uds} | {kg:.2f}")

    # Totales (del set devuelto)
    try:
        sum_val = sum(float(r.get("value") or 0) for r in rows)
        sum_uds = sum(int(r.get("uds") or 0) for r in rows)
        sum_kg  = sum(float((r.get("kg_eff") if r.get("kg_eff") is not None else r.get("kg_raw") or 0)) for r in rows)
        tot_label = rows[0].get("value_label") or unit or "auto"
        tot_val_text = f"{sum_val:.2f} kg" if (tot_label == "kg") else (f"{sum_uds} uds" if tot_label == "uds" else f"{sum_val:.2f}")
        out += ["", f"TOTAL | {tot_val_text} | {sum_uds} | {sum_kg:.2f}"]
    except Exception:
        pass

    return update, out
