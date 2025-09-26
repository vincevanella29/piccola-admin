# backend/config/access_gastos.py
import logging
from datetime import datetime
from typing import Dict, Any, List, Set, Optional
from fastapi import HTTPException

from utils.web3mongo import db

logger = logging.getLogger(__name__)

COL_EMPRESAS = db.empresas


# ---------------------------
# Commons
# ---------------------------

def get_perms_from_user(user: dict) -> Dict[str, Any]:
    """
    Normaliza el objeto de permisos que viene desde verify_session.
    """
    perms = (user or {}).get("permissions") or {}
    perms.setdefault("can_view_all_companies", False)
    perms.setdefault("can_view_all_sucursales", False)
    perms.setdefault("empresa_ids", [])
    perms.setdefault("sucursal_ids", [])
    return perms


def parse_date_yyyymmdd(s: str) -> datetime:
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")


# ---------------------------
# Mapeos sucursales <-> empresa / siglas
# ---------------------------

def resolve_siglas_to_sucursales(siglas: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Devuelve un mapping:
      SIGLA -> [ { "id_sucursal": int, "empresa_id": str }, ... ]
    La comparación se hace en mayúsculas, usando empresas.sucursales.sigla.
    """
    if not siglas:
        return {}

    siglas_up = [s.upper() for s in siglas if isinstance(s, str) and s.strip()]
    if not siglas_up:
        return {}

    pipeline = [
        {"$unwind": "$sucursales"},
        {"$project": {
            "empresa_id": "$_id",
            "id_sucursal": "$sucursales.id_sucursal",
            "sigla_up": {"$toUpper": {"$ifNull": ["$sucursales.sigla", ""]}},
        }},
        {"$match": {"sigla_up": {"$in": siglas_up}}},
    ]

    out: Dict[str, List[Dict[str, Any]]] = {}
    for d in COL_EMPRESAS.aggregate(pipeline):
        e_id = str(d["empresa_id"])
        sid = d.get("id_sucursal")
        sig = d.get("sigla_up")
        if sid is None or not sig:
            continue
        out.setdefault(sig, []).append({
            "id_sucursal": int(sid),
            "empresa_id": e_id,
        })
    return out


def resolve_ids_to_empresas(sucursal_ids: List[int]) -> Dict[int, str]:
    """
    Retorna mapping id_sucursal -> empresa_id (string).
    """
    if not sucursal_ids:
        return {}

    pipeline = [
        {"$unwind": "$sucursales"},
        {"$match": {"sucursales.id_sucursal": {"$in": [int(x) for x in sucursal_ids]}}},
        {"$project": {
            "_id": 0,
            "empresa_id": "$_id",
            "id_sucursal": "$sucursales.id_sucursal",
        }},
    ]

    out: Dict[int, str] = {}
    for d in COL_EMPRESAS.aggregate(pipeline):
        sid = d.get("id_sucursal")
        eid = d.get("empresa_id")
        if sid is None or eid is None:
            continue
        out[int(sid)] = str(eid)
    return out


def siglas_for_sucursal_ids(sucursal_ids: List[int]) -> Set[str]:
    """
    Retorna set de SIGLAS (en mayúsculas) para los id_sucursal dados.
    """
    if not sucursal_ids:
        return set()

    pipeline = [
        {"$unwind": "$sucursales"},
        {"$match": {"sucursales.id_sucursal": {"$in": [int(x) for x in sucursal_ids]}}},
        {"$project": {
            "_id": 0,
            "sigla_up": {"$toUpper": {"$ifNull": ["$sucursales.sigla", ""]}},
        }},
    ]

    out: Set[str] = set()
    for d in COL_EMPRESAS.aggregate(pipeline):
        sig = (d.get("sigla_up") or "").strip()
        if sig:
            out.add(sig)
    return out


# ---------------------------
# Validaciones de permisos
# ---------------------------

def validate_include_sucursales_or_403(
    perms: Dict[str, Any],
    sucursal_ids: List[int],
    siglas: List[str],
) -> None:
    """
    Valida que todos los filtros de sucursales (ids y/o siglas) sean accesibles según permisos.
    Reglas:
      - OK si can_view_all_sucursales y can_view_all_companies.
      - Si no, cada id_sucursal debe pertenecer a perms["sucursal_ids"] y su empresa a perms["empresa_ids"].
      - Para siglas, se resuelve a (id_sucursal, empresa_id) y se aplican las mismas reglas.
    Si alguno no cumple => 403.
    """
    can_all_suc = bool(perms.get("can_view_all_sucursales"))
    can_all_emp = bool(perms.get("can_view_all_companies"))
    allowed_sids = set(int(x) for x in (perms.get("sucursal_ids") or []))
    allowed_eids = set(str(x) for x in (perms.get("empresa_ids") or []))

    # Acceso global total
    if can_all_suc and can_all_emp:
        return

    # 1) Validar ids directos
    if sucursal_ids:
        id_to_emp = resolve_ids_to_empresas(sucursal_ids)
        disallowed_ids: List[str] = []
        for sid in sucursal_ids:
            sid = int(sid)
            eid = id_to_emp.get(sid)
            suc_ok = can_all_suc or (sid in allowed_sids)
            emp_ok = can_all_emp or (eid in allowed_eids if eid is not None else False)
            if not (suc_ok and emp_ok):
                disallowed_ids.append(str(sid))
        if disallowed_ids:
            raise HTTPException(status_code=403, detail=f"No tienes acceso a las sucursales ids: {', '.join(disallowed_ids)}")

    # 2) Validar siglas
    if siglas:
        mapping = resolve_siglas_to_sucursales(siglas)
        not_found = [s for s in [s.upper() for s in siglas] if s.upper() not in mapping]
        if not_found:
            raise HTTPException(status_code=403, detail=f"Siglas inválidas o desconocidas: {', '.join(not_found)}")

        disallowed_siglas: List[str] = []
        for sig, pairs in mapping.items():
            ok = False
            for p in pairs:
                sid = int(p["id_sucursal"])
                eid = str(p["empresa_id"])
                suc_ok = can_all_suc or (sid in allowed_sids)
                emp_ok = can_all_emp or (eid in allowed_eids)
                if suc_ok and emp_ok:
                    ok = True
                    break
            if not ok:
                disallowed_siglas.append(sig)
        if disallowed_siglas:
            raise HTTPException(status_code=403, detail=f"No tienes acceso a las sucursales (siglas): {', '.join(disallowed_siglas)}")


def allowed_sucursales_filter(perms: Dict[str, Any]) -> Optional[Set[int]]:
    """
    Si el usuario NO tiene acceso global total, retorna set de id_sucursal permitidos.
    Si tiene acceso global, retorna None.
    Si no tiene acceso a ninguna, retorna set() (para vaciar resultados).
    """
    if perms.get("can_view_all_sucursales") and perms.get("can_view_all_companies"):
        return None
    suc_ids = [int(x) for x in (perms.get("sucursal_ids") or [])]
    return set(suc_ids) if suc_ids else set()
