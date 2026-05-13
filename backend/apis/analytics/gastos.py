# backend/api/gastos.py
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query

from utils.auth.session import verify_session
from utils.web3mongo import db

# utils de permisos/mapeos
from config.roles.access_gastos import (
    get_perms_from_user,
    parse_date_yyyymmdd,
    validate_include_sucursales_or_403,
    allowed_sucursales_filter,
    siglas_for_sucursal_ids,
)

router = APIRouter()
logger = logging.getLogger(__name__)

COL_GASTOS = db.gastos_intranet


# ---------------------------
# 1) FECHAS DISPONIBLES
# ---------------------------
@router.get("/gastos/available-dates")
async def get_gastos_available_dates():
    """
    Retorna min/max usando $toDate sobre 'fecha_pago' (robusto a string o Date).
    (No requiere sesión; info no sensible)
    """
    base = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_pago"}, "date"]},
                    "$fecha_pago",
                    {"$toDate": "$fecha_pago"}
                ]
            }
        }},
        {"$project": {"fecha_norm": 1, "_id": 0}},
    ]

    min_doc = next(COL_GASTOS.aggregate(base + [{"$sort": {"fecha_norm": 1}}, {"$limit": 1}]), None)
    max_doc = next(COL_GASTOS.aggregate(base + [{"$sort": {"fecha_norm": -1}}, {"$limit": 1}]), None)

    def to_iso(d):
        return d.isoformat() if isinstance(d, datetime) else d

    return {
        "min_date": to_iso(min_doc["fecha_norm"]) if min_doc else None,
        "max_date": to_iso(max_doc["fecha_norm"]) if max_doc else None,
    }


# ---------------------------
# 2) LISTADO CRUDO (con permisos)
# ---------------------------
@router.get("/gastos", summary="Listado crudo de gastos (filtrado por permisos)")
async def get_gastos(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve gastos crudos dentro del rango [start_date, end_date] (inclusive),
    aplicando permisos de la sesión. Se restringe por id_sucursal/sigla según
    lo permitido al usuario.
    """
    perms = get_perms_from_user(user)
    start = parse_date_yyyymmdd(start_date)
    end   = parse_date_yyyymmdd(end_date) + timedelta(days=1)  # exclusivo

    # Filtro por sucursales permitidas
    allowed_ids = allowed_sucursales_filter(perms)
    if allowed_ids is not None and not allowed_ids:
        return {"count": 0, "gastos": []}

    pipeline: List[Dict[str, Any]] = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_pago"}, "date"]},
                    "$fecha_pago",
                    {"$toDate": "$fecha_pago"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
    ]

    # Match por permisos:
    # Preferimos filtrar por id_sucursal; si no hay global acceso, también
    # agregamos filtro por SIGLA (por si hay docs sin id_sucursal).
    if allowed_ids is not None:
        pipeline.append({"$match": {"id_sucursal": {"$in": list(allowed_ids)}}})
        # Filtro extra por sigla para cubrir docs que no tengan id_sucursal
        allowed_siglas = siglas_for_sucursal_ids(list(allowed_ids))
        if allowed_siglas:
            pipeline.append({
                "$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}
            })
            pipeline.append({
                "$match": {"$or": [
                    {"id_sucursal": {"$in": list(allowed_ids)}},
                    {"_sigla_up": {"$in": list(allowed_siglas)}},
                ]}
            })

    pipeline += [
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            "fecha_pago": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}
        }},
        {"$project": {"fecha_norm": 0}},
        {"$sort": {"fecha_pago": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 100000},
    ]

    rows = list(COL_GASTOS.aggregate(pipeline))
    return {"count": len(rows), "gastos": rows}


# ---------------------------
# 3) SUMMARY (por resumen2/resumen/tipo_gasto) con permisos
# ---------------------------
@router.get("/gastos/summary", summary="Resumen anidado (filtrado por permisos)")
async def get_gastos_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    """
    Resume por resumen2 -> resumen -> tipo_gasto, con 'details' normalizados,
    aplicando permisos de sucursales.
    """
    perms = get_perms_from_user(user)
    start = parse_date_yyyymmdd(start_date)
    end   = parse_date_yyyymmdd(end_date) + timedelta(days=1)  # exclusivo

    allowed_ids = allowed_sucursales_filter(perms)
    if allowed_ids is not None and not allowed_ids:
        return {'count': 0, 'gastos': []}

    pipeline: List[Dict[str, Any]] = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_pago"}, "date"]},
                    "$fecha_pago",
                    {"$toDate": "$fecha_pago"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
    ]

    if allowed_ids is not None:
        pipeline.append({"$match": {"id_sucursal": {"$in": list(allowed_ids)}}})
        allowed_siglas = siglas_for_sucursal_ids(list(allowed_ids))
        if allowed_siglas:
            pipeline += [
                {"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}},
                {"$match": {"$or": [
                    {"id_sucursal": {"$in": list(allowed_ids)}},
                    {"_sigla_up": {"$in": list(allowed_siglas)}},
                ]}},
            ]

    pipeline += [
        {
            "$group": {
                "_id": {"resumen2": "$resumen2", "resumen": "$resumen", "tipo_gasto": "$tipo_gasto"},
                "total_cargo": {"$sum": "$cargo"},
                "total_abono": {"$sum": "$abono"},
                "count": {"$sum": 1},
                "details": {"$push": "$$ROOT"},
            }
        },
        {
            "$group": {
                "_id": {"resumen2": "$_id.resumen2", "resumen": "$_id.resumen"},
                "tipo_gasto_data": {
                    "$push": {
                        "tipo_gasto": "$_id.tipo_gasto",
                        "total_cargo": "$total_cargo",
                        "total_abono": "$total_abono",
                        "count": "$count",
                        "details": {
                            "$map": {
                                "input": "$details",
                                "as": "d",
                                "in": {
                                    "$mergeObjects": [
                                        "$$d",
                                        {
                                            "_id": {"$toString": "$$d._id"},
                                            "fecha_pago": {
                                                "$dateToString": {
                                                    "format": "%Y-%m-%d",
                                                    "date": {
                                                        "$cond": [
                                                            {"$eq": [{"$type": "$$d.fecha_pago"}, "date"]},
                                                            "$$d.fecha_pago",
                                                            {"$toDate": "$$d.fecha_pago"}
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                "total_cargo": {"$sum": "$total_cargo"},
                "total_abono": {"$sum": "$total_abono"},
                "count": {"$sum": "$count"},
            }
        },
        {
            "$group": {
                "_id": "$_id.resumen2",
                "resumen_data": {
                    "$push": {
                        "resumen": "$_id.resumen",
                        "total_cargo": "$total_cargo",
                        "total_abono": "$total_abono",
                        "count": "$count",
                        "tipo_gasto_data": "$tipo_gasto_data",
                    }
                },
                "total_cargo": {"$sum": "$total_cargo"},
                "total_abono": {"$sum": "$total_abono"},
                "count": {"$sum": "$count"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "resumen2": "$_id",
                "total_cargo": 1,
                "total_abono": 1,
                "count": 1,
                "resumen_data": 1,
            }
        },
        {"$sort": {"resumen2": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 100000},
    ]

    result = list(COL_GASTOS.aggregate(pipeline))

    # Relleno de días faltantes en los arrays anidados
    date_end_inclusive = end - timedelta(days=1)
    for resumen2 in result:
        for resumen in resumen2.get('resumen_data', []):
            for tipo_gasto in resumen.get('tipo_gasto_data', []):
                details = tipo_gasto.get('details', [])
                details_by_date = {d['fecha_pago']: d for d in details}
                date_cursor = start
                filled_details: List[Dict[str, Any]] = []
                while date_cursor <= date_end_inclusive:
                    fecha_str = date_cursor.strftime('%Y-%m-%d')
                    if fecha_str in details_by_date:
                        filled_details.append(details_by_date[fecha_str])
                    else:
                        filled_details.append({
                            '_id': '',
                            'fecha_pago': fecha_str,
                            'cargo': 0,
                            'abono': 0,
                        })
                    date_cursor += timedelta(days=1)
                tipo_gasto['details'] = filled_details

    return {'count': len(result), 'gastos': result}


# ---------------------------
# 4) TOTALES POR CUENTA (rápido para widgets) con permisos
# ---------------------------
@router.get("/gastos/totals", summary="Totales por cuenta (agrupado por día) - con permisos")
async def get_gastos_totals(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    by: str         = Query("resumen2", regex="^(resumen2|resumen|tipo_gasto|cuenta)$"),
    include_daily: bool = Query(True),
    exclude_cuentas: Optional[str] = Query(None, description="coma-separadas, p.ej. 100000,900000,999963"),
    include_resumen2: Optional[str] = Query(None, description="filtrar SOLO estos resumen2, coma-separadas"),
    exclude_resumen2: Optional[str] = Query(None, description="excluir estos resumen2, coma-separadas"),
    include_sucursales_ids: Optional[str] = Query(None, description="filtrar SOLO estos id_sucursal, coma-separadas"),
    include_siglas: Optional[str] = Query(None, description="filtrar SOLO estas siglas de sucursal, coma-separadas (p.ej. AHM, PRV)"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    """
    Agrega por 'by' (default 'resumen2') y por día. Aplica permisos de sucursales.
    Si se especifican filtros de sucursales (ids/siglas), se validan contra permisos.
    Si no, se restringe automáticamente a las sucursales permitidas por la sesión.
    """
    perms = get_perms_from_user(user)
    start = parse_date_yyyymmdd(start_date)
    end   = parse_date_yyyymmdd(end_date) + timedelta(days=1)  # exclusivo

    # Parsear filtros por cuenta/resumen2/sucursal
    excl_list = [s.strip() for s in (exclude_cuentas or "").split(",") if s.strip()]
    include_res2_list = [s.strip() for s in (include_resumen2 or "").split(",") if s.strip()]
    exclude_res2_list = [s.strip() for s in (exclude_resumen2 or "").split(",") if s.strip()]

    include_suc_ids = [int(s.strip()) for s in (include_sucursales_ids or "").split(",") if s.strip()]
    include_siglas_list = [s.strip().upper() for s in (include_siglas or "").split(",") if s.strip()]

    # Validar filtros explícitos de sucursales
    validate_include_sucursales_or_403(perms, include_suc_ids, include_siglas_list)

    group_field = f"${by}"

    pipeline: List[Dict[str, Any]] = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [ {"$type": "$fecha_pago"}, "date"]},
                    "$fecha_pago",
                    {"$toDate": "$fecha_pago"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
    ]

    # Filtro por resumen2 (incluye/excluye)
    if include_res2_list:
        pipeline.append({"$match": {"resumen2": {"$in": include_res2_list}}})
    if exclude_res2_list:
        pipeline.append({"$match": {"resumen2": {"$nin": exclude_res2_list}}})

    # Filtro por sucursales (explícitos o por permisos)
    if include_suc_ids:
        pipeline.append({"$match": {"id_sucursal": {"$in": include_suc_ids}}})

    if include_siglas_list:
        pipeline += [
            {"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}},
            {"$match": {"_sigla_up": {"$in": include_siglas_list}}},
        ]

    if not include_suc_ids and not include_siglas_list:
        allowed_ids = allowed_sucursales_filter(perms)
        if allowed_ids is not None:
            if not allowed_ids:
                return {"count": 0, "gastos": []}
            pipeline.append({"$match": {"id_sucursal": {"$in": list(allowed_ids)}}})
            # cubrir docs sin id_sucursal usando SIGLA
            allowed_siglas = siglas_for_sucursal_ids(list(allowed_ids))
            if allowed_siglas:
                pipeline += [
                    {"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}},
                    {"$match": {"$or": [
                        {"id_sucursal": {"$in": list(allowed_ids)}},
                        {"_sigla_up": {"$in": list(allowed_siglas)}},
                    ]}},
                ]

    # Excluir cuentas (normalizando a string)
    if excl_list:
        pipeline += [
            {"$addFields": {"cuenta_str": {"$toString": "$cuenta"}}},
            {"$match": {"cuenta_str": {"$nin": excl_list}}},
        ]

    pipeline += [
        {"$project": {
            "cargo": {"$ifNull": ["$cargo", 0]},
            "abono": {"$ifNull": ["$abono", 0]},
            "group": group_field,
            "dia": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}},
        }},
        # Totales por día del grupo
        {"$group": {
            "_id": {"group": "$group", "dia": "$dia"},
            "total_cargo": {"$sum": "$cargo"},
            "total_abono": {"$sum": "$abono"},
            "count": {"$sum": 1},
        }},
        # Totales del grupo + detalle diario (si se pidió)
        {"$group": {
            "_id": "$_id.group",
            "total_cargo": {"$sum": "$total_cargo"},
            "total_abono": {"$sum": "$total_abono"},
            "count": {"$sum": "$count"},
            "details": {"$push": {
                "fecha": "$_id.dia",
                "total_cargo": "$total_cargo",
                "total_abono": "$total_abono",
                "count": "$count",
            }},
        }},
        {"$project": {
            "_id": 0,
            by: "$_id",
            "total_cargo": 1,
            "total_abono": 1,
            "count": 1,
            "details": {"$cond": [{"$eq": [include_daily, True]}, "$details", []]},
        }},
        {"$sort": {by: 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 100000},
    ]

    result = list(COL_GASTOS.aggregate(pipeline))

    # Relleno de 'details' por fecha (si include_daily = True)
    if include_daily:
        date_end_inclusive = end - timedelta(days=1)
        for g in result:
            details = g.get("details", [])
            details_by_date = {d['fecha']: d for d in details}
            filled_details: List[Dict[str, Any]] = []
            date_cursor = start
            while date_cursor <= date_end_inclusive:
                fecha_str = date_cursor.strftime('%Y-%m-%d')
                if fecha_str in details_by_date:
                    filled_details.append(details_by_date[fecha_str])
                else:
                    filled_details.append({
                        'fecha': fecha_str,
                        'total_cargo': 0,
                        'total_abono': 0,
                        'count': 0,
                    })
                date_cursor += timedelta(days=1)
            g["details"] = filled_details

    return {"count": len(result), "gastos": result}
