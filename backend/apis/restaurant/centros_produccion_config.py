# api/centros_produccion_config.py

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from bson import ObjectId
from datetime import datetime
import logging

from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Collections ---
COL_CP = db.centros_produccion                 # catálogo (nombre, slug, nombre_norm, etc.)
COL_CFG = db.centros_produccion_config         # NUEVO: configuración por centro
COL_CARGOS = db.cargos_intranet                # fuente de cargos/secciones

# --- Indexes (idempotentes) ---
COL_CFG.create_index([("centro_id", 1)], unique=True)
COL_CFG.create_index([("centro_slug", 1)], unique=True)
COL_CFG.create_index([("active", 1)])
# Para búsquedas/validaciones rápidas
COL_CARGOS.create_index([("id_cargo", 1)], unique=False)
COL_CARGOS.create_index([("seccion", 1)], unique=False)

# ----------------- Helpers -----------------
def _now_iso() -> str:
    return datetime.utcnow().isoformat()

def _normalize_seccion(s: str) -> str:
    # TRIM + colapsar espacios + minúsculas
    return " ".join((s or "").strip().split()).lower()

def _resolve_centro(id_or_slug: str) -> Dict[str, Any]:
    """
    Permite buscar el centro por _id (ObjectId hex) o por slug.
    Si no lo encuentra por slug, intenta por nombre_norm exacto (por compatibilidad).
    """
    doc = None
    if ObjectId.is_valid(id_or_slug):
        doc = COL_CP.find_one({"_id": ObjectId(id_or_slug)})
    if not doc:
        doc = COL_CP.find_one({"slug": id_or_slug}) or COL_CP.find_one({"nombre_norm": id_or_slug.upper()})
    if not doc:
        raise HTTPException(status_code=404, detail="Centro de producción no encontrado")
    return doc

def _validate_cargo_ids(ids: Optional[List[int]]) -> List[int]:
    ids = [int(x) for x in (ids or [])]
    if not ids:
        return []
    found = {int(d["id_cargo"]) for d in COL_CARGOS.find({"id_cargo": {"$in": ids}}, {"id_cargo": 1})}
    missing = sorted(set(ids) - found)
    if missing:
        raise HTTPException(status_code=400, detail=f"id_cargo inexistentes: {missing}")
    # normalizar/ordenar/únicos
    return sorted(list(found))

def _validate_secciones(secciones: Optional[List[str]]) -> List[str]:
    secs = [_normalize_seccion(s) for s in (secciones or []) if s and s.strip()]
    if not secs:
        return []
    # existen en cargos_intranet?
    valid = { _normalize_seccion(d["seccion"]) for d in COL_CARGOS.find(
        {"seccion": {"$in": list({s for s in secs})}}, {"seccion": 1}
    ) if d.get("seccion") }
    missing = sorted(set(secs) - valid)
    if missing:
        raise HTTPException(status_code=400, detail=f"Secciones inexistentes en cargos_intranet: {missing}")
    return sorted(list(valid))

def _expand_cargos(cargo_ids: List[int]) -> List[Dict[str, Any]]:
    if not cargo_ids:
        return []
    out = []
    for d in COL_CARGOS.find({"id_cargo": {"$in": cargo_ids}}, {"_id": 0, "id_cargo": 1, "cargo": 1, "seccion": 1, "id": 1}):
        out.append({
            "id_cargo": int(d.get("id_cargo")),
            "cargo": d.get("cargo"),
            "seccion": d.get("seccion"),
            "id": d.get("id"),  # por compat
        })
    # ordenar por seccion, luego cargo
    out.sort(key=lambda x: ( (x.get("seccion") or "").lower(), (x.get("cargo") or "").lower() ))
    return out

def _effective_cargo_ids(cfg: Dict[str, Any]) -> List[int]:
    """
    Calcula los cargos efectivos permitidos:
    - cargo_ids explícitos
    - + todos los cargos cuya seccion ∈ secciones configuradas
    """
    explicit = set(int(x) for x in (cfg.get("cargo_ids") or []))
    sec = set(cfg.get("secciones") or [])
    if sec:
        by_seccion = {
            int(d["id_cargo"]) for d in COL_CARGOS.find({"seccion": {"$in": list(sec)}}, {"id_cargo": 1})
            if d.get("id_cargo") is not None
        }
    else:
        by_seccion = set()
    return sorted(list(explicit | by_seccion))

def _serialize_config(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    eff = _effective_cargo_ids(doc)
    return {
        "_id": str(doc["_id"]),
        "centro_id": str(doc["centro_id"]),
        "centro_slug": doc.get("centro_slug"),
        "centro_nombre": doc.get("centro_nombre"),
        "active": bool(doc.get("active", True)),
        "cargo_ids": sorted([int(x) for x in (doc.get("cargo_ids") or [])]),
        "secciones": sorted(doc.get("secciones") or []),
        "effective_cargo_ids": eff,
        "effective_cargos": _expand_cargos(eff),
        "notes": doc.get("notes"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }

# ----------------- Schemas -----------------
class CentroConfigUpsert(BaseModel):
    cargo_ids: List[int] = Field(default_factory=list, description="IDs exactos de cargos (cargos_intranet.id_cargo)")
    secciones: List[str] = Field(default_factory=list, description="Secciones (case-insensitive, se normalizan)")
    active: bool = True
    notes: Optional[str] = None

    @validator("cargo_ids", pre=True, always=True)
    def _dedup_ids(cls, v):
        return sorted(list({int(x) for x in (v or [])}))

    @validator("secciones", pre=True, always=True)
    def _dedup_secs(cls, v):
        return sorted(list({ _normalize_seccion(s) for s in (v or []) if s and s.strip() }))

class CentroConfigPatch(BaseModel):
    cargo_ids: Optional[List[int]] = None
    secciones: Optional[List[str]] = None
    # si se envía, puede cambiar el flag activo
    active: Optional[bool] = None
    notes: Optional[str] = None

# ----------------- Endpoints -----------------

@router.get("/centros-produccion/meta", summary="Meta para UI: centros, cargos y secciones")
def centros_meta(user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    centros = [
        {"_id": str(d["_id"]), "nombre": d.get("nombre"), "slug": d.get("slug"), "activo": d.get("activo", True)}
        for d in COL_CP.find({}, {"nombre": 1, "slug": 1, "activo": 1})
    ]
    cargos = [
        {"id_cargo": int(d["id_cargo"]), "cargo": d.get("cargo"), "seccion": d.get("seccion")}
        for d in COL_CARGOS.find({}, {"_id": 0, "id_cargo": 1, "cargo": 1, "seccion": 1})
        if d.get("id_cargo") is not None
    ]
    # secciones únicas (ordenadas)
    secciones = sorted({
        _normalize_seccion(d["seccion"]) for d in COL_CARGOS.find(
            {"seccion": {"$exists": True, "$ne": None}}, {"_id": 0, "seccion": 1}
        )
        if d.get("seccion")
    })
    return {"centros": centros, "cargos": cargos, "secciones": secciones}

@router.get("/centros-produccion/config/list", summary="Listar todas las configuraciones por centro")
def list_all_configs(user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    docs = list(COL_CFG.find({}))
    return {"items": [_serialize_config(d) for d in docs], "count": len(docs)}

@router.get("/centros-produccion/{id_or_slug}/config", summary="Obtener configuración de un centro")
def get_centro_config(id_or_slug: str, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    centro = _resolve_centro(id_or_slug)
    cfg = COL_CFG.find_one({"centro_id": centro["_id"]})
    if not cfg:
        # Responder skeleton para el front
        return {
            "config": {
                "_id": None,
                "centro_id": str(centro["_id"]),
                "centro_slug": centro.get("slug"),
                "centro_nombre": centro.get("nombre"),
                "active": True,
                "cargo_ids": [],
                "secciones": [],
                "effective_cargo_ids": [],
                "effective_cargos": [],
                "notes": None,
                "created_at": None,
                "updated_at": None,
            }
        }
    return {"config": _serialize_config(cfg)}

@router.post("/centros-produccion/{id_or_slug}/config", summary="Upsert de configuración (reemplaza listas completas)")
def upsert_centro_config(
    id_or_slug: str,
    payload: CentroConfigUpsert,
    user: Dict[str, Any] = Depends(verify_session)
):
    require_admin_level(user, "admin")
    centro = _resolve_centro(id_or_slug)

    cargo_ids = _validate_cargo_ids(payload.cargo_ids)
    secciones = _validate_secciones(payload.secciones)

    doc = {
        "centro_id": centro["_id"],
        "centro_slug": centro.get("slug"),
        "centro_nombre": centro.get("nombre"),
        "active": bool(payload.active),
        "cargo_ids": cargo_ids,
        "secciones": secciones,
        "notes": payload.notes,
        "updated_at": _now_iso(),
    }
    COL_CFG.update_one(
        {"centro_id": centro["_id"]},
        {"$set": doc, "$setOnInsert": {"created_at": _now_iso()}},
        upsert=True
    )
    out = COL_CFG.find_one({"centro_id": centro["_id"]})
    return {"ok": True, "config": _serialize_config(out)}

@router.patch("/centros-produccion/{id_or_slug}/config/add", summary="Agregar cargos/secciones a la configuración")
def add_to_centro_config(
    id_or_slug: str,
    patch: CentroConfigPatch,
    user: Dict[str, Any] = Depends(verify_session)
):
    require_admin_level(user, "admin")
    centro = _resolve_centro(id_or_slug)
    cfg = COL_CFG.find_one({"centro_id": centro["_id"]})
    if not cfg:
        # crear base vacía si no existe
        cfg = {
            "centro_id": centro["_id"],
            "centro_slug": centro.get("slug"),
            "centro_nombre": centro.get("nombre"),
            "active": True,
            "cargo_ids": [],
            "secciones": [],
            "created_at": _now_iso(),
        }

    add_ids = _validate_cargo_ids(patch.cargo_ids or [])
    add_secs = _validate_secciones(patch.secciones or [])

    new_ids = sorted(list(set([int(x) for x in (cfg.get("cargo_ids") or [])] + add_ids)))
    new_secs = sorted(list(set((cfg.get("secciones") or []) + add_secs)))

    update = {
        "cargo_ids": new_ids,
        "secciones": new_secs,
        "updated_at": _now_iso(),
    }
    if patch.active is not None:
        update["active"] = bool(patch.active)
    if patch.notes is not None:
        update["notes"] = patch.notes

    COL_CFG.update_one(
        {"centro_id": centro["_id"]},
        {"$set": update, "$setOnInsert": {"centro_slug": cfg["centro_slug"], "centro_nombre": cfg["centro_nombre"], "created_at": cfg["created_at"]}},
        upsert=True
    )
    out = COL_CFG.find_one({"centro_id": centro["_id"]})
    return {"ok": True, "config": _serialize_config(out)}

@router.patch("/centros-produccion/{id_or_slug}/config/remove", summary="Quitar cargos/secciones de la configuración")
def remove_from_centro_config(
    id_or_slug: str,
    patch: CentroConfigPatch,
    user: Dict[str, Any] = Depends(verify_session)
):
    require_admin_level(user, "admin")
    centro = _resolve_centro(id_or_slug)
    cfg = COL_CFG.find_one({"centro_id": centro["_id"]})
    if not cfg:
        raise HTTPException(status_code=404, detail="Config no existe para este centro")

    rem_ids = set(_validate_cargo_ids(patch.cargo_ids or []))
    rem_secs = set(_validate_secciones(patch.secciones or []))

    cur_ids = [int(x) for x in (cfg.get("cargo_ids") or [])]
    cur_secs = list(cfg.get("secciones") or [])

    new_ids = sorted([x for x in cur_ids if x not in rem_ids])
    new_secs = sorted([s for s in cur_secs if s not in rem_secs])

    update = {
        "cargo_ids": new_ids,
        "secciones": new_secs,
        "updated_at": _now_iso(),
    }
    if patch.active is not None:
        update["active"] = bool(patch.active)
    if patch.notes is not None:
        update["notes"] = patch.notes

    COL_CFG.update_one({"centro_id": centro["_id"]}, {"$set": update})
    out = COL_CFG.find_one({"centro_id": centro["_id"]})
    return {"ok": True, "config": _serialize_config(out)}

@router.delete("/centros-produccion/{id_or_slug}/config", summary="Eliminar configuración de un centro")
def delete_centro_config(id_or_slug: str, user: Dict[str, Any] = Depends(verify_session)):
    require_admin_level(user, "admin")
    centro = _resolve_centro(id_or_slug)
    COL_CFG.delete_one({"centro_id": centro["_id"]})
    return {"ok": True}
