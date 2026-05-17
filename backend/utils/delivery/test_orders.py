import json
import logging
import httpx
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.delivery.auth import _get_carrier_token

logger = logging.getLogger(__name__)
CARRIERS_COLL = db.delivery_carriers
TEST_ORDERS_COLL = db["delivery_test_orders"]

async def execute_test_order(payload, user):
    carrier = CARRIERS_COLL.find_one({"slug": payload.carrier_slug, "status": "active"})
    if not carrier:
        raise ValueError(f"Carrier '{payload.carrier_slug}' no encontrado o inactivo")

    auth = carrier.get("auth", {})
    api_key = auth.get("api_key", "")
    token = None

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

    if slug == "pedidosya":
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
                    "addressStreet": payload.dropoff_address,
                    "city": payload.dropoff_city,
                    "latitude": payload.dropoff_lat,
                    "longitude": payload.dropoff_lng,
                    "name": payload.dropoff_name,
                    "phone": payload.dropoff_phone,
                },
            ],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{base_url}/v2/shippings", headers=headers, json=shipping_body)
            resp.raise_for_status()
            quote_data = resp.json()

        shipping_id = quote_data.get("id")
        quotes = quote_data.get("quotes", [])
        quote_type = quotes[0]["type"] if quotes else "ON_DEMAND"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/v2/shippings/{shipping_id}/confirm",
                headers=headers,
                json={"type": quote_type},
            )
            resp.raise_for_status()
            confirm_data = resp.json()

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

        return {
            "success": True,
            "test_order_id": str(result.inserted_id),
            "carrier_delivery_id": shipping_id,
            "status": confirm_data.get("status"),
            "quote": quotes[0] if quotes else None,
            "confirmation_code": confirm_data.get("confirmationCode"),
        }

    elif slug == "uber_direct":
        customer_id = auth.get("customer_id", "")
        delivery_body = {
            "pickup_address": payload.pickup_address,
            "pickup_name": payload.pickup_name,
            "pickup_phone_number": payload.pickup_phone,
            "pickup_latitude": payload.pickup_lat,
            "pickup_longitude": payload.pickup_lng,
            "dropoff_address": payload.dropoff_address,
            "dropoff_name": payload.dropoff_name,
            "dropoff_phone_number": payload.dropoff_phone,
            "dropoff_latitude": payload.dropoff_lat,
            "dropoff_longitude": payload.dropoff_lng,
            "manifest_items": [{
                "name": payload.item_description,
                "quantity": 1,
                "size": "small",
            }],
            "test_specifications": {"robo_courier_specification": {"mode": "auto"}},
        }
        endpoint = f"/v1/customers/{customer_id}/deliveries"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{base_url}{endpoint}", headers=headers, json=delivery_body)
            resp.raise_for_status()
            uber_data = resp.json()

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
        raise ValueError(f"Test orders not yet implemented for '{slug}'")

async def poll_test_order_logic(test_order_id: str):
    if not ObjectId.is_valid(test_order_id):
        raise ValueError("ID inválido")
    test_order = TEST_ORDERS_COLL.find_one({"_id": ObjectId(test_order_id)})
    if not test_order:
        raise ValueError("Test order no encontrada")

    carrier = CARRIERS_COLL.find_one({"slug": test_order["carrier_slug"], "status": "active"})
    if not carrier:
        raise ValueError("Carrier no encontrado")

    delivery_id = test_order["carrier_delivery_id"]
    auth = carrier.get("auth", {})
    base_url = carrier.get("endpoints", {}).get("base_url", "")
    slug = test_order["carrier_slug"]

    if auth.get("type") == "api_key":
        token = auth.get("api_key", "")
    else:
        token = await _get_carrier_token(carrier)

    use_bearer = auth.get("bearer_prefix", True)
    auth_value = f"Bearer {token}" if use_bearer else token
    headers = {"Authorization": auth_value, "Content-Type": "application/json"}

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

    new_carrier_status = data.get("status", "")
    status_mapping = carrier.get("status_mapping", {})
    new_internal = status_mapping.get(new_carrier_status, test_order.get("internal_status", ""))

    now = datetime.now(timezone.utc)
    old_status = test_order.get("status", "")

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

async def cancel_test_order_logic(test_order_id: str):
    test_order = TEST_ORDERS_COLL.find_one({"_id": ObjectId(test_order_id)})
    if not test_order:
        raise ValueError("Test order no encontrado")

    carrier = CARRIERS_COLL.find_one({"slug": test_order["carrier_slug"]})
    if not carrier:
        raise ValueError("Carrier no encontrado")

    token = await _get_carrier_token(carrier)
    base_url = carrier.get("endpoints", {}).get("base_url", "")
    use_bearer = carrier.get("auth", {}).get("bearer_prefix", True)
    headers = {
        "Authorization": f"Bearer {token}" if use_bearer else token,
        "Content-Type": "application/json",
    }

    shipping_id = test_order.get("carrier_delivery_id")
    slug = test_order["carrier_slug"]

    if slug == "pedidosya":
        cancel_url = f"{base_url}/v2/shippings/{shipping_id}/cancel"
        body = {"reasonText": "Cancelacion test panel"}
    elif slug == "uber_direct":
        customer_id = carrier.get("auth", {}).get("customer_id", "")
        cancel_url = f"{base_url}/v1/customers/{customer_id}/deliveries/{shipping_id}/cancel"
        body = {}
    else:
        raise ValueError("Cancel not supported for this carrier via API")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(cancel_url, headers=headers, json=body)
        if resp.status_code == 409:
            raise ValueError("El pedido ya no puede ser cancelado por API.")
        resp.raise_for_status()

    TEST_ORDERS_COLL.update_one(
        {"_id": ObjectId(test_order_id)},
        {"$set": {
            "status": "CANCELLED",
            "internal_status": "cancelled",
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    return {"success": True, "message": "Test order cancelled successfully"}
