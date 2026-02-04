import logging
import secrets
import time
import re
from typing import List, Optional

import io
from urllib.parse import urlparse

import cv2
import numpy as np
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import Response
from paddleocr import PaddleOCR
from PIL import Image, ImageFile

from utils.biometria import (
    get_secure_face_embedding,
    compare_faces_cosine,
    is_match_secure,
)

from utils.auth.session import verify_session
from utils.web3mongo import db
from utils.get_privy_email import get_email_from_privy
from utils.rut_utils import is_valid_rut, clean_rut, compute_dv

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

MATCH_THRESHOLD = 0.6  # umbral histórico para flujo legacy (face-api/dlib)

# Umbral recomendado para similitud coseno con ArcFace (InsightFace)
SECURE_THRESHOLD = 0.45


# --- OCR & CARNET HELPERS ---

# Inicializar OCR una sola vez (lang es). Algunas versiones no aceptan 'show_log'.
ocr_engine = PaddleOCR(use_angle_cls=True, lang="es")


def extract_rut_from_text(text_list: List[str]) -> Optional[str]:
    """Extrae un RUT chileno desde una lista de líneas de texto del OCR.

    Acepta formatos como:
    - 12.345.678-9
    - 12345678-9
    - 12345678K
    """
    rut_pattern = re.compile(r"(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])")

    for line in text_list or []:
        clean_line = (line or "").replace(" ", "").replace("..", ".")
        match = rut_pattern.search(clean_line)
        if match:
            raw_rut = match.group(1).replace(".", "").replace("-", "").upper()
            if len(raw_rut) > 1:
                body = raw_rut[:-1]
                dv = raw_rut[-1]
                return f"{body}-{dv}"
    return None


def extract_face_from_id_card(image_bytes: bytes) -> Optional[np.ndarray]:
    """Recorta el rostro principal desde la foto del carnet.

    Devuelve una imagen RGB (numpy array) lista para generar encoding biométrico.
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return None
        rgb_img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    except Exception as e:
        logger.warning(f"extract_face_from_id_card: error decodificando imagen: {e}")
        return None

    # Detectar caras en el carnet (modelo hog para CPU)
    try:
        face_locations = face_recognition.face_locations(rgb_img, model="hog")
    except Exception as e:
        logger.warning(f"extract_face_from_id_card: error detectando rostro: {e}")
        return None

    if not face_locations:
        return None

    # Tomar la cara más grande (titular)
    top, right, bottom, left = max(
        face_locations,
        key=lambda f: (f[2] - f[0]) * (f[1] - f[3]),
    )

    height, width, _ = rgb_img.shape
    pad_h = int((bottom - top) * 0.3)
    pad_w = int((right - left) * 0.3)

    new_top = max(0, top - int(pad_h * 1.5))
    new_bottom = min(height, bottom + int(pad_h * 0.5))
    new_left = max(0, left - pad_w)
    new_right = min(width, right + pad_w)

    face_rgb = rgb_img[new_top:new_bottom, new_left:new_right]
    return face_rgb if face_rgb.size > 0 else None


def get_employee_profile(rut: str) -> Optional[dict]:
    # Permitir rut numérico o string
    or_terms = [{"rut": rut}]
    try:
        or_terms.append({"rut": int(rut)})
    except Exception:
        pass
    emp = db.trabajadores_vpn.find_one({"$or": or_terms})
    return emp


from utils.r2_upload import upload_profile_image_to_r2
import hashlib

def _sync_image_with_intranet(rut_val: str, existing_doc: dict) -> Optional[str]:
    """
    Verifica si la imagen en la intranet (legacy) es diferente a la que tenemos en R2/Mongo.
    Si cambió (o no la tenemos), la descarga, sube a R2 y actualiza MongoDB.
    Retorna la nueva URL si hubo cambio, o None si no hubo cambio.
    """
    # Usar el rut almacenado en el doc para armar la URL (formato numérico usualmente)
    # Si rut_val viene sucio, confiamos en el del doc si existe.
    target_rut = str(existing_doc.get("rut") or rut_val)
    intranet_url = f"https://intranet.piccolaitalia.cl/images/uploaded/{target_rut}.jpg"
    
    try:
        # Timeout corto para no afectar UX de la consulta
        resp = requests.get(intranet_url, timeout=3)
        if resp.status_code != 200:
            return None
        
        img_bytes = resp.content
        if not img_bytes:
            return None

        # Calcular hash para detectar cambios
        new_hash = hashlib.sha256(img_bytes).hexdigest()
        
        stored_hash = existing_doc.get("profile_image_hash")
        stored_url = existing_doc.get("profile_image_url") or existing_doc.get("foto_url")

        # Si hash coincide y tenemos URL, no hacer nada
        if stored_hash == new_hash and stored_url:
            return None

        logger.info(f"Detectado cambio de imagen para rut {target_rut}. Sincronizando...")

        # Subir a R2
        file_obj = io.BytesIO(img_bytes)
        filename = f"trabajadores/{target_rut}.jpg"
        r2_url = upload_profile_image_to_r2(file_obj, filename)

        # Actualizar DB
        db.trabajadores_vpn.update_one(
            {"_id": existing_doc["_id"]},
            {
                "$set": {
                    "profile_image_url": r2_url,
                    "profile_image_hash": new_hash,
                    "updated_at": int(time.time())
                }
            }
        )
        return r2_url

    except Exception as e:
        logger.warning(f"_sync_image_with_intranet failed for {target_rut}: {e}")
        return None


@router.get("/registro/consulta", summary="Consulta si un RUT existe y si tiene foto de referencia")
async def consulta_registro(rut: str, user: dict = Depends(verify_session)):
    rut = (rut or "").strip()
    if not rut:
        raise HTTPException(status_code=400, detail="Debe enviar rut")
    # Validación de RUT chileno completo (número + DV)
    rutdv = rut + "-" + compute_dv(rut)
    if not is_valid_rut(rutdv):
        raise HTTPException(status_code=400, detail="RUT inválido")
    emp = get_employee_profile(rut)
    if not emp:
        return {"exists": False, "rut": rut}

    # --- Sync Imagen On-Demand ---
    # Antes de responder, chequeamos si la imagen cambió en la intranet
    try:
        new_url = _sync_image_with_intranet(rut, emp)
        if new_url:
            emp["profile_image_url"] = new_url
            emp["foto_url"] = new_url  # Forzar uso en lógica de abajo
    except Exception:
        pass
    # -----------------------------

    # Si ya existe una sesión completada o un vínculo activo, marcar como ya registrado
    existing_session = REG_SESSIONS.find_one({"rut": rut, "status": "completed"})
    existing_link = LINKS.find_one({"rut": rut, "status": "active"})
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
        "already_registered": bool(existing_session or existing_link),
    }

@router.post("/registro/solicitar", summary="Iniciar registro de empleado por RUT (gratis, con verificación facial)")
async def solicitar_registro(request: Request, user: dict = Depends(verify_session)):
    data = await request.json()
    rut = (data.get("rut") or "").strip()
    if not rut:
        raise HTTPException(status_code=400, detail="Debe enviar rut")
    # Validación de RUT chileno completo (número + DV)
    rutdv = rut + "-" + compute_dv(rut)
    if not is_valid_rut(rutdv):
        raise HTTPException(status_code=400, detail="RUT inválido")

    emp = get_employee_profile(rut)
    if not emp:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # No permitir nueva solicitud si ya hay sesión completada o vínculo activo
    existing_session = REG_SESSIONS.find_one({"rut": rut, "status": "completed"})
    if existing_session:
        raise HTTPException(status_code=409, detail="Este RUT ya completó su registro de empleado")
    existing_link = LINKS.find_one({"rut": rut, "status": "active"})
    if existing_link:
        raise HTTPException(status_code=409, detail="Este RUT ya tiene un usuario activo vinculado")

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


@router.post("/registro/escanear_carnet", summary="Validar carnet y extraer rostro para referencia")
async def escanear_carnet(
    rut: str = Form(...),
    front_image: UploadFile = File(...),
    user: dict = Depends(verify_session),
):
    """Escanea el carnet de identidad:

    - Valida que el RUT impreso coincida (o al menos el cuerpo) con el RUT objetivo.
    - Extrae el rostro oficial del plástico.
    - Genera un descriptor biométrico de referencia para usar en la validación en vivo.
    """
    start_time = time.time()
    rut = clean_rut(rut or "")
    if not rut:
        raise HTTPException(status_code=400, detail="Debe enviar rut")

    # Leer bytes de la imagen frontal
    front_bytes = await front_image.read()
    if not front_bytes:
        raise HTTPException(status_code=400, detail="Imagen frontal vacía")

    # Decodificar para OCR (PaddleOCR acepta ndarray)
    try:
        nparr = np.frombuffer(front_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("No se pudo decodificar la imagen")
    except Exception as e:
        logger.error(f"escanear_carnet: error decodificando imagen: {e}")
        raise HTTPException(status_code=400, detail="Imagen inválida o corrupta")

    # 1) OCR del carnet para extraer/validar el RUT impreso
    try:
        # Algunas versiones de PaddleOCR no aceptan el argumento keyword cls en .ocr()
        ocr_result = ocr_engine.ocr(img_bgr)
    except Exception as e:
        logger.error(f"escanear_carnet: error OCR: {e}")
        raise HTTPException(status_code=500, detail="Error procesando imagen del carnet")

    detected_texts: List[str] = []
    try:
        if ocr_result and ocr_result[0]:
            detected_texts = [line[1][0] for line in ocr_result[0]]
    except Exception as e:
        logger.warning(f"escanear_carnet: error parseando resultado OCR: {e}")

    logger.info(f"Texto detectado en carnet para rut objetivo {rut}: {detected_texts}")

    extracted_rut = extract_rut_from_text(detected_texts)

    if not extracted_rut:
        # Fallback: si no logramos extraer RUT completo, buscamos al menos el cuerpo
        body_rut = rut.split("-")[0]
        normalized_lines = [t.replace(".", "").replace(" ", "") for t in detected_texts]
        if not any(body_rut in txt for txt in normalized_lines):
            raise HTTPException(
                status_code=400,
                detail="No pudimos leer el RUT en la imagen. Asegúrate que el carnet esté nítido y sin brillos.",
            )
    else:
        # Validar coincidencia exacta de RUT si fue posible extraerlo
        clean_extracted = clean_rut(extracted_rut)
        if clean_extracted != rut:
            raise HTTPException(
                status_code=409,
                detail=f"El RUT del carnet ({extracted_rut}) no coincide con el empleado seleccionado.",
            )

    # 2) Extraer rostro desde el carnet usando InsightFace (ArcFace)
    reference_descriptor, emb_error, face_info = get_secure_face_embedding(front_bytes)
    if emb_error:
        raise HTTPException(status_code=400, detail=f"Error en carnet: {emb_error}")

    elapsed = time.time() - start_time
    logger.info(
        "escanear_carnet ok: rut=%s, extracted_rut=%s, elapsed=%.3fs",
        rut,
        extracted_rut,
        elapsed,
    )

    # Nota: por simplicidad devolvemos el descriptor al front para que lo use en /registro/validar
    # En una versión más estricta podrías guardar reference_descriptor en REG_SESSIONS
    return {
        "ok": True,
        "message": "Carnet validado y rostro extraído exitosamente.",
        "rut_detected": extracted_rut or rut,
        "reference_descriptor": reference_descriptor,
    }


@router.post("/registro/validar_arcface", summary="Validar selfie contra referencia (ArcFace, CPU)")
async def validar_registro_arcface(
    session_id: str = Form(...),
    rut: str = Form(...),
    live_image: UploadFile = File(...),
    reference_descriptor_json: str = Form(...),
    liveness: str = Form(None),
    user: dict = Depends(verify_session),
):
    """Endpoint alternativo que valida imagen en vivo contra descriptor de referencia usando InsightFace.

    No reemplaza al flujo legacy `/registro/validar`; puedes migrar el front gradualmente.
    """
    import json

    # 1) Parsear descriptor de referencia recibido del front (puede venir de carnet o JS)
    try:
        ref_vec = json.loads(reference_descriptor_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Descriptor de referencia corrupto")

    # 2) Procesar selfie en vivo en backend
    live_content = await live_image.read()
    live_vec, emb_error, live_info = get_secure_face_embedding(live_content)
    if emb_error:
        raise HTTPException(status_code=400, detail=f"Error en selfie: {emb_error}")

    # 2b) Asegurar que el descriptor de referencia tenga la misma dimensión que el embedding vivo (512D)
    # Si viene de face-api (128D), recalculamos referencia desde foto_url almacenado en la sesión.
    if not isinstance(ref_vec, list) or len(ref_vec) != len(live_vec):
        sess = REG_SESSIONS.find_one({"_id": session_id, "rut": rut})
        foto_url = sess.get("foto_url") if sess else None
        if not foto_url:
            raise HTTPException(
                status_code=400,
                detail="Referencia biométrica incompatible y sin foto de respaldo para recalcular.",
            )

        # Recalcular embedding de referencia desde foto_url en backend
        try:
            resp = requests.get(foto_url, timeout=5)
            if resp.status_code != 200 or not resp.content:
                raise ValueError("No se pudo descargar la foto de referencia")
            ref_vec, ref_err, _ = get_secure_face_embedding(resp.content)
            if ref_err:
                raise HTTPException(status_code=400, detail=f"Error en foto de referencia: {ref_err}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error("validar_registro_arcface: error recalculando referencia desde foto_url=%s: %s", foto_url, e)
            raise HTTPException(status_code=500, detail="Error técnico procesando la foto de referencia.")

    # 3) Comparación con similitud coseno
    similarity = compare_faces_cosine(live_vec, ref_vec)
    is_match = is_match_secure(similarity, threshold=SECURE_THRESHOLD)

    logger.info(
        "validar_registro_arcface rut=%s session_id=%s similarity=%.4f threshold=%.2f match=%s",
        rut,
        session_id,
        similarity,
        SECURE_THRESHOLD,
        is_match,
    )

    if not is_match:
        raise HTTPException(status_code=401, detail="Biometría fallida: el rostro no coincide con la referencia.")

    # --- 4) Liveness recibido como JSON opcional ---
    try:
        liveness_dict = json.loads(liveness) if liveness else {}
    except Exception:
        liveness_dict = {}

    # --- 5) Reutilizar lógica de activación (similar a validar_registro) ---

    # Obtener sesión y empleado
    sess = REG_SESSIONS.find_one({"_id": session_id, "rut": rut})
    if not sess:
        logger.warning("Sesión no encontrada (arcface): session_id=%s, rut=%s", session_id, rut)
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    emp = get_employee_profile(rut)
    if not emp:
        logger.warning("Trabajador no encontrado (arcface): rut=%s", rut)
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # No permitir duplicar vínculos activos para el mismo rut
    existing_link = LINKS.find_one({"rut": rut, "status": "active"})
    if existing_link:
        logger.info("Intento de registro duplicado (arcface) para rut=%s", rut)
        raise HTTPException(status_code=409, detail="Este RUT ya tiene un usuario activo vinculado")

    # Resolver identidad (email/sub/wallet) desde sesión auth
    sub = user.get("sub")
    wallet = user.get("wallet")
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

    identity = {"email": email, "sub": sub}
    if wallet:
        identity["wallet"] = wallet

    # Protección de unicidad identidad->rut
    conflict_filters = []
    if sub:
        conflict_filters.append({"sub": sub})
    if wallet:
        conflict_filters.append({"wallet": wallet})

    if conflict_filters:
        conflict_query = {
            "$and": [
                {"$or": conflict_filters},
                {"rut": {"$ne": rut}},
                {"status": {"$ne": "deleted"}},
            ]
        }
        existing_identity_link = LINKS.find_one(conflict_query)
        if existing_identity_link:
            logger.warning(
                "Intento de vincular identidad ya usada (arcface): sub=%s, wallet=%s, nuevo_rut=%s, existente_rut=%s",
                sub,
                wallet,
                rut,
                existing_identity_link.get("rut"),
            )
            raise HTTPException(
                status_code=409,
                detail="Esta identidad (wallet/sub) ya está vinculada a otro RUT. Contacta a un administrador para corregir el registro.",
            )

    # Datos de cargo/sección
    cargo = (emp.get("cargo") or "").strip() or None
    seccion = None
    try:
        if cargo:
            ci = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
            if ci and ci.get("seccion"):
                seccion = ci.get("seccion")
    except Exception:
        pass

    # Upsert a empleados_usuarios con metadata biométrica basada en ArcFace
    update_fields = {
        "rut": rut,
        "email": email,
        "sub": sub,
        "linked_at": int(time.time()),
        "biometric": {
            "similarity": similarity,
            "threshold": SECURE_THRESHOLD,
            "liveness": liveness_dict,
            "session_id": session_id,
            "engine": "arcface",
        },
        "status": "active",
        "role": "employee",
        "cargo": cargo,
        "seccion": seccion,
    }
    if wallet:
        update_fields["wallet"] = wallet

    LINKS.update_one(
        {"rut": rut},
        {"$set": update_fields, "$setOnInsert": {"created_at": int(time.time())}},
        upsert=True,
    )

    # Marcar sesión como completada
    REG_SESSIONS.update_one(
        {"_id": session_id},
        {"$set": {"status": "completed", "completed_at": int(time.time())}},
    )

    return {
        "ok": True,
        "rut": rut,
        **identity,
        "similarity": similarity,
        "message": "Identidad verificada y cuenta de empleado activada (ArcFace).",
    }