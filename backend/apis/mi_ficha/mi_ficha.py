# routers/mi_ficha.py

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
from utils.web3mongo import db, w3
from utils.auth.session import verify_session
from config.gamification.service import user_profile_summary
from config.roles.identity import get_employee_context
import os

router = APIRouter()

def get_employee_profile(rut: str) -> Optional[dict]:
    or_terms = [{"rut": rut}]
    try:
        or_terms.append({"rut": int(rut)})
    except Exception:
        pass
    emp = db.trabajadores_vpn.find_one({"$or": or_terms})
    if emp and emp.get("_id"):
        emp["_id"] = str(emp["_id"])
    return emp

@router.get("/mi/ficha", summary="Perfil básico del empleado autenticado")
async def mi_ficha(
    request: Request = None,
    user: dict = Depends(verify_session),
):
    try:
        emp_data = get_employee_context(user)
    except HTTPException as e:
        return {
            "rut": None,
            "wallet": user.get("wallet") or request.headers.get("X-Wallet-Address"),
            "profile": None,
            "merit_profile": None,
            "linked": False,
            "message": e.detail,
        }

    rut = emp_data["rut"]
    wallet = emp_data["wallet"]
    profile = emp_data["profile"]
    
    # Update link if missing fields
    updates = {}
    if wallet and not emp_data["link"].get("wallet"):
        updates["wallet"] = wallet
    if user.get("email") and not emp_data["link"].get("email"):
        updates["email"] = user.get("email")
    if user.get("sub") and not emp_data["link"].get("sub"):
        updates["sub"] = user.get("sub")
    if updates:
        db.empleados_usuarios.update_one({"_id": emp_data["link"].get("_id")}, {"$set": updates})

    cargo = emp_data["cargo"] or None
    seccion = emp_data["seccion"] or None
    profile["seccion"] = seccion
    profile["cargo"] = cargo

    # Get merit profile
    merit_profile = None
    try:
        checksum_wallet = w3.to_checksum_address(wallet)
        merit_profile = user_profile_summary(checksum_wallet)
    except Exception as e:
        merit_profile = {"ok": False, "error": str(e)}

    return {
        "rut": rut,
        "wallet": wallet,
        "profile": profile,
        "merit_profile": merit_profile
    }