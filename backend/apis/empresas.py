import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field
from bson import ObjectId

from utils.auth.session import verify_session
from utils.web3mongo import db
from config.roles.service import verify_admin

router = APIRouter()
logger = logging.getLogger(__name__)

# Collections
COL_EMPRESAS = db.empresas
COL_EMPRESA_SUCURSALES = db.empresa_sucursales  # mapping to enforce uniqueness
COL_REFS_SUCURSALES = db.gastos_refs_sucursales
COL_REFS_CUENTAS = db.gastos_refs_cuentas

# Ensure indexes (idempotent)
COL_EMPRESAS.create_index("slug", unique=True, sparse=True)
COL_EMPRESA_SUCURSALES.create_index("id_sucursal", unique=True)
COL_EMPRESA_SUCURSALES.create_index([("empresa_id", 1), ("id_sucursal", 1)], unique=True)


# --------- Schemas ---------
class EmpresaCreate(BaseModel):
    nombre: str
    slug: Optional[str] = Field(default=None, description="Identificador único opcional")
    descripcion: Optional[str] = None
    sucursales: Optional[List[int]] = Field(default=None, description="IDs de sucursales a asignar")
    cuentas_include: Optional[List[int]] = None
    cuentas_exclude: Optional[List[int]] = None
    resumen2_include: Optional[List[str]] = Field(default=None, description="Valores de resumen2 a incluir en cuentas")
    resumen2_exclude: Optional[List[str]] = Field(default=None, description="Valores de resumen2 a excluir de cuentas")


class EmpresaUpdateCuentas(BaseModel):
    cuentas: List[int] = Field(default_factory=list)


class EmpresaAssignSucursales(BaseModel):
    id_sucursales: List[int] = Field(default_factory=list)


class EmpresaUpdateByResumen2(BaseModel):
    resumen2: List[str] = Field(default_factory=list, description="Valores de resumen2 para incluir/excluir")


class EmpresaUpdate(BaseModel):
    nombre: Optional[str] = None
    slug: Optional[Optional[str]] = Field(default=None, description="Set or clear slug; send null to clear")
    descripcion: Optional[Optional[str]] = None
    sucursales: Optional[List[int]] = Field(default=None, description="Lista completa deseada de sucursales (reconciliar)")
    resumen2_include: Optional[List[str]] = None
    resumen2_exclude: Optional[List[str]] = None
    cuentas_include: Optional[List[int]] = None
    cuentas_exclude: Optional[List[int]] = None

# --------- Helpers ---------

def require_admin(user: Dict[str, Any]) -> None:
    if not verify_admin(user):
        raise HTTPException(status_code=403, detail="Solo usuarios nivel 3 o 4 pueden administrar empresas")


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _to_oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="empresa_id inválido")


def _sucursal_payload_from_refs(id_sucursal: int) -> Dict[str, Any]:
    ref = COL_REFS_SUCURSALES.find_one({"id_sucursal": id_sucursal})
    if not ref:
        raise HTTPException(status_code=404, detail=f"Sucursal {id_sucursal} no encontrada en refs")
    # Keep a stable, compact snapshot for embedding
    payload = {
        "id_sucursal": id_sucursal,
        "sigla": ref.get("sigla"),
        "mtz": ref.get("mtz", {}),
        "location": ref.get("location", {}),
        "assigned_at": _now_iso(),
    }
    return payload


# --------- Endpoints ---------

@router.post("/empresas", summary="Crear empresa y asignar sucursales/cuentas opcionales")
async def create_empresa(
    req: EmpresaCreate = Body(...),
    user: dict = Depends(verify_session),
):
    require_admin(user)

    # Build cuentas include/exclude starting from explicit ids
    cuentas_include_set = set(req.cuentas_include or [])
    cuentas_exclude_set = set(req.cuentas_exclude or [])

    # If resumen2 include/exclude provided, derive account ids from refs
    if req.resumen2_include:
        for doc in COL_REFS_CUENTAS.find({"resumen2": {"$in": req.resumen2_include}}, {"_id": 0, "cuenta": 1}):
            cid = doc.get("cuenta")
            if cid is not None:
                cuentas_include_set.add(cid)
    if req.resumen2_exclude:
        for doc in COL_REFS_CUENTAS.find({"resumen2": {"$in": req.resumen2_exclude}}, {"_id": 0, "cuenta": 1}):
            cid = doc.get("cuenta")
            if cid is not None:
                cuentas_exclude_set.add(cid)

    # Exclude wins over include
    cuentas_include_set.difference_update(cuentas_exclude_set)

    # If sucursales were provided, preflight check that none are already assigned
    if req.sucursales:
        existing = list(COL_EMPRESA_SUCURSALES.find(
            {"id_sucursal": {"$in": req.sucursales}},
            {"_id": 0, "id_sucursal": 1, "empresa_id": 1}
        ))
        if existing:
            conflict_ids = sorted({int(e.get("id_sucursal")) for e in existing if e.get("id_sucursal") is not None})
            # Provide structured detail so frontend can show conflicts cleanly
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Una o más sucursales ya están asignadas a otra empresa",
                    "conflicts": conflict_ids,
                },
            )

    # Basic empresa doc
    empresa = {
        "nombre": req.nombre,
        "slug": req.slug,
        "descripcion": req.descripcion,
        "cuentas_include": sorted(list(cuentas_include_set)),
        "cuentas_exclude": sorted(list(cuentas_exclude_set)),
        "resumen2_include": req.resumen2_include or [],
        "resumen2_exclude": req.resumen2_exclude or [],
        "sucursales": [],  # embed snapshot for quick reads
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    # Insert empresa
    try:
        ins = COL_EMPRESAS.insert_one(empresa)
    except Exception as e:
        logger.exception("Error creando empresa")
        raise HTTPException(status_code=400, detail=str(e))

    empresa_id = str(ins.inserted_id)

    # Assign sucursales if provided, enforcing uniqueness via mapping collection
    if req.sucursales:
        assigned = []
        for sid in req.sucursales:
            # This will raise if already assigned (unique index)
            try:
                COL_EMPRESA_SUCURSALES.insert_one({
                    "empresa_id": empresa_id,
                    "id_sucursal": sid,
                    "assigned_at": _now_iso(),
                })
            except Exception as e:
                # If duplicate, abort and rollback partial assigns for cleanliness
                logger.warning("Sucursal %s ya asignada: %s", sid, e)
                # Clean mapping just created for this empresa
                COL_EMPRESA_SUCURSALES.delete_many({"empresa_id": empresa_id})
                # And delete empresa base doc
                COL_EMPRESAS.delete_one({"_id": ins.inserted_id})
                raise HTTPException(status_code=409, detail=f"Sucursal {sid} ya está asignada a otra empresa")
            # Embed snapshot in empresa doc
            assigned.append(_sucursal_payload_from_refs(sid))
        # Update empresa with embedded sucursales
        COL_EMPRESAS.update_one({"_id": ins.inserted_id}, {"$set": {"sucursales": assigned, "updated_at": _now_iso()}})

    saved = COL_EMPRESAS.find_one({"_id": ins.inserted_id})
    saved["_id"] = str(saved["_id"])  # stringify
    return saved


@router.post("/empresas/{empresa_id}/sucursales", summary="Asignar sucursales a una empresa (enforza unicidad)")
async def assign_sucursales(
    empresa_id: str,
    req: EmpresaAssignSucursales,
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    embedded = empresa.get("sucursales", [])

    for sid in req.id_sucursales:
        # Try to claim mapping (unique per id_sucursal)
        try:
            COL_EMPRESA_SUCURSALES.insert_one({
                "empresa_id": empresa_id,
                "id_sucursal": sid,
                "assigned_at": _now_iso(),
            })
        except Exception:
            raise HTTPException(status_code=409, detail=f"Sucursal {sid} ya está asignada a otra empresa")
        # Add/refresh embedded snapshot
        payload = _sucursal_payload_from_refs(sid)
        embedded = [e for e in embedded if e.get("id_sucursal") != sid] + [payload]

    COL_EMPRESAS.update_one(
        {"_id": _to_oid(empresa_id)},
        {"$set": {"sucursales": embedded, "updated_at": _now_iso()}},
    )

    out = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    out["_id"] = empresa_id
    return out


@router.delete("/empresas/{empresa_id}/sucursales/{id_sucursal}", summary="Desasignar sucursal de empresa")
async def unassign_sucursal(
    empresa_id: str,
    id_sucursal: int,
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    COL_EMPRESA_SUCURSALES.delete_one({"empresa_id": empresa_id, "id_sucursal": id_sucursal})
    embedded = [e for e in (empresa.get("sucursales") or []) if e.get("id_sucursal") != id_sucursal]

    COL_EMPRESAS.update_one(
        {"_id": _to_oid(empresa_id)},
        {"$set": {"sucursales": embedded, "updated_at": _now_iso()}},
    )
    return {"ok": True}


@router.post("/empresas/{empresa_id}/cuentas/include", summary="Agregar cuentas incluidas a empresa")
async def include_cuentas(
    empresa_id: str,
    req: EmpresaUpdateCuentas,
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    current = set(empresa.get("cuentas_include") or [])
    current.update(req.cuentas)
    COL_EMPRESAS.update_one(
        {"_id": _to_oid(empresa_id)},
        {"$set": {"cuentas_include": sorted(list(current)), "updated_at": _now_iso()}},
    )
    return {"ok": True, "cuentas_include": sorted(list(current))}


@router.post("/empresas/{empresa_id}/cuentas/exclude", summary="Agregar cuentas excluidas a empresa")
async def exclude_cuentas(
    empresa_id: str,
    req: EmpresaUpdateCuentas,
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    current = set(empresa.get("cuentas_exclude") or [])
    current.update(req.cuentas)
    COL_EMPRESAS.update_one(
        {"_id": _to_oid(empresa_id)},
        {"$set": {"cuentas_exclude": sorted(list(current)), "updated_at": _now_iso()}},
    )
    return {"ok": True, "cuentas_exclude": sorted(list(current))}


@router.post("/empresas/{empresa_id}/cuentas/include-by-resumen2", summary="Incluir cuentas por resumen2")
async def include_cuentas_by_resumen2(
    empresa_id: str,
    req: EmpresaUpdateByResumen2,
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if not req.resumen2:
        return {"ok": True, "cuentas_include": sorted(list(empresa.get("cuentas_include") or []))}

    # Buscar todas las cuentas cuyo resumen2 esté en la lista
    cuentas_cursor = COL_REFS_CUENTAS.find({"resumen2": {"$in": req.resumen2}}, {"_id": 0, "cuenta": 1})
    cuentas_ids = {doc["cuenta"] for doc in cuentas_cursor}

    current = set(empresa.get("cuentas_include") or [])
    current.update(cuentas_ids)

    # Update resumen2 tracking on empresa
    r2_inc = set(empresa.get("resumen2_include") or [])
    r2_exc = set(empresa.get("resumen2_exclude") or [])
    r2_add = set(req.resumen2 or [])
    r2_inc.update(r2_add)
    # Include wins on resumen2 arrays? We keep both but remove from opposite to avoid inconsistencies
    r2_exc.difference_update(r2_add)

    COL_EMPRESAS.update_one(
        {"_id": _to_oid(empresa_id)},
        {"$set": {
            "cuentas_include": sorted(list(current)),
            "resumen2_include": sorted(list(r2_inc)),
            "resumen2_exclude": sorted(list(r2_exc)),
            "updated_at": _now_iso(),
        }},
    )
    return {
        "ok": True,
        "cuentas_include": sorted(list(current)),
        "added_from_resumen2": sorted(list(cuentas_ids)),
        "resumen2_include": sorted(list(r2_inc)),
        "resumen2_exclude": sorted(list(r2_exc)),
    }


@router.post("/empresas/{empresa_id}/cuentas/exclude-by-resumen2", summary="Excluir cuentas por resumen2")
async def exclude_cuentas_by_resumen2(
    empresa_id: str,
    req: EmpresaUpdateByResumen2,
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if not req.resumen2:
        return {"ok": True, "cuentas_exclude": sorted(list(empresa.get("cuentas_exclude") or []))}

    cuentas_cursor = COL_REFS_CUENTAS.find({"resumen2": {"$in": req.resumen2}}, {"_id": 0, "cuenta": 1})
    cuentas_ids = {doc["cuenta"] for doc in cuentas_cursor}

    current = set(empresa.get("cuentas_exclude") or [])
    current.update(cuentas_ids)

    # Update resumen2 tracking on empresa
    r2_inc = set(empresa.get("resumen2_include") or [])
    r2_exc = set(empresa.get("resumen2_exclude") or [])
    r2_add = set(req.resumen2 or [])
    r2_exc.update(r2_add)
    # Exclude wins on resumen2 arrays: remove from include
    r2_inc.difference_update(r2_add)

    COL_EMPRESAS.update_one(
        {"_id": _to_oid(empresa_id)},
        {"$set": {
            "cuentas_exclude": sorted(list(current)),
            "resumen2_include": sorted(list(r2_inc)),
            "resumen2_exclude": sorted(list(r2_exc)),
            "updated_at": _now_iso(),
        }},
    )
    return {
        "ok": True,
        "cuentas_exclude": sorted(list(current)),
        "added_from_resumen2": sorted(list(cuentas_ids)),
        "resumen2_include": sorted(list(r2_inc)),
        "resumen2_exclude": sorted(list(r2_exc)),
    }


@router.get("/empresas/{empresa_id}", summary="Obtener empresa")
async def get_empresa(empresa_id: str, user: dict = Depends(verify_session)):
    require_admin(user)
    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    empresa["_id"] = empresa_id
    return empresa


@router.get("/empresas/{empresa_id}/cuentas", summary="Listar cuentas derivadas para empresa")
async def get_empresa_cuentas(
    empresa_id: str,
    user: dict = Depends(verify_session),
    only_ids: bool = Query(False, description="Si True, solo retorna lista de ids de cuenta"),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    # Sucursales asignadas a la empresa
    suc_ids = [s.get("id_sucursal") for s in (empresa.get("sucursales") or []) if s.get("id_sucursal") is not None]

    # Derivar cuentas desde gastos_intranet para esas sucursales
    cuentas_ids: set = set()
    if suc_ids:
        pipeline = [
            {"$match": {"id_sucursal": {"$in": suc_ids}}},
            {"$group": {"_id": "$cuenta"}},
        ]
        cuentas_ids = {doc["_id"] for doc in db.gastos_intranet.aggregate(pipeline)}

    # Aplicar include/exclude a nivel empresa
    incl = set(empresa.get("cuentas_include") or [])
    excl = set(empresa.get("cuentas_exclude") or [])
    cuentas_ids.update(incl)
    cuentas_ids.difference_update(excl)

    if only_ids:
        return sorted(list(cuentas_ids))

    # Enriquecer con refs si existen
    cuentas = list(COL_REFS_CUENTAS.find({"cuenta": {"$in": list(cuentas_ids)}}, {
        "_id": 0,
        "cuenta": 1,
        "nombre_cuenta": 1,
        "id_cuenta_resultado": 1,
        "nombre_cuenta_resultado": 1,
        "cat_categoria_resultado": 1,
        "resumen": 1,
        "resumen2": 1,
        "es_operacional": 1,
        "es_cuenta": 1,
    }))

    by_id = {c["cuenta"]: c for c in cuentas}
    result = [by_id[i] for i in sorted(cuentas_ids) if i in by_id] + [
        {"cuenta": i} for i in sorted(cuentas_ids) if i not in by_id
    ]
    return {"count": len(result), "cuentas": result}


@router.patch("/empresas/{empresa_id}", summary="Actualizar empresa (base, resumen2 y sucursales)")
async def update_empresa(
    empresa_id: str,
    req: EmpresaUpdate = Body(...),
    user: dict = Depends(verify_session),
):
    require_admin(user)

    empresa = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    updates: Dict[str, Any] = {"updated_at": _now_iso()}

    # Base fields
    if req.nombre is not None:
        updates["nombre"] = req.nombre
    if req.slug is not None:
        updates["slug"] = req.slug  # can be None to clear
    if req.descripcion is not None:
        updates["descripcion"] = req.descripcion

    # Build cuentas include/exclude from explicit and resumen2 if provided
    cuentas_include_set = set(empresa.get("cuentas_include") or [])
    cuentas_exclude_set = set(empresa.get("cuentas_exclude") or [])
    r2_inc = set(empresa.get("resumen2_include") or [])
    r2_exc = set(empresa.get("resumen2_exclude") or [])

    if req.cuentas_include is not None:
        cuentas_include_set = set(req.cuentas_include or [])
    if req.cuentas_exclude is not None:
        cuentas_exclude_set = set(req.cuentas_exclude or [])
    if req.resumen2_include is not None:
        r2_inc = set(req.resumen2_include or [])
    if req.resumen2_exclude is not None:
        r2_exc = set(req.resumen2_exclude or [])

    # derive from resumen2
    if req.resumen2_include is not None or req.resumen2_exclude is not None:
        # Start by adding includes derived from r2_inc
        if r2_inc:
            for doc in COL_REFS_CUENTAS.find({"resumen2": {"$in": list(r2_inc)}}, {"_id": 0, "cuenta": 1}):
                cid = doc.get("cuenta")
                if cid is not None:
                    cuentas_include_set.add(cid)
        # And excludes derived from r2_exc
        if r2_exc:
            for doc in COL_REFS_CUENTAS.find({"resumen2": {"$in": list(r2_exc)}}, {"_id": 0, "cuenta": 1}):
                cid = doc.get("cuenta")
                if cid is not None:
                    cuentas_exclude_set.add(cid)

    # Exclude wins over include
    cuentas_include_set.difference_update(cuentas_exclude_set)

    updates["cuentas_include"] = sorted(list(cuentas_include_set))
    updates["cuentas_exclude"] = sorted(list(cuentas_exclude_set))
    updates["resumen2_include"] = sorted(list(r2_inc))
    updates["resumen2_exclude"] = sorted(list(r2_exc))

    # Apply document updates
    COL_EMPRESAS.update_one({"_id": _to_oid(empresa_id)}, {"$set": updates})

    # Reconcile sucursales mapping if provided
    if req.sucursales is not None:
        desired = set(req.sucursales or [])
        current_emb = empresa.get("sucursales") or []
        current = {int(s.get("id_sucursal")) for s in current_emb if s.get("id_sucursal") is not None}
        to_add = sorted(list(desired - current))
        to_remove = sorted(list(current - desired))

        # Preflight: ensure no to_add are already assigned to other empresas
        if to_add:
            existing = list(COL_EMPRESA_SUCURSALES.find(
                {"id_sucursal": {"$in": to_add}}, {"_id": 0, "id_sucursal": 1, "empresa_id": 1}
            ))
            # Only treat as conflict if assigned to a different empresa
            conflicts = [e for e in existing if e.get("empresa_id") != empresa_id]
            if conflicts:
                conflict_ids = sorted({int(e.get("id_sucursal")) for e in conflicts if e.get("id_sucursal") is not None})
                raise HTTPException(status_code=409, detail={"message": "Sucursales ya asignadas", "conflicts": conflict_ids})

        # Remove mappings
        for sid in to_remove:
            COL_EMPRESA_SUCURSALES.delete_one({"empresa_id": empresa_id, "id_sucursal": sid})

        # Add mappings
        for sid in to_add:
            COL_EMPRESA_SUCURSALES.insert_one({"empresa_id": empresa_id, "id_sucursal": sid, "assigned_at": _now_iso()})

        # Rebuild embedded snapshots
        final_ids = sorted(list(desired))
        embedded = [_sucursal_payload_from_refs(sid) for sid in final_ids]
        COL_EMPRESAS.update_one({"_id": _to_oid(empresa_id)}, {"$set": {"sucursales": embedded, "updated_at": _now_iso()}})

    out = COL_EMPRESAS.find_one({"_id": _to_oid(empresa_id)})
    out["_id"] = empresa_id
    return out

@router.get("/empresas-refs/cuentas", summary="Listar cuentas (refs) con filtros")
async def list_cuentas_refs(
    user: dict = Depends(verify_session),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(50, ge=1, le=500),
    q: Optional[str] = Query(None, description="Buscar por cuenta, nombre, resumen o resumen2"),
    resumen2: Optional[List[str]] = Query(None, description="Filtrar por valores de resumen2"),
    es_operacional: Optional[int] = Query(None, description="0/1"),
    es_cuenta: Optional[int] = Query(None, description="0/1"),
):
    logger.info("[list_cuentas_refs] reached handler")
    logger.info(
        "[list_cuentas_refs] reached handler | skip=%s limit=%s q=%s resumen2=%s es_operacional=%s es_cuenta=%s wallet=%s",
        skip, limit, q, resumen2, es_operacional, es_cuenta, user.get("wallet")
    )

    require_admin(user)

    filt: Dict[str, Any] = {}
    if q:
        filt["$or"] = [
            {"nombre_cuenta": {"$regex": q, "$options": "i"}},
            {"resumen": {"$regex": q, "$options": "i"}},
            {"resumen2": {"$regex": q, "$options": "i"}},
            {"cuenta": int(q) if q.isdigit() else None},
        ]
        # Remove None conditions
        filt["$or"] = [cond for cond in filt["$or"] if list(cond.values())[0] is not None]
        if not filt["$or"]:
            del filt["$or"]
    if resumen2:
        filt["resumen2"] = {"$in": resumen2}
    if es_operacional in (0, 1):
        filt["es_operacional"] = es_operacional
    if es_cuenta in (0, 1):
        filt["es_cuenta"] = es_cuenta

    logger.info("[list_cuentas_refs] built filter: %s", filt)

    try:
        cursor = COL_REFS_CUENTAS.find(filt, {"_id": 0}).sort("cuenta", 1).skip(skip)
        if limit:
            cursor = cursor.limit(limit)
        items = list(cursor)
        total = COL_REFS_CUENTAS.count_documents(filt)
        return {"total": total, "items": items}
    except Exception as e:
        logger.error("[list_cuentas_refs] DB error: %s", e)
        raise HTTPException(status_code=500, detail="DB error while fetching cuentas refs")


@router.get("/empresas/sucursales-refs", summary="Listar sucursales (refs) para asignación")
async def list_sucursales_refs(
    user: dict = Depends(verify_session),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(200, ge=1, le=1000),
    q: Optional[str] = Query(None, description="Buscar por sigla o nombre de location"),
):
    require_admin(user)

    filt: Dict[str, Any] = {}
    if q:
        filt["$or"] = [
            {"sigla": {"$regex": q, "$options": "i"}},
            {"location.nombre": {"$regex": q, "$options": "i"}},
            {"id_sucursal": int(q)} if q.isdigit() else {},
        ]
        # Clean empty dicts
        filt["$or"] = [c for c in filt["$or"] if c]

    projection = {
        "_id": 0,
        "id_sucursal": 1,
        "sigla": 1,
        "mtz": 1,
        "location": 1,
        "count_docs": 1,
        "first_seen": 1,
        "last_seen": 1,
    }
    cursor = COL_REFS_SUCURSALES.find(filt, projection).sort("id_sucursal", 1).skip(skip)
    if limit:
        cursor = cursor.limit(limit)
    items = list(cursor)
    total = COL_REFS_SUCURSALES.count_documents(filt)
    return {"total": total, "items": items}


@router.get("/empresas/refs/sucursales", summary="Listar sucursales (refs) con estado de asignación")
async def list_sucursales_refs_with_assignment(
    user: dict = Depends(verify_session),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(200, ge=1, le=1000),
    q: Optional[str] = Query(None, description="Buscar por sigla o nombre de location"),
):
    """
    Variante que anota cada sucursal con si está asignada y a qué empresa, evitando
    conflictos de ruta con "/empresas/{empresa_id}".
    """
    require_admin(user)

    filt: Dict[str, Any] = {}
    if q:
        filt["$or"] = [
            {"sigla": {"$regex": q, "$options": "i"}},
            {"location.nombre": {"$regex": q, "$options": "i"}},
            {"id_sucursal": int(q)} if q.isdigit() else {},
        ]
        filt["$or"] = [c for c in filt["$or"] if c]

    projection = {
        "_id": 0,
        "id_sucursal": 1,
        "sigla": 1,
        "mtz": 1,
        "location": 1,
        "count_docs": 1,
        "first_seen": 1,
        "last_seen": 1,
    }
    cursor = COL_REFS_SUCURSALES.find(filt, projection).sort("id_sucursal", 1).skip(skip)
    if limit:
        cursor = cursor.limit(limit)
    items = list(cursor)

    # Obtener mapeos de asignación para los id_sucursal en esta página
    ids = [it.get("id_sucursal") for it in items if it.get("id_sucursal") is not None]
    assigned_map: Dict[int, str] = {}
    if ids:
        for m in COL_EMPRESA_SUCURSALES.find({"id_sucursal": {"$in": ids}}, {"_id": 0, "id_sucursal": 1, "empresa_id": 1}):
            sid = m.get("id_sucursal")
            eid = m.get("empresa_id")
            if sid is not None and eid:
                assigned_map[int(sid)] = str(eid)

    annotated = []
    for it in items:
        sid = it.get("id_sucursal")
        eid = assigned_map.get(int(sid)) if sid is not None else None
        annotated.append({
            **it,
            "is_assigned": bool(eid),
            "assigned_empresa_id": eid or None,
        })

    total = COL_REFS_SUCURSALES.count_documents(filt)
    return {"total": total, "items": annotated}


@router.get("/empresas", summary="Listar empresas")
async def list_empresas(
    user: dict = Depends(verify_session),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(50, ge=1, le=200),
    q: Optional[str] = Query(None, description="Buscar por nombre o slug"),
):
    require_admin(user)
    filt: Dict[str, Any] = {}
    if q:
        filt = {
            "$or": [
                {"nombre": {"$regex": q, "$options": "i"}},
                {"slug": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = COL_EMPRESAS.find(filt).sort("created_at", -1).skip(skip)
    if limit:
        cursor = cursor.limit(limit)
    items = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])  # stringify
        items.append(doc)
    total = COL_EMPRESAS.count_documents(filt)
    return {"total": total, "items": items}
