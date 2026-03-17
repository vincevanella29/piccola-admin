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

class BannerCreate(BaseModel):
    title: str
    image_url: str
    click_url: Optional[str] = ""
    target_type: str = Field(..., pattern="^(location|dish|global|category)$")

    target_ids: List[str] = []
    priority: int = 0
    popup_duration_seconds: int = 0  # 0 to disable auto-close
    display_delay_seconds: int = 0

class BannerUpdate(BaseModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    click_url: Optional[str] = None
    target_type: Optional[str] = None
    target_ids: Optional[List[str]] = None
    active: Optional[bool] = None
    priority: Optional[int] = None
    popup_duration_seconds: Optional[int] = None
    display_delay_seconds: Optional[int] = None

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
        update_data = {k: v for k, v in data.dict().items() if v is not None}
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
