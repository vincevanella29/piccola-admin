# routers/admin_rankings.py

import logging
import os
from typing import Optional, List, Dict, Any, Set
from datetime import datetime
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.gamification.service import user_profile_summary
from config.gamification.helpers import list_permitted_segments_for_company

# Helpers de permisos / locales (config)
from config.roles.access_locals import (
    get_perms_from_user,
    validate_include_local_or_403,
    allowed_local_filter,
    derive_allowed_siglas_from_slugs,
    normalize_sucursal_to_sigla,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Colecciones ---
KPI_EMPLEADO_COLL = db.kpis_empleado_mensual
TRABAJADORES_COLL = db.trabajadores_vpn
RESULTS_COLL = db.meritocracy_kpi_results
LINKS = db.empleados_usuarios

# --- Mapeo de campos para ordenamiento ---
SORT_FIELD_MAP = {
    "total_venta": "kpi.total_venta",
    "promedio_mesa": "kpi.promedio_mesa",
    "total_mesas": "kpi.total_mesas",
    "personas_atendidas": "kpi.personas_atendidas",
    "promedio_por_persona": "kpi.promedio_por_persona",
    "promedio_venta_diaria": "kpi.promedio_venta_diaria",
}

# ==================== caché de segmentos permitidos para zero profile ====================

_SEGMENTS_CACHE: Dict[str, Any] = {}

def _get_allowed_segments_cached() -> Dict[int, Dict[str, Any]]:
    """
    Devuelve { token_id: {name, symbol} } solo de segmentos allowed por la compañía.
    Cache simple por proceso para evitar recomputar en cada request.
    """
    global _SEGMENTS_CACHE
    if "allowed_segments" in _SEGMENTS_CACHE:
        return _SEGMENTS_CACHE["allowed_segments"]

    data = list_permitted_segments_for_company()  # {'daoAddress':..., 'segments': [...]}
    allowed = {
        seg["token_id"]: {
            "name": seg.get("name"),
            "symbol": seg.get("symbol"),
        }
        for seg in (data.get("segments") or [])
        if seg.get("allowed")
    }
    _SEGMENTS_CACHE["allowed_segments"] = allowed
    _SEGMENTS_CACHE["daoAddress"] = data.get("daoAddress")
    return allowed

def _zero_merit_profile(wallet: Optional[str]) -> Dict[str, Any]:
    """
    Perfil de méritos en 0 con TODOS los segmentos permitidos por sistema,
    para que el front siempre reciba el mapa completo con nombres/símbolos.
    """
    allowed = _get_allowed_segments_cached()
    dao_address = _SEGMENTS_CACHE.get("daoAddress")
    company_id_env = int(os.getenv('COMPANY_ID', '1'))

    segments = [
        {"token_id": tid, "name": meta["name"], "symbol": meta["symbol"], "balance": 0}
        for tid, meta in sorted(allowed.items(), key=lambda x: x[0])
    ]
    return {
        "ok": True,
        "wallet": wallet,
        "company_id": company_id_env,
        "daoAddress": dao_address,
        "segments": segments,
        "total_balance": 0,
    }

# =======================================================================================

def _calculate_comparison_periods(start_str: str, end_str: str, compare_to: str) -> Optional[Dict[str, str]]:
    """Calcula el rango de fechas para el período de comparación."""
    start_date = datetime.strptime(start_str, "%Y-%m")
    end_date = datetime.strptime(end_str, "%Y-%m")

    if compare_to == "previous_year":
        return {
            "start": (start_date - relativedelta(years=1)).strftime("%Y-%m"),
            "end": (end_date - relativedelta(years=1)).strftime("%Y-%m"),
        }

    if compare_to == "previous_period":
        months_diff = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
        prev_end_date = start_date - relativedelta(days=1)
        prev_start_date = prev_end_date - relativedelta(months=months_diff - 1)
        return {"start": prev_start_date.strftime("%Y-%m"), "end": prev_end_date.strftime("%Y-%m")}

    return None


def _build_aggregation_pipeline(
    periodo_start: str,
    periodo_end: str,
    sucursal: Optional[str] = None,          # puede venir como SIGLA (MAI) o slug (MAILOC)
    allowed_slugs: Optional[Set[str]] = None, # slugs permitidos por permisos (o None => full)
    cargo: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Construye el pipeline de agregación base para un rango de períodos y filtros + permisos.
    - Si 'sucursal' viene → se normaliza a SIGLA (MAI).
    - Si NO viene 'sucursal' y allowed_slugs is not None → se restringe a las SIGLAS derivadas.
    """
    match_kpis = {"periodo": {"$gte": periodo_start, "$lte": periodo_end}}

    # Normaliza a SIGLA
    normalized_sigla = normalize_sucursal_to_sigla(sucursal) if sucursal else None
    allowed_siglas = derive_allowed_siglas_from_slugs(allowed_slugs) if (not normalized_sigla and allowed_slugs is not None) else set()

    after_lookup_filters: Dict[str, Any] = {}
    if cargo:
        after_lookup_filters["trabajador_info.cargo"] = cargo
    if normalized_sigla:
        after_lookup_filters["trabajador_info.sucursal"] = {"$in": [normalized_sigla]}
    elif allowed_slugs is not None:
        # Si allowed_slugs == set() el caller maneja vacío con early-return
        after_lookup_filters["trabajador_info.sucursal"] = {"$in": sorted(list(allowed_siglas)) if allowed_siglas else ["__NONE__"]}

    pipeline: List[Dict[str, Any]] = [
        {"$match": match_kpis},
        {"$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rutKpi": "$rut"},
            "pipeline": [
                {"$match": {"$expr": {"$or": [
                    {"$eq": [{"$toString": "$rut"}, {"$toString": "$$rutKpi"}]},
                    {"$eq": [
                        {"$toInt": {"$ifNull": ["$rut", 0]}},
                        {"$toInt": {"$ifNull": ["$$rutKpi", 0]}}
                    ]}
                ]}}}
            ],
            "as": "trabajador_info"
        }},
        {"$unwind": {"path": "$trabajador_info", "preserveNullAndEmptyArrays": True}},
    ]

    if after_lookup_filters:
        pipeline.append({"$match": after_lookup_filters})

    pipeline += [
        {"$group": {
            "_id": "$rut",
            "nombre": {"$first": "$trabajador_info.nombres"},
            "apellido": {"$first": "$trabajador_info.apellidopaterno"},
            "local": {"$first": "$local"},  # En KPIs, 'local' es la SIGLA (ALM, MAI, ...)
            "cargo": {"$first": "$trabajador_info.cargo"},
            "profile_image_url": {"$first": "$trabajador_info.profile_image_url"},
            "profile_image_hash": {"$first": "$trabajador_info.profile_image_hash"},
            "total_venta": {"$sum": "$sales.total"},
            "promedio_mesa": {"$avg": "$promedio_por_mesa.valor"},
            "total_mesas": {"$sum": "$total_mesas.valor"},
            "personas_atendidas": {"$sum": "$personas_atendidas.valor"},
            "promedio_por_persona": {"$avg": "$promedio_por_persona.valor"},
            "promedio_venta_diaria": {"$avg": "$promedio_venta_diaria.valor"},
            "dias_con_venta": {"$sum": {"$ifNull": ["$promedio_venta_diaria.dias_con_venta", 0]}},
            "any_es_competidor": {"$max": {"$cond": ["$es_competidor", 1, 0]}}
        }},
        {"$project": {
            "_id": 0, "rut": "$_id", "nombre": 1, "apellido": 1, "local": 1, "cargo": 1,
            "profile_image_url": 1, "profile_image_hash": 1,
            "kpi": {
                "total_venta": {"$round": ["$total_venta", 2]},
                "promedio_mesa": {"$round": ["$promedio_mesa", 2]},
                "total_mesas": "$total_mesas",
                "personas_atendidas": "$personas_atendidas",
                "promedio_por_persona": {"$round": ["$promedio_por_persona", 2]},
                "promedio_venta_diaria": {"$round": ["$promedio_venta_diaria", 2]},
                "dias_con_venta": "$dias_con_venta"
            },
            "es_competidor": {"$gt": ["$any_es_competidor", 0]}
        }}
    ]
    return pipeline


@router.get("/admin/rankings/empleados", summary="Ranking de empleados por KPIs de ventas con comparativas (filtrado por permisos)")
async def get_employee_rankings(
    periodo_start: str = Query(..., description="Período de inicio (YYYY-MM)"),
    periodo_end: str = Query(..., description="Período de fin (YYYY-MM)"),
    compare_to: Optional[str] = Query(None, enum=["previous_period", "previous_year"]),
    sort_by: str = Query("total_venta", enum=list(SORT_FIELD_MAP.keys())),
    sucursal: Optional[str] = None,   # slug o SIGLA
    cargo: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100000),
    skip: int = 0,
    user: dict = Depends(verify_session),
):
    # --- Permisos por sesión ---
    perms = get_perms_from_user(user)

    # Validar sucursal solicitada contra permisos
    if sucursal:
        validate_include_local_or_403(perms, [sucursal])

    # Si no viene sucursal, restringir a los slugs permitidos
    allowed_slugs = allowed_local_filter(perms)  # None => full access; set() => nada
    if not sucursal and allowed_slugs is not None and len(allowed_slugs) == 0:
        # Usuario sin acceso a ningún local → payload vacío y filtros devueltos
        return {
            "count": 0,
            "total_count": 0,
            "filters": {
                "periodo_start": periodo_start, "periodo_end": periodo_end,
                "compare_to": compare_to, "sort_by": sort_by,
                "sucursal": sucursal, "cargo": cargo
            },
            "ranking": [],
            "workers": []
        }

    sort_field = SORT_FIELD_MAP[sort_by]

    # --- 1. Ranking actual ---
    current_pipeline = _build_aggregation_pipeline(
        periodo_start, periodo_end,
        sucursal=sucursal,
        allowed_slugs=allowed_slugs,
        cargo=cargo
    )
    current_pipeline += [
        {"$setWindowFields": {
            "partitionBy": "$local", "sortBy": {sort_field: -1}, "output": {"puesto_local": {"$rank": {}}}
        }},
        {"$setWindowFields": {
            "sortBy": {sort_field: -1}, "output": {"puesto_empresa": {"$rank": {}}}
        }},
        {"$sort": {sort_field: -1}}
    ]
    current_results = list(KPI_EMPLEADO_COLL.aggregate(current_pipeline))

    present_ruts = {str(item.get("rut")) for item in current_results}

    # --- 2. Agregar trabajadores activos sin KPI (respetando permisos) ---
    normalized_sigla = normalize_sucursal_to_sigla(sucursal) if sucursal else None
    allowed_siglas_for_workers = derive_allowed_siglas_from_slugs(allowed_slugs) if (not normalized_sigla and allowed_slugs is not None) else set()

    trabajadores_match: Dict[str, Any] = {"activo": 1}
    if normalized_sigla:
        trabajadores_match["sucursal"] = normalized_sigla
    elif allowed_slugs is not None:
        if len(allowed_siglas_for_workers) == 0:
            return {
                "count": 0,
                "total_count": 0,
                "filters": {
                    "periodo_start": periodo_start, "periodo_end": periodo_end,
                    "compare_to": compare_to, "sort_by": sort_by,
                    "sucursal": sucursal, "cargo": cargo
                },
                "ranking": [],
                "workers": []
            }
        trabajadores_match["sucursal"] = {"$in": sorted(list(allowed_siglas_for_workers))}
    if cargo:
        trabajadores_match["cargo"] = cargo

    trabajadores = list(TRABAJADORES_COLL.find(trabajadores_match, {
        "rut": 1, "nombres": 1, "apellidopaterno": 1, "cargo": 1, "sucursal": 1,
        "profile_image_url": 1, "profile_image_hash": 1, "activo": 1
    }))

    for t in trabajadores:
        rut_str = str(t.get("rut", ""))
        if rut_str and rut_str not in present_ruts:
            current_results.append({
                "rut": rut_str,
                "nombre": t.get("nombres"),
                "apellido": t.get("apellidopaterno"),
                "local": t.get("sucursal"),
                "cargo": t.get("cargo"),
                "profile_image_url": t.get("profile_image_url"),
                "profile_image_hash": t.get("profile_image_hash"),
                "kpi": {k: 0 for k in SORT_FIELD_MAP},
                "es_competidor": False,
                "has_kpis": False,
                "puesto_local": None,
                "puesto_empresa": None,
            })

    # Ordenamiento final
    current_results.sort(key=lambda it: float(((it or {}).get("kpi") or {}).get(sort_by, -1e18)), reverse=True)

    # --- 3. Enriquecimiento de Méritos + Wallet ---
    ruts_list = [str(it.get("rut")) for it in current_results if it.get("rut")]

    if ruts_list:
        # Méritos (summary + history + totals)
        merits_pipeline = [
            {"$match": {"rut": {"$in": ruts_list}}},
            {"$facet": {
                "summary": [
                    {"$match": {"periodo": {"$gte": periodo_start, "$lte": periodo_end}}},
                    {"$group": {
                        "_id": "$rut",
                        "fulfilled_count": {"$sum": {"$cond": [{"$eq": ["$status", "fulfilled"]}, 1, 0]}},
                        "not_fulfilled_count": {"$sum": {"$cond": [{"$eq": ["$status", "not_fulfilled"]}, 1, 0]}},
                        "total_merit_points": {"$sum": {"$ifNull": ["$merit_points", 0]}}
                    }}
                ],
                "history": [
                    {"$sort": {"periodo": -1}},
                    {"$project": {
                        "_id": 0, "rut": 1, "rule_id": 1, "template_key": 1, "periodo": 1,
                        "merit_points": {"$ifNull": ["$merit_points", 0]},
                        "segment_token_id": 1, "mint_status": 1,
                        "is_minted": {"$eq": ["$mint_status", "minted"]}
                    }},
                    {"$group": {"_id": "$rut", "items": {"$push": "$$ROOT"}}}
                ],
                "totals": [
                    {"$group": {
                        "_id": "$rut",
                        "total_count": {"$sum": 1},
                        "minted_count": {"$sum": {"$cond": [{"$eq": ["$mint_status", "minted"]}, 1, 0]}},
                        "total_points": {"$sum": {"$ifNull": ["$merit_points", 0]}}
                    }}
                ]
            }}
        ]
        merits_data = list(RESULTS_COLL.aggregate(merits_pipeline))[0]

        merits_map = {row["_id"]: row for row in merits_data["summary"]}
        history_map = {row["_id"]: row["items"] for row in merits_data["history"]}
        totals_map = {row["_id"]: row for row in merits_data["totals"]}

        # Enriquecer historial con metadatos del token (name, symbol)
        allowed_segments = _get_allowed_segments_cached()  # {token_id: {name, symbol}}

        def _enrich_items_with_segment(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            enriched: List[Dict[str, Any]] = []
            for itx in items:
                seg_id = itx.get("segment_token_id")
                meta = allowed_segments.get(seg_id) if isinstance(seg_id, int) else None
                if meta:
                    itx = {
                        **itx,
                        "segment": {
                            "token_id": seg_id,
                            "name": meta.get("name"),
                            "symbol": meta.get("symbol"),
                        },
                    }
                else:
                    itx = {**itx, "segment": None}
                enriched.append(itx)
            return enriched

        history_map = {rut: _enrich_items_with_segment(items) for rut, items in history_map.items()}

        # Wallets
        ruts_int = [int(r) for r in ruts_list if r.isdigit()]
        link_query = {"$or": []}
        if ruts_list: link_query["$or"].append({"rut": {"$in": ruts_list}})
        if ruts_int: link_query["$or"].append({"rut": {"$in": ruts_int}})
        link_docs = list(LINKS.find(link_query, {"rut": 1, "wallet": 1})) if link_query["$or"] else []
        link_map = {str(d["rut"]): d.get("wallet") for d in link_docs if d.get("rut")}

        # KPI más reciente dentro del rango para enriquecer cada empleado
        latest_docs = list(KPI_EMPLEADO_COLL.aggregate([
            {"$match": {"rut": {"$in": ruts_list}, "periodo": {"$gte": periodo_start, "$lte": periodo_end}}},
            {"$sort": {"periodo": -1}},
            {"$group": {"_id": "$rut", "doc": {"$first": "$$ROOT"}}},
            {"$project": {
                "_id": 0,
                "rut": "$_id",
                "periodo": "$doc.periodo",
                "sales": "$doc.sales",
                "restaurant": "$doc.restaurant",
                "total_mesas": "$doc.total_mesas",
                "promedio_por_mesa": "$doc.promedio_por_mesa",
                "personas_atendidas": "$doc.personas_atendidas",
                "promedio_por_persona": "$doc.promedio_por_persona",
                "promedio_venta_diaria": "$doc.promedio_venta_diaria"
            }}
        ]))
        latest_map = {str(d.get("rut")): d for d in latest_docs}

        # Precarga de segmentos permitidos para zero profiles (una vez)
        _get_allowed_segments_cached()

        for it in current_results:
            rut = str(it.get("rut"))
            it["merits_summary"] = merits_map.get(rut, {"fulfilled_count": 0, "not_fulfilled_count": 0, "total_merit_points": 0})
            it["merits_history"] = history_map.get(rut, [])
            it["merits_totals"] = totals_map.get(rut, {"total_count": 0, "minted_count": 0, "total_points": 0})

            # wallet + merit_profile (SIEMPRE presente)
            wallet = link_map.get(rut)
            if wallet:
                it["wallet"] = wallet
                try:
                    it["merit_profile"] = user_profile_summary(wallet)
                except Exception:
                    it["merit_profile"] = _zero_merit_profile(wallet)
            else:
                it["merit_profile"] = _zero_merit_profile(None)

            # Adjuntar snapshot del KPI más reciente del rango
            it["latest_kpi"] = latest_map.get(rut)

    # --- 4. Comparación (mismo filtro de permisos) ---
    if compare_to:
        comp_periods = _calculate_comparison_periods(periodo_start, periodo_end, compare_to)
        prev_results = list(KPI_EMPLEADO_COLL.aggregate(_build_aggregation_pipeline(
            comp_periods["start"], comp_periods["end"],
            sucursal=sucursal,
            allowed_slugs=allowed_slugs,
            cargo=cargo
        )))
        prev_map = {item["rut"]: item["kpi"] for item in prev_results}

        for it in current_results:
            rut = it["rut"]
            prev_kpi = prev_map.get(rut)
            it["comparativo"] = prev_kpi
            it["variacion"] = {}
            if prev_kpi:
                for key, current_val in it.get("kpi", {}).items():
                    curr = float(current_val or 0)
                    prev = float((prev_kpi.get(key) if isinstance(prev_kpi, dict) else 0) or 0)
                    if prev > 0:
                        it["variacion"][key] = round(((curr - prev) / prev) * 100, 2)
                    elif curr > 0:
                        it["variacion"][key] = 100.0
                    else:
                        it["variacion"][key] = 0.0

    # --- 5. Paginación ---
    total_count = len(current_results)
    paginated_results = current_results[skip: skip + limit]

    workers_payload = [{
        "rut": str(w.get("rut")) if w.get("rut") else None,
        "nombre": w.get("nombres"),
        "apellido": w.get("apellidopaterno"),
        "cargo": w.get("cargo"),
        "local": w.get("sucursal"),
        "activo": w.get("activo"),
        "profile_image_url": w.get("profile_image_url"),
        "profile_image_hash": w.get("profile_image_hash"),
    } for w in trabajadores]

    return {
        "count": len(paginated_results),
        "total_count": total_count,
        "filters": {
            "periodo_start": periodo_start, "periodo_end": periodo_end,
            "compare_to": compare_to, "sort_by": sort_by,
            "sucursal": sucursal, "cargo": cargo
        },
        "ranking": paginated_results,
        "workers": workers_payload
    }
