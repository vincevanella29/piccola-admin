# routers/empleados.py
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Set

from fastapi import APIRouter, Depends, HTTPException, Query

from utils.auth.session import verify_session
from utils.web3mongo import db

# >>> NUEVO: helpers de permisos/sucursales alineados con admin_rankings
from config.roles.access_locals import (
    get_perms_from_user,
    validate_include_local_or_403,
    allowed_local_filter,
    derive_allowed_siglas_from_slugs,
    normalize_sucursal_to_sigla,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------
# Helpers de fechas / serialización
# ---------------------------
DATE_FIELDS = ["fechacreacion", "fechaingreso", "fechanacimiento", "fecharetiro"]

def normalize_date(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    try:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(str(v)[:10], fmt)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                pass
    except Exception:
        pass
    return str(v)

def serialize_worker(doc: dict) -> dict:
    if not doc:
        return doc
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    for f in DATE_FIELDS:
        if f in out:
            out[f] = normalize_date(out.get(f))
    return out


# ---------------------------
# 1) Trabajadores activos
# ---------------------------
@router.get("/trabajadores/activos", summary="Listado de trabajadores activos (filtrado por permisos de sucursal)")
async def get_trabajadores_activos(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal (SIGLA o slug)"),
    cargo: Optional[str] = Query(None, description="Filtrar por cargo exacto"),
    seccion: Optional[str] = Query(None, description="Filtrar por sección (derivada desde cargos_intranet)"),
    q: Optional[str] = Query(None, description="Buscar por nombre/apellidos"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(100, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Retorna trabajadores 'activos' con filtros por sucursal/cargo y permisos.
    - `sucursal` acepta SIGLA (p.ej. LFD) o slug (permalink); se normaliza a SIGLA.
    - Si no viene `sucursal`, se restringe a las sucursales permitidas del usuario.
    """
    # >>> Permisos por sesión
    perms = get_perms_from_user(user)

    # Validación cuando el caller fuerza una sucursal
    if sucursal:
        # acepta slug o sigla (valida por slug si corresponde)
        validate_include_local_or_403(perms, [sucursal])

    # allowed_slugs: None => full access; set() => sin acceso
    allowed_slugs = allowed_local_filter(perms)
    if not sucursal and allowed_slugs is not None and len(allowed_slugs) == 0:
        return {"count": 0, "trabajadores": []}

    # Normaliza la entrada a SIGLA (para query contra trabajadores_vpn)
    normalized_sigla = normalize_sucursal_to_sigla(sucursal) if sucursal else None
    # Si no viene sucursal, mapea slugs permitidos -> SIGLAs permitidas
    allowed_siglas = (
        derive_allowed_siglas_from_slugs(allowed_slugs)
        if (not normalized_sigla and allowed_slugs is not None)
        else set()
    )

    # Build filter base
    where: Dict[str, Any] = {
        "$or": [
            {"activo": 1},
            {"activo": True},
            {"activo": "1"},
            {"activo": {"$gt": 0}},
        ]
    }
    # Filtro por SIGLA explícita o por SIGLAs derivadas de permisos
    if normalized_sigla:
        where["sucursal"] = normalized_sigla
    elif allowed_slugs is not None:
        # Si allowed_slugs == set(), ya devolvimos vacío arriba. Aquí forzamos none-safe
        where["sucursal"] = {"$in": sorted(list(allowed_siglas)) if allowed_siglas else ["__NONE__"]}

    if cargo:
        where["cargo"] = cargo

    # Búsqueda simple por textos (mantiene activo truthy con OR)
    if q:
        regex = {"$regex": q, "$options": "i"}
        where["$or"] = [
            {"nombres": regex},
            {"apellidopaterno": regex},
            {"apellidomaterno": regex},
        ] + where["$or"]

    # Cálculo de períodos para payroll (igual que versión anterior)
    now = datetime.utcnow()
    currYM = now.year * 100 + now.month
    if now.month == 1:
        prev1YM = (now.year - 1) * 100 + 12
        prev2YM = (now.year - 1) * 100 + 11
    else:
        prev1YM = now.year * 100 + (now.month - 1)
        prev2YM = (now.year - 1) * 100 + 12 if now.month == 2 else now.year * 100 + (now.month - 2)

    pipeline = [
        {"$match": where},
        {"$sort": {"sucursal": 1, "cargo": 1, "apellidopaterno": 1, "nombres": 1}},
        {"$skip": skip},
        {"$limit": (limit if limit is not None else 10000)},
        {"$addFields": {
            "rut_str": {"$toString": "$rut"},
            "rut_num": {"$convert": {"input": "$rut", "to": "int", "onError": None, "onNull": None}}
        }},
        # Sección desde cargos_intranet
        {"$lookup": {
            "from": "cargos_intranet",
            "let": {"carg": {"$ifNull": ["$cargo", None]}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$cargo", "$$carg"]}}},
                {"$project": {"_id": 0, "seccion": 1}}
            ],
            "as": "_ci"
        }},
        {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$_ci.seccion", 0]}, None]}}},
        {"$project": {"_ci": 0}},
        *(([{"$match": {"seccion": seccion}}]) if seccion else []),

        # Payroll (igual que antes)
        {
            "$lookup": {
                "from": "pago_sueldos_intranet",
                "let": {
                    "rut_str": "$rut_str",
                    "rut_num": "$rut_num",
                    "currYM": currYM,
                    "prev1YM": prev1YM,
                    "prev2YM": prev2YM
                },
                "pipeline": [
                    {"$addFields": {
                        "_rut_any": {"$ifNull": ["$rut_del_trabajador", "$rut"]},
                        "_rut_str": {"$toString": {"$ifNull": ["$rut_del_trabajador", "$rut"]}},
                        "_rut_num": {"$convert": {"input": {"$ifNull": ["$rut_del_trabajador", "$rut"]}, "to": "int", "onError": None, "onNull": None}}
                    }},
                    {"$match": {"$expr": {"$or": [
                        {"$eq": ["$_rut_str", "$$rut_str"]},
                        {"$and": [{"$ne": ["$$rut_num", None]}, {"$eq": ["$_rut_num", "$$rut_num"]}]}
                    ]}}},
                    {"$addFields": {
                        "_periodo_raw": {"$ifNull": ["$periodo", {"$ifNull": ["$mesano", {"$ifNull": ["$mes_ano", {"$ifNull": ["$periodo_str", None]}]}]}]}
                    }},
                    {"$addFields": {
                        "_periodo_num": {
                            "$switch": {
                                "branches": [
                                    {"case": {"$in": [{"$type": "$_periodo_raw"}, ["int", "long"]]}, "then": "$_periodo_raw"},
                                    {"case": {"$eq": [{"$type": "$_periodo_raw"}, "string"]}, "then": {"$toInt": {"$substr": [{"$replaceOne": {"input": "$_periodo_raw", "find": "-", "replacement": ""}}, 0, 6]}}}
                                ],
                                "default": None
                            }
                        }
                    }},
                    {"$group": {
                        "_id": None,
                        "total_liquido": {"$sum": {"$ifNull": ["$sueldo_liquido_a_pago", 0]}},
                        "total_pagado": {"$sum": {"$ifNull": ["$remuneracion_total", 0]}},
                        "curr_liquido": {"$sum": {"$cond": [{"$eq": ["$_periodo_num", "$$currYM"]}, {"$ifNull": ["$sueldo_liquido_a_pago", 0]}, 0]}},
                        "curr_total":   {"$sum": {"$cond": [{"$eq": ["$_periodo_num", "$$currYM"]}, {"$ifNull": ["$remuneracion_total", 0]}, 0]}},
                        "prev1_liquido": {"$sum": {"$cond": [{"$eq": ["$_periodo_num", "$$prev1YM"]}, {"$ifNull": ["$sueldo_liquido_a_pago", 0]}, 0]}},
                        "prev1_total":   {"$sum": {"$cond": [{"$eq": ["$_periodo_num", "$$prev1YM"]}, {"$ifNull": ["$remuneracion_total", 0]}, 0]}},
                        "prev2_liquido": {"$sum": {"$cond": [{"$eq": ["$_periodo_num", "$$prev2YM"]}, {"$ifNull": ["$sueldo_liquido_a_pago", 0]}, 0]}},
                        "prev2_total":   {"$sum": {"$cond": [{"$eq": ["$_periodo_num", "$$prev2YM"]}, {"$ifNull": ["$remuneracion_total", 0]}, 0]}}
                    }},
                    {"$project": {
                        "_id": 0,
                        "totals": {"net": "$total_liquido", "total": "$total_pagado"},
                        "current": {"periodo": "$$currYM", "net": "$curr_liquido", "total": "$curr_total"},
                        "previous": {"periodo": "$$prev1YM", "net": "$prev1_liquido", "total": "$prev1_total"},
                        "anteprevious": {"$cond": [
                            {"$gt": ["$$prev2YM", 0]},
                            {"periodo": "$$prev2YM", "net": "$prev2_liquido", "total": "$prev2_total"},
                            {"periodo": None, "net": 0, "total": 0}
                        ]}
                    }}
                ],
                "as": "_payroll"
            }
        },
        {"$addFields": {"payroll": {"$ifNull": [{"$arrayElemAt": ["$_payroll", 0]}, {
            "totals": {"net": 0, "total": 0},
            "current": {"periodo": currYM, "net": 0, "total": 0},
            "previous": {"periodo": prev1YM, "net": 0, "total": 0},
            "anteprevious": {"periodo": prev2YM, "net": 0, "total": 0}
        }]}}},
        {"$project": {"_payroll": 0}}
    ]

    items = [serialize_worker(d) for d in db.trabajadores_vpn.aggregate(pipeline)]
    return {"count": len(items), "trabajadores": items}


# ---------------------------
# 2) Buscar trabajador por RUT (con permisos)
# ---------------------------
@router.get("/trabajadores/{rut}", summary="Buscar trabajador por RUT (filtrado por permisos)")
async def get_trabajador_por_rut(
    rut: str,
    user: dict = Depends(verify_session),
):
    perms = get_perms_from_user(user)
    allowed_slugs = allowed_local_filter(perms)
    # None => full; set() => sin acceso
    if allowed_slugs is not None and len(allowed_slugs) == 0:
        raise HTTPException(status_code=403, detail="Sin acceso a locales")

    or_terms = [{"rut": rut}]
    try:
        or_terms.append({"rut": int(rut)})
    except ValueError:
        pass

    doc = db.trabajadores_vpn.find_one({"$or": or_terms})
    if not doc:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # Si no hay full access, validar que la sucursal del trabajador esté en allowed
    if allowed_slugs is not None:
        # Trabajadores guardan SIGLA; mapeamos slugs permitidos -> SIGLAs
        allowed_siglas = derive_allowed_siglas_from_slugs(allowed_slugs)
        suc_sigla = (doc.get("sucursal") or "").strip()
        if suc_sigla not in allowed_siglas:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta sucursal")

    try:
        carg = (doc.get("cargo") or "").strip()
        if carg:
            ci = db.cargos_intranet.find_one({"cargo": carg}, {"_id": 0, "seccion": 1})
            if ci and ci.get("seccion"):
                doc["seccion"] = ci.get("seccion")
    except Exception:
        pass

    return serialize_worker(doc)


# ---------------------------
# 3) Asistencia diaria - listado (con permisos)
# ---------------------------
@router.get("/asistencia/diaria", summary="Listado de asistencia diaria (filtrado por permisos de sucursal)")
async def get_asistencia_diaria(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str]   = Query(None, description="YYYY-MM-DD"),
    rut: Optional[str]        = Query(None, description="RUT numérico o string"),
    id_sucursal: Optional[int] = Query(None, description="ID sucursal"),
    tipo_marca: Optional[str] = Query("L", description="Filtro por tipo_marca; por defecto 'L'"),
    sucursal_slug: Optional[str] = Query(None, description="Filtrar por sucursal usando permalink_slug (de sucursales_mtz)"),
    sucursal_activa: Optional[int] = Query(None, description="Filtrar por sucursal activa=1/inactiva=0 (de sucursales_mtz)"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(1000, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    perms = get_perms_from_user(user)

    if sucursal_slug:
        # Valida que el slug pedido esté dentro de los permisos del usuario
        validate_include_local_or_403(perms, [sucursal_slug])

    allowed_slugs = allowed_local_filter(perms)
    if not sucursal_slug and allowed_slugs is not None and len(allowed_slugs) == 0:
        return {"count": 0, "asistencia": []}

    # Fechas
    if start_date or end_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
            end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
        except ValueError:
            raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")
    else:
        start = end = None

    match: dict = {}
    if rut:
        or_terms = [{"rut": rut}]
        try:
            or_terms.append({"rut": int(rut)})
        except ValueError:
            pass
        match["$or"] = or_terms
    if id_sucursal is not None:
        match["id_sucursal"] = id_sucursal
    if tipo_marca:
        match["tipo_marca"] = tipo_marca

    pipeline = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_trabajada"}, "date"]},
                    "$fecha_trabajada",
                    {"$toDate": "$fecha_trabajada"}
                ]
            }
        }},
    ]
    if start or end:
        from datetime import timedelta as _td
        date_cond = {}
        if start: date_cond["$gte"] = start
        if end:   date_cond["$lt"] = end + _td(days=1)
        pipeline.append({"$match": {"fecha_norm": date_cond}})

    if match:
        pipeline.append({"$match": match})

    # Join sucursales y filtrar por permisos (slug)
    pipeline += [
        {"$lookup": {
            "from": "sucursales_mtz",
            "localField": "id_sucursal",
            "foreignField": "id",
            "as": "sucursal"
        }},
        {"$unwind": {"path": "$sucursal", "preserveNullAndEmptyArrays": True}},
    ]

    # Filtros por sucursal (slug explícito o set permitido)
    suc_match: Dict[str, Any] = {}
    if sucursal_slug:
        suc_match["sucursal.permalink_slug"] = sucursal_slug
    elif allowed_slugs is not None:
        suc_match["sucursal.permalink_slug"] = {"$in": sorted(list(allowed_slugs)) if allowed_slugs else ["__NONE__"]}
    if sucursal_activa is not None:
        suc_match["sucursal.activa"] = sucursal_activa
    if suc_match:
        pipeline.append({"$match": suc_match})

    pipeline += [
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            "sucursal._id": {"$cond": [
                {"$and": [{"$ne": ["$sucursal", None]}, {"$eq": [{"$type": "$sucursal._id"}, "objectId"]}]},
                {"$toString": "$sucursal._id"},
                "$sucursal._id"
            ]},
            "fecha_trabajada": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}},
        }},
        {"$project": {"fecha_norm": 0, "sucursal.location": 0}},
        {"$sort": {"fecha_trabajada": 1, "rut": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 1000},
    ]

    rows = list(db.asistencia_diaria_intranet.aggregate(pipeline))
    return {"count": len(rows), "asistencia": rows}


# ---------------------------
# 4) Asistencia diaria - resumen por sucursal (con permisos)
# ---------------------------
@router.get("/asistencia/diaria/por-sucursal", summary="Resumen de asistencia por sucursal y día (filtrado por permisos)")
async def get_asistencia_por_sucursal(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    rut: Optional[str] = Query(None, description="RUT numérico o string"),
    id_sucursal: Optional[int] = Query(None, description="ID sucursal"),
    tipo_marca: Optional[str] = Query("L"),
    sucursal_slug: Optional[str] = Query(None, description="Filtrar por sucursal (slug)"),
    sucursal_activa: Optional[int] = Query(None, description="Filtrar por sucursal activa"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    perms = get_perms_from_user(user)

    if sucursal_slug:
        validate_include_local_or_403(perms, [sucursal_slug])

    allowed_slugs = allowed_local_filter(perms)
    if not sucursal_slug and allowed_slugs is not None and len(allowed_slugs) == 0:
        return {"count": 0, "asistencia": []}

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")

    match: dict = {}
    if rut:
        or_terms = [{"rut": rut}]
        try:
            or_terms.append({"rut": int(rut)})
        except ValueError:
            pass
        match["$or"] = or_terms
    if id_sucursal is not None:
        match["id_sucursal"] = id_sucursal
    if tipo_marca:
        match["tipo_marca"] = tipo_marca

    from datetime import timedelta as _td
    pipeline = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_trabajada"}, "date"]},
                    "$fecha_trabajada",
                    {"$toDate": "$fecha_trabajada"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end + _td(days=1)}}},
    ]
    if match:
        pipeline.append({"$match": match})

    pipeline += [
        {"$lookup": {
            "from": "sucursales_mtz",
            "localField": "id_sucursal",
            "foreignField": "id",
            "as": "sucursal"
        }},
        {"$unwind": {"path": "$sucursal", "preserveNullAndEmptyArrays": True}},
    ]

    # Filtrado por slugs permitidos
    suc_match: Dict[str, Any] = {}
    if sucursal_slug:
        suc_match["sucursal.permalink_slug"] = sucursal_slug
    elif allowed_slugs is not None:
        suc_match["sucursal.permalink_slug"] = {"$in": sorted(list(allowed_slugs)) if allowed_slugs else ["__NONE__"]}
    if sucursal_activa is not None:
        suc_match["sucursal.activa"] = sucursal_activa
    if suc_match:
        pipeline.append({"$match": suc_match})

    # Mapeo dia_trabajado (igual que antes)
    dia_trabajado_expr = {
        "$switch": {
            "branches": [
                {"case": {"$eq": ["$tipo_movimiento", "AUS"]}, "then": 0},
                {"case": {"$eq": ["$tipo_movimiento", "HUE"]}, "then": 1},
                {"case": {"$eq": ["$tipo_movimiento", "LBR"]}, "then": 1},
                {"case": {"$eq": ["$tipo_movimiento", "LIC"]}, "then": 0},
                {"case": {"$eq": ["$tipo_movimiento", "NVI"]}, "then": 0},
                {"case": {"$eq": ["$tipo_movimiento", "PCG"]}, "then": 1},
                {"case": {"$eq": ["$tipo_movimiento", "PSG"]}, "then": 0},
                {"case": {"$eq": ["$tipo_movimiento", "PTE"]}, "then": 1},
                {"case": {"$eq": ["$tipo_movimiento", "VAC"]}, "then": 1},
            ],
            "default": 0,
        }
    }

    pipeline += [
        {"$addFields": {
            "dia": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}},
            "dia_trabajado": dia_trabajado_expr,
        }},
        {"$group": {
            "_id": {
                "id_sucursal": "$id_sucursal",
                "dia": "$dia",
                "sucursal_id": "$sucursal.id",
                "sucursal_nombre": "$sucursal.sucursal",
                "sucursal_slug": "$sucursal.permalink_slug",
                "sucursal_activa": "$sucursal.activa"
            },
            "total_registros": {"$sum": 1},
            "total_dias_trabajados": {"$sum": "$dia_trabajado"},
        }},
        {"$group": {
            "_id": {
                "id_sucursal": "$_id.sucursal_id",
                "nombre": "$_id.sucursal_nombre",
                "slug": "$_id.sucursal_slug",
                "activa": "$_id.sucursal_activa"
            },
            "details": {"$push": {"fecha": "$_id.dia", "total_registros": "$total_registros", "total_dias_trabajados": "$total_dias_trabajados"}},
            "total_registros": {"$sum": "$total_registros"},
            "total_dias_trabajados": {"$sum": "$total_dias_trabajados"},
        }},
        {"$project": {
            "_id": 0,
            "id_sucursal": "$_id.id_sucursal",
            "sucursal_nombre": "$_id.nombre",
            "sucursal_slug": "$_id.slug",
            "sucursal_activa": "$_id.activa",
            "total_registros": 1,
            "total_dias_trabajados": 1,
            "details": 1
        }},
        {"$sort": {"sucursal_nombre": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 100000},
    ]

    result = list(db.asistencia_diaria_intranet.aggregate(pipeline))

    # Relleno de días faltantes
    for g in result:
        details = g.get("details", [])
        by_date = {d["fecha"]: d for d in details}
        filled = []
        cur = start
        end_incl = end
        from datetime import timedelta as _td2
        while cur <= end_incl:
            ds = cur.strftime("%Y-%m-%d")
            filled.append(by_date.get(ds, {"fecha": ds, "total_registros": 0, "total_dias_trabajados": 0}))
            cur = cur + _td2(days=1)
        g["details"] = filled

    return {"count": len(result), "asistencia": result}
