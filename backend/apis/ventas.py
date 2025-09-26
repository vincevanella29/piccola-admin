# backend/api/ventas.py  (o el nombre que estés usando)
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query

from utils.auth.session import verify_session
from utils.web3mongo import db

# utils reusables
from config.roles.access_locals import (
    get_perms_from_user,
    validate_include_local_or_403,
    allowed_local_filter,
    parse_date_yyyymmdd,
)

router = APIRouter()
logger = logging.getLogger(__name__)

COL_VENTAS = db.ventas_locales
COL_WEATHER = db.weather_daily


# ---------------------------
# 1) FECHAS DISPONIBLES
# ---------------------------
@router.get("/ventas/available-dates")
async def get_ventas_available_dates():
    """
    Retorna min/max usando $toDate para soportar strings o Date.
    (No requiere sesión; es info global no sensible)
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

    min_doc = next(COL_VENTAS.aggregate(base + [{"$sort": {"fecha_norm": 1}}, {"$limit": 1}]), None)
    max_doc = next(COL_VENTAS.aggregate(base + [{"$sort": {"fecha_norm": -1}}, {"$limit": 1}]), None)

    def to_iso(d):
        return d.isoformat() if isinstance(d, datetime) else d

    return {
        "min_date": to_iso(min_doc["fecha_norm"]) if min_doc else None,
        "max_date": to_iso(max_doc["fecha_norm"]) if max_doc else None,
    }


# ---------------------------
# 2) LISTADO CRUDO (con permisos)
# ---------------------------
@router.get("/ventas", summary="Listado crudo de ventas (filtrado por permisos)")
async def get_ventas(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    include_local: Optional[str] = Query(None, description="Filtrar SOLO estos locales (comma-separated)"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve ventas crudas dentro del rango [start_date, end_date] (inclusive),
    asegurando que los locales consultados estén dentro de los permisos de la sesión.
    """
    perms = get_perms_from_user(user)
    start = parse_date_yyyymmdd(start_date)
    end   = parse_date_yyyymmdd(end_date) + timedelta(days=1)  # exclusivo

    include_local_list: List[str] = []
    if include_local:
        include_local_list = [s.strip() for s in include_local.split(",") if s.strip()]

    # 1) Si viene include_local => validar todo
    validate_include_local_or_403(perms, include_local_list)

    # 2) Pipeline base
    pipeline: List[Dict[str, Any]] = [
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

    # 3) Filtrar por locales
    if include_local_list:
        pipeline.append({"$match": {"local": {"$in": include_local_list}}})
    else:
        allowed_slugs = allowed_local_filter(perms)
        if allowed_slugs is not None:
            if not allowed_slugs:
                return {"count": 0, "ventas": []}
            pipeline.append({"$match": {"local": {"$in": list(allowed_slugs)}}})

    pipeline += [
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            "fecha": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}
        }},
        {"$project": {"fecha_norm": 0}},
        {"$sort": {"fecha": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 10000},
    ]

    rows = list(COL_VENTAS.aggregate(pipeline))
    return {"count": len(rows), "ventas": rows}


# ---------------------------
# 3) SUMMARY (con permisos)
# ---------------------------
@router.get("/ventas/summary", summary="Resumen por local (filtrado por permisos)")
async def get_ventas_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    include_local: Optional[str] = Query(None, description="Filtrar SOLO estos locales (comma-separated)"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Resume por 'local' dentro del rango dado, aplicando permisos:
      - Si se pasa include_local, se valida cada slug contra permisos.
      - Si no, se restringe automáticamente a los locales permitidos por la sesión.
    """
    perms = get_perms_from_user(user)
    start = parse_date_yyyymmdd(start_date)
    end   = parse_date_yyyymmdd(end_date) + timedelta(days=1)  # exclusivo

    include_local_list: List[str] = []
    if include_local:
        include_local_list = [s.strip() for s in include_local.split(",") if s.strip()]

    # 1) Validación de permisos sobre include_local
    validate_include_local_or_403(perms, include_local_list)

    # 2) Pipeline base
    pipeline: List[Dict[str, Any]] = [
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

    # 3) Filtro por locales (explícitos o permitidos)
    if include_local_list:
        pipeline.append({"$match": {"local": {"$in": include_local_list}}})
    else:
        allowed_slugs = allowed_local_filter(perms)
        if allowed_slugs is not None:
            if not allowed_slugs:
                return {"count": 0, "ventas": []}
            pipeline.append({"$match": {"local": {"$in": list(allowed_slugs)}}})

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

    result = list(COL_VENTAS.aggregate(pipeline))

    # 4) Completar días faltantes con ceros y clima (rango solicitado)
    date_end_inclusive = end - timedelta(days=1)
    for summary in result:
        details_by_date = {d['fecha']: d for d in summary['details']}
        date_cursor = start
        filled_details = []
        while date_cursor <= date_end_inclusive:
            fecha_str = date_cursor.strftime('%Y-%m-%d')
            if fecha_str in details_by_date:
                d = details_by_date[fecha_str]
            else:
                d = {
                    '_id': '',
                    'fecha': fecha_str,
                    'subtotal': 0,
                    'total': 0,
                    'mesas': 0,
                    'personas': 0,
                    'clima': None,
                }
            if d.get('clima') is None:
                clima = COL_WEATHER.find_one({
                    'permalink_slug': summary['local'],
                    'date': datetime.strptime(fecha_str, '%Y-%m-%d')
                }, {'_id': 0})
                d['clima'] = clima
            filled_details.append(d)
            date_cursor += timedelta(days=1)
        summary['details'] = filled_details

    return {'count': len(result), 'ventas': result}


# ---------------------------
# 4) WEATHER DATA BY RANGE (con permisos)
# ---------------------------
@router.get("/clima", summary="Clima por rango de fechas y local/permalink_slug (filtrado por permisos)")
async def get_clima(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    permalink_slug: Optional[str] = Query(None, description="Filtrar por permalink_slug de local"),
    skip: int       = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve clima diario por rango de fechas, aplicando permisos.
      - Si se pasa permalink_slug, se valida su acceso.
      - Si no se pasa, se restringe a los locales permitidos.
    """
    perms = get_perms_from_user(user)
    start = parse_date_yyyymmdd(start_date)
    end   = parse_date_yyyymmdd(end_date) + timedelta(days=1)  # exclusivo

    query: Dict[str, Any] = {
        "date": {"$gte": start, "$lt": end}
    }

    if permalink_slug:
        validate_include_local_or_403(perms, [permalink_slug])
        query["permalink_slug"] = permalink_slug
        rows = list(COL_WEATHER.find(query, {"_id": 0}).skip(skip).limit(limit if limit is not None else 10000))
    else:
        allowed_slugs = allowed_local_filter(perms)
        if allowed_slugs is not None:
            if not allowed_slugs:
                return {'count': 0, 'clima': []}
            query["permalink_slug"] = {"$in": list(allowed_slugs)}
        rows = list(COL_WEATHER.find(query, {"_id": 0}).skip(skip).limit(limit if limit is not None else 10000))

    # Normalizo salida y relleno (si es slug único)
    out: List[Dict[str, Any]] = []
    date_end_inclusive = end - timedelta(days=1)

    # key seguro si 'date' viene datetime o string
    def _date_key(v):
        return v.strftime('%Y-%m-%d') if isinstance(v, datetime) else str(v)

    clima_by_key = {(r['permalink_slug'], _date_key(r['date'])): r for r in rows}

    if permalink_slug:
        date_cursor = start
        while date_cursor <= date_end_inclusive:
            fecha_str = date_cursor.strftime('%Y-%m-%d')
            key = (permalink_slug, fecha_str)
            if key in clima_by_key:
                r = clima_by_key[key].copy()
                r["date"] = fecha_str
                out.append(r)
            else:
                out.append({
                    "date": fecha_str,
                    "permalink_slug": permalink_slug,
                })
            date_cursor += timedelta(days=1)
        return {'count': len(out), 'clima': out}

    # Si no viene slug, convertimos date a string en lo que haya
    for r in rows:
        if isinstance(r.get("date"), datetime):
            r = {**r, "date": r["date"].strftime('%Y-%m-%d')}
        out.append(r)

    return {'count': len(out), 'clima': out}
