import json
import logging
import httpx
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.delivery.auth import _get_carrier_token
from utils.delivery.pricing import _apply_platform_fee
from utils.delivery.client import _carrier_request

logger = logging.getLogger(__name__)
CARRIERS_COLL = db.delivery_carriers
LOCATIONS_COLL = db.locations
DELIVERY_COLL = db.delivery_orders

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

async def get_delivery_quote(payload):
    loc = None
    if ObjectId.is_valid(payload.location_id):
        loc = LOCATIONS_COLL.find_one({"_id": ObjectId(payload.location_id)})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"_id": payload.location_id})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"permalink_slug": payload.location_id})
    if not loc:
        raise ValueError("Sucursal no encontrada")

    pickup_lat = loc.get("lat", 0)
    pickup_lng = loc.get("lng", 0)
    pickup_address = loc.get("direccion", "")
    pickup_name = loc.get("nombre", "La Piccola Italia")
    pickup_city = loc.get("city", "Santiago")

    distance_km = round(haversine_km(pickup_lat, pickup_lng, payload.delivery_info.get("lat", 0), payload.delivery_info.get("lng", 0)), 2)

    from apis.delivery.config import _get_config, DEFAULT_FEE_CONFIG
    config = _get_config()
    fee_config = config.get("delivery_fee_config", DEFAULT_FEE_CONFIG)

    loc_id_str = str(loc.get("_id", ""))
    loc_slug = loc.get("permalink_slug", "")
    overrides = fee_config.get("location_overrides", {})
    
    if loc_slug and loc_slug in overrides:
        fee_config = overrides[loc_slug]
    elif loc_id_str and loc_id_str in overrides:
        fee_config = overrides[loc_id_str]

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
                    resp = await client.post(f"{base_url}/v2/shippings", headers=headers, json=shipping_body)

                if resp.status_code in (200, 201):
                    data = resp.json()
                    raw_quotes = data.get("quotes", [])
                    if raw_quotes:
                        best = raw_quotes[0]
                        raw_fee = best.get("deliveryCost") or best.get("total") or 0
                        fees = _apply_platform_fee(raw_fee, fee_config, payload.order_total)
                        quote.update({"available": True, "eta_min": best.get("estimatedDeliveryTime"), **fees})

                    shipping_id = data.get("id")
                    if shipping_id:
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as c2:
                                await c2.post(f"{base_url}/v2/shippings/{shipping_id}/cancel", headers=headers)
                        except Exception:
                            pass
                else:
                    error_data = resp.text
                    quote["error"] = f"HTTP {resp.status_code} - {error_data}"

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

    available_quotes = [q for q in quotes if q["available"] and q["total_fee"] is not None]
    available_quotes.sort(key=lambda q: q["total_fee"])
    best = available_quotes[0] if available_quotes else None
    
    print("\n" + "="*50)
    print("🚀 [ADMIN HUB] CARRIER QUOTES RESULT")
    print(json.dumps(quotes, indent=2))
    print("="*50 + "\n")

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

async def request_admin_quote(payload):
    if not ObjectId.is_valid(payload.order_id):
        raise ValueError("ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.order_id)})
    if not order:
        raise ValueError("Pedido no encontrado")

    if order.get("order_type") == "pickup":
        raise ValueError("Los pedidos pickup no requieren carrier")

    carrier = CARRIERS_COLL.find_one({"slug": payload.carrier_slug, "status": "active"})
    if not carrier:
        raise ValueError(f"Carrier '{payload.carrier_slug}' no encontrado o inactivo")

    loc = None
    if order.get("location_id"):
        if ObjectId.is_valid(order["location_id"]):
            loc = LOCATIONS_COLL.find_one({"_id": ObjectId(order["location_id"])})
        if not loc:
            loc = LOCATIONS_COLL.find_one({"slug": order.get("location_slug")})

    pickup_address = loc.get("direccion", "") if loc else ""
    delivery_info = order.get("delivery_info", {})
    dropoff_address = delivery_info.get("address", "")

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
