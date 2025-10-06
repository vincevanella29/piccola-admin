from __future__ import annotations
from typing import Dict, Any, List, Optional
from pymongo.database import Database
import logging
import re

logger = logging.getLogger(__name__)

TEMPLATE_KEY = "times_metrics_employee"

# ===========================
# Helpers compartidos
# ===========================

def _pos_filter(position_type: str, pos: int, lo: int, hi: int) -> Dict[str, Any]:
    if position_type == "exact":
        return {"$eq": int(pos)}
    if position_type == "range":
        lo = max(1, int(lo or 1))
        hi = max(lo, int(hi or lo))
        return {"$gte": lo, "$lte": hi}
    return {"$lte": int(pos), "$gt": 0}


def _slugify(name: str) -> str:
    s = (name or "").strip().lower()
    s = s.replace("/", " ").replace(".", " ").replace("_", " ")
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

# ===========================
# Catálogos para UI (families, subfamilies, centers)
# ===========================

_RENTAB_COLL = "rentabilidad_producto_locales"
_CFG_CENTROS = "centros_produccion_config"
_SRC_TIEMPOS = "ventas_hora_tiempo_promedio"  # fallback para nombres de centro


def _get_centers_catalog(db: Database, *, mesano: Optional[str], year: Optional[str]) -> List[Dict[str, Any]]:
    cfg = list(db[_CFG_CENTROS].find({"active": True}, {"centro_slug": 1}))
    slugs = sorted({(c.get("centro_slug") or "").strip() for c in cfg if (c.get("centro_slug") or "").strip()})
    centers = {s: {"slug": s, "label": None} for s in slugs}

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
            centers[slug] = {"slug": slug, "label": nombre}
        else:
            centers[slug]["label"] = centers[slug]["label"] or nombre

    out: List[Dict[str, Any]] = []
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

    sub_pipe = [
        {"$match": match}, add_norm,
        {"$match": {"fam_norm": {"$ne": ""}, "sub_norm": {"$ne": ""}}},
        {"$group": {"_id": {"family": "$fam_norm", "subfamily": "$sub_norm"}}},
        {"$project": {"_id": 0, "family": "$_id.family", "key": "$_id.subfamily"}},
        {"$sort": {"family": 1, "key": 1}},
    ]
    subfamilies = list(db[_RENTAB_COLL].aggregate(sub_pipe))

    centers = _get_centers_catalog(db, mesano=mesano, year=year)

    return {
        "families": families,
        "subfamilies": subfamilies,
        "centers": centers,
    }

# ===========================
# Template descriptor
# ===========================

TIMES_METRICS_EMPLOYEE_TEMPLATE: Dict[str, Any] = {
    "key": TEMPLATE_KEY,
    "name": "Tiempos (Empleado): Métricas general / por categoría",
    "description": "Premia por ranking de tiempos a nivel de empleado: general (overall) o por centro/familia/subfamilia.",
    "category": "times",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_tiempos_empleado_mensual",
            "fields": [
                "rut", "periodo", "local", "es_competidor",
                "tiempos.avg_seg", "tiempos.dias_con_registro", "tiempos.samples_share",
                "samples_total",
                "by_centro", "by_familia", "by_subfamilia"
            ],
            "filter": "Ranking por tiempos a nivel empleado (avg o samples)."
        }
    ],
    "required_params": {
        "level": {"type": "select", "options": ["overall", "center", "family", "subfamily"], "default": "overall"},
        "ranking_scope": {"type": "select", "options": ["local", "empresa"], "default": "empresa"},
        "period_mode": {"type": "select", "options": ["month", "year"], "default": "month"},
        "position_type": {"type": "select", "options": ["top_n", "exact", "range"], "default": "top_n"},
        "ranking_position": {"type": "number", "min": 1, "max": 100, "default": 1},
        "position_from": {"type": "number", "min": 1, "max": 100, "default": 1},
        "position_to": {"type": "number", "min": 1, "max": 100, "default": 10},
    },
    "optional_params": {
        "position_metric": {"type": "select", "options": ["avg", "samples"], "default": "avg"},
        "min_days_worked": {"type": "number", "min": 0, "default": 0},
        "selected_keys": {"type": "multiselect", "default": []},
        "selected_labels": {"type": "multiselect", "default": []},
        "name": {"type": "text", "default": ""},
        "names": {"type": "multiselect", "default": []},
    }
}


# Alias requerido por el cargador dinámico de reglas
# Debe coincidir con f"{TEMPLATE_KEY.upper()}_RULE_TEMPLATE"
TIMES_METRICS_EMPLOYEE_RULE_TEMPLATE = TIMES_METRICS_EMPLOYEE_TEMPLATE


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
    )
    tpl = dict(TIMES_METRICS_EMPLOYEE_TEMPLATE)
    tpl["catalogs"] = catalogs
    return tpl


# ===========================
# Evaluación unificada (empleado)
# ===========================

def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    params = rule.get("params", {}) or {}
    level = params.get("level", "overall")
    ranking_scope = params.get("ranking_scope", "empresa")
    period_mode = params.get("period_mode", "month")
    position_metric = params.get("position_metric", "avg")
    position_type = params.get("position_type", "top_n")
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    base_match: Dict[str, Any] = {"es_competidor": True}
    if period_mode == "month":
        base_match["periodo"] = periodo_dash
    else:
        year = (periodo_dash or "")[:4]
        base_match["periodo"] = {"$regex": f"^{year}-"}

    pipeline: List[Dict[str, Any]] = [{"$match": base_match}]

    # Overall employee metric
    if level == "overall":
        pipeline += [
            {"$addFields": {
                "metric_avg": {"$ifNull": ["$tiempos.avg_seg", None]},
                "metric_samples": {"$ifNull": ["$samples_total", {"$ifNull": ["$tiempos.samples_share", 0]}]},
                "dias": {"$ifNull": ["$tiempos.dias_con_registro", 0]},
                "rut": "$rut",
                "local": "$local",
            }},
            {"$addFields": {
                "metric_value": {"$cond": [
                    {"$eq": [position_metric, "samples"]}, "$metric_samples", "$metric_avg"
                ]}
            }},
            {"$match": {"metric_value": {"$ne": None}}},
        ]
        if min_days_worked > 0:
            pipeline.append({"$match": {"dias": {"$gte": int(min_days_worked)}}})
        # tiebreaker
        pipeline += [
            {"$addFields": {"_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}}},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
        ]
        if ranking_scope == "empresa":
            pipeline += [
                {"$setWindowFields": {"sortBy": {"metric_value_tb": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}}, "output": {"rownum": {"$documentNumber": {}}}}},
            ]
        else:
            pipeline += [
                {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value_tb": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}}, "output": {"rownum": {"$documentNumber": {}}}}},
            ]
        pipeline += [
            {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        return [d["rut"] for d in db.kpis_tiempos_empleado_mensual.aggregate(pipeline)]

    # Category-specific: center/family/subfamily
    # Build category unwind and fields
    if level == "center":
        pipeline += [
            {"$unwind": "$by_centro"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_centro.centro_slug", ""]}}},
                "metric_avg": {"$ifNull": ["$by_centro.avg_seg", None]},
                "metric_samples": {"$ifNull": ["$by_centro.samples_total", 0]},
                "dias": {"$ifNull": ["$by_centro.dias_con_registro", 0]},
            }},
        ]
    elif level == "family":
        pipeline += [
            {"$unwind": "$by_familia"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_familia.familia", ""]}}},
                "metric_avg": {"$ifNull": ["$by_familia.avg_seg", None]},
                "metric_samples": {"$ifNull": ["$by_familia.samples_total", 0]},
                "dias": {"$ifNull": ["$by_familia.dias_con_registro", 0]},
            }},
        ]
    elif level == "subfamily":
        pipeline += [
            {"$unwind": "$by_subfamilia"},
            {"$addFields": {
                "key": {"$trim": {"input": {"$ifNull": ["$by_subfamilia.subfamilia", ""]}}},
                "metric_avg": {"$ifNull": ["$by_subfamilia.avg_seg", None]},
                "metric_samples": {"$ifNull": ["$by_subfamilia.samples_total", 0]},
                "dias": {"$ifNull": ["$by_subfamilia.dias_con_registro", 0]},
            }},
        ]
    else:
        logger.warning(f"times_metrics_employee: level inválido '{level}'")
        return []

    # Filter by selected keys if provided
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
        logger.warning("times_metrics_employee: no selected_keys/name -> 0 winners")
        return []

    pipeline += [
        {"$addFields": {
            "metric_value": {"$cond": [
                {"$eq": [position_metric, "samples"]}, "$metric_samples", "$metric_avg"
            ]},
            "rut": "$rut",
            "local": "$local",
        }},
        {"$match": {"key": {"$in": selected_keys}, "metric_value": {"$ne": None, "$gt": 0}}},
    ]

    if min_days_worked > 0:
        pipeline.append({"$match": {"dias": {"$gte": int(min_days_worked)}}})

    # Rankings y selección por scope
    if ranking_scope == "empresa":
        pipeline += [
            {"$setWindowFields": {
                "sortBy": {"metric_value": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}},
                "output": {
                    "puesto_empresa": {"$denseRank": {}},
                    "best_empresa": {"$cond": [
                        {"$eq": [position_metric, "samples"]}, {"$max": "$metric_value"}, {"$min": "$metric_value"}
                    ]},
                    "avg_empresa": {"$avg": "$metric_value"}
                }
            }},
            {"$match": {"puesto_empresa": _pos_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
            {"$group": {"_id": "$rut"}},
            {"$project": {"_id": 0, "rut": "$_id"}},
        ]
    else:
        pipeline += [
            {"$setWindowFields": {
                "partitionBy": "$local",
                "sortBy": {"metric_value": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}},
                "output": {
                    "puesto_local": {"$denseRank": {}},
                    "best_local": {"$cond": [
                        {"$eq": [position_metric, "samples"]}, {"$max": "$metric_value"}, {"$min": "$metric_value"}
                    ]},
                    "avg_local": {"$avg": "$metric_value"}
                }
            }},
            {"$match": {"puesto_local": _pos_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
            {"$group": {"_id": "$rut"}},
            {"$project": {"_id": 0, "rut": "$_id"}},
        ]

    winners = list(db.kpis_tiempos_empleado_mensual.aggregate(pipeline))
    return [w["rut"] for w in winners]


# ===========================
# Progreso (para app Mi Perfil)
# ===========================
def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    params = rule.get("params", {}) or {}
    level = params.get("level", "overall")
    scope = params.get("ranking_scope", "empresa")
    period_mode = params.get("period_mode", "month")
    position_metric = params.get("position_metric", "avg")
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    # -------------- Monthly --------------
    if period_mode == "month":
        # Overall: leer doc directo
        if level == "overall":
            doc = db.kpis_tiempos_empleado_mensual.find_one({"rut": rut, "periodo": periodo_dash, "es_competidor": True})
            if not doc:
                return {"progress": [], "summary": "Sin datos del período"}
            t = doc.get("tiempos", {}) or {}
            if position_metric == "samples":
                current_value = doc.get("samples_total", t.get("samples_share"))
                return {"progress": [{
                    "type": "ranking",
                    "metric": "samples",
                    "scope": scope,
                    "current_value": current_value,
                    "current_position": t.get(f"puesto_{scope}_samples"),
                    "best_value": None,
                    "avg_value": None,
                }]}
            else:
                return {"progress": [{
                    "type": "ranking",
                    "metric": "avg_seg",
                    "scope": scope,
                    "current_value": t.get("avg_seg"),
                    "current_position": t.get(f"puesto_{scope}"),
                    "best_value": t.get(f"best_{scope}"),
                    "avg_value": t.get(f"avg_{scope}"),
                }]}

        # Category levels: agregar por keys seleccionadas y rankear
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

        base_match: Dict[str, Any] = {"periodo": periodo_dash, "es_competidor": True}
        pipe: List[Dict[str, Any]] = [{"$match": base_match}]

        if level == "center":
            pipe += [
                {"$unwind": "$by_centro"},
                {"$addFields": {
                    "key": {"$trim": {"input": {"$ifNull": ["$by_centro.centro_slug", ""]}}},
                    "avg_seg": {"$ifNull": ["$by_centro.avg_seg", None]},
                    "samples_total": {"$ifNull": ["$by_centro.samples_total", 0]},
                    "dias": {"$ifNull": ["$by_centro.dias_con_registro", 0]},
                }},
                {"$match": {"key": {"$in": selected_keys}, "$or": [
                    {"avg_seg": {"$ne": None, "$gt": 0}}, {"samples_total": {"$gt": 0}}
                ]}},
            ]
        elif level == "family":
            pipe += [
                {"$unwind": "$by_familia"},
                {"$addFields": {
                    "key": {"$trim": {"input": {"$ifNull": ["$by_familia.familia", ""]}}},
                    "avg_seg": {"$ifNull": ["$by_familia.avg_seg", None]},
                    "samples_total": {"$ifNull": ["$by_familia.samples_total", 0]},
                    "dias": {"$ifNull": ["$by_familia.dias_con_registro", 0]},
                }},
                {"$match": {"key": {"$in": selected_keys}, "$or": [
                    {"avg_seg": {"$ne": None, "$gt": 0}}, {"samples_total": {"$gt": 0}}
                ]}},
            ]
        elif level == "subfamily":
            pipe += [
                {"$unwind": "$by_subfamilia"},
                {"$addFields": {
                    "key": {"$trim": {"input": {"$ifNull": ["$by_subfamilia.subfamilia", ""]}}},
                    "avg_seg": {"$ifNull": ["$by_subfamilia.avg_seg", None]},
                    "samples_total": {"$ifNull": ["$by_subfamilia.samples_total", 0]},
                    "dias": {"$ifNull": ["$by_subfamilia.dias_con_registro", 0]},
                }},
                {"$match": {"key": {"$in": selected_keys}, "$or": [
                    {"avg_seg": {"$ne": None, "$gt": 0}}, {"samples_total": {"$gt": 0}}
                ]}},
            ]
        else:
            return {"progress": [], "summary": f"level inválido: {level}"}

        if scope == "empresa":
            if position_metric == "samples":
                pipe += [
                    {"$group": {"_id": {"rut": "$rut"}, "samples_total": {"$sum": "$samples_total"}}},
                    {"$addFields": {"rut": "$_id.rut", "metric_value": "$samples_total"}},
                    {"$match": {"metric_value": {"$gt": 0}}},
                ]
            else:
                pipe += [
                    {"$group": {"_id": {"rut": "$rut"}, "sum_dias": {"$sum": "$dias"}, "sum_w": {"$sum": {"$multiply": ["$avg_seg", "$dias"]}}}},
                    {"$addFields": {"rut": "$_id.rut", "metric_value": {"$cond": [{"$gt": ["$sum_dias", 0]}, {"$divide": ["$sum_w", "$sum_dias"]}, None]}}},
                    {"$match": {"metric_value": {"$ne": None}}},
                ]
            if min_days_worked > 0:
                pipe.append({"$match": {"sum_dias": {"$gte": int(min_days_worked)}}})
            pipe += [
                {"$setWindowFields": {"sortBy": {"metric_value": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}}, "output": {"puesto_empresa": {"$denseRank": {}}, "best_empresa": {"$cond": [{"$eq": [position_metric, "samples"]}, {"$max": "$metric_value"}, {"$min": "$metric_value"}]}, "avg_empresa": {"$avg": "$metric_value"}}}},
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
            if position_metric == "samples":
                pipe += [
                    {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "samples_total": {"$sum": "$samples_total"}}},
                    {"$addFields": {"rut": "$_id.rut", "local": "$_id.local", "metric_value": "$samples_total"}},
                    {"$match": {"metric_value": {"$gt": 0}}},
                ]
            else:
                pipe += [
                    {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "sum_dias": {"$sum": "$dias"}, "sum_w": {"$sum": {"$multiply": ["$avg_seg", "$dias"]}}}},
                    {"$addFields": {"rut": "$_id.rut", "local": "$_id.local", "metric_value": {"$cond": [{"$gt": ["$sum_dias", 0]}, {"$divide": ["$sum_w", "$sum_dias"]}, None]}}},
                    {"$match": {"metric_value": {"$ne": None}}},
                ]
            if min_days_worked > 0:
                pipe.append({"$match": {"sum_dias": {"$gte": int(min_days_worked)}}})
            pipe += [
                {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}}, "output": {"puesto_local": {"$denseRank": {}}, "best_local": {"$cond": [{"$eq": [position_metric, "samples"]}, {"$max": "$metric_value"}, {"$min": "$metric_value"}]}, "avg_local": {"$avg": "$metric_value"}}}},
                {"$setWindowFields": {"partitionBy": "$rut", "sortBy": {"$literal": 1}, "output": {"best_local_rank": {"$denseRank": {}}}}},
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

    # -------------- Annual --------------
    year = (periodo_dash or "")[:4]
    match = {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}

    if level == "overall":
        if scope == "empresa":
            if position_metric == "samples":
                rows = list(db.kpis_tiempos_empleado_mensual.aggregate([
                    {"$match": match},
                    {"$group": {"_id": {"rut": "$rut"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", {"$ifNull": ["$tiempos.samples_share", 0]}]}}}},
                    {"$addFields": {"rut": "$_id.rut", "metric_value": "$samples_total"}},
                    {"$match": {"metric_value": {"$ne": None}}},
                    {"$setWindowFields": {"sortBy": {"metric_value": -1}, "output": {"puesto_empresa": {"$denseRank": {}}, "best_empresa": {"$max": "$metric_value"}, "avg_empresa": {"$avg": "$metric_value"}}}},
                    {"$match": {"rut": rut}},
                    {"$project": {"_id": 0}},
                ]))
            else:
                rows = list(db.kpis_tiempos_empleado_mensual.aggregate([
                    {"$match": match},
                    {"$group": {"_id": {"rut": "$rut"}, "sum_share": {"$sum": {"$ifNull": ["$tiempos.samples_share", 0]}}, "sum_w": {"$sum": {"$multiply": [{"$ifNull": ["$tiempos.avg_seg", 0]}, {"$ifNull": ["$tiempos.samples_share", 0]}]}}, "dias": {"$sum": {"$ifNull": ["$tiempos.dias_con_registro", 0]}}}},
                    {"$addFields": {"rut": "$_id.rut", "metric_value": {"$cond": [{"$gt": ["$sum_share", 0]}, {"$divide": ["$sum_w", "$sum_share"]}, None]}}},
                    {"$match": {"metric_value": {"$ne": None}}},
                    {"$setWindowFields": {"sortBy": {"metric_value": 1}, "output": {"puesto_empresa": {"$denseRank": {}}, "best_empresa": {"$min": "$metric_value"}, "avg_empresa": {"$avg": "$metric_value"}}}},
                    {"$match": {"rut": rut}},
                    {"$project": {"_id": 0}},
                ]))
            if not rows:
                return {"progress": [], "summary": "Sin datos del período (anual)"}
            r = rows[0]
            return {"progress": [{
                "type": "ranking", "metric": "samples" if position_metric == "samples" else "avg_seg", "scope": "empresa",
                "current_value": r.get("metric_value"),
                "current_position": r.get("puesto_empresa"),
                "best_value": r.get("best_empresa"),
                "avg_value": r.get("avg_empresa"),
            }]}
        else:
            if position_metric == "samples":
                rows = list(db.kpis_tiempos_empleado_mensual.aggregate([
                    {"$match": match},
                    {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", {"$ifNull": ["$tiempos.samples_share", 0]}]}}}},
                    {"$addFields": {"rut": "$_id.rut", "local": "$_id.local", "metric_value": "$samples_total"}},
                    {"$match": {"metric_value": {"$ne": None}}},
                    {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value": -1}, "output": {"puesto_local": {"$denseRank": {}}, "best_local": {"$max": "$metric_value"}, "avg_local": {"$avg": "$metric_value"}}}},
                    {"$setWindowFields": {"partitionBy": "$rut", "sortBy": {"$literal": 1}, "output": {"best_local_rank": {"$denseRank": {}}}}},
                    {"$match": {"rut": rut, "best_local_rank": 1}},
                    {"$project": {"_id": 0}},
                ]))
            else:
                rows = list(db.kpis_tiempos_empleado_mensual.aggregate([
                    {"$match": match},
                    {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "sum_share": {"$sum": {"$ifNull": ["$tiempos.samples_share", 0]}}, "sum_w": {"$sum": {"$multiply": [{"$ifNull": ["$tiempos.avg_seg", 0]}, {"$ifNull": ["$tiempos.samples_share", 0]}]}}}},
                    {"$addFields": {"rut": "$_id.rut", "local": "$_id.local", "metric_value": {"$cond": [{"$gt": ["$sum_share", 0]}, {"$divide": ["$sum_w", "$sum_share"]}, None]}}},
                    {"$match": {"metric_value": {"$ne": None}}},
                    {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value": 1}, "output": {"puesto_local": {"$denseRank": {}}, "best_local": {"$min": "$metric_value"}, "avg_local": {"$avg": "$metric_value"}}}},
                    {"$setWindowFields": {"partitionBy": "$rut", "sortBy": {"$literal": 1}, "output": {"best_local_rank": {"$denseRank": {}}}}},
                    {"$match": {"rut": rut, "best_local_rank": 1}},
                    {"$project": {"_id": 0}},
                ]))
            if not rows:
                return {"progress": [], "summary": "Sin datos del período (anual)"}
            r = rows[0]
            return {"progress": [{
                "type": "ranking", "metric": "samples" if position_metric == "samples" else "avg_seg", "scope": "local",
                "current_value": r.get("metric_value"),
                "current_position": r.get("puesto_local"),
                "best_value": r.get("best_local"),
                "avg_value": r.get("avg_local"),
                "local": r.get("local"),
            }]}

    # Category levels (annual)
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

    year = (periodo_dash or "")[:4]
    match = {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}
    pipe: List[Dict[str, Any]] = [{"$match": match}]

    if level == "center":
        pipe += [
            {"$unwind": "$by_centro"},
            {"$addFields": {"key": {"$trim": {"input": {"$ifNull": ["$by_centro.centro_slug", ""]}}}, "avg_seg": {"$ifNull": ["$by_centro.avg_seg", None]}, "samples_total": {"$ifNull": ["$by_centro.samples_total", 0]}, "dias": {"$ifNull": ["$by_centro.dias_con_registro", 0]}}},
            {"$match": {"key": {"$in": selected_keys}, "$or": [{"avg_seg": {"$ne": None, "$gt": 0}}, {"samples_total": {"$gt": 0}}]}},
        ]
    elif level == "family":
        pipe += [
            {"$unwind": "$by_familia"},
            {"$addFields": {"key": {"$trim": {"input": {"$ifNull": ["$by_familia.familia", ""]}}}, "avg_seg": {"$ifNull": ["$by_familia.avg_seg", None]}, "samples_total": {"$ifNull": ["$by_familia.samples_total", 0]}, "dias": {"$ifNull": ["$by_familia.dias_con_registro", 0]}}},
            {"$match": {"key": {"$in": selected_keys}, "$or": [{"avg_seg": {"$ne": None, "$gt": 0}}, {"samples_total": {"$gt": 0}}]}},
        ]
    elif level == "subfamily":
        pipe += [
            {"$unwind": "$by_subfamilia"},
            {"$addFields": {"key": {"$trim": {"input": {"$ifNull": ["$by_subfamilia.subfamilia", ""]}}}, "avg_seg": {"$ifNull": ["$by_subfamilia.avg_seg", None]}, "samples_total": {"$ifNull": ["$by_subfamilia.samples_total", 0]}, "dias": {"$ifNull": ["$by_subfamilia.dias_con_registro", 0]}}},
            {"$match": {"key": {"$in": selected_keys}, "$or": [{"avg_seg": {"$ne": None, "$gt": 0}}, {"samples_total": {"$gt": 0}}]}},
        ]
    else:
        return {"progress": [], "summary": f"level inválido: {level}"}

    if scope == "empresa":
        if position_metric == "samples":
            pipe += [
                {"$group": {"_id": {"rut": "$rut"}, "samples_total": {"$sum": "$samples_total"}}},
                {"$addFields": {"rut": "$_id.rut", "metric_value": "$samples_total"}},
                {"$match": {"metric_value": {"$gt": 0}}},
            ]
        else:
            pipe += [
                {"$group": {"_id": {"rut": "$rut"}, "sum_dias": {"$sum": "$dias"}, "sum_w": {"$sum": {"$multiply": ["$avg_seg", "$dias"]}}}},
                {"$addFields": {"rut": "$_id.rut", "metric_value": {"$cond": [{"$gt": ["$sum_dias", 0]}, {"$divide": ["$sum_w", "$sum_dias"]}, None]}}},
                {"$match": {"metric_value": {"$ne": None}}},
            ]
        if min_days_worked > 0:
            pipe.append({"$match": {"sum_dias": {"$gte": int(min_days_worked)}}})
        pipe += [
            {"$setWindowFields": {"sortBy": {"metric_value": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}}, "output": {"puesto_empresa": {"$denseRank": {}}, "best_empresa": {"$cond": [{"$eq": [position_metric, "samples"]}, {"$max": "$metric_value"}, {"$min": "$metric_value"}]}, "avg_empresa": {"$avg": "$metric_value"}}}},
            {"$match": {"rut": rut}},
            {"$project": {"_id": 0}},
        ]
        rows = list(db.kpis_tiempos_empleado_mensual.aggregate(pipe))
        if not rows:
            return {"progress": [], "summary": "Sin datos del período (anual)"}
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
        if position_metric == "samples":
            pipe += [
                {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "samples_total": {"$sum": "$samples_total"}}},
                {"$addFields": {"rut": "$_id.rut", "local": "$_id.local", "metric_value": "$samples_total"}},
                {"$match": {"metric_value": {"$gt": 0}}},
            ]
        else:
            pipe += [
                {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "sum_dias": {"$sum": "$dias"}, "sum_w": {"$sum": {"$multiply": ["$avg_seg", "$dias"]}}}},
                {"$addFields": {"rut": "$_id.rut", "local": "$_id.local", "metric_value": {"$cond": [{"$gt": ["$sum_dias", 0]}, {"$divide": ["$sum_w", "$sum_dias"]}, None]}}},
                {"$match": {"metric_value": {"$ne": None}}},
            ]
        if min_days_worked > 0:
            pipe.append({"$match": {"sum_dias": {"$gte": int(min_days_worked)}}})
        pipe += [
            {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value": {"$cond": [{"$eq": [position_metric, "samples"]}, -1, 1]}}, "output": {"puesto_local": {"$denseRank": {}}, "best_local": {"$cond": [{"$eq": [position_metric, "samples"]}, {"$max": "$metric_value"}, {"$min": "$metric_value"}]}, "avg_local": {"$avg": "$metric_value"}}}},
            {"$setWindowFields": {"partitionBy": "$rut", "sortBy": {"$literal": 1}, "output": {"best_local_rank": {"$denseRank": {}}}}},
            {"$match": {"rut": rut, "best_local_rank": 1}},
            {"$project": {"_id": 0}},
        ]
        rows = list(db.kpis_tiempos_empleado_mensual.aggregate(pipe))
        if not rows:
            return {"progress": [], "summary": "Sin datos del período (anual)"}
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
