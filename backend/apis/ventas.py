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
@router.get("/ventas/available-dates")
async def get_ventas_available_dates():
    """
    Retorna min/max usando $toDate para soportar strings o Date.
    """
    base = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha"}, "date"]},
                    "$fecha",
                    {"$toDate": "$fecha"}
                ]
            }
        }},
        {"$project": {"fecha_norm": 1, "_id": 0}},
    ]

    min_doc = next(db.ventas_locales.aggregate(base + [{"$sort": {"fecha_norm": 1}}, {"$limit": 1}]), None)
    max_doc = next(db.ventas_locales.aggregate(base + [{"$sort": {"fecha_norm": -1}}, {"$limit": 1}]), None)

    def to_iso(d):
        return d.isoformat() if isinstance(d, datetime) else d

    return {
        "min_date": to_iso(min_doc["fecha_norm"]) if min_doc else None,
        "max_date": to_iso(max_doc["fecha_norm"]) if max_doc else None,
    }

# ---------------------------
# 2) LISTADO CRUD0
# ---------------------------
@router.get("/ventas", summary="Listado crudo de ventas (nivel 3 o 4)")
async def get_ventas(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    include_local: Optional[str] = Query(None, description="Filtrar SOLO estos locales (comma-separated)"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve ventas crudas dentro del rango [start_date, end_date] (por día, inclusivo).
    Sin lógica adicional. Fechas normalizadas a 'YYYY-MM-DD'. _id como string.
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver ventas")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # exclusivo
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    # Parse filter list (if any)
    include_local_list = []
    if include_local:
        include_local_list = [s.strip() for s in include_local.split(",") if s.strip()]

    pipeline = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha"}, "date"]},
                    "$fecha",
                    {"$toDate": "$fecha"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
    ]

    # Optional filter by local
    if include_local_list:
        pipeline += [
            {"$match": {"local": {"$in": include_local_list}}},
        ]

    pipeline += [
        # Normalizo salida: _id string, fecha YYYY-MM-DD
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            "fecha": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}
        }},
        {"$project": {"fecha_norm": 0}},
        {"$sort": {"fecha": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 10000},
    ]

    rows = list(db.ventas_locales.aggregate(pipeline))
    return {"count": len(rows), "ventas": rows}

# ---------------------------
# 3) SUMMARY (sin lógica “especial”)
# ---------------------------

@router.get("/ventas/summary", summary="Resumen por local (nivel 3 o 4)")
async def get_ventas_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    include_local: Optional[str] = Query(None, description="Filtrar SOLO estos locales (comma-separated)"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Resume por 'local' dentro del rango dado. Incluye 'details' normalizados
    (fecha como 'YYYY-MM-DD', _id string). Nada de alinear días de semana ni nada.
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver ventas")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # exclusivo
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    # Parse filter list (if any)
    include_local_list = []
    if include_local:
        include_local_list = [s.strip() for s in include_local.split(",") if s.strip()]

    pipeline = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha"}, "date"]},
                    "$fecha",
                    {"$toDate": "$fecha"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
    ]

    # Optional filter by local
    if include_local_list:
        pipeline += [
            {"$match": {"local": {"$in": include_local_list}}},
        ]

    pipeline += [
        {
            "$group": {
                "_id": "$local",
                "total_subtotal": {"$sum": "$subtotal"},
                "total": {"$sum": "$total"},
                "total_mesas": {"$sum": "$mesas"},
                "total_personas": {"$sum": "$personas"},
                "count": {"$sum": 1},
                "details": {"$push": "$$ROOT"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "local": "$_id",
                "total_subtotal": 1,
                "total": 1,
                "total_mesas": 1,
                "total_personas": 1,
                "count": 1,
                "details": {
                    "$map": {
                        "input": "$details",
                        "as": "d",
                        "in": {
                            "$mergeObjects": [
                                "$$d",
                                {
                                    "_id": {"$toString": "$$d._id"},
                                    "fecha": {
                                        "$dateToString": {
                                            "format": "%Y-%m-%d",
                                            "date": {
                                                "$cond": [
                                                    {"$eq": [{"$type": "$$d.fecha"}, "date"]},
                                                    "$$d.fecha",
                                                    {"$toDate": "$$d.fecha"}
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
        {"$sort": {"local": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 10000},
    ]

    result = list(db.ventas_locales.aggregate(pipeline))

    # Fill missing dates for each local
    for summary in result:
        # Build a mapping of fecha to detail
        details_by_date = {d['fecha']: d for d in summary['details']}
        # Get the range from the request
        date_cursor = start
        date_end = end - timedelta(days=1)  # inclusive
        filled_details = []
        while date_cursor <= date_end:
            fecha_str = date_cursor.strftime('%Y-%m-%d')
            if fecha_str in details_by_date:
                filled_details.append(details_by_date[fecha_str])
            else:
                # Fill with default values (0s and empty fields) y clima correspondiente
                clima = db.weather_daily.find_one({
                    'permalink_slug': summary['local'],
                    'date': datetime.strptime(fecha_str, '%Y-%m-%d')
                }, {'_id': 0})
                filled_details.append({
                    '_id': '',
                    'fecha': fecha_str,
                    'subtotal': 0,
                    'total': 0,
                    'mesas': 0,
                    'personas': 0,
                    'clima': clima,
                    # add any other expected fields with sensible defaults
                })
            date_cursor += timedelta(days=1)
        summary['details'] = filled_details

    # Attach weather info to each detail (by local/permalink_slug and fecha)
    for summary in result:
        for detail in summary['details']:
            if detail.get('clima') is None:
                clima = db.weather_daily.find_one({
                    'permalink_slug': summary['local'],
                    'date': datetime.strptime(detail['fecha'], '%Y-%m-%d')
                }, {'_id': 0})
                detail['clima'] = clima

    return {'count': len(result), 'ventas': result}

# ---------------------------
# 4) WEATHER DATA BY RANGE
# ---------------------------
@router.get("/clima", summary="Clima por rango de fechas y local/permalink_slug")
async def get_clima(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    permalink_slug: Optional[str] = Query(None, description="Filtrar por permalink_slug de local"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve clima diario por rango de fechas (y local opcional).
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver clima")

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # exclusivo
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    query = {
        "date": {"$gte": start, "$lt": end}
    }
    if permalink_slug:
        query["permalink_slug"] = permalink_slug

    rows = list(db.weather_daily.find(query, {"_id": 0}).skip(skip).limit(limit if limit is not None else 10000))
    # Build a mapping of date to row
    clima_by_date = {r['date'].strftime('%Y-%m-%d'): r for r in rows}
    # Fill missing dates
    date_cursor = start
    date_end = end - timedelta(days=1)  # inclusive
    filled_rows = []
    while date_cursor <= date_end:
        fecha_str = date_cursor.strftime('%Y-%m-%d')
        if fecha_str in clima_by_date:
            filled_rows.append(clima_by_date[fecha_str])
        else:
            filled_rows.append({
                'date': fecha_str,
                'permalink_slug': permalink_slug,
                # Add any other expected fields with None or 0
            })
        date_cursor += timedelta(days=1)
    return {'count': len(filled_rows), 'clima': filled_rows}

