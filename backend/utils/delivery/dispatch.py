import logging
import json
import httpx
from fastapi import HTTPException
from utils.delivery.auth import _get_carrier_token
from utils.delivery.payloads import _build_uber_body, _build_pedidosya_body

logger = logging.getLogger(__name__)

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
    
    # DEBUG LOGGING (requested by user)
    logger.info(f"[last_mile] 🚨 [DEBUG] DISPATCH REQUEST TO {slug} | URL: {url} | HEADERS: {headers} | BODY: {json.dumps(body, ensure_ascii=False)}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            logger.info(f"[last_mile] 🚨 [DEBUG] DISPATCH RESPONSE FROM {slug} | STATUS: {resp.status_code} | BODY: {resp.text}")
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
        
        quotes = data.get("quotes", [])
        quote_type = quotes[0].get("type", "ON_DEMAND") if quotes else "ON_DEMAND"
        confirm_body = {"type": quote_type}
        
        logger.info(f"[last_mile] 🔍 PedidosYa Confirming... URL={confirm_url}, Body={confirm_body}")
        logger.info(f"[last_mile] 🚨 [DEBUG] PEDIDOSYA CONFIRM REQUEST | URL: {confirm_url} | HEADERS: {headers} | BODY: {json.dumps(confirm_body)}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                c_resp = await client.post(confirm_url, headers=headers, json=confirm_body)
                logger.info(f"[last_mile] 🚨 [DEBUG] PEDIDOSYA CONFIRM RESPONSE | STATUS: {c_resp.status_code} | BODY: {c_resp.text}")
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
