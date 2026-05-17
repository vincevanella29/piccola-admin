"""
admin/ecosystem_providers.py
============================
Unified CRUD for Ecosystem Providers (Delivery, Carta, Club, etc.)
These are external apps/platforms that sync with the Vanellix Admin.

Replaces the legacy fragmented collections with db.ecosystem_providers.
"""

import logging
import os
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.vanellix_crypto import generate_dilithium_keypair as generate_keypair
from apis.admin.apikeys import generate_key_pair as generate_api_key_pair, hash_secret, COLL as API_KEYS_COLL
from apis.conversion_tracker.trackers import sanitize_tracker_for_satellite

router = APIRouter()
logger = logging.getLogger(__name__)

ECOSYSTEM_COLL = db.ecosystem_providers

# =====================================================================
# Ecosystem Routes & Presets
# =====================================================================

ECOSYSTEM_ROUTES = {
    "delivery": {
        "claim":            "/api/admin/claim",
        "claim_status":     "/api/admin/claim/status",
        "config_sync":      "/api/admin/config/sync",
        "config_status":    "/api/admin/config/sync/status",
        "catalog_sync":     "/api/catalog/sync",
        "catalog_status":   "/api/catalog/sync/status",
        "delivery_config":  "/api/delivery-config",
        "home_config_sync": "/api/home-config/sync",
    },
    "carta": {
        "claim":          "/api/admin/claim",
        "claim_status":   "/api/admin/claim/status",
        "config_sync":    "/api/admin/config/sync",
        "catalog_sync":   "/api/catalog/sync",
        "banners_sync":   "/api/banners/sync",
        "nav_links_sync": "/api/nav-links/sync",
    },
    "club": {
        "claim": "/api/admin/claim",
        "claim_status": "/api/admin/claim/status",
    }
}

ECOSYSTEM_PRESETS = {
    "vanellix": {
        "ecosystem_type": "delivery",
        "name": "Vanellix Delivery",
        "slug": "vanellix",
        "type": "api_key",
        "domain": "http://localhost:8082",
        "field_mapping": {
            "customer_name": "$.customer.name",
            "customer_email": "$.customer.email",
            "customer_phone": "$.customer.phone",
            "customer_address": "$.customer.address",
            "customer_depto": "$.customer.depto",
            "items": "$.items",
            "item_code": "$.codigo",
            "item_price": "$.unit_price",
            "item_qty": "$.quantity",
            "item_modifiers": "$.modifiers",
            "total": "$.total_amount",
            "delivery_fee": "$.delivery_fee",
            "notes": "$.notes",
            "location_id": "$.location_id",
        },
        "description": "Vanellix own delivery storefront.",
    },
    "carta": {
        "ecosystem_type": "carta",
        "name": "Carta Digital",
        "slug": "carta",
        "type": "api_key",
        "domain": "http://localhost:8083",
        "description": "Carta digital pública de Piccola Italia",
    },
}

def build_provider_url(domain: str, route_key: str, ecosystem_type: str) -> str:
    """Build a full URL from domain + route key."""
    base = domain.rstrip("/")
    routes = ECOSYSTEM_ROUTES.get(ecosystem_type, {})
    path = routes.get(route_key, "")
    return f"{base}{path}"

def build_sync_url(domain: str, ecosystem_type: str) -> str:
    """Fallback for sync_url mapping."""
    return build_provider_url(domain, "catalog_sync", ecosystem_type)

# =====================================================================
# Pydantic Models
# =====================================================================

class ProviderCreate(BaseModel):
    ecosystem_type: str = Field(..., description="delivery | carta | club")
    name: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)
    type: str = Field("api_key", description="api_key | webhook")
    api_key_id: Optional[str] = None
    logo_url: Optional[str] = None
    sync_url: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None
    allowed_origins: List[str] = Field(default_factory=list)
    timezone: str = Field("America/Santiago")

class AutoLinkCreate(BaseModel):
    ecosystem_type: str = Field(..., description="delivery | carta | club")
    name: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)
    type: str = Field("api_key")
    logo_url: Optional[str] = None
    domain: str = Field(...)
    sync_url: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None
    allowed_origins: List[str] = Field(default_factory=list)
    timezone: str = Field("America/Santiago")

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    sync_url: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    description: Optional[str] = None
    allowed_origins: Optional[List[str]] = None
    timezone: Optional[str] = None

class CommissionsUpdate(BaseModel):
    delivery_pct: float
    platform_pct: float
    payment_pct: float
    notes: Optional[str] = ""
    closing_day: Optional[str] = "monday"

class ProbeRequest(BaseModel):
    ecosystem_type: str = Field(...)
    domain: str = Field(...)

# =====================================================================
# Endpoints
# =====================================================================

@router.get("/ecosystem/providers/presets", summary="Obtener presets globales")
async def get_ecosystem_presets(
    ecosystem_type: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    
    presets = {}
    for key, val in ECOSYSTEM_PRESETS.items():
        if not ecosystem_type or val.get("ecosystem_type") == ecosystem_type:
            presets[key] = val
            
    routes = ECOSYSTEM_ROUTES.get(ecosystem_type) if ecosystem_type else ECOSYSTEM_ROUTES
            
    return {"success": True, "presets": presets, "routes": routes}


@router.post("/ecosystem/providers/probe", summary="Probe domain para APIs disponibles")
async def probe_ecosystem_domain(
    payload: ProbeRequest,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    domain = payload.domain.rstrip("/")
    routes = ECOSYSTEM_ROUTES.get(payload.ecosystem_type, {})
    
    results = []
    async with httpx.AsyncClient(timeout=5.0) as client:
        for key, path in routes.items():
            url = f"{domain}{path}"
            try:
                method = "GET" if "status" in key or key == "delivery_config" else "OPTIONS"
                resp = await client.request(method, url)
                available = resp.status_code < 500
                results.append({"route": key, "path": path, "url": url, "available": available, "status": resp.status_code})
            except Exception as e:
                results.append({"route": key, "path": path, "url": url, "available": False, "status": 0, "error": str(e)})

    claim_info = None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client2:
            claim_resp = await client2.get(f"{domain}/api/admin/claim/status")
            if claim_resp.status_code == 200:
                claim_info = claim_resp.json()
    except Exception:
        pass

    available_count = sum(1 for r in results if r["available"])
    return {
        "success": True,
        "domain": domain,
        "available": available_count,
        "total": len(results),
        "routes": results,
        "claim_info": claim_info,
        "healthy": available_count >= 2,
    }


@router.post("/ecosystem/providers/auto-link", summary="Crear provider con Dilithium auto-generado")
async def auto_link_ecosystem_provider(
    payload: AutoLinkCreate,
    request: Request,
    user: dict = Depends(verify_session)
):
    """
    1. Generates Dilithium2 keypair
    2. Creates API key
    3. Saves Provider in db.ecosystem_providers
    4. Pushes credentials via POST /api/admin/claim
    """
    rl = require_admin_level(user, "member")
    if payload.ecosystem_type == "delivery" and rl > 5:
        raise HTTPException(status_code=403, detail="Delivery Auto-link requiere nivel 3 a 5")

    existing = ECOSYSTEM_COLL.find_one({"slug": payload.slug, "ecosystem_type": payload.ecosystem_type})
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe provider con slug '{payload.slug}'")

    # Gen Dilithium
    dili = generate_keypair()
    mnemonic = dili["mnemonic"]
    pk_hex = dili["pk_hex"]

    # Gen API Key
    wallet = user.get("wallet") or user.get("id")
    key_id, secret = generate_api_key_pair()
    secret_hash = hash_secret(secret)
    company_id = int(os.getenv("COMPANY_ID", "1"))

    now = datetime.now(timezone.utc)
    API_KEYS_COLL.insert_one({
        "_id": key_id,
        "name": f"{payload.ecosystem_type}-{payload.slug}",
        "owner": (wallet or "").lower(),
        "company_id": company_id,
        "secret_hash": secret_hash,
        "active": True,
        "created_at": now,
        "last_used_at": None,
        "expires_at": None,
        "auto_generated": True,
        "provider_slug": payload.slug,
        "provider_type": payload.ecosystem_type,
    })
    api_key_value = f"{key_id}.{secret}"

    preset = ECOSYSTEM_PRESETS.get(payload.slug, {})
    domain = payload.domain.rstrip("/")
    sync_url = build_sync_url(domain, payload.ecosystem_type) if domain else payload.sync_url

    from utils.vanellix_crypto import encrypt_b2b_mnemonic
    doc = {
        "ecosystem_type": payload.ecosystem_type,
        "name": payload.name,
        "slug": payload.slug,
        "type": payload.type,
        "status": "active",
        "api_key_id": key_id,
        "api_key_value": api_key_value, # para sincronización
        "logo_url": payload.logo_url or preset.get("logo_url"),
        "domain": domain,
        "sync_url": sync_url,
        "field_mapping": payload.field_mapping or preset.get("field_mapping", {}),
        "description": payload.description or preset.get("description"),
        "allowed_origins": payload.allowed_origins,
        "timezone": payload.timezone,
        "dilithium_pk": pk_hex,
        "dilithium_mnemonic_enc": encrypt_b2b_mnemonic(mnemonic),
        "dilithium_algorithm": "Dilithium2",
        "created_at": now,
        "updated_at": now,
        "created_by": wallet,
    }
    
    if payload.ecosystem_type == "delivery":
        doc["commissions"] = {
            "delivery_pct": 0, "platform_pct": 0, "payment_pct": 0,
            "notes": "", "closing_day": "monday"
        }

    result = ECOSYSTEM_COLL.insert_one(doc)

    # Claim
    claimed = False
    claim_error = None
    claim_url = build_provider_url(domain, "claim", payload.ecosystem_type)
    
    fwd_host = request.headers.get("x-forwarded-host")
    admin_api_url = f"https://{fwd_host}/api" if fwd_host else f"{request.base_url}api"

    claim_payload = {
        "company_id": company_id,
        "provider_slug": payload.slug,
        "api_key": api_key_value,
        "dilithium_mnemonic": mnemonic,
        "dilithium_pk": pk_hex,
        "admin_api_url": admin_api_url,
        "claimed_by": wallet,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(claim_url, json=claim_payload)
        if resp.status_code == 200:
            claimed = True
        else:
            claim_error = f"Claim failed {resp.status_code}"
    except Exception as e:
        claim_error = str(e)

    return {
        "success": True,
        "provider_id": str(result.inserted_id),
        "slug": payload.slug,
        "mnemonic": mnemonic,
        "claimed": claimed,
        "claim_error": claim_error,
        "message": "⚠️ Guarda la frase mnemónica. Solo se muestra una vez.",
    }


@router.post("/ecosystem/providers", summary="Create generic provider sin auto-link")
async def create_ecosystem_provider(
    payload: ProviderCreate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    
    existing = ECOSYSTEM_COLL.find_one({"slug": payload.slug, "ecosystem_type": payload.ecosystem_type})
    if existing:
        raise HTTPException(status_code=409, detail="Slug duplicado en este ecosistema")

    now = datetime.now(timezone.utc)
    doc = payload.dict()
    doc["status"] = "active"
    doc["created_at"] = now
    doc["updated_at"] = now
    doc["created_by"] = user.get("wallet") or user.get("id")
    
    if payload.ecosystem_type == "delivery":
        doc["commissions"] = {"delivery_pct": 0, "platform_pct": 0, "payment_pct": 0, "notes": "", "closing_day": "monday"}

    res = ECOSYSTEM_COLL.insert_one(doc)
    return {"success": True, "provider_id": str(res.inserted_id)}


@router.get("/ecosystem/providers", summary="List Providers globales o por ecosistema")
async def list_ecosystem_providers(
    ecosystem_type: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    
    query = {}
    if ecosystem_type: query["ecosystem_type"] = ecosystem_type
    if status: query["status"] = status
        
    cursor = ECOSYSTEM_COLL.find(query).sort("created_at", -1)
    providers = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Protect secrets
        doc.pop("dilithium_mnemonic", None)
        doc.pop("api_key_value", None)
        doc.pop("dilithium_pk", None)
        doc.pop("dilithium_mnemonic_enc", None)
        
        doc["dilithium_secured"] = bool(doc.get("api_key_id"))
        if doc.get("created_at"): doc["created_at"] = doc["created_at"].isoformat()
        if doc.get("updated_at"): doc["updated_at"] = doc["updated_at"].isoformat()
        providers.append(doc)

    return {"success": True, "providers": providers}


@router.get("/ecosystem/providers/{provider_id}", summary="Get Single Provider")
async def get_ecosystem_provider(
    provider_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    doc = ECOSYSTEM_COLL.find_one({"_id": ObjectId(provider_id)})
    if not doc: raise HTTPException(status_code=404, detail="No encontrado")

    doc["_id"] = str(doc["_id"])
    doc.pop("dilithium_mnemonic", None)
    doc.pop("api_key_value", None)
    doc.pop("dilithium_pk", None)
    doc.pop("dilithium_mnemonic_enc", None)
    doc["dilithium_secured"] = bool(doc.get("api_key_id"))
    
    return {"success": True, "provider": doc}


@router.patch("/ecosystem/providers/{provider_id}", summary="Update Provider")
async def update_ecosystem_provider(
    provider_id: str,
    payload: ProviderUpdate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    upd = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc)
    upd["updated_by"] = user.get("wallet") or user.get("id")
    
    ECOSYSTEM_COLL.update_one({"_id": ObjectId(provider_id)}, {"$set": upd})
    return {"success": True}


@router.post("/ecosystem/providers/{provider_id}/resync", summary="Resync Config Rotate")
async def resync_ecosystem_provider(
    provider_id: str,
    request: Request,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    provider = ECOSYSTEM_COLL.find_one({"_id": ObjectId(provider_id)})
    if not provider: raise HTTPException(status_code=404)
    
    domain = (provider.get("domain") or "").rstrip("/")
    if not domain: raise HTTPException(status_code=400, detail="Sin domain configurado")
        
    from utils.vanellix_crypto import decrypt_b2b_mnemonic, sign_with_mnemonic
    enc = provider.get("dilithium_mnemonic_enc")
    if not enc: raise HTTPException(status_code=400, detail="Sin dilithium_mnemonic_enc")
    mnemonic = decrypt_b2b_mnemonic(enc)
    
    # Generate new API key if it's delivery
    api_key_value = provider.get("api_key_value", "")
    wallet = user.get("wallet") or user.get("id")
    
    if provider.get("ecosystem_type") == "delivery" and provider.get("type") == "api_key":
        key_id, secret = generate_api_key_pair()
        api_key_value = f"{key_id}.{secret}"
        API_KEYS_COLL.insert_one({
            "_id": key_id,
            "secret_hash": hash_secret(secret),
            "name": f"Resync-{provider.get('slug')}",
            "owner": wallet,
            "active": True,
            "created_at": datetime.now(timezone.utc)
        })
        ECOSYSTEM_COLL.update_one({"_id": ObjectId(provider_id)}, {"$set": {"api_key_id": key_id, "api_key_value": api_key_value}})

    fwd_host = request.headers.get("x-forwarded-host")
    admin_api_url = f"https://{fwd_host}/api" if fwd_host else f"{request.base_url}api"
    
    # Send to the new "config_sync" route on the satellite
    sync_url = build_provider_url(domain, "config_sync", provider.get("ecosystem_type"))
    
    # Hub-and-Spoke Phase 3 Payload Construction
    # 1. Fetch Trackers assigned to this satellite
    trackers_cursor = db.conversion_tracker_providers.find({
        "is_active": True,
        "$or": [
            {"assigned_providers": provider.get("slug")},
            {"assigned_providers": {"$size": 0}},
            {"assigned_providers": {"$exists": False}},
            {"assigned_providers": None}
        ]
    }, {"_id": 0})
    trackers_list = list(trackers_cursor)
    
    # 2. Fetch Notification Public Config
    firebase_config = db.notification_api_configs.find_one({"service": "firebase"})
    notifications_data = {}
    if firebase_config:
        notifications_data = {
            "vapidKey": firebase_config.get("vapid_key"),
            "projectId": firebase_config.get("project_id"),
            "firebaseConfig": firebase_config.get("web_config", {}),
            "prompt_config": firebase_config.get("prompt_config", {
                "enabled": True,
                "prompt_title": "¡No te pierdas nada!",
                "prompt_message": "Recibe alertas de tus pedidos y promociones exclusivas.",
                "collect_name": True,
                "collect_email": True,
                "collect_phone": False,
                "theme": "glassmorphism-dark",
                "trigger_type": "delay",
                "trigger_value": 30
            })
        }
    
    sync_payload = {
        "company_id": int(os.getenv("COMPANY_ID", "1")),
        "provider_slug": provider.get("slug", ""),
        "api_key": api_key_value,
        "dilithium_mnemonic": mnemonic,
        "dilithium_pk": provider.get("dilithium_pk", ""),
        "admin_api_url": admin_api_url,
        "claimed_by": wallet,
        "trackers": [sanitize_tracker_for_satellite(t) for t in trackers_list],
        "notifications": notifications_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # ─── Generar Firma Dilithium Post-Quantum ────────────────────────────────
    payload_bytes = json.dumps(sync_payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    
    final_payload = sync_payload.copy()
    
    headers = {}
    if mnemonic:
        try:
            import time
            sig_hex, pk_hex = sign_with_mnemonic(mnemonic, payload_bytes)
            # Enviar firma siempre por headers para evitar corrupción de bytes en el body
            headers["X-Dilithium-Signature"] = sig_hex
            headers["X-Dilithium-PK"] = pk_hex
            headers["X-Dilithium-Algorithm"] = "dilithium2"
            headers["X-Dilithium-Timestamp"] = str(time.time())
        except Exception as e:
            logger.warning(f"[config-sync] Dilithium signing failed: {e}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers["Content-Type"] = "application/json"
            resp = await client.post(sync_url, content=payload_bytes, headers=headers)
            
        if resp.status_code == 200:
            return {"success": True, "admin_api_url": admin_api_url, "sync_payload": json.loads(payload_bytes)}
        raise HTTPException(status_code=502, detail=resp.text[:200])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing with satellite: {str(e)}")


@router.delete("/ecosystem/providers/{provider_id}")
async def delete_ecosystem_provider(provider_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")
    ECOSYSTEM_COLL.update_one(
        {"_id": ObjectId(provider_id)},
        {"$set": {"status": "disabled", "updated_at": datetime.now(timezone.utc)}}
    )
    return {"success": True}

@router.get("/ecosystem/providers/{provider_id}/commissions", summary="Get Provider Commissions")
async def get_ecosystem_provider_commissions(provider_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")
    doc = ECOSYSTEM_COLL.find_one({"_id": ObjectId(provider_id)})
    if not doc: raise HTTPException(status_code=404, detail="No encontrado")
    if doc.get("ecosystem_type") != "delivery":
        raise HTTPException(status_code=400, detail="Comisiones solo aplican a delivery")
    commissions = doc.get("commissions", {
        "delivery_pct": 0, "platform_pct": 0, "payment_pct": 0, "notes": "", "closing_day": "monday"
    })
    return {"success": True, "commissions": commissions}

@router.put("/ecosystem/providers/{provider_id}/commissions", summary="Update Provider Commissions")
async def update_ecosystem_provider_commissions(
    provider_id: str,
    payload: CommissionsUpdate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")
    doc = ECOSYSTEM_COLL.find_one({"_id": ObjectId(provider_id)})
    if not doc: raise HTTPException(status_code=404, detail="No encontrado")
    if doc.get("ecosystem_type") != "delivery":
        raise HTTPException(status_code=400, detail="Comisiones solo aplican a delivery")

    upd = {
        "commissions.delivery_pct": payload.delivery_pct,
        "commissions.platform_pct": payload.platform_pct,
        "commissions.payment_pct": payload.payment_pct,
        "commissions.notes": payload.notes,
        "commissions.closing_day": payload.closing_day,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": user.get("wallet") or user.get("id"),
    }
    
    ECOSYSTEM_COLL.update_one({"_id": ObjectId(provider_id)}, {"$set": upd})
    return {"success": True}

# =====================================================================
# Satellite Webhooks (Hub & Spoke Phase 3)
# =====================================================================

from utils.vanellix_crypto import verify_dilithium

async def verify_satellite_webhook(request: Request):
    """
    Verifies that incoming webhooks from satellites (Delivery, Carta)
    are strictly signed with Dilithium2.
    """
    slug = request.headers.get("X-Provider-Slug")
    if not slug:
        logger.warning("[webhook] Missing X-Provider-Slug header")
        raise HTTPException(status_code=403, detail="Missing X-Provider-Slug")
    
    provider = ECOSYSTEM_COLL.find_one({"slug": slug, "status": "active"})
    if not provider:
        logger.warning(f"[webhook] Invalid or inactive provider slug: {slug}")
        raise HTTPException(status_code=403, detail="Provider not found or inactive")
        
    stored_pk = provider.get("dilithium_pk", "")
    if not stored_pk:
        logger.warning(f"[webhook] Provider {slug} has no dilithium_pk")
        raise HTTPException(status_code=403, detail="Provider has no dilithium_pk")
        
    sig_hex = request.headers.get("X-Dilithium-Signature")
    if not sig_hex:
        logger.warning(f"[webhook] Missing X-Dilithium-Signature from {slug}")
        raise HTTPException(status_code=403, detail="Missing X-Dilithium-Signature")
        
    body = await request.body()
    
    # Intento 1: Validar contra el body exacto (o b"" en GET)
    is_valid = verify_dilithium(stored_pk, body, sig_hex)
    
    if not is_valid:
        # Intento 2: Validar contra el estándar de meta-datos (Method + Path + Query)
        query_str = "&".join(f"{k}={v}" for k, v in sorted(request.query_params.items()))
        signable_meta = f"{request.method}\n{request.url.path}\n{query_str}".encode("utf-8")
        is_valid = verify_dilithium(stored_pk, signable_meta, sig_hex)
        if not is_valid:
            logger.warning(f"[webhook] DEBUG: Expected signable_meta to be: {signable_meta}")
            
    if not is_valid:
        logger.warning(f"[webhook] Invalid Dilithium signature from {slug}")
        raise HTTPException(status_code=403, detail="Invalid Dilithium signature")
        
    logger.info(f"[webhook] ✅ Verified Dilithium signature from provider {slug}")
    return provider

class SatelliteTokenRequest(BaseModel):
    user_id: Optional[str] = None
    privy_id: Optional[str] = None
    wallet: Optional[str] = None
    fcm_token: str
    device_type: str = "web"
    source: str = "unknown"
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

@router.post("/webhooks/ecosystem/tokens", summary="Receive FCM Tokens from Satellites")
async def receive_satellite_token(
    payload: SatelliteTokenRequest,
    provider: dict = Depends(verify_satellite_webhook)
):
    """
    Called by Satellite Backends (Delivery, Carta).
    Receives an FCM token granted by the user on the satellite frontend.
    Strictly authenticated via Dilithium Post-Quantum Signature.
    """
    token_data = {
        "wallet": payload.wallet,
        "user_id": payload.user_id,
        "privy_id": payload.privy_id,
        "email": payload.email,
        "token": payload.fcm_token,
        "device_type": payload.device_type,
        "source": payload.source,
        "permissions_granted": True,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Store token. Use fcm_token as unique key to prevent duplicates.
    # The notification engine queries this collection (db.user_notification_tokens)
    db.user_notification_tokens.update_one(
        {"token": payload.fcm_token},
        {"$set": token_data, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    # ── CRM Unification ──
    # Si tenemos data de lead (email, phone, wallet), lo inyectamos al CRM global
    if payload.email or payload.phone or payload.wallet:
        query = {}
        if payload.email:
            query["email"] = payload.email
        elif payload.phone:
            query["phone"] = payload.phone
        elif payload.wallet:
            query["wallet"] = payload.wallet
            
        update_set = {
            "fcm_token": payload.fcm_token, 
            "updated_at": datetime.now(timezone.utc)
        }
        if payload.name: update_set["name"] = payload.name
        if payload.email: update_set["email"] = payload.email
        if payload.phone: update_set["phone"] = payload.phone
        if payload.wallet: update_set["wallet"] = payload.wallet
            
        update = {
            "$set": update_set,
            "$setOnInsert": {
                "registered_at": datetime.now(timezone.utc),
                "login_count": 0,
                "order_count": 0,
                "total_spent": 0.0,
                "provider_slug": provider.get("slug", payload.source),
                "privy_id": f"fcm_{payload.fcm_token[:10]}"
            }
        }
        
        result = db.customers.update_one(query, update, upsert=True)
        
        # Trigger automation for new customer lead si fue insertado
        if result.upserted_id:
            import asyncio
            from services.automation_engine import trigger_event
            asyncio.create_task(trigger_event("customer_registered", "customers", {
                "privy_id": update["$setOnInsert"]["privy_id"],
                "email": payload.email or "",
                "name": payload.name or "Customer",
                "phone": payload.phone or "",
                "wallet": payload.wallet or ""
            }))
            logger.info(f"[webhook] CRM Lead Created for {payload.email or payload.phone} via {payload.source}")
        else:
            logger.info(f"[webhook] CRM Lead Updated for {payload.email or payload.phone} via {payload.source}")

    return {"success": True}

class SatelliteEventRequest(BaseModel):
    event_name: str
    segment: str = "customers"
    payload: Dict[str, Any]

@router.post("/webhooks/ecosystem/events", summary="Receive Analytics/Automation Events from Satellites")
async def receive_satellite_event(
    data: SatelliteEventRequest,
    provider: dict = Depends(verify_satellite_webhook)
):
    """
    Called by Satellite Backends to trigger Admin Automation rules.
    Strictly authenticated via Dilithium Post-Quantum Signature.
    (e.g., Abandoned Cart, Sign Ups)
    """
    try:
        from services.automation_engine import trigger_event
        # Fire-and-forget
        import asyncio
        asyncio.create_task(trigger_event(data.event_name, data.segment, data.payload))
        return {"success": True}
    except Exception as e:
        logger.error(f"[ecosystem_events] Error processing event {data.event_name}: {e}")
        raise HTTPException(status_code=500, detail="Event processing failed")
