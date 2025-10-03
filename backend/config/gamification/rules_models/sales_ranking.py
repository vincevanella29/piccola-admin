# config/gamification/rules_models/sales_ranking.py

from __future__ import annotations
from typing import Dict, Any, List, Optional
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
    "name": "Ranking de Ventas (Top N / Exacto / Rango)",
    "description": "Otorga mérito a empleados según su posición en el ranking (Top N, exacto o rango) a nivel de local o empresa.",
    "category": "sales",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_empleado_mensual",
            "fields": [
                "rut", "periodo", "local", "es_competidor",
                "sales", "promedio_por_mesa", "personas_atendidas",
                "promedio_por_persona", "promedio_venta_diaria"
            ],
            "filter": "Filtra por período (mensual o anual) y es_competidor=true, buscando la posición en el ranking anidado."
        }
    ],
    # ---------- IMPORTANTES (con defaults para el front) ----------
    "required_params": {
        "metric_key": {
            "type": "select", "options": list(METRIC_MAP.keys()), "default": "sales",
            "description": "Métrica a evaluar."
        },
        "period_mode": {
            "type": "select", "options": ["month", "year"], "default": "month",
            "description": "Mensual o anual."
        },
        "ranking_scope": {
            "type": "select", "options": ["local", "empresa"], "default": "local",
            "description": "Ámbito del ranking."
        },
        # MODO DE PUESTOS: top_n (<= N), exact (== N), range (entre [from..to])
        "position_type": {
            "type": "select", "options": ["top_n", "exact", "range"], "default": "top_n",
            "description": "Cómo se evalúa la posición: Top N, Exacto o Rango."
        },
        # Para top_n y exact
        "ranking_position": {
            "type": "number", "min": 1, "max": 100, "default": 1,
            "description": "N para Top N o posición exacta, según position_type."
        },
        # Para range
        "position_from": {
            "type": "number", "min": 1, "max": 100, "default": 4,
            "description": "Desde (inclusive) cuando position_type = range."
        },
        "position_to": {
            "type": "number", "min": 1, "max": 100, "default": 10,
            "description": "Hasta (inclusive) cuando position_type = range."
        }
    },
    "optional_params": {
        # Condiciones compuestas (se ignoran los campos simples si vienen definidas)
        "conditions": {
            "type": "array",
            "description": "Lista de condiciones (AND). Tipo 'ranking' o 'value'. 'ranking' ahora soporta min_position y/o max_position.",
            "example": [
                {"type": "ranking", "metric_key": "sales", "scope": "local", "max_position": 10},
                {"type": "value", "metric_key": "avg_daily_sales", "operator": "gte", "threshold": 500000}
            ]
        },
        # Umbral mínimo de días con venta
        "min_days_worked": {
            "type": "number", "min": 0, "default": 0,
            "description": "Mínimo de días con venta requeridos."
        }
    },
    "metrics": {
        "check": "db.kpis_empleado_mensual.find({periodo, es_competidor: true, '[metric_path].puesto_[scope]': {$lte: position}})",
        "notes": "Busca en los KPIs pre-calculados a quienes cumplen posición/condiciones."
    },
    "example_payload": {
        "rule_name": "ranking_ventas_top1_local",
        "segment_token_id": 1,
        "template_key": TEMPLATE_KEY,
        "params": {
            "metric_key": "sales",
            "ranking_scope": "local",
            "period_mode": "month",
            "position_type": "top_n",
            "ranking_position": 1
        },
        "merit_points": 10,
        "is_active": True
    }
}

def _build_position_filter(position_type: str, pos: int, pos_from: int, pos_to: int) -> Dict[str, Any]:
    """
    Devuelve un filtro Mongo para puestos según el modo (top_n/exact/range).
    Siempre fuerza > 0 para ignorar 'sin ranking'.
    """
    if position_type == "exact":
        return {"$eq": int(pos)}
    if position_type == "range":
        lo = max(1, int(pos_from or 1))
        hi = max(lo, int(pos_to or lo))
        return {"$gte": lo, "$lte": hi}
    # default: top_n
    return {"$lte": int(pos), "$gt": 0}

def _merge_and(and_list: List[Dict[str, Any]], extra: Dict[str, Any]) -> Dict[str, Any]:
    if not and_list:
        return extra
    return {"$and": and_list + [extra]}

# --- Función de Evaluación ---
def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    """
    Evalúa la regla de ranking de ventas.
    - Si NO hay 'conditions': aplica gating (cargos, min_days_worked), re-ordena con tiebreaker y numera con
      $documentNumber para garantizar Top N EXACTO y determinístico (empresa o local) en mes/año.
    - Si HAY 'conditions': mantiene el match por puestos/valores pre-calculados, pero con gating previo.
    """
    params = rule.get("params", {}) or {}
    conditions: List[Dict[str, Any]] = params.get("conditions", []) or []

    period_mode = params.get("period_mode", "month")
    metric_key = params.get("metric_key", "sales")
    ranking_scope = params.get("ranking_scope", "local")   # "empresa" | "local"
    position_type = params.get("position_type", "top_n")   # "top_n" | "exact" | "range"
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    # ---------- Scope por cargos (opcional) ----------
    allowed_ruts: Optional[set] = None
    try:
        scope_cfg = rule.get("scope") or {}
        cargos_cfg = scope_cfg.get("cargos") or {}
        include_cargos = cargos_cfg.get("include") or []
        exclude_cargos = cargos_cfg.get("exclude") or []
        if include_cargos or exclude_cargos:
            tv_pipe = [
                {"$match": {"activo": 1}},
                {"$addFields": {"rut_str": {"$toString": "$rut"}}},
            ]
            cargo_match: Dict[str, Any] = {}
            if include_cargos:
                cargo_match["$in"] = include_cargos
            if exclude_cargos:
                cargo_match["$nin"] = exclude_cargos
            if cargo_match:
                tv_pipe.insert(1, {"$match": {"cargo": cargo_match}})
            tv_pipe += [{"$project": {"_id": 0, "rut_str": 1}}]
            allowed_ruts = {d["rut_str"] for d in db.trabajadores_vpn.aggregate(tv_pipe)}
            if not allowed_ruts:
                return []
    except Exception as e:
        logger.warning(f"sales_ranking_position: error resolviendo cargos en scope: {e}")

    # ---------- Helpers ----------
    def _row_filter(pt: str, pos: int, lo: int, hi: int) -> Dict[str, Any]:
        if pt == "exact":
            return {"$eq": int(pos)}
        if pt == "range":
            lo = max(1, int(lo or 1))
            hi = max(lo, int(hi or lo))
            return {"$gte": lo, "$lte": hi}
        return {"$lte": int(pos)}  # top_n

    def build_condition_filter(cond: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        ctype = cond.get("type")
        mkey = cond.get("metric_key")
        if mkey not in METRIC_MAP:
            logger.warning(f"Condición ignorada por métrica no válida: {mkey}")
            return None
        path = METRIC_MAP[mkey]
        if ctype == "ranking":
            scope = cond.get("scope", "local")
            min_pos = cond.get("min_position")
            max_pos = cond.get("max_position")
            if scope not in ["local", "empresa"]:
                logger.warning(f"Scope inválido en condición ranking: {scope}")
                return None
            field = f"{path}.puesto_{scope}"
            if min_pos is not None and max_pos is not None:
                lo = max(1, int(min_pos)); hi = max(lo, int(max_pos))
                return {field: {"$gte": lo, "$lte": hi}}
            if min_pos is not None:
                return {field: {"$gte": max(1, int(min_pos))}}
            if max_pos is not None:
                return {field: {"$gt": 0, "$lte": int(max_pos)}}
            return {field: {"$eq": 1}}
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

    path = METRIC_MAP.get(metric_key, "sales")

    # =========================
    # MODO MENSUAL
    # =========================
    if period_mode == "month":
        base_match: Dict[str, Any] = {"es_competidor": True, "periodo": periodo_dash}
        if allowed_ruts is not None:
            base_match["rut"] = {"$in": list(allowed_ruts)}

        # --- Camino conditions: usar puestos/valores precalculados + gating ---
        if conditions:
            match_stage: Dict[str, Any] = dict(base_match)
            and_filters = []
            for c in conditions:
                f = build_condition_filter(c)
                if f: and_filters.append(f)
            if not and_filters:
                return []
            match_stage = {**match_stage, "$and": and_filters}
            if min_days_worked > 0:
                extra = {"promedio_venta_diaria.dias_con_venta": {"$gte": int(min_days_worked)}}
                if "$and" in match_stage: match_stage["$and"].append(extra)
                else: match_stage = {**match_stage, **extra}
            pipeline = [{"$match": match_stage}, {"$project": {"_id": 0, "rut": 1}}]
            return [d["rut"] for d in db.kpis_empleado_mensual.aggregate(pipeline)]

        # --- Camino simple: re-ranking exacto con $documentNumber y tiebreaker escalar ---
        metric_expr = "$sales.total" if path == "sales" else f"${path}.valor"
        pipeline: List[Dict[str, Any]] = [
            {"$match": base_match},
            {"$addFields": {
                "metric_value": {"$ifNull": [metric_expr, 0]},
                "dias_worked": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]},
            }},
        ]
        if min_days_worked > 0:
            pipeline.append({"$match": {"dias_worked": {"$gte": int(min_days_worked)}}})
        pipeline += [
            {"$match": {"metric_value": {"$gt": 0}}},
            # tiebreaker determinístico basado en RUT numérico (si no convertible -> 0)
            {"$addFields": {
                "_rut_num": {
                    "$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}
                }
            }},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
        ]

        if ranking_scope == "empresa":
            pipeline += [
                {"$setWindowFields": {
                    "sortBy": {"metric_value_tb": -1},   # ← un solo campo: cumple requisito de $documentNumber
                    "output": {"rownum": {"$documentNumber": {}}}
                }},
            ]
        else:  # local
            pipeline += [
                {"$setWindowFields": {
                    "partitionBy": "$local",
                    "sortBy": {"metric_value_tb": -1},   # ← un solo campo
                    "output": {"rownum": {"$documentNumber": {}}}
                }},
            ]

        pipeline += [
            {"$match": {"rownum": _row_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}}
        ]
        return [d["rut"] for d in db.kpis_empleado_mensual.aggregate(pipeline)]

    # =========================
    # MODO ANUAL
    # =========================
    year = (periodo_dash or "")[:4]
    year_match: Dict[str, Any] = {"periodo": {"$regex": f"^{year}-"}, "es_competidor": True}
    if allowed_ruts is not None:
        year_match["rut"] = {"$in": list(allowed_ruts)}

    # --- Camino conditions (match directo) ---
    if conditions:
        match_stage: Dict[str, Any] = dict(year_match)
        and_filters = []
        for c in conditions:
            f = build_condition_filter(c)
            if f: and_filters.append(f)
        if not and_filters:
            return []
        match_stage = {**match_stage, "$and": and_filters}
        if min_days_worked > 0:
            extra = {"promedio_venta_diaria.dias_con_venta": {"$gte": int(min_days_worked)}}
            if "$and" in match_stage: match_stage["$and"].append(extra)
            else: match_stage = {**match_stage, **extra}
        pipeline = [{"$match": match_stage}, {"$project": {"_id": 0, "rut": 1}}]
        return [d["rut"] for d in db.kpis_empleado_mensual.aggregate(pipeline)]

    # --- Camino simple anual: agregar + tiebreaker + $documentNumber ---
    winners: List[str] = []
    if ranking_scope == "empresa":
        agg_pipeline: List[Dict[str, Any]] = [
            {"$match": year_match},
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
                "promedio_venta_diaria": {"valor": "$pvd_avg", "dias_con_venta": "$dias"},
            }},
            {"$addFields": {
                "metric_value": ("$sales.total" if path == "sales" else f"${path}.valor"),
                "dias_worked": "$promedio_venta_diaria.dias_con_venta"
            }},
        ]
        if min_days_worked > 0:
            agg_pipeline.append({"$match": {"dias_worked": {"$gte": int(min_days_worked)}}})
        agg_pipeline += [
            {"$match": {"metric_value": {"$gt": 0}}},
            {"$addFields": {
                "_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}
            }},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
            {"$setWindowFields": {
                "sortBy": {"metric_value_tb": -1},
                "output": {"rownum": {"$documentNumber": {}}}
            }},
            {"$match": {"rownum": _row_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        winners = [w["rut"] for w in db.kpis_empleado_mensual.aggregate(agg_pipeline)]
    else:
        agg_pipeline: List[Dict[str, Any]] = [
            {"$match": year_match},
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
                "promedio_venta_diaria": {"valor": "$pvd_avg", "dias_con_venta": "$dias"},
            }},
            {"$addFields": {
                "metric_value": ("$sales.total" if path == "sales" else f"${path}.valor"),
                "dias_worked": "$promedio_venta_diaria.dias_con_venta"
            }},
        ]
        if min_days_worked > 0:
            agg_pipeline.append({"$match": {"dias_worked": {"$gte": int(min_days_worked)}}})
        agg_pipeline += [
            {"$match": {"metric_value": {"$gt": 0}}},
            {"$addFields": {
                "_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}
            }},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
            {"$setWindowFields": {
                "partitionBy": "$local",
                "sortBy": {"metric_value_tb": -1},
                "output": {"rownum": {"$documentNumber": {}}}
            }},
            {"$match": {"rownum": _row_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        winners = [w["rut"] for w in db.kpis_empleado_mensual.aggregate(agg_pipeline)]

    # Únicos por si un RUT califica en más de un local
    return list(dict.fromkeys(winners))



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
    def get_days_worked() -> Optional[int]:
        try:
            pvd = (kpi_doc or {}).get("promedio_venta_diaria", {})
            if isinstance(pvd, dict):
                dv = pvd.get("dias_con_venta")
                return int(dv) if dv is not None else None
        except Exception:
            return None
        return None

    def metric_info(mkey: str, scope: Optional[str]) -> Dict[str, Any]:
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
