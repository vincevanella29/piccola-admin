from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Request
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import logging
import os
import uuid
from pydantic import BaseModel, Field
from utils.web3mongo import db
from utils.r2_upload import upload_to_r2
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from .apikeys import validate_api_key
from config.menus.public_catalog import EXTERNAL_API_KEY as CARTA_API_KEY
from config.menus import sync as sync_svc

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))

class BannerButtonConfig(BaseModel):
    """Button displayed on the banner in the carta — fully configured from admin."""
    visible: bool = False
    text: str = ""
    position: str = "bottom-right"  # bottom-left, bottom-right, bottom-center, center
    style: str = "solid"            # solid, outline, glass
    color: str = "#22c55e"          # hex color
    text_color: str = "#ffffff"

class BannerCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    image_url: str
    click_url: Optional[str] = ""
    target_type: str = Field(..., pattern="^(location|dish|global|category)$")
    target_ids: List[str] = []
    location_ids: List[str] = []          # sucursales where this banner shows
    active: bool = True                    # active by default on creation
    priority: int = 0
    popup_duration_seconds: int = 0       # 0 to disable auto-close
    display_delay_seconds: int = 0
    # Image size / aspect
    image_size: str = "3:1"               # 3:1, 2:1, 16:9, 1:1, 4:3, 9:16
    # Device visibility
    display_devices: List[str] = ["mobile", "desktop"]  # which devices show this banner
    # Button config
    button_config: Optional[dict] = None  # BannerButtonConfig as dict
    # Schedule
    schedule_start: Optional[str] = None  # ISO date YYYY-MM-DD
    schedule_end: Optional[str] = None    # ISO date YYYY-MM-DD
    schedule_days: Optional[List[int]] = None   # 0=Mon..6=Sun, None=every day
    schedule_time_from: Optional[str] = None    # HH:MM
    schedule_time_to: Optional[str] = None      # HH:MM

class BannerUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    click_url: Optional[str] = None
    target_type: Optional[str] = None
    target_ids: Optional[List[str]] = None
    location_ids: Optional[List[str]] = None
    active: Optional[bool] = None
    priority: Optional[int] = None
    popup_duration_seconds: Optional[int] = None
    display_delay_seconds: Optional[int] = None
    # Image size / aspect
    image_size: Optional[str] = None
    # Device visibility
    display_devices: Optional[List[str]] = None  # ["mobile", "desktop"]
    # Button config
    button_config: Optional[dict] = None
    # Schedule
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None
    schedule_days: Optional[List[int]] = None
    schedule_time_from: Optional[str] = None
    schedule_time_to: Optional[str] = None

def make_serializable(doc):
    if not doc: return None
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc

async def require_banners_role(user: dict = Depends(verify_session)):
    """Guard on-chain: requiere nivel 3, 4 o 5 (DOMINUS, CENTURIO o MILITES)."""
    require_admin_level(user, "member")
    return user

@router.post("/banners")
async def create_banner(data: BannerCreate, user: dict = Depends(require_banners_role)):
    try:
        banner_doc = data.dict()
        banner_doc["company_id"] = COMPANY_ID
        banner_doc["created_at"] = datetime.utcnow()
        banner_doc["updated_at"] = datetime.utcnow()
        banner_doc["created_by"] = user["wallet"]
        
        result = db.banners.insert_one(banner_doc)
        banner_doc["id"] = str(result.inserted_id)
        del banner_doc["_id"]
        return banner_doc
    except Exception as e:
        logger.error(f"Error creating banner: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/banners")
async def get_banners(
    active_only: bool = False,
    section: Optional[str] = None,
    user: dict = Depends(require_banners_role)
):
    try:
        query = {"company_id": COMPANY_ID}
        if active_only:
            query["active"] = True
            
        banners = list(db.banners.find(query).sort("priority", -1))
        return [make_serializable(b) for b in banners]
    except Exception as e:
        logger.error(f"Error fetching banners: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/public/banners")
async def get_public_banners(
    request: Request,
    only_active: bool = True
):
    """
    Public endpoint for Carta. Accepts:
      1. The static Carta API key (same as /public/menus_catalog)
      2. A dynamic API key from the apikeys collection (backward-compat)
    """
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header missing")

    company_id = None

    # 1. Check against the static Carta API key
    if api_key == CARTA_API_KEY:
        company_id = COMPANY_ID
    else:
        # 2. Fallback: look up in the apikeys collection
        key_info = validate_api_key(api_key)
        if not key_info:
            raise HTTPException(status_code=403, detail="Invalid or inactive API Key")
        company_id = key_info.get("company_id")
        if company_id is None:
            raise HTTPException(status_code=403, detail="API Key not associated with a company")

    try:
        query = {"company_id": company_id}
        if only_active:
            query["active"] = True

        banners = list(db.banners.find(query).sort("priority", -1))
        return [make_serializable(b) for b in banners]
    except Exception as e:
        logger.error(f"Error fetching public banners: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/banners/{banner_id}")
async def update_banner(banner_id: str, data: BannerUpdate, user: dict = Depends(require_banners_role)):
    try:
        # exclude_unset=True → fields NOT sent are ignored, but explicit null IS saved (allows clearing)
        update_data = data.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        result = db.banners.update_one(
            {"_id": ObjectId(banner_id), "company_id": COMPANY_ID},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Banner not found")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating banner {banner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, user: dict = Depends(require_banners_role)):
    try:
        result = db.banners.delete_one({"_id": ObjectId(banner_id), "company_id": COMPANY_ID})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Banner not found")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting banner {banner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/banners/upload")
async def upload_banner_image(file: UploadFile = File(...), user: dict = Depends(require_banners_role)):
    try:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        filename = f"banners/{uuid.uuid4()}{ext}"
        content_type = file.content_type or "image/webp"
        
        url = upload_to_r2(file.file, filename, content_type=content_type)
        return {"url": url}
    except Exception as e:
        logger.error(f"Error uploading banner image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Banner Generation ──────────────────────────────────────────────────────

class BannerAIGenerateRequest(BaseModel):
    headline: str = ""
    promo_text: str = ""
    style: str = "promo_dark"
    image_size: str = "3:1"            # aspect ratio for AI generation (3:1, 2:1, 16:9, 4:3, 1:1, 9:16)
    product_ids: List[str] = []        # up to 4 product IDs to compose
    product_images: List[str] = []     # up to 4 product image URLs (fallback)
    location_name: str = ""
    location_desc: str = ""
    banner_id: Optional[str] = None    # link to existing banner
    wallet: Optional[str] = None


@router.post("/banners/ai-generate")
async def generate_banner_ai(req: BannerAIGenerateRequest, user: dict = Depends(require_banners_role)):
    """
    Generate a promotional banner image with Aurora AI.
    Composes up to 4 product images into a banner with text overlays.
    """
    from config.ai_image.aurora_client import AuroraClient, IMAGE_MODEL_PRO
    from config.ai_image.aurora_banner_client import (
        build_banner_prompt, upload_banner_ai_image,
        save_banner_generation,
    )

    # Resolve product names and images from IDs
    product_names = []
    product_images = list(req.product_images)[:4]

    if req.product_ids:
        for pid in req.product_ids[:4]:
            q = {"$or": [{"id": pid}]}
            try:
                q["$or"].append({"_id": __import__("bson").ObjectId(pid)})
            except Exception:
                pass
            try:
                q["$or"].append({"id": int(pid)})
            except (ValueError, TypeError):
                pass
            doc = db.menus.find_one(q)
            if doc:
                product_names.append(doc.get("nombre", pid))
                # Use product's main image if not passed
                if len(product_images) < len(req.product_ids):
                    img = doc.get("media_r2") or doc.get("media_url") or ""
                    if img:
                        product_images.append(img)

    prompt = build_banner_prompt(
        product_names=product_names,
        product_images=product_images,
        headline=req.headline,
        promo_text=req.promo_text,
        style=req.style,
        image_size=req.image_size,
        location_name=req.location_name,
        location_desc=req.location_desc,
    )

    logger.debug(f"[banners] AI GENERATE: products={product_names}, style={req.style}")

    aurora = AuroraClient()

    # If we have reference images, use the first one for image-to-image
    ref_url = product_images[0] if product_images else None
    image_bytes, revised = await aurora.generate_image_with_fallback(
        prompt=prompt,
        model=IMAGE_MODEL_PRO,
        ref_url=ref_url,
    )

    image_url = upload_banner_ai_image(image_bytes, req.headline or "banner")
    wallet = (req.wallet or user.get("wallet", "anonymous")).lower().strip()

    generation_id = save_banner_generation(
        banner_id=req.banner_id,
        image_url=image_url,
        prompt_headline=req.headline,
        model=IMAGE_MODEL_PRO,
        wallet=wallet,
        product_names=product_names,
        style=req.style,
    )

    return {
        "generation_id": generation_id,
        "image_url": image_url,
        "revised_prompt": revised,
        "model_used": IMAGE_MODEL_PRO,
    }


@router.get("/banners/ai-history")
async def get_banner_ai_history(limit: int = 50, user: dict = Depends(require_banners_role)):
    """Get AI banner generation history."""
    from config.ai_image.aurora_banner_client import get_banner_generation_history
    items = get_banner_generation_history(limit=limit)
    return {"items": items, "total": len(items)}


@router.get("/banners/ai-styles")
async def get_banner_ai_styles():
    """Get available AI banner styles."""
    from config.ai_image.aurora_banner_client import BANNER_STYLES
    return {"styles": BANNER_STYLES}

@router.post("/banners/trigger-sync")
async def trigger_banners_sync(user: dict = Depends(require_banners_role)):
    """
    Notifica a la carta digital para que re-sincronice sus banners desde el admin.
    Usa la misma key y el mismo patrón que /carta/trigger-public-sync.
    Propaga cooldown (429) si la carta está en cooldown.
    """
    result = await sync_svc.trigger_banners_sync()
    if not result.get("ok"):
        status_code = result.get("status") or 500
        http_status = 429 if status_code == 429 else (502 if status_code != 200 else 500)
        raise HTTPException(
            status_code=http_status,
            detail=result.get("detail") or "El worker de la carta no respondió correctamente.",
        )
    return {
        "success": True,
        "message": "Banners sincronizados con la carta",
        "worker": result.get("detail"),
    }
