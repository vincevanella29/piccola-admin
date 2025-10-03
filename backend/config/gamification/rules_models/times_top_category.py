# config/gamification/rules_models/times_top_category.py

from __future__ import annotations
from typing import Dict, Any, List, Optional
from pymongo.database import Database
import logging
import re

logger = logging.getLogger(__name__)

TEMPLATE_KEY = "times_top_category"

def _slugify(name: str) -> str:
    s = (name or "").strip().lower()
    s = s.replace("/", " ").replace(".", " ").replace("_", " ")
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

TIMES_TOP_CATEGORY_RULE_TEMPLATE: Dict[str, Any] = {
    "key": TEMPLATE_KEY,
    "name": "Top Tiempos por Categoría/Centro",
    "description": "Premia a quienes logran menores tiempos promedio por Centro de Producción, Familia o Subfamilia, a nivel de local o empresa.",
    "category": "times",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_tiempos_empleado_mensual",
            "fields": [
                "rut",
                "periodo",
                "local",
                "es_competidor",
                "by_centro",
                "by_familia",
                "by_subfamilia",
            ],
            "filter": "Descompone categorías/centros y compara avg_seg (menor es mejor) por rut y local.",
        }
    ],
    "required_params": {
        "level": {
            "type": "select",
            "options": ["center", "family", "subfamily"],  # 👈 ahora incluye centros
            "default": "center",
            "description": "Nivel a evaluar (centro de producción, familia o subfamilia).",
        },
        "name": {
            "type": "text",
            "default": "",
            "description": "Nombre de centro/familia/subfamilia (fallback si no hay selected_keys).",
        },
        "ranking_scope": {
            "type": "select",
            "options": ["local", "empresa"],
            "default": "empresa",
            "description": "Ámbito del ranking.",
        },
        "period_mode": {
            "type": "select",
            "options": ["month", "year"],
            "default": "month",
            "description": "Mensual o anual.",
        },
        "position_type": {
            "type": "select",
            "options": ["top_n", "exact", "range"],
            "default": "top_n",
            "description": "Top N, posición exacta o rango.",
        },
        "ranking_position": {
            "type": "number",
            "min": 1,
            "max": 100,
            "default": 1,
            "description": "N para Top N o posición exacta.",
        },
        "position_from": {
            "type": "number",
            "min": 1,
            "max": 100,
            "default": 1,
            "description": "Desde (inclusive) si position_type = range.",
        },
        "position_to": {
            "type": "number",
            "min": 1,
            "max": 100,
            "default": 10,
            "description": "Hasta (inclusive) si position_type = range.",
        },
    },
    "optional_params": {
        "min_days_worked": {
            "type": "number",
            "min": 0,
            "default": 0,
            "description": "Mínimo de días con registro en la(s) categoría(s).",
        },
        # multiselección para front (slugs de centros o labels exactos de family/subfamily)
        "selected_keys": {
            "type": "multiselect",
            "default": [],
            "description": "Selecciona 1+ claves (centros/familias/subfamilias) desde catalogs.*",
        },
        # espejo de ventas: opcional para usabilidad
        "selected_labels": {
            "type": "multiselect",
            "default": [],
            "description": "Labels legibles para UI.",
        },
        "names": {
            "type": "multiselect",
            "default": [],
            "description": "Back-compat: copia de selected_labels.",
        },
    },
    "example_payload": {
        "rule_name": "top_centro_tiempos_empresa_top3",
        "segment_token_id": 1,
        "template_key": TEMPLATE_KEY,
        "params": {
            "level": "center",
            "name": "7 PASTAS",
            "ranking_scope": "empresa",
            "period_mode": "month",
            "position_type": "top_n",
            "ranking_position": 3,
            "selected_keys": ["7-pastas"]  # slugs de centro (preferido)
        },
        "merit_points": 5,
        "is_active": True,
    },
}

def _pos_filter(position_type: str, pos: int, lo: int, hi: int) -> Dict[str, Any]:
    if position_type == "exact":
        return {"$eq": int(pos)}
    if position_type == "range":
        lo = max(1, int(lo or 1))
        hi = max(lo, int(hi or lo))
        return {"$gte": lo, "$lte": hi}
    return {"$lte": int(pos), "$gt": 0}

# ===================================
# Catálogos para el front (incluye CENTROS)
# ===================================

_RENTAB_COLL = "rentabilidad_producto_locales"
_CFG_CENTROS = "centros_produccion_config"
_SRC_TIEMPOS = "ventas_hora_tiempo_promedio"  # fallback para nombres de centro

def _get_centers_catalog(db: Database, *, mesano: Optional[str], year: Optional[str]) -> List[Dict[str, Any]]:
    """
    Devuelve centros [{slug, label}] para UI.
    1) Toma los activos desde centros_produccion_config (slug).
    2) Si falta label, intenta inferirlo de 'ventas_hora_tiempo_promedio' (CENTROPRODUCCION).
    3) Si el label no está, usa el slug "bonito" como label.
    """
    # 1) base desde config
    cfg = list(db[_CFG_CENTROS].find({"active": True}, {"centro_slug": 1}))
    slugs = sorted({(c.get("centro_slug") or "").strip() for c in cfg if (c.get("centro_slug") or "").strip()})
    centers = {s: {"slug": s, "label": None} for s in slugs}

    # 2) inferir label desde datos crudos (opcional)
    match: Dict[str, Any] = {}
    if mesano:
        match["MESANO"] = int(mesano)
    elif year:
        match["MESANO"] = {"$gte": int(f"{year}01"), "$lte": int(f"{year}12")}
    pipe = [
        {"$match": match} if match else {"$match": {"CENTROPRODUCCION": {"$ne": None}}},
        {"$group": {"_id": {"nombre": "$CENTROPRODUCCION"}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "nombre": "$_id.nombre"}},
    ]
    for r in db[_SRC_TIEMPOS].aggregate(pipe):
        nombre = (r.get("nombre") or "").strip()
        if not nombre:
            continue
        slug = _slugify(nombre)
        if slug not in centers:
            # Si no estaba en config pero aparece en datos, también lo incluimos
            centers[slug] = {"slug": slug, "label": nombre}
        else:
            centers[slug]["label"] = centers[slug]["label"] or nombre

    # 3) completar labels
    out = []
    for v in centers.values():
        label = (v["label"] or v["slug"].replace("-", " ").upper()).strip()
        out.append({"slug": v["slug"], "label": label})
    out.sort(key=lambda x: x["label"])
    return out

def get_times_taxonomy(
    db: Database,
    *,
    mesano: Optional[str] = None,             # 'YYYYMM'
    year: Optional[str] = None,               # 'YYYY'
    include_products: bool = False,
    max_products_per_subfamily: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Familias/subfamilias (y productos opcional) + Centros de Producción (slug/label) para el front.
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

    centers = _get_centers_catalog(db, mesano=mesano, year=year)

    return {
        "families": families,
        "subfamilies": subfamilies,
        "centers": centers,  # 👈 nuevo
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
    catalogs = get_times_taxonomy(
        db,
        mesano=mesano,
        year=year,
        include_products=include_products,
        max_products_per_subfamily=max_products_per_subfamily,
    )
    tpl = dict(TIMES_TOP_CATEGORY_RULE_TEMPLATE)
    tpl["catalogs"] = catalogs
    return tpl

# ===========================
# Evaluación (incluye CENTER)
# ===========================

def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    """
    Evalúa Top Tiempos por Centro/Familia/Subfamilia usando avg_seg (menor mejor).
    Permite múltiples llaves vía params.selected_keys (centro_slug o nombre exacto de fam/subfam).
    """
    params = rule.get("params", {}) or {}
    level = params.get("level", "center")  # 'center' | 'family' | 'subfamily'
    ranking_scope = params.get("ranking_scope", "empresa")
    period_mode = params.get("period_mode", "month")
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    position_type = params.get("position_type", "top_n")
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))

    # Resolver keys
    selected_keys = [str(x).strip() for x in (params.get("selected_keys") or []) if str(x).strip()]
    if not selected_keys:
        raw_name = (params.get("name") or "").strip()
        if raw_name:
            # Para center intentamos slugificar; para fam/subfam cortamos label
            if level == "center":
                selected_keys = [_slugify(raw_name)]
            else:
                cut = raw_name.split("—")[0].split("-")[0].strip()
                if cut:
                    selected_keys = [cut]
    if not selected_keys:
        logger.warning("times_top_category: no hay selected_keys ni name usable -> 0 ganadores")
        return []

    # Base período
    base_match: Dict[str, Any] = {"es_competidor": True}
    if period_mode == "month":
        base_match["periodo"] = periodo_dash
    else:
        year = (periodo_dash or "")[:4]
        base_match["periodo"] = {"$regex": f"^{year}-"}

    pipeline: List[Dict[str, Any]] = [{"$match": base_match}]

    if level == "center":
        pipeline += [
            {"$unwind": "$by_centro"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_centro.centro_slug", ""]}}},
                "metric_value": {"$ifNull": ["$by_centro.avg_seg", None]},
                "dias": {"$ifNull": ["$by_centro.dias_con_registro", 0]},
            }},
            {"$match": {"key": {"$in": selected_keys}, "metric_value": {"$ne": None, "$gt": 0}}},
        ]
    elif level == "family":
        pipeline += [
            {"$unwind": "$by_familia"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_familia.familia", ""]}}},
                "metric_value": {"$ifNull": ["$by_familia.avg_seg", None]},
                "dias": {"$ifNull": ["$by_familia.dias_con_registro", 0]},
            }},
            {"$match": {"key": {"$in": selected_keys}, "metric_value": {"$ne": None, "$gt": 0}}},
        ]
    elif level == "subfamily":
        pipeline += [
            {"$unwind": "$by_subfamilia"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_subfamilia.subfamilia", ""]}}},
                "metric_value": {"$ifNull": ["$by_subfamilia.avg_seg", None]},
                "dias": {"$ifNull": ["$by_subfamilia.dias_con_registro", 0]},
            }},
            {"$match": {"key": {"$in": selected_keys}, "metric_value": {"$ne": None, "$gt": 0}}},
        ]
    else:
        logger.warning(f"times_top_category: level inválido '{level}'")
        return []

    # Ranks (menor mejor) - usar sortBy de 1 campo (requisito Mongo para $denseRank)
    pipeline += [
        {"$addFields": {"rut": "$rut", "local": "$local"}},
        {"$setWindowFields": {
            "sortBy": {"metric_value": 1},
            "output": {
                "puesto_empresa": {"$denseRank": {}},
                "best_empresa": {"$min": "$metric_value"},
            }
        }},
        {"$setWindowFields": {
            "partitionBy": "$local",
            "sortBy": {"metric_value": 1},
            "output": {
                "puesto_local": {"$denseRank": {}},
                "best_local": {"$min": "$metric_value"},
            }
        }},
    ]

    post: Dict[str, Any] = {f"puesto_{ranking_scope}": _pos_filter(position_type, ranking_position, position_from, position_to)}
    if min_days_worked > 0:
        post = {"$and": [post, {"dias": {"$gte": int(min_days_worked)}}]}

    # Selección de ganadores
    if ranking_scope == "empresa" and position_type == "top_n" and int(ranking_position) == 1:
        # Asegurar único Top 1 determinístico
        pipeline += [
            {"$match": post},
            {"$sort": {"metric_value": 1, "dias": -1, "rut": 1}},
            {"$limit": 1},
            {"$project": {"_id": 0, "rut": 1}},
        ]
    else:
        pipeline += [
            {"$match": post},
            {"$project": {"_id": 0, "rut": 1}},
            {"$group": {"_id": "$rut"}},
            {"$project": {"_id": 0, "rut": "$_id"}},
        ]

    winners = list(db.kpis_tiempos_empleado_mensual.aggregate(pipeline))
    return [w["rut"] for w in winners]

# ===========================
# Progreso agregado (menor es mejor) — incluye CENTER
# ===========================

def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    """
    Devuelve progreso agregando todas las llaves seleccionadas del level:
    Métrica = promedio ponderado por 'dias' (dias_con_registro).
    """
    params = rule.get("params", {}) or {}
    level = params.get("level", "center")
    ranking_scope = params.get("ranking_scope", "empresa")
    period_mode = params.get("period_mode", "month")
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    # keys
    selected_keys = [str(x).strip() for x in (params.get("selected_keys") or []) if str(x).strip()]
    if not selected_keys:
        raw_name = (params.get("name") or "").strip()
        if raw_name:
            if level == "center":
                selected_keys = [_slugify(raw_name)]
            else:
                cut = raw_name.split("—")[0].split("-")[0].strip()
                if cut:
                    selected_keys = [cut]
    if not selected_keys:
        return {"progress": [], "summary": "Sin categorías seleccionadas"}

    # período
    base_match: Dict[str, Any] = {"es_competidor": True}
    if period_mode == "month":
        base_match["periodo"] = periodo_dash
    else:
        year = (periodo_dash or "")[:4]
        base_match["periodo"] = {"$regex": f"^{year}-"}

    pipe: List[Dict[str, Any]] = [{"$match": base_match}]

    # Unwind según level
    if level == "center":
        pipe += [
            {"$unwind": "$by_centro"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_centro.centro_slug", ""]}}},
                "avg_seg": {"$ifNull": ["$by_centro.avg_seg", None]},
                "dias": {"$ifNull": ["$by_centro.dias_con_registro", 0]},
            }},
            {"$match": {"key": {"$in": selected_keys}, "avg_seg": {"$ne": None, "$gt": 0}}},
        ]
    elif level == "family":
        pipe += [
            {"$unwind": "$by_familia"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_familia.familia", ""]}}},
                "avg_seg": {"$ifNull": ["$by_familia.avg_seg", None]},
                "dias": {"$ifNull": ["$by_familia.dias_con_registro", 0]},
            }},
            {"$match": {"key": {"$in": selected_keys}, "avg_seg": {"$ne": None, "$gt": 0}}},
        ]
    elif level == "subfamily":
        pipe += [
            {"$unwind": "$by_subfamilia"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_subfamilia.subfamilia", ""]}}},
                "avg_seg": {"$ifNull": ["$by_subfamilia.avg_seg", None]},
                "dias": {"$ifNull": ["$by_subfamilia.dias_con_registro", 0]},
            }},
            {"$match": {"key": {"$in": selected_keys}, "avg_seg": {"$ne": None, "$gt": 0}}},
        ]
    else:
        return {"progress": [], "summary": f"level inválido: {level}"}

    # Agregación y ranking
    if ranking_scope == "empresa":
        pipe += [
            {"$group": {
                "_id": {"rut": "$rut"},
                "sum_dias": {"$sum": "$dias"},
                "sum_w": {"$sum": {"$multiply": ["$avg_seg", "$dias"]}},
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "metric_value": {"$cond": [{"$gt": ["$sum_dias", 0]}, {"$divide": ["$sum_w", "$sum_dias"]}, None]},
            }},
            {"$match": {"metric_value": {"$ne": None}}},
        ]
        if min_days_worked > 0:
            pipe.append({"$match": {"sum_dias": {"$gte": int(min_days_worked)}}})
        pipe += [
            {"$setWindowFields": {
                "sortBy": {"metric_value": 1},
                "output": {
                    "puesto_empresa": {"$denseRank": {}},
                    "best_empresa": {"$min": "$metric_value"},
                    "avg_empresa": {"$avg": "$metric_value"},
                }
            }},
            {"$match": {"rut": rut}},
            {"$project": {"_id": 0}},
        ]
        rows = list(db.kpis_tiempos_empleado_mensual.aggregate(pipe))
        if not rows:
            return {"progress": [], "summary": "Sin datos del período"}
        r = rows[0]
        return {"progress": [{
            "type": "ranking", "level": level, "scope": "empresa",
            "keys_aggregated": selected_keys,
            "current_value": r.get("metric_value"),
            "current_position": r.get("puesto_empresa"),
            "best_value": r.get("best_empresa"),
            "avg_value": r.get("avg_empresa"),
            "min_days_worked": min_days_worked or 0,
        }]}

    else:
        pipe += [
            {"$group": {
                "_id": {"rut": "$rut", "local": "$local"},
                "sum_dias": {"$sum": "$dias"},
                "sum_w": {"$sum": {"$multiply": ["$avg_seg", "$dias"]}},
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "local": "$_id.local",
                "metric_value": {"$cond": [{"$gt": ["$sum_dias", 0]}, {"$divide": ["$sum_w", "$sum_dias"]}, None]},
            }},
            {"$match": {"metric_value": {"$ne": None}}},
        ]
        if min_days_worked > 0:
            pipe.append({"$match": {"sum_dias": {"$gte": int(min_days_worked)}}})
        pipe += [
            {"$setWindowFields": {
                "partitionBy": "$local",
                "sortBy": {"metric_value": 1},
                "output": {
                    "puesto_local": {"$denseRank": {}},
                    "best_local": {"$min": "$metric_value"},
                    "avg_local": {"$avg": "$metric_value"},
                }
            }},
            {"$setWindowFields": {
                "partitionBy": "$rut",
                "sortBy": {"$literal": 1},  # truco para elegir 1 fila por rut
                "output": {"best_local_rank": {"$denseRank": {}}}
            }},
            {"$match": {"rut": rut, "best_local_rank": 1}},
            {"$project": {"_id": 0}},
        ]
        rows = list(db.kpis_tiempos_empleado_mensual.aggregate(pipe))
        if not rows:
            return {"progress": [], "summary": "Sin datos del período"}
        r = rows[0]
        return {"progress": [{
            "type": "ranking", "level": level, "scope": "local",
            "keys_aggregated": selected_keys,
            "current_value": r.get("metric_value"),
            "current_position": r.get("puesto_local"),
            "best_value": r.get("best_local"),
            "avg_value": r.get("avg_local"),
            "local": r.get("local"),
            "min_days_worked": min_days_worked or 0,
        }]}
