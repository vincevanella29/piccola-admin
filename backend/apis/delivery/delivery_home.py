"""
delivery/delivery_home.py
=========================
Admin panel for managing the Delivery Home page configuration.
Stores hero banners, featured promos, announcement bar, and featured categories
in MongoDB. Images are uploaded to R2. Publishes to delivery providers with
Dilithium2 post-quantum signature.
"""

import logging
import os
import uuid
import json
import time
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from utils.web3mongo import db
from utils.r2_upload import upload_to_r2
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

HOME_COLL = db["delivery_home_config"]
PROVIDERS_COLL = db["delivery_providers"]
HOME_TYPE = "home_config"


# ── Default config (template — matches delivery's home_config.py) ─────────────

DEFAULT_HOME_CONFIG = {
    "hero_banners": [
        {
            "id": "default-1",
            "image": "/assets/banners/promo_pizza_2x1_1775785960018.png",
            "mobile_image": None,
            "title": "LAS MEJORES",
            "subtitle": "PIZZAS ARTESANALES",
            "promo_price": "$12.990",
            "badge": "Familiar",
            "cta_text": "Pide Ahora",
            "cta_link": None,
            "active": True,
            "priority": 1,
        },
        {
            "id": "default-2",
            "image": "/assets/banners/promo_pasta_combo_1775785995495.png",
            "mobile_image": None,
            "title": "PASTAS & VINO",
            "subtitle": "EL COMBO PERFECTO",
            "promo_price": "$9.990",
            "badge": "Especial",
            "cta_text": "Ver Menú",
            "cta_link": None,
            "active": True,
            "priority": 2,
        },
        {
            "id": "default-3",
            "image": "/assets/banners/promo_dessert_new_1775786010530.png",
            "mobile_image": None,
            "title": "NUEVO POSTRE",
            "subtitle": "TIRAMISÚ ROYAL",
            "promo_price": "$4.500",
            "badge": "Nuevo!",
            "cta_text": "Pide Ahora",
            "cta_link": None,
            "active": True,
            "priority": 3,
        },
    ],
    "featured_promos": [
        {
            "id": "promo-1",
            "image": "/assets/banners/promo_pizza_2x1_1775785960018.png",
            "title": "Combo Familiar Pizza",
            "price": "$15.990",
            "link": None,
            "active": True,
        },
        {
            "id": "promo-2",
            "image": "/assets/banners/promo_pasta_combo_1775785995495.png",
            "title": "Noche de Pastas",
            "price": "$12.500",
            "link": None,
            "active": True,
        },
        {
            "id": "promo-3",
            "image": "/assets/banners/promo_dessert_new_1775786010530.png",
            "title": "Tiramisú Especial",
            "price": "$4.990",
            "link": None,
            "active": True,
        },
    ],
    "featured_categories": [
        {
            "slug": "pizzas",
            "name": "Pizzas",
            "image": "/assets/categories/cat_pizza_card_1775787751451.png",
        },
        {
            "slug": "pastas",
            "name": "Pastas",
            "image": "/assets/categories/cat_pasta_card_1775787789708.png",
        },
        {
            "slug": "entradas",
            "name": "Entradas",
            "image": None,
        },
        {
            "slug": "nuevos platos piccola",
            "name": "Nuevos Platos Piccola",
            "image": None,
        },
        {
            "slug": "papas fritas",
            "name": "Papas Fritas",
            "image": "/assets/categories/cat_sides_card_1775787805092.png",
        },
        {
            "slug": "postres",
            "name": "Postres",
            "image": None,
        },
    ],
    "announcement": {
        "text": "🔥 Envío gratis en pedidos sobre $15.000",
        "active": True,
    },
}


# ── Guard ─────────────────────────────────────────────────────────────────────

async def require_home_role(user: dict = Depends(verify_session)):
    """Require admin level (3+) to manage delivery home config."""
    require_admin_level(user, "member")
    return user


# ── Models ────────────────────────────────────────────────────────────────────

class HeroBanner(BaseModel):
    id: str = ""
    image: str = ""
    mobile_image: Optional[str] = None
    title: Optional[str] = ""
    subtitle: Optional[str] = ""
    promo_price: Optional[str] = ""
    badge: Optional[str] = ""
    cta_text: str = "Pide Ahora"
    cta_link: Optional[str] = None
    active: bool = True
    priority: int = 99


class FeaturedPromo(BaseModel):
    id: str = ""
    image: str = ""
    title: str = ""
    price: Optional[str] = ""
    link: Optional[str] = None
    active: bool = True


class Announcement(BaseModel):
    text: str = ""
    active: bool = False


class FeaturedCategory(BaseModel):
    slug: str = ""
    name: str = ""
    image: Optional[str] = None


class HomeConfigPayload(BaseModel):
    hero_banners: Optional[List[HeroBanner]] = None
    featured_promos: Optional[List[FeaturedPromo]] = None
    featured_categories: Optional[List[FeaturedCategory]] = None
    announcement: Optional[Announcement] = None


# ── GET /delivery/home-config — Read current config ──────────────────────────

@router.get("/delivery/home-config", summary="Get delivery home config")
async def get_home_config(user: dict = Depends(require_home_role)):
    doc = HOME_COLL.find_one({"_type": HOME_TYPE}, {"_id": 0})

    if not doc:
        logger.info("[delivery-home] No config in DB, returning defaults")
        return {**DEFAULT_HOME_CONFIG, "updated_at": None}

    return {
        "hero_banners": doc.get("hero_banners", []),
        "featured_promos": doc.get("featured_promos", []),
        "featured_categories": doc.get("featured_categories", []),
        "announcement": doc.get("announcement", {"text": "", "active": False}),
        "updated_at": doc.get("updated_at"),
    }


# ── PUT /delivery/home-config — Save config ─────────────────────────────────

@router.put("/delivery/home-config", summary="Save delivery home config")
async def save_home_config(payload: HomeConfigPayload, user: dict = Depends(require_home_role)):
    update = {"_type": HOME_TYPE, "updated_at": datetime.now(timezone.utc)}

    if payload.hero_banners is not None:
        banners = []
        for b in payload.hero_banners:
            d = b.dict()
            if not d.get("id"):
                d["id"] = uuid.uuid4().hex[:12]
            banners.append(d)
        update["hero_banners"] = banners
        logger.info(f"[delivery-home] Saving {len(banners)} hero banners")

    if payload.featured_promos is not None:
        promos = []
        for p in payload.featured_promos:
            d = p.dict()
            if not d.get("id"):
                d["id"] = uuid.uuid4().hex[:12]
            promos.append(d)
        update["featured_promos"] = promos
        logger.info(f"[delivery-home] Saving {len(promos)} featured promos")

    if payload.featured_categories is not None:
        update["featured_categories"] = [c.dict() for c in payload.featured_categories]

    if payload.announcement is not None:
        update["announcement"] = payload.announcement.dict()

    HOME_COLL.update_one({"_type": HOME_TYPE}, {"$set": update}, upsert=True)
    logger.info("[delivery-home] ✅ Config saved")
    return {"success": True, "updated_at": update["updated_at"]}


# ── POST /delivery/home-config/upload — Upload image to R2 ──────────────────

@router.post("/delivery/home-config/upload", summary="Upload home image to R2")
async def upload_home_image(file: UploadFile = File(...), user: dict = Depends(require_home_role)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(status_code=400, detail="Tipo de archivo no válido")

    key = f"delivery_home/{uuid.uuid4()}{ext}"
    content_type = file.content_type or "image/webp"

    try:
        url = upload_to_r2(file.file, key, content_type=content_type)
        logger.info(f"[delivery-home] Image uploaded: {key}")
        return {"url": url, "key": key}
    except Exception as e:
        logger.error(f"[delivery-home] Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Template Assets — bundled images for Coolify deploy ──────────────────────

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "delivery_home_templates")


@router.get("/delivery/home-config/templates", summary="List bundled template assets")
async def list_template_assets(user: dict = Depends(require_home_role)):
    """List all images in the templates directory that come bundled with the admin."""
    if not os.path.isdir(TEMPLATES_DIR):
        return {"templates": []}

    exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    files = sorted([
        f for f in os.listdir(TEMPLATES_DIR)
        if os.path.splitext(f)[1].lower() in exts
    ])
    return {
        "templates": [
            {"filename": f, "preview_url": f"/delivery/home-config/templates/{f}"}
            for f in files
        ]
    }


@router.get("/delivery/home-config/templates/{filename}", summary="Serve template image")
async def serve_template_image(filename: str):
    """Serve a bundled template image (no auth — needed for preview in admin UI)."""
    from fastapi.responses import FileResponse

    filepath = os.path.join(TEMPLATES_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Template not found")
    return FileResponse(filepath, media_type="image/png")


@router.post("/delivery/home-config/templates/upload-to-r2", summary="Upload template to R2")
async def upload_template_to_r2(filename: str, user: dict = Depends(require_home_role)):
    """Upload a specific bundled template to R2 and return the CDN URL."""
    filepath = os.path.join(TEMPLATES_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Template not found")

    ext = os.path.splitext(filename)[1].lower()
    key = f"delivery_home/{filename}"

    content_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
    ct = content_types.get(ext, "image/png")

    try:
        with open(filepath, "rb") as f:
            url = upload_to_r2(f, key, content_type=ct)
        logger.info(f"[delivery-home] Template uploaded to R2: {key}")
        return {"url": url, "key": key, "filename": filename}
    except Exception as e:
        logger.error(f"[delivery-home] Template R2 upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delivery/home-config/templates/upload-all-to-r2", summary="Upload ALL templates to R2")
async def upload_all_templates_to_r2(user: dict = Depends(require_home_role)):
    """Bulk upload all bundled template images to R2. Returns mapping of filename → CDN URL."""
    if not os.path.isdir(TEMPLATES_DIR):
        return {"results": [], "message": "No templates directory"}

    exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    content_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}

    results = []
    for filename in sorted(os.listdir(TEMPLATES_DIR)):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in exts:
            continue
        filepath = os.path.join(TEMPLATES_DIR, filename)
        key = f"delivery_home/{filename}"
        ct = content_types.get(ext, "image/png")
        try:
            with open(filepath, "rb") as f:
                url = upload_to_r2(f, key, content_type=ct)
            results.append({"filename": filename, "url": url, "ok": True})
            logger.info(f"[delivery-home] Template bulk → R2: {key}")
        except Exception as e:
            results.append({"filename": filename, "ok": False, "error": str(e)})
            logger.error(f"[delivery-home] Template bulk error {filename}: {e}")

    ok_count = sum(1 for r in results if r.get("ok"))
    return {
        "results": results,
        "message": f"{ok_count}/{len(results)} templates subidos a R2",
    }




@router.post("/delivery/home-config/publish", summary="Publish home config to delivery providers")
async def publish_home_config(user: dict = Depends(require_home_role)):
    """
    Push the home config to all active delivery providers using Dilithium2 signature.
    Delivery side receives on POST /api/home-config/sync.
    """
    import httpx
    from apis.delivery.providers import build_provider_url

    # Get current config
    doc = HOME_COLL.find_one({"_type": HOME_TYPE}, {"_id": 0, "_type": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No hay configuración para publicar")

    # Remove Mongo internal fields
    doc.pop("_id", None)
    doc.pop("_type", None)

    # Get active providers with Dilithium keys
    providers = list(PROVIDERS_COLL.find(
        {"status": "active", "$or": [
            {"domain": {"$exists": True, "$ne": ""}},
            {"sync_url": {"$exists": True, "$ne": ""}},
        ]},
        {"slug": 1, "domain": 1, "sync_url": 1, "dilithium_mnemonic_enc": 1, "api_key_id": 1},
    ))

    if not providers:
        return {"success": True, "message": "No hay proveedores activos", "pushed": 0}

    results = []
    for prov in providers:
        slug = prov.get("slug", "?")
        domain = prov.get("domain", "")
        sync_url = prov.get("sync_url", "")
        mnemonic_enc = prov.get("dilithium_mnemonic_enc", "")
        if mnemonic_enc:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
        else:
            mnemonic = ""

        if (not domain and not sync_url) or not mnemonic:
            results.append({"slug": slug, "ok": False, "reason": "Missing domain or mnemonic"})
            continue

        # Build URL using centralized route
        if domain:
            home_url = build_provider_url(domain, "home_config_sync")
        else:
            base_url = sync_url.rsplit("/catalog/sync", 1)[0] if "/catalog/sync" in sync_url else sync_url.rsplit("/", 1)[0]
            home_url = f"{base_url}/home-config/sync"

        try:
            # Sign with Dilithium2
            signed_payload = _sign_home_payload(doc, mnemonic)

            headers = {"Content-Type": "application/json"}
            api_key_id = prov.get("api_key_id", "")
            if api_key_id:
                headers["X-Api-Key"] = api_key_id

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(home_url, json=signed_payload, headers=headers)

            if resp.status_code == 200:
                results.append({"slug": slug, "ok": True})
                logger.info(f"[delivery-home] ✅ '{slug}' synced")
            else:
                results.append({"slug": slug, "ok": False, "reason": f"HTTP {resp.status_code}"})
                logger.warning(f"[delivery-home] ⚠️ '{slug}' → {resp.status_code}")

        except Exception as e:
            results.append({"slug": slug, "ok": False, "reason": str(e)})
            logger.warning(f"[delivery-home] ❌ '{slug}': {e}")

    ok_count = sum(1 for r in results if r["ok"])
    return {
        "success": True,
        "message": f"{ok_count}/{len(results)} proveedores sincronizados",
        "pushed": ok_count,
        "total": len(results),
        "details": results,
    }


def _sign_home_payload(config: dict, mnemonic: str) -> dict:
    """Sign the home config payload with Dilithium2 for post-quantum security."""
    from utils.vanellix_crypto import keypair_from_mnemonic, sign_dilithium as sign_message

    payload = {
        "hero_banners": config.get("hero_banners", []),
        "featured_promos": config.get("featured_promos", []),
        "featured_categories": config.get("featured_categories", []),
        "announcement": config.get("announcement", {"text": "", "active": False}),
        "timestamp": time.time(),
        "nonce": uuid.uuid4().hex,
    }

    try:
        kp = keypair_from_mnemonic(mnemonic)
        payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        signature = sign_message(kp["sk"], payload_bytes)
        payload["dilithium_signature"] = signature
        payload["dilithium_pk"] = kp["pk_hex"]
        payload["signature_algorithm"] = "dilithium2"
        logger.info(f"[delivery-home] Payload signed (sig={signature[:24]}...)")
    except Exception as e:
        logger.warning(f"[delivery-home] Dilithium signing failed: {e}")

    return payload
