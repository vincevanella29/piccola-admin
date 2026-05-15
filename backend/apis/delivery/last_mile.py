"""
delivery/last_mile.py
=====================
Last-mile dispatch engine — requests pickups from external carriers
(Uber Direct, PedidosYa, GetJusto) and receives their webhook callbacks.

Flow:
1. Admin: POST /last-mile/quote → get price estimate from carrier
2. Admin: POST /last-mile/dispatch → create delivery request with carrier
3. Carrier assigns courier → webhook callback → update order
4. Courier picks up → webhook → update order
5. Courier delivers → webhook → order marked "delivered"
"""

import logging
import hashlib
import hmac
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

DELIVERY_COLL = db.delivery_orders
CARRIERS_COLL = db.delivery_carriers
LOCATIONS_COLL = db.locations

# =====================================================================
# Carrier HTTP client helpers
# =====================================================================

async def _get_carrier_token(carrier: dict) -> str:
    """Get a valid access token for OAuth2 carriers, refreshing if expired."""
    auth = carrier.get("auth", {})
    if auth.get("type") == "api_key":
        return auth.get("api_key", "")

    # OAuth2 flow
    token = carrier.get("access_token")
    expires_at = carrier.get("token_expires_at")

    if token and expires_at and isinstance(expires_at, datetime):
        # Ensure timezone-aware comparison
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > datetime.now(timezone.utc):
            return token

    # Refresh token
    token_url = auth.get("token_url")
    client_id = auth.get("client_id")
    client_secret = auth.get("client_secret")
    scope = auth.get("scope", "")
    grant_type = auth.get("grant_type", "client_credentials")

    if not all([token_url, client_id, client_secret]):
        raise HTTPException(status_code=500, detail=f"Carrier '{carrier['slug']}' missing OAuth2 credentials")

    token_data = {
        "grant_type": grant_type,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    if scope:
        token_data["scope"] = scope

    # Password grant (PedidosYa) — requires username + password
    if grant_type == "password":
        username = auth.get("username", "")
        password = auth.get("password", "")
        if not username or not password:
            raise HTTPException(status_code=500, detail=f"Carrier '{carrier['slug']}' missing username/password for password grant")
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
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error(f"[last_mile] OAuth2 token refresh failed for {carrier['slug']}: {e}")
        raise HTTPException(status_code=502, detail=f"Error obteniendo token de {carrier['name']}")

    # PedidosYa returns "access_token" or just "token"
    new_token = data.get("access_token") or data.get("token") or data.get("access")
    expires_in = data.get("expires_in", 2700)  # PedidosYa: 45min default
    new_expires = datetime.now(timezone.utc).replace(microsecond=0)
    from datetime import timedelta
    new_expires += timedelta(seconds=int(expires_in) - 60)  # 60s buffer

    # Cache token in DB
    CARRIERS_COLL.update_one(
        {"_id": carrier["_id"]},
        {"$set": {"access_token": new_token, "token_expires_at": new_expires}}
    )

    return new_token


async def _carrier_request(carrier: dict, method: str, path: str, json_data: dict = None) -> dict:
    """Make an authenticated HTTP request to a carrier API."""
    token = await _get_carrier_token(carrier)
    base_url = carrier.get("endpoints", {}).get("base_url", "")

    # Resolve {customer_id} in path (required for Uber Direct)
    customer_id = carrier.get("auth", {}).get("customer_id", "")
    if "{customer_id}" in path and customer_id:
        path = path.replace("{customer_id}", customer_id)

    url = f"{base_url}{path}"

    auth_config = carrier.get("auth", {})
    use_bearer = auth_config.get("bearer_prefix", True)

    if auth_config.get("type") == "api_key":
        header_name = auth_config.get("header_name", "Authorization")
        headers = {header_name: f"Bearer {token}" if use_bearer else token}
    else:
        headers = {"Authorization": f"Bearer {token}" if use_bearer else token}

    headers["Content-Type"] = "application/json"

    # Log mode warning for non-test dispatches
    mode = carrier.get("mode", "test")
    if mode == "test":
        logger.info(f"[last_mile] 🧪 {method} {url} (TEST MODE)")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, json=json_data)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"[last_mile] Carrier API error: {e.response.status_code} {e.response.text[:500]}")
        raise HTTPException(
            status_code=502,
            detail=f"Error del carrier {carrier['name']}: {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"[last_mile] Carrier request failed: {e}")
        raise HTTPException(status_code=502, detail=f"Error conectando con {carrier['name']}")


# =====================================================================
# Unified Dispatch — SINGLE PATH for all carrier deliveries
# Called by: _auto_dispatch, dispatch_worker, admin dispatch_to_carrier
# Zero fallbacks. Fail fast.
# =====================================================================

def _normalize_phone(phone: str) -> str:
    """Normalize phone to E.164 format (+XXXXXXXXXXX). Fail fast if empty."""
    if not phone:
        return ""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        # Chilean numbers: 56XXXXXXXXX → +56XXXXXXXXX
        if phone.startswith("56") and len(phone) >= 10:
            phone = f"+{phone}"
        elif len(phone) == 9:
            phone = f"+56{phone}"
        else:
            phone = f"+{phone}"
    return phone

def _build_uber_body(order: dict, loc: dict) -> dict:
    """Build Uber Direct /v1/customers/{id}/deliveries body from order + location."""
    if not loc:
        loc = {}
    pickup_address = loc.get("direccion") or loc.get("address", "")
    pickup_city = loc.get("city", "Santiago")
    pickup_lat = loc.get("lat", 0)
    pickup_lng = loc.get("lng", 0)
    pickup_name = loc.get("nombre", "La Piccola Italia")
    pickup_phone = _normalize_phone(loc.get("telefono", "")) or "+56900000000"

    customer = order.get("customer") or {}
    delivery_info = order.get("delivery_info", {})
    dropoff_address = delivery_info.get("address", "")
    dropoff_lat = delivery_info.get("lat", 0)
    dropoff_lng = delivery_info.get("lng", 0)
    dropoff_name = customer.get("name", "Cliente")
    dropoff_phone = _normalize_phone(customer.get("phone", "")) or "+56900000001"

    # Build manifest_items from order items (REQUIRED by Uber)
    items = order.get("items", [])
    manifest_items = [
        {
            "name": it.get("nombre") or it.get("name") or "Item",
            "quantity": it.get("quantity", 1),
        }
        for it in items
    ]
    if not manifest_items:
        manifest_items = [{"name": "Pedido delivery", "quantity": 1}]

    total_amount = order.get("total_amount", 0)

    body = {
        "pickup_address": json.dumps({
            "street_address": [pickup_address],
            "city": pickup_city, "state": "RM",
            "zip_code": "0000", "country": "CL",
        }),
        "pickup_latitude": pickup_lat,
        "pickup_longitude": pickup_lng,
        "pickup_name": pickup_name,
        "pickup_phone_number": pickup_phone,
        "dropoff_address": json.dumps({
            "street_address": [dropoff_address],
            "city": pickup_city, "state": "RM",
            "zip_code": "0000", "country": "CL",
        }),
        "dropoff_latitude": dropoff_lat,
        "dropoff_longitude": dropoff_lng,
        "dropoff_name": dropoff_name,
        "dropoff_phone_number": dropoff_phone,
        "dropoff_notes": delivery_info.get("instructions", "") or order.get("notes", ""),
        "manifest_items": manifest_items,
        "manifest_total_value": int(total_amount * 100) if total_amount else 0,
        "external_id": str(order.get("_id", "")),
    }

    scheduled = order.get("scheduled_for")
    if scheduled:
        body["pickup_ready_dt"] = scheduled

    return body


def _build_pedidosya_body(order: dict, loc: dict, is_test: bool = False) -> dict:
    """Build PedidosYa /v2/shippings body from order + location."""
    if not loc:
        loc = {}
    pickup_address = loc.get("direccion") or loc.get("address", "")
    pickup_city = loc.get("city", "Santiago")
    pickup_lat = loc.get("lat", 0)
    pickup_lng = loc.get("lng", 0)
    pickup_name = loc.get("nombre", "La Piccola Italia")
    pickup_phone = _normalize_phone(loc.get("telefono", "")) or "+56900000000"

    customer = order.get("customer") or {}
    delivery_info = order.get("delivery_info", {})
    dropoff_address = delivery_info.get("address", "")
    dropoff_lat = delivery_info.get("lat", 0)
    dropoff_lng = delivery_info.get("lng", 0)
    dropoff_name = customer.get("name", "Cliente")
    dropoff_phone = _normalize_phone(customer.get("phone", "")) or "+56900000001"

    items = order.get("items", [])
    
    # Calculate real total to check against PedidosYa's 100k insurance limit
    raw_total = sum(int(it.get("unit_price", 0)) * int(it.get("quantity", 1)) for it in items)
    cap_values = raw_total >= 95000
    
    pya_items = [
        {
            "description": it.get("nombre") or it.get("name") or "Item",
            "quantity": int(it.get("quantity", 1)),
            "value": 1000 if cap_values else (int(it.get("unit_price", 0)) or 1000),
        }
        for it in items
    ]
    if not pya_items:
        pya_items = [{"description": "Pedido delivery", "quantity": 1, "value": 1000}]

    body = {
        "referenceId": str(order.get("_id", "")),
        "isTest": is_test,
        "items": pya_items,
        "waypoints": [
            {
                "type": "PICK_UP",
                "addressStreet": pickup_address,
                "city": pickup_city,
                "latitude": pickup_lat,
                "longitude": pickup_lng,
                "name": pickup_name,
                "phone": pickup_phone,
            },
            {
                "type": "DROP_OFF",
                "addressStreet": dropoff_address,
                "city": pickup_city,
                "latitude": dropoff_lat,
                "longitude": dropoff_lng,
                "name": dropoff_name,
                "phone": dropoff_phone,
                "instructions": delivery_info.get("instructions", ""),
            },
        ],
    }

    scheduled = order.get("scheduled_for")
    if scheduled:
        body["scheduledDate"] = scheduled

    return body


async def create_carrier_delivery(carrier: dict, order: dict, loc: dict) -> str:
    """
    SINGLE PATH to create a delivery with any carrier.

    Args:
        carrier: Full carrier doc from DB (with auth, endpoints, slug, mode)
        order:   Full order doc from DB (with items, customer, addresses)
        loc:     Full location doc from DB (pickup point)

    Returns:
        carrier_delivery_id (str)

    Raises:
        HTTPException on any failure. No fallbacks.
    """
    if not isinstance(loc, dict):
        logger.error(f"[create_carrier_delivery] Missing or invalid location for order {order.get('_id')}")
        raise HTTPException(status_code=400, detail="Error de despacho: Sucursal origen no válida o no encontrada.")

    slug = carrier["slug"]
    auth = carrier.get("auth", {})
    base_url = carrier.get("endpoints", {}).get("base_url", "")

    if not base_url:
        raise HTTPException(status_code=500, detail=f"Carrier '{slug}' has no base_url configured")

    # Get auth token
    token = await _get_carrier_token(carrier)
    use_bearer = auth.get("bearer_prefix", True)
    headers = {
        "Authorization": f"Bearer {token}" if use_bearer else token,
        "Content-Type": "application/json",
    }

    order_id = str(order.get("_id", ""))

    # Build carrier-specific body
    if slug == "uber_direct":
        body = _build_uber_body(order, loc)
        customer_id = auth.get("customer_id", "")
        if not customer_id:
            raise HTTPException(status_code=500, detail="Uber Direct: missing customer_id in carrier auth config")
        url = f"{base_url}/v1/customers/{customer_id}/deliveries"

        # In test mode, enable robo-courier so Uber sandbox progresses through statuses
        if carrier.get("mode") == "test":
            body["test_specifications"] = {"robo_courier_specification": {"mode": "auto"}}

    elif slug == "pedidosya":
        is_test = carrier.get("mode") == "test"
        body = _build_pedidosya_body(order, loc, is_test=is_test)
        url = f"{base_url}/v2/shippings"

    else:
        # Generic carrier — use configured endpoint
        create_endpoint = carrier.get("endpoints", {}).get("create_delivery", "")
        if not create_endpoint:
            raise HTTPException(status_code=500, detail=f"Carrier '{slug}' has no create_delivery endpoint configured")
        url = f"{base_url}{create_endpoint}"
        body = {
            "external_id": order_id,
            "pickup_address": loc.get("direccion", ""),
            "dropoff_address": order.get("dropoff_address", ""),
        }

    # Fire request
    logger.info(f"[last_mile] 📦 Dispatching order {order_id} to {slug} ({carrier.get('mode', 'test')})")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=body)
    except UnicodeEncodeError:
        raise HTTPException(
            status_code=400,
            detail=f"El API Key o Token de {carrier.get('name', slug)} tiene caracteres inválidos (acentos, saltos de línea, etc). Por favor revisa la configuración."
        )
        error_text = resp.text[:500]
        logger.error(f"[last_mile] ❌ {slug} rejected order {order_id}: {resp.status_code} {error_text}")
        raise HTTPException(
            status_code=502,
            detail=f"{slug} rejected: {resp.status_code} — {error_text}",
        )

    data = resp.json()

    # Extract delivery ID (carrier-specific field names)
    carrier_delivery_id = (
        data.get("id") or
        data.get("delivery_id") or
        data.get("shipping_id") or
        ""
    )

    if not carrier_delivery_id:
        logger.error(f"[last_mile] ❌ {slug} returned 200 but no delivery ID: {data}")
        raise HTTPException(status_code=502, detail=f"{slug} returned no delivery ID")

    # PedidosYa requires a 2nd step to confirm the shipping
    if slug == "pedidosya":
        confirm_url = f"{base_url}/v2/shippings/{carrier_delivery_id}/confirm"
        logger.info(f"[last_mile] 🔍 PedidosYa Confirming... URL={confirm_url}, Headers={headers}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                c_resp = await client.post(confirm_url, headers=headers, json={})
        except UnicodeEncodeError:
            raise HTTPException(
                status_code=400,
                detail="El API Key de PedidosYa tiene caracteres inválidos (acentos, ñ, etc)."
            )
        
        logger.info(f"[last_mile] 🔍 PedidosYa Confirm Response {c_resp.status_code}: {c_resp.text}")
        
        if c_resp.status_code not in (200, 201):
            logger.error(f"[last_mile] ❌ PedidosYa confirm failed for {carrier_delivery_id}: {c_resp.status_code} {c_resp.text[:500]}")
            raise HTTPException(
                status_code=502,
                detail=f"PedidosYa confirm failed: {c_resp.status_code}",
            )
        logger.info(f"[last_mile] ✅ PedidosYa shipping {carrier_delivery_id} CONFIRMED")

    logger.info(f"[last_mile] ✅ Order {order_id} dispatched to {slug} → {carrier_delivery_id}")
    return carrier_delivery_id


# =====================================================================
# Pydantic Models
# =====================================================================

class QuoteRequest(BaseModel):
    order_id: str = Field(..., description="ID del pedido a cotizar")
    carrier_slug: str = Field(..., description="Slug del carrier (uber_direct, pedidosya, getjusto)")

class DispatchRequest(BaseModel):
    order_id: str = Field(..., description="ID del pedido a despachar")
    carrier_slug: str = Field(..., description="Slug del carrier")
    quote_id: Optional[str] = Field(None, description="ID del quote (si aplica)")

class CancelRequest(BaseModel):
    order_id: str = Field(..., description="ID del pedido a cancelar dispatch")

# =====================================================================
# Admin Endpoints (authenticated)
# =====================================================================


class CoverageTestRequest(BaseModel):
    location_id: str = Field(..., description="ID de la sucursal (pickup)")
    dropoff_lat: float = Field(..., description="Latitud destino")
    dropoff_lng: float = Field(..., description="Longitud destino")
    dropoff_address: str = Field("", description="Dirección destino (opcional, para display)")
    carrier_slugs: Optional[list] = Field(None, description="Slugs a probar (None = todos activos)")


@router.post("/delivery/last-mile/coverage-test", summary="Testear cobertura de carriers para un local")
async def test_carrier_coverage(
    payload: CoverageTestRequest,
    user: dict = Depends(verify_session)
):
    """
    Test if carriers can deliver from a location to a destination address.
    Does NOT create any orders — only requests quotes/estimates.
    
    For each carrier, calls their estimate API and returns:
    - available: bool
    - fee: delivery cost
    - eta_min: estimated time in minutes
    - error: if not available, why
    """
    from math import radians, sin, cos, sqrt, atan2

    require_admin_level(user, "delivery")

    # Resolve location
    loc = None
    if ObjectId.is_valid(payload.location_id):
        loc = LOCATIONS_COLL.find_one({"_id": ObjectId(payload.location_id)})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"_id": payload.location_id})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"permalink_slug": payload.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    pickup_lat = loc.get("lat", 0)
    pickup_lng = loc.get("lng", 0)
    pickup_address = loc.get("direccion", "")
    pickup_name = loc.get("nombre", "La Piccola Italia")
    pickup_city = loc.get("city", "Santiago")

    # Haversine distance
    def haversine_km(lat1, lng1, lat2, lng2):
        R = 6371
        dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))

    distance_km = round(haversine_km(pickup_lat, pickup_lng, payload.delivery_info.get("lat", 0), payload.delivery_info.get("lng", 0)), 2)

    # Get carriers to test
    carrier_filter = {"status": "active"}
    if payload.carrier_slugs:
        carrier_filter["slug"] = {"$in": payload.carrier_slugs}
    carriers = list(CARRIERS_COLL.find(carrier_filter))

    if not carriers:
        raise HTTPException(status_code=404, detail="No hay carriers activos")

    results = []
    now = datetime.now(timezone.utc)

    print(f"[coverage-test] Testing {len(carriers)} carriers: {[c['slug'] for c in carriers]}")

    for carrier in carriers:
        slug = carrier["slug"]
        carrier_result = {
            "carrier_slug": slug,
            "carrier_name": carrier["name"],
            "mode": carrier.get("mode", "test"),
            "available": False,
            "fee": None,
            "eta_min": None,
            "error": None,
            "raw": None,
        }

        try:
            auth = carrier.get("auth", {})
            api_key = auth.get("api_key", "")

            if auth.get("type") == "api_key" and api_key:
                token = api_key
            else:
                token = await _get_carrier_token(carrier)

            base_url = carrier.get("endpoints", {}).get("base_url", "")
            use_bearer = auth.get("bearer_prefix", True)
            auth_value = f"Bearer {token}" if use_bearer else token
            headers = {"Authorization": auth_value, "Content-Type": "application/json"}

            if slug == "pedidosya":
                # PedidosYa: POST /v2/shippings with estimate only (don't confirm)
                shipping_body = {
                    "referenceId": f"coverage-test-{now.strftime('%Y%m%d%H%M%S')}",
                    "isTest": True,
                    "items": [{"description": "Coverage test", "quantity": 1, "value": 10000}],
                    "waypoints": [
                        {
                            "type": "PICK_UP",
                            "addressStreet": pickup_address,
                            "city": pickup_city,
                            "latitude": pickup_lat,
                            "longitude": pickup_lng,
                            "name": pickup_name,
                            "phone": "+56900000000",
                        },
                        {
                            "type": "DROP_OFF",
                            "addressStreet": payload.delivery_info.get("address", "") or f"{payload.delivery_info.get('lat', 0)},{payload.delivery_info.get('lng', 0)}",
                            "city": pickup_city,
                            "latitude": payload.delivery_info.get("lat", 0),
                            "longitude": payload.delivery_info.get("lng", 0),
                            "name": "Coverage Test",
                            "phone": "+56900000001",
                        },
                    ],
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(f"{base_url}/v2/shippings", headers=headers, json=shipping_body)

                if resp.status_code in (200, 201):
                    data = resp.json()
                    quotes = data.get("quotes", [])
                    carrier_result["available"] = True
                    carrier_result["raw"] = data
                    if quotes:
                        best = quotes[0]
                        carrier_result["fee"] = best.get("deliveryCost") or best.get("total")
                        carrier_result["eta_min"] = best.get("estimatedDeliveryTime")

                    # Cancel the preorder so it doesn't persist
                    shipping_id = data.get("id")
                    if shipping_id:
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as client2:
                                await client2.post(f"{base_url}/v2/shippings/{shipping_id}/cancel", headers=headers)
                        except Exception:
                            pass  # Non-critical
                else:
                    error_data = resp.json() if resp.text else {}
                    carrier_result["error"] = error_data.get("message") or error_data.get("error") or f"HTTP {resp.status_code}"
                    carrier_result["raw"] = error_data

            elif slug == "uber_direct":
                # Uber Direct: POST /v1/customers/{customer_id}/delivery_quotes
                customer_id = auth.get("customer_id", "")
                quote_body = {
                    "pickup_address": json.dumps({
                        "street_address": [pickup_address],
                        "city": pickup_city,
                        "state": "RM",
                        "zip_code": "0000",
                        "country": "CL",
                    }),
                    "pickup_latitude": pickup_lat,
                    "pickup_longitude": pickup_lng,
                    "dropoff_address": json.dumps({
                        "street_address": [payload.delivery_info.get("address", "") or "Test"],
                        "city": pickup_city,
                        "state": "RM",
                        "zip_code": "0000",
                        "country": "CL",
                    }),
                    "dropoff_latitude": payload.delivery_info.get("lat", 0),
                    "dropoff_longitude": payload.delivery_info.get("lng", 0),
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    path = f"/v1/customers/{customer_id}/delivery_quotes" if customer_id else "/v1/delivery_quotes"
                    resp = await client.post(f"{base_url}{path}", headers=headers, json=quote_body)

                if resp.status_code in (200, 201):
                    data = resp.json()
                    raw_fee = data.get("fee")
                    
                    logger.info(f"[coverage-test] UBER DIRECT RAW DATA: fee={raw_fee}, currency={data.get('currency_type')}, raw_response={json.dumps(data)}")
                    
                    carrier_result["available"] = True
                    carrier_result["fee"] = raw_fee
                    carrier_result["eta_min"] = data.get("duration")
                    carrier_result["raw"] = data
                else:
                    error_data = resp.json() if resp.text else {}
                    carrier_result["error"] = error_data.get("message") or f"HTTP {resp.status_code}"
                    carrier_result["raw"] = error_data
                    logger.warning(f"[coverage-test] 🚗 uber_direct HTTP {resp.status_code}: {error_data}")

            else:
                carrier_result["error"] = f"Coverage test not implemented for {slug}"

        except Exception as e:
            carrier_result["error"] = str(e)
            logger.warning(f"[coverage-test] {slug} failed: {e}")

        results.append(carrier_result)

    any_available = any(r["available"] for r in results)

    return {
        "success": True,
        "location": {
            "id": str(loc.get("_id")),
            "name": pickup_name,
            "address": pickup_address,
            "lat": pickup_lat,
            "lng": pickup_lng,
        },
        "destination": {
            "lat": payload.delivery_info.get("lat", 0),
            "lng": payload.delivery_info.get("lng", 0),
            "address": payload.delivery_info.get("address", ""),
        },
        "distance_km": distance_km,
        "can_deliver": any_available,
        "carriers": results,
    }


# =====================================================================
# Quote for Delivery App — called by delivery frontend via proxy
# Authenticated via API key (not session), applies platform fee markup
# =====================================================================

class QuoteDeliveryRequest(BaseModel):
    location_id: str = Field(..., description="Sucursal ID (pickup)")
    delivery_info: dict = Field(..., description="Info de delivery con lat, lng y address")
    order_total: float = Field(0, description="Total del pedido para calcular delivery gratis")


def _apply_platform_fee(carrier_fee: float, fee_config: dict, order_total: float = 0) -> dict:
    """Apply platform markup on top of carrier fee."""
    fee_type = fee_config.get("type", "none")
    value = fee_config.get("value", 0)

    # Check free delivery threshold
    free_above = fee_config.get("free_above", 0)
    if free_above and order_total >= free_above:
        return {"carrier_fee": carrier_fee, "platform_fee": 0, "total_fee": 0}

    if fee_type == "percentage":
        platform_fee = round(carrier_fee * value / 100)
    elif fee_type == "fixed":
        platform_fee = round(value)
    else:
        platform_fee = 0

    total = carrier_fee + platform_fee

    # Apply min/max caps
    min_fee = fee_config.get("min_fee", 0)
    max_fee = fee_config.get("max_fee", 0)
    if min_fee and total < min_fee:
        total = min_fee
        platform_fee = total - carrier_fee
    if max_fee and total > max_fee:
        total = max_fee
        platform_fee = total - carrier_fee

    return {
        "carrier_fee": round(carrier_fee),
        "platform_fee": round(max(0, platform_fee)),
        "total_fee": round(max(0, total)),
    }


@router.post("/delivery/last-mile/quote-delivery", summary="Quote delivery for delivery app")
async def quote_for_delivery(request: Request, payload: QuoteDeliveryRequest):
    """
    Called by the delivery app to get real-time carrier quotes.
    Auth: X-Api-Key header (same as config sync).

    1. Verifies API key
    2. Resolves location
    3. Quotes all active carriers (same logic as coverage-test)
    4. Applies platform fee markup
    5. Returns best (cheapest) option + all quotes
    """
    from math import radians, sin, cos, sqrt, atan2

    # ── Auth: verify API key ──
    api_key = request.headers.get("X-Api-Key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="X-Api-Key required")

    key_id = api_key.split(".")[0] if "." in api_key else api_key
    key_doc = db.api_keys.find_one({"_id": key_id, "active": True})
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")

    print(f"[quote-delivery] Received quote request for location {payload.location_id} with order_total=${payload.order_total}", flush=True)

    # ── Resolve location ──
    loc = None
    if ObjectId.is_valid(payload.location_id):
        loc = LOCATIONS_COLL.find_one({"_id": ObjectId(payload.location_id)})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"_id": payload.location_id})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"permalink_slug": payload.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    pickup_lat = loc.get("lat", 0)
    pickup_lng = loc.get("lng", 0)
    pickup_address = loc.get("direccion", "")
    pickup_name = loc.get("nombre", "La Piccola Italia")
    pickup_city = loc.get("city", "Santiago")

    # Haversine
    def haversine_km(lat1, lng1, lat2, lng2):
        R = 6371
        dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))

    distance_km = round(haversine_km(pickup_lat, pickup_lng, payload.delivery_info.get("lat", 0), payload.delivery_info.get("lng", 0)), 2)

    # ── Get fee config ──
    from apis.delivery.config import _get_config, DEFAULT_FEE_CONFIG
    config = _get_config()
    fee_config = config.get("delivery_fee_config", DEFAULT_FEE_CONFIG)

    # ── Apply location overrides ──
    loc_id_str = str(loc.get("_id", ""))
    loc_slug = loc.get("permalink_slug", "")
    overrides = fee_config.get("location_overrides", {})
    
    print(f"[quote-delivery] Checking overrides for loc_id={loc_id_str}, loc_slug={loc_slug}", flush=True)
    print(f"[quote-delivery] Available overrides: {list(overrides.keys())}", flush=True)
    
    if loc_slug and loc_slug in overrides:
        fee_config = overrides[loc_slug]
        print(f"[quote-delivery] Applied override by loc_slug: {fee_config}", flush=True)
    elif loc_id_str and loc_id_str in overrides:
        fee_config = overrides[loc_id_str]
        print(f"[quote-delivery] Applied override by loc_id_str: {fee_config}", flush=True)

    # ── Quote all active carriers ──
    carriers = list(CARRIERS_COLL.find({"status": "active"}))
    if not carriers:
        return {
            "success": True, "available": False,
            "error": "No hay carriers activos",
            "location": {"name": pickup_name, "address": pickup_address},
            "distance_km": distance_km,
        }

    now = datetime.now(timezone.utc)
    quotes = []

    for carrier in carriers:
        slug = carrier["slug"]
        quote = {
            "carrier_slug": slug,
            "carrier_name": carrier["name"],
            "available": False,
            "carrier_fee": None,
            "platform_fee": None,
            "total_fee": None,
            "eta_min": None,
            "error": None,
        }

        try:
            auth = carrier.get("auth", {})
            api_key_val = auth.get("api_key", "")
            if auth.get("type") == "api_key" and api_key_val:
                token = api_key_val
            else:
                token = await _get_carrier_token(carrier)

            base_url = carrier.get("endpoints", {}).get("base_url", "")
            use_bearer = auth.get("bearer_prefix", True)
            auth_value = f"Bearer {token}" if use_bearer else token
            headers = {"Authorization": auth_value, "Content-Type": "application/json"}

            if slug == "pedidosya":
                shipping_body = {
                    "referenceId": f"quote-{now.strftime('%Y%m%d%H%M%S')}",
                    "isTest": carrier.get("mode") == "test",
                    "items": [{"description": "Delivery quote", "quantity": 1, "value": 10000}],
                    "waypoints": [
                        {
                            "type": "PICK_UP",
                            "addressStreet": pickup_address,
                            "city": pickup_city,
                            "latitude": pickup_lat,
                            "longitude": pickup_lng,
                            "name": pickup_name,
                            "phone": "+56900000000",
                        },
                        {
                            "type": "DROP_OFF",
                            "addressStreet": payload.delivery_info.get("address", "") or f"{payload.delivery_info.get('lat', 0)},{payload.delivery_info.get('lng', 0)}",
                            "city": pickup_city,
                            "latitude": payload.delivery_info.get("lat", 0),
                            "longitude": payload.delivery_info.get("lng", 0),
                            "name": "Cliente",
                            "phone": "+56900000001",
                        },
                    ],
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    logger.info(f"[quote-delivery-debug] URL: {base_url}/v2/shippings")
                    logger.info(f"[quote-delivery-debug] Headers: {headers}")
                    logger.info(f"[quote-delivery-debug] Body: {json.dumps(shipping_body)}")
                    resp = await client.post(f"{base_url}/v2/shippings", headers=headers, json=shipping_body)
                    logger.info(f"[quote-delivery-debug] Response {resp.status_code}: {resp.text}")

                if resp.status_code in (200, 201):
                    data = resp.json()
                    raw_quotes = data.get("quotes", [])
                    if raw_quotes:
                        best = raw_quotes[0]
                        raw_fee = best.get("deliveryCost") or best.get("total") or 0
                        print(f"[quote-delivery] PedidosYa raw_fee={raw_fee}, order_total={payload.order_total}, fee_config={fee_config}", flush=True)
                        fees = _apply_platform_fee(raw_fee, fee_config, payload.order_total)
                        print(f"[quote-delivery] PedidosYa calculated fees={fees}", flush=True)
                        quote.update({"available": True, "eta_min": best.get("estimatedDeliveryTime"), **fees})

                    # Cancel preorder
                    shipping_id = data.get("id")
                    if shipping_id:
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as c2:
                                await c2.post(f"{base_url}/v2/shippings/{shipping_id}/cancel", headers=headers)
                        except Exception:
                            pass
                else:
                    error_data = resp.json() if resp.text else {}
                    quote["error"] = error_data.get("message") or f"HTTP {resp.status_code}"

            elif slug == "uber_direct":
                customer_id = auth.get("customer_id", "")
                quote_body = {
                    "pickup_address": json.dumps({
                        "street_address": [pickup_address],
                        "city": pickup_city, "state": "RM",
                        "zip_code": "0000", "country": "CL",
                    }),
                    "pickup_latitude": pickup_lat,
                    "pickup_longitude": pickup_lng,
                    "dropoff_address": json.dumps({
                        "street_address": [payload.delivery_info.get("address", "") or ""],
                        "city": pickup_city, "state": "RM",
                        "zip_code": "0000", "country": "CL",
                    }),
                    "dropoff_latitude": payload.delivery_info.get("lat", 0),
                    "dropoff_longitude": payload.delivery_info.get("lng", 0),
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    path = f"/v1/customers/{customer_id}/delivery_quotes" if customer_id else "/v1/delivery_quotes"
                    resp = await client.post(f"{base_url}{path}", headers=headers, json=quote_body)

                if resp.status_code in (200, 201):
                    data = resp.json()
                    raw_fee = data.get("fee", 0)
                    
                    # LOGGING FOR DEBUGGING:
                    logger.info(f"[quote-delivery] UBER DIRECT RAW DATA: fee={raw_fee}, currency={data.get('currency_type')}, raw_response={json.dumps(data)}")
                    
                    # CLP is zero-decimal — fee is already in CLP
                    fees = _apply_platform_fee(raw_fee, fee_config, payload.order_total)
                    quote.update({"available": True, "eta_min": data.get("duration"), **fees})
                else:
                    error_data = resp.json() if resp.text else {}
                    quote["error"] = error_data.get("message") or f"HTTP {resp.status_code}"
            else:
                quote["error"] = f"Carrier {slug} not supported for quotes"

        except Exception as e:
            quote["error"] = str(e)
            logger.warning(f"[quote-delivery] {slug} failed: {e}")

        quotes.append(quote)

    # Find best (cheapest available)
    available_quotes = [q for q in quotes if q["available"] and q["total_fee"] is not None]
    available_quotes.sort(key=lambda q: q["total_fee"])

    best = available_quotes[0] if available_quotes else None

    return {
        "success": True,
        "available": best is not None,
        "best_quote": best,
        "all_quotes": quotes,
        "location": {
            "id": str(loc.get("_id")),
            "name": pickup_name,
            "address": pickup_address,
            "lat": pickup_lat,
            "lng": pickup_lng,
        },
        "destination": {
            "lat": payload.delivery_info.get("lat", 0),
            "lng": payload.delivery_info.get("lng", 0),
            "address": payload.delivery_info.get("address", ""),
        },
        "distance_km": distance_km,
        "fee_config": {
            "type": fee_config.get("type"),
            "value": fee_config.get("value"),
        },
    }


@router.post("/delivery/last-mile/quote", summary="Cotizar delivery con un carrier")
async def request_quote(
    payload: QuoteRequest,
    user: dict = Depends(verify_session)
):
    """Request a delivery quote from a carrier. Returns estimated price and ETA."""
    require_admin_level(user, "member")  # Only level 3-5 can request quotes

    # Get order
    if not ObjectId.is_valid(payload.order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Pickup orders don't use carriers
    if order.get("order_type") == "pickup":
        raise HTTPException(status_code=400, detail="Los pedidos pickup no requieren carrier")

    # Get carrier
    carrier = CARRIERS_COLL.find_one({"slug": payload.carrier_slug, "status": "active"})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{payload.carrier_slug}' no encontrado o inactivo")

    # Get location for pickup address
    loc = None
    if order.get("location_id"):
        if ObjectId.is_valid(order["location_id"]):
            loc = LOCATIONS_COLL.find_one({"_id": ObjectId(order["location_id"])})
        if not loc:
            loc = LOCATIONS_COLL.find_one({"slug": order.get("location_slug")})

    pickup_address = loc.get("direccion", "") if loc else ""
    delivery_info = order.get("delivery_info", {})
    dropoff_address = delivery_info.get("address", "")

    # Build quote request body (generic — each carrier may need adaptation)
    quote_body = {
        "pickup": {
            "address": pickup_address,
            "name": loc.get("nombre", "La Piccola Italia") if loc else "La Piccola Italia",
            "phone": loc.get("telefono", "") if loc else "",
        },
        "dropoff": {
            "address": dropoff_address,
            "name": order.get("customer", {}).get("name", ""),
            "phone": order.get("customer", {}).get("phone", ""),
        },
    }

    quote_endpoint = carrier.get("endpoints", {}).get("create_quote")
    if not quote_endpoint:
        return {
            "success": True,
            "quote": {
                "carrier": payload.carrier_slug,
                "estimated": True,
                "message": "Este carrier no soporta cotización previa. Dispatch directamente.",
            }
        }

    result = await _carrier_request(carrier, "POST", quote_endpoint, quote_body)

    return {
        "success": True,
        "quote": {
            "carrier": payload.carrier_slug,
            "carrier_name": carrier["name"],
            "raw": result,
        },
    }


@router.post("/delivery/last-mile/dispatch", summary="Solicitar pickup a un carrier")
async def dispatch_to_carrier(
    payload: DispatchRequest,
    user: dict = Depends(verify_session)
):
    """Create a delivery request with the carrier. This triggers courier assignment."""
    require_admin_level(user, "member")  # Only level 3-5 can dispatch

    # Get order
    if not ObjectId.is_valid(payload.order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Pickup orders don't use carriers
    if order.get("order_type") == "pickup":
        raise HTTPException(status_code=400, detail="Los pedidos pickup no requieren carrier")

    if order.get("carrier_delivery_id"):
        raise HTTPException(status_code=409, detail="Este pedido ya fue despachado a un carrier")

    # Get carrier
    carrier = CARRIERS_COLL.find_one({"slug": payload.carrier_slug, "status": "active"})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{payload.carrier_slug}' no encontrado o inactivo")

    # Get location (Robust resolution)
    loc = None
    location_id = order.get("location_id")
    if location_id:
        if ObjectId.is_valid(location_id):
            loc = LOCATIONS_COLL.find_one({"_id": ObjectId(location_id)})
        
        if not loc:
            # Try by slug if ID resolution failed or if ID was actually a slug
            loc = LOCATIONS_COLL.find_one({"permalink_slug": order.get("location_slug") or location_id})

    if not loc:
        logger.error(f"[dispatch_to_carrier] Order {payload.order_id} has no valid location (location_id={location_id})")
        raise HTTPException(
            status_code=400, 
            detail="No se encontró la sucursal origen para este pedido. Verifique que el local exista y esté activo."
        )

    try:
        carrier_delivery_id = await create_carrier_delivery(carrier, order, loc)
    except Exception as e:
        logger.error(f"[dispatch_to_carrier] Error dispatching to {payload.carrier_slug}: {e}")
        raise

    now = datetime.now(timezone.utc)

    # Update order with carrier info
    DELIVERY_COLL.update_one(
        {"_id": ObjectId(payload.order_id)},
        {"$set": {
            "status": "dispatched",
            "carrier_slug": payload.carrier_slug,
            "carrier_delivery_id": carrier_delivery_id,
            "carrier_quote_id": payload.quote_id,
            "carrier_status": "pending",
            "dispatched_at": now,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }, "$inc": {
            "dispatch_count": 1
        }}
    )

    logger.info(f"[last_mile] Dispatched order {payload.order_id} to {payload.carrier_slug} → delivery_id={carrier_delivery_id}")

    return {
        "success": True,
        "message": f"Pedido enviado a {carrier['name']}",
        "carrier_delivery_id": carrier_delivery_id,
    }


@router.post("/delivery/last-mile/cancel", summary="Cancelar dispatch con carrier")
async def cancel_dispatch(
    payload: CancelRequest,
    user: dict = Depends(verify_session)
):
    """Cancel an active delivery with the carrier."""
    require_admin_level(user, "member")  # Only level 3-5 can cancel dispatches

    if not ObjectId.is_valid(payload.order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if not order.get("carrier_delivery_id"):
        raise HTTPException(status_code=400, detail="Este pedido no tiene un dispatch activo")

    carrier = CARRIERS_COLL.find_one({"slug": order["carrier_slug"], "status": "active"})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")

    cancel_endpoint = carrier.get("endpoints", {}).get("cancel_delivery")
    if cancel_endpoint:
        cancel_path = cancel_endpoint.replace("{id}", order["carrier_delivery_id"])
        try:
            await _carrier_request(carrier, "POST", cancel_path)
        except Exception as e:
            logger.warning(f"[last_mile] Cancel request to carrier failed: {e}")

    now = datetime.now(timezone.utc)
    DELIVERY_COLL.update_one(
        {"_id": ObjectId(payload.order_id)},
        {"$set": {
            "status": "ready",  # Back to ready so admin can re-dispatch
            "carrier_slug": None,
            "carrier_delivery_id": None,
            "carrier_quote_id": None,
            "carrier_status": None,
            "courier_info": None,
            "dispatched_at": None,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[last_mile] Cancelled dispatch for order {payload.order_id}")

    return {"success": True, "message": "Dispatch cancelado. Pedido vuelve a estado 'ready'."}


@router.get("/delivery/last-mile/status/{order_id}", summary="Status del dispatch activo")
async def get_dispatch_status(
    order_id: str,
    user: dict = Depends(verify_session)
):
    """Get the current carrier/courier status for a dispatched order."""
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    return {
        "success": True,
        "dispatch": {
            "carrier_slug": order.get("carrier_slug"),
            "carrier_delivery_id": order.get("carrier_delivery_id"),
            "carrier_status": order.get("carrier_status"),
            "courier_info": order.get("courier_info"),
            "dispatched_at": order["dispatched_at"].isoformat() if order.get("dispatched_at") else None,
        },
    }


# =====================================================================
# Webhook Registration — register our callback URL with carriers
# =====================================================================

class RegisterWebhookRequest(BaseModel):
    carrier_slug: str = Field(..., description="Slug del carrier (pedidosya, uber_direct, etc.)")


@router.post("/delivery/last-mile/register-webhook", summary="Registrar webhook URL con el carrier")
async def register_carrier_webhook(
    payload: RegisterWebhookRequest,
    user: dict = Depends(verify_session)
):
    """
    Register our webhook callback URL with the carrier's API.
    
    For PedidosYa: PUT /webhooks-configuration
    For Uber Direct: Configured via Uber Developer Dashboard (manual)
    """
    import os

    require_admin_level(user, "delivery")
    slug = payload.carrier_slug

    carrier = CARRIERS_COLL.find_one({"slug": slug})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{slug}' no encontrado")

    # Build our public webhook URL
    admin_public_url = os.getenv("ADMIN_PUBLIC_URL", f"http://localhost:{os.getenv('PORT', '8081')}/api")
    webhook_url = f"{admin_public_url}/delivery/webhook/{slug}"

    now = datetime.now(timezone.utc)

    if slug == "pedidosya":
        # PedidosYa: PUT /webhooks-configuration on their Courier API
        token = await _get_carrier_token(carrier)
        base_url = carrier.get("endpoints", {}).get("base_url", "https://courier-api.pedidosya.com")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # First check current config
                check_resp = await client.get(
                    f"{base_url}/v2/webhooks-configuration",
                    headers={"Authorization": f"Bearer {token}"}
                )
                current_config = check_resp.json() if check_resp.status_code == 200 else {}

                # Register/update our callback URL
                resp = await client.put(
                    f"{base_url}/v2/webhooks-configuration",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"callback_url": webhook_url}
                )

            if resp.status_code in (200, 201, 204):
                # Save webhook registration in carrier doc
                CARRIERS_COLL.update_one(
                    {"_id": carrier["_id"]},
                    {"$set": {
                        "webhook.callback_url": webhook_url,
                        "webhook.registered_at": now,
                        "webhook.status": "active",
                        "webhook.previous_config": current_config,
                    }}
                )
                logger.info(f"[webhook-register] ✅ PedidosYa webhook registered: {webhook_url}")
                return {
                    "success": True,
                    "message": f"Webhook registrado con PedidosYa",
                    "callback_url": webhook_url,
                    "carrier_response": resp.json() if resp.text else {},
                }
            else:
                error_text = resp.text[:500]
                logger.error(f"[webhook-register] ❌ PedidosYa rejected: {resp.status_code} {error_text}")
                raise HTTPException(
                    status_code=502,
                    detail=f"PedidosYa rechazó la configuración: {resp.status_code} — {error_text}"
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[webhook-register] ❌ PedidosYa error: {e}")
            raise HTTPException(status_code=502, detail=f"Error conectando con PedidosYa: {e}")

    elif slug == "uber_direct":
        # Uber Direct: webhooks configured via Developer Dashboard, not API
        CARRIERS_COLL.update_one(
            {"_id": carrier["_id"]},
            {"$set": {
                "webhook.callback_url": webhook_url,
                "webhook.registered_at": now,
                "webhook.status": "manual",
            }}
        )
        return {
            "success": True,
            "message": f"Para Uber Direct, registra esta URL manualmente en el Uber Developer Dashboard",
            "callback_url": webhook_url,
            "manual": True,
        }

    else:
        # Generic: just save the URL for reference
        CARRIERS_COLL.update_one(
            {"_id": carrier["_id"]},
            {"$set": {
                "webhook.callback_url": webhook_url,
                "webhook.registered_at": now,
                "webhook.status": "pending",
            }}
        )
        return {
            "success": True,
            "message": f"URL de webhook guardada. Configúrala manualmente en el panel del carrier.",
            "callback_url": webhook_url,
        }


@router.get("/delivery/last-mile/webhook-status/{carrier_slug}", summary="Estado del webhook registrado")
async def get_webhook_status(
    carrier_slug: str,
    user: dict = Depends(verify_session)
):
    """Check if webhook is registered with the carrier."""
    require_admin_level(user, "delivery")

    carrier = CARRIERS_COLL.find_one({"slug": carrier_slug})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{carrier_slug}' no encontrado")

    webhook = carrier.get("webhook", {})
    return {
        "success": True,
        "slug": carrier_slug,
        "callback_url": webhook.get("callback_url"),
        "status": webhook.get("status", "not_registered"),
        "registered_at": webhook.get("registered_at").isoformat() if webhook.get("registered_at") else None,
        "secret": "configured" if webhook.get("secret") else "not_configured",
    }


@router.delete("/delivery/last-mile/webhook/{carrier_slug}", summary="Desactivar webhook y volver a polling")
async def disable_carrier_webhook(
    carrier_slug: str,
    user: dict = Depends(verify_session)
):
    """Disable webhook for a carrier — falls back to polling mode."""
    require_admin_level(user, "delivery")

    carrier = CARRIERS_COLL.find_one({"slug": carrier_slug})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{carrier_slug}' no encontrado")

    CARRIERS_COLL.update_one(
        {"_id": carrier["_id"]},
        {"$set": {
            "webhook.status": "disabled",
            "webhook.disabled_at": datetime.now(timezone.utc),
            "webhook.disabled_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[webhook] Disabled webhook for {carrier_slug} — falling back to polling")

    return {
        "success": True,
        "message": f"Webhook desactivado para {carrier.get('name', carrier_slug)}. Se usará polling cada 30s.",
    }


# =====================================================================
# Webhook Endpoint (PUBLIC — validated by HMAC signature)
# =====================================================================

@router.post("/delivery/webhook/{carrier_slug}", summary="Recibir webhook de carrier")
async def receive_carrier_webhook(
    carrier_slug: str,
    request: Request
):
    """
    Public endpoint that receives status webhooks from carriers.
    Validated via HMAC signature in header.
    """
    carrier = CARRIERS_COLL.find_one({"slug": carrier_slug})
    if not carrier:
        logger.warning(f"[webhook] Unknown carrier slug: {carrier_slug}")
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Read raw body for HMAC verification
    body = await request.body()

    # Verify HMAC signature
    webhook_config = carrier.get("webhook", {})
    secret = webhook_config.get("secret", "")
    sig_header = webhook_config.get("signature_header", "")

    if secret and sig_header:
        received_sig = request.headers.get(sig_header, "")
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(received_sig, expected_sig):
            logger.warning(f"[webhook] HMAC verification failed for {carrier_slug}")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    import json
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"[webhook] Received from {carrier_slug}: {json.dumps(payload)[:500]}")

    # Extract delivery ID and status from webhook payload
    # Each carrier has different field names — try common patterns
    carrier_delivery_id = (
        payload.get("delivery_id") or
        payload.get("id") or
        payload.get("shipping_id") or
        payload.get("data", {}).get("id") or
        payload.get("data", {}).get("delivery_id")
    )

    carrier_status_raw = (
        payload.get("status") or
        payload.get("event_type") or
        payload.get("data", {}).get("status") or
        payload.get("kind")
    )

    if not carrier_delivery_id:
        logger.warning(f"[webhook] Could not extract delivery_id from payload")
        return {"success": True, "message": "Received but no delivery_id found"}

    # Find order by carrier_delivery_id
    order = DELIVERY_COLL.find_one({"carrier_delivery_id": carrier_delivery_id})
    if not order:
        logger.warning(f"[webhook] No order found for carrier_delivery_id={carrier_delivery_id}")
        return {"success": True, "message": "No matching order found"}

    # Detect carrier rejection/cancellation
    carrier_terminal = {"cancelled", "canceled", "rejected", "returned", "failed"}
    is_rejection = carrier_status_raw and carrier_status_raw.lower() in carrier_terminal

    internal = order.get("status", "")
    if is_rejection and internal not in {"delivered", "cancelled"}:
        DELIVERY_COLL.update_one(
            {"_id": order["_id"]},
            {"$set": {
                "carrier_rejected": True,
                "carrier_rejection_reason": carrier_status_raw,
                "carrier_delivery_id": "",
                "carrier_status": "",
                "needs_recovery": True,
                "dispatch_failed": False,
                "dispatch_retries": 0,
                "updated_at": datetime.now(timezone.utc),
            }}
        )
        logger.warning(f"[webhook] ⚠️ Carrier rejected order {order['_id']} ({carrier_status_raw}) — marked for recovery")
        
        # Broadcast to KDS to clear assignment in frontend
        try:
            from utils.kds_ws import kds_manager
            import asyncio
            asyncio.create_task(kds_manager.broadcast(
                {"type": "status_change", "order_id": str(order["_id"]), "status": internal,
                 "carrier_status": "", "location_id": order.get("location_id")},
                location_id=order.get("location_id"),
            ))
        except Exception:
            pass
            
        return {"success": True, "message": "Carrier rejected order — entered recovery"}

    # Map carrier status → our internal status using carrier's status_mapping
    status_mapping = carrier.get("status_mapping", {})
    internal_status = status_mapping.get(carrier_status_raw)

    now = datetime.now(timezone.utc)
    update_fields = {
        "carrier_status": carrier_status_raw,
        "updated_at": now,
    }

    if internal_status:
        update_fields["status"] = internal_status
        if internal_status == "delivered":
            update_fields["delivered_at"] = now

    # Extract courier info if available
    courier = payload.get("courier") or payload.get("data", {}).get("courier")
    if courier:
        update_fields["courier_info"] = {
            "name": courier.get("name") or courier.get("first_name", ""),
            "phone": courier.get("phone") or courier.get("phone_number", ""),
            "vehicle": courier.get("vehicle", {}).get("type", "") if isinstance(courier.get("vehicle"), dict) else courier.get("vehicle_type", ""),
            "photo_url": courier.get("img_href") or courier.get("photo_url", ""),
            "location": courier.get("location"),
        }

    DELIVERY_COLL.update_one(
        {"_id": order["_id"]},
        {"$set": update_fields}
    )

    logger.info(f"[webhook] Updated order {order['_id']} → carrier_status={carrier_status_raw}, internal={internal_status}")

    # Push status update to the delivery app (fire-and-forget)
    if internal_status:
        import asyncio
        from apis.delivery.orders import _notify_delivery_provider
        order_updated = {**order, **update_fields}
        asyncio.create_task(_notify_delivery_provider(
            order_updated, internal_status,
            carrier_status=carrier_status_raw,
            courier_info=update_fields.get("courier_info"),
        ))

    return {"success": True, "message": "Webhook processed"}


# =====================================================================
# Test Orders — create sandbox deliveries to verify carrier integration
# =====================================================================

TEST_ORDERS_COLL = db["delivery_test_orders"]

class TestOrderRequest(BaseModel):
    carrier_slug: str = Field(..., description="Slug del carrier")
    pickup_address: str = Field("Av. Providencia 1234", description="Dirección de pickup")
    pickup_city: str = Field("Santiago", description="Ciudad pickup")
    pickup_lat: float = Field(-33.4265)
    pickup_lng: float = Field(-70.6155)
    pickup_name: str = Field("La Piccola Italia")
    pickup_phone: str = Field("+56912345678")
    dropoff_address: str = Field("Av. Las Condes 5678", description="Dirección de dropoff")
    dropoff_city: str = Field("Santiago", description="Ciudad dropoff")
    dropoff_lat: float = Field(-33.4087)
    dropoff_lng: float = Field(-70.5667)
    dropoff_name: str = Field("Cliente Test")
    dropoff_phone: str = Field("+56987654321")
    item_description: str = Field("Pizza Margherita Test")
    item_value: float = Field(12000)


@router.post("/delivery/last-mile/test-order", summary="Crear orden de test con un carrier")
async def create_test_order(
    payload: TestOrderRequest,
    user: dict = Depends(verify_session)
):
    """Create a test delivery order directly with the carrier's sandbox API."""
    require_admin_level(user, "delivery")

    carrier = CARRIERS_COLL.find_one({"slug": payload.carrier_slug, "status": "active"})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{payload.carrier_slug}' no encontrado o inactivo")

    auth = carrier.get("auth", {})
    api_key = auth.get("api_key", "")
    token = None

    # Get auth token
    if auth.get("type") == "api_key" and api_key:
        token = api_key
    else:
        token = await _get_carrier_token(carrier)

    base_url = carrier.get("endpoints", {}).get("base_url", "")
    use_bearer = auth.get("bearer_prefix", True)
    auth_value = f"Bearer {token}" if use_bearer else token
    headers = {
        "Authorization": auth_value,
        "Content-Type": "application/json",
    }

    now = datetime.now(timezone.utc)
    slug = payload.carrier_slug

    # ── PedidosYa v2 ────────────────────────────────────
    if slug == "pedidosya":
        # Step 1: Create shipping (returns PREORDER with quotes)
        shipping_body = {
            "referenceId": f"vanellix-test-{now.strftime('%Y%m%d%H%M%S')}",
            "isTest": True,
            "items": [{
                "description": payload.item_description,
                "quantity": 1,
                "value": payload.item_value,
            }],
            "waypoints": [
                {
                    "type": "PICK_UP",
                    "addressStreet": payload.pickup_address,
                    "city": payload.pickup_city,
                    "latitude": payload.pickup_lat,
                    "longitude": payload.pickup_lng,
                    "name": payload.pickup_name,
                    "phone": payload.pickup_phone,
                },
                {
                    "type": "DROP_OFF",
                    "addressStreet": payload.delivery_info.get("address", ""),
                    "city": payload.dropoff_city,
                    "latitude": payload.delivery_info.get("lat", 0),
                    "longitude": payload.delivery_info.get("lng", 0),
                    "name": payload.dropoff_name,
                    "phone": payload.dropoff_phone,
                },
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{base_url}/v2/shippings", headers=headers, json=shipping_body)
                resp.raise_for_status()
                quote_data = resp.json()
        except Exception as e:
            logger.error(f"[test-order] PedidosYa create failed: {e}")
            raise HTTPException(status_code=502, detail=f"Error creando orden de test: {e}")

        shipping_id = quote_data.get("id")
        quotes = quote_data.get("quotes", [])
        quote_type = quotes[0]["type"] if quotes else "ON_DEMAND"

        # Step 2: Confirm the shipping
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/v2/shippings/{shipping_id}/confirm",
                    headers=headers,
                    json={"type": quote_type},
                )
                resp.raise_for_status()
                confirm_data = resp.json()
        except Exception as e:
            logger.error(f"[test-order] PedidosYa confirm failed: {e}")
            raise HTTPException(status_code=502, detail=f"Error confirmando orden: {e}")

        # Store test order
        test_order = {
            "carrier_slug": slug,
            "carrier_name": carrier["name"],
            "carrier_delivery_id": shipping_id,
            "mode": carrier.get("mode", "test"),
            "is_test": True,
            "status": confirm_data.get("status", "CONFIRMED"),
            "internal_status": carrier.get("status_mapping", {}).get(confirm_data.get("status"), "confirmed"),
            "quote": quotes[0] if quotes else None,
            "raw_response": confirm_data,
            "created_at": now,
            "updated_at": now,
            "created_by": user.get("wallet") or user.get("id"),
            "status_history": [
                {"status": "PREORDER", "internal": "pending", "at": now.isoformat()},
                {"status": confirm_data.get("status", "CONFIRMED"), "internal": "confirmed", "at": now.isoformat()},
            ],
        }
        result = TEST_ORDERS_COLL.insert_one(test_order)

        logger.info(f"[test-order] PedidosYa test order created: {shipping_id}")

        return {
            "success": True,
            "test_order_id": str(result.inserted_id),
            "carrier_delivery_id": shipping_id,
            "status": confirm_data.get("status"),
            "quote": quotes[0] if quotes else None,
            "confirmation_code": confirm_data.get("confirmationCode"),
        }

    # ── Uber Direct ────────────────────────────────────
    elif slug == "uber_direct":
        customer_id = auth.get("customer_id", "")
        delivery_body = {
            "pickup_address": payload.pickup_address,
            "pickup_name": payload.pickup_name,
            "pickup_phone_number": payload.pickup_phone,
            "pickup_latitude": payload.pickup_lat,
            "pickup_longitude": payload.pickup_lng,
            "dropoff_address": payload.delivery_info.get("address", ""),
            "dropoff_name": payload.dropoff_name,
            "dropoff_phone_number": payload.dropoff_phone,
            "dropoff_latitude": payload.delivery_info.get("lat", 0),
            "dropoff_longitude": payload.delivery_info.get("lng", 0),
            "manifest_items": [{
                "name": payload.item_description,
                "quantity": 1,
                "size": "small",
            }],
            "test_specifications": {"robo_courier_specification": {"mode": "auto"}},
        }
        endpoint = f"/v1/customers/{customer_id}/deliveries"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{base_url}{endpoint}", headers=headers, json=delivery_body)
                resp.raise_for_status()
                uber_data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[test-order] Uber Direct create failed: {e.response.status_code} {e.response.text[:500]}")
            raise HTTPException(status_code=502, detail=f"Error Uber Direct: {e.response.text[:200]}")

        delivery_id = uber_data.get("id", "")
        test_order = {
            "carrier_slug": slug,
            "carrier_name": carrier["name"],
            "carrier_delivery_id": delivery_id,
            "mode": carrier.get("mode", "test"),
            "is_test": True,
            "status": uber_data.get("status", "SCHEDULED"),
            "internal_status": carrier.get("status_mapping", {}).get(uber_data.get("status"), "confirmed"),
            "raw_response": uber_data,
            "created_at": now,
            "updated_at": now,
            "created_by": user.get("wallet") or user.get("id"),
            "status_history": [
                {"status": uber_data.get("status", "SCHEDULED"), "internal": "confirmed", "at": now.isoformat()},
            ],
        }
        result = TEST_ORDERS_COLL.insert_one(test_order)

        return {
            "success": True,
            "test_order_id": str(result.inserted_id),
            "carrier_delivery_id": delivery_id,
            "status": uber_data.get("status"),
            "tracking_url": uber_data.get("tracking_url"),
        }

    else:
        raise HTTPException(status_code=400, detail=f"Test orders not yet implemented for '{slug}'")


@router.get("/delivery/last-mile/test-orders", summary="Listar órdenes de test")
async def list_test_orders(
    user: dict = Depends(verify_session)
):
    """List all test delivery orders."""
    require_admin_level(user, "delivery")

    orders = list(TEST_ORDERS_COLL.find().sort("created_at", -1).limit(50))
    for o in orders:
        o["_id"] = str(o["_id"])
        if o.get("created_at"):
            o["created_at"] = o["created_at"].isoformat()
        if o.get("updated_at"):
            o["updated_at"] = o["updated_at"].isoformat()

    return {"success": True, "orders": orders}


@router.post("/delivery/last-mile/test-orders/{test_order_id}/poll", summary="Poll carrier status for test order")
async def poll_test_order_status(
    test_order_id: str,
    user: dict = Depends(verify_session)
):
    """Poll the carrier API to get the latest status for a test order."""
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(test_order_id):
        raise HTTPException(status_code=400, detail="ID inválido")
    test_order = TEST_ORDERS_COLL.find_one({"_id": ObjectId(test_order_id)})
    if not test_order:
        raise HTTPException(status_code=404, detail="Test order no encontrada")

    carrier = CARRIERS_COLL.find_one({"slug": test_order["carrier_slug"], "status": "active"})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")

    delivery_id = test_order["carrier_delivery_id"]
    auth = carrier.get("auth", {})
    base_url = carrier.get("endpoints", {}).get("base_url", "")
    slug = test_order["carrier_slug"]

    # Get token
    if auth.get("type") == "api_key":
        token = auth.get("api_key", "")
    else:
        token = await _get_carrier_token(carrier)

    use_bearer = auth.get("bearer_prefix", True)
    auth_value = f"Bearer {token}" if use_bearer else token
    headers = {"Authorization": auth_value, "Content-Type": "application/json"}

    # Fetch status from carrier
    try:
        if slug == "pedidosya":
            url = f"{base_url}/v2/shippings/{delivery_id}"
        elif slug == "uber_direct":
            customer_id = auth.get("customer_id", "")
            url = f"{base_url}/v1/customers/{customer_id}/deliveries/{delivery_id}"
        else:
            get_endpoint = carrier.get("endpoints", {}).get("get_delivery", "")
            url = f"{base_url}{get_endpoint.replace('{id}', delivery_id)}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error(f"[test-order/poll] Failed: {e}")
        raise HTTPException(status_code=502, detail=f"Error polling carrier: {e}")

    # Extract new status
    new_carrier_status = data.get("status", "")
    status_mapping = carrier.get("status_mapping", {})
    new_internal = status_mapping.get(new_carrier_status, test_order.get("internal_status", ""))

    now = datetime.now(timezone.utc)
    old_status = test_order.get("status", "")

    # Append to history if changed
    history = test_order.get("status_history", [])
    if new_carrier_status != old_status:
        history.append({
            "status": new_carrier_status,
            "internal": new_internal,
            "at": now.isoformat(),
        })

    TEST_ORDERS_COLL.update_one(
        {"_id": test_order["_id"]},
        {"$set": {
            "status": new_carrier_status,
            "internal_status": new_internal,
            "status_history": history,
            "raw_response": data,
            "updated_at": now,
            "courier_info": data.get("courier") or data.get("data", {}).get("courier"),
        }}
    )

    return {
        "success": True,
        "carrier_status": new_carrier_status,
        "internal_status": new_internal,
        "changed": new_carrier_status != old_status,
        "status_history": history,
        "courier_info": data.get("courier"),
    }
