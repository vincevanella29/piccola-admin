"""
delivery/orders.py
==================
Manages delivery order lifecycle:
- External ingestion via API key (from order providers like Vanellix)
- Admin listing with filters (status, provider, date)
- Status transitions (pending → confirmed → preparing → ready → dispatched → delivered)
- Order detail with carrier/courier info
- Stats endpoint for KPIs
"""

import logging
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import httpx

from utils.kds_ws import kds_manager

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from config.roles.access_locals import (
    get_perms_from_user,
    allowed_local_filter,
    validate_include_local_or_403,
)
from apis.admin.apikeys import validate_api_key
from utils.vanellix_crypto import verify_dilithium as dilithium_verify
from utils.time_utils import get_chile_time, to_chile_time, CHILE_TZ

router = APIRouter()
logger = logging.getLogger(__name__)

DELIVERY_COLL = db.delivery_orders
MENUS_COLL = db.menus
LOCATIONS_COLL = db.locations
PROVIDERS_COLL = db.delivery_providers
CONFIG_COLL = db.delivery_config

# =====================================================================
# Modelos de Datos
# =====================================================================

class CustomerInfo(BaseModel):
    name: str = Field(..., min_length=1, description="Nombre del cliente")
    email: str = Field(..., description="Correo del cliente")
    phone: str = Field(..., description="Teléfono de contacto")

class DeliveryInfo(BaseModel):
    address: str = Field(..., description="Dirección completa formateada")
    lat: float
    lng: float
    depto: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    commune: Optional[str] = None
    city: Optional[str] = None
    instructions: Optional[str] = None

class ModifierItem(BaseModel):
    option_id: str
    value_id: str
    price: float = 0.0

class OrderItem(BaseModel):
    codigo: str
    quantity: int = Field(..., ge=1)
    unit_price: float
    modifiers: List[ModifierItem] = []

class DeliveryOrderCreate(BaseModel):
    location_id: str = Field(..., description="permalink_slug de la sucursal")
    customer: CustomerInfo
    items: List[OrderItem] = Field(..., min_length=1)
    delivery_fee: float = 0.0
    total_amount: float
    notes: Optional[str] = None
    # Auto-dispatch fields
    order_type: str = Field("delivery", description="'delivery' o 'pickup'")
    carrier_slug: Optional[str] = Field(None, description="Carrier elegido por el cliente")
    scheduled_for: Optional[str] = Field(None, description="ISO datetime si es programado, null si ASAP")
    asap: bool = True
    delivery_info: Optional[DeliveryInfo] = None
    order_number: Optional[str] = Field(None, description="Delivery-side order number (e.g. PI-3C56E433)")
    # Payment info (forwarded from delivery app, preserved in admin)
    payment_method: Optional[str] = Field(None, description="card, cash, transfer")
    payment_status: Optional[str] = Field(None, description="paid, pending, failed")

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="pending, confirmed, preparing, ready, dispatched, delivered, cancelled")

class BatchStatusRequest(BaseModel):
    order_ids: List[str] = Field(..., description="Lista de IDs de ordenes (Admin) para verificar estado")

# =====================================================================
# Auth helpers
# =====================================================================

def verify_external_api_key(x_api_key: str = Header(..., description="API Key con formato key_id.secret")):
    key_doc = validate_api_key(x_api_key)
    if not key_doc:
        raise HTTPException(status_code=401, detail="API Key inválida, inactiva o expirada")
    return key_doc


def _resolve_provider(key_doc: dict) -> Optional[dict]:
    """Find which order provider is linked to this API key."""
    key_id = key_doc.get("id")
    if not key_id:
        return None
    return PROVIDERS_COLL.find_one({"api_key_id": key_id, "status": "active"})


def _serialize_order(doc: dict) -> dict:
    """Convert a MongoDB order doc to a JSON-serializable dict."""
    doc["_id"] = str(doc["_id"])
    for dt_field in ("created_at", "updated_at", "dispatched_at", "delivered_at", "last_dispatch_retry", "carrier_accepted_at"):
        if doc.get(dt_field) and isinstance(doc[dt_field], datetime):
            dt = doc[dt_field]
            # Naive datetimes (legacy) — assume Chile local time
            if dt.tzinfo is None:
                dt = CHILE_TZ.localize(dt)
            doc[dt_field] = dt.isoformat()
    return doc


def _serialize_dt(dt_val) -> Optional[str]:
    """Serialize a datetime to ISO string with Chile TZ offset. Handles naive datetimes (legacy)."""
    if dt_val is None:
        return None
    if isinstance(dt_val, str):
        return dt_val  # already serialized
    if isinstance(dt_val, datetime):
        if dt_val.tzinfo is None:
            dt_val = CHILE_TZ.localize(dt_val)
        return dt_val.isoformat()
    return str(dt_val)


async def _notify_delivery_provider(order: dict, status: str, carrier_status: str = None, courier_info: dict = None):
    """
    Push status update to the delivery app that originated this order.
    Looks up the provider's domain/sync_url and pushes via POST /order/status-push.
    Signed with Dilithium2 using the provider's mnemonic.
    Fire-and-forget — failure doesn't block the admin.
    """
    import json
    import time
    import uuid

    provider_slug = order.get("provider_slug")
    if not provider_slug:
        return

    provider = PROVIDERS_COLL.find_one({"slug": provider_slug, "status": "active"})
    if not provider:
        return

    domain = provider.get("domain", "")
    sync_url = provider.get("sync_url", "")

    if not domain and not sync_url:
        return

    # Build the status-push URL
    if domain:
        push_url = f"{domain.rstrip('/')}/api/order/status-push"
    else:
        base_url = sync_url.rsplit("/catalog/sync", 1)[0] if "/catalog/sync" in sync_url else sync_url.rsplit("/", 1)[0]
        push_url = f"{base_url}/order/status-push"

    push_payload = {
        "admin_order_id": str(order.get("_id", "")),
        "order_number": order.get("order_number", ""),
        "status": status,
    }
    if carrier_status:
        push_payload["carrier_status"] = carrier_status
    if courier_info:
        push_payload["courier_info"] = courier_info
    if order.get("delivered_at"):
        push_payload["delivered_at"] = order["delivered_at"].isoformat() if isinstance(order["delivered_at"], datetime) else str(order["delivered_at"])
    if order.get("dispatched_at"):
        push_payload["dispatched_at"] = order["dispatched_at"].isoformat() if isinstance(order["dispatched_at"], datetime) else str(order["dispatched_at"])

    # Canonical JSON for Dilithium signing
    body_bytes = json.dumps(push_payload, separators=(",", ":"), sort_keys=True).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    api_key_id = provider.get("api_key_id", "")
    if api_key_id:
        headers["X-Api-Key"] = api_key_id

    # Sign with Dilithium2 using provider's mnemonic
    mnemonic_enc = provider.get("dilithium_mnemonic_enc", "")
    if mnemonic_enc:
        try:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic, sign_with_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
            sig_hex, pk_hex = sign_with_mnemonic(mnemonic, body_bytes)
            headers["X-Dilithium-Signature"] = sig_hex
            headers["X-Dilithium-PK"] = pk_hex
            headers["X-Dilithium-Algorithm"] = "dilithium2"
            headers["X-Dilithium-Timestamp"] = str(time.time())
            headers["X-Dilithium-Nonce"] = uuid.uuid4().hex
        except Exception as e:
            logger.warning(f"[status-push] Dilithium sign failed: {e}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(push_url, content=body_bytes, headers=headers)

        if resp.status_code == 200:
            logger.info(f"[status-push] ✅ Pushed status '{status}' to {provider_slug} (Dilithium signed)")
        else:
            logger.warning(f"[status-push] ⚠️ {provider_slug} returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"[status-push] ❌ Failed to push to {provider_slug}: {repr(e)}")


# =====================================================================
# Auto-dispatch to last-mile carrier (fire-and-forget)
# =====================================================================

CARRIERS_COLL = db.delivery_carriers

async def _auto_dispatch(order_id: str, carrier_slug: str, loc: dict):
    """
    Auto-dispatch order to a carrier. Thin wrapper around create_carrier_delivery().
    Called as fire-and-forget after order creation.
    If it fails, the order stays in 'pending' — worker will retry.
    """
    try:
        from apis.delivery.last_mile import create_carrier_delivery

        # Resolve carrier exactly as requested
        carrier = CARRIERS_COLL.find_one({"slug": carrier_slug, "status": "active"})
        if not carrier:
            logger.warning(f"[auto-dispatch] No active carrier found for slug '{carrier_slug}' — order stays pending")
            return

        # Fetch full order doc (we need items for manifest)
        order = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
        if not order:
            logger.error(f"[auto-dispatch] Order {order_id} not found")
            return

        # Single path dispatch
        carrier_delivery_id = await create_carrier_delivery(carrier, order, loc)

        # Update order with carrier delivery ID
        now = get_chile_time()
        DELIVERY_COLL.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "carrier_slug": carrier["slug"],
                "carrier_delivery_id": carrier_delivery_id,
                "carrier_status": "pending",
                "status": "confirmed",
                "dispatched_at": now,
                "updated_at": now,
            }, "$inc": {
                "dispatch_count": 1
            }}
        )

        logger.info(f"[auto-dispatch] ✅ Order {order_id} → {carrier['slug']} → {carrier_delivery_id}")

        # Broadcast to KDS so admin UI updates immediately
        asyncio.create_task(kds_manager.broadcast(
            {"type": "status_change", "order_id": order_id, "status": "confirmed",
             "carrier_slug": carrier["slug"], "carrier_delivery_id": carrier_delivery_id,
             "location_id": order.get("location_id")},
            location_id=order.get("location_id"),
        ))

        # Trigger email automations for confirmed status
        try:
            from apis.mailing.automations import check_automations
            check_automations(order, "confirmed")
        except Exception as e:
            logger.warning(f"[auto-dispatch] Automation check failed (non-fatal): {e}")

    except Exception as e:
        logger.error(f"[auto-dispatch] ❌ Order {order_id}: {e}")


# =====================================================================
# Endpoints (External API - Ingreso de Pedidos)
# =====================================================================

@router.post("/delivery/orders", summary="Recepcionar pedido de delivery externo")
async def create_delivery_order(
    request: Request,
    payload: DeliveryOrderCreate,
    key_doc: dict = Depends(verify_external_api_key)
):
    """
    Ingresa al sistema un pedido originado desde una plataforma externa o landing page.
    Valida la API key, resuelve el proveedor, verifica firma Dilithium (si aplica),
    la integridad del local, y los precios de los productos enviados.
    """

    # 0. Resolver proveedor asociado a la API key
    provider = _resolve_provider(key_doc)
    provider_slug = provider["slug"] if provider else "unknown"
    provider_name = provider["name"] if provider else "Unknown"

    # 0.5 Verify Dilithium post-quantum signature
    from utils.vanellix_crypto import verify_dilithium_request
    await verify_dilithium_request(request, key_doc, context="delivery/orders")

    # 1. Validar la sucursal por permalink_slug
    loc = db.locations.find_one({"permalink_slug": payload.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    # 1.5 Validación delivery: rechazar si falta data crítica para dispatch
    if payload.order_type == "delivery":
        missing = []
        if not payload.customer.phone:
            missing.append("customer.phone")
        if not payload.delivery_info:
            missing.append("delivery_info")
        else:
            if not payload.delivery_info.lat or not payload.delivery_info.lng:
                missing.append("delivery_info.lat/lng")
            if not payload.delivery_info.address:
                missing.append("delivery_info.address")
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Faltan campos obligatorios para delivery: {', '.join(missing)}",
            )

    # 2. Validar ítems del carrito contra DB por codigo
    codigos_enviados = {item.codigo for item in payload.items}
    db_items_list = list(MENUS_COLL.find({"codigo": {"$in": list(codigos_enviados)}}))
    db_items_map = {item["codigo"]: item for item in db_items_list}

    calculated_subtotal = 0.0

    for item in payload.items:
        db_item = db_items_map.get(item.codigo)
        if not db_item:
            raise HTTPException(status_code=400, detail=f"Producto con código {item.codigo} no existe en la carta.")

        if not db_item.get("estado", True):
            raise HTTPException(status_code=400, detail=f"Producto con código {item.codigo} se encuentra inactivo.")

        db_price = db_item.get("precio", 0.0)

        if float(db_price) != float(item.unit_price):
            logger.warning(f"[Delivery Validation] Precios difieren para {item.codigo}. DB={db_price}, Recibido={item.unit_price}")

        mods_total = sum(m.price for m in item.modifiers)
        item_total = (item.unit_price + mods_total) * item.quantity
        calculated_subtotal += item_total

    calculated_total = calculated_subtotal + payload.delivery_fee

    if abs(calculated_total - payload.total_amount) > 1.0:
        logger.warning(f"Total Amount mismatch. Calculated: {calculated_total}, Sent: {payload.total_amount}")

    # 3. Preparar documento de inserción
    now = get_chile_time()

    order_doc = {
        "api_key_id": key_doc["id"],
        "api_key_owner": key_doc["owner"],
        "provider_slug": provider_slug,
        "provider_name": provider_name,
        "location_id": str(loc["_id"]),
        "location_slug": loc.get("slug") or loc.get("permalink_slug"),
        "location_name": loc.get("nombre") or loc.get("name"),
        "customer": payload.customer.dict(),
        "items": [{
            **i.dict(),
            "nombre": db_items_map.get(i.codigo, {}).get("nombre", i.codigo),
        } for i in payload.items],
        "delivery_fee": payload.delivery_fee,
        "total_amount": payload.total_amount,
        "notes": payload.notes,
        "order_type": payload.order_type,
        "scheduled_for": payload.scheduled_for,
        "asap": payload.asap,
        "status": "pending",
        "order_number": payload.order_number,
        # Carrier/last-mile fields
        "carrier_slug": payload.carrier_slug,
        "carrier_delivery_id": None,
        "carrier_quote_id": None,
        "carrier_status": None,
        "courier_info": None,
        "dispatched_at": None,
        "delivered_at": None,
        "delivery_info": payload.delivery_info.dict() if payload.delivery_info else None,
        # Payment (forwarded from delivery app)
        "payment_method": payload.payment_method,
        "payment_status": payload.payment_status,
        # Timestamps
        "created_at": now,
        "updated_at": now,
    }

    result = DELIVERY_COLL.insert_one(order_doc)
    order_id = str(result.inserted_id)

    # Broadcast new order to KDS WebSocket clients
    asyncio.create_task(kds_manager.broadcast(
        {"type": "new_order", "order_id": order_id, "status": "pending",
         "location_id": str(loc["_id"]), "provider": provider_slug},
        location_id=str(loc["_id"]),
    ))

    # Auto-dispatch to last-mile carrier (fire-and-forget)
    if payload.order_type == "delivery":
        if payload.carrier_slug:
            asyncio.create_task(_auto_dispatch(
                order_id=order_id,
                carrier_slug=payload.carrier_slug,
                loc=loc,
            ))
        else:
            logger.warning(f"[delivery/orders] Order {order_id} created without carrier_slug. Dispatch deferred.")

    # Fire outgoing webhooks (fire-and-forget)
    try:
        from apis.delivery.webhooks import fire_webhooks
        order_doc["_id"] = order_id
        asyncio.create_task(fire_webhooks("order.created", order_doc))
    except Exception as e:
        logger.warning(f"[delivery/orders] Webhook fire failed (non-fatal): {e}")

    # Trigger email automations for new order (status = "pending")
    try:
        from apis.mailing.automations import check_automations
        check_automations(order_doc, "pending")
    except Exception as e:
        logger.warning(f"[delivery/orders] Automation check failed (non-fatal): {e}")

    logger.info(f"[delivery/orders] New order from provider='{provider_slug}' location='{loc.get('slug')}' "
                f"type={payload.order_type} carrier={payload.carrier_slug} total={payload.total_amount}")

    return {
        "success": True,
        "order_id": order_id,
        "status": "pending",
        "provider": provider_slug,
        "carrier_slug": payload.carrier_slug,
        "auto_dispatch": payload.order_type == "delivery" and payload.carrier_slug is not None,
        "message": "Pedido ingresado correctamente.",
    }


# =====================================================================
# Endpoints (Admin API - Gestión Interna)
# =====================================================================

@router.get("/delivery/locations", summary="Locations para mapa de despacho")
async def get_delivery_locations(user: dict = Depends(verify_session)):
    """Return locations with geo data for the dispatch map. Filtered by user permissions."""
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    allowed_slugs = allowed_local_filter(perms)  # None = all, set() = none, set[str] = specific

    query = {}
    if allowed_slugs is not None:
        if not allowed_slugs:
            return {"locations": []}
        query["permalink_slug"] = {"$in": list(allowed_slugs)}

    locs = list(db.locations.find(query, {
        "_id": 1, "nombre": 1, "name": 1, "slug": 1, "permalink_slug": 1,
        "direccion": 1, "address": 1, "lat": 1, "lng": 1, "city": 1,
        "telefono": 1, "estado": 1,
    }))
    for loc in locs:
        loc["_id"] = str(loc["_id"])
    return {"locations": locs}

@router.post("/delivery/orders/batch-status", summary="Sincronización por lotes de estado de pedidos")
async def get_batch_order_statuses(payload: BatchStatusRequest, api_key_doc: dict = Depends(verify_external_api_key)):
    """
    Returns the current status, carrier_status, and courier_info for a batch of order IDs.
    Extremely efficient O(1) query used by the delivery app to recover dropped webhooks.
    """
    valid_ids = []
    for oid in payload.order_ids:
        try:
            valid_ids.append(ObjectId(oid))
        except Exception:
            pass

    if not valid_ids:
        return {"statuses": {}}

    cursor = DELIVERY_COLL.find(
        {"_id": {"$in": valid_ids}},
        {"status": 1, "carrier_status": 1, "courier_info": 1, "updated_at": 1}
    )

    results = {}
    for doc in cursor:
        results[str(doc["_id"])] = {
            "status": doc.get("status", "pending"),
            "carrier_status": doc.get("carrier_status", ""),
            "courier_info": doc.get("courier_info"),
            "updated_at": doc.get("updated_at").isoformat() if isinstance(doc.get("updated_at"), datetime) else str(doc.get("updated_at")),
        }

    return {"statuses": results}

@router.get("/delivery/orders", summary="Listar pedidos para gestor de sucursal")
async def get_delivery_orders(
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    provider: Optional[str] = None,
    carrier: Optional[str] = None,
    dispatch_status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(verify_session)
):
    """
    Retorna la lista de pedidos con filtros opcionales.
    Level 3-5: ve todos los locales, puede filtrar con location_id.
    Level 6: ve solo sus sucursales asignadas (access_locals pattern).

    dispatch_status filter:
      - 'failed': dispatch_failed=True
      - 'rejected': carrier_rejected=True
      - 'recovery': needs_recovery=True
      - 'accepted': carrier_accepted=True
    """
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    allowed_slugs = allowed_local_filter(perms)

    query = {}

    # Permission-based location restriction
    if allowed_slugs is not None:
        if not allowed_slugs:
            return {"success": True, "orders": [], "total": 0}
        query["location_slug"] = {"$in": list(allowed_slugs)}

    # Explicit location filter (validate against permissions)
    if location_id:
        validate_include_local_or_403(perms, [location_id])
        query["location_slug"] = location_id

    if status:
        query["status"] = status
    if provider:
        query["provider_slug"] = provider
    if carrier:
        query["carrier_slug"] = carrier

    # Dispatch status filter
    if dispatch_status == "failed":
        query["dispatch_failed"] = True
    elif dispatch_status == "rejected":
        query["carrier_rejected"] = True
    elif dispatch_status == "recovery":
        query["needs_recovery"] = True
    elif dispatch_status == "accepted":
        query["carrier_accepted"] = True

    if date_from:
        try:
            query.setdefault("created_at", {})["$gte"] = datetime.fromisoformat(date_from)
        except ValueError:
            pass
    if date_to:
        try:
            query.setdefault("created_at", {})["$lte"] = datetime.fromisoformat(date_to)
        except ValueError:
            pass

    cursor = DELIVERY_COLL.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = [_serialize_order(doc) for doc in cursor]
    total = DELIVERY_COLL.count_documents(query)

    return {
        "success": True,
        "orders": orders,
        "total": total,
    }


@router.get("/delivery/orders/stats", summary="Estadísticas de pedidos")
async def get_delivery_stats(
    location_id: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    """
    Returns order counts by status, by provider, and daily totals for the current period.
    Filtered by user permissions (access_locals pattern).
    """
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    allowed_slugs = allowed_local_filter(perms)

    base_query = {}
    if allowed_slugs is not None:
        if not allowed_slugs:
            return {"success": True, "stats": {"by_status": {}, "by_provider": [], "today": 0, "week": 0, "month": 0, "today_revenue": 0, "active": 0}}
        base_query["location_slug"] = {"$in": list(allowed_slugs)}

    if location_id:
        validate_include_local_or_403(perms, [location_id])
        base_query["location_slug"] = location_id

    now = get_chile_time()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    # Counts by status
    pipeline_status = [
        {"$match": base_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = {r["_id"]: r["count"] for r in DELIVERY_COLL.aggregate(pipeline_status)}

    # Counts by provider
    pipeline_provider = [
        {"$match": base_query},
        {"$group": {"_id": "$provider_slug", "count": {"$sum": 1}, "revenue": {"$sum": "$total_amount"}}},
    ]
    provider_stats = [
        {"provider": r["_id"], "count": r["count"], "revenue": r["revenue"]}
        for r in DELIVERY_COLL.aggregate(pipeline_provider)
    ]

    # Period counts
    today_count = DELIVERY_COLL.count_documents({**base_query, "created_at": {"$gte": today_start}})
    week_count = DELIVERY_COLL.count_documents({**base_query, "created_at": {"$gte": week_start}})
    month_count = DELIVERY_COLL.count_documents({**base_query, "created_at": {"$gte": month_start}})

    # Today's revenue
    pipeline_revenue = [
        {"$match": {**base_query, "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]
    today_revenue_result = list(DELIVERY_COLL.aggregate(pipeline_revenue))
    today_revenue = today_revenue_result[0]["total"] if today_revenue_result else 0

    # Active orders (not delivered/cancelled)
    active_count = DELIVERY_COLL.count_documents({
        **base_query,
        "status": {"$nin": ["delivered", "cancelled"]},
    })

    return {
        "success": True,
        "stats": {
            "by_status": status_counts,
            "by_provider": provider_stats,
            "today": today_count,
            "week": week_count,
            "month": month_count,
            "today_revenue": today_revenue,
            "active": active_count,
        },
    }



@router.get("/delivery/orders/analytics/advanced", summary="Analíticas avanzadas de delivery: Heatmap y Ventas por hora/producto")
async def get_advanced_analytics(
    location_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    """
    Returns advanced metrics:
    1. Heatmap points (lat, lng, weight) for delivered orders.
    2. Sales by Hour & Product (combines $hour and item grouping).
    Filtered by user permissions (access_locals pattern).
    """
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    allowed_slugs = allowed_local_filter(perms)

    base_query = {}
    if allowed_slugs is not None:
        if not allowed_slugs:
            return {"success": True, "heatmap": [], "sales_by_hour": []}
        base_query["location_slug"] = {"$in": list(allowed_slugs)}

    if location_id:
        validate_include_local_or_403(perms, [location_id])
        base_query["location_slug"] = location_id

    # Date range
    now = get_chile_time()
    # Default to last 30 days if no date provided
    if not date_from:
        date_from_dt = now - timedelta(days=30)
    else:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
        except ValueError:
            date_from_dt = now - timedelta(days=30)

    if date_to:
        try:
            date_to_dt = datetime.fromisoformat(date_to)
        except ValueError:
            date_to_dt = now
    else:
        date_to_dt = now

    base_query["created_at"] = {"$gte": date_from_dt, "$lte": date_to_dt}
    base_query["status"] = {"$ne": "cancelled"}  # don't count cancelled orders

    # ── Pipeline 1: Heatmap ──
    # Extract dropoff coordinates
    pipeline_heatmap = [
        {"$match": base_query},
        {"$match": {"delivery_info.lat": {"$exists": True, "$ne": None}, "delivery_info.lng": {"$exists": True, "$ne": None}}},
        {"$project": {
            "_id": 0,
            "lat": "$delivery_info.lat",
            "lng": "$delivery_info.lng",
            "total_amount": 1
        }}
    ]
    heatmap_res = list(DELIVERY_COLL.aggregate(pipeline_heatmap))
    
    # Format for leaflet-heat: [lat, lng, intensity]
    # Let's map intensity based on total amount or just 1. We'll use 1 for standard heat.
    heatmap_points = [[r["lat"], r["lng"], 1.0] for r in heatmap_res]

    # ── Pipeline 2: Sales by Hour and Product ──
    # Unwind items, group by hour and item code
    pipeline_sales = [
        {"$match": base_query},
        {"$match": {"items": {"$type": "array", "$not": {"$size": 0}}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {
                "hour": {"$hour": {"date": "$created_at", "timezone": "America/Santiago"}},
                "codigo": "$items.codigo",
            },
            "quantity": {"$sum": "$items.quantity"},
            "revenue": {"$sum": {"$multiply": ["$items.quantity", {"$ifNull": ["$items.unit_price", "$items.precio", 0]}]}}
        }},
        {"$sort": {"_id.hour": 1, "revenue": -1}}
    ]
    
    sales_res = list(DELIVERY_COLL.aggregate(pipeline_sales))

    # Enrich with product names and images from MENUS_COLL
    codigos = set(r["_id"]["codigo"] for r in sales_res if r["_id"].get("codigo"))
    items_map = {}
    if codigos:
        db_items = list(MENUS_COLL.find(
            {"codigo": {"$in": list(codigos)}},
            {"codigo": 1, "nombre": 1, "media_r2": 1, "media_url": 1}
        ))
        items_map = {i["codigo"]: i for i in db_items}

    # Format Sales by Hour
    sales_by_hour = []
    for r in sales_res:
        codigo = r["_id"].get("codigo")
        hour = r["_id"].get("hour")
        if codigo is None or hour is None: continue
        
        db_item = items_map.get(codigo, {})
        sales_by_hour.append({
            "hour": hour,
            "codigo": codigo,
            "nombre": db_item.get("nombre", codigo),
            "image_url": db_item.get("media_r2") or db_item.get("media_url"),
            "quantity": r.get("quantity", 0),
            "revenue": r.get("revenue", 0)
        })

    return {
        "success": True,
        "heatmap": heatmap_points,
        "sales_by_hour": sales_by_hour
    }


# =====================================================================
# KDS (Kitchen Display System)
# =====================================================================

@router.get("/delivery/orders/kds", summary="Pedidos activos para pantalla de cocina")
async def get_kds_orders(user: dict = Depends(verify_session)):
    """
    Returns active orders (pending/accepted/preparing/ready) with items
    filtered by the user's role/section. Level 7 kitchen workers only see
    items matching their centro de costo (same as recetas).
    """
    from config.roles.access import get_effective_role_level_from_user
    from utils.bot.common.filters import (
        is_worker_in_sales_kpis,
        apply_access_filters_for_product_like_intent,
    )
    from zoneinfo import ZoneInfo

    rl = require_admin_level(user, "kds")
    perms = (user or {}).get("permissions") or {}

    from apis.delivery.config import DEFAULT_STATUSES, DEFAULT_PICKUP_STATUSES

    # Active statuses for KDS — driven from MongoDB config (kds_controllable field)
    config_doc = CONFIG_COLL.find_one({"_id": "delivery_config"}, {"internal_statuses": 1, "pickup_statuses": 1})
    active_keys = set()
    
    int_statuses = config_doc.get("internal_statuses") if config_doc else None
    if not int_statuses: int_statuses = DEFAULT_STATUSES
    
    pick_statuses = config_doc.get("pickup_statuses") if config_doc else None
    if not pick_statuses: pick_statuses = DEFAULT_PICKUP_STATUSES

    for s in int_statuses:
        if s.get("kds_controllable", True):
            active_keys.add(s["key"])
            
    for s in pick_statuses:
        if s.get("kds_controllable", True):
            active_keys.add(s["key"])
            
    if not active_keys:
        active_keys = {"pending", "confirmed", "preparing", "ready"}
    query = {"status": {"$in": list(active_keys)}}

    # Level 6: filter by sucursal
    if rl == 6:
        allowed_sucs = perms.get("sucursal_ids", [])
        if allowed_sucs:
            query["location_id"] = {"$in": [str(s) for s in allowed_sucs]}

    # Fetch active orders
    cursor = DELIVERY_COLL.find(query).sort("created_at", 1)  # oldest first for KDS
    orders = list(cursor)

    # Determine item filtering for level 7
    allowed_codes = None  # None = show all
    role_level_int = get_effective_role_level_from_user(user or {})

    if role_level_int and int(role_level_int) >= 7:
        tz = ZoneInfo("America/Santiago")
        now = datetime.now(tz)
        period_ym = now.strftime("%Y%m")

        is_lvl7 = role_level_int == 7
        try:
            is_lvl7_garzon = bool(is_worker_in_sales_kpis(period_ym, perms)) if is_lvl7 else False
        except Exception:
            is_lvl7_garzon = False

        base_spec = {"key": "menus", "filters": {}}
        scoped = apply_access_filters_for_product_like_intent(
            "menus", base_spec, perms or {},
            role_level_int,
            None if is_lvl7_garzon else period_ym,
        )
        filters_after = (scoped or {}).get("filters") or {}
        codes = filters_after.get("include_codigos") or []
        if codes:
            allowed_codes = {str(x).upper() for x in codes}

    # Enrich all item codigos from all orders
    all_codigos = set()
    for doc in orders:
        for item in doc.get("items", []):
            c = item.get("codigo")
            if c:
                all_codigos.add(c)

    # Bulk lookup product names + images
    items_map = {}
    if all_codigos:
        db_items = list(MENUS_COLL.find(
            {"codigo": {"$in": list(all_codigos)}},
            {"codigo": 1, "nombre": 1, "media_r2": 1, "media_url": 1, "images": 1}
        ))
        items_map = {i["codigo"]: i for i in db_items}

    # Build result, filtering items by allowed_codes if applicable
    result = []
    for doc in orders:
        enriched_items = []
        for item in doc.get("items", []):
            codigo = item.get("codigo", "")
            # Filter by allowed codes (level 7 cocina)
            if allowed_codes is not None:
                if codigo.upper() not in allowed_codes:
                    continue

            db_item = items_map.get(codigo, {})
            enriched_items.append({
                "codigo": codigo,
                "nombre": db_item.get("nombre", codigo),
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("unit_price", 0),
                "modifiers": item.get("modifiers", []),
                "image_url": db_item.get("media_r2") or db_item.get("media_url") or (db_item.get("images") or [None])[0],
                "done": item.get("done", False),
            })

        # Only include orders that have visible items for this user
        if not enriched_items:
            continue

        result.append({
            "_id": str(doc["_id"]),
            "status": doc.get("status"),
            "provider_slug": doc.get("provider_slug"),
            "customer_name": (doc.get("customer") or {}).get("name", ""),
            "notes": doc.get("notes"),
            "items": enriched_items,
            "total_amount": doc.get("total_amount"),
            "created_at": _serialize_dt(doc.get("created_at")),
            "order_type": doc.get("order_type", "delivery"),
            "all_items_done": all(i.get("done", False) for i in doc.get("items", [])),
        })

    return {"success": True, "orders": result, "total": len(result)}


@router.get("/delivery/orders/{order_id}", summary="Detalle completo de un pedido")
async def get_delivery_order_detail(
    order_id: str,
    user: dict = Depends(verify_session)
):
    """Returns full order detail including carrier/courier info if dispatched."""
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")

    doc = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Enrich with product names from DB
    codigos = [item.get("codigo") for item in doc.get("items", [])]
    if codigos:
        db_items = list(MENUS_COLL.find({"codigo": {"$in": codigos}}, {"codigo": 1, "nombre": 1, "media_r2": 1, "media_url": 1}))
        items_map = {i["codigo"]: i for i in db_items}
        for item in doc.get("items", []):
            db_item = items_map.get(item.get("codigo"), {})
            item["nombre"] = db_item.get("nombre", item.get("codigo"))
            item["image_url"] = db_item.get("media_r2") or db_item.get("media_url")

    return {
        "success": True,
        "order": _serialize_order(doc),
    }


@router.patch("/delivery/orders/{order_id}/status", summary="Avanzar estado del pedido")
async def update_delivery_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    user: dict = Depends(verify_session)
):
    """
    Actualiza el estado de un pedido e.g. a 'preparing', 'ready', 'dispatched'.
    """
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")

    # Read valid statuses from MongoDB — both delivery + pickup pipelines
    config_doc = CONFIG_COLL.find_one({"_id": "delivery_config"}, {"internal_statuses": 1, "pickup_statuses": 1})
    valid_statuses = set()
    if config_doc:
        for s in (config_doc.get("internal_statuses") or []):
            valid_statuses.add(s["key"])
        for s in (config_doc.get("pickup_statuses") or []):
            valid_statuses.add(s["key"])
    if not valid_statuses:
        valid_statuses = {"pending", "confirmed", "preparing", "ready", "dispatched", "delivered", "cancelled"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Permitidos: {sorted(valid_statuses)}")

    order = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    now = datetime.now(timezone.utc)
    update_fields = {
        "status": payload.status,
        "updated_at": now,
        "updated_by": user.get("wallet") or user.get("id"),
    }

    # Track key timestamps
    if payload.status == "dispatched" and not order.get("dispatched_at"):
        update_fields["dispatched_at"] = now
    elif payload.status == "delivered" and not order.get("delivered_at"):
        update_fields["delivered_at"] = now

    DELIVERY_COLL.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_fields}
    )

    # Push status to delivery app (fire-and-forget)
    order["dispatched_at"] = update_fields.get("dispatched_at", order.get("dispatched_at"))
    order["delivered_at"] = update_fields.get("delivered_at", order.get("delivered_at"))
    asyncio.create_task(_notify_delivery_provider(
        order, payload.status,
        carrier_status=order.get("carrier_status"),
        courier_info=order.get("courier_info"),
    ))

    # Broadcast status change to KDS WebSocket clients
    asyncio.create_task(kds_manager.broadcast(
        {"type": "status_change", "order_id": order_id, "status": payload.status,
         "location_id": order.get("location_id")},
        location_id=order.get("location_id"),
    ))

    # Fire outgoing webhooks for status change (fire-and-forget)
    try:
        from apis.delivery.webhooks import fire_webhooks
        webhook_event = "order.status_changed"
        if payload.status == "delivered":
            webhook_event = "order.delivered"
        elif payload.status == "cancelled":
            webhook_event = "order.cancelled"
        order["status"] = payload.status  # reflect new status
        asyncio.create_task(fire_webhooks(webhook_event, order))
    except Exception as e:
        logger.warning(f"[delivery/orders] Webhook fire failed (non-fatal): {e}")

    # Trigger email automations for this status change
    try:
        from apis.mailing.automations import check_automations
        check_automations(order, payload.status)
    except Exception as e:
        logger.warning(f"[delivery/orders] Automation check failed (non-fatal): {e}")

    logger.info(f"[delivery/orders] Order {order_id} status → {payload.status} by {user.get('wallet')}")

    return {
        "success": True,
        "message": f"Pedido actualizado a: {payload.status}",
    }



class ItemDonePayload(BaseModel):
    done: bool = True

@router.patch("/delivery/orders/{order_id}/items/{codigo}/done", summary="Marcar ítem como listo/pendiente")
async def toggle_item_done(
    order_id: str,
    codigo: str,
    payload: ItemDonePayload,
    user: dict = Depends(verify_session)
):
    """Toggle an individual item's done status within an order."""
    require_admin_level(user, "kds")

    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")

    doc = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Find and update the item
    items = doc.get("items", [])
    found = False
    for item in items:
        if item.get("codigo") == codigo:
            item["done"] = payload.done
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail=f"Ítem {codigo} no encontrado en el pedido")

    DELIVERY_COLL.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"items": items, "updated_at": datetime.now(timezone.utc)}}
    )

    # Broadcast item done to KDS WebSocket clients
    asyncio.create_task(kds_manager.broadcast(
        {"type": "item_done", "order_id": order_id, "codigo": codigo, "done": payload.done,
         "location_id": doc.get("location_id")},
        location_id=doc.get("location_id"),
    ))

    logger.info(f"[KDS] Item {codigo} in order {order_id} → done={payload.done}")
    return {"success": True, "codigo": codigo, "done": payload.done}


# =====================================================================
# KDS WebSocket Endpoint
# =====================================================================

@router.websocket("/ws/kds/{location_id}")
async def ws_kds(websocket: WebSocket, location_id: str = "all"):
    """
    WebSocket endpoint for KDS clients.
    Clients connect with a location_id to receive order events for that location.
    Use 'all' to receive events for all locations (admin mode).
    """
    await kds_manager.connect(websocket, location_id)
    try:
        while True:
            # Keep connection alive — clients can send pings
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await kds_manager.disconnect(websocket, location_id)
    except Exception as e:
        logger.warning(f"[KDS-WS] Connection error: {e}")
        await kds_manager.disconnect(websocket, location_id)


# =====================================================================
# Review Push (from Delivery Backend)
# =====================================================================

class ReviewPush(BaseModel):
    admin_order_id: str
    review: dict

@router.post("/delivery/orders/review-push", summary="Recibir review desde delivery")
async def receive_review_push(
    request: Request,
    key_doc: dict = Depends(verify_external_api_key),
):
    """
    Receives a customer review forwarded from the delivery backend.
    Stores it in the order document and broadcasts to KDS.
    """
    # Verify Dilithium signature
    from utils.vanellix_crypto import verify_dilithium_request
    await verify_dilithium_request(request, key_doc, context="delivery/review-push")

    body = await request.body()
    payload = ReviewPush(**json.loads(body))

    if not ObjectId.is_valid(payload.admin_order_id):
        raise HTTPException(status_code=400, detail="admin_order_id inválido")

    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.admin_order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if order.get("review"):
        return {"success": True, "message": "Review ya existente — ignorada"}

    now = datetime.now(timezone.utc)
    review_doc = payload.review
    review_doc["received_at"] = now

    DELIVERY_COLL.update_one(
        {"_id": ObjectId(payload.admin_order_id)},
        {"$set": {"review": review_doc, "updated_at": now}}
    )

    # Broadcast review to KDS
    asyncio.create_task(kds_manager.broadcast(
        {"type": "order_review", "order_id": payload.admin_order_id,
         "stars": review_doc.get("overall_stars", 0),
         "location_id": order.get("location_id")},
        location_id=order.get("location_id"),
    ))

    logger.info(f"[review-push] ⭐ {review_doc.get('overall_stars', '?')}/5 for order {payload.admin_order_id}")

    return {"success": True, "message": "Review guardada"}


@router.get("/delivery/reviews/stats", summary="Estadísticas avanzadas de reviews")
async def review_stats(user: dict = Depends(verify_session)):
    """Aggregate review stats including top items, top customers, and tag cloud."""
    require_admin_level(user, "delivery")

    # Pipeline 1: Basic Stats & Distribution
    pipeline_basic = [
        {"$match": {"review": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "avg_stars": {"$avg": "$review.overall_stars"},
            "stars_1": {"$sum": {"$cond": [{"$eq": ["$review.overall_stars", 1]}, 1, 0]}},
            "stars_2": {"$sum": {"$cond": [{"$eq": ["$review.overall_stars", 2]}, 1, 0]}},
            "stars_3": {"$sum": {"$cond": [{"$eq": ["$review.overall_stars", 3]}, 1, 0]}},
            "stars_4": {"$sum": {"$cond": [{"$eq": ["$review.overall_stars", 4]}, 1, 0]}},
            "stars_5": {"$sum": {"$cond": [{"$eq": ["$review.overall_stars", 5]}, 1, 0]}},
        }},
    ]

    # Pipeline 2: Top Items (based on individual item reviews)
    pipeline_items = [
        {"$match": {"review": {"$exists": True, "$ne": None}, "review.items": {"$type": "array"}}},
        {"$unwind": "$review.items"},
        {"$group": {
            "_id": "$review.items.item_id",
            "avg_stars": {"$avg": "$review.items.stars"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"avg_stars": -1, "count": -1}},
        {"$limit": 10}
    ]

    # Pipeline 3: Loyal Customers (most reviews)
    pipeline_customers = [
        {"$match": {"review": {"$exists": True, "$ne": None}, "customer.phone": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$customer.phone",
            "name": {"$first": "$customer.name"},
            "count": {"$sum": 1},
            "avg_stars": {"$avg": "$review.overall_stars"},
            "last_review": {"$max": "$review.received_at"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]

    # Pipeline 4: Tag Cloud (most common tags)
    pipeline_tags = [
        {"$match": {"review": {"$exists": True, "$ne": None}, "review.overall_tags": {"$type": "array"}}},
        {"$unwind": "$review.overall_tags"},
        {"$group": {
            "_id": "$review.overall_tags",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]

    # Ejecutar aggregations (MongoDB maneja esto muy rápido)
    basic_res = list(DELIVERY_COLL.aggregate(pipeline_basic))
    items_res = list(DELIVERY_COLL.aggregate(pipeline_items))
    customers_res = list(DELIVERY_COLL.aggregate(pipeline_customers))
    tags_res = list(DELIVERY_COLL.aggregate(pipeline_tags))

    stats = {
        "count": 0, "avg_stars": 0, 
        "distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
        "top_items": [],
        "top_customers": [],
        "tags": []
    }

    if basic_res:
        r = basic_res[0]
        stats["count"] = r.get("count", 0)
        stats["avg_stars"] = round(r.get("avg_stars", 0), 1)
        stats["distribution"] = {
            "1": r.get("stars_1", 0),
            "2": r.get("stars_2", 0),
            "3": r.get("stars_3", 0),
            "4": r.get("stars_4", 0),
            "5": r.get("stars_5", 0),
        }

    # Cruzar códigos de ítems con colección MENUS_COLL
    if items_res:
        item_ids = [str(i["_id"]) for i in items_res if i["_id"]]
        db_items = list(MENUS_COLL.find(
            {"codigo": {"$in": item_ids}},
            {"codigo": 1, "nombre": 1, "media_r2": 1, "media_url": 1}
        ))
        item_map = {i["codigo"]: i for i in db_items}

        for item in items_res:
            codigo = str(item["_id"])
            if not codigo or codigo == "None":
                continue
            db_item = item_map.get(codigo, {})
            stats["top_items"].append({
                "item_id": codigo,
                "name": db_item.get("nombre", f"Item #{codigo}"),
                "image_url": db_item.get("media_r2") or db_item.get("media_url"),
                "avg_stars": round(item["avg_stars"], 1),
                "count": item["count"]
            })

    top_phones = [c["_id"] for c in customers_res if c["_id"]]
    total_order_counts = {}
    if top_phones:
        for r in DELIVERY_COLL.aggregate([
            {"$match": {"customer.phone": {"$in": top_phones}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$customer.phone", "count": {"$sum": 1}}}
        ]):
            total_order_counts[r["_id"]] = r["count"]

    for c in customers_res:
        if not c["_id"]:
            continue
        stats["top_customers"].append({
            "phone": c["_id"],
            "name": c["name"] or "Cliente",
            "count": total_order_counts.get(c["_id"], c["count"]),
            "avg_stars": round(c["avg_stars"], 1),
            "last_review": c["last_review"].isoformat() if isinstance(c["last_review"], datetime) else c["last_review"]
        })

    for t in tags_res:
        if not t["_id"]:
            continue
        stats["tags"].append({
            "tag": t["_id"],
            "count": t["count"]
        })

    return {"success": True, "stats": stats}


@router.get("/delivery/reviews", summary="Listar reviews individuales")
async def list_reviews(
    stars: Optional[int] = None,
    location_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    user: dict = Depends(verify_session),
):
    """List individual order reviews with pagination and filters."""
    require_admin_level(user, "delivery")

    query = {"review": {"$exists": True, "$ne": None}}
    if stars and 1 <= stars <= 5:
        query["review.overall_stars"] = stars
    if location_id:
        query["location_slug"] = location_id

    cursor = DELIVERY_COLL.find(
        query,
        {
            "_id": 1, "order_number": 1, "customer": 1, "review": 1,
            "items": 1, "total_amount": 1, "location_name": 1,
            "location_slug": 1, "created_at": 1, "delivered_at": 1,
            "status": 1, "order_type": 1,
        },
    ).sort("review.received_at", -1).skip(skip).limit(limit)

    reviews = []
    
    # ── Enrich items with images and get customer order counts ──
    all_codigos = set()
    customer_phones = set()
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        for dt in ("created_at", "delivered_at"):
            if isinstance(doc.get(dt), datetime):
                doc[dt] = doc[dt].isoformat()
        rev = doc.get("review", {})
        if isinstance(rev.get("received_at"), datetime):
            rev["received_at"] = rev["received_at"].isoformat()
            
        for item in doc.get("items", []):
            if item.get("codigo"):
                all_codigos.add(item["codigo"])
                
        cust = doc.get("customer", {})
        if cust.get("phone"):
            customer_phones.add(cust["phone"])
            
        reviews.append(doc)

    items_map = {}
    if all_codigos:
        db_items = list(MENUS_COLL.find(
            {"codigo": {"$in": list(all_codigos)}},
            {"codigo": 1, "nombre": 1, "media_r2": 1, "media_url": 1}
        ))
        items_map = {i["codigo"]: i for i in db_items}
        
    customer_counts = {}
    if customer_phones:
        pipeline = [
            {"$match": {"customer.phone": {"$in": list(customer_phones)}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$customer.phone", "count": {"$sum": 1}}}
        ]
        for r in DELIVERY_COLL.aggregate(pipeline):
            if r["_id"]:
                customer_counts[r["_id"]] = r["count"]

    for doc in reviews:
        # Inject order count
        phone = doc.get("customer", {}).get("phone")
        doc["customer_order_count"] = customer_counts.get(phone, 1) if phone else 1
        
        # Inject item images
        for item in doc.get("items", []):
            db_item = items_map.get(item.get("codigo"), {})
            item["image_url"] = db_item.get("media_r2") or db_item.get("media_url")

    total = DELIVERY_COLL.count_documents(query)

    return {"success": True, "reviews": reviews, "total": total}

