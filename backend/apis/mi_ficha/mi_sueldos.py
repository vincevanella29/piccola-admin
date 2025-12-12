# routers/mi_sueldos.py

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from utils.web3mongo import db
from utils.auth.session import verify_session
from bson import ObjectId

router = APIRouter()
LINKS = db.empleados_usuarios

@router.get("/mi/sueldos", summary="Sueldos del empleado autenticado por periodo")
async def mi_sueldos(
    periodo_start: Optional[str] = Query(None, description="YYYYMM"),
    periodo_end: Optional[str] = Query(None, description="YYYYMM"),
    user: dict = Depends(verify_session),
):
    wallet = user.get("wallet")
    sub = user.get("sub")
    email = user.get("email")

    # Construir criterios solo con identidades realmente presentes para evitar
    # que {wallet: None} o {email: None} coincidan con otros empleados.
    identity_filters = []
    if wallet:
        identity_filters.append({"wallet": wallet})
    if sub:
        identity_filters.append({"sub": sub})
    if email:
        identity_filters.append({"email": email})

    if not identity_filters:
        raise HTTPException(status_code=401, detail="Sesión sin identidad válida (wallet/sub/email)")

    link = LINKS.find_one({"$or": identity_filters})
    if not link or not link.get("rut"):
        raise HTTPException(status_code=404, detail="No hay ficha vinculada a esta identidad")
    rut = str(link.get("rut"))

    match_rut = {"$or": [
        {"rut": rut},
        {"rut_del_trabajador": rut},
        *([{"rut": int(rut)}, {"rut_del_trabajador": int(rut)}] if rut.isdigit() else [])
    ]}

    periodo_filters = []
    if periodo_start or periodo_end:
        try:
            cond = {}
            if periodo_start:
                cond["$gte"] = int(periodo_start)
            if periodo_end:
                cond["$lte"] = int(periodo_end)
            periodo_filters.append({"$or": [
                {"periodo": cond},
                {"mesano": cond},
                {"mes_ano": cond},
                {"periodo_str": {"$gte": periodo_start, "$lte": periodo_end} if periodo_start and periodo_end else
                 {"$gte": periodo_start} if periodo_start else {"$lte": periodo_end}}
            ]})
        except ValueError:
            raise HTTPException(status_code=400, detail="Períodos deben ser YYYYMM")

    sueldos_match = {"$and": [match_rut] + periodo_filters} if periodo_filters else match_rut

    pipeline = [
        {"$match": sueldos_match},
        {"$addFields": {
            "_id": {"$toString": "$_id"},
            "_periodo_num": {
                "$switch": {
                    "branches": [
                        # periodo ya numérico (int/long)
                        {"case": {"$in": [{"$type": "$periodo"}, ["int", "long"]]}, "then": "$periodo"},
                        # periodo string ("YYYYMM" o "YYYY-MM")
                        {"case": {"$eq": [{"$type": "$periodo"}, "string"]}, "then": {"$toInt": {"$substr": [{"$replaceOne": {"input": "$periodo", "find": "-", "replacement": ""}}, 0, 6]}}},
                        {"case": {"$eq": [{"$type": "$mesano"}, "string"]}, "then": {"$toInt": {"$substr": [{"$replaceOne": {"input": "$mesano", "find": "-", "replacement": ""}}, 0, 6]}}},
                        {"case": {"$in": [{"$type": "$mesano"}, ["int", "long"]]}, "then": "$mesano"},
                        {"case": {"$eq": [{"$type": "$mes_ano"}, "string"]}, "then": {"$toInt": {"$substr": [{"$replaceOne": {"input": "$mes_ano", "find": "-", "replacement": ""}}, 0, 6]}}},
                        {"case": {"$in": [{"$type": "$mes_ano"}, ["int", "long"]]}, "then": "$mes_ano"},
                        {"case": {"$eq": [{"$type": "$periodo_str"}, "string"]}, "then": {"$toInt": {"$substr": [{"$replaceOne": {"input": "$periodo_str", "find": "-", "replacement": ""}}, 0, 6]}}}
                        ,{"case": {"$in": [{"$type": "$periodo_str"}, ["int", "long"]]}, "then": "$periodo_str"}
                    ],
                    "default": None
                }
            }
        }},
        {"$group": {
            "_id": "$_periodo_num",
            "periodo": {"$first": "$_periodo_num"},
            "items": {"$push": "$$ROOT"},
            "neto_total": {"$sum": {"$ifNull": ["$sueldo_liquido_a_pago", 0]}},
            "bruto_total": {"$sum": {"$ifNull": ["$remuneracion_total", 0]}}
        }},
        {"$sort": {"periodo": -1}},
        {"$project": {"_id": 0}}
    ]

    sueldos = list(db.pago_sueldos_intranet.aggregate(pipeline))
    return {"rut": rut, "sueldos_por_periodo": sueldos}

@router.get("/mi/ficha/liquidacion", summary="Detalle de liquidación del empleado autenticado")
async def mi_liquidacion(
    liquidation_id: Optional[str] = Query(None, description="ID de MongoDB de la liquidación"),
    id_talana_sueldo: Optional[int] = Query(None, description="ID de Talana del sueldo"),
    user: dict = Depends(verify_session),
):
    if not liquidation_id and id_talana_sueldo is None:
        raise HTTPException(status_code=400, detail="Debe proporcionar liquidation_id o id_talana_sueldo")

    wallet = user.get("wallet")
    link = LINKS.find_one({"$or": [
        {"wallet": wallet},
        {"sub": user.get("sub")},
        {"email": user.get("email")}
    ]})
    if not link or not link.get("rut"):
        raise HTTPException(status_code=404, detail="No hay ficha vinculada a esta identidad")
    rut = str(link.get("rut"))

    # Construir match por RUT (aceptando string/int y distintos nombres de campo)
    match_rut = {"$or": [
        {"rut": rut},
        {"rut_del_trabajador": rut},
        *([{"rut": int(rut)}, {"rut_del_trabajador": int(rut)}] if rut.isdigit() else [])
    ]}

    # Construir match por identificador de liquidación
    id_filters = []
    if liquidation_id:
        try:
            oid = ObjectId(liquidation_id)
            id_filters.append({"_id": oid})
        except Exception:
            # Si no es un ObjectId válido, no hay forma estándar de buscar por _id
            pass
    if id_talana_sueldo is not None:
        id_filters.append({"id_talana_sueldo": id_talana_sueldo})

    if not id_filters:
        # Si no pudimos construir ningún filtro válido
        raise HTTPException(status_code=400, detail="Parámetros inválidos para identificar liquidación")

    query = {"$and": [match_rut, {"$or": id_filters}]}
    doc = db.pago_sueldos_intranet.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")

    # Serializar _id
    if doc.get("_id"):
        doc["_id"] = str(doc["_id"])

    return {"rut": rut, "liquidacion": doc}