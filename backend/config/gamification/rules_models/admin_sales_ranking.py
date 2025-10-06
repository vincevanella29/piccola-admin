import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Clave de plantilla (debe coincidir con el front):
TEMPLATE_KEY = "admin_sales_ranking"

# Mapeo de métricas de la regla a paths en kpis_admin_mensual
METRIC_MAP: Dict[str, str] = {
    "avg_daily_sales": "promedio_venta_diaria",  # usa .valor
    "total_sales": "sales",                      # usa .total
    "pm_per_mesa": "promedio_por_mesa",         # usa .valor
    "pm_por_persona": "promedio_por_persona",   # usa .valor
    # presence_days: especial
}

# Plantilla que el loader espera (siguiendo la estructura de sales_ranking.py)
ADMIN_SALES_RANKING_RULE_TEMPLATE = {
    "key": TEMPLATE_KEY,
    "name": "Ranking de Ventas Administradores (Top N / Exacto / Rango)",
    "description": "Otorga mérito a administradores según su posición en el ranking (Top N, exacto o rango) a nivel de local o empresa.",
    "category": "sales",
    "period": "month",
    "data_sources": [
        {
            "collection": "kpis_admin_mensual",
            "fields": [
                "rut", "periodo", "local",
                "sales", "promedio_por_mesa", "personas_atendidas",
                "promedio_por_persona", "promedio_venta_diaria", "days_present_admin"
            ],
            "filter": "Filtra por período (mensual o anual) y aplica ranking por la métrica seleccionada."
        }
    ],
    # ---------- IMPORTANTES (con defaults para el front) ----------
    "required_params": {
        "metric_key": {
            "type": "select",
            "options": ["avg_daily_sales", "total_sales", "pm_per_mesa", "pm_por_persona", "presence_days"],
            "default": "total_sales",
            "description": "Métrica a evaluar. presence_days usa days_present_admin."
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
        "conditions": {
            "type": "array",
            "description": "Lista de condiciones (AND). Tipo 'ranking' o 'value'. 'ranking' soporta min_position y/o max_position.",
            "example": [
                {"type": "ranking", "metric_key": "total_sales", "scope": "local", "max_position": 10},
                {"type": "value", "metric_key": "avg_daily_sales", "operator": "gte", "threshold": 500000}
            ]
        },
        # Umbral mínimo de días con venta
        "min_days_worked": {
            "type": "number", "min": 0, "default": 0,
            "description": "Mínimo de días con venta requeridos para ser elegible."
        }
    },
    "metrics": {
        "check": "db.kpis_admin_mensual.find({periodo, '[metric_path].puesto_[scope]': {$lte: position}})",
        "notes": "Busca en los KPIs pre-calculados a quienes cumplen posición/condiciones. presence_days usa days_present_admin y puestos sales.puesto_*_samples."
    },
    "example_payload": {
        "rule_name": "ranking_ventas_admin_top1_local",
        "segment_token_id": 1,
        "template_key": TEMPLATE_KEY,
        "params": {
            "metric_key": "total_sales",
            "ranking_scope": "local",
            "period_mode": "month",
            "position_type": "top_n",
            "ranking_position": 1
        },
        "merit_points": 10,
        "is_active": True
    }
}


def _row_filter(position_type: str, pos: int, pos_from: int, pos_to: int) -> Dict[str, Any]:
    if position_type == "exact":
        return {"$eq": int(pos)}
    if position_type == "range":
        lo = max(1, int(pos_from or 1))
        hi = max(lo, int(pos_to or lo))
        return {"$gte": lo, "$lte": hi}
    # top_n (default) — solo puestos > 0
    return {"$lte": int(pos), "$gt": 0}


def _build_condition_filter(cond: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ctype = cond.get("type")
    mkey = cond.get("metric_key")
    if ctype == "ranking":
        scope = cond.get("scope", "local")
        if mkey == "presence_days":
            field = f"sales.puesto_{scope}_samples"
        else:
            path = METRIC_MAP.get(mkey)
            if not path:
                return None
            field = f"{path}.puesto_{scope}"
        min_pos = cond.get("min_position")
        max_pos = cond.get("max_position")
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
            return None
        if mkey == "presence_days":
            return {"days_present_admin": {op_map[op]: threshold}}
        path = METRIC_MAP.get(mkey)
        if not path:
            return None
        field = ("sales.total" if path == "sales" else f"{path}.valor")
        return {field: {op_map[op]: threshold}}
    return None


def evaluate(db, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    """Evalúa la regla de ranking para administradores sobre kpis_admin_mensual."""
    params = rule.get("params", {}) or {}
    conditions: List[Dict[str, Any]] = params.get("conditions", []) or []

    period_mode = params.get("period_mode", "month")  # month | year
    metric_key = params.get("metric_key", "total_sales")
    ranking_scope = params.get("ranking_scope", "local")  # empresa | local
    position_type = params.get("position_type", "top_n")  # top_n | exact | range
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))
    min_days_worked = int(params.get("min_days_worked", 0) or 0)

    # Optional scope by cargos (igual patrón que sales_ranking)
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
    except Exception:
        pass

    coll = db.kpis_admin_mensual

    # ============ MENSUAL ============
    if period_mode == "month":
        base_match: Dict[str, Any] = {"periodo": periodo_dash}
        if allowed_ruts is not None:
            base_match["rut"] = {"$in": list(allowed_ruts)}

        # Camino conditions: match directo por puestos/valores + gating
        if conditions:
            match_stage: Dict[str, Any] = dict(base_match)
            and_filters: List[Dict[str, Any]] = []
            for c in conditions:
                f = _build_condition_filter(c)
                if f:
                    and_filters.append(f)
            if not and_filters:
                return []
            match_stage = {**match_stage, "$and": and_filters}
            if min_days_worked > 0:
                extra = {"promedio_venta_diaria.dias_con_venta": {"$gte": int(min_days_worked)}}
                if "$and" in match_stage:
                    match_stage["$and"].append(extra)
                else:
                    match_stage = {**match_stage, **extra}
            pipeline = [{"$match": match_stage}, {"$project": {"_id": 0, "rut": 1}}]
            return [d["rut"] for d in coll.aggregate(pipeline)]

        # Camino simple: reranking exacto determinístico con $documentNumber
        if metric_key == "presence_days":
            metric_expr = "$days_present_admin"  # valor a rankear
        else:
            path = METRIC_MAP.get(metric_key, "sales")
            metric_expr = ("$sales.total" if path == "sales" else f"${path}.valor")

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
            {"$addFields": {"_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}}},
            {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
        ]
        if ranking_scope == "empresa":
            pipeline += [{"$setWindowFields": {"sortBy": {"metric_value_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}}]
        else:
            pipeline += [{"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}}]
        pipeline += [
            {"$match": {"rownum": _row_filter(position_type, ranking_position, position_from, position_to)}},
            {"$project": {"_id": 0, "rut": 1}},
        ]
        return [d["rut"] for d in coll.aggregate(pipeline)]

    # ============ ANUAL ============
    year = (periodo_dash or "")[:4]
    year_match: Dict[str, Any] = {"periodo": {"$regex": f"^{year}-"}}
    if allowed_ruts is not None:
        year_match["rut"] = {"$in": list(allowed_ruts)}

    # Agregado anual: sumar totales y calcular métricas derivadas
    winners: List[str] = []
    if ranking_scope == "empresa":
        group_id = {"rut": "$rut"}
    else:
        group_id = {"rut": "$rut", "local": "$local"}

    metric_path = None if metric_key == "presence_days" else METRIC_MAP.get(metric_key, "sales")
    metric_value_field = (
        "$days_present_admin" if metric_key == "presence_days"
        else ("$sales.total" if metric_path == "sales" else f"${metric_path}.valor")
    )

    pipeline: List[Dict[str, Any]] = [
        {"$match": year_match},
        {"$group": {
            "_id": group_id,
            "sales_total": {"$sum": "$sales.total"},
            "mesas": {"$sum": "$total_mesas.valor"},
            "personas": {"$sum": "$personas_atendidas.valor"},
            "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
            "pvd_avg": {"$avg": "$promedio_venta_diaria.valor"},
            "days_present": {"$sum": {"$ifNull": ["$days_present_admin", 0]}},
        }},
        {"$addFields": {
            "rut": "$_id.rut",
            **({"local": "$_id.local"} if ranking_scope == "local" else {}),
            "sales": {"total": "$sales_total"},
            "total_mesas": {"valor": "$mesas"},
            "personas_atendidas": {"valor": "$personas"},
            "promedio_por_mesa": {"valor": {"$cond": [{"$gt": ["$mesas", 0]}, {"$divide": ["$sales_total", "$mesas"]}, 0]}},
            "promedio_por_persona": {"valor": {"$cond": [{"$gt": ["$personas", 0]}, {"$divide": ["$sales_total", "$personas"]}, 0]}},
            "promedio_venta_diaria": {"valor": "$pvd_avg", "dias_con_venta": "$dias"},
            "days_present_admin": "$days_present",
        }},
        {"$addFields": {"metric_value": metric_value_field, "dias_worked": "$promedio_venta_diaria.dias_con_venta"}},
    ]
    if min_days_worked > 0:
        pipeline.append({"$match": {"dias_worked": {"$gte": int(min_days_worked)}}})
    pipeline += [
        {"$match": {"metric_value": {"$gt": 0}}},
        {"$addFields": {"_rut_num": {"$convert": {"input": "$rut", "to": "double", "onError": 0.0, "onNull": 0.0}}}},
        {"$addFields": {"metric_value_tb": {"$add": ["$metric_value", {"$divide": ["$_rut_num", 1e12]}]}}},
    ]
    if ranking_scope == "empresa":
        pipeline += [{"$setWindowFields": {"sortBy": {"metric_value_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}}]
    else:
        pipeline += [{"$setWindowFields": {"partitionBy": "$local", "sortBy": {"metric_value_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}}]
    pipeline += [
        {"$match": {"rownum": _row_filter(position_type, ranking_position, position_from, position_to)}},
        {"$project": {"_id": 0, "rut": 1}},
    ]
    winners = [w["rut"] for w in coll.aggregate(pipeline)]
    return list(dict.fromkeys(winners))


def get_progress_data(db, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    """Devuelve progreso (puesto/valor/top y días trabajados cuando aplica)."""
    params = rule.get("params", {})
    period_mode = params.get("period_mode", "month")

    coll = db.kpis_admin_mensual

    def _metric_info(doc: Dict[str, Any], mkey: str, scope: Optional[str]) -> Dict[str, Any]:
        if mkey == "presence_days":
            out = {"metric_key": mkey, "valor": doc.get("days_present_admin")}
            if scope:
                # puestos de presencia están en sales.puesto_*_samples
                sales = doc.get("sales", {}) or {}
                out["puesto"] = sales.get(f"puesto_{scope}_samples")
                out["top"] = None
            return out
        path = METRIC_MAP.get(mkey, "sales")
        data = doc.get(path, {}) if path else {}
        out = {
            "metric_key": mkey,
            "valor": (data.get("total") if path == "sales" else data.get("valor")),
            "puesto_local": data.get("puesto_local") if isinstance(data, dict) else None,
            "puesto_empresa": data.get("puesto_empresa") if isinstance(data, dict) else None,
            "top_local": data.get("top_local") if isinstance(data, dict) else None,
            "top_empresa": data.get("top_empresa") if isinstance(data, dict) else None,
        }
        if scope:
            out["puesto"] = (data.get(f"puesto_{scope}") if isinstance(data, dict) else None) or doc.get(f"puesto_{scope}")
            out["top"] = (data.get(f"top_{scope}") if isinstance(data, dict) else None) or doc.get(f"top_{scope}")
        if path == "promedio_venta_diaria":
            out["dias_con_venta"] = data.get("dias_con_venta")
        return out

    if period_mode == "month":
        kpi_doc = coll.find_one({"rut": rut, "periodo": periodo_dash})
        if not kpi_doc:
            return {"progress": [], "summary": "Sin datos del período"}
    else:
        # Agregado anual para admin (empresa)
        year = (periodo_dash or "")[:4]
        rows = list(coll.aggregate([
            {"$match": {"periodo": {"$regex": f"^{year}-"}}},
            {"$group": {
                "_id": {"rut": "$rut"},
                "sales_total": {"$sum": "$sales.total"},
                "mesas": {"$sum": "$total_mesas.valor"},
                "personas": {"$sum": "$personas_atendidas.valor"},
                "dias": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
                "pvd_avg": {"$avg": "$promedio_venta_diaria.valor"},
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
            {"$match": {"rut": rut}},
            {"$project": {"_id": 0}},
        ]))
        kpi_doc = rows[0] if rows else None
        if not kpi_doc:
            return {"progress": [], "summary": "Sin datos del período (anual)"}

    progress_list: List[Dict[str, Any]] = []
    conditions = params.get("conditions", []) or []

    def add_progress(mkey: str, scope: Optional[str], target_pos: Optional[int] = None):
        info = _metric_info(kpi_doc, mkey, scope)
        item: Dict[str, Any] = {
            "type": ("ranking" if scope else "value"),
            "metric_key": mkey,
            **({"scope": scope} if scope else {}),
            **({"current_position": info.get("puesto"), "target_position": target_pos} if scope else {}),
            "top_value": info.get("top"),
            "current_value": info.get("valor"),
            "min_days_worked": int(params.get("min_days_worked", 0) or 0),
            "current_days_worked": (kpi_doc.get("promedio_venta_diaria", {}) or {}).get("dias_con_venta"),
        }
        if mkey == "avg_daily_sales":
            item["dias_con_venta"] = (kpi_doc.get("promedio_venta_diaria", {}) or {}).get("dias_con_venta")
        progress_list.append(item)

    if conditions:
        for cond in conditions:
            ctype = cond.get("type")
            mkey = cond.get("metric_key")
            if ctype == "ranking":
                add_progress(mkey, cond.get("scope", "local"), cond.get("max_position", 1))
            elif ctype == "value":
                add_progress(mkey, None, None)
    else:
        add_progress(params.get("metric_key", "total_sales"), params.get("ranking_scope", "local"), params.get("ranking_position", 1))

    return {"progress": progress_list}
