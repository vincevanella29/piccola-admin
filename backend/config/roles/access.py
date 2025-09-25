# backend/config/roles/access.py
import os
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from utils.web3mongo import db, w3
from config.roles.service import get_company_role_level  # use pure service to avoid cycles

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# --- Collections
COL_LINKS = db.empleados_usuarios
COL_TRAB = db.trabajadores_vpn
COL_CARGOS = db.cargos_intranet
COL_REFS_SUC = db.gastos_refs_sucursales
COL_EMPRESAS = db.empresas
COL_EMPRESA_SUC = db.empresa_sucursales
COL_ROLE_SCOPES = db.role_scopes

# Indexes idempotentes (seguros en import)
COL_ROLE_SCOPES.create_index([("wallet", 1), ("company_id", 1)], unique=True)
COL_LINKS.create_index("wallet")
COL_TRAB.create_index("rut")
COL_REFS_SUC.create_index("id_sucursal", unique=True)

def _now_iso() -> str:
    return datetime.utcnow().isoformat()

def _is_active_worker(link: Dict[str, Any]) -> bool:
    return (link or {}).get("status") == "active"

def _get_link_by_wallet(wallet: str) -> Optional[Dict[str, Any]]:
    return COL_LINKS.find_one({"wallet": wallet.lower()})

def _get_trab_by_rut(rut: Any) -> Optional[Dict[str, Any]]:
    return COL_TRAB.find_one({"rut": rut})

def _get_cargo_seccion(trab: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    cargo = (trab or {}).get("cargo")
    seccion = None
    if cargo:
        ci = COL_CARGOS.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
        if ci and ci.get("seccion"):
            seccion = ci["seccion"]
    return cargo, seccion

def _sigla_to_id_sucursal(sigla: str) -> Optional[int]:
    if not sigla:
        return None
    ref = COL_REFS_SUC.find_one({"sigla": sigla})
    return ref.get("id_sucursal") if ref else None

def _empresa_contains_sucursal(empresa_id: str, id_sucursal: int) -> bool:
    return COL_EMPRESA_SUC.find_one({"empresa_id": empresa_id, "id_sucursal": id_sucursal}) is not None

def _list_all_empresa_ids() -> List[str]:
    return [str(doc["_id"]) for doc in COL_EMPRESAS.find({}, {"_id": 1})]

def _list_all_sucursal_ids() -> List[int]:
    return [int(doc["id_sucursal"]) for doc in COL_REFS_SUC.find({}, {"_id": 0, "id_sucursal": 1}) if doc.get("id_sucursal") is not None]

def compute_user_permissions(wallet: str) -> Dict[str, Any]:
    role_level = get_company_role_level(wallet)
    is_member = role_level in (3, 4, 5)

    link = _get_link_by_wallet(wallet)
    rut = (link or {}).get("rut")
    active_worker = _is_active_worker(link)
    trab = _get_trab_by_rut(rut) if rut else None
    cargo, seccion = _get_cargo_seccion(trab)
    sucursal_sigla = (trab or {}).get("sucursal") or None
    own_id_sucursal = _sigla_to_id_sucursal(sucursal_sigla) if sucursal_sigla else None

    scope = COL_ROLE_SCOPES.find_one({"wallet": wallet.lower(), "company_id": COMPANY_ID}) or {}
    scope_empresas = [str(x) for x in (scope.get("empresa_ids") or [])]
    scope_sucursales = [int(x) for x in (scope.get("sucursal_ids") or [])]

    can_view_all_companies = False
    can_view_all_sucursales = False
    empresa_ids: List[str] = []
    sucursal_ids: List[int] = []

    if role_level in (3, 4):
        can_view_all_companies = True
        can_view_all_sucursales = True
        empresa_ids = _list_all_empresa_ids()
        sucursal_ids = _list_all_sucursal_ids()
    elif role_level == 5:
        sec = (seccion or "").lower().strip()
        car = (cargo or "").lower().strip()

        if "administracion" in sec or "gerencia" in sec:
            empresa_ids = _list_all_empresa_ids()
            sucursal_ids = _list_all_sucursal_ids()
        elif "admin" in car and "local" in car:
            if own_id_sucursal is not None:
                sucursal_ids = [own_id_sucursal]
                empresa_ids = [eid for eid in _list_all_empresa_ids() if _empresa_contains_sucursal(eid, own_id_sucursal)]

        if scope_empresas:
            empresa_ids = sorted(list(set(empresa_ids) | set(scope_empresas)))
        if scope_sucursales:
            sucursal_ids = sorted(list(set(sucursal_ids) | set(scope_sucursales)))
            if sucursal_ids:
                derivadas = []
                for sid in sucursal_ids:
                    m = COL_EMPRESA_SUC.find_one({"id_sucursal": sid})
                    if m and m.get("empresa_id"):
                        derivadas.append(str(m["empresa_id"]))
                empresa_ids = sorted(list(set(empresa_ids) | set(derivadas)))

    return {
        "company_id": COMPANY_ID,
        "role_level": role_level,
        "is_member": bool(is_member),
        "is_active_worker": bool(active_worker),
        "cargo": cargo,
        "seccion": seccion,
        "own_id_sucursal": own_id_sucursal,
        "can_view_all_companies": can_view_all_companies,
        "can_view_all_sucursales": can_view_all_sucursales,
        "empresa_ids": sorted(list(set(empresa_ids))),
        "sucursal_ids": sorted(list(set(sucursal_ids))),
        "updated_at": _now_iso(),
    }

# Helpers para endpoints
def require_company_member(user: Dict[str, Any]):
    if not user or not user.get("wallet"):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="No session")
    lvl = get_company_role_level(user["wallet"])
    if lvl == -1:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo miembros de la company pueden acceder")

def require_admin_level(user: Dict[str, Any]):
    from fastapi import HTTPException
    lvl = get_company_role_level(user.get("wallet"))
    if lvl not in (3, 4):
        raise HTTPException(status_code=403, detail="Solo niveles 3 o 4")

def require_access_to_sucursal(user: Dict[str, Any], id_sucursal: int):
    from fastapi import HTTPException
    perms = user.get("permissions") or {}
    if perms.get("can_view_all_sucursales"):
        return
    allowed = set(perms.get("sucursal_ids") or [])
    if id_sucursal not in allowed:
        raise HTTPException(status_code=403, detail=f"No autorizado para sucursal {id_sucursal}")

def filter_query_by_permissions(user: Dict[str, Any], base: Dict[str, Any], sucursal_field: str = "id_sucursal") -> Dict[str, Any]:
    perms = user.get("permissions") or {}
    if perms.get("can_view_all_sucursales"):
        return base
    allowed = list(set(perms.get("sucursal_ids") or []))
    if not allowed:
        return {"$and": [base, {sucursal_field: {"$in": [-999999]}}]}
    return {"$and": [base, {sucursal_field: {"$in": allowed}}]}
