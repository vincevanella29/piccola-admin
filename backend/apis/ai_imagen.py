"""
AI Imagen & Video API — Piccola Italia Admin
============================================

Endpoints:
  POST /carta/ai-imagen/generate             → Imagen premium (image-to-image con Aurora)
  POST /carta/ai-imagen/generate-video       → Video cinematic (Aurora video)
  POST /carta/ai-imagen/generate-description → Descripción gastronómica (Grok texto)
  POST /carta/ai-imagen/feedback             → Feedback usuario (aceptó/rechazó)
  GET  /carta/ai-imagen/stats                → Estadísticas de uso

Toda la lógica de Aurora está en config/aurora_client.py
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

from config.ai_image.aurora_client import (
    AuroraClient,
    IMAGE_MODEL_PRO, IMAGE_MODEL_STD, VIDEO_MODEL,
    COLORES_RECIPIENTE, COLORES_FONDO,
    build_image_prompt, build_video_prompt,
    add_image_to_gallery, update_product_video,
    update_product_description, upload_image, upload_video,
)
from utils.web3mongo import db

import os
import redis as redis_lib

router = APIRouter()

# ── Logger ────────────────────────────────────────────────────────────────────

logger = logging.getLogger("ai_imagen")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)
logger.propagate = False

# ── Rate limiting (Redis) ─────────────────────────────────────────────────────

RATE_IMG_LIMIT   = int(os.getenv("AI_IMAGEN_RATE_LIMIT_HOUR", "100"))
RATE_VIDEO_LIMIT = int(os.getenv("AI_VIDEO_RATE_LIMIT_HOUR",  "20"))
RATE_DESC_LIMIT  = int(os.getenv("AI_DESC_RATE_LIMIT_HOUR",   "200"))
RATE_WINDOW_SEC  = 3600

_REDIS_URL = (
    f"redis://{os.getenv('REDIS_HOST', 'localhost')}:"
    f"{os.getenv('REDIS_PORT', '6379')}/"
    f"{os.getenv('REDIS_DB', '0')}"
)
try:
    _redis = redis_lib.from_url(_REDIS_URL, decode_responses=True)
    _redis.ping()
    _REDIS_OK = True
    logger.info("[ai_imagen] Redis OK para rate limiting")
except Exception as e:
    _redis = None
    _REDIS_OK = False
    logger.warning(f"[ai_imagen] Redis no disponible: {e}")


def _check_rate_limit(wallet: str, kind: str = "img") -> tuple[int, int]:
    limits = {"img": RATE_IMG_LIMIT, "video": RATE_VIDEO_LIMIT, "desc": RATE_DESC_LIMIT}
    limit = limits.get(kind, RATE_IMG_LIMIT)
    if not _REDIS_OK or not _redis:
        return 0, limit
    key = f"ai:{kind}:rl:{wallet.lower()}"
    try:
        pipe = _redis.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        count_raw, ttl = pipe.execute()
        count = int(count_raw)
        if ttl < 0:
            _redis.expire(key, RATE_WINDOW_SEC)
        if count > limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Límite de {limit} generaciones/{kind} por hora alcanzado.",
                    "used": count, "limit": limit,
                    "retry_after_seconds": max(ttl, RATE_WINDOW_SEC),
                },
            )
        return count, limit
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[ai_imagen] Error rate limit: {e}")
        return 0, limit


def _wallet(w: Optional[str]) -> str:
    return (w or "anonymous").lower().strip()


# ── Pydantic models ───────────────────────────────────────────────────────────

class ImageStyleOptions(BaseModel):
    """
    Opciones de estilo controladas desde el front.
    color_recipiente: None = mantener plato original | key de COLORES_RECIPIENTE = transformar
    color_fondo:      key de COLORES_FONDO (default negro_absoluto)
    """
    color_recipiente:  Optional[str] = None
    color_fondo:       str           = "negro_absoluto"
    mejorar_texturas:  bool          = True
    agregar_garnitura: bool          = True
    agregar_branding:  bool          = False


class GenerateImageRequest(BaseModel):
    product_id:          Optional[str]        = None
    nombre:              str
    descripcion:         Optional[str]        = ""
    categoria:           Optional[str]        = ""
    codigo:              Optional[str]        = ""
    precio:              Optional[float]      = None
    reference_image_url: Optional[str]        = None   # URL imagen a mejorar (requerida para img2img)
    wallet:              Optional[str]        = None
    use_pro_model:       bool                 = True
    add_to_gallery:      bool                 = True
    style_options:       ImageStyleOptions    = ImageStyleOptions()


class GenerateImageResponse(BaseModel):
    generation_id:  str
    image_url:      str
    description:    Optional[str] = None
    revised_prompt: Optional[str] = None
    model_used:     Optional[str] = None
    rate_used:      Optional[int] = None
    rate_limit:     Optional[int] = None
    gallery_count:  Optional[int] = None


class GenerateVideoRequest(BaseModel):
    product_id:          Optional[str]  = None
    nombre:              str
    descripcion:         Optional[str]  = ""
    categoria:           Optional[str]  = ""
    wallet:              Optional[str]  = None
    reference_image_url: str                    # Requerida para video
    duration_seconds:    int            = 4
    add_to_product:      bool           = True
    style_options:       ImageStyleOptions    = ImageStyleOptions()


class GenerateVideoResponse(BaseModel):
    generation_id: str
    video_url:  str
    model_used: Optional[str] = None
    rate_used:  Optional[int] = None
    rate_limit: Optional[int] = None


class GenerateDescriptionRequest(BaseModel):
    product_id:     Optional[str]   = None
    nombre:         str
    descripcion:    Optional[str]   = ""
    categoria:      Optional[str]   = ""
    precio:         Optional[float] = None
    codigo:         Optional[str]   = ""
    wallet:         Optional[str]   = None
    update_product: bool            = False


class GenerateDescriptionResponse(BaseModel):
    generation_id: str
    description: str
    rate_used:   Optional[int] = None
    rate_limit:  Optional[int] = None


class FeedbackRequest(BaseModel):
    generation_id: str
    product_id:    Optional[str] = None
    accepted:      bool
    wallet:        Optional[str] = None
    image_url:     Optional[str] = None
    comment:       Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/carta/ai-imagen/generate", response_model=GenerateImageResponse)
async def generate_product_image(req: GenerateImageRequest, user: dict = Depends(verify_session)):
    """
    Mejora la imagen del producto con Aurora (image-to-image).
    Requiere reference_image_url — imagen que el usuario seleccionó en la galería.
    Requiere nivel on-chain 3, 4 o 5 (DOMINUS, CENTURIO o MILITES).
    """
    require_admin_level(user, "member")
    wallet = _wallet(req.wallet)
    used, limit = _check_rate_limit(wallet, kind="img")
    model = IMAGE_MODEL_PRO if req.use_pro_model else IMAGE_MODEL_STD
    style = req.style_options

    logger.info(
        f"\n{'='*60}\n"
        f"[ai_imagen] GENERATE IMAGE\n"
        f"  producto : '{req.nombre}' (id={req.product_id})\n"
        f"  model    : {model}\n"
        f"  ref_url  : {req.reference_image_url or '(NINGUNA — text-to-image)'}\n"
        f"  style    : fondo={style.color_fondo} | plato={style.color_recipiente or 'original'} "
        f"| texturas={style.mejorar_texturas} | garnitura={style.agregar_garnitura}\n"
        f"{'='*60}"
    )

    prompt = build_image_prompt(
        nombre=req.nombre,
        descripcion=req.descripcion or "",
        categoria=req.categoria or "",
        precio=req.precio,
        color_fondo=style.color_fondo,
        color_recipiente=style.color_recipiente,
        mejorar_texturas=style.mejorar_texturas,
        agregar_garnitura=style.agregar_garnitura,
        agregar_branding=style.agregar_branding,
    )

    logger.info(f"[ai_imagen] Prompt ({len(prompt)} chars):\n{prompt}")

    aurora = AuroraClient()
    image_bytes, revised_prompt = await aurora.generate_image_with_fallback(
        prompt=prompt,
        model=model,
        ref_url=req.reference_image_url or None,
    )

    image_url     = upload_image(image_bytes, req.nombre)
    generation_id = uuid.uuid4().hex
    gallery_count = None

    if req.add_to_gallery and req.product_id:
        gallery_count = add_image_to_gallery(req.product_id, image_url)

    db.ai_imagen_generations.insert_one({
        "_id":           generation_id,
        "product_id":    req.product_id,
        "wallet":        wallet,
        "image_url":     image_url,
        "model":         model,
        "prompt_nombre": req.nombre,
        "had_reference": bool(req.reference_image_url),
        "accepted":      None,
        "created_at":    datetime.now(timezone.utc),
    })

    logger.info(f"[ai_imagen] ✅ IMG OK gen_id={generation_id} url={image_url}")

    return GenerateImageResponse(
        generation_id=generation_id,
        image_url=image_url,
        description=None,
        revised_prompt=revised_prompt,
        model_used=model,
        rate_used=used,
        rate_limit=limit,
        gallery_count=gallery_count,
    )


@router.post("/carta/ai-imagen/generate-video", response_model=GenerateVideoResponse)
async def generate_product_video(req: GenerateVideoRequest, user: dict = Depends(verify_session)):
    """
    Genera video cinematic del producto con Aurora (grok-imagine-video).

    Flujo correcto según docs xAI:
      1. POST /v1/videos/generations  → devuelve request_id  (async)
      2. GET  /v1/videos/{request_id} → polling hasta status='done'
      3. Descargar video desde data.video.url

    reference_image_url: URL pública o base64 data URI.
    Requiere nivel on-chain 3, 4 o 5.
    """
    require_admin_level(user, "member")
    wallet = _wallet(req.wallet)
    used, limit = _check_rate_limit(wallet, kind="video")

    logger.info(f"[ai_imagen] VIDEO: producto='{req.nombre}' ref={req.reference_image_url}")

    style = req.style_options
    prompt = build_video_prompt(
        nombre=req.nombre,
        categoria=req.categoria or "",
        descripcion=req.descripcion or "",
        duration=req.duration_seconds,
        color_fondo=style.color_fondo,
        color_recipiente=style.color_recipiente,
    )

    aurora = AuroraClient()

    # Intentar primero con URL pública directa (más rápido, no requiere descarga).
    # Si la URL es inaccesible desde xAI, hacer fallback a base64.
    ref_url = req.reference_image_url
    ref_b64 = None

    try:
        video_bytes = await aurora.generate_video(prompt, ref_url=ref_url)
    except Exception as e:
        logger.warning(f"[ai_imagen] VIDEO con URL pública falló: {e} — reintentando con base64...")
        ref_b64 = await aurora.fetch_image_as_b64(ref_url)
        if not ref_b64:
            raise HTTPException(status_code=400, detail="No se pudo obtener la imagen de referencia para el video")
        video_bytes = await aurora.generate_video(prompt, ref_b64=ref_b64)

    video_url = upload_video(video_bytes, req.nombre)

    if req.add_to_product and req.product_id:
        update_product_video(req.product_id, video_url)

    # Persist generation for history & feedback tracking
    generation_id = uuid.uuid4().hex
    db.ai_imagen_generations.insert_one({
        "_id":           generation_id,
        "product_id":    req.product_id,
        "wallet":        wallet,
        "video_url":     video_url,
        "model":         VIDEO_MODEL,
        "prompt_nombre": req.nombre,
        "accepted":      None,
        "created_at":    datetime.now(timezone.utc),
    })

    logger.info(f"[ai_imagen] ✅ VIDEO OK gen_id={generation_id} url={video_url}")

    return GenerateVideoResponse(
        generation_id=generation_id,
        video_url=video_url,
        model_used=VIDEO_MODEL,
        rate_used=used,
        rate_limit=limit,
    )


@router.post("/carta/ai-imagen/generate-description", response_model=GenerateDescriptionResponse)
async def generate_product_description(req: GenerateDescriptionRequest, user: dict = Depends(verify_session)):
    """Genera descripción gastronómica premium com Grok. Requiere nivel on-chain 3, 4 o 5."""
    require_admin_level(user, "member")
    wallet = _wallet(req.wallet)
    used, limit = _check_rate_limit(wallet, kind="desc")

    aurora = AuroraClient()
    description = await aurora.generate_description(
        nombre=req.nombre,
        descripcion=req.descripcion or "",
        categoria=req.categoria or "",
        precio=req.precio,
        codigo=req.codigo or None,
    )

    if req.update_product and req.product_id and description:
        update_product_description(req.product_id, description)

    # Persist generation for history & feedback tracking
    generation_id = uuid.uuid4().hex
    db.ai_imagen_generations.insert_one({
        "_id":           generation_id,
        "product_id":    req.product_id,
        "wallet":        wallet,
        "description":   description,
        "model":         "grok-description",
        "prompt_nombre": req.nombre,
        "accepted":      None,
        "created_at":    datetime.now(timezone.utc),
    })

    return GenerateDescriptionResponse(
        generation_id=generation_id,
        description=description,
        rate_used=used,
        rate_limit=limit,
    )


@router.post("/carta/ai-imagen/feedback")
async def save_imagen_feedback(req: FeedbackRequest, user: dict = Depends(verify_session)):
    """Guarda feedback del usuario (aceptó/rechazó imagen). Requiere nivel on-chain 3, 4 o 5."""
    require_admin_level(user, "member")
    wallet = _wallet(req.wallet)

    db.ai_imagen_generations.update_one(
        {"_id": req.generation_id},
        {"$set": {"accepted": req.accepted, "feedback_at": datetime.now(timezone.utc)}},
    )

    db.ai_imagen_feedback.insert_one({
        "generation_id": req.generation_id,
        "product_id":    req.product_id,
        "wallet":        wallet,
        "accepted":      req.accepted,
        "image_url":     req.image_url,
        "comment":       req.comment,
        "created_at":    datetime.now(timezone.utc),
    })

    if not req.accepted and req.product_id and req.image_url:
        q: dict = {"$or": [{"id": req.product_id}]}
        try:
            q["$or"].append({"_id": ObjectId(req.product_id)})
        except Exception:
            pass
        db.menus.update_one(q, {"$pull": {"media_images": req.image_url}})
        doc = db.menus.find_one(q)
        if doc and doc.get("media_r2") == req.image_url:
            imgs = doc.get("media_images") or []
            db.menus.update_one(q, {"$set": {
                "media_r2":   imgs[0] if imgs else "",
                "media_url":  imgs[0] if imgs else "",
                "updated_at": datetime.now(timezone.utc),
            }})

    action = "aceptada ✓" if req.accepted else "rechazada ✗"
    logger.info(f"[ai_imagen] Feedback gen={req.generation_id} {action}")

    return {"success": True, "accepted": req.accepted}


@router.get("/carta/ai-imagen/stats")
async def get_imagen_stats():
    """Estadísticas de uso del sistema de AI Imagen."""
    total    = db.ai_imagen_generations.count_documents({})
    accepted = db.ai_imagen_generations.count_documents({"accepted": True})
    rejected = db.ai_imagen_generations.count_documents({"accepted": False})
    pending  = db.ai_imagen_generations.count_documents({"accepted": None})
    videos   = db.ai_imagen_generations.count_documents({"model": VIDEO_MODEL})
    accept_rate = round(accepted / (accepted + rejected) * 100, 1) if (accepted + rejected) > 0 else None

    return {
        "total_generations": total,
        "images":  {"accepted": accepted, "rejected": rejected, "pending": pending},
        "videos":  videos,
        "acceptance_rate_pct": accept_rate,
    }


@router.get("/carta/ai-imagen/history/{product_id}")
async def get_product_generation_history(
    product_id: str,
    limit: int = 30,
):
    """
    Historial de generaciones de Aurora para un producto.
    Devuelve imágenes, videos y descripciones ordenadas por fecha desc.
    Busca por product_id como string Y como int para compatibilidad robusta.
    """
    # Construir query robusto: el product_id puede estar guardado como string o int
    pid_variants: list = [product_id]
    try:
        pid_int = int(product_id)
        pid_variants.append(pid_int)
    except (ValueError, TypeError):
        pass

    q = {"product_id": {"$in": pid_variants}}
    cursor = db.ai_imagen_generations.find(
        q,
        {"_id": 1, "image_url": 1, "video_url": 1, "description": 1,
         "model": 1, "accepted": 1, "created_at": 1, "feedback_at": 1, "style": 1}
    ).sort("created_at", -1).limit(limit)

    items = []
    for doc in cursor:
        items.append({
            "generation_id": doc["_id"],
            "image_url":     doc.get("image_url"),
            "video_url":     doc.get("video_url"),
            "description":   doc.get("description"),
            "model":         doc.get("model", ""),
            "accepted":      doc.get("accepted"),   # True / False / None (pendiente)
            "created_at":    doc.get("created_at", "").isoformat() if hasattr(doc.get("created_at",""), "isoformat") else str(doc.get("created_at","")),
            "feedback_at":   doc.get("feedback_at", "").isoformat() if hasattr(doc.get("feedback_at",""), "isoformat") else None,
            "style":         doc.get("style", ""),
        })

    logger.info(f"[ai_imagen] History {product_id} → {len(items)} items")
    return {"product_id": product_id, "items": items, "total": len(items)}
