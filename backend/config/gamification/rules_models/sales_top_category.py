# config/gamification/rules_models/sales_top_category.py

from __future__ import annotations
from typing import Dict, Any, List, Optional
from pymongo.database import Database
import logging

logger = logging.getLogger(__name__)

TEMPLATE_KEY = "sales_top_category"

SALES_TOP_CATEGORY_RULE_TEMPLATE = {
    "key": TEMPLATE_KEY,
    "name": "Top Ventas por Categoría (Familia/Subfamilia/Producto)",
    "description": "Premia a quienes lideran ventas por familia, subfamilia o producto, a nivel de local o empresa.",
    "category": "sales",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_empleado_mensual",
            "fields": ["rut", "periodo", "local", "es_competidor", "sales_by_category", "sales_by_item"],
            "filter": "Descompone categorías/ítems y agrupa por rut (y local), ordenando por total/ cantidad."
        }
    ],
    "required_params": {
        "level": {
            "type": "select",
            "options": ["family", "subfamily", "product"],
            "default": "family",
            "description": "Nivel a evaluar."
        },
        "name": {
            "type": "text",
            "default": "",
            "description": "Nombre de la familia/subfamilia o identificador de producto (nombre o SKU)."
        },
        "metric": {
            "type": "select",
            "options": ["amount", "quantity"],
            "default": "amount",
            "description": "Métrica: monto total ('amount') o cantidad ('quantity')."
        },
        "ranking_scope": {
            "type": "select",
            "options": ["local", "empresa"],
            "default": "empresa",
            "description": "Ámbito del ranking."
        },
        "period_mode": {
            "type": "select",
            "options": ["month", "year"],
            "default": "month",
            "description": "Mensual o anual."
        },
        "position_type": {
            "type": "select",
            "options": ["top_n", "exact", "range"],
            "default": "top_n",
            "description": "Top N, posición exacta o rango."
        },
        "ranking_position": {
            "type": "number", "min": 1, "max": 100, "default": 1,
            "description": "N para Top N o posición exacta."
        },
        "position_from": {
            "type": "number", "min": 1, "max": 100, "default": 1,
            "description": "Desde (inclusive) si position_type = range."
        },
        "position_to": {
            "type": "number", "min": 1, "max": 100, "default": 10,
            "description": "Hasta (inclusive) si position_type = range."
        },
    },
    "optional_params": {
        "min_days_worked": {
            "type": "number", "min": 0, "default": 0,
            "description": "Mínimo de días con venta requeridos (si aplica)."
        }
    },
    "example_payload": {
        "rule_name": "top_familia_postres_local_top3",
        "segment_token_id": 1,
        "template_key": TEMPLATE_KEY,
        "params": {
            "level": "family",
            "name": "08 POSTRES",
            "metric": "amount",
            "ranking_scope": "local",
            "period_mode": "month",
            "position_type": "top_n",
            "ranking_position": 3
        },
        "merit_points": 5,
        "is_active": True
    }
}

def _pos_filter(position_type: str, pos: int, lo: int, hi: int) -> Dict[str, Any]:
    if position_type == "exact":
        return {"$eq": int(pos)}
    if position_type == "range":
        lo = max(1, int(lo or 1))
        hi = max(lo, int(hi or lo))
        return {"$gte": lo, "$lte": hi}
    return {"$lte": int(pos), "$gt": 0}

# ===========================
# 🚀 Catálogos embebidos
# ===========================

_RENTAB_COLL = "rentabilidad_producto_locales"

def get_sales_taxonomy(
    db: Database,
    *,
    mesano: Optional[str] = None,             # 'YYYYMM' (ej '202501')
    year: Optional[str] = None,               # 'YYYY'
    include_products: bool = False,
    max_products_per_subfamily: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Devuelve familias/subfamilias (y productos opcional) normalizados (trim) y ordenados,
    listos para el front.
    """
    match: Dict[str, Any] = {}
    if mesano:
        match["mesano"] = str(mesano)
    elif year:
        match["mesano"] = {"$regex": f"^{year}"}

    add_norm = {
        "$addFields": {
            "fam_norm": {"$trim": {"input": {"$ifNull": ["$familia", ""]}}},
            "sub_norm": {"$trim": {"input": {"$ifNull": ["$subfamilia", ""]}}},
            "prod_norm": {"$trim": {"input": {"$ifNull": ["$producto", ""]}}},
        }
    }

    # Families
    fam_pipe = [
        {"$match": match}, add_norm,
        {"$match": {"fam_norm": {"$ne": ""}}},
        {"$group": {"_id": "$fam_norm", "subfamilias": {"$addToSet": "$sub_norm"}}},
        {"$project": {
            "_id": 0,
            "key": "$_id",
            "subfamily_count": {
                "$size": {
                    "$filter": {"input": "$subfamilias", "as": "sf", "cond": {"$ne": ["$$sf", ""]}}
                }
            }
        }},
        {"$sort": {"key": 1}},
    ]
    families = list(db[_RENTAB_COLL].aggregate(fam_pipe))

    # Subfamilies
    sub_pipe = [
        {"$match": match}, add_norm,
        {"$match": {"fam_norm": {"$ne": ""}, "sub_norm": {"$ne": ""}}},
        {"$group": {"_id": {"family": "$fam_norm", "subfamily": "$sub_norm"}}},
        {"$project": {"_id": 0, "family": "$_id.family", "key": "$_id.subfamily"}},
        {"$sort": {"family": 1, "key": 1}},
    ]
    subfamilies = list(db[_RENTAB_COLL].aggregate(sub_pipe))

    products: List[Dict[str, Any]] = []
    if include_products:
        if max_products_per_subfamily:
            prod_pipe = [
                {"$match": match}, add_norm,
                {"$match": {"fam_norm": {"$ne": ""}, "sub_norm": {"$ne": ""}, "prod_norm": {"$ne": ""}}},
                {"$set": {
                    "family": "$fam_norm",
                    "subfamily": "$sub_norm",
                    "code": {"$toString": "$codig"},
                    "name": "$prod_norm",
                }},
                {"$setWindowFields": {
                    "partitionBy": {"family": "$family", "subfamily": "$subfamily"},
                    "sortBy": {"name": 1},
                    "output": {"rownum": {"$rank": {}}}
                }},
                {"$match": {"rownum": {"$lte": int(max_products_per_subfamily)}}},
                {"$project": {"_id": 0, "family": 1, "subfamily": 1, "code": 1, "name": 1}},
                {"$sort": {"family": 1, "subfamily": 1, "name": 1}},
            ]
        else:
            prod_pipe = [
                {"$match": match}, add_norm,
                {"$match": {"fam_norm": {"$ne": ""}, "sub_norm": {"$ne": ""}, "prod_norm": {"$ne": ""}}},
                {"$group": {
                    "_id": {"family": "$fam_norm", "subfamily": "$sub_norm", "code": "$codig"},
                    "name": {"$first": "$prod_norm"},
                }},
                {"$project": {
                    "_id": 0,
                    "family": "$_id.family",
                    "subfamily": "$_id.subfamily",
                    "code": {"$toString": "$_id.code"},
                    "name": "$name",
                }},
                {"$sort": {"family": 1, "subfamily": 1, "name": 1}},
            ]
        products = list(db[_RENTAB_COLL].aggregate(prod_pipe))

    return {
        "families": families,
        "subfamilies": subfamilies,
        **({"products": products} if include_products else {}),
    }

def get_template_descriptor(
    db: Database,
    *,
    mesano: Optional[str] = None,
    year: Optional[str] = None,
    include_products: bool = False,
    max_products_per_subfamily: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Devuelve el descriptor del template + catálogos dinámicos.
    Úsalo en tu endpoint de list templates cuando pidas este template.
    """
    catalogs = get_sales_taxonomy(
        db,
        mesano=mesano,
        year=year,
        include_products=include_products,
        max_products_per_subfamily=max_products_per_subfamily,
    )
    # no mutar el original
    tpl = dict(SALES_TOP_CATEGORY_RULE_TEMPLATE)
    tpl["catalogs"] = catalogs
    return tpl

# ===========================
# Evaluación (igual)
# ===========================

def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    """
    Evalúa Top Ventas por Categoría/Producto soportando selección múltiple:
    - Si params.selected_keys existe y tiene elementos, se usa SIEMPRE.
    - Si no, se intenta derivar 1 key a partir de params.name (antes de '—' o '-').
    """
    params = rule.get("params", {}) or {}
    level = params.get("level", "family")
    metric = params.get("metric", "amount")              # 'amount' | 'quantity'
    ranking_scope = params.get("ranking_scope", "empresa")
    period_mode = params.get("period_mode", "month")
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    position_type = params.get("position_type", "top_n")
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))

    # --- 1) Resolver llaves a filtrar (multi) ---
    selected_keys = [str(x).strip() for x in (params.get("selected_keys") or []) if str(x).strip()]

    if not selected_keys:
        # Backcompat: si solo vino 'name', recortar adornos ("— ...", "- ...")
        raw_name = (params.get("name") or "").strip()
        if raw_name:
            # partir por '—' o '-' y quedarnos con la primera parte
            cut = raw_name.split("—")[0].split("-")[0].strip()
            if cut:
                selected_keys = [cut]

    if not selected_keys:
        logger.warning("sales_top_category: no hay selected_keys ni name usable -> 0 ganadores")
        return []

    # --- 2) Base de período y competencia ---
    base_match: Dict[str, Any] = {"es_competidor": True}
    if period_mode == "month":
        base_match["periodo"] = periodo_dash
    else:
        year = (periodo_dash or "")[:4]
        base_match["periodo"] = {"$regex": f"^{year}-"}

    # --- 3) Config por nivel ---
    # armamos pipeline con normalización y match por IN(selected_keys)
    pipeline: List[Dict[str, Any]] = [{"$match": base_match}]

    if level in ("family", "subfamily"):
        # Desarmar categorías
        pipeline += [
            {"$unwind": "$sales_by_category"},
            {"$addFields": {
                "fam_norm": {"$trim": {"input": {"$ifNull": ["$sales_by_category.familia", ""]}}},
                "sub_norm": {"$trim": {"input": {"$ifNull": ["$sales_by_category.subfamilia", ""]}}},
                "amount_v": {"$ifNull": ["$sales_by_category.total", 0]},
                "qty_v": {"$ifNull": ["$sales_by_category.cantidad", 0]},
            }},
        ]
        if level == "family":
            pipeline.append({"$match": {"fam_norm": {"$in": selected_keys}}})
        else:
            pipeline.append({"$match": {"sub_norm": {"$in": selected_keys}}})

        metric_field = "$amount_v" if metric == "amount" else "$qty_v"

    elif level == "product":
        # Desarmar ítems
        pipeline += [
            {"$unwind": "$sales_by_item"},
            {"$addFields": {
                "sku_str": {"$toString": {"$ifNull": ["$sales_by_item.sku", ""]}},
                "code_str": {"$toString": {"$ifNull": ["$sales_by_item.code", "$sales_by_item.codigo"]}},  # por si tu ETL usa 'code' o 'codigo'
                "name_norm": {"$trim": {"input": {"$ifNull": ["$sales_by_item.nombre", ""]}}},
                "amount_v": {"$ifNull": ["$sales_by_item.total", 0]},
                "qty_v": {"$ifNull": ["$sales_by_item.cantidad", 0]},
            }},
            # Acepta match por SKU/código O por nombre (ambos desde selected_keys)
            {"$match": {"$or": [
                {"sku_str": {"$in": selected_keys}},
                {"code_str": {"$in": selected_keys}},
                {"name_norm": {"$in": selected_keys}},
            ]}},
        ]
        metric_field = "$amount_v" if metric == "amount" else "$qty_v"

    else:
        logger.warning(f"sales_top_category: level inválido '{level}'")
        return []

    # --- 4) Agrupar por empleado/local y calcular la métrica agregada ---
    pipeline += [
        {"$group": {
            "_id": {"rut": "$rut", "local": "$local"},
            "sum_amount": {"$sum": {"$cond": [{"$eq": [metric, "amount"]}, 1, 0]}},  # dummy para mantener estructura
            "sum_qty": {"$sum": {"$cond": [{"$eq": [metric, "quantity"]}, 1, 0]}},   # dummy
            "metric_value": {"$sum": metric_field},
            "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
        }},
        {"$addFields": {
            "rut": "$_id.rut",
            "local": "$_id.local",
        }},
        # Rankings empresa y local (denseRank)
        {"$setWindowFields": {
            "sortBy": {"metric_value": -1},
            "output": {
                "puesto_empresa": {"$denseRank": {}},
                "top_empresa": {"$max": "$metric_value"},
            }
        }},
        {"$setWindowFields": {
            "partitionBy": "$local",
            "sortBy": {"metric_value": -1},
            "output": {
                "puesto_local": {"$denseRank": {}},
                "top_local": {"$max": "$metric_value"},
            }
        }},
    ]

    # --- 5) Post-filtros: posición + días mínimos ---
    def _pos_filter(pt: str, pos: int, lo: int, hi: int) -> Dict[str, Any]:
        if pt == "exact":
            return {"$eq": int(pos)}
        if pt == "range":
            lo = max(1, int(lo or 1))
            hi = max(lo, int(hi or lo))
            return {"$gte": lo, "$lte": hi}
        return {"$lte": int(pos), "$gt": 0}  # top_n

    post = {f"puesto_{ranking_scope}": _pos_filter(position_type, ranking_position, position_from, position_to)}
    if min_days_worked > 0:
        post = {"$and": [post, {"dias": {"$gte": int(min_days_worked)}}]}

    pipeline.append({"$match": post})
    pipeline.append({"$project": {"_id": 0, "rut": 1}})

    winners = list(db.kpis_empleado_mensual.aggregate(pipeline))
    return [str(w.get("rut")) for w in winners]


# ===========================
# Progreso (como sales_ranking)
# ===========================
def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    """
    Devuelve progreso para Top Ventas por Categoría/Producto mostrando la posición actual
    del empleado y el valor del top 1, por cada key seleccionada.
    - level: family | subfamily | product
    - metric: amount | quantity
    - ranking_scope: empresa | local
    - period_mode: month | year
    """
    params = rule.get("params", {}) or {}
    level = params.get("level", "family")
    metric = params.get("metric", "amount")
    ranking_scope = params.get("ranking_scope", "empresa")
    period_mode = params.get("period_mode", "month")
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    # Resolver keys
    selected_keys = [str(x).strip() for x in (params.get("selected_keys") or []) if str(x).strip()]
    if not selected_keys:
        raw_name = (params.get("name") or "").strip()
        if raw_name:
            cut = raw_name.split("—")[0].split("-")[0].strip()
            if cut:
                selected_keys = [cut]
    if not selected_keys:
        return {"progress": [], "summary": "Sin categorías seleccionadas"}

    # Base período/competencia (sin filtrar por rut para no sesgar el ranking)
    base_match: Dict[str, Any] = {"es_competidor": True}
    if period_mode == "month":
        base_match["periodo"] = periodo_dash
    else:
        year = (periodo_dash or "")[:4]
        base_match["periodo"] = {"$regex": f"^{year}-"}

    pipeline: List[Dict[str, Any]] = [{"$match": base_match}]

    # Explode por nivel y estandarizar campos
    if level in ("family", "subfamily"):
        pipeline += [
            {"$unwind": "$sales_by_category"},
            {"$addFields": {
                "fam_norm": {"$trim": {"input": {"$ifNull": ["$sales_by_category.familia", ""]}}},
                "sub_norm": {"$trim": {"input": {"$ifNull": ["$sales_by_category.subfamilia", ""]}}},
                "amount_v": {"$ifNull": ["$sales_by_category.total", 0]},
                "qty_v": {"$ifNull": ["$sales_by_category.cantidad", 0]},
            }},
        ]
        if level == "family":
            pipeline.append({"$match": {"fam_norm": {"$in": selected_keys}}})
        else:
            pipeline.append({"$match": {"sub_norm": {"$in": selected_keys}}})
        metric_field = "$amount_v" if metric == "amount" else "$qty_v"
    elif level == "product":
        pipeline += [
            {"$unwind": "$sales_by_item"},
            {"$addFields": {
                "sku_str": {"$toString": {"$ifNull": ["$sales_by_item.sku", ""]}},
                "code_str": {"$toString": {"$ifNull": ["$sales_by_item.code", "$sales_by_item.codigo"]}},
                "name_norm": {"$trim": {"input": {"$ifNull": ["$sales_by_item.nombre", ""]}}},
                "amount_v": {"$ifNull": ["$sales_by_item.total", 0]},
                "qty_v": {"$ifNull": ["$sales_by_item.cantidad", 0]},
            }},
            {"$match": {"$or": [
                {"sku_str": {"$in": selected_keys}},
                {"code_str": {"$in": selected_keys}},
                {"name_norm": {"$in": selected_keys}},
            ]}},
        ]
        metric_field = "$amount_v" if metric == "amount" else "$qty_v"
    else:
        return {"progress": [], "summary": f"level inválido: {level}"}

    # Agrupar por empleado/local (sumando todas las keys seleccionadas)
    pipeline += [
        {"$group": {
            "_id": {"rut": "$rut", "local": "$local"},
            "metric_value": {"$sum": metric_field},
            "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
        }},
        {"$addFields": {"rut": "$_id.rut", "local": "$_id.local"}},
    ]
    if min_days_worked > 0:
        pipeline.append({"$match": {"dias": {"$gte": int(min_days_worked)}}})

    if ranking_scope == "empresa":
        pipeline += [
            {"$setWindowFields": {
                "sortBy": {"metric_value": -1},
                "output": {"puesto_empresa": {"$denseRank": {}}, "top_empresa": {"$max": "$metric_value"}}
            }},
            {"$match": {"rut": rut}},
            {"$project": {"_id": 0, "metric_value": 1, "puesto_empresa": 1, "top_empresa": 1}},
        ]
        row = db.kpis_empleado_mensual.aggregate(pipeline)
        rows = list(row)
        if not rows:
            return {"progress": []}
        r = rows[0]
        return {"progress": [{
            "type": "ranking",
            "level": level,
            "keys_aggregated": selected_keys,
            "scope": "empresa",
            "current_position": r.get("puesto_empresa"),
            "top_value": r.get("top_empresa"),
            "current_value": r.get("metric_value"),
            "min_days_worked": min_days_worked or 0,
        }]}
    else:
        pipeline += [
            {"$setWindowFields": {
                "partitionBy": "$local",
                "sortBy": {"metric_value": -1},
                "output": {"puesto_local": {"$denseRank": {}}, "top_local": {"$max": "$metric_value"}}
            }},
            {"$setWindowFields": {
                "partitionBy": "$rut",
                "sortBy": {"metric_value": -1},
                "output": {"best_local_rank": {"$denseRank": {}}}
            }},
            {"$match": {"rut": rut, "best_local_rank": 1}},
            {"$project": {"_id": 0, "metric_value": 1, "puesto_local": 1, "top_local": 1, "local": 1}},
        ]
        rows = list(db.kpis_empleado_mensual.aggregate(pipeline))
        if not rows:
            return {"progress": []}
        r = rows[0]
        return {"progress": [{
            "type": "ranking",
            "level": level,
            "keys_aggregated": selected_keys,
            "scope": "local",
            "local": r.get("local"),
            "current_position": r.get("puesto_local"),
            "top_value": r.get("top_local"),
            "current_value": r.get("metric_value"),
            "min_days_worked": min_days_worked or 0,
        }]}
