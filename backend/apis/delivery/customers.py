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
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from apis.admin.apikeys import validate_api_key
from utils.vanellix_crypto import verify_dilithium as dilithium_verify

router = APIRouter()
logger = logging.getLogger(__name__)

CUSTOMERS_COLL = db.delivery_customers
PROVIDERS_COLL = db.delivery_providers

# =====================================================================
# Auth helpers (same pattern as orders.py)
# =====================================================================

def _verify_api_key(x_api_key: str = Header(..., alias="X-Api-Key")):
    key_doc = validate_api_key(x_api_key)
    if not key_doc:
        raise HTTPException(status_code=401, detail="API Key inválida, inactiva o expirada")
    return key_doc


def _resolve_provider_slug(key_doc: dict) -> str:
    """Resolve provider slug from API key."""
    key_id = key_doc.get("id")
    if not key_id:
        return "unknown"
    provider = PROVIDERS_COLL.find_one({"api_key_id": key_id, "status": "active"})
    return provider["slug"] if provider else "unknown"


def _resolve_provider(key_doc: dict) -> Optional[dict]:
    """Resolve full provider doc from API key."""
    from utils.vanellix_crypto import _resolve_provider as resolve_provider
    return resolve_provider(key_doc)


async def _verify_dilithium(request, key_doc: dict) -> None:
    """Verify Dilithium post-quantum signature (delegates to centralized guard)."""
    from utils.vanellix_crypto import verify_dilithium_request
    await verify_dilithium_request(request, key_doc, context="delivery/customers")


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
    wallet: Optional[str] = None


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
    key_doc: dict = Depends(_verify_api_key)
):
    """
    Upsert a delivery customer by privy_id.
    Called by the delivery app on user login/registration.
    Verifies Dilithium signature if provider has a public key.
    """
    await _verify_dilithium(request, key_doc)
    now = datetime.now(timezone.utc)
    provider_slug = _resolve_provider_slug(key_doc)

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
        if payload.wallet and payload.wallet != existing.get("wallet"):
            update_set["wallet"] = payload.wallet

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
            "wallet": payload.wallet,
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
        return {"success": True, "customer": _serialize(customer_doc), "action": "registered"}


@router.get("/delivery/customers/by-privy/{privy_id}", summary="Obtener perfil de customer por privy_id")
async def get_customer_by_privy(
    privy_id: str,
    key_doc: dict = Depends(_verify_api_key)
):
    """Get a customer profile by privy_id. API key auth."""
    customer = CUSTOMERS_COLL.find_one({"privy_id": privy_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer no encontrado")
    return {"success": True, "customer": _serialize(customer)}


@router.patch("/delivery/customers/by-privy/{privy_id}", summary="Actualizar perfil de customer")
async def update_customer_by_privy(
    privy_id: str,
    payload: CustomerUpdate,
    request: Request,
    key_doc: dict = Depends(_verify_api_key)
):
    """Update customer profile fields. API key + Dilithium auth."""
    await _verify_dilithium(request, key_doc)
    now = datetime.now(timezone.utc)

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
    key_doc: dict = Depends(_verify_api_key)
):
    """Upsert an address in the customer's address list. API key + Dilithium auth."""
    await _verify_dilithium(request, key_doc)
    now = datetime.now(timezone.utc)

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
    key_doc: dict = Depends(_verify_api_key)
):
    """Delete an address from the customer's address list. API key + Dilithium auth."""
    await _verify_dilithium(request, key_doc)
    result = CUSTOMERS_COLL.update_one(
        {"privy_id": privy_id},
        {
            "$pull": {"addresses": {"id": address_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)},
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
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
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
