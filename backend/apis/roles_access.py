# backend/apis/roles_access.py
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
from bson import ObjectId
from utils.auth.session import verify_session  # <- NUEVO (rompe ciclo)
from utils.web3mongo import db, w3
import os
from datetime import datetime

# importa funciones puras desde config
from config.roles.access import (
    compute_user_permissions,
    require_admin_level,
)

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# --- Collections
COL_LINKS = db.empleados_usuarios                 # { rut, wallet, status, cargo, seccion, ... }
COL_TRAB = db.trabajadores_vpn                    # ficha por RUT
COL_CARGOS = db.cargos_intranet                   # { id_cargo, cargo, seccion }
COL_REFS_SUC = db.gastos_refs_sucursales          # { id_sucursal, sigla, ... }
COL_EMPRESAS = db.empresas                        # { _id, sucursales: [{id_sucursal, ...}], ... }
COL_EMPRESA_SUC = db.empresa_sucursales           # mapping id_sucursal -> empresa_id
COL_ROLE_SCOPES = db.role_scopes                  # NUEVO: ver abajo

# Indexes idempotentes
COL_ROLE_SCOPES.create_index([("wallet", 1), ("company_id", 1)], unique=True)
COL_LINKS.create_index("wallet")
COL_TRAB.create_index("rut")
COL_REFS_SUC.create_index("id_sucursal", unique=True)

# --- Modelos
class ScopeUpsert(BaseModel):
    wallet: str = Field(..., description="Wallet a la que asignamos el scope")
    role_level: Optional[int] = Field(None, description="Nivel explícito (si se quiere fijar/forzar). 3/4/5")
    empresa_ids: Optional[List[str]] = Field(default=None, description="Lista allowlist de empresas (ObjectId string). Vacío=None significa no tocar")
    sucursal_ids: Optional[List[int]] = Field(default=None, description="Lista allowlist de sucursales (IDs). Vacío=None significa no tocar")
    # (Opcional) blacklist futuro si lo requieres:
    # empresa_ids_block: Optional[List[str]] = None
    # sucursal_ids_block: Optional[List[int]] = None

class ScopeDoc(BaseModel):
    company_id: int
    wallet: str
    role_level: Optional[int] = None
    empresa_ids: List[str] = Field(default_factory=list)
    sucursal_ids: List[int] = Field(default_factory=list)
    updated_at: str

# --- Reglas base (negocio)
def _now_iso() -> str:
    return datetime.utcnow().isoformat()

def require_access_to_sucursal(user: Dict[str, Any], id_sucursal: int):
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
    # si no tiene nada permitido, forzamos vacío (match imposible)
    if not allowed:
        return {"$and": [base, {sucursal_field: {"$in": [-999999]}}]}
    return {"$and": [base, {sucursal_field: {"$in": allowed}}]}

# --- Endpoints de scopes

@router.get("/roles/scopes/my", summary="Ver mis permisos efectivos")
def get_my_permissions(user: Dict[str, Any] = Depends(verify_session)):
    if not user.get("wallet"):
        raise HTTPException(status_code=401, detail="No wallet in session")
    perms = compute_user_permissions(user["wallet"])
    return {"permissions": perms}

@router.get("/roles/scopes/{wallet}", summary="Ver permisos efectivos de un wallet (solo admin)")
def get_permissions_of_wallet(wallet: str, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user)
    if not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    perms = compute_user_permissions(w3.to_checksum_address(wallet))
    return {"permissions": perms}

@router.post("/roles/scopes/upsert", summary="Asignar/actualizar scopes (empresas/sucursales) a un wallet (solo admin)")
def upsert_scopes(req: ScopeUpsert, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user)
    if not w3.is_address(req.wallet):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    wallet = w3.to_checksum_address(req.wallet)

    doc = COL_ROLE_SCOPES.find_one({"wallet": wallet.lower(), "company_id": COMPANY_ID}) or {
        "wallet": wallet.lower(),
        "company_id": COMPANY_ID,
        "empresa_ids": [],
        "sucursal_ids": [],
        "created_at": _now_iso(),
    }

    if req.role_level is not None:
        if req.role_level not in (3, 4, 5):
            raise HTTPException(status_code=400, detail="role_level debe ser 3/4/5")
        doc["role_level"] = int(req.role_level)

    if req.empresa_ids is not None:
        # Validar que existan
        valid_ids = []
        for eid in req.empresa_ids:
            try:
                oid = ObjectId(eid)
            except Exception:
                raise HTTPException(status_code=400, detail=f"empresa_id inválido: {eid}")
            if not COL_EMPRESAS.find_one({"_id": oid}, {"_id": 1}):
                raise HTTPException(status_code=404, detail=f"Empresa no encontrada: {eid}")
            valid_ids.append(eid)
        doc["empresa_ids"] = sorted(list(set(valid_ids)))

    if req.sucursal_ids is not None:
        # Validar que existan refs
        for sid in req.sucursal_ids:
            if COL_REFS_SUC.find_one({"id_sucursal": int(sid)}) is None:
                raise HTTPException(status_code=404, detail=f"Sucursal no encontrada: {sid}")
        doc["sucursal_ids"] = sorted(list(set(int(x) for x in req.sucursal_ids)))

    doc["updated_at"] = _now_iso()
    COL_ROLE_SCOPES.update_one(
        {"wallet": wallet.lower(), "company_id": COMPANY_ID},
        {"$set": doc},
        upsert=True
    )
    # Devolvemos permisos efectivos ya resueltos con reglas
    return {"ok": True, "permissions": compute_user_permissions(wallet)}

@router.delete("/roles/scopes/{wallet}", summary="Eliminar scopes explícitos de un wallet (solo admin)")
def clear_scopes(wallet: str, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user)
    if not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    COL_ROLE_SCOPES.delete_one({"wallet": w3.to_checksum_address(wallet).lower(), "company_id": COMPANY_ID})
    return {"ok": True}
