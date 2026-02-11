# backend/config/roles/access.py
from typing import Dict, Any, List, Optional, Tuple
import logging, os
from datetime import datetime
from bson import ObjectId
import time

from utils.web3mongo import db, w3
from config.roles.service import (
    get_company_role_level,
    verify_admin,
    verify_subadmin,
)

logger = logging.getLogger(__name__)
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# Colecciones
COL_LINKS = db.empleados_usuarios
COL_TRAB = db.trabajadores_vpn
COL_CARGOS = db.cargos_intranet
COL_REFS_SUC = db.gastos_refs_sucursales
COL_EMPRESAS = db.empresas
COL_EMPRESA_SUC = db.empresa_sucursales
COL_ROLE_LEVEL_SCOPES = db.role_level_scopes           # ⬅️ scopes por nivel de rol (3/4/5)
COL_POLICIES = db.cargo_access_policies

# Índice recomendado (1 doc por company_id + role_level)
COL_ROLE_LEVEL_SCOPES.create_index([("company_id", 1), ("role_level", 1)], unique=True)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _is_active_worker(link: Dict[str, Any]) -> bool:
    return (link or {}).get("status") == "active"


def _get_link_by_wallet(wallet: str) -> Optional[Dict[str, Any]]:
    return COL_LINKS.find_one({"wallet": wallet.lower()})


def _get_trab_by_rut(rut: Any) -> Optional[Dict[str, Any]]:
    """
    Lookup robusto: prueba rut como int y como string para evitar mismatch de tipos.
    """
    if rut is None:
        return None

    candidates: List[Dict[str, Any]] = []

    if isinstance(rut, int):
        candidates.append({"rut": rut})
        candidates.append({"rut": str(rut)})
    elif isinstance(rut, str):
        r = rut.strip()
        candidates.append({"rut": r})
        try:
            candidates.append({"rut": int(r)})
        except Exception:
            pass
    else:
        try:
            candidates.append({"rut": int(rut)})
        except Exception:
            pass
        candidates.append({"rut": str(rut)})

    for q in candidates:
        doc = COL_TRAB.find_one(q)
        if doc:
            return doc
    return None


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


def _list_all_empresa_ids() -> List[str]:
    return [str(doc["_id"]) for doc in COL_EMPRESAS.find({}, {"_id": 1})]


def _list_all_sucursal_ids() -> List[int]:
    return [
        int(doc["id_sucursal"])
        for doc in COL_REFS_SUC.find({}, {"_id": 0, "id_sucursal": 1})
        if doc.get("id_sucursal") is not None
    ]


def _empresas_for_sucursales(suc_ids: List[int]) -> List[str]:
    out: set[str] = set()
    if not suc_ids:
        return []
    for sid in suc_ids:
        m = COL_EMPRESA_SUC.find_one({"id_sucursal": int(sid)})
        if m and m.get("empresa_id"):
            out.add(str(m["empresa_id"]))
    return sorted(list(out))


def _policies_for(cargo: Optional[str], seccion: Optional[str]) -> List[Dict[str, Any]]:
    keys = []
    if cargo:
        keys.append({"type": "cargo", "key": (cargo or "").strip().lower()})
    if seccion:
        keys.append({"type": "seccion", "key": (seccion or "").strip().lower()})
    if not keys:
        return []
    return list(
        COL_POLICIES.find({"company_id": COMPANY_ID, "$or": keys})
    )


def _role_level_scopes(role_level: int, company_id: int) -> Dict[str, Any]:
    doc = COL_ROLE_LEVEL_SCOPES.find_one(
        {"company_id": int(company_id), "role_level": int(role_level)}
    ) or {}
    return {
        "allow_all_companies": bool(doc.get("allow_all_companies")),
        "allow_all_sucursales": bool(doc.get("allow_all_sucursales")),
        "empresa_ids": [str(x) for x in (doc.get("empresa_ids") or [])],
        "sucursal_ids": [int(x) for x in (doc.get("sucursal_ids") or [])],
    }


def compute_user_permissions(wallet: str) -> Dict[str, Any]:
    # 1) rol on-chain
    role_level = get_company_role_level(wallet)
    is_member = role_level in (3, 4, 5)

    # 2) link y ficha (para políticas por cargo/sección)
    link = _get_link_by_wallet(wallet)
    rut = (link or {}).get("rut")
    active_worker = _is_active_worker(link)
    trab = _get_trab_by_rut(rut) if rut is not None else None
    cargo, seccion = _get_cargo_seccion(trab)
    sucursal_sigla = (trab or {}).get("sucursal") or None
    own_id_sucursal = _sigla_to_id_sucursal(sucursal_sigla) if sucursal_sigla else None

    can_view_all_companies = False
    can_view_all_sucursales = False
    empresa_ids: set[str] = set()
    sucursal_ids: set[int] = set()

    # 3) acceso base por nivel (role-level-scopes)
    scopes = _role_level_scopes(role_level, COMPANY_ID)

    if role_level == 3:
        # Admin total; si no hay doc o hay "allow_all_*", ve todo
        if scopes["allow_all_companies"] or scopes["allow_all_sucursales"] or (
            not scopes["empresa_ids"] and not scopes["sucursal_ids"]
        ):
            can_view_all_companies = True
            can_view_all_sucursales = True
            empresa_ids = set(_list_all_empresa_ids())
            sucursal_ids = set(_list_all_sucursal_ids())
        else:
            if scopes["allow_all_companies"]:
                empresa_ids = set(_list_all_empresa_ids()); can_view_all_companies = True
            else:
                empresa_ids |= set(scopes["empresa_ids"])
            if scopes["allow_all_sucursales"]:
                sucursal_ids = set(_list_all_sucursal_ids()); can_view_all_sucursales = True
            else:
                sucursal_ids |= set(scopes["sucursal_ids"])

    elif role_level == 4:
        # Sub-admin: siempre por role_level_scopes
        if scopes["allow_all_companies"]:
            empresa_ids = set(_list_all_empresa_ids()); can_view_all_companies = True
        else:
            empresa_ids |= set(scopes["empresa_ids"])
        if scopes["allow_all_sucursales"]:
            sucursal_ids = set(_list_all_sucursal_ids()); can_view_all_sucursales = True
        else:
            sucursal_ids |= set(scopes["sucursal_ids"])

    else:
        # Tratar miembro base (5) **y no-miembro (-1)** con la misma lógica de policies por cargo/sección
        policies = _policies_for(cargo, seccion)

        pol_all_emp = any(bool(p.get("allow_all_companies")) for p in policies)
        pol_all_suc = any(bool(p.get("allow_all_sucursales")) for p in policies)
        # Considerar tanto allow_own_sucursal como own_sucursal_grants_all para marcar la sucursal propia
        pol_own_suc = any(bool(p.get("allow_own_sucursal") or p.get("own_sucursal_grants_all")) for p in policies)

        # Si la sucursal propia otorga "ALL"
        own_grants_all = False
        for p in policies:
            if not p.get("own_sucursal_grants_all"):
                continue
            ids = p.get("own_sucursal_ids_grant_all") or []
            if own_id_sucursal is None:
                continue
            if not ids or int(own_id_sucursal) in [int(x) for x in ids]:
                own_grants_all = True
                break

        if pol_all_emp:
            can_view_all_companies = True
        if pol_all_suc or own_grants_all:
            can_view_all_sucursales = True

        # allows directos
        for p in policies:
            for sid in (p.get("sucursal_ids_allow") or []):
                sucursal_ids.add(int(sid))
            for eid in (p.get("empresa_ids_allow") or []):
                empresa_ids.add(str(eid))

        # propia sucursal (si aplica)
        if pol_own_suc and own_id_sucursal is not None:
            sucursal_ids.add(int(own_id_sucursal))

        # expandir ALL por políticas
        if can_view_all_sucursales:
            sucursal_ids = set(_list_all_sucursal_ids())
        if can_view_all_companies:
            empresa_ids = set(_list_all_empresa_ids())

        # blocks por políticas
        if not can_view_all_sucursales or not can_view_all_companies:
            block_suc = set()
            block_emp = set()
            for p in policies:
                for sid in (p.get("sucursal_ids_block") or []):
                    block_suc.add(int(sid))
                for eid in (p.get("empresa_ids_block") or []):
                    block_emp.add(str(eid))
            sucursal_ids -= block_suc
            empresa_ids -= block_emp

        # derivar empresas desde sucursales
        empresa_ids |= set(_empresas_for_sucursales(list(sucursal_ids)))

        # overlay opcional desde role_level_scopes (para abrir/cerrar global nivel 5 / -1)
        if scopes["allow_all_sucursales"]:
            sucursal_ids = set(_list_all_sucursal_ids()); can_view_all_sucursales = True
        else:
            sucursal_ids |= set(scopes["sucursal_ids"])
        if scopes["allow_all_companies"]:
            empresa_ids = set(_list_all_empresa_ids()); can_view_all_companies = True
        else:
            empresa_ids |= set(scopes["empresa_ids"])

    # Determinar role_level OFFCHAIN sólo si NO es miembro on-chain (3/4/5):
    # - 6: tiene acceso backend efectivo (empresas/sucursales/can_view_all_*).
    # - 7: trabajador activo sin acceso backend (sin policies/resolución de acceso).
    if not is_member:
        has_backend_access = (
            bool(can_view_all_companies) or
            bool(can_view_all_sucursales) or
            bool(empresa_ids) or
            bool(sucursal_ids)
        )
        if has_backend_access:
            role_level = 6
        elif active_worker and rut is not None:
            role_level = 7

    # Resultado normalizado
    perms = {
        "company_id": COMPANY_ID,
        "role_level": role_level,
        "is_member": bool(is_member),
        "is_active_worker": bool(active_worker),
        "rut": rut,
        "cargo": cargo,
        "seccion": seccion,
        "own_id_sucursal": own_id_sucursal,
        "can_view_all_companies": can_view_all_companies,
        "can_view_all_sucursales": can_view_all_sucursales,
        "empresa_ids": sorted(list(empresa_ids)),
        "sucursal_ids": sorted(list(sucursal_ids)),
        "updated_at": _now_iso(),
    }
    return perms


def compute_user_permissions_by_sub(sub: str) -> Dict[str, Any]:
    """Permisos para empleados autenticados por sub (sin wallet obligatorio).

    Si el link tiene wallet, delega en compute_user_permissions(wallet).
    Si no tiene wallet, replica la rama de policies de compute_user_permissions
    asumiendo role_level = -1 (sin rol on-chain) pero con cargo/sección.
    """
    if not sub:
        return {
            "company_id": COMPANY_ID,
            "role_level": -1,
            "is_member": False,
            "is_active_worker": False,
            "rut": None,
            "cargo": None,
            "seccion": None,
            "own_id_sucursal": None,
            "can_view_all_companies": False,
            "can_view_all_sucursales": False,
            "empresa_ids": [],
            "sucursal_ids": [],
            "updated_at": _now_iso(),
        }

    link = COL_LINKS.find_one({"sub": sub}) or {}
    wallet = (link or {}).get("wallet")
    if wallet:
        # Si eventualmente se le asocia wallet, reutilizar lógica estándar
        return compute_user_permissions(wallet)

    # Sin wallet: usar rut/cargo/sección igual que la rama de policies
    rut = (link or {}).get("rut")
    active_worker = _is_active_worker(link)
    trab = _get_trab_by_rut(rut) if rut is not None else None
    cargo, seccion = _get_cargo_seccion(trab)
    sucursal_sigla = (trab or {}).get("sucursal") or None
    own_id_sucursal = _sigla_to_id_sucursal(sucursal_sigla) if sucursal_sigla else None

    role_level = -1
    is_member = False

    can_view_all_companies = False
    can_view_all_sucursales = False
    empresa_ids: set[str] = set()
    sucursal_ids: set[int] = set()

    # Igual que rama "else" (rol 5 o -1) de compute_user_permissions
    policies = _policies_for(cargo, seccion)

    pol_all_emp = any(bool(p.get("allow_all_companies")) for p in policies)
    pol_all_suc = any(bool(p.get("allow_all_sucursales")) for p in policies)
    # Considerar tanto allow_own_sucursal como own_sucursal_grants_all para marcar la sucursal propia
    pol_own_suc = any(bool(p.get("allow_own_sucursal") or p.get("own_sucursal_grants_all")) for p in policies)

    # Si la sucursal propia otorga "ALL"
    own_grants_all = False
    for p in policies:
        if not p.get("own_sucursal_grants_all"):
            continue
        ids = p.get("own_sucursal_ids_grant_all") or []
        if own_id_sucursal is None:
            continue
        if not ids or int(own_id_sucursal) in [int(x) for x in ids]:
            own_grants_all = True
            break

    if pol_all_emp:
        can_view_all_companies = True
    if pol_all_suc or own_grants_all:
        can_view_all_sucursales = True

    # allows directos
    for p in policies:
        for sid in (p.get("sucursal_ids_allow") or []):
            sucursal_ids.add(int(sid))
        for eid in (p.get("empresa_ids_allow") or []):
            empresa_ids.add(str(eid))

    # propia sucursal (si aplica)
    if pol_own_suc and own_id_sucursal is not None:
        sucursal_ids.add(int(own_id_sucursal))

    # expandir ALL por políticas
    if can_view_all_sucursales:
        sucursal_ids = set(_list_all_sucursal_ids())
    if can_view_all_companies:
        empresa_ids = set(_list_all_empresa_ids())

    # blocks por políticas
    if not can_view_all_sucursales or not can_view_all_companies:
        block_suc = set()
        block_emp = set()
        for p in policies:
            for sid in (p.get("sucursal_ids_block") or []):
                block_suc.add(int(sid))
            for eid in (p.get("empresa_ids_block") or []):
                block_emp.add(str(eid))
        sucursal_ids -= block_suc
        empresa_ids -= block_emp

    # derivar empresas desde sucursales
    empresa_ids |= set(_empresas_for_sucursales(list(sucursal_ids)))

    # Determinar role_level solo desde access/policies:
    # - 6: tiene acceso backend efectivo (empresas/sucursales/can_view_all_*).
    # - 7: trabajador activo sin acceso backend (sin policies).
    has_backend_access = (
        bool(can_view_all_companies) or
        bool(can_view_all_sucursales) or
        bool(empresa_ids) or
        bool(sucursal_ids)
    )
    if has_backend_access:
        role_level = 6
    elif active_worker and rut is not None:
        role_level = 7

    logger.info(
        "[access.compute_user_permissions_by_sub] sub=%s rut=%s active_worker=%s has_backend_access=%s role_level=%s",
        sub,
        rut,
        active_worker,
        has_backend_access,
        role_level,
    )

    perms = {
        "company_id": COMPANY_ID,
        "role_level": role_level,
        "is_member": bool(is_member),
        "is_active_worker": bool(active_worker),
        "rut": rut,
        "cargo": cargo,
        "seccion": seccion,
        "own_id_sucursal": own_id_sucursal,
        "can_view_all_companies": can_view_all_companies,
        "can_view_all_sucursales": can_view_all_sucursales,
        "empresa_ids": sorted(list(empresa_ids)),
        "sucursal_ids": sorted(list(sucursal_ids)),
        "updated_at": _now_iso(),
    }
    return perms


def compute_permissions_for_identity(identity: str) -> Dict[str, Any]:
    """Dada una identidad genérica (wallet o sub), escoge la estrategia correcta.

    - Si es una dirección válida de Ethereum -> compute_user_permissions(wallet)
    - Si parece un did de Privy (did:privy:...) -> compute_user_permissions_by_sub(sub)
    - En otros casos intenta primero como wallet y si falla, como sub.
    """
    if not identity:
        return {
            "company_id": COMPANY_ID,
            "role_level": -1,
            "is_member": False,
            "is_active_worker": False,
            "rut": None,
            "cargo": None,
            "seccion": None,
            "own_id_sucursal": None,
            "can_view_all_companies": False,
            "can_view_all_sucursales": False,
            "empresa_ids": [],
            "sucursal_ids": [],
            "updated_at": _now_iso(),
        }

    # Heurística simple: si es did:privy, tratar como sub
    if isinstance(identity, str) and identity.startswith("did:privy:"):
        return compute_user_permissions_by_sub(identity)

    # Intentar como dirección Ethereum
    try:
        if w3.is_address(identity):
            return compute_user_permissions(identity)
    except Exception:
        pass

    # Fallback: tratar como sub
    return compute_user_permissions_by_sub(identity)


# ---- Helpers de autorización por nivel de rol ----

def get_effective_role_level_from_user(user: Dict[str, Any]) -> Optional[int]:
    """Devuelve el role_level efectivo (1..7) desde el dict de sesión.

    - Usa siempre user["permissions"]["role_level"], que ya viene de
      compute_permissions_for_identity.
    - Si no está en rango 1..7 o no es convertible a int, devuelve None.
    """
    try:
        perms = (user or {}).get("permissions") or {}
        raw = perms.get("role_level")
        rl_int = int(raw) if raw is not None else None
    except Exception:
        rl_int = None
    if rl_int is None or not (1 <= rl_int <= 7):
        return None
    return rl_int


def require_admin_level(user: Dict[str, Any], role: str):
    from fastapi import HTTPException
    # Acepta tanto el dict de sesión como el string de wallet
    wallet = user.get("wallet") if isinstance(user, dict) else user
    if not wallet:
        raise HTTPException(status_code=401, detail="No session")

    # Use cached role if available and recent (within 1 hour)
    if isinstance(user, dict) and time.time() - user.get("last_verified", 0) <= 3600:
        level = user["role_level"]
    else:
        from config.roles.service import get_company_role_level
        level = get_company_role_level(wallet)
    logger.info(f"User: {wallet}")
    logger.info(f"Role level: {level}")

    # Mapa de roles permitidos
    if role == "admin":
        allowed = (3, 4)
        deny_msg = "Solo niveles 3 o 4"
    elif role == "subadmin":
        # Permite admin (3) y subadmin (4) para endpoints de panel
        allowed = (3, 4)
        deny_msg = "Solo niveles 3 o 4"
    elif role == "member":
        allowed = (3, 4, 5)
        deny_msg = "Solo niveles 3, 4 o 5"
    else:
        # Por defecto, cualquier miembro conocido
        allowed = (3, 4, 5)
        deny_msg = "Acceso denegado"

    if level not in allowed:
        raise HTTPException(status_code=403, detail=deny_msg)
    return level
