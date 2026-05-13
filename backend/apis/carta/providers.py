"""
carta_providers.py
==================
CRUD for Carta Providers — the public digital menu frontends.
Replicates the delivery/providers.py pattern exactly:
  - Dilithium keypair generation
  - Auto-created API key
  - First-claim-wins push to the carta app
  - Domain-based route construction (no env vars)
"""

import logging
import os
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

router = APIRouter()
logger = logging.getLogger(__name__)

PROVIDERS_COLL = db.carta_providers

# =====================================================================
# Carta Routes — centralized route definitions
# The admin defines these routes; the carta app only supplies a domain.
# =====================================================================

CARTA_ROUTES = {
    "claim":          "/api/admin/claim",
    "claim_status":   "/api/admin/claim/status",
    "catalog_sync":   "/api/catalog/sync",
    "banners_sync":   "/api/banners/sync",
    "nav_links_sync": "/api/nav-links/sync",
}


def build_carta_url(domain: str, route_key: str) -> str:
    """Build a full URL from domain + route key."""
    base = domain.rstrip("/")
    path = CARTA_ROUTES.get(route_key, "")
    return f"{base}{path}"


# =====================================================================
# Presets
# =====================================================================

CARTA_PRESETS = {
    "carta": {
        "name": "Carta Digital",
        "slug": "carta",
        "type": "api_key",
        "domain": "http://localhost:8083",
        "description": "Carta digital pública de Piccola Italia",
    },
}

# =====================================================================
# Pydantic Models
# =====================================================================

class AutoLinkCreate(BaseModel):
    """Auto-link: creates provider + API key + Dilithium keypair in one shot."""
    name: str = Field(..., min_length=1, description="Nombre del proveedor")
    slug: str = Field(..., min_length=1, description="Identificador único")
    type: str = Field("api_key", description="api_key | webhook")
    logo_url: Optional[str] = None
    domain: str = Field(..., description="Base domain e.g. http://localhost:8083")
    description: Optional[str] = None


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None


class ProbeRequest(BaseModel):
    domain: str = Field(..., min_length=1, description="Base domain e.g. http://localhost:8083")


# =====================================================================
# Endpoints
# =====================================================================

@router.get("/carta/providers/presets", summary="Presets de carta providers")
async def get_carta_presets(user: dict = Depends(verify_session)):
    require_admin_level(user, "member")
    return {"success": True, "presets": CARTA_PRESETS, "routes": CARTA_ROUTES}


@router.post("/carta/providers/probe", summary="Probe a carta domain for available APIs")
async def probe_carta_domain(
    payload: ProbeRequest,
    user: dict = Depends(verify_session)
):
    """Probe a carta domain to discover which APIs are available."""
    require_admin_level(user, "member")

    domain = payload.domain.rstrip("/")
    results = []

    async with httpx.AsyncClient(timeout=5.0) as client:
        for key, path in CARTA_ROUTES.items():
            url = f"{domain}{path}"
            try:
                method = "GET" if key in ("claim_status",) else "OPTIONS"
                resp = await client.request(method, url)
                available = resp.status_code < 500
                results.append({
                    "route": key,
                    "path": path,
                    "url": url,
                    "available": available,
                    "status": resp.status_code,
                })
            except httpx.ConnectError:
                results.append({"route": key, "path": path, "url": url, "available": False, "status": 0, "error": "Connection refused"})
            except httpx.TimeoutException:
                results.append({"route": key, "path": path, "url": url, "available": False, "status": 0, "error": "Timeout"})
            except Exception as e:
                results.append({"route": key, "path": path, "url": url, "available": False, "status": 0, "error": str(e)})

    # Check claim status specifically
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


@router.post("/carta/providers/auto-link", summary="Crear carta provider con Dilithium + API key")
async def auto_link_carta_provider(
    payload: AutoLinkCreate,
    request: Request,
    user: dict = Depends(verify_session)
):
    """
    All-in-one carta provider creation:
    1. Generates CRYSTALS-Dilithium (Dilithium2) keypair + BIP39 mnemonic
    2. Auto-creates an API key
    3. Creates the provider doc linked to both
    4. Pushes credentials to carta app via POST /api/admin/claim
       (first claim wins — like a blockchain contract)

    The mnemonic is returned ONCE for backup.
    Requires admin level 3-5.
    """
    rl = require_admin_level(user, "member")
    if rl > 5:
        raise HTTPException(status_code=403, detail="Auto-link requiere nivel 3 a 5")

    # 1. Check slug uniqueness
    existing = PROVIDERS_COLL.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un carta provider con slug '{payload.slug}'")

    # 2. Generate Dilithium keypair + mnemonic
    dili = generate_keypair()
    mnemonic = dili["mnemonic"]
    pk_hex = dili["pk_hex"]

    # 3. Auto-create API key
    wallet = user.get("wallet") or user.get("id")
    key_id, secret = generate_api_key_pair()
    secret_hash = hash_secret(secret)
    company_id = int(os.getenv("COMPANY_ID", "1"))

    now = datetime.now(timezone.utc)
    api_key_doc = {
        "_id": key_id,
        "name": f"carta-{payload.slug}",
        "owner": (wallet or "").lower(),
        "company_id": company_id,
        "secret_hash": secret_hash,
        "active": True,
        "created_at": now,
        "last_used_at": None,
        "expires_at": None,
        "auto_generated": True,
        "provider_slug": payload.slug,
        "provider_type": "carta",
    }
    API_KEYS_COLL.insert_one(api_key_doc)
    api_key_value = f"{key_id}.{secret}"

    # 4. Create provider doc
    domain = payload.domain.rstrip("/")

    from utils.vanellix_crypto import encrypt_b2b_mnemonic
    provider_doc = {
        "name": payload.name,
        "slug": payload.slug,
        "type": payload.type,
        "status": "active",
        "api_key_id": key_id,
        "api_key_value": api_key_value,  # stored for sync.py to read
        "logo_url": payload.logo_url,
        "domain": domain,
        "description": payload.description or CARTA_PRESETS.get(payload.slug, {}).get("description"),
        "dilithium_pk": pk_hex,
        "dilithium_mnemonic_enc": encrypt_b2b_mnemonic(mnemonic),
        "dilithium_algorithm": "Dilithium2",
        "created_at": now,
        "updated_at": now,
        "created_by": wallet,
    }
    result = PROVIDERS_COLL.insert_one(provider_doc)

    # 5. Push credentials to carta app (auto-claim)
    claimed = False
    claim_error = None
    claim_url = build_carta_url(domain, "claim")
    
    # Dynamic Admin URL reading from request
    fwd_host = request.headers.get("x-forwarded-host")
    if fwd_host:
        admin_api_url = f"https://{fwd_host}/api"
    else:
        admin_api_url = f"{request.base_url}api"

    claim_payload = {
        "company_id": company_id,
        "provider_slug": payload.slug,
        "api_key": api_key_value,
        "dilithium_mnemonic": mnemonic,
        "dilithium_pk": pk_hex,  # Admin's PK — carta uses this to verify sync signatures
        "admin_api_url": admin_api_url,
        "claimed_by": wallet,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(claim_url, json=claim_payload)

        if resp.status_code == 200:
            claimed = True
            logger.info(f"[carta/providers] ✅ Carta app claimed at {claim_url}")
        elif resp.status_code == 409:
            claim_error = "Carta app ya fue reclamada por otro admin"
            logger.warning(f"[carta/providers] ⚠️ Carta already claimed: {resp.text[:200]}")
        else:
            claim_error = f"Carta app respondió {resp.status_code}"
            logger.error(f"[carta/providers] ❌ Claim failed: {resp.status_code} {resp.text[:200]}")

    except httpx.ConnectError:
        claim_error = f"No se pudo conectar a {claim_url}"
        logger.error(f"[carta/providers] ❌ Cannot connect to carta at {claim_url}")
    except Exception as e:
        claim_error = str(e)
        logger.error(f"[carta/providers] ❌ Claim error: {e}")

    logger.info(
        f"[carta/providers] Auto-linked provider '{payload.slug}' "
        f"with Dilithium2 + API key '{key_id}' by {wallet} | claimed={claimed}"
    )

    return {
        "success": True,
        "provider_id": str(result.inserted_id),
        "slug": payload.slug,
        # api_key_value is NEVER returned to frontend — stored in DB for sync.py only
        "mnemonic": mnemonic,
        "dilithium_algorithm": "Dilithium2",
        "claimed": claimed,
        "claim_error": claim_error,
        "message": "⚠️ Guarda la frase mnemónica como respaldo. Se muestra UNA SOLA VEZ.",
    }


@router.get("/carta/providers", summary="Listar carta providers")
async def list_carta_providers(
    status: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")

    query = {}
    if status:
        query["status"] = status

    cursor = PROVIDERS_COLL.find(query).sort("created_at", -1)
    providers = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Never expose secrets in list responses
        doc.pop("dilithium_mnemonic", None)
        doc.pop("api_key_value", None)
        doc.pop("dilithium_pk", None)
        # Keep a boolean so frontend knows Dilithium is active
        doc["dilithium_secured"] = bool(doc.get("api_key_id"))
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
        if doc.get("updated_at"):
            doc["updated_at"] = doc["updated_at"].isoformat()
        providers.append(doc)

    return {"success": True, "providers": providers}


@router.get("/carta/providers/{provider_id}", summary="Detalle de carta provider")
async def get_carta_provider(
    provider_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    doc = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Provider no encontrado")

    doc["_id"] = str(doc["_id"])
    # Never expose secrets in detail responses
    doc.pop("dilithium_mnemonic", None)
    doc.pop("api_key_value", None)
    doc.pop("dilithium_pk", None)
    doc["dilithium_secured"] = bool(doc.get("api_key_id"))
    if doc.get("created_at"):
        doc["created_at"] = doc["created_at"].isoformat()
    if doc.get("updated_at"):
        doc["updated_at"] = doc["updated_at"].isoformat()

    return {"success": True, "provider": doc}


@router.patch("/carta/providers/{provider_id}", summary="Actualizar carta provider")
async def update_carta_provider(
    provider_id: str,
    payload: ProviderUpdate,
    request: Request,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider no encontrado")

    if payload.status and payload.status not in ("active", "paused", "disabled"):
        raise HTTPException(status_code=400, detail="Status debe ser 'active', 'paused' o 'disabled'")

    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = user.get("wallet") or user.get("id")

    PROVIDERS_COLL.update_one({"_id": ObjectId(provider_id)}, {"$set": update_data})
    logger.info(f"[carta/providers] Updated provider '{provider_id}' by {user.get('wallet')}")

    return {"success": True, "message": "Provider actualizado"}


@router.post("/carta/providers/{provider_id}/resync", summary="Re-sync config to carta app")
async def resync_carta_provider(
    provider_id: str,
    request: Request,
    user: dict = Depends(verify_session)
):
    """
    Re-push the current admin_api_url to an already-claimed carta app.
    Uses /admin/rotate on the carta side to update the stored config
    without needing to re-create the provider.
    """
    require_admin_level(user, "member")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    provider = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider no encontrado")

    domain = (provider.get("domain") or "").rstrip("/")
    if not domain:
        raise HTTPException(status_code=400, detail="Provider no tiene domain configurado")

    # Decrypt mnemonic from DB
    from utils.vanellix_crypto import decrypt_b2b_mnemonic
    mnemonic_enc = provider.get("dilithium_mnemonic_enc")
    if not mnemonic_enc:
        raise HTTPException(status_code=400, detail="Provider no tiene credenciales Dilithium. Necesitas re-crear con auto-link.")

    mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
    api_key_value = provider.get("api_key_value", "")
    wallet = user.get("wallet") or user.get("id")

    # Build admin URL dynamically
    fwd_host = request.headers.get("x-forwarded-host")
    if fwd_host:
        admin_api_url = f"https://{fwd_host}/api"
    else:
        admin_api_url = f"{request.base_url}api"

    rotate_url = build_carta_url(domain, "claim").replace("/claim", "/rotate")
    rotate_payload = {
        "company_id": int(os.getenv("COMPANY_ID", "1")),
        "provider_slug": provider.get("slug", ""),
        "api_key": api_key_value,
        "dilithium_mnemonic": mnemonic,
        "dilithium_pk": provider.get("dilithium_pk", ""),
        "admin_api_url": admin_api_url,
        "claimed_by": wallet,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(rotate_url, json=rotate_payload)

        if resp.status_code == 200:
            logger.info(f"[carta/providers] ✅ Re-synced config to {rotate_url} | admin_api_url={admin_api_url}")
            return {"success": True, "admin_api_url": admin_api_url, "message": "Config actualizada en la carta"}
        else:
            detail = resp.text[:300]
            logger.error(f"[carta/providers] ❌ Re-sync failed: {resp.status_code} {detail}")
            raise HTTPException(status_code=502, detail=f"Carta respondió {resp.status_code}: {detail}")

    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"No se pudo conectar a {rotate_url}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[carta/providers] ❌ Re-sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/carta/providers/{provider_id}", summary="Desactivar carta provider")
async def delete_carta_provider(
    provider_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider no encontrado")

    PROVIDERS_COLL.update_one(
        {"_id": ObjectId(provider_id)},
        {"$set": {
            "status": "disabled",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )
    logger.info(f"[carta/providers] Disabled provider '{provider_id}' by {user.get('wallet')}")

    return {"success": True, "message": "Provider desactivado"}

