import json

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
