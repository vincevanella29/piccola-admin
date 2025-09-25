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

# Helpers biométricos (100% gratis, comparación de descriptores)
def l2_distance(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        raise ValueError("Descriptores inválidos o de distinta dimensión")
    return sum((a - b) ** 2 for a, b in zip(v1, v2)) ** 0.5

MATCH_THRESHOLD = 0.6  # umbral típico para 128D (face-api/face_recognition ~0.6)


def get_employee_profile(rut: str) -> Optional[dict]:
    # Permitir rut numérico o string
    or_terms = [{"rut": rut}]
    try:
        or_terms.append({"rut": int(rut)})
    except Exception:
        pass
    emp = db.trabajadores_vpn.find_one({"$or": or_terms})
    return emp


@router.get("/registro/consulta", summary="Consulta si un RUT existe y si tiene foto de referencia")
async def consulta_registro(rut: str, user: dict = Depends(verify_session)):
    rut = (rut or "").strip()
    if not rut:
        raise HTTPException(status_code=400, detail="Debe enviar rut")
    # Validación de RUT chileno completo (número + DV)
    if not is_valid_rut(rut):
        raise HTTPException(status_code=400, detail="RUT inválido")
    rut = clean_rut(rut)
    emp = get_employee_profile(rut)
    if not emp:
        return {"exists": False, "rut": rut}
    # Detectar foto
    foto_url = None
    for k in ["foto_url", "foto", "image_url", "profile_image", "profile_image_url"]:
        if emp.get(k):
            foto_url = emp.get(k)
            break
    needs_profile_update = not bool(foto_url)
    # Datos básicos del empleado
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
        "foto_url": foto_url,  # no mostrar en UI; usar solo para crear descriptor
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
    # Validación de RUT chileno completo (número + DV)
    if not is_valid_rut(rut):
        raise HTTPException(status_code=400, detail="RUT inválido")
    rut = clean_rut(rut)

    emp = get_employee_profile(rut)
    if not emp:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # Generar sesión de registro con un pequeño challenge de liveness (para el front)
    session_id = secrets.token_urlsafe(24)
    now = int(time.time())
    challenge = ["turn_left", "turn_right", "look_forward"]  # 'look_up' eliminado del flujo de liveness

    # Foto de referencia si la tenemos almacenada
    foto_url = None
    for k in ["foto_url", "foto", "image_url", "profile_image", "profile_image_url"]:
        if emp.get(k):
            foto_url = emp.get(k)
            break

    needs_profile_update = False
    admin_notice_msg = None
    if not foto_url:
        # Crear/actualizar aviso para admin: empleado sin foto en ficha
        needs_profile_update = True
        admin_notice_msg = "Empleado sin foto de referencia: falta actualizar la ficha del empleado."
        try:
            ALERTS.update_one(
                {"rut": rut, "type": "missing_photo", "status": {"$in": ["open", None]}},
                {
                    "$setOnInsert": {
                        "rut": rut,
                        "type": "missing_photo",
                        "status": "open",
                        "created_at": now,
                    },
                    "$set": {"last_seen_at": now},
                    "$inc": {"seen_count": 1},
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"No se pudo registrar aviso admin missing_photo para rut {rut}: {e}")

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
    url = (url or "").strip()
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL inválida")
    try:
        # Nota: podrías agregar allowlist de dominios aquí por seguridad
        # Usar headers tipo navegador para mejorar compatibilidad con CDNs
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            # Preferir JPEG/PNG para facilitar normalización en backend y decodificación en front
            "Accept": "image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5",
            "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
            # Algunos CDNs requieren encabezados coherentes con el origen
            **({"Referer": origin + "/"} if origin else {}),
            **({"Origin": origin} if origin else {}),
            **({"Host": parsed.netloc} if parsed.netloc else {}),
        }
        # Timeout reducido para no trabar el front si el CDN está lento
        r = requests.get(url, timeout=5, headers=headers)
    except Exception as e:
        logger.warning(f"foto_proxy request failed: {e}")
        raise HTTPException(status_code=502, detail="No se pudo obtener la imagen")
    if r.status_code != 200 or not r.content:
        raise HTTPException(status_code=502, detail="Respuesta inválida de imagen")
    content_type = r.headers.get("Content-Type", "image/jpeg")
    logger.info(f"foto_proxy request successful: {url}")
    logger.info(f"foto_proxy response content type: {content_type}")

    raw = r.content
    # Validación básica: magic bytes de formatos comunes
    head = raw[:12]
    fmt = None
    try:
        if head.startswith(b"\xFF\xD8\xFF"):
            fmt = "jpeg"
        elif head.startswith(b"\x89PNG\r\n\x1a\n"):
            fmt = "png"
        elif head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
            fmt = "gif"
        elif head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            fmt = "webp"
    except Exception:
        fmt = None
    if not fmt and not (isinstance(content_type, str) and content_type.lower().startswith("image/")):
        logger.warning("foto_proxy: upstream payload is not an image (ct=%s)", content_type)
        raise HTTPException(status_code=502, detail="La URL no devolvió una imagen válida")

    # Normalizar SIEMPRE a RGB JPEG 160x160 para acelerar el front y reducir ancho de banda
    ImageFile.LOAD_TRUNCATED_IMAGES = True
    try:
        with Image.open(io.BytesIO(raw)) as im:
            if im.mode not in ("RGB",):
                im = im.convert("RGB")
            # Redimensionar a 160x160 (coincide con tinyFaceOptions.inputSize)
            try:
                from PIL import Image as _PILImage
                resample = _PILImage.Resampling.LANCZOS
            except Exception:
                resample = Image.LANCZOS if hasattr(Image, 'LANCZOS') else Image.BICUBIC
            im = im.resize((160, 160), resample)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85, optimize=True)
            normalized_bytes = buf.getvalue()
            content_type = "image/jpeg"
            logger.info("foto_proxy: normalized and resized image to 160x160 JPEG")
    except Exception as e:
        logger.warning(f"foto_proxy: image decode/resize failed: {e}")
        raise HTTPException(status_code=502, detail="La imagen remota está corrupta o en formato no soportado")

    response = Response(content=normalized_bytes, media_type=content_type)
    # Cache por 1 hora para evitar recalcular en el front
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response


@router.post("/registro/validar", summary="Validar verificación facial y activar cuenta de empleado (gratis)")
async def validar_registro(request: Request, user: dict = Depends(verify_session)):
    data = await request.json()
    session_id = data.get("session_id")
    rut = data.get("rut")
    live_descriptor = data.get("live_descriptor")  # Lista de floats
    reference_descriptor = data.get("reference_descriptor")  # Lista de floats (opcional si no hay foto)
    liveness = data.get("liveness") or {}
    # liveness esperado: { blink: bool, turn_left: bool, turn_right: bool }

    if not session_id or not rut or not isinstance(live_descriptor, list) or not isinstance(reference_descriptor, list):
        logger.warning(
            "Validación fallida: parámetros incompletos - session_id=%s, rut=%s, live_descriptor=%s, reference_descriptor=%s",
            session_id,
            rut,
            (len(live_descriptor) if isinstance(live_descriptor, list) else None),
            (len(reference_descriptor) if isinstance(reference_descriptor, list) else None),
        )
        raise HTTPException(status_code=400, detail="Faltan parámetros: session_id, rut, live_descriptor, reference_descriptor")

    sess = REG_SESSIONS.find_one({"_id": session_id, "rut": rut})
    if not sess:
        logger.warning("Sesión no encontrada: session_id=%s, rut=%s", session_id, rut)
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if sess.get("status") == "completed":
        logger.info("Sesión ya completada: session_id=%s, rut=%s", session_id, rut)
        return {"ok": True, "message": "Sesión ya completada"}

    # Validar liveness del front (gratis, challenge-response)
    for step in (sess.get("challenge") or []):
        if not liveness.get(step):
            logger.warning("Liveness no cumplido: step=%s, liveness=%s", step, liveness)
            raise HTTPException(status_code=400, detail=f"Liveness no cumplido: falta {step}")

    # Obtener empleado
    emp = get_employee_profile(rut)
    if not emp:
        logger.warning("Trabajador no encontrado: rut=%s", rut)
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # Determinar descriptor de referencia (obligatorio si hay foto en la BD)
    ref_desc = reference_descriptor

    foto_url = sess.get("foto_url")
    if foto_url and not isinstance(ref_desc, list):
        logger.warning("Falta reference_descriptor para empleado con foto: rut=%s", rut)
        raise HTTPException(status_code=400, detail="Falta reference_descriptor basado en foto de empleado")
    if not foto_url:
        # Sin foto en BD: no permitir continuar con registro; mantener aviso admin
        raise HTTPException(status_code=409, detail="Empleado sin foto: actualizar ficha antes de registrar")

    try:
        dist = l2_distance(live_descriptor, ref_desc)
        logger.info("Comparación de descriptores: rut=%s, dist=%.3f, threshold=%s", rut, dist, MATCH_THRESHOLD)
    except Exception as e:
        logger.error("Error comparando descriptores: rut=%s, error=%s", rut, e)
        raise HTTPException(status_code=400, detail=f"Error comparando descriptores: {e}")

    if dist > MATCH_THRESHOLD:
        logger.warning("No coincide rostro: rut=%s, dist=%.3f, threshold=%s", rut, dist, MATCH_THRESHOLD)
        raise HTTPException(status_code=401, detail=f"No coincide rostro (dist={dist:.3f} > {MATCH_THRESHOLD})")

    # Resolver identidad del usuario (guardar SIEMPRE wallet, email y sub)
    sub = user.get("sub")
    # intentar wallet desde sesión y como fallback desde header
    wallet = user.get("wallet") or request.headers.get("x-wallet-address") or request.headers.get("X-Wallet-Address")
    # email desde sesión/privy
    email = None
    try:
        email = user.get("email") if isinstance(user.get("email"), str) else None
    except Exception:
        email = None
    if sub and not email:
        # obtener email desde Privy con el sub
        try:
            email = get_email_from_privy(sub)
        except Exception:
            email = None

    # Requerimos wallet para vincular correctamente
    if not wallet:
        raise HTTPException(status_code=400, detail="Falta wallet en la sesión o en X-Wallet-Address")

    identity = {"wallet": wallet, "email": email, "sub": sub}

    # Datos de cargo/sección para perfilar usuario empleado
    cargo = (emp.get("cargo") or "").strip() or None
    seccion = None
    try:
        if cargo:
            ci = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
            if ci and ci.get("seccion"):
                seccion = ci.get("seccion")
    except Exception:
        pass

    # Upsert de vínculo a "empleados_usuarios" como base de usuarios empleados
    LINKS.update_one(
        {"rut": rut},
        {
            "$set": {
                "rut": rut,
                "wallet": wallet,
                "email": email,
                "sub": sub,
                "linked_at": int(time.time()),
                "biometric": {
                    "dist": dist,
                    "threshold": MATCH_THRESHOLD,
                    "liveness": liveness,
                    "session_id": session_id,
                },
                "status": "active",
                "role": "employee",
                "cargo": cargo,
                "seccion": seccion,
            },
            "$setOnInsert": {"created_at": int(time.time())},
        },
        upsert=True,
    )

    # Marcar sesión como completada
    REG_SESSIONS.update_one({"_id": session_id}, {"$set": {"status": "completed", "completed_at": int(time.time())}})

    return {"ok": True, "rut": rut, **identity, "biometric_dist": dist}


@router.get("/registro/estado", summary="Consultar si un rut ya está vinculado y activo")
async def estado_registro(rut: str):
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