import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from main import verify_session
from utils.web3mongo import db
from apis.roles import get_company_role_level

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------
# 1) FECHAS DISPONIBLES
# ---------------------------
@router.get("/gastos/available-dates")
async def get_gastos_available_dates():
    """
    Retorna min/max usando $toDate sobre 'fecha_pago' (robusto a string o Date).
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

    min_doc = next(db.gastos_intranet.aggregate(base + [{"$sort": {"fecha_norm": 1}}, {"$limit": 1}]), None)
    max_doc = next(db.gastos_intranet.aggregate(base + [{"$sort": {"fecha_norm": -1}}, {"$limit": 1}]), None)

    def to_iso(d):
        return d.isoformat() if isinstance(d, datetime) else d

    return {
        "min_date": to_iso(min_doc["fecha_norm"]) if min_doc else None,
        "max_date": to_iso(max_doc["fecha_norm"]) if max_doc else None,
    }

# ---------------------------
# 2) LISTADO CRUD0
# ---------------------------
@router.get("/gastos", summary="Listado crudo de gastos (nivel 3 o 4)")
async def get_gastos(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve gastos crudos dentro del rango [start_date, end_date] (por día, inclusivo).
    Sin lógica adicional. 'fecha_pago' normalizada a 'YYYY-MM-DD'. _id como string.
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver gastos")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # exclusivo
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    pipeline = [
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
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            "fecha_pago": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}
        }},
        {"$project": {"fecha_norm": 0}},
        {"$sort": {"fecha_pago": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 100000},
    ]

    rows = list(db.gastos_intranet.aggregate(pipeline))
    return {"count": len(rows), "gastos": rows}

# ---------------------------
# 3) SUMMARY (por resumen2/resumen/tipo_gasto)
# ---------------------------

@router.get("/gastos/summary", summary="Resumen anidado (nivel 3 o 4)")
async def get_gastos_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    """
    Resume por resumen2 -> resumen -> tipo_gasto, con 'details' normalizados
    (fecha_pago 'YYYY-MM-DD', _id string). Sin lógica extra.
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver gastos")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # exclusivo
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    pipeline = [
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

    result = list(db.gastos_intranet.aggregate(pipeline))
    # Fill missing dates in nested details arrays
    for resumen2 in result:
        for resumen in resumen2.get('resumen_data', []):
            for tipo_gasto in resumen.get('tipo_gasto_data', []):
                # Build a mapping of fecha_pago to detail
                details = tipo_gasto.get('details', [])
                details_by_date = {d['fecha_pago']: d for d in details}
                date_cursor = start
                date_end = end - timedelta(days=1)
                filled_details = []
                while date_cursor <= date_end:
                    fecha_str = date_cursor.strftime('%Y-%m-%d')
                    if fecha_str in details_by_date:
                        filled_details.append(details_by_date[fecha_str])
                    else:
                        filled_details.append({
                            '_id': '',
                            'fecha_pago': fecha_str,
                            'cargo': 0,
                            'abono': 0,
                            # add any other expected fields with sensible defaults
                        })
                    date_cursor += timedelta(days=1)
                tipo_gasto['details'] = filled_details
    return {'count': len(result), 'gastos': result}

# ---------------------------
# 4) TOTALES POR CUENTA (rápido para widgets)
# ---------------------------

@router.get("/gastos/totals", summary="Totales por cuenta (agrupado por día) - rápido para widgets")
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
    Agrega por 'by' (default 'resumen2') y por día. Devuelve:
    [
      {
        resumen2|resumen|tipo_gasto|cuenta: "<grupo>",
        total_cargo, total_abono, count,
        details: [{ fecha: 'YYYY-MM-DD', total_cargo, total_abono, count }, ...]  # si include_daily
      },
      ...
    ]
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver gastos")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # exclusivo
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    # Parsear filtros por cuenta/resumen2/sucursal
    excl_list = []
    if exclude_cuentas:
        excl_list = [s.strip() for s in exclude_cuentas.split(",") if s.strip()]
    include_res2_list = []
    if include_resumen2:
        include_res2_list = [s.strip() for s in include_resumen2.split(",") if s.strip()]
    exclude_res2_list = []
    if exclude_resumen2:
        exclude_res2_list = [s.strip() for s in exclude_resumen2.split(",") if s.strip()]
    include_suc_ids = []
    if include_sucursales_ids:
        include_suc_ids = [int(s.strip()) for s in include_sucursales_ids.split(",") if s.strip()]
    include_siglas_list = []
    if include_siglas:
        include_siglas_list = [s.strip().upper() for s in include_siglas.split(",") if s.strip()]

    # Campos a proyectar
    group_field = f"${by}"

    pipeline = [
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

    # Filtro por resumen2 (inclusión primero, luego exclusión)
    if include_res2_list:
        pipeline += [
            {"$match": {"resumen2": {"$in": include_res2_list}}},
        ]
    if exclude_res2_list:
        pipeline += [
            {"$match": {"resumen2": {"$nin": exclude_res2_list}}},
        ]

    # Filtro por sucursales: por id_sucursal o por sigla (en mayúsculas)
    if include_suc_ids:
        pipeline += [
            {"$match": {"id_sucursal": {"$in": include_suc_ids}}},
        ]
    if include_siglas_list:
        pipeline += [
            {"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}},
            {"$match": {"_sigla_up": {"$in": include_siglas_list}}},
        ]

    if excl_list:
        # normalizamos 'cuenta' a string antes de filtrar
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

    result = list(db.gastos_intranet.aggregate(pipeline))

    # Ordenar y rellenar 'details' por fecha en Python (simple y seguro)
    if include_daily:
        for g in result:
            details = g.get("details", [])
            details_by_date = {d['fecha']: d for d in details}
            date_cursor = start
            date_end = end - timedelta(days=1)
            filled_details = []
            while date_cursor <= date_end:
                fecha_str = date_cursor.strftime('%Y-%m-%d')
                if fecha_str in details_by_date:
                    filled_details.append(details_by_date[fecha_str])
                else:
                    filled_details.append({
                        'fecha': fecha_str,
                        'total_cargo': 0,
                        'total_abono': 0,
                        'count': 0,
                        # add any other expected fields with sensible defaults
                    })
                date_cursor += timedelta(days=1)
            g["details"] = filled_details

    return {"count": len(result), "gastos": result}
