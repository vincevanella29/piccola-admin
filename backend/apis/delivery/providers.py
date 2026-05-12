"""
delivery/providers.py
=====================
CRUD for Order Providers — external platforms that SEND orders INTO the admin.
Currently only Vanellix Delivery Store, but designed for future expansion.

Each provider has:
- Auth config (API key reference)
- Field mapping (JSONPath-style) to normalize incoming payloads to our internal schema
"""

import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.vanellix_crypto import generate_dilithium_keypair as generate_keypair
from apis.apikeys import generate_key_pair as generate_api_key_pair, hash_secret, COLL as API_KEYS_COLL

router = APIRouter()
logger = logging.getLogger(__name__)

PROVIDERS_COLL = db.delivery_providers

# =====================================================================
# Delivery Routes — centralized route definitions
# The admin defines these routes; providers only supply a domain.
# =====================================================================

DELIVERY_ROUTES = {
    "claim":            "/api/admin/claim",
    "claim_status":     "/api/admin/claim/status",
    "config_sync":      "/api/admin/config/sync",
    "config_status":    "/api/admin/config/sync/status",
    "catalog_sync":     "/api/catalog/sync",
    "catalog_status":   "/api/catalog/sync/status",
    "delivery_config":  "/api/delivery-config",
    "home_config_sync": "/api/home-config/sync",
}


def build_provider_url(domain: str, route_key: str) -> str:
    """Build a full URL from domain + route key."""
    base = domain.rstrip("/")
    path = DELIVERY_ROUTES.get(route_key, "")
    return f"{base}{path}"


def build_sync_url(domain: str) -> str:
    """Build the catalog sync URL (backwards compat for sync_url field)."""
    return build_provider_url(domain, "catalog_sync")


# =====================================================================
# Presets — Field mappings por defecto para proveedores conocidos
# =====================================================================

PROVIDER_PRESETS = {
    "vanellix": {
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
        "description": "Vanellix own delivery storefront. Orders are sent via API key from the customer-facing delivery app.",
    },
}

# =====================================================================
# Pydantic Models
# =====================================================================

class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Nombre del proveedor")
    slug: str = Field(..., min_length=1, description="Identificador único (lowercase, sin espacios)")
    type: str = Field("api_key", description="api_key | webhook")
    api_key_id: Optional[str] = Field(None, description="Ref a api_keys collection (si usa auth por API key)")
    logo_url: Optional[str] = None
    sync_url: Optional[str] = Field(None, description="URL del endpoint /catalog/sync del proveedor para notificar cambios de carta")
    field_mapping: Dict[str, str] = Field(default_factory=dict, description="JSONPath mapping de campos del proveedor → schema interno")
    description: Optional[str] = None
    allowed_origins: List[str] = Field(default_factory=list)
    timezone: str = Field("America/Santiago", description="Timezone IANA para timestamps (e.g. America/Santiago)")

class AutoLinkCreate(BaseModel):
    """Auto-link: creates provider + API key + Dilithium keypair in one shot."""
    name: str = Field(..., min_length=1, description="Nombre del proveedor")
    slug: str = Field(..., min_length=1, description="Identificador único")
    type: str = Field("api_key", description="api_key | webhook")
    logo_url: Optional[str] = None
    domain: Optional[str] = Field(None, description="Base domain e.g. http://localhost:8082")
    sync_url: Optional[str] = Field(None, description="Legacy: full sync URL (overridden by domain)")
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None
    allowed_origins: List[str] = Field(default_factory=list)
    timezone: str = Field("America/Santiago", description="Timezone IANA para timestamps")

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    api_key_id: Optional[str] = None
    logo_url: Optional[str] = None
    sync_url: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    description: Optional[str] = None
    allowed_origins: Optional[List[str]] = None
    timezone: Optional[str] = Field(None, description="Timezone IANA")

# =====================================================================
# Endpoints
# =====================================================================

@router.get("/delivery/providers/presets", summary="Obtener presets de proveedores conocidos")
async def get_provider_presets(user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    return {"success": True, "presets": PROVIDER_PRESETS, "routes": DELIVERY_ROUTES}


class ProbeRequest(BaseModel):
    domain: str = Field(..., min_length=1, description="Base domain e.g. http://localhost:8082")


@router.post("/delivery/providers/probe", summary="Probe a delivery domain for available APIs")
async def probe_delivery_domain(
    payload: ProbeRequest,
    user: dict = Depends(verify_session)
):
    """
    Probe a delivery domain to discover which APIs are available.
    Checks all known routes and reports status for each.
    """
    require_admin_level(user, "delivery")

    domain = payload.domain.rstrip("/")
    results = []

    async with httpx.AsyncClient(timeout=5.0) as client:
        for key, path in DELIVERY_ROUTES.items():
            url = f"{domain}{path}"
            try:
                # Use GET for read endpoints, OPTIONS for write endpoints
                method = "GET" if key in ("claim_status", "config_status", "catalog_status", "delivery_config") else "OPTIONS"
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
        "healthy": available_count >= 3,  # At minimum: claim + config_sync + catalog_sync
    }


@router.post("/delivery/providers/auto-link", summary="Crear proveedor con API key y Dilithium auto-generados")
async def auto_link_provider(
    payload: AutoLinkCreate,
    user: dict = Depends(verify_session)
):
    """
    All-in-one provider creation + delivery app claim:
    1. Generates CRYSTALS-Dilithium (Dilithium2) keypair + BIP39 mnemonic
    2. Auto-creates an API key
    3. Creates the provider doc linked to both
    4. Pushes credentials to delivery app via POST /api/admin/claim
       (first claim wins — like a blockchain contract)

    The mnemonic is returned ONCE for backup. It's also sent to the
    delivery app automatically so it can sign requests.

    Requires admin level 3-5.
    """
    import os

    rl = require_admin_level(user, "delivery")
    if rl > 5:
        raise HTTPException(status_code=403, detail="Auto-link requiere nivel 3 a 5")

    # 1. Check slug uniqueness
    existing = PROVIDERS_COLL.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un proveedor con slug '{payload.slug}'")

    if payload.type not in ("api_key", "webhook"):
        raise HTTPException(status_code=400, detail="Tipo debe ser 'api_key' o 'webhook'")

    # 2. Generate Dilithium keypair + mnemonic
    dili = generate_keypair()
    mnemonic = dili["mnemonic"]
    pk_hex = dili["pk_hex"]

    # 3. Auto-create API key
    wallet = user.get("wallet") or user.get("id")
    key_id, secret = generate_api_key_pair()
    secret_hash = hash_secret(secret)
    company_id = int(os.getenv("COMPANY_ID", "0"))

    now = datetime.now(timezone.utc)
    api_key_doc = {
        "_id": key_id,
        "name": f"delivery-{payload.slug}",
        "owner": (wallet or "").lower(),
        "company_id": company_id,
        "secret_hash": secret_hash,
        "active": True,
        "created_at": now,
        "last_used_at": None,
        "expires_at": None,  # Delivery keys don't expire
        "auto_generated": True,
        "provider_slug": payload.slug,
    }
    API_KEYS_COLL.insert_one(api_key_doc)
    api_key_value = f"{key_id}.{secret}"

    # 4. Create provider doc
    preset = PROVIDER_PRESETS.get(payload.slug, {})
    field_mapping = payload.field_mapping or preset.get("field_mapping", {})
    # Resolve domain → construct sync_url
    domain = payload.domain or preset.get("domain", "")
    sync_url = build_sync_url(domain) if domain else (payload.sync_url or preset.get("sync_url"))

    provider_doc = {
        "name": payload.name,
        "slug": payload.slug,
        "type": payload.type,
        "status": "active",
        "api_key_id": key_id,
        "logo_url": payload.logo_url or preset.get("logo_url"),
        "domain": domain,
        "sync_url": sync_url,  # backwards compat
        "field_mapping": field_mapping,
        "description": payload.description or preset.get("description"),
        "allowed_origins": payload.allowed_origins,
        "timezone": payload.timezone,
        "dilithium_pk": pk_hex,
        "dilithium_mnemonic": mnemonic,  # Needed to encrypt config for this provider
        "dilithium_algorithm": "Dilithium2",
        "commissions": {
            "delivery_pct": 0,
            "platform_pct": 0,
            "payment_pct": 0,
            "notes": "",
            "closing_day": "monday",  # día de cierre semanal
        },
        "created_at": now,
        "updated_at": now,
        "created_by": wallet,
    }
    result = PROVIDERS_COLL.insert_one(provider_doc)

    # 5. Push credentials to delivery app (auto-claim)
    claimed = False
    claim_error = None
    if domain or sync_url:
        # Build claim URL from domain (preferred) or legacy sync_url
        if domain:
            claim_url = build_provider_url(domain, "claim")
        else:
            base_url = sync_url.rsplit("/catalog/sync", 1)[0] if "/catalog/sync" in sync_url else sync_url.rsplit("/", 1)[0]
            claim_url = f"{base_url}/admin/claim"

        admin_api_url = os.getenv("ADMIN_PUBLIC_URL", f"http://localhost:{os.getenv('PORT', '8081')}/api")

        claim_payload = {
            "company_id": company_id,
            "provider_slug": payload.slug,
            "api_key": api_key_value,
            "dilithium_mnemonic": mnemonic,
            "admin_api_url": admin_api_url,
            "claimed_by": wallet,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(claim_url, json=claim_payload)

            if resp.status_code == 200:
                claimed = True
                logger.info(f"[delivery/providers] ✅ Delivery app claimed at {claim_url}")
            elif resp.status_code == 409:
                claim_error = "Delivery app ya fue reclamada por otro admin"
                logger.warning(f"[delivery/providers] ⚠️ Delivery already claimed: {resp.text[:200]}")
            else:
                claim_error = f"Delivery app respondió {resp.status_code}"
                logger.error(f"[delivery/providers] ❌ Claim failed: {resp.status_code} {resp.text[:200]}")

        except httpx.ConnectError:
            claim_error = f"No se pudo conectar a {claim_url}"
            logger.error(f"[delivery/providers] ❌ Cannot connect to delivery app at {claim_url}")
        except Exception as e:
            claim_error = str(e)
            logger.error(f"[delivery/providers] ❌ Claim error: {e}")

    logger.info(
        f"[delivery/providers] Auto-linked provider '{payload.slug}' "
        f"with Dilithium2 + API key '{key_id}' by {wallet} | claimed={claimed}"
    )

    return {
        "success": True,
        "provider_id": str(result.inserted_id),
        "slug": payload.slug,
        "api_key": api_key_value,
        "mnemonic": mnemonic,
        "dilithium_algorithm": "Dilithium2",
        "claimed": claimed,
        "claim_error": claim_error,
        "message": "⚠️ Guarda la frase mnemónica como respaldo. Se muestra UNA SOLA VEZ.",
    }


@router.post("/delivery/providers", summary="Crear proveedor de pedidos")
async def create_provider(
    payload: ProviderCreate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    # Check slug uniqueness
    existing = PROVIDERS_COLL.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un proveedor con slug '{payload.slug}'")

    if payload.type not in ("api_key", "webhook"):
        raise HTTPException(status_code=400, detail="Tipo debe ser 'api_key' o 'webhook'")

    now = datetime.now(timezone.utc)
    doc = {
        "name": payload.name,
        "slug": payload.slug,
        "type": payload.type,
        "status": "active",
        "api_key_id": payload.api_key_id,
        "logo_url": payload.logo_url,
        "sync_url": payload.sync_url,
        "field_mapping": payload.field_mapping,
        "description": payload.description,
        "allowed_origins": payload.allowed_origins,
        "timezone": "America/Santiago",
        "commissions": {
            "delivery_pct": 0,
            "platform_pct": 0,
            "payment_pct": 0,
            "notes": "",
            "closing_day": "monday",
        },
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("wallet") or user.get("id"),
    }

    result = PROVIDERS_COLL.insert_one(doc)
    logger.info(f"[delivery/providers] Created provider '{payload.slug}' by {user.get('wallet')}")

    return {
        "success": True,
        "provider_id": str(result.inserted_id),
        "slug": payload.slug,
    }


@router.get("/delivery/providers", summary="Listar proveedores de pedidos")
async def list_providers(
    status: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    query = {}
    if status:
        query["status"] = status

    cursor = PROVIDERS_COLL.find(query).sort("created_at", -1)
    providers = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
        if doc.get("updated_at"):
            doc["updated_at"] = doc["updated_at"].isoformat()
        providers.append(doc)

    return {"success": True, "providers": providers}


@router.get("/delivery/providers/{provider_id}", summary="Detalle de proveedor")
async def get_provider(
    provider_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    doc = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    doc["_id"] = str(doc["_id"])
    if doc.get("created_at"):
        doc["created_at"] = doc["created_at"].isoformat()
    if doc.get("updated_at"):
        doc["updated_at"] = doc["updated_at"].isoformat()

    return {"success": True, "provider": doc}


@router.patch("/delivery/providers/{provider_id}", summary="Actualizar proveedor")
async def update_provider(
    provider_id: str,
    payload: ProviderUpdate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    if payload.status and payload.status not in ("active", "paused", "disabled"):
        raise HTTPException(status_code=400, detail="Status debe ser 'active', 'paused' o 'disabled'")

    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = user.get("wallet") or user.get("id")

    PROVIDERS_COLL.update_one({"_id": ObjectId(provider_id)}, {"$set": update_data})
    logger.info(f"[delivery/providers] Updated provider '{provider_id}' by {user.get('wallet')}")

    return {"success": True, "message": "Proveedor actualizado"}


@router.delete("/delivery/providers/{provider_id}", summary="Desactivar proveedor")
async def delete_provider(
    provider_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    PROVIDERS_COLL.update_one(
        {"_id": ObjectId(provider_id)},
        {"$set": {
            "status": "disabled",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )
    logger.info(f"[delivery/providers] Disabled provider '{provider_id}' by {user.get('wallet')}")

    return {"success": True, "message": "Proveedor desactivado"}


# =====================================================================
# Commissions
# =====================================================================

class CommissionsUpdate(BaseModel):
    delivery_pct: Optional[float] = Field(None, ge=0, le=100, description="% comisión sobre delivery fee")
    platform_pct: Optional[float] = Field(None, ge=0, le=100, description="% comisión sobre subtotal pedido")
    payment_pct: Optional[float] = Field(None, ge=0, le=100, description="% comisión sobre medio de pago")
    notes: Optional[str] = Field(None, description="Notas del contrato")
    closing_day: Optional[str] = Field(None, description="Día de cierre semanal: monday-sunday")


@router.put("/delivery/providers/{provider_id}/commissions", summary="Actualizar comisiones")
async def update_provider_commissions(
    provider_id: str,
    payload: CommissionsUpdate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    prov = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    if payload.closing_day and payload.closing_day not in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        raise HTTPException(status_code=400, detail="closing_day debe ser un día de la semana en inglés")

    current = prov.get("commissions", {})
    update_fields = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    current.update(update_fields)

    PROVIDERS_COLL.update_one(
        {"_id": ObjectId(provider_id)},
        {"$set": {
            "commissions": current,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )
    logger.info(f"[delivery/providers] Commissions updated for '{prov.get('slug')}' by {user.get('wallet')}: {current}")

    return {"success": True, "commissions": current}


@router.get("/delivery/providers/{provider_id}/commissions", summary="Ver comisiones")
async def get_provider_commissions(
    provider_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(provider_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    prov = PROVIDERS_COLL.find_one({"_id": ObjectId(provider_id)})
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    return {
        "success": True,
        "provider_slug": prov.get("slug"),
        "commissions": prov.get("commissions", {
            "delivery_pct": 0, "platform_pct": 0, "payment_pct": 0,
            "notes": "", "closing_day": "monday",
        }),
    }
