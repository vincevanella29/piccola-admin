# routers/mi_ficha.py

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
from utils.web3mongo import db, w3
from utils.auth.session import verify_session
from config.gamification.service import user_profile_summary
import os

router = APIRouter()
LINKS = db.empleados_usuarios

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
    # Resolve wallet
    wallet = user.get("wallet") or request.headers.get("X-Wallet-Address")
    if not wallet:
        raise HTTPException(status_code=401, detail="Sesión inválida: falta wallet")

    # Resolve link
    link = LINKS.find_one({"$or": [
        {"wallet": wallet},
        {"sub": user.get("sub")},
        {"email": user.get("email")}
    ]})
    if not link:
        raise HTTPException(status_code=404, detail="No hay ficha vinculada a esta identidad")
    rut = str(link.get("rut"))
    if not rut:
        raise HTTPException(status_code=404, detail="Vínculo sin RUT")

    # Update link if missing fields
    updates = {}
    if wallet and not link.get("wallet"):
        updates["wallet"] = wallet
    if user.get("email") and not link.get("email"):
        updates["email"] = user.get("email")
    if user.get("sub") and not link.get("sub"):
        updates["sub"] = user.get("sub")
    if updates:
        LINKS.update_one({"_id": link.get("_id")}, {"$set": updates})

    # Get basic profile
    emp = get_employee_profile(rut)
    if not emp:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    profile = dict(emp)
    cargo = (profile.get("cargo") or "").strip() or None
    seccion = profile.get("seccion")
    if not seccion and cargo:
        ci = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
        if ci and ci.get("seccion"):
            profile["seccion"] = ci.get("seccion")

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