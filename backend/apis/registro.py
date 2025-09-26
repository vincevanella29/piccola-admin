import logging
import secrets
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
import requests
from PIL import Image, ImageFile
import io
from urllib.parse import urlparse

from pymongo import ASCENDING, errors  # ⬅️ nuevo
from utils.auth.session import verify_session
from utils.web3mongo import db
from utils.get_privy_email import get_email_from_privy
from utils.rut_utils import is_valid_rut, clean_rut

router = APIRouter()
logger = logging.getLogger(__name__)

# Colecciones
REG_SESSIONS = db.employee_registration_sessions
LINKS = db.empleados_usuarios
ALERTS = db.employee_profile_alerts

# =========================
# Índices + Deduplicación
# =========================

def _dedupe_links_by_rut():
    """
    Garantiza 1 documento por RUT en LINKS.
    Mantiene el más reciente (por linked_at, luego created_at).
    Corre al importar el router y es idempotente.
    """
    try:
        pipeline = [
            {"$group": {
                "_id": "$rut",
                "ids": {"$push": {"_id": "$_id", "linked_at": "$linked_at", "created_at": "$created_at"}},
                "count": {"$sum": 1}
            }},
            {"$match": {"count": {"$gt": 1}}}
        ]
        dups = list(LINKS.aggregate(pipeline, allowDiskUse=True))
        if not dups:
            return

        removed = 0
        for g in dups:
            docs = g["ids"]
            # Orden: mayor linked_at primero; si no hay linked_at, usa created_at
            docs_sorted = sorted(
                docs,
                key=lambda x: (int(x.get("linked_at") or 0), int(x.get("created_at") or 0)),
                reverse=True
            )
            keep = docs_sorted[0]["._id"] if "._id" in docs_sorted[0] else docs_sorted[0]["_id"]
            # eliminar todos menos 'keep'
            to_delete = [d["_id"] for d in docs_sorted[1:]]
            if to_delete:
                LINKS.delete_many({"_id": {"$in": to_delete}})
                removed += len(to_delete)
        if removed:
            logger.info(f"[dedupe LINKS] Eliminados {removed} duplicados de empleados_usuarios por RUT")
    except Exception as e:
        logger.warning(f"[dedupe LINKS] Falló deduplicación: {e}")

def _ensure_indexes():
    """
    Crea índices necesarios y garantiza unicidad por RUT.
    - LINKS.rut: único
    - LINKS.wallet, LINKS.email: índices normales
    - REG_SESSIONS: índice único parcial por (rut, status=='pending')
    """
    try:
        # Dedup antes de declarar índice único
        _dedupe_links_by_rut()
    except Exception as e:
        logger.warning(f"No se pudo ejecutar dedupe previo a índices: {e}")

    # Índices LINKS
    try:
        LINKS.create_index([("rut", ASCENDING)], name="uniq_rut", unique=True)
    except errors.DuplicateKeyError:
        # Si hay duplicados residuales, intentar dedupe y re-crear
        logger.warning("DuplicateKeyError al crear uniq_rut; intentando dedupe + reintento")
        _dedupe_links_by_rut()
        LINKS.drop_index("uniq_rut")
        LINKS.create_index([("rut", ASCENDING)], name="uniq_rut", unique=True)
    except Exception as e:
        logger.warning(f"LINKS uniq_rut index error: {e}")

    try:
        LINKS.create_index([("wallet", ASCENDING)], name="idx_wallet")
    except Exception:
        pass
    try:
        LINKS.create_index([("email", ASCENDING)], name="idx_email")
    except Exception:
        pass

    # Índice parcial único: 1 sesión pending por RUT
    try:
        REG_SESSIONS.create_index(
            [("rut", ASCENDING), ("status", ASCENDING)],
            name="uniq_pending_per_rut",
            unique=True,
            partialFilterExpression={"status": "pending"},
        )
    except Exception as e:
        logger.warning(f"REG_SESSIONS uniq_pending_per_rut index error: {e}")

# Ejecutar al importar el router
try:
    _ensure_indexes()
    logger.info("Índices asegurados (LINKS & REG_SESSIONS).")
except Exception as _e:
    logger.warning(f"No se pudieron asegurar índices al cargar el router: {_e}")

# =========================
# Helpers biométricos
# =========================

def l2_distance(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        raise ValueError("Descriptores inválidos o de distinta dimensión")
    return sum((a - b) ** 2 for a, b in zip(v1, v2)) ** 0.5

MATCH_THRESHOLD = 0.6  # umbral típico para 128D (face-api/face_recognition ~0.6)

def get_employee_profile(rut: str) -> Optional[dict]:
    or_terms = [{"rut": rut}]
    try:
        or_terms.append({"rut": int(rut)})
    except Exception:
        pass
    return db.trabajadores_vpn.find_one({"$or": or_terms})

# =========================
# Endpoints
# =========================

@router.get("/registro/consulta", summary="Consulta si un RUT existe y si tiene foto de referencia")
async def consulta_registro(rut: str, user: dict = Depends(verify_session)):
    rut = (rut or "").strip()
    if not rut:
        raise HTTPException(status_code=400, detail="Debe enviar rut")
    if not is_valid_rut(rut):
        raise HTTPException(status_code=400, detail="RUT inválido")
    rut = clean_rut(rut)
    emp = get_employee_profile(rut)
    if not emp:
        return {"exists": False, "rut": rut}

    foto_url = None
    for k in ["foto_url", "foto", "image_url", "profile_image", "profile_image_url"]:
        if emp.get(k):
            foto_url = emp.get(k); break

    needs_profile_update = not bool(foto_url)

    # Datos básicos
    nombres = emp.get("nombres")
    ap = emp.get("apellidopaterno")
    am = emp.get("apellidomaterno")
    cargo = (emp.get("cargo") or "").strip() or None
    seccion = None
    try:
        if cargo:
            ci = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
            if ci and ci.get("seccion"):
                seccion = ci.get("seccion")
    except Exception:
        pass

    return {
        "exists": True,
        "rut": rut,
        "has_photo": bool(foto_url),
        "foto_url": foto_url,
        "needs_profile_update": needs_profile_update,
        "nombres": nombres,
        "apellidopaterno": ap,
        "apellidomaterno": am,
        "cargo": cargo,
        "seccion": seccion,
    }

@router.post("/registro/solicitar", summary="Iniciar registro de empleado por RUT (gratis, con verificación facial)")
async def solicitar_registro(request: Request, user: dict = Depends(verify_session)):
    data = await request.json()
    rut = (data.get("rut") or "").strip()
    if not rut:
        raise HTTPException(status_code=400, detail="Debe enviar rut")
    if not is_valid_rut(rut):
        raise HTTPException(status_code=400, detail="RUT inválido")
    rut = clean_rut(rut)

    emp = get_employee_profile(rut)
    if not emp:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # ⬅️ Nuevo: si ya está vinculado y activo, bloquear doble registro
    existing_link = LINKS.find_one({"rut": rut})
    if existing_link and (existing_link.get("status") or "active") == "active":
        raise HTTPException(status_code=409, detail="El trabajador ya está vinculado y activo")

    # Cerrar sesiones 'pending' previas del mismo RUT para permitir 1 sola
    try:
        REG_SESSIONS.update_many(
            {"rut": rut, "status": "pending"},
            {"$set": {"status": "closed_prev", "closed_at": int(time.time())}}
        )
    except Exception:
        pass

    session_id = secrets.token_urlsafe(24)
    now = int(time.time())
    challenge = ["turn_left", "turn_right", "look_forward"]

    foto_url = None
    for k in ["foto_url", "foto", "image_url", "profile_image", "profile_image_url"]:
        if emp.get(k):
            foto_url = emp.get(k); break

    needs_profile_update = False
    admin_notice_msg = None
    if not foto_url:
        needs_profile_update = True
        admin_notice_msg = "Empleado sin foto de referencia: falta actualizar la ficha del empleado."
        try:
            ALERTS.update_one(
                {"rut": rut, "type": "missing_photo", "status": {"$in": ["open", None]}},
                {
                    "$setOnInsert": {"rut": rut, "type": "missing_photo", "status": "open", "created_at": now},
                    "$set": {"last_seen_at": now},
                    "$inc": {"seen_count": 1},
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"No se pudo registrar aviso admin missing_photo para rut {rut}: {e}")

    # Insert respetando índice parcial único (1 pending por RUT)
    try:
        REG_SESSIONS.insert_one({
            "_id": session_id,
            "rut": rut,
            "created_at": now,
            "status": "pending",
            "challenge": challenge,
            "user_sub": user.get("sub"),
            "wallet": user.get("wallet"),
            "foto_url": foto_url,
        })
    except errors.DuplicateKeyError:
        # Otra request concurrente creó la pending; responder con conflicto
        raise HTTPException(status_code=409, detail="Ya existe una sesión de registro pendiente para este RUT")

    return {
        "session_id": session_id,
        "challenge": challenge,
        "rut": rut,
        "foto_url": foto_url,
        "needs_profile_update": needs_profile_update,
        "admin_notice": admin_notice_msg,
        "note": "Realiza la verificación en vivo en el front (blink/turns) y envía los descriptores."
    }

@router.get("/registro/foto_proxy", summary="Proxy de imagen de perfil para evitar CORS en front")
async def foto_proxy(url: str, user: dict = Depends(verify_session)):
    # ... (sin cambios en tu lógica actual)
    # ⬅️ deja este endpoint igual al que ya tienes
    # (omito por brevedad; tu implementación actual es correcta)
    ...

@router.post("/registro/validar", summary="Validar verificación facial y activar cuenta de empleado (gratis)")
async def validar_registro(request: Request, user: dict = Depends(verify_session)):
    data = await request.json()
    session_id = data.get("session_id")
    rut = data.get("rut")

    # normalizar rut
    rut = clean_rut((rut or "").strip()) if rut else rut

    live_descriptor = data.get("live_descriptor")
    reference_descriptor = data.get("reference_descriptor")
    liveness = data.get("liveness") or {}

    if not session_id or not rut or not isinstance(live_descriptor, list) or not isinstance(reference_descriptor, list):
        raise HTTPException(status_code=400, detail="Faltan parámetros: session_id, rut, live_descriptor, reference_descriptor")

    sess = REG_SESSIONS.find_one({"_id": session_id, "rut": rut})
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if sess.get("status") == "completed":
        return {"ok": True, "message": "Sesión ya completada"}

    # liveness
    for step in (sess.get("challenge") or []):
        if not liveness.get(step):
            raise HTTPException(status_code=400, detail=f"Liveness no cumplido: falta {step}")

    emp = get_employee_profile(rut)
    if not emp:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    foto_url = sess.get("foto_url")
    if foto_url and not isinstance(reference_descriptor, list):
        raise HTTPException(status_code=400, detail="Falta reference_descriptor basado en foto de empleado")
    if not foto_url:
        raise HTTPException(status_code=409, detail="Empleado sin foto: actualizar ficha antes de registrar")

    # comparación
    dist = l2_distance(live_descriptor, reference_descriptor)
    if dist > MATCH_THRESHOLD:
        raise HTTPException(status_code=401, detail=f"No coincide rostro (dist={dist:.3f} > {MATCH_THRESHOLD})")

    # identidad
    sub = user.get("sub")
    wallet = user.get("wallet") or request.headers.get("x-wallet-address") or request.headers.get("X-Wallet-Address")
    email = None
    try:
        email = user.get("email") if isinstance(user.get("email"), str) else None
    except Exception:
        email = None
    if sub and not email:
        try:
            email = get_email_from_privy(sub)
        except Exception:
            email = None

    if not wallet:
        raise HTTPException(status_code=400, detail="Falta wallet en la sesión o en X-Wallet-Address")

    cargo = (emp.get("cargo") or "").strip() or None
    seccion = None
    try:
        if cargo:
            ci = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
            if ci and ci.get("seccion"):
                seccion = ci.get("seccion")
    except Exception:
        pass

    # Upsert: único por RUT (garantizado por índice)
    try:
        LINKS.update_one(
            {"rut": rut},
            {
                "$set": {
                    "rut": rut,
                    "wallet": wallet,
                    "email": email,
                    "sub": sub,
                    "linked_at": int(time.time()),
                    "biometric": {"dist": dist, "threshold": MATCH_THRESHOLD, "liveness": liveness, "session_id": session_id},
                    "status": "active",
                    "role": "employee",
                    "cargo": cargo,
                    "seccion": seccion,
                },
                "$setOnInsert": {"created_at": int(time.time())},
            },
            upsert=True,
        )
    except errors.DuplicateKeyError:
        # Si por carrera se generó conflicto, devolver estado coherente
        raise HTTPException(status_code=409, detail="El RUT ya fue vinculado")

    # Marcar sesión como completada
    REG_SESSIONS.update_one(
        {"_id": session_id},
        {"$set": {"status": "completed", "completed_at": int(time.time())}}
    )

    return {"ok": True, "rut": rut, "wallet": wallet, "email": email, "sub": sub, "biometric_dist": dist}

@router.get("/registro/estado", summary="Consultar si un rut ya está vinculado y activo")
async def estado_registro(rut: str):
    rut = clean_rut((rut or "").strip())
    link = LINKS.find_one({"rut": rut})
    if not link:
        return {"linked": False}
    return {
        "linked": True,
        "rut": rut,
        "wallet": link.get("wallet"),
        "email": link.get("email"),
        "status": link.get("status", "unknown"),
        "linked_at": link.get("linked_at"),
    }
