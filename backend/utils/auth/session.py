# backend/utils/auth/session.py
import os, time, logging
from fastapi import HTTPException, Request
import jwt as pyjwt

from utils.web3mongo import w3, sessions_collection
from config.roles.access import compute_user_permissions

logger = logging.getLogger(__name__)

PRIVY_JWT_PUBLIC_KEY = os.getenv("PRIVY_JWT_PUBLIC_KEY", "").replace("\\n", "\n")
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")

_DEFAULT_ALLOWED = [
    "https://test.vanellix.com",
    "https://testing.lapiccolaitalia.cl",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://103.199.187.37:5173",
    "https://103.199.187.37:5173",
    "https://dex2.vanellix.com:5173",
]

async def verify_session(request: Request) -> dict:
    # Referer allowlist
    referer = request.headers.get('referer', '')
    allowed_referers_env = os.getenv("ALLOWED_REFERERS")
    allowed = [r.strip() for r in allowed_referers_env.split(",")] if allowed_referers_env else _DEFAULT_ALLOWED
    if not any(referer.startswith(origin) for origin in allowed):
        logger.error(f"Forbidden referer: {referer}")
        raise HTTPException(status_code=403, detail="Forbidden: invalid referer")

    # Token
    auth_header = request.headers.get("Authorization")
    token = auth_header.split(" ", 1)[1] if (auth_header and auth_header.startswith("Bearer ")) else request.cookies.get("privy-token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Wallet (opcional)
    wallet = request.headers.get("X-Wallet-Address")

    try:
        if token.count('.') != 2:
            raise HTTPException(status_code=401, detail="Invalid Privy JWT")

        payload = pyjwt.decode(
            token,
            PRIVY_JWT_PUBLIC_KEY,
            algorithms=["ES256"],
            issuer="privy.io",
            audience=PRIVY_APP_ID,
        )

        if wallet:
            try:
                checksum_wallet = w3.to_checksum_address(wallet)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid wallet address format: {str(e)}")

            session = sessions_collection.find_one({"token": token, "wallet": wallet.lower()})
            if not session:
                raise HTTPException(status_code=401, detail="No valid session")
            if session.get("exp", 0) < int(time.time()):
                sessions_collection.delete_one({"token": token})
                raise HTTPException(status_code=401, detail="Session expired")

            result = {"id": wallet.lower(), "wallet": wallet.lower(), "sub": payload.get("sub")}
            try:
                result["permissions"] = compute_user_permissions(wallet)
            except Exception as e:
                logger.error(f"permissions compute failed: {e}")
                result["permissions"] = None
            return result

        # token-only
        return {"id": payload.get("sub"), "wallet": None, "sub": payload.get("sub")}

    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid Privy JWT")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Session verification failed: {str(e)}")
