import logging
from datetime import datetime, timezone
from fastapi import HTTPException
from utils.web3mongo import db

logger = logging.getLogger(__name__)
CARRIERS_COLL = db.delivery_carriers

async def _get_carrier_token(carrier: dict) -> str:
    """Get a valid access token for OAuth2 carriers, refreshing if expired."""
    import httpx
    
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
