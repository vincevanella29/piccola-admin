# backend/apis/admin/employee_users.py
"""Control de usuarios-empleados: listar y desactivar vínculos.

La desactivación es PERMANENTE:
- Mata todas las sesiones activas del wallet
- El vínculo wallet↔RUT queda muerto para siempre
- El RUT queda libre para re-registrarse con otra identidad
- NO existe reactivación — el empleado debe re-registrarse con biometría
"""

import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from utils.auth.session import verify_session
from utils.web3mongo import db, sessions_collection
from config.roles.service import get_company_role_level

router = APIRouter()
logger = logging.getLogger(__name__)

LINKS = db.empleados_usuarios
REG_SESSIONS = db.employee_registration_sessions


def _require_admin(user: dict):
    """Requiere role_level 3, 4 o 5 (Dominus / Centurio / Milites)."""
    level = user.get("role_level", -1)
    if level not in (3, 4, 5):
        wallet = user.get("wallet")
        if wallet:
            level = get_company_role_level(wallet)
        if level not in (3, 4, 5):
            raise HTTPException(status_code=403, detail="Se requiere nivel 3, 4 o 5 para esta operación")
    return level


# ---------------------------
# GET /admin/employee-users
# ---------------------------
@router.get("/admin/employee-users", summary="Listar vínculos empleado-usuario")
async def list_employee_users(
    status: Optional[str] = Query(None, description="Filtrar por status: active, deactivated"),
    q: Optional[str] = Query(None, description="Buscar por nombre, apellido o RUT"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user: dict = Depends(verify_session),
):
    _require_admin(user)

    # Pipeline base sobre empleados_usuarios
    match_stage: dict = {}
    if status:
        match_stage["status"] = status

    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})

    # Join con trabajadores_vpn para obtener nombre, cargo, sucursal, foto
    pipeline += [
        # Convertir rut a string para lookup robusto
        {"$addFields": {
            "rut_str": {"$toString": "$rut"},
            "rut_num": {"$convert": {"input": "$rut", "to": "int", "onError": None, "onNull": None}},
        }},
        # Lookup trabajadores_vpn usando OR (rut string o int)
        {"$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rut_str": "$rut_str", "rut_num": "$rut_num"},
            "pipeline": [
                {"$match": {"$expr": {"$or": [
                    {"$eq": [{"$toString": "$rut"}, "$$rut_str"]},
                    {"$and": [
                        {"$ne": ["$$rut_num", None]},
                        {"$eq": ["$rut", "$$rut_num"]},
                    ]},
                ]}}},
                {"$project": {
                    "_id": 0,
                    "nombres": 1,
                    "apellidopaterno": 1,
                    "apellidomaterno": 1,
                    "cargo": 1,
                    "sucursal": 1,
                    "profile_image_url": 1,
                    "foto_url": 1,
                }},
                {"$limit": 1},
            ],
            "as": "_vpn",
        }},
        {"$addFields": {
            "_vpn_doc": {"$arrayElemAt": ["$_vpn", 0]},
        }},
        # Flatten employee data
        {"$addFields": {
            "nombres": {"$ifNull": ["$_vpn_doc.nombres", None]},
            "apellidopaterno": {"$ifNull": ["$_vpn_doc.apellidopaterno", None]},
            "apellidomaterno": {"$ifNull": ["$_vpn_doc.apellidomaterno", None]},
            "cargo_vpn": {"$ifNull": ["$_vpn_doc.cargo", "$cargo"]},
            "sucursal": {"$ifNull": ["$_vpn_doc.sucursal", None]},
            "foto_url": {"$ifNull": [
                "$_vpn_doc.profile_image_url",
                {"$ifNull": ["$_vpn_doc.foto_url", None]},
            ]},
        }},
        {"$project": {"_vpn": 0, "_vpn_doc": 0}},
    ]

    # Filtro de búsqueda textual (aplicar después del join para buscar por nombres)
    if q:
        regex = {"$regex": q, "$options": "i"}
        pipeline.append({"$match": {"$or": [
            {"nombres": regex},
            {"apellidopaterno": regex},
            {"apellidomaterno": regex},
            {"rut": regex},
            {"rut_str": regex},
            {"email": regex},
        ]}})

    # Count total antes de paginar
    count_pipeline = pipeline + [{"$count": "total"}]

    # Paginar y ordenar
    pipeline += [
        {"$sort": {"linked_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        # Serializar _id
        {"$addFields": {"_id": {"$toString": "$_id"}}},
    ]

    try:
        # Count total
        count_result = list(LINKS.aggregate(count_pipeline))
        total = count_result[0]["total"] if count_result else 0

        items = list(LINKS.aggregate(pipeline))

        # Sanitize output
        for item in items:
            # Remove internal fields
            item.pop("rut_str", None)
            item.pop("rut_num", None)
            # Format dates
            for ts_field in ["linked_at", "created_at", "deactivated_at", "reactivated_at"]:
                val = item.get(ts_field)
                if isinstance(val, (int, float)) and val > 0:
                    item[ts_field] = val

        return {"total": total, "count": len(items), "users": items}
    except Exception as e:
        logger.error(f"Error listing employee users: {e}")
        raise HTTPException(status_code=500, detail=f"Error listando usuarios: {e}")


# ---------------------------
# POST /admin/employee-users/{rut}/deactivate
# ---------------------------
@router.post("/admin/employee-users/{rut}/deactivate", summary="Desactivar vínculo empleado-usuario (PERMANENTE)")
async def deactivate_employee_user(
    rut: str,
    user: dict = Depends(verify_session),
):
    _require_admin(user)

    rut = (rut or "").strip()
    if not rut:
        raise HTTPException(status_code=400, detail="RUT requerido")

    # Buscar el vínculo
    link = LINKS.find_one({"rut": rut})
    if not link:
        raise HTTPException(status_code=404, detail="Vínculo no encontrado para este RUT")

    if link.get("status") == "deactivated":
        raise HTTPException(status_code=409, detail="Este usuario ya está desactivado")

    now = int(time.time())
    admin_wallet = user.get("wallet", "unknown")
    target_wallet = link.get("wallet")

    # 1) Desactivar el vínculo (PERMANENTE)
    LINKS.update_one(
        {"_id": link["_id"]},
        {"$set": {
            "status": "deactivated",
            "deactivated_at": now,
            "deactivated_by": admin_wallet,
        }},
    )

    # 2) Invalidar sesiones de registro completadas para este RUT
    invalidated = REG_SESSIONS.update_many(
        {"rut": rut, "status": "completed"},
        {"$set": {"status": "invalidated", "invalidated_at": now, "invalidated_by": admin_wallet}},
    )

    # 3) 🔒 KILL ALL ACTIVE SESSIONS for this wallet — immediate lockout
    sessions_killed = 0
    if target_wallet:
        result = sessions_collection.delete_many({"wallet": target_wallet})
        sessions_killed = result.deleted_count

    logger.info(
        "Employee user PERMANENTLY deactivated: rut=%s wallet=%s by=%s "
        "sessions_invalidated=%d sessions_killed=%d",
        rut, target_wallet, admin_wallet,
        invalidated.modified_count, sessions_killed,
    )

    return {
        "ok": True,
        "rut": rut,
        "status": "deactivated",
        "sessions_invalidated": invalidated.modified_count,
        "sessions_killed": sessions_killed,
        "deactivated_at": now,
        "deactivated_by": admin_wallet,
        "permanent": True,
        "message": "Vínculo desactivado permanentemente. El RUT puede re-registrarse con nueva identidad.",
    }
