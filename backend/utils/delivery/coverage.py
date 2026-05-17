import json
import logging
import httpx
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.delivery.auth import _get_carrier_token

logger = logging.getLogger(__name__)
CARRIERS_COLL = db.delivery_carriers
LOCATIONS_COLL = db.locations

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

async def run_coverage_test(payload, user=None):
    # Resolve location
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

    distance_km = round(haversine_km(pickup_lat, pickup_lng, payload.dropoff_lat, payload.dropoff_lng), 2)

    carrier_filter = {"status": "active"}
    if payload.carrier_slugs:
        carrier_filter["slug"] = {"$in": payload.carrier_slugs}
    carriers = list(CARRIERS_COLL.find(carrier_filter))

    if not carriers:
        raise ValueError("No hay carriers activos")

    results = []
    now = datetime.now(timezone.utc)

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
                            "addressStreet": payload.dropoff_address or f"{payload.dropoff_lat},{payload.dropoff_lng}",
                            "city": pickup_city,
                            "latitude": payload.dropoff_lat,
                            "longitude": payload.dropoff_lng,
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

                    shipping_id = data.get("id")
                    if shipping_id:
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as client2:
                                await client2.post(f"{base_url}/v2/shippings/{shipping_id}/cancel", headers=headers)
                        except Exception:
                            pass
                else:
                    error_data = resp.json() if resp.text else {}
                    carrier_result["error"] = error_data.get("message") or error_data.get("error") or f"HTTP {resp.status_code}"
                    carrier_result["raw"] = error_data

            elif slug == "uber_direct":
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
                        "street_address": [payload.dropoff_address or "Test"],
                        "city": pickup_city,
                        "state": "RM",
                        "zip_code": "0000",
                        "country": "CL",
                    }),
                    "dropoff_latitude": payload.dropoff_lat,
                    "dropoff_longitude": payload.dropoff_lng,
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    path = f"/v1/customers/{customer_id}/delivery_quotes" if customer_id else "/v1/delivery_quotes"
                    resp = await client.post(f"{base_url}{path}", headers=headers, json=quote_body)

                if resp.status_code in (200, 201):
                    data = resp.json()
                    carrier_result["available"] = True
                    carrier_result["fee"] = data.get("fee")
                    carrier_result["eta_min"] = data.get("duration")
                    carrier_result["raw"] = data
                else:
                    error_data = resp.json() if resp.text else {}
                    carrier_result["error"] = error_data.get("message") or f"HTTP {resp.status_code}"
                    carrier_result["raw"] = error_data

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
            "lat": payload.dropoff_lat,
            "lng": payload.dropoff_lng,
            "address": payload.dropoff_address,
        },
        "distance_km": distance_km,
        "can_deliver": any_available,
        "carriers": results,
    }
