import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from utils.auth.session import verify_session
from utils.web3mongo import db
from config.roles.service import verify_subadmin, verify_admin

router = APIRouter()
logger = logging.getLogger(__name__)


# Helpers
DATE_FIELDS = [
    "fechacreacion",
    "fechaingreso",
    "fechanacimiento",
    "fecharetiro",
]


def normalize_date(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    # If looks like a date string already, return as-is
    try:
        # Try parse common formats; if ok, re-format to ISO YYYY-MM-DD
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
    # _id to string
    if "_id" in out:
        out["_id"] = str(out["_id"])
    # Normalize date-ish fields
    for f in DATE_FIELDS:
        if f in out:
            out[f] = normalize_date(out.get(f))
    return out


# ---------------------------
# 1) Trabajadores activos
# ---------------------------
@router.get("/trabajadores/activos", summary="Listado de trabajadores activos (nivel 3 o 4)")
async def get_trabajadores_activos(
    sucursal: Optional[str] = Query(None, description="Filtrar por sucursal exacta"),
    cargo: Optional[str] = Query(None, description="Filtrar por cargo exacto"),
    seccion: Optional[str] = Query(None, description="Filtrar por sección (derivada desde cargos_intranet)"),
    q: Optional[str] = Query(None, description="Buscar por nombre/apellidos"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(100, ge=1, le=10000),
    user: dict = Depends(verify_session),
):
    """
    Retorna trabajadores con campo 'activo' en valores truthy (1, True, "1").
    Permite filtrar por sucursal, cargo, y búsqueda simple en nombres/apellidos.
    """
    if not verify_admin(user["wallet"]):
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver trabajadores")

    # Build filter
    where = {
        "$or": [
            {"activo": 1},
            {"activo": True},
            {"activo": "1"},
            {"activo": {"$gt": 0}},
        ]
    }
    if sucursal:
        where["sucursal"] = sucursal
    if cargo:
        where["cargo"] = cargo

    # Simple contains search across name fields
    if q:
        regex = {"$regex": q, "$options": "i"}
        where["$or"] = [
            {"nombres": regex},
            {"apellidopaterno": regex},
            {"apellidomaterno": regex},
        ] + where["$or"]  # keep activo truthy conditions too

    # Determinar meses objetivo: actual, anterior, ante-anterior en formato YYYYMM
    now = datetime.utcnow()
    currYM = now.year * 100 + now.month
    # mes anterior
    if now.month == 1:
        prev1YM = (now.year - 1) * 100 + 12
        prev2YM = (now.year - 1) * 100 + 11
    else:
        prev1YM = now.year * 100 + (now.month - 1)
        if now.month == 2:
            prev2YM = (now.year - 1) * 100 + 12
        else:
            prev2YM = now.year * 100 + (now.month - 2)

    # Usamos aggregate para unir sueldos por RUT y agregar KPIs
    pipeline = [
        {"$match": where},
        {"$sort": {"sucursal": 1, "cargo": 1, "apellidopaterno": 1, "nombres": 1}},
        {"$skip": skip},
        {"$limit": (limit if limit is not None else 10000)},
        {"$addFields": {
            "rut_str": {"$toString": "$rut"},
            "rut_num": {"$convert": {"input": "$rut", "to": "int", "onError": None, "onNull": None}}
        }},
        # Enrich seccion via cargos_intranet by cargo
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
        # Optional filter by seccion after enrichment
        *(([{"$match": {"seccion": seccion}}] ) if seccion else []),
        {
            "$lookup": {
                "from": "pago_sueldos_intranet",
                "let": {"rut_str": "$rut_str", "rut_num": "$rut_num", "currYM": currYM, "prev1YM": prev1YM, "prev2YM": prev2YM},
                "pipeline": [
                    {"$addFields": {
                        "_rut_any": {"$ifNull": ["$rut_del_trabajador", "$rut"]},
                        "_rut_str": {"$toString": {"$ifNull": ["$rut_del_trabajador", "$rut"]}},
                        "_rut_num": {"$convert": {"input": {"$ifNull": ["$rut_del_trabajador", "$rut"]}, "to": "int", "onError": None, "onNull": None}}
                    }},
                    {"$match": {"$expr": {"$or": [
                        {"$eq": ["$_rut_str", "$$rut_str"]},
                        {"$and": [
                            {"$ne": ["$$rut_num", None]},
                            {"$eq": ["$_rut_num", "$$rut_num"]}
                        ]}
                    ]}}},
                    {"$addFields": {
                        "_periodo_raw": {"$ifNull": [
                            "$periodo",
                            {"$ifNull": [
                                "$mesano",
                                {"$ifNull": [
                                    "$mes_ano",
                                    {"$ifNull": ["$periodo_str", None]}
                                ]}
                            ]}
                        ]}
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
                        "anteprevious": {"periodo": "$$prev2YM", "net": "$prev2_liquido", "total": "$prev2_total"}
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

    cur = db.trabajadores_vpn.aggregate(pipeline)
    items = [serialize_worker(d) for d in cur]
    return {"count": len(items), "trabajadores": items}


# ---------------------------
# 2) Buscar trabajador por RUT
# ---------------------------
@router.get("/trabajadores/{rut}", summary="Buscar un trabajador por RUT (nivel 3 o 4)")
async def get_trabajador_por_rut(
    rut: str,
    user: dict = Depends(verify_session),
):
    """
    Devuelve un trabajador por RUT. Acepta rut numérico o string.
    Intenta ambas representaciones al consultar MongoDB.
    """
    if not verify_admin(user["wallet"]):
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver trabajadores")

    or_terms = [{"rut": rut}]
    try:
        rut_num = int(rut)
        or_terms.append({"rut": rut_num})
    except ValueError:
        pass

    doc = db.trabajadores_vpn.find_one({"$or": or_terms})
    if not doc:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    # Enrich seccion by cargo
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
# 3) Asistencia diaria - listado
# ---------------------------
@router.get("/asistencia/diaria", summary="Listado de asistencia diaria por filtros (nivel 3 o 4)")
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
    """
    Devuelve registros desde `asistencia_diaria_intranet`.
    Filtros: rut, rango de fechas sobre `fecha_trabajada`, id_sucursal, tipo_marca.
    """
    if not verify_admin(user["wallet"]):
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver asistencia")

    match: dict = {}

    # Rango de fechas
    if start_date or end_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
            end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
            if end:
                # hacer exclusivo sumando 1 día en pipeline con $lt de siguiente día
                pass
        except ValueError:
            raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")
    else:
        start = end = None

    # Filtro por rut
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

    # Fecha match
    if start or end:
        date_cond = {}
        if start:
            date_cond["$gte"] = start
        if end:
            # exclusivo siguiente día
            from datetime import timedelta as _td
            date_cond["$lt"] = end + _td(days=1)
        pipeline.append({"$match": {"fecha_norm": date_cond}})

    if match:
        pipeline.append({"$match": match})

    # Enriquecer con trabajador (para obtener cargo) y mapear seccion via cargos_intranet
    pipeline += [
        {"$addFields": {
            "_rut_any": {"$ifNull": ["$rut", None]},
            "_rut_num": {"$convert": {"input": {"$ifNull": ["$rut", None]}, "to": "int", "onError": None, "onNull": None}},
        }},
        {"$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rut_str": {"$toString": "$_rut_any"}, "rut_num": "$_rut_num"},
            "pipeline": [
                {"$addFields": {"_rut_str": {"$toString": "$rut"}, "_rut_num": {"$convert": {"input": "$rut", "to": "int", "onError": None, "onNull": None}}}},
                {"$match": {"$expr": {"$or": [
                    {"$eq": ["$_rut_str", "$$rut_str"]},
                    {"$and": [
                        {"$ne": ["$$rut_num", None]},
                        {"$eq": ["$_rut_num", "$$rut_num"]}
                    ]}
                ]}}},
                {"$project": {"_id": 0, "cargo": 1}}
            ],
            "as": "_w"
        }},
        {"$addFields": {"cargo": {"$ifNull": [{"$arrayElemAt": ["$_w.cargo", 0]}, None]}}},
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
        {"$project": {"_w": 0, "_ci": 0}},
    ]

    # Join con sucursales_mtz para poder filtrar por sucursal y devolver detalles
    pipeline += [
        {"$lookup": {
            "from": "sucursales_mtz",
            "localField": "id_sucursal",
            "foreignField": "id",
            "as": "sucursal"
        }},
        {"$unwind": {"path": "$sucursal", "preserveNullAndEmptyArrays": True}},
    ]

    # Filtros por sucursal derivados de sucursales_mtz
    suc_match = {}
    if sucursal_slug:
        suc_match["sucursal.permalink_slug"] = sucursal_slug
    if sucursal_activa is not None:
        suc_match["sucursal.activa"] = sucursal_activa
    if suc_match:
        pipeline.append({"$match": suc_match})

    pipeline += [
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            # Convert nested ObjectId from lookup to string to make response JSON-serializable
            "sucursal._id": {"$cond": [
                {"$and": [
                    {"$ne": ["$sucursal", None]},
                    {"$eq": [{"$type": "$sucursal._id"}, "objectId"]}
                ]},
                {"$toString": "$sucursal._id"},
                "$sucursal._id"
            ]},
            "fecha_trabajada": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}},
        }},
        {"$project": {
            "fecha_norm": 0,
            "sucursal.location": 0  # omitir payload pesado si existe
        }},
        {"$sort": {"fecha_trabajada": 1, "rut": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 1000},
    ]

    rows = list(db.asistencia_diaria_intranet.aggregate(pipeline))
    return {"count": len(rows), "asistencia": rows}


# ---------------------------
# 4) Asistencia diaria - resumen por sucursal (con detalles por día)
# ---------------------------
@router.get("/asistencia/diaria/por-sucursal", summary="Resumen de asistencia por sucursal y día (nivel 3 o 4)")
async def get_asistencia_por_sucursal(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str   = Query(..., description="YYYY-MM-DD"),
    rut: Optional[str] = Query(None, description="RUT numérico o string"),
    id_sucursal: Optional[int] = Query(None, description="ID sucursal"),
    tipo_marca: Optional[str] = Query("L"),
    sucursal_slug: Optional[str] = Query(None, description="Filtrar por sucursal usando permalink_slug (de sucursales_mtz)"),
    sucursal_activa: Optional[int] = Query(None, description="Filtrar por sucursal activa=1/inactiva=0 (de sucursales_mtz)"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    user: dict = Depends(verify_session),
):
    if not verify_admin(user["wallet"]):
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver asistencia")

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

    # Join con sucursales_mtz para filtros y etiquetas
    pipeline += [
        {"$lookup": {
            "from": "sucursales_mtz",
            "localField": "id_sucursal",
            "foreignField": "id",
            "as": "sucursal"
        }},
        {"$unwind": {"path": "$sucursal", "preserveNullAndEmptyArrays": True}},
    ]

    suc_match = {}
    if sucursal_slug:
        suc_match["sucursal.permalink_slug"] = sucursal_slug
    if sucursal_activa is not None:
        suc_match["sucursal.activa"] = sucursal_activa
    if suc_match:
        pipeline.append({"$match": suc_match})

    # Mapear DiaTrabajado según tipo_movimiento (según la regla SQL)
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
            "_id": {"id_sucursal": "$id_sucursal", "dia": "$dia", "sucursal_id": "$sucursal.id", "sucursal_nombre": "$sucursal.sucursal", "sucursal_slug": "$sucursal.permalink_slug", "sucursal_activa": "$sucursal.activa"},
            "total_registros": {"$sum": 1},
            "total_dias_trabajados": {"$sum": "$dia_trabajado"},
        }},
        {"$group": {
            "_id": {"id_sucursal": "$_id.sucursal_id", "nombre": "$_id.sucursal_nombre", "slug": "$_id.sucursal_slug", "activa": "$_id.sucursal_activa"},
            "details": {"$push": {"fecha": "$_id.dia", "total_registros": "$total_registros", "total_dias_trabajados": "$total_dias_trabajados"}},
            "total_registros": {"$sum": "$total_registros"},
            "total_dias_trabajados": {"$sum": "$total_dias_trabajados"},
        }},
        {"$project": {"_id": 0, "id_sucursal": "$_id.id_sucursal", "sucursal_nombre": "$_id.nombre", "sucursal_slug": "$_id.slug", "sucursal_activa": "$_id.activa", "total_registros": 1, "total_dias_trabajados": 1, "details": 1}},
        {"$sort": {"sucursal_nombre": 1}},
        {"$skip": skip},
        {"$limit": limit if limit is not None else 100000},
    ]

    result = list(db.asistencia_diaria_intranet.aggregate(pipeline))

    # Rellenar fechas que falten en details para cada sucursal
    for g in result:
        details = g.get("details", [])
        by_date = {d["fecha"]: d for d in details}
        filled = []
        cur = start
        end_incl = end
        while cur <= end_incl:
            ds = cur.strftime("%Y-%m-%d")
            if ds in by_date:
                filled.append(by_date[ds])
            else:
                filled.append({"fecha": ds, "total_registros": 0, "total_dias_trabajados": 0})
            from datetime import timedelta as _td2
            cur = cur + _td2(days=1)
        g["details"] = filled

    return {"count": len(result), "asistencia": result}
