"""
delivery/carriers.py
====================
CRUD for Last-Mile Carriers — external services that DELIVER orders
using their own riders/drivers (Uber Direct, PedidosYa, GetJusto).

Each carrier has:
- Auth config (OAuth2 or API key) with credentials
- API endpoints for quote/create/cancel delivery
- Webhook config for receiving status updates
- Status mapping from carrier-specific statuses → our internal order statuses
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

CARRIERS_COLL = db.delivery_carriers

# ======================================================================
# Presets — configuraciones conocidas para carriers de última milla
# ======================================================================

CARRIER_PRESETS = {
    "uber_direct": {
        "name": "Uber Direct",
        "slug": "uber_direct",
        "logo_url": "/logos/uber.svg",
        "mode": "test",
        "auth": {
            "type": "oauth2",
            "token_url": "https://login.uber.com/oauth/v2/token",
            "scope": "eats.deliveries",
            "client_id": "",
            "client_secret": "",
            "customer_id": "",
        },
        "endpoints": {
            "base_url": "https://api.uber.com",
            "create_quote": "/v1/customers/{customer_id}/delivery_quotes",
            "create_delivery": "/v1/customers/{customer_id}/deliveries",
            "cancel_delivery": "/v1/customers/{customer_id}/deliveries/{id}/cancel",
            "get_delivery": "/v1/customers/{customer_id}/deliveries/{id}",
        },
        "webhook": {
            "secret": "",
            "signature_header": "X-Uber-Signature",
            "events": [
                "event.delivery_status",
                "event.courier_update",
                "event.refund_request",
                "event.shopping_progress",
            ],
        },
        "status_mapping": {
            # Uber Direct delivery statuses → our internal statuses
            # Moto accepted & heading to restaurant → kitchen starts cooking
            "SCHEDULED": "confirmed",
            "EN_ROUTE_TO_PICKUP": "preparing",
            "ARRIVED_AT_PICKUP": "ready",
            "PICKUP_COMPLETE": "dispatched",
            "EN_ROUTE_TO_DROPOFF": "dispatched",
            "ARRIVED_AT_DROPOFF": "dispatched",
            "COMPLETED": "delivered",
            "CANCELLED": "cancelled",
            "RETURNED": "cancelled",
            # Legacy / fallback
            "pending": "confirmed",
            "pickup": "preparing",
            "dropoff": "dispatched",
            "delivered": "delivered",
            "canceled": "cancelled",
        },
        "description": "Uber Direct — on-demand delivery via Uber's courier network. Uses OAuth2 with eats.deliveries scope.",
    },
    "pedidosya": {
        "name": "PedidosYa Envíos",
        "slug": "pedidosya",
        "logo_url": "/logos/pedidosya.svg",
        "mode": "test",
        "auth": {
            "type": "api_key",
            "api_key": "",
            "header_name": "Authorization",
            "bearer_prefix": False,
            "customer_id": "",
            # If PedidosYa gives OAuth2 creds, switch type to "oauth2" + grant_type "password"
            "grant_type": "password",
            "token_url": "https://auth-api.pedidosya.com/v3/token",
        },
        "endpoints": {
            "base_url": "https://courier-api.pedidosya.com",
            "create_quote": "/v2/shippings",
            "create_delivery": "/v2/shippings/{id}/confirm",
            "cancel_delivery": "/v2/shippings/{id}/cancel",
            "get_delivery": "/v2/shippings/{id}",
            "webhook_config": "/v2/webhooks-configuration",
        },
        "webhook": {
            "secret": "",
            "signature_header": "x-api-key",
            "events": [
                "CONFIRMED",
                "READY_FOR_PICKUP",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
            ],
        },
        "status_mapping": {
            # PedidosYa shipping statuses → our internal statuses
            # Rider assigned & heading to restaurant → kitchen starts cooking
            "CONFIRMED": "confirmed",
            "READY_FOR_PICKUP": "preparing",
            "IN_PROGRESS": "preparing",
            "NEAR_PICKUP": "ready",
            "PICKED_UP": "dispatched",
            "NEAR_DROPOFF": "dispatched",
            "COMPLETED": "delivered",
            "CANCELLED": "cancelled",
            "RETURNED_TO_SENDER": "cancelled",
            # Legacy fallback
            "RECEIVED": "confirmed",
            "DISPATCHED": "dispatched",
            "DELIVERED": "delivered",
        },
        "description": "PedidosYa Envíos — last-mile delivery via PedidosYa's courier network. Uses Bearer token (API key).",
    },
    "getjusto": {
        "name": "GetJusto",
        "slug": "getjusto",
        "logo_url": "/logos/getjusto.svg",
        "mode": "test",
        "auth": {
            "type": "api_key",
            "api_key": "",
            "header_name": "Authorization",
            "customer_id": "",
        },
        "endpoints": {
            "base_url": "https://api.getjusto.com/v1",
            "create_quote": "/deliveries/quote",
            "create_delivery": "/deliveries",
            "cancel_delivery": "/deliveries/{id}/cancel",
            "get_delivery": "/deliveries/{id}",
        },
        "webhook": {
            "secret": "",
            "signature_header": "X-Justo-Signature",
            "events": ["delivery.created", "delivery.picked_up", "delivery.delivered", "delivery.cancelled"],
        },
        "status_mapping": {
            "created": "dispatched",
            "assigned": "dispatched",
            "picked_up": "dispatched",
            "delivered": "delivered",
            "cancelled": "cancelled",
        },
        "description": "GetJusto — last-mile delivery integration. Uses API key authentication.",
    },
}

# =====================================================================
# Pydantic Models
# =====================================================================

class CarrierAuth(BaseModel):
    type: str = Field("oauth2", description="oauth2 | api_key")
    grant_type: Optional[str] = Field(None, description="client_credentials | password")
    token_url: Optional[str] = None
    scope: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    username: Optional[str] = Field(None, description="For password grant (PedidosYa)")
    password: Optional[str] = Field(None, description="For password grant (PedidosYa)")
    customer_id: Optional[str] = Field(None, description="Customer ID (required for Uber Direct)")
    api_key: Optional[str] = None
    header_name: Optional[str] = None
    bearer_prefix: Optional[bool] = None
    token_format: Optional[str] = None

class CarrierEndpoints(BaseModel):
    base_url: str
    create_quote: Optional[str] = None
    create_delivery: str
    cancel_delivery: Optional[str] = None
    get_delivery: Optional[str] = None

class CarrierWebhook(BaseModel):
    secret: str = ""
    signature_header: str = ""
    events: List[str] = Field(default_factory=list)

class CarrierCreate(BaseModel):
    name: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)
    mode: str = Field("test", description="test | production")
    logo_url: Optional[str] = None
    auth: CarrierAuth
    endpoints: CarrierEndpoints
    webhook: CarrierWebhook = Field(default_factory=CarrierWebhook)
    status_mapping: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None

class CarrierUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    mode: Optional[str] = None
    logo_url: Optional[str] = None
    auth: Optional[CarrierAuth] = None
    endpoints: Optional[CarrierEndpoints] = None
    webhook: Optional[CarrierWebhook] = None
    status_mapping: Optional[Dict[str, str]] = None
    description: Optional[str] = None

# =====================================================================
# Endpoints
# =====================================================================

@router.get("/delivery/carriers/presets", summary="Obtener presets de carriers de última milla")
async def get_carrier_presets(user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    # Return presets without sensitive fields populated
    return {"success": True, "presets": CARRIER_PRESETS}


@router.post("/delivery/carriers", summary="Crear carrier de última milla")
async def create_carrier(
    payload: CarrierCreate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    # Check slug uniqueness
    existing = CARRIERS_COLL.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un carrier con slug '{payload.slug}'")

    now = datetime.now(timezone.utc)
    doc = {
        "name": payload.name,
        "slug": payload.slug,
        "mode": payload.mode,
        "status": "active",
        "logo_url": payload.logo_url,
        "auth": payload.auth.dict(),
        "endpoints": payload.endpoints.dict(),
        "webhook": payload.webhook.dict(),
        "status_mapping": payload.status_mapping,
        "description": payload.description,
        # OAuth2 token cache (populated on first use)
        "access_token": None,
        "token_expires_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("wallet") or user.get("id"),
    }

    result = CARRIERS_COLL.insert_one(doc)
    logger.info(f"[delivery/carriers] Created carrier '{payload.slug}' by {user.get('wallet')}")

    return {
        "success": True,
        "carrier_id": str(result.inserted_id),
        "slug": payload.slug,
    }


@router.get("/delivery/carriers", summary="Listar carriers de última milla")
async def list_carriers(
    status: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    query = {}
    if status:
        query["status"] = status

    cursor = CARRIERS_COLL.find(query).sort("created_at", -1)
    carriers = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Mask sensitive auth fields
        auth = doc.get("auth", {})
        if auth.get("client_secret"):
            auth["client_secret"] = "***"
        if auth.get("api_key"):
            auth["api_key"] = auth["api_key"][:8] + "***" if len(auth.get("api_key", "")) > 8 else "***"
        webhook = doc.get("webhook", {})
        if webhook.get("secret"):
            webhook["secret"] = "***"
        # Remove cached token from listing
        doc.pop("access_token", None)
        doc.pop("token_expires_at", None)
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
        if doc.get("updated_at"):
            doc["updated_at"] = doc["updated_at"].isoformat()
        carriers.append(doc)

    return {"success": True, "carriers": carriers}


@router.get("/delivery/carriers/{carrier_id}", summary="Detalle de carrier")
async def get_carrier(
    carrier_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(carrier_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    doc = CARRIERS_COLL.find_one({"_id": ObjectId(carrier_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")

    doc["_id"] = str(doc["_id"])
    # Mask sensitive fields
    auth = doc.get("auth", {})
    if auth.get("client_secret"):
        auth["client_secret"] = "***"
    if auth.get("api_key"):
        auth["api_key"] = auth["api_key"][:8] + "***" if len(auth.get("api_key", "")) > 8 else "***"
    doc.pop("access_token", None)
    doc.pop("token_expires_at", None)
    if doc.get("created_at"):
        doc["created_at"] = doc["created_at"].isoformat()
    if doc.get("updated_at"):
        doc["updated_at"] = doc["updated_at"].isoformat()

    return {"success": True, "carrier": doc}


@router.patch("/delivery/carriers/{carrier_id}", summary="Actualizar carrier")
async def update_carrier(
    carrier_id: str,
    payload: CarrierUpdate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(carrier_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = CARRIERS_COLL.find_one({"_id": ObjectId(carrier_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")

    if payload.status and payload.status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="Status debe ser 'active' o 'disabled'")

    update_data = {}
    for k, v in payload.dict(exclude_unset=True).items():
        if v is not None:
            update_data[k] = v

    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = user.get("wallet") or user.get("id")

    # If auth credentials changed, invalidate cached token
    if "auth" in update_data:
        update_data["access_token"] = None
        update_data["token_expires_at"] = None

    CARRIERS_COLL.update_one({"_id": ObjectId(carrier_id)}, {"$set": update_data})
    logger.info(f"[delivery/carriers] Updated carrier '{carrier_id}' by {user.get('wallet')}")

    return {"success": True, "message": "Carrier actualizado"}


@router.delete("/delivery/carriers/{carrier_id}", summary="Desactivar carrier")
async def delete_carrier(
    carrier_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(carrier_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = CARRIERS_COLL.find_one({"_id": ObjectId(carrier_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")

    CARRIERS_COLL.update_one(
        {"_id": ObjectId(carrier_id)},
        {"$set": {
            "status": "disabled",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )
    logger.info(f"[delivery/carriers] Disabled carrier '{carrier_id}' by {user.get('wallet')}")

    return {"success": True, "message": "Carrier desactivado"}


# =====================================================================
# Test Connection
# =====================================================================

class TestConnectionRequest(BaseModel):
    carrier_id: Optional[str] = None
    # Or pass raw auth for testing before saving
    auth: Optional[CarrierAuth] = None


@router.post("/delivery/carriers/test-connection", summary="Probar conexión OAuth2 con carrier")
async def test_carrier_connection(
    payload: TestConnectionRequest,
    user: dict = Depends(verify_session)
):
    """
    Test OAuth2 token exchange with a carrier.
    Can use an existing carrier_id or raw auth credentials.
    """
    require_admin_level(user, "delivery")
    import httpx

    auth = None
    carrier_name = "unknown"

    if payload.carrier_id and ObjectId.is_valid(payload.carrier_id):
        carrier = CARRIERS_COLL.find_one({"_id": ObjectId(payload.carrier_id)})
        if not carrier:
            raise HTTPException(status_code=404, detail="Carrier no encontrado")
        auth = carrier.get("auth", {})
        carrier_name = carrier.get("name", "unknown")
    elif payload.auth:
        auth = payload.auth.dict()
        carrier_name = "test"
    else:
        raise HTTPException(status_code=400, detail="Provide carrier_id or auth credentials")

    auth_type = auth.get("type", "")

    if auth_type == "api_key":
        api_key = auth.get("api_key", "")
        if not api_key:
            return {"success": False, "error": "API key vacía"}
        return {
            "success": True,
            "message": f"API key configurada ({len(api_key)} chars)",
            "auth_type": "api_key",
        }

    if auth_type == "oauth2":
        token_url = auth.get("token_url", "")
        client_id = auth.get("client_id", "")
        client_secret = auth.get("client_secret", "")
        scope = auth.get("scope", "")
        grant_type = auth.get("grant_type", "client_credentials")

        if not all([token_url, client_id, client_secret]):
            return {"success": False, "error": "Faltan credenciales OAuth2 (token_url, client_id, client_secret)"}

        token_data = {
            "grant_type": grant_type,
            "client_id": client_id,
            "client_secret": client_secret,
        }
        if scope:
            token_data["scope"] = scope

        if grant_type == "password":
            username = auth.get("username", "")
            password = auth.get("password", "")
            if not username or not password:
                return {"success": False, "error": "Faltan username/password para grant_type=password"}
            token_data["username"] = username
            token_data["password"] = password

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # password grant (PedidosYa) requires JSON body; client_credentials uses form
                use_json = auth.get("token_format") == "json" or grant_type == "password"
                if use_json:
                    resp = await client.post(token_url, json=token_data)
                else:
                    resp = await client.post(token_url, data=token_data)

            if resp.status_code == 200:
                data = resp.json()
                token = data.get("access_token") or data.get("token") or data.get("access") or ""
                expires_in = data.get("expires_in", 0)
                logger.info(f"[carriers/test] ✅ OAuth2 token OK for {carrier_name} (expires in {expires_in}s)")
                return {
                    "success": True,
                    "message": f"Token obtenido exitosamente (expira en {expires_in}s)" if expires_in else "Token obtenido exitosamente",
                    "auth_type": "oauth2",
                    "grant_type": grant_type,
                    "token_preview": token[:20] + "..." if len(token) > 20 else token,
                }
            else:
                error_body = resp.text[:300]
                logger.warning(f"[carriers/test] ❌ OAuth2 failed for {carrier_name}: {resp.status_code} {error_body}")
                return {
                    "success": False,
                    "error": f"OAuth2 error {resp.status_code}: {error_body}",
                    "auth_type": "oauth2",
                }

        except httpx.ConnectError as e:
            return {"success": False, "error": f"No se pudo conectar a {token_url}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    return {"success": False, "error": f"Tipo de auth desconocido: {auth_type}"}
