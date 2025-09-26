from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import logging
from bson import ObjectId
import os
from datetime import datetime

from utils.auth.session import verify_session
from utils.web3mongo import db, w3
from config.roles.access import (
    compute_user_permissions,  # Debe usar solo role-level-scopes + políticas (no wallet scopes)
    require_admin_level,
)

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# --- Collections
COL_REFS_SUC = db.gastos_refs_sucursales
COL_EMPRESAS = db.empresas
COL_EMPRESA_SUC = db.empresa_sucursales
COL_ROLE_LEVEL_SCOPES = db.role_level_scopes        # ⬅️ NUEVO: scopes por nivel de rol
COL_CARGOS = db.cargos_intranet
COL_POLICIES = db.cargo_access_policies

# --- Indexes
COL_ROLE_LEVEL_SCOPES.create_index([("company_id", 1), ("role_level", 1)], unique=True)
COL_REFS_SUC.create_index("id_sucursal", unique=True)
COL_POLICIES.create_index([("company_id", 1), ("type", 1), ("key", 1)], unique=True)

# -------------------- MODELOS --------------------
class RoleLevelScopeIn(BaseModel):
    role_level: int = Field(..., description="3, 4 o 5")
    allow_all_companies: bool = False
    allow_all_sucursales: bool = False
    empresa_ids: Optional[List[str]] = None   # ignorado si allow_all_companies = True
    sucursal_ids: Optional[List[int]] = None  # ignorado si allow_all_sucursales = True

class PolicyUpsert(BaseModel):
    type: Literal["cargo", "seccion"]
    key: str = Field(..., description="Valor exacto del cargo o de la sección (case-insensitive)")
    allow_all_companies: Optional[bool] = False
    allow_all_sucursales: Optional[bool] = False
    allow_own_sucursal: Optional[bool] = False
    empresa_ids_allow: Optional[List[str]] = None
    sucursal_ids_allow: Optional[List[int]] = None
    empresa_ids_block: Optional[List[str]] = None
    sucursal_ids_block: Optional[List[int]] = None
    active_required: Optional[bool] = True
    # ⬇️ NUEVO
    own_sucursal_grants_all: Optional[bool] = False
    own_sucursal_ids_grant_all: Optional[List[int]] = None

def _now_iso() -> str:
    return datetime.utcnow().isoformat()

# -------------------- HELPERS --------------------
def _validate_empresas(ids: Optional[List[str]]) -> List[str]:
    out = []
    for eid in ids or []:
        try:
            oid = ObjectId(eid)
        except Exception:
            raise HTTPException(status_code=400, detail=f"empresa_id inválido: {eid}")
        if not COL_EMPRESAS.find_one({"_id": oid}, {"_id": 1}):
            raise HTTPException(status_code=404, detail=f"Empresa no encontrada: {eid}")
        out.append(eid)
    # único + ordenado
    return sorted(list(set(out)))

def _validate_sucursales(ids: Optional[List[int]]) -> List[int]:
    out = []
    for sid in ids or []:
        ref = COL_REFS_SUC.find_one({"id_sucursal": int(sid)})
        if not ref:
            raise HTTPException(status_code=404, detail=f"Sucursal no encontrada: {sid}")
        out.append(int(sid))
    return sorted(list(set(out)))

def _build_allowed_payload(perms: Dict[str, Any]) -> Dict[str, Any]:
    """Construye el payload enriquecido de 'allowed' con metadatos de empresas y sucursales."""
    empresa_ids: List[str] = [str(e) for e in (perms.get("empresa_ids") or [])]
    sucursal_ids: List[int] = [int(s) for s in (perms.get("sucursal_ids") or [])]

    # Expandir a TODO si flags globales están activos
    if bool(perms.get("can_view_all_companies")):
        empresa_ids = [str(d["_id"]) for d in COL_EMPRESAS.find({}, {"_id": 1})]
    if bool(perms.get("can_view_all_sucursales")):
        sucursal_ids = [int(d["id_sucursal"]) for d in COL_REFS_SUC.find({}, {"_id": 0, "id_sucursal": 1}) if d.get("id_sucursal") is not None]

    # Empresas metadata
    emp_docs = []
    if empresa_ids:
        try:
            emp_oids = [ObjectId(eid) for eid in empresa_ids if ObjectId.is_valid(eid)]
            if emp_oids:
                emp_docs = []
                for d in COL_EMPRESAS.find({"_id": {"$in": emp_oids}}, {"_id": 1, "nombre": 1, "slug": 1, "sigla": 1}):
                    emp_docs.append({
                        "_id": str(d["_id"]),
                        "nombre": d.get("nombre"),
                        "slug": d.get("slug"),
                        # Compat: si no existe 'sigla' en el doc, usar 'slug' como sigla corta
                        "sigla": d.get("sigla") or d.get("slug"),
                    })
        except Exception:
            emp_docs = []

    # Sucursales metadata + empresa_id asociada (si existe)
    suc_meta = []
    if sucursal_ids:
        suc_refs = list(COL_REFS_SUC.find(
            {"id_sucursal": {"$in": sucursal_ids}}, {"_id": 0, "id_sucursal": 1, "sigla": 1, "nombre": 1, "mtz.sigla_local": 1, "location.permalink_slug": 1}
        ))
        # Mapear empresa_id y posibles metadatos extra desde empresa_sucursales
        for s in suc_refs:
            sid = int(s.get("id_sucursal"))
            m = COL_EMPRESA_SUC.find_one(
                {"id_sucursal": sid}, {"empresa_id": 1, "mtz.sigla_local": 1, "location.permalink_slug": 1}
            ) or {}
            suc_meta.append({
                "id_sucursal": sid,
                "sigla": s.get("sigla"),
                "nombre": s.get("nombre"),
                "empresa_id": (str(m.get("empresa_id")) if m.get("empresa_id") is not None else None),
                # Priorizar sigla_local/location_slug del mapping; si no, desde refs
                "sigla_local": ((m.get("mtz") or {}).get("sigla_local")) or s.get("mtz.sigla_local"),
                "location_slug": ((m.get("location") or {}).get("permalink_slug")) or s.get("location.permalink_slug"),
            })

    return {
        "empresa_ids": empresa_ids,
        "empresas": emp_docs,
        "sucursales_ids": sucursal_ids,
        "sucursales": suc_meta,
        "can_view_all_companies": bool(perms.get("can_view_all_companies")),
        "can_view_all_sucursales": bool(perms.get("can_view_all_sucursales")),
    }

# -------------------- PERMISSIONS --------------------
@router.get("/roles/scopes/my", summary="Ver mis permisos efectivos")
def get_my_permissions(user: Dict[str, Any] = Depends(verify_session)):
    if not user.get("wallet"):
        raise HTTPException(status_code=401, detail="No wallet in session")
    perms = compute_user_permissions(user["wallet"])
    allowed = _build_allowed_payload(perms)
    return {"permissions": perms, "allowed": allowed}

@router.get("/roles/scopes/wallet/{wallet}", summary="Ver permisos efectivos de un wallet (solo admin)")
def get_permissions_of_wallet(wallet: str, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    if not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    perms = compute_user_permissions(w3.to_checksum_address(wallet))
    allowed = _build_allowed_payload(perms)
    return {"permissions": perms, "allowed": allowed}

# -------------------- ROLE-LEVEL SCOPES (por nivel de rol) --------------------
@router.get("/roles/level-scopes/{role_level}", summary="Obtener configuración de visibilidad para un nivel de rol (3/4/5)")
def get_role_level_scope(role_level: int, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")  # niveles 3 o 4
    if role_level not in (3, 4, 5):
        raise HTTPException(status_code=400, detail="role_level debe ser 3/4/5")
    doc = COL_ROLE_LEVEL_SCOPES.find_one(
        {"company_id": COMPANY_ID, "role_level": int(role_level)},
        {"_id": 0}
    )
    return doc or {
        "company_id": COMPANY_ID,
        "role_level": int(role_level),
        "allow_all_companies": False,
        "allow_all_sucursales": False,
        "empresa_ids": [],
        "sucursal_ids": [],
    }

@router.post("/roles/level-scopes/save", summary="Guardar configuración de visibilidad para un nivel de rol (3/4/5)")
def save_role_level_scope(payload: RoleLevelScopeIn, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    rl = int(payload.role_level)
    if rl not in (3, 4, 5):
        raise HTTPException(status_code=400, detail="role_level debe ser 3/4/5")

    empresa_ids = [] if payload.allow_all_companies else _validate_empresas(payload.empresa_ids)
    sucursal_ids = [] if payload.allow_all_sucursales else _validate_sucursales(payload.sucursal_ids)

    data = {
        "company_id": COMPANY_ID,
        "role_level": rl,
        "allow_all_companies": bool(payload.allow_all_companies),
        "allow_all_sucursales": bool(payload.allow_all_sucursales),
        "empresa_ids": empresa_ids,
        "sucursal_ids": sucursal_ids,
        "updated_at": _now_iso(),
    }

    COL_ROLE_LEVEL_SCOPES.update_one(
        {"company_id": COMPANY_ID, "role_level": rl},
        {"$set": data, "$setOnInsert": {"created_at": _now_iso()}},
        upsert=True,
    )
    doc = COL_ROLE_LEVEL_SCOPES.find_one({"company_id": COMPANY_ID, "role_level": rl}, {"_id": 0})
    return {"ok": True, "scope": doc}

@router.post("/roles/level-scopes/clear/{role_level}", summary="Eliminar configuración de visibilidad para un nivel de rol (3/4/5)")
def clear_role_level_scope(role_level: int, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    if role_level not in (3, 4, 5):
        raise HTTPException(status_code=400, detail="role_level debe ser 3/4/5")
    COL_ROLE_LEVEL_SCOPES.delete_one({"company_id": COMPANY_ID, "role_level": int(role_level)})
    return {"ok": True}

# -------------------- POLÍTICAS (cargo/sección) --------------------
@router.get(
    "/roles/policies",
    summary="Listar políticas por cargo/sección (solo admin)"
)
def list_policies(
    type: Optional[str] = Query(None, pattern="^(cargo|seccion)$"),
    key: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_session),
):
    require_admin_level(user, "admin")
    where: Dict[str, Any] = {"company_id": COMPANY_ID}
    if type:
        where["type"] = type
    if key:
        where["key"] = key.strip().lower()
    items = list(COL_POLICIES.find(where).sort([("type", 1), ("key", 1)]))
    for it in items:
        it["_id"] = str(it["_id"])
    return {"items": items, "count": len(items)}

@router.post("/roles/policies/upsert", summary="Crear/actualizar política por cargo o sección (solo admin)")
def upsert_policy(req: PolicyUpsert, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    key = req.key.strip().lower()

    empresa_ids_allow = _validate_empresas(req.empresa_ids_allow)
    sucursal_ids_allow = _validate_sucursales(req.sucursal_ids_allow)
    empresa_ids_block = _validate_empresas(req.empresa_ids_block)
    sucursal_ids_block = _validate_sucursales(req.sucursal_ids_block)
    own_ids_all = _validate_sucursales(req.own_sucursal_ids_grant_all)

    doc = {
        "company_id": COMPANY_ID,
        "type": req.type,
        "key": key,
        "allow_all_companies": bool(req.allow_all_companies),
        "allow_all_sucursales": bool(req.allow_all_sucursales),
        "allow_own_sucursal": bool(req.allow_own_sucursal),
        "empresa_ids_allow": empresa_ids_allow,
        "sucursal_ids_allow": sucursal_ids_allow,
        "empresa_ids_block": empresa_ids_block,
        "sucursal_ids_block": sucursal_ids_block,
        "active_required": bool(req.active_required),
        # ⬇️ NUEVO
        "own_sucursal_grants_all": bool(req.own_sucursal_grants_all),
        "own_sucursal_ids_grant_all": own_ids_all,
        "updated_at": _now_iso(),
    }

    COL_POLICIES.update_one(
        {"company_id": COMPANY_ID, "type": req.type, "key": key},
        {"$set": doc, "$setOnInsert": {"created_at": _now_iso()}},
        upsert=True,
    )
    out = COL_POLICIES.find_one({"company_id": COMPANY_ID, "type": req.type, "key": key})
    out["_id"] = str(out["_id"])
    return {"ok": True, "policy": out}

@router.delete("/roles/policies/{policy_id}", summary="Eliminar política (solo admin)")
def delete_policy(policy_id: str, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    try:
        oid = ObjectId(policy_id)
    except Exception:
        raise HTTPException(status_code=400, detail="policy_id inválido")
    COL_POLICIES.delete_one({"_id": oid, "company_id": COMPANY_ID})
    return {"ok": True}

# -------------------- META para el front (selects) --------------------
@router.get("/roles/meta", summary="Opciones para UI de políticas (cargos, secciones, empresas, sucursales)")
def roles_meta(user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    # cargos/secciones únicos
    cargos = sorted({
        (doc.get("cargo") or "").strip()
        for doc in COL_CARGOS.find({}, {"_id": 0, "cargo": 1})
        if doc.get("cargo")
    })
    secciones = sorted({
        (doc.get("seccion") or "").strip()
        for doc in COL_CARGOS.find({"seccion": {"$exists": True, "$ne": None}}, {"_id": 0, "seccion": 1})
    })
    # sucursales y empresas
    suc = list(COL_REFS_SUC.find({}, {"_id": 0, "id_sucursal": 1, "sigla": 1, "nombre": 1}))
    emp = [
        {"_id": str(d["_id"]), "nombre": d.get("nombre"), "slug": d.get("slug")}
        for d in COL_EMPRESAS.find({}, {"_id": 1, "nombre": 1, "slug": 1})
    ]
    return {"cargos": cargos, "secciones": secciones, "sucursales": suc, "empresas": emp}
