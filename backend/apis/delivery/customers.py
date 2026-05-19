"""
delivery/customers.py
=====================
Central customer registry for delivery.
The delivery app (8082) proxies here — this is the source of truth.

Auth:
  - register/get/patch by privy_id: API key (same as orders)
  - list all (CRM view): Admin session (lvl 3-5)

Collection: delivery_customers
"""

import logging
from utils.time_utils import get_chile_time
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from apis.admin.apikeys import validate_api_key
from utils.vanellix_crypto import verify_dilithium as dilithium_verify

router = APIRouter()
logger = logging.getLogger(__name__)

CUSTOMERS_COLL = db.delivery_customers
PROVIDERS_COLL = db.ecosystem_providers
CONSENT_COLL = db.payment_consents

# =====================================================================
# Auth helpers (same pattern as orders.py)
# =====================================================================

from apis.admin.ecosystem_providers import verify_satellite_webhook


def _serialize(doc: dict) -> dict:
    """MongoDB doc → JSON-safe dict."""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    for dt_field in ("registered_at", "last_login_at", "updated_at"):
        if doc.get(dt_field) and isinstance(doc[dt_field], datetime):
            doc[dt_field] = doc[dt_field].isoformat()
    return doc


# =====================================================================
# Pydantic Models
# =====================================================================

class AddressModel(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., description="Etiqueta: Casa, Trabajo, etc.")
    street: str
    number: str
    apartment: Optional[str] = None
    commune: str
    region: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False


class CustomerRegister(BaseModel):
    privy_id: str = Field(..., min_length=1, description="Privy DID del customer")
    email: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    wallet: Optional[str] = None
    addresses: Optional[List[AddressModel]] = None


class AddressUpsert(BaseModel):
    privy_id: str
    address: AddressModel


class AddressDelete(BaseModel):
    privy_id: str
    address_id: str


# =====================================================================
# Endpoints — API Key auth (called by delivery app)
# =====================================================================

@router.post("/delivery/customers/register", summary="Registrar o actualizar customer de delivery")
async def register_customer(
    payload: CustomerRegister,
    request: Request,
    provider: dict = Depends(verify_satellite_webhook)
):
    """
    Upsert a delivery customer by privy_id.
    Called by the delivery app on user login/registration.
    Verifies Dilithium signature.
    """
    now = get_chile_time()
    provider_slug = provider.get("slug", "unknown")
    
    print("\n" + "="*50)
    print("🚀 [ADMIN HUB] NUEVO REGISTRO / LOGIN (register_customer)")
    print(f"📦 Payload completo: {payload.model_dump()}")
    print("="*50 + "\n")

    existing = CUSTOMERS_COLL.find_one({"privy_id": payload.privy_id})

    if existing:
        # Update — merge non-null fields
        update_set = {"last_login_at": now, "updated_at": now}
        if payload.email and payload.email != existing.get("email"):
            update_set["email"] = payload.email
        if payload.name and payload.name != existing.get("name"):
            update_set["name"] = payload.name
        if payload.phone and payload.phone != existing.get("phone"):
            update_set["phone"] = payload.phone

        CUSTOMERS_COLL.update_one(
            {"privy_id": payload.privy_id},
            {
                "$set": update_set,
                "$inc": {"login_count": 1},
            }
        )
        updated = CUSTOMERS_COLL.find_one({"privy_id": payload.privy_id})
        logger.info(f"[delivery/customers] Login #{updated.get('login_count', 0)} for {payload.privy_id}")
        return {"success": True, "customer": _serialize(updated), "action": "login"}

    else:
        # New customer
        customer_doc = {
            "privy_id": payload.privy_id,
            "provider_slug": provider_slug,
            "email": payload.email,
            "name": payload.name,
            "phone": payload.phone,
            "addresses": [],
            "registered_at": now,
            "last_login_at": now,
            "updated_at": now,
            "login_count": 1,
            "order_count": 0,
            "total_spent": 0.0,
        }
        result = CUSTOMERS_COLL.insert_one(customer_doc)
        customer_doc["_id"] = str(result.inserted_id)

        logger.info(f"[delivery/customers] New customer registered: {payload.privy_id} via {provider_slug}")
        
        # Trigger Automations
        import asyncio
        from services.automation_engine import trigger_event
        asyncio.create_task(trigger_event("customer_registered", "customers", {
            "privy_id": payload.privy_id,
            "email": payload.email or "",
            "name": payload.name or "Customer",
            "phone": payload.phone or ""
        }))
        
        return {"success": True, "customer": _serialize(customer_doc), "action": "registered"}


@router.post("/delivery/customers/webhook/registered", summary="Webhook para registro de usuario desde delivery app")
async def customer_registered_webhook(
    payload: CustomerRegister,
    request: Request,
    provider: dict = Depends(verify_satellite_webhook)
):
    """
    Called by the delivery app when a NEW customer registers natively.
    Verifies Dilithium signature and triggers the "customer_registered" event.
    """

    print("\n" + "="*50)
    print("🚀 [ADMIN HUB] WEBHOOK RECIBIDO (customer_registered_webhook)")
    print(f"📦 Payload completo: {payload.model_dump()}")
    print("="*50 + "\n")
    
    logger.info(f"[delivery/customers] Received registration webhook for {payload.privy_id}")
    
    # Trigger Automations
    import asyncio
    from services.automation_engine import trigger_event
    asyncio.create_task(trigger_event("customer_registered", "customers", {
        "privy_id": payload.privy_id,
        "email": payload.email or "",
        "name": payload.name or "Customer",
        "phone": payload.phone or ""
    }))
    
    return {"success": True, "action": "webhook_processed"}


@router.get("/delivery/customers/by-privy/{privy_id}", summary="Obtener perfil de customer por privy_id")
async def get_customer_by_privy(
    privy_id: str,
    provider: dict = Depends(verify_satellite_webhook)
):
    """Get a customer profile by privy_id. Dilithium auth."""
    customer = CUSTOMERS_COLL.find_one({"privy_id": privy_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer no encontrado")
    return {"success": True, "customer": _serialize(customer)}


@router.patch("/delivery/customers/by-privy/{privy_id}", summary="Actualizar perfil de customer")
async def update_customer_by_privy(
    privy_id: str,
    payload: CustomerUpdate,
    request: Request,
    provider: dict = Depends(verify_satellite_webhook)
):
    """Update customer profile fields. Dilithium auth."""
    now = get_chile_time()

    existing = CUSTOMERS_COLL.find_one({"privy_id": privy_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer no encontrado")

    update_data = {"updated_at": now}
    for field in ("name", "email", "phone", "wallet"):
        val = getattr(payload, field, None)
        if val is not None:
            update_data[field] = val

    if payload.addresses is not None:
        update_data["addresses"] = [a.dict() for a in payload.addresses]

    CUSTOMERS_COLL.update_one({"privy_id": privy_id}, {"$set": update_data})

    updated = CUSTOMERS_COLL.find_one({"privy_id": privy_id})
    logger.info(f"[delivery/customers] Profile updated for {privy_id}")
    return {"success": True, "customer": _serialize(updated)}


@router.post("/delivery/customers/address", summary="Agregar o actualizar dirección")
async def upsert_address(
    payload: AddressUpsert,
    request: Request,
    provider: dict = Depends(verify_satellite_webhook)
):
    """Upsert an address in the customer's address list. Dilithium auth."""
    now = get_chile_time()

    customer = CUSTOMERS_COLL.find_one({"privy_id": payload.privy_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer no encontrado")

    addresses = customer.get("addresses", [])
    addr_data = payload.address.dict()

    # Generate ID if new
    if not addr_data.get("id"):
        addr_data["id"] = f"addr_{int(now.timestamp() * 1000)}"

    # If setting as default, unset others
    if addr_data.get("is_default"):
        for a in addresses:
            a["is_default"] = False

    # Upsert in list
    found = False
    for i, a in enumerate(addresses):
        if a.get("id") == addr_data["id"]:
            addresses[i] = addr_data
            found = True
            break
    if not found:
        addresses.append(addr_data)

    CUSTOMERS_COLL.update_one(
        {"privy_id": payload.privy_id},
        {"$set": {"addresses": addresses, "updated_at": now}}
    )

    logger.info(f"[delivery/customers] Address {'updated' if found else 'added'} for {payload.privy_id}")
    return {"success": True, "address_id": addr_data["id"]}


@router.delete("/delivery/customers/address/{address_id}", summary="Eliminar dirección")
async def delete_address(
    address_id: str,
    request: Request,
    privy_id: str = Query(..., description="Privy ID del customer"),
    provider: dict = Depends(verify_satellite_webhook)
):
    """Delete an address from the customer's address list. Dilithium auth."""
    result = CUSTOMERS_COLL.update_one(
        {"privy_id": privy_id},
        {
            "$pull": {"addresses": {"id": address_id}},
            "$set": {"updated_at": get_chile_time()},
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Dirección no encontrada")

    logger.info(f"[delivery/customers] Address {address_id} deleted for {privy_id}")
    return {"success": True}


# =====================================================================
# Endpoints — Admin session auth (CRM view)
# =====================================================================

@router.get("/delivery/customers", summary="Listar customers de delivery (admin)")
async def list_customers(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    provider: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    """List all delivery customers. Admin session auth (lvl 3-5)."""
    require_admin_level(user, "delivery")

    query = {}
    if provider:
        query["provider_slug"] = provider
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"privy_id": {"$regex": search, "$options": "i"}},
        ]

    total = CUSTOMERS_COLL.count_documents(query)
    cursor = CUSTOMERS_COLL.find(query).sort("last_login_at", -1).skip(skip).limit(limit)
    customers = [_serialize(doc) for doc in cursor]

    return {
        "success": True,
        "customers": customers,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/delivery/customers/stats", summary="Estadísticas de customers (admin)")
async def customer_stats(user: dict = Depends(verify_session)):
    """Basic customer stats for admin dashboard."""
    require_admin_level(user, "delivery")

    total = CUSTOMERS_COLL.count_documents({})
    with_orders = CUSTOMERS_COLL.count_documents({"order_count": {"$gt": 0}})

    # Registered last 7 days
    from datetime import timedelta
    week_ago = get_chile_time() - timedelta(days=7)
    new_this_week = CUSTOMERS_COLL.count_documents({"registered_at": {"$gte": week_ago}})

    # Active last 7 days
    active_this_week = CUSTOMERS_COLL.count_documents({"last_login_at": {"$gte": week_ago}})

    return {
        "success": True,
        "stats": {
            "total_customers": total,
            "with_orders": with_orders,
            "new_this_week": new_this_week,
            "active_this_week": active_this_week,
        }
    }


# =====================================================================
# Payment Token Relay (A1) — Satellite apps request bound tokens
# =====================================================================

@router.get("/delivery/customers/{privy_id}/card-token", summary="Get bound card token for satellite apps")
async def get_card_token(
    privy_id: str,
    provider: dict = Depends(verify_satellite_webhook)  # Dilithium auth
):
    """
    Return the bound tbk_user token for a customer.
    Only accessible by authenticated satellite apps (Carta, etc.) via Dilithium.
    The requesting satellite MUST verify user identity before calling.
    """
    customer = CUSTOMERS_COLL.find_one({"privy_id": privy_id})
    if not customer or not customer.get("transbank"):
        raise HTTPException(status_code=404, detail="No card found for this customer")

    tb = customer["transbank"]
    logger.info(f"[customers] Card token relayed for {privy_id} to {provider.get('slug')}")
    return {
        "success": True,
        "tbk_user": tb["tbk_user"],
        "tbk_user_sig": tb.get("tbk_user_sig"),
        "sig_version": tb.get("sig_version", 1),
        "card_type": tb.get("card_type"),
        "card_last4": str(tb.get("card_number", ""))[-4:],
    }


# =====================================================================
# Consent Viewer (A3) — Admin views consent history
# =====================================================================

@router.get("/delivery/customers/{privy_id}/consents", summary="View consent history (admin)")
async def get_customer_consents(
    privy_id: str,
    user: dict = Depends(verify_session)
):
    """View payment consent history. Admin lvl 3-5."""
    require_admin_level(user, "delivery")
    consents = list(CONSENT_COLL.find({"privy_id": privy_id}).sort("accepted_at", -1))
    for c in consents:
        c["_id"] = str(c["_id"])
        # Serialize datetime fields
        for dt_field in ("accepted_at", "received_at"):
            if c.get(dt_field) and isinstance(c[dt_field], datetime):
                c[dt_field] = c[dt_field].isoformat()
    return {"success": True, "consents": consents}


# =====================================================================
# Consent Sync Webhook (A4) — Receive consent records from satellites
# =====================================================================

@router.post("/delivery/customers/consent", summary="Receive consent record from satellite")
async def receive_consent_webhook(
    request: Request,
    provider: dict = Depends(verify_satellite_webhook)  # Dilithium auth
):
    """Receive and store consent records from satellite apps."""
    body = await request.json()
    body["received_at"] = get_chile_time()
    body["source_provider"] = provider.get("slug", "unknown")
    CONSENT_COLL.insert_one(body)
    logger.info(f"[customers] Consent received for {body.get('privy_id')} from {provider.get('slug')}")
    return {"success": True}
