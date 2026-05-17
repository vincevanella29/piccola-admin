import logging
import httpx
from fastapi import HTTPException
from utils.delivery.auth import _get_carrier_token

logger = logging.getLogger(__name__)

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
