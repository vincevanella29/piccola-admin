# config/gamification/rules_models/sales_ranking.py

from __future__ import annotations
from typing import Dict, Any, List
from pymongo.database import Database
import logging

logger = logging.getLogger(__name__)

# --- Constantes y Mapeos ---
TEMPLATE_KEY = "sales_ranking_position"

METRIC_MAP = {
    "sales": "sales",
    "avg_per_table": "promedio_por_mesa",
    "customers_served": "personas_atendidas",
    "avg_per_customer": "promedio_por_persona",
    # Nueva métrica: promedio de venta diaria
    "avg_daily_sales": "promedio_venta_diaria",
}

# ### CORRECCIÓN AQUÍ ### - El nombre de la variable ahora coincide con la convención
SALES_RANKING_POSITION_RULE_TEMPLATE = {
    "key": TEMPLATE_KEY,
    "name": "Ranking de Ventas (Top N)",
    "description": "Otorga mérito a empleados que alcanzan una posición específica (Top N) en un ranking de ventas, ya sea a nivel de local o de empresa.",
    "category": "sales",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_empleado_mensual",
            "fields": [
                "rut", "periodo", "local", "es_competidor",
                "sales", "promedio_por_mesa", "personas_atendidas", "promedio_por_persona", "promedio_venta_diaria"
            ],
            "filter": "Filtra por período y es_competidor=true, buscando la posición en el ranking anidado."
        }
    ],
    "required_params": {
        "metric_key": {
            "type": "select", "options": list(METRIC_MAP.keys()), "default": "sales",
            "description": "Métrica de venta a evaluar (Venta Total, Promedio x Mesa, Personas Atendidas, Promedio x Persona)."
        },
        # Nuevo: permitir modo anual
        "period_mode": {
            "type": "select", "options": ["month", "year"], "default": "month",
            "description": "Alcance temporal de la evaluación: mensual (month) o anual (year)."
        },
        "ranking_scope": {
            "type": "select", "options": ["local", "empresa"], "default": "local",
            "description": "Ámbito del ranking (a nivel de Local o de toda la Empresa)."
        },
        "ranking_position": {
            "type": "number", "min": 1, "max": 100, "default": 1,
            "description": "Posición máxima para calificar (ej: 1 para ser el N°1, 10 para estar en el Top 10)."
        }
    },
    # NUEVO: condiciones compuestas (AND). Si se define 'conditions', se ignoran los campos simples de arriba.
    "optional_params": {
        "conditions": {
            "type": "array",
            "description": "Lista de condiciones a cumplir (AND). Cada condición puede ser de tipo 'ranking' o 'value'.",
            "example": [
                {"type": "ranking", "metric_key": "sales", "scope": "local", "max_position": 10},
                {"type": "value", "metric_key": "avg_daily_sales", "operator": "gte", "threshold": 500000}
            ]
        }
    },
    "metrics": {
        "check": "db.kpis_empleado_mensual.find({periodo, es_competidor: true, '[metric_path].puesto_[scope]': {$lte: position}})",
        "notes": "Busca en los KPIs mensuales pre-calculados a los empleados que cumplen con el ranking."
    },
    "example_payload": {
        "rule_name": "top_1_ventas_local", "segment_token_id": 1, "template_key": TEMPLATE_KEY,
        "params": {"metric_key": "sales", "ranking_scope": "local", "ranking_position": 1},
        "merit_points": 10, "is_active": True
    }
}

# --- Función de Evaluación ---
def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    """
    Evalúa la regla. Si 'conditions' está presente en params, aplica un AND sobre todas las condiciones.
    Cada condición soporta:
      - tipo 'ranking': requiere metric_key, scope ('local'|'empresa'), max_position (int)
      - tipo 'value': requiere metric_key, operator ('gte'|'gt'|'lte'|'lt'|'eq'), threshold (num). Compara contra '[metric].valor'.
    Si no hay 'conditions', cae a compatibilidad hacia atrás con los 3 params simples.
    """
    params = rule.get("params", {})
    conditions: List[Dict[str, Any]] = params.get("conditions", []) or []
    period_mode = params.get("period_mode", "month")
    min_days_worked = params.get("min_days_worked", 0) or 0

    base_match: Dict[str, Any] = {"es_competidor": True}
    if period_mode == "month":
        base_match.update({"periodo": periodo_dash})
    else:
        # year mode: periodo prefix 'YYYY-'
        year = (periodo_dash or "")[:4]
        base_match.update({"periodo": {"$regex": f"^{year}-"}})

    def build_condition_filter(cond: Dict[str, Any]) -> Dict[str, Any] | None:
        ctype = cond.get("type")
        metric_key = cond.get("metric_key")
        if metric_key not in METRIC_MAP:
            logger.warning(f"Condición ignorada por métrica no válida: {metric_key}")
            return None
        path = METRIC_MAP[metric_key]
        if ctype == "ranking":
            scope = cond.get("scope", "local")
            max_pos = cond.get("max_position", 1)
            if scope not in ["local", "empresa"]:
                logger.warning(f"Scope inválido en condición ranking: {scope}")
                return None
            return {f"{path}.puesto_{scope}": {"$gt": 0, "$lte": max_pos}}
        elif ctype == "value":
            op = cond.get("operator", "gte")
            threshold = cond.get("threshold")
            op_map = {"gte": "$gte", "gt": "$gt", "lte": "$lte", "lt": "$lt", "eq": "$eq"}
            if op not in op_map or threshold is None:
                logger.warning(f"Operador/threshold inválido en condición value: op={op}, thr={threshold}")
                return None
            return {f"{path}.valor": {op_map[op]: threshold}}
        else:
            logger.warning(f"Tipo de condición desconocido: {ctype}")
            return None

    if conditions:
        and_filters = []
        for c in conditions:
            f = build_condition_filter(c)
            if f:
                and_filters.append(f)
        if not and_filters:
            return []
        match_stage = {**base_match, "$and": and_filters}
    else:
        # Compatibilidad hacia atrás
        metric_key = params.get("metric_key", "sales")
        ranking_scope = params.get("ranking_scope", "local")
        ranking_position = params.get("ranking_position", 1)
        if metric_key not in METRIC_MAP or ranking_scope not in ["local", "empresa"]:
            logger.warning(f"Parámetros inválidos para regla de ranking: metric='{metric_key}', scope='{ranking_scope}'")
            return []
        mongo_field_path = METRIC_MAP[metric_key]
        query_field = f"{mongo_field_path}.puesto_{ranking_scope}"
        match_stage = {**base_match, query_field: {"$lte": ranking_position, "$gt": 0}}

    # Filtro mínimo de días trabajados (días con venta)
    if min_days_worked and min_days_worked > 0:
        # Para month: usa el campo existente
        # Para year: usaremos el mismo nombre en el pipeline anual
        extra = {"promedio_venta_diaria.dias_con_venta": {"$gte": int(min_days_worked)}}
        if "$and" in match_stage:
            match_stage["$and"].append(extra)
        else:
            match_stage = {**match_stage, **extra}

    if period_mode == "month":
        pipeline = [
            {"$match": match_stage},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        winner_docs = list(db.kpis_empleado_mensual.aggregate(pipeline))
        return [doc["rut"] for doc in winner_docs]

    # period_mode == 'year' -> agregación anual por rut+local
    year = (periodo_dash or "")[:4]
    metric_key = params.get("metric_key", "sales")
    ranking_scope = params.get("ranking_scope", "local")
    ranking_position = params.get("ranking_position", 1)

    # Construimos un pipeline que normaliza todas las métricas con el mismo shape mensual
    agg_pipeline: List[Dict[str, Any]] = [
        {"$match": {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}},
        {"$group": {
            "_id": {"rut": "$rut", "local": "$local"},
            "sales_total": {"$sum": "$sales.total"},
            "mesas": {"$sum": "$total_mesas.valor"},
            "personas": {"$sum": "$personas_atendidas.valor"},
            "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
            "pvd_avg": {"$avg": "$promedio_venta_diaria.valor"}
        }},
        {"$addFields": {
            "rut": "$_id.rut",
            "local": "$_id.local",
            "sales": {"total": "$sales_total"},
            "total_mesas": {"valor": "$mesas"},
            "personas_atendidas": {"valor": "$personas"},
            "promedio_por_mesa": {"valor": {"$cond": [{"$gt": ["$mesas", 0]}, {"$divide": ["$sales_total", "$mesas"]}, 0]}},
            "promedio_por_persona": {"valor": {"$cond": [{"$gt": ["$personas", 0]}, {"$divide": ["$sales_total", "$personas"]}, 0]}},
            "promedio_venta_diaria": {"valor": "$pvd_avg", "dias_con_venta": "$dias"}
        }},
    ]

    # Calcular ranking según metric_key (agregamos 'metric_value' para sortBy/Max)
    path = METRIC_MAP.get(metric_key, "sales")
    metric_expr = ({"$getField": {"field": "valor", "input": f"${path}"}} if path != "sales" else "$sales.total")
    agg_pipeline += [
        {"$addFields": {"metric_value": metric_expr}},
        {"$setWindowFields": {
            "sortBy": {"metric_value": -1},
            "output": {"puesto_empresa": {"$denseRank": {}}, "top_empresa": {"$max": "$metric_value"}}
        }},
        {"$setWindowFields": {
            "partitionBy": "$local",
            "sortBy": {"metric_value": -1},
            "output": {"puesto_local": {"$denseRank": {}}, "top_local": {"$max": "$metric_value"}}
        }},
        {"$unset": "metric_value"}
    ]

    # Filtros finales (conditions/simple) + min_days_worked
    post_filters: Dict[str, Any] = {}
    if conditions:
        and_arr = []
        for c in conditions:
            f = build_condition_filter(c)
            if f:
                and_arr.append(f)
        if min_days_worked and min_days_worked > 0:
            and_arr.append({"promedio_venta_diaria.dias_con_venta": {"$gte": int(min_days_worked)}})
        if and_arr:
            post_filters = {"$and": and_arr}
    else:
        # simple mode
        if metric_key in METRIC_MAP and ranking_scope in ["local", "empresa"]:
            post_filters[f"puesto_{ranking_scope}"] = {"$lte": int(ranking_position), "$gt": 0}
        if min_days_worked and min_days_worked > 0:
            post_filters["promedio_venta_diaria.dias_con_venta"] = {"$gte": int(min_days_worked)}

    if post_filters:
        agg_pipeline.append({"$match": post_filters})

    agg_pipeline.append({"$project": {"rut": 1}})
    winners = list(db.kpis_empleado_mensual.aggregate(agg_pipeline))
    return [w["rut"] for w in winners]

# ### NUEVA FUNCIÓN DE PROGRESO ###
def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    """
    Busca los KPIs del empleado y devuelve su puesto actual y el valor del top 1
    para generar la sensación de competencia.
    """
    params = rule.get("params", {})
    period_mode = params.get("period_mode", "month")

    if period_mode == "month":
        kpi_doc = db.kpis_empleado_mensual.find_one({"rut": rut, "periodo": periodo_dash})
        if not kpi_doc:
            return {"progress": [], "summary": "Sin datos del período"}
    else:
        # Agregar doc anual sintetizado con ranking para empresa y local
        year = (periodo_dash or "")[:4]
        # Determinar métrica principal para ordenar (para ranking); si hay conditions mezcladas, usamos 'sales' por defecto
        metric_key = params.get("metric_key", "sales")
        path = METRIC_MAP.get(metric_key, "sales")
        metric_value_field_company = f"${path}.valor" if path != "sales" else "$sales.total"

        # 1) Agregado anual por RUT (empresa)
        company_rows = list(db.kpis_empleado_mensual.aggregate([
            {"$match": {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}},
            {"$group": {
                "_id": {"rut": "$rut"},
                "sales_total": {"$sum": "$sales.total"},
                "mesas": {"$sum": "$total_mesas.valor"},
                "personas": {"$sum": "$personas_atendidas.valor"},
                "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
                "pvd_avg": {"$avg": "$promedio_venta_diaria.valor"}
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "sales": {"total": "$sales_total"},
                "total_mesas": {"valor": "$mesas"},
                "personas_atendidas": {"valor": "$personas"},
                "promedio_por_mesa": {"valor": {"$cond": [{"$gt": ["$mesas", 0]}, {"$divide": ["$sales_total", "$mesas"]}, 0]}},
                "promedio_por_persona": {"valor": {"$cond": [{"$gt": ["$personas", 0]}, {"$divide": ["$sales_total", "$personas"]}, 0]}},
                "promedio_venta_diaria": {"valor": "$pvd_avg", "dias_con_venta": "$dias"}
            }},
            {"$addFields": {"metric_value": metric_value_field_company}},
            {"$setWindowFields": {"sortBy": {"metric_value": -1}, "output": {"puesto_empresa": {"$denseRank": {}}, "top_empresa": {"$max": "$metric_value"}}}},
            {"$match": {"rut": rut}},
            {"$project": {"_id": 0, "metric_value": 0}}
        ]))

        # 2) Agregado anual por RUT+LOCAL (elegimos el mejor local del rut) y ranking local
        metric_value_field_any = metric_value_field_company
        local_rows = list(db.kpis_empleado_mensual.aggregate([
            {"$match": {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}},
            {"$group": {
                "_id": {"rut": "$rut", "local": "$local"},
                "sales_total": {"$sum": "$sales.total"},
                "mesas": {"$sum": "$total_mesas.valor"},
                "personas": {"$sum": "$personas_atendidas.valor"},
                "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
                "pvd_avg": {"$avg": "$promedio_venta_diaria.valor"}
            }},
            {"$addFields": {
                "rut": "$_id.rut",
                "local": "$_id.local",
                "sales": {"total": "$sales_total"},
                "total_mesas": {"valor": "$mesas"},
                "personas_atendidas": {"valor": "$personas"},
                "promedio_por_mesa": {"valor": {"$cond": [{"$gt": ["$mesas", 0]}, {"$divide": ["$sales_total", "$mesas"]}, 0]}},
                "promedio_por_persona": {"valor": {"$cond": [{"$gt": ["$personas", 0]}, {"$divide": ["$sales_total", "$personas"]}, 0]}},
                "promedio_venta_diaria": {"valor": "$pvd_avg", "dias_con_venta": "$dias"}
            }},
            {"$addFields": {"metric_value": metric_value_field_any}},
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
            {"$project": {"_id": 0, "metric_value": 0}}
        ]))

        if not company_rows and not local_rows:
            return {"progress": [], "summary": "Sin datos del período (anual)"}

        # Fusionar: priorizamos campos de company y añadimos ranking local si existe
        kpi_doc = (company_rows[0].copy() if company_rows else {})
        if local_rows:
            kpi_doc.update({
                "local": local_rows[0].get("local"),
                "puesto_local": local_rows[0].get("puesto_local"),
                "top_local": local_rows[0].get("top_local"),
            })

    conditions: List[Dict[str, Any]] = params.get("conditions", []) or []
    progress_list: List[Dict[str, Any]] = []

    # Helper: días con venta (sirve para mostrar avance de la restricción min_days_worked)
    def get_days_worked() -> int | None:
        try:
            pvd = (kpi_doc or {}).get("promedio_venta_diaria", {})
            if isinstance(pvd, dict):
                dv = pvd.get("dias_con_venta")
                return int(dv) if dv is not None else None
        except Exception:
            return None
        return None

    def metric_info(mkey: str, scope: str | None) -> Dict[str, Any]:
        path = METRIC_MAP.get(mkey)
        data = kpi_doc.get(path, {}) if path else {}
        out = {
            "metric_key": mkey,
            "valor": data.get("valor"),
            # fallback a raíz si el agregado anual no embebió los puestos/top dentro de cada métrica
            "puesto_local": data.get("puesto_local") if isinstance(data, dict) else None,
            "puesto_empresa": data.get("puesto_empresa") if isinstance(data, dict) else None,
            "top_local": data.get("top_local") if isinstance(data, dict) else None,
            "top_empresa": data.get("top_empresa") if isinstance(data, dict) else None,
        }
        # Para 'sales', usar total como valor si no existe 'valor'
        if path == "sales" and (out["valor"] is None):
            sales_data = kpi_doc.get("sales", {})
            out["valor"] = sales_data.get("total")
        # Fallback root-level
        if out["puesto_local"] is None:
            out["puesto_local"] = kpi_doc.get("puesto_local")
        if out["puesto_empresa"] is None:
            out["puesto_empresa"] = kpi_doc.get("puesto_empresa")
        if out["top_local"] is None:
            out["top_local"] = kpi_doc.get("top_local")
        if out["top_empresa"] is None:
            out["top_empresa"] = kpi_doc.get("top_empresa")

        if path == "promedio_venta_diaria":
            out["dias_con_venta"] = data.get("dias_con_venta")
        if scope:
            out["puesto"] = (data.get(f"puesto_{scope}") if isinstance(data, dict) else None) or kpi_doc.get(f"puesto_{scope}")
            out["top"] = (data.get(f"top_{scope}") if isinstance(data, dict) else None) or kpi_doc.get(f"top_{scope}")
        return out

    if conditions:
        for cond in conditions:
            ctype = cond.get("type")
            mkey = cond.get("metric_key")
            if mkey not in METRIC_MAP:
                continue
            if ctype == "ranking":
                scope = cond.get("scope", "local")
                target_pos = cond.get("max_position", 1)
                info = metric_info(mkey, scope)
                progress_list.append({
                    "type": "ranking",
                    "metric_key": mkey,
                    "scope": scope,
                    "current_position": info.get("puesto"),
                    "target_position": target_pos,
                    "top_value": info.get("top"),
                    "current_value": info.get("valor"),
                    "min_days_worked": int(params.get("min_days_worked", 0) or 0),
                    "current_days_worked": get_days_worked(),
                })
            elif ctype == "value":
                operator = cond.get("operator", "gte")
                threshold = cond.get("threshold")
                info = metric_info(mkey, None)
                progress_list.append({
                    "type": "value",
                    "metric_key": mkey,
                    "operator": operator,
                    "threshold": threshold,
                    "current_value": info.get("valor"),
                    **({"dias_con_venta": info.get("dias_con_venta")} if mkey == "avg_daily_sales" else {})
                })
    else:
        # Compatibilidad hacia atrás con una sola métrica de ranking
        metric_key = params.get("metric_key", "sales")
        scope = params.get("ranking_scope", "local")
        target_position = params.get("ranking_position", 1)
        info = metric_info(metric_key, scope)
        progress_list.append({
            "type": "ranking",
            "metric_key": metric_key,
            "scope": scope,
            "current_position": info.get("puesto"),
            "target_position": target_position,
            "top_value": info.get("top"),
            "current_value": info.get("valor"),
            "min_days_worked": int(params.get("min_days_worked", 0) or 0),
            "current_days_worked": get_days_worked(),
        })

    return {"progress": progress_list}
