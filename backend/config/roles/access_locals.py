# backend/config/roles/access_locals.py
from __future__ import annotations
from typing import Dict, Any, List, Optional, Set
import logging

from fastapi import HTTPException
from utils.web3mongo import db

logger = logging.getLogger(__name__)

EMPRESAS_COLL = db.empresas


# ===================== Helpers de permisos (desde la sesión) =====================

def get_perms_from_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extrae el objeto de permisos normalizado desde verify_session().
    """
    perms = (user or {}).get("permissions") or {}
    # Normaliza algunos campos básicos por si no vienen:
    perms.setdefault("can_view_all_sucursales", False)
    perms.setdefault("can_view_all_companies", False)
    perms.setdefault("sucursal_ids", [])
    perms.setdefault("empresa_ids", [])
    return perms


# ===================== Helpers de mapeo Sucursal <-> Slug/Sigla =====================

def _int_set(xs: List[Any]) -> Set[int]:
    out: Set[int] = set()
    for x in (xs or []):
        try:
            out.add(int(x))
        except Exception:
            continue
    return out


def allowed_local_filter(perms: Dict[str, Any]) -> Optional[Set[str]]:
    """
    Devuelve:
      - None  → acceso a TODOS los locales (no filtrar en backend por sucursal)
      - set() → usuario sin acceso (devolver vacío)
      - set[str] (slugs) → conjunto de slugs permitidos (sigla_local o permalink_slug)
    Se construye a partir de los IDs de sucursal permitidos en 'perms'.
    """
    if not isinstance(perms, dict):
        return set()

    if perms.get("can_view_all_sucursales"):
        return None  # acceso total → sin filtro

    suc_ids = _int_set(perms.get("sucursal_ids") or [])
    own_id = perms.get("own_id_sucursal")
    if own_id is not None:
        try:
            suc_ids.add(int(own_id))
        except (ValueError, TypeError):
            pass

    if not suc_ids:
        # No tiene all_suc ni sucursales específicas → nada
        return set()

    slugs: Set[str] = set()
    try:
        cursor = EMPRESAS_COLL.aggregate([
            {"$unwind": "$sucursales"},
            {"$project": {
                "_id": 0,
                "id_sucursal": {"$ifNull": ["$sucursales.id_sucursal", None]},
                "sigla_local": {"$ifNull": ["$sucursales.mtz.sigla_local", None]},
                "permalink_slug": {"$ifNull": ["$sucursales.location.permalink_slug", None]},
            }},
            {"$match": {"id_sucursal": {"$in": list(suc_ids)}}},
            {"$project": {"sigla_local": 1, "permalink_slug": 1}}
        ])
        for d in cursor:
            # Prioriza permalink_slug; si no, sigla_local
            if d.get("permalink_slug"):
                slugs.add(str(d["permalink_slug"]))
            elif d.get("sigla_local"):
                slugs.add(str(d["sigla_local"]))
    except Exception as e:
        logger.error(f"[access_locals.allowed_local_filter] error consultando empresas: {e}")

    return slugs


def derive_allowed_siglas_from_slugs(slugs: Optional[Set[str]]) -> Set[str]:
    """
    Recibe slugs/permalinks (p. ej. MAILOC) y devuelve un set de SIGLAS válidas (p. ej. MAI).
    - Regla rápida: si termina en 'LOC', se corta el sufijo.
    - Regla por BD: busca en empresas.sucursales por permalink o sigla_local y toma 'sigla'.
    """
    siglas: Set[str] = set()
    if not slugs:
        return siglas

    base = {str(s or "").upper() for s in slugs if isinstance(s, str)}

    # Regla simple (…LOC → sigla)
    for s in base:
        if s.endswith("LOC") and len(s) > 3:
            siglas.add(s[:-3])

    # Validación/mapeo por BD
    try:
        cursor = EMPRESAS_COLL.aggregate([
            {"$unwind": "$sucursales"},
            {"$project": {
                "_id": 0,
                "sigla": {"$toUpper": {"$ifNull": ["$sucursales.sigla", ""]}},
                "sigla_local": {"$toUpper": {"$ifNull": ["$sucursales.mtz.sigla_local", ""]}},
                "permalink_slug": {"$toUpper": {"$ifNull": ["$sucursales.location.permalink_slug", ""]}},
            }},
            {"$match": {"$or": [
                {"permalink_slug": {"$in": list(base)}},
                {"sigla_local": {"$in": list(base)}},
            ]}},
            {"$project": {"sigla": 1}}
        ])
        for d in cursor:
            if d.get("sigla"):
                siglas.add(str(d["sigla"]).upper())
    except Exception as e:
        logger.error(f"[access_locals.derive_allowed_siglas_from_slugs] error: {e}")

    return siglas


def normalize_sucursal_to_sigla(s: Optional[str]) -> Optional[str]:
    """
    Normaliza un parámetro 'sucursal' que puede venir como slug (MAILOC) o sigla (MAI) a SIGLA.
    """
    if not s:
        return s
    v = str(s).upper().strip()
    if v.endswith("LOC") and len(v) > 3:
        return v[:-3]

    # Intento por BD (buscar por slug/sigla_local/sigla)
    try:
        doc = next(EMPRESAS_COLL.aggregate([
            {"$unwind": "$sucursales"},
            {"$project": {
                "_id": 0,
                "sigla": {"$toUpper": {"$ifNull": ["$sucursales.sigla", ""]}},
                "sigla_local": {"$toUpper": {"$ifNull": ["$sucursales.mtz.sigla_local", ""]}},
                "permalink_slug": {"$toUpper": {"$ifNull": ["$sucursales.location.permalink_slug", ""]}},
            }},
            {"$match": {"$or": [
                {"permalink_slug": v},
                {"sigla_local": v},
                {"sigla": v},
            ]}},
            {"$limit": 1}
        ]), None)
        if doc and doc.get("sigla"):
            return str(doc["sigla"]).upper()
    except Exception as e:
        logger.error(f"[access_locals.normalize_sucursal_to_sigla] error: {e}")

    # Si ya venía como sigla válida o no hay mapeo, devuelve tal cual
    return v


def _allowed_siglas_from_perms(perms: Dict[str, Any]) -> Optional[Set[str]]:
    """
    Similar a allowed_local_filter, pero devuelve SIGLAS (MAI, ALM, …) en vez de slugs.
    - None → acceso total
    - set() → sin acceso
    - set[str] → siglas permitidas
    """
    if perms.get("can_view_all_sucursales"):
        return None

    suc_ids = _int_set(perms.get("sucursal_ids") or [])
    own_id = perms.get("own_id_sucursal")
    if own_id is not None:
        try:
            suc_ids.add(int(own_id))
        except (ValueError, TypeError):
            pass

    if not suc_ids:
        return set()

    siglas: Set[str] = set()
    try:
        cursor = EMPRESAS_COLL.aggregate([
            {"$unwind": "$sucursales"},
            {"$project": {
                "_id": 0,
                "id_sucursal": {"$ifNull": ["$sucursales.id_sucursal", None]},
                "sigla": {"$toUpper": {"$ifNull": ["$sucursales.sigla", ""]}},
            }},
            {"$match": {"id_sucursal": {"$in": list(suc_ids)}}},
            {"$project": {"sigla": 1}}
        ])
        for d in cursor:
            if d.get("sigla"):
                siglas.add(str(d["sigla"]).upper())
    except Exception as e:
        logger.error(f"[access_locals._allowed_siglas_from_perms] error: {e}")

    return siglas


def validate_include_local_or_403(perms: Dict[str, Any], requested_locals: List[str]) -> None:
    """
    Valida que todos los locales solicitados en 'requested_locals' estén permitidos por los permisos.
    Acepta que vengan como slug (MAILOC) o sigla (MAI); normaliza a sigla para comparar.
    """
    if not requested_locals:
        return

    # Acceso total → OK
    if perms.get("can_view_all_sucursales"):
        return

    # Conjunto de siglas permitidas según permisos
    allowed_siglas = _allowed_siglas_from_perms(perms) or set()
    if allowed_siglas is None:
        return  # redundante, por si acaso

    # Normaliza cada parámetro solicitado a SIGLA y valida
    for s in requested_locals:
        sigla = normalize_sucursal_to_sigla(s)
        if not sigla or sigla.upper() not in allowed_siglas:
            raise HTTPException(status_code=403, detail="Sucursal no permitida para este usuario.")


# ===================== Fechas =====================

from datetime import datetime

def parse_date_yyyymmdd(s: str) -> datetime:
    """
    Convierte 'YYYY-MM-DD' a datetime. Si falla, lanza 400.
    """
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas deben ser en formato YYYY-MM-DD")
