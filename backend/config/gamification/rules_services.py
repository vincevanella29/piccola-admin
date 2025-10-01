from __future__ import annotations
import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException
from bson import ObjectId

from utils.web3mongo import db
from config.gamification.rules import list_rule_templates as rules_list_templates
from .helpers import list_permitted_segments_for_company
from utils.time_utils import get_chile_time

logger = logging.getLogger(__name__)

# ---- Rules CRUD and Catalogs (service layer for gamification API) ----

def save_meritocracy_rule(rule_dict: Dict[str, Any]) -> Dict[str, Any]:
    col = db.gamification_meritocracy_rules
    query = {"rule_name": rule_dict.get("rule_name")}
    update_data = {
        "$set": {**rule_dict, "updated_at": get_chile_time()},
    }
    result = col.update_one(query, update_data, upsert=True)
    return {
        "ok": True,
        "message": "Regla de meritocracia guardada con éxito.",
        "modified_count": result.modified_count,
        "upserted_id": str(result.upserted_id) if result.upserted_id else None,
    }

def list_meritocracy_rules(only_active: Optional[bool] = None, segment_token_id: Optional[int] = None) -> Dict[str, Any]:
    col = db.gamification_meritocracy_rules
    q: Dict[str, Any] = {}
    if only_active is True:
        q["is_active"] = True
    if segment_token_id is not None:
        q["segment_token_id"] = int(segment_token_id)
    items = list(col.find(q, {"_id": 0}))
    return {"ok": True, "rules": items}

def list_catalogs(q: Optional[str] = None) -> Dict[str, Any]:
    cursor = db.cargos_intranet.find({}, {"_id": 0, "cargo": 1, "seccion": 1})
    cargos_set = {(doc.get("cargo") or "").strip() for doc in cursor if doc.get("cargo")}
    # We need a fresh cursor for secciones since previous cursor is consumed
    cursor2 = db.cargos_intranet.find({}, {"_id": 0, "cargo": 1, "seccion": 1})
    secciones_set = {(doc.get("seccion") or "").strip() for doc in cursor2 if doc.get("seccion")}

    cargos = sorted(list(cargos_set))
    secciones = sorted(list(secciones_set))
    if q:
        q_lower = q.strip().lower()
        cargos = [c for c in cargos if q_lower in c.lower()]
        secciones = [s for s in secciones if q_lower in s.lower()]
    return {"ok": True, "cargos": cargos, "secciones": secciones}

# ---- Rule templates (predefined, fixed parameters per template) ----

def list_rule_templates_service() -> Dict[str, Any]:
    try:
        templates = rules_list_templates()
        return {"ok": True, "templates": templates}
    except Exception as e:
        logger.exception("Error listing rule templates")
        raise HTTPException(status_code=500, detail=str(e))

def validate_and_save_rule_from_template(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a rule payload against predefined templates and save.
    Expected payload keys:
      - rule_name: str
      - segment_token_id: int
      - template_key: str
      - params: dict (must match template's required_params subset)
      - merit_points: int (>0)
      - is_active: bool
    """
    rule_name = (payload or {}).get("rule_name")
    segment_token_id = (payload or {}).get("segment_token_id")
    template_key = (payload or {}).get("template_key")
    params = (payload or {}).get("params") or {}
    merit_points = float((payload or {}).get("merit_points") or 0.0)
    is_active = bool((payload or {}).get("is_active", True))
    scope = (payload or {}).get("scope") or None

    if not rule_name or not isinstance(rule_name, str):
        raise HTTPException(status_code=400, detail="rule_name es obligatorio")
    try:
        segment_token_id = int(segment_token_id)
        if segment_token_id <= 0:
            raise Exception()
    except Exception:
        raise HTTPException(status_code=400, detail="segment_token_id inválido")
    if not template_key:
        raise HTTPException(status_code=400, detail="template_key es obligatorio")
    if merit_points <= 0.0:
        raise HTTPException(status_code=400, detail="merit_points debe ser > 0")

    # Chequear que el segmento esté permitido por la compañía/DAO
    meta = list_permitted_segments_for_company()  # { 'segments': [ {token_id, allowed, ...}, ... ] }
    allowed = {seg.get("token_id") for seg in (meta.get("segments") or []) if seg.get("allowed")}
    if segment_token_id not in allowed:
        raise HTTPException(status_code=400, detail="segment_token_id no permitido para la compañía/DAO")

    # Find template
    templates = {t.get("key"): t for t in rules_list_templates()}
    tpl = templates.get(template_key)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    req = (tpl.get("required_params") or {})
    # Validate required params exist and are within bounds
    for k, meta in req.items():
        if k not in params:
            # fill default if provided
            if "default" in meta:
                params[k] = meta["default"]
            else:
                raise HTTPException(status_code=400, detail=f"Falta parámetro requerido: {k}")
        v = params.get(k)
        if meta.get("type") == "number":
            try:
                v = float(v)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Parámetro {k} debe ser numérico")
            if "min" in meta and v < meta["min"]:
                raise HTTPException(status_code=400, detail=f"Parámetro {k} < mínimo {meta['min']}")
            if "max" in meta and v > meta["max"]:
                raise HTTPException(status_code=400, detail=f"Parámetro {k} > máximo {meta['max']}")
            # Store as number (int if integer-like)
            params[k] = int(v) if v.is_integer() else v

    # Normalize scope if provided
    norm_scope: Optional[Dict[str, Any]] = None
    if isinstance(scope, dict):
        norm_scope = {}
        key = None
        if 'cargos' in scope:
            key = 'cargos'
        elif 'secciones' in scope:
            key = 'secciones'

        if key:
            v = scope.get(key)
            if isinstance(v, dict):
                inc = v.get("include") or []
                exc = v.get("exclude") or []
                # Ensure lists of unique non-empty strings
                if isinstance(inc, list):
                    inc = sorted({str(x).strip() for x in inc if str(x).strip()})
                else:
                    inc = []
                if isinstance(exc, list):
                    exc = sorted({str(x).strip() for x in exc if str(x).strip()})
                else:
                    exc = []
                # Only set if any constraint exists
                if inc or exc:
                    norm_scope[key] = {"include": inc, "exclude": exc}
        if not norm_scope:
            norm_scope = None

    # Persist rule with fixed shape
    col = db.gamification_meritocracy_rules
    doc = {
        "rule_name": rule_name,
        "segment_token_id": segment_token_id,
        "template_key": template_key,
        "params": params,
        "merit_points": merit_points,
        "is_active": is_active,
    }
    if norm_scope is not None:
        doc["scope"] = norm_scope
    from utils.time_utils import get_chile_time
    doc["updated_at"] = get_chile_time()
    res = col.update_one({"rule_name": rule_name}, {"$set": doc}, upsert=True)
    return {
        "ok": True,
        "message": "Regla validada y guardada",
        "modified_count": res.modified_count,
        "upserted_id": str(res.upserted_id) if res.upserted_id else None,
    }

# ================= NEW: Update (patch) service =================

def _ensure_segment_allowed_or_400(segment_token_id: int):
    meta = list_permitted_segments_for_company()
    allowed = {seg.get("token_id") for seg in (meta.get("segments") or []) if seg.get("allowed")}
    if int(segment_token_id) not in allowed:
        raise HTTPException(status_code=400, detail="segment_token_id no permitido para la compañía/DAO")

def _normalize_scope(scope: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if scope is None:
        return None
    norm: Dict[str, Any] = {}
    key = 'cargos' if 'cargos' in scope else ('secciones' if 'secciones' in scope else None)
    if key:
        v = scope.get(key)
        if isinstance(v, dict):
            inc = v.get("include") or []
            exc = v.get("exclude") or []
            if isinstance(inc, list):
                inc = sorted({str(x).strip() for x in inc if str(x).strip()})
            else:
                inc = []
            if isinstance(exc, list):
                exc = sorted({str(x).strip() for x in exc if str(x).strip()})
            else:
                exc = []
            if inc or exc:
                norm[key] = {"include": inc, "exclude": exc}
    return norm or None

def _validate_against_template(template_key: str, params: Dict[str, Any], merit_points: float):
    if merit_points is None or float(merit_points) <= 0:
        raise HTTPException(status_code=400, detail="merit_points debe ser > 0")

    templates = {t.get("key"): t for t in rules_list_templates()}
    tpl = templates.get(template_key)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    req = (tpl.get("required_params") or {})
    for k, meta in req.items():
        if k not in params:
            if "default" in meta:
                params[k] = meta["default"]
            else:
                raise HTTPException(status_code=400, detail=f"Falta parámetro requerido: {k}")
        v = params.get(k)
        if meta.get("type") == "number":
            try:
                vfloat = float(v)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Parámetro {k} debe ser numérico")
            if "min" in meta and vfloat < meta["min"]:
                raise HTTPException(status_code=400, detail=f"Parámetro {k} < mínimo {meta['min']}")
            if "max" in meta and vfloat > meta["max"]:
                raise HTTPException(status_code=400, detail=f"Parámetro {k} > máximo {meta['max']}")
            params[k] = int(vfloat) if vfloat.is_integer() else vfloat

def update_meritocracy_rule(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Patch de una regla:
      payload = {
        identifier: str, use_id: bool,
        rule_name?: str, segment_token_id?: int, template_key?: str,
        params?: dict, merit_points?: int, is_active?: bool, scope?: dict|null,
        validate?: bool
      }
    """
    col = db.gamification_meritocracy_rules

    identifier = payload.get("identifier")
    use_id = bool(payload.get("use_id"))

    if not identifier:
        raise HTTPException(status_code=400, detail="identifier es obligatorio")

    # 1) Cargar documento actual
    if use_id:
        try:
            oid = ObjectId(identifier)
        except Exception:
            raise HTTPException(status_code=400, detail="identifier no es un ObjectId válido")
        f = {"_id": oid}
    else:
        f = {"rule_name": identifier}

    current = col.find_one(f)
    if not current:
        raise HTTPException(status_code=404, detail="Regla no encontrada")

    # 2) Construir patch
    fields = ["rule_name", "segment_token_id", "template_key", "params", "merit_points", "is_active"]
    patch: Dict[str, Any] = {k: payload[k] for k in fields if k in payload and payload[k] is not None}

    # scope: si viene explícito y es None → unset; si viene dict → normalizar y set
    scope_in_payload = "scope" in payload
    norm_scope = _normalize_scope(payload.get("scope")) if scope_in_payload and payload.get("scope") is not None else None

    # 3) Validación (si aplica)
    if payload.get("validate", True):
        # valores efectivos tras el patch (lo nuevo si viene, o lo actual)
        eff_template_key = patch.get("template_key", current.get("template_key"))
        eff_params = patch.get("params", current.get("params") or {})
        eff_merit_points = patch.get("merit_points", current.get("merit_points"))
        eff_segment_token_id = int(patch.get("segment_token_id", current.get("segment_token_id") or 0))

        if not eff_template_key:
            raise HTTPException(status_code=400, detail="template_key es obligatorio (actual o nuevo)")

        _validate_against_template(eff_template_key, eff_params, eff_merit_points)
        if eff_segment_token_id > 0:
            _ensure_segment_allowed_or_400(eff_segment_token_id)
        patch["params"] = eff_params  # por si completamos defaults de template

    # 4) Ejecutar update
    ops: Dict[str, Any] = {"$set": {**patch, "updated_at": get_chile_time()}}
    if scope_in_payload:
        if norm_scope is None:
            ops["$unset"] = {"scope": ""}
        else:
            ops["$set"]["scope"] = norm_scope

    res = col.update_one(f, ops)

    # 5) Devolver doc actualizado (sin _id)
    updated = col.find_one(f, {"_id": 0})
    return {
        "ok": True,
        "message": "Regla actualizada",
        "matched_count": res.matched_count,
        "modified_count": res.modified_count,
        "rule": updated,
    }
