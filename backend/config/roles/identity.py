# backend/config/roles/identity.py
import logging
from typing import Dict, Any
from fastapi import HTTPException

from utils.web3mongo import db

logger = logging.getLogger(__name__)

LINKS_COL = db.empleados_usuarios
TRAB_COL = db.trabajadores_vpn
CARGOS_COL = db.cargos_intranet


def get_employee_context(user: dict) -> dict:
    """
    Source of truth for resolving employee identity, checking active status,
    and retrieving basic profile fields.
    Replaces duplicated identity_filters logic across all /mi/ APIs.
    """
    wallet = user.get("wallet")
    sub = user.get("sub")
    email = user.get("email")

    identity_filters = []
    if wallet:
        identity_filters.append({"wallet": wallet.lower() if isinstance(wallet, str) else wallet})
    if sub:
        identity_filters.append({"sub": sub})
    if email:
        identity_filters.append({"email": email})

    if not identity_filters:
        raise HTTPException(status_code=401, detail="Sesión inválida: falta identidad (wallet/sub/email)")

    # 1) Resolver Link en empleados_usuarios
    link = LINKS_COL.find_one({"$or": identity_filters})
    if not link or not link.get("rut"):
        raise HTTPException(status_code=404, detail="No hay ficha de empleado vinculada a esta identidad")

    if link.get("status") == "deactivated":
        raise HTTPException(status_code=403, detail="El empleado se encuentra desactivado en el sistema")

    rut = link.get("rut")

    # 2) Buscar trabajador en trabajadores_vpn
    emp = None
    if rut is None:
        raise HTTPException(status_code=404, detail="No hay rut asociado")

    candidates = []
    if isinstance(rut, int):
        candidates.extend([{"rut": rut}, {"rut": str(rut)}])
    elif isinstance(rut, str):
        r_str = rut.strip()
        candidates.append({"rut": r_str})
        try:
            candidates.append({"rut": int(r_str)})
        except Exception:
            pass
    else:
        try:
            candidates.append({"rut": int(rut)})
        except Exception:
            pass
        candidates.append({"rut": str(rut)})

    for q in candidates:
        emp = TRAB_COL.find_one(q)
        if emp:
            break

    if not emp:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado en registros")

    if emp.get("activo") != 1:
        raise HTTPException(status_code=403, detail="El empleado no está marcado como activo en la empresa")

    # 3) Extraer datos
    cargo = (emp.get("cargo") or "").strip()
    
    seccion = emp.get("seccion") or emp.get("Seccion") or emp.get("sección") or emp.get("section") or ""
    if not str(seccion).strip() and cargo:
        ci = CARGOS_COL.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
        if not ci:
            ci = CARGOS_COL.find_one({"cargo": {"$regex": f"^{cargo}$", "$options": "i"}}, {"_id": 0, "seccion": 1})
        if ci and ci.get("seccion"):
            seccion = ci.get("seccion")

    sucursal = emp.get("sucursal") or emp.get("Sucursal") or ""

    if emp and emp.get("_id"):
        emp["_id"] = str(emp["_id"])

    return {
        "rut": str(rut),
        "wallet": link.get("wallet") or wallet,
        "email": link.get("email") or email,
        "sub": link.get("sub") or sub,
        "cargo": cargo,
        "seccion": str(seccion).strip(),
        "sucursal": sucursal,
        "profile": emp,
        "link": link
    }
