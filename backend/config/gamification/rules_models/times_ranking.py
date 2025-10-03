from __future__ import annotations
from typing import Dict, Any, List, Optional
from pymongo.database import Database
import logging

logger = logging.getLogger(__name__)

# --- Constantes ---
TEMPLATE_KEY = "times_ranking_position"

TIMES_RANKING_POSITION_RULE_TEMPLATE = {
    "key": TEMPLATE_KEY,
    "name": "Ranking de Tiempos (Top N / Exacto / Rango)",
    "description": "Otorga mérito según posición en ranking de tiempos (menor avg_seg mejor) a nivel de local o empresa.",
    "category": "times",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_tiempos_empleado_mensual",
            "fields": [
                "rut", "periodo", "local", "es_competidor",
                "tiempos.avg_seg", "tiempos.dias_con_registro", "tiempos.samples_share",
                "tiempos.puesto_local", "tiempos.puesto_empresa",
            ],
            "filter": "Usa avg_seg general por empleado; menor es mejor.",
        }
    ],
    "required_params": {
        "period_mode": {
            "type": "select", "options": ["month", "year"], "default": "month",
            "description": "Mensual o anual."
        },
        "ranking_scope": {
            "type": "select", "options": ["local", "empresa"], "default": "empresa",
            "description": "Ámbito del ranking."
        },
        "position_type": {
            "type": "select", "options": ["top_n", "exact", "range"], "default": "top_n",
            "description": "Modo de posición: Top N, Exacto o Rango."
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
            "description": "Mínimo de días con registro requeridos (usa tiempos.dias_con_registro; anual suma)."
        }
    },
    "example_payload": {
        "rule_name": "ranking_tiempos_top3_empresa",
        "segment_token_id": 1,
        "template_key": TEMPLATE_KEY,
        "params": {
            "period_mode": "month",
            "ranking_scope": "empresa",
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


def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    """
    Evalúa el ranking general de tiempos usando tiempos.avg_seg (menor es mejor).
    - Month: usa doc mensual directamente.
    - Year: agrega por RUT (empresa) o por RUT+LOCAL y toma el mejor local del RUT (local),
      con promedio ponderado por samples_share: sum(avg*share)/sum(share).
    """
    params = rule.get("params", {}) or {}
    period_mode = params.get("period_mode", "month")
    ranking_scope = params.get("ranking_scope", "empresa")
    position_type = params.get("position_type", "top_n")
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    # =========================
    # MODO MENSUAL
    # =========================
    if period_mode == "month":
        base_match: Dict[str, Any] = {"es_competidor": True, "periodo": periodo_dash}
        pipeline: List[Dict[str, Any]] = [
            {"$match": base_match},
            {"$addFields": {
                "metric_value": {"$ifNull": ["$tiempos.avg_seg", None]},
                "dias": {"$ifNull": ["$tiempos.dias_con_registro", 0]},
                "rut": "$rut",
                "local": "$local",
            }},
            {"$match": {"metric_value": {"$ne": None}}},
        ]
        if min_days_worked > 0:
            pipeline.append({"$match": {"dias": {"$gte": int(min_days_worked)}}})
        # Tiebreaker determinístico ascendente por RUT numérico
        pipeline += [
            {"$addFields": {"_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}}},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
        ]
        if ranking_scope == "empresa":
            pipeline += [
                {"$setWindowFields": {"sortBy": {"metric_value_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
            ]
        else:
            pipeline += [
                {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
            ]
        pipeline += [
            {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        return [d["rut"] for d in db.kpis_tiempos_empleado_mensual.aggregate(pipeline)]

    # =========================
    # MODO ANUAL
    # =========================
    year = (periodo_dash or "")[:4]
    year_match: Dict[str, Any] = {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}

    if ranking_scope == "empresa":
        agg_pipeline: List[Dict[str, Any]] = [
            {"$match": year_match},
            {"$group": {
                "_id": {"rut": "$rut"},
                "sum_share": {"$sum": {"$ifNull": ["$tiempos.samples_share", 0]}},
                "sum_w": {"$sum": {"$multiply": [
                    {"$ifNull": ["$tiempos.avg_seg", 0]},
                    {"$ifNull": ["$tiempos.samples_share", 0]}
                ]}},
                "dias": {"$sum": {"$ifNull": ["$tiempos.dias_con_registro", 0]}},
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "metric_value": {"$cond": [{"$gt": ["$sum_share", 0]}, {"$divide": ["$sum_w", "$sum_share"]}, None]},
            }},
            {"$match": {"metric_value": {"$ne": None}}},
        ]
        if min_days_worked > 0:
            agg_pipeline.append({"$match": {"dias": {"$gte": int(min_days_worked)}}})
        agg_pipeline += [
            {"$addFields": {"_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}}},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
            {"$setWindowFields": {"sortBy": {"metric_value_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
            {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        return [w["rut"] for w in db.kpis_tiempos_empleado_mensual.aggregate(agg_pipeline)]

    else:
        agg_pipeline: List[Dict[str, Any]] = [
            {"$match": year_match},
            {"$group": {
                "_id": {"rut": "$rut", "local": "$local"},
                "sum_share": {"$sum": {"$ifNull": ["$tiempos.samples_share", 0]}},
                "sum_w": {"$sum": {"$multiply": [
                    {"$ifNull": ["$tiempos.avg_seg", 0]},
                    {"$ifNull": ["$tiempos.samples_share", 0]}
                ]}},
                "dias": {"$sum": {"$ifNull": ["$tiempos.dias_con_registro", 0]}},
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "local": "$_id.local",
                "metric_value": {"$cond": [{"$gt": ["$sum_share", 0]}, {"$divide": ["$sum_w", "$sum_share"]}, None]},
            }},
            {"$match": {"metric_value": {"$ne": None}}},
        ]
        if min_days_worked > 0:
            agg_pipeline.append({"$match": {"dias": {"$gte": int(min_days_worked)}}})
        agg_pipeline += [
            {"$addFields": {"_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}}},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
            {"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
            {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        return [w["rut"] for w in db.kpis_tiempos_empleado_mensual.aggregate(agg_pipeline)]

# --- Progress helper ---
def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    params = rule.get("params", {}) or {}
    period_mode = params.get("period_mode", "month")
    scope = params.get("ranking_scope", "empresa")

    # Mensual: leer doc y devolver puestos/best/avg
    if period_mode == "month":
        doc = db.kpis_tiempos_empleado_mensual.find_one({"rut": rut, "periodo": periodo_dash})
        if not doc:
            return {"progress": [], "summary": "Sin datos del período"}
        t = doc.get("tiempos", {}) or {}
        return {"progress": [{
            "type": "ranking",
            "metric": "avg_seg",
            "scope": scope,
            "current_value": t.get("avg_seg"),
            "current_position": t.get(f"puesto_{scope}"),
            "best_value": t.get(f"best_{scope}"),
            "avg_value": t.get(f"avg_{scope}"),
        }]}

    # Anual: calcular ponderado y rankear
    year = (periodo_dash or "")[:4]
    match = {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}

    if scope == "empresa":
        rows = list(db.kpis_tiempos_empleado_mensual.aggregate([
            {"$match": match},
            {"$group": {
                "_id": {"rut": "$rut"},
                "sum_share": {"$sum": {"$ifNull": ["$tiempos.samples_share", 0]}},
                "sum_w": {"$sum": {"$multiply": [
                    {"$ifNull": ["$tiempos.avg_seg", 0]},
                    {"$ifNull": ["$tiempos.samples_share", 0]}
                ]}},
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "metric_value": {"$cond": [{"$gt": ["$sum_share", 0]}, {"$divide": ["$sum_w", "$sum_share"]}, None]},
            }},
            {"$match": {"metric_value": {"$ne": None}}},
            {"$setWindowFields": {
                "sortBy": {"metric_value": 1},
                "output": {"puesto_empresa": {"$denseRank": {}}, "best_empresa": {"$min": "$metric_value"}, "avg_empresa": {"$avg": "$metric_value"}}
            }},
            {"$match": {"rut": rut}},
            {"$project": {"_id": 0}},
        ]))
        if not rows:
            return {"progress": [], "summary": "Sin datos del período (anual)"}
        r = rows[0]
        return {"progress": [{
            "type": "ranking", "metric": "avg_seg", "scope": "empresa",
            "current_value": r.get("metric_value"),
            "current_position": r.get("puesto_empresa"),
            "best_value": r.get("best_empresa"),
            "avg_value": r.get("avg_empresa"),
        }]}
    else:
        rows = list(db.kpis_tiempos_empleado_mensual.aggregate([
            {"$match": match},
            {"$group": {
                "_id": {"rut": "$rut", "local": "$local"},
                "sum_share": {"$sum": {"$ifNull": ["$tiempos.samples_share", 0]}},
                "sum_w": {"$sum": {"$multiply": [
                    {"$ifNull": ["$tiempos.avg_seg", 0]},
                    {"$ifNull": ["$tiempos.samples_share", 0]}
                ]}},
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "local": "$_id.local",
                "metric_value": {"$cond": [{"$gt": ["$sum_share", 0]}, {"$divide": ["$sum_w", "$sum_share"]}, None]},
            }},
            {"$match": {"metric_value": {"$ne": None}}},
            {"$setWindowFields": {
                "partitionBy": "$local",
                "sortBy": {"metric_value": 1},
                "output": {"puesto_local": {"$denseRank": {}}, "best_local": {"$min": "$metric_value"}, "avg_local": {"$avg": "$metric_value"}}
            }},
            {"$setWindowFields": {
                "partitionBy": "$rut",
                "sortBy": {"metric_value": 1},
                "output": {"best_local_rank": {"$denseRank": {}}}
            }},
            {"$match": {"rut": rut, "best_local_rank": 1}},
            {"$project": {"_id": 0}},
        ]))
        if not rows:
            return {"progress": [], "summary": "Sin datos del período (anual)"}
        r = rows[0]
        return {"progress": [{
            "type": "ranking", "metric": "avg_seg", "scope": "local",
            "current_value": r.get("metric_value"),
            "current_position": r.get("puesto_local"),
            "best_value": r.get("best_local"),
            "avg_value": r.get("avg_local"),
            "local": r.get("local"),
        }]}
