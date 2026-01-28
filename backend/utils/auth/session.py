# backend/utils/auth/session.py
import os, time, logging
from fastapi import HTTPException, Request
import jwt as pyjwt

from utils.web3mongo import w3, sessions_collection
from config.roles.access import compute_permissions_for_identity

logger = logging.getLogger(__name__)

PRIVY_JWT_PUBLIC_KEY = os.getenv("PRIVY_JWT_PUBLIC_KEY", "").replace("\\n", "\n")
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")

_DEFAULT_ALLOWED = [
    "https://test.vanellix.com",
    "https://testing.lapiccolaitalia.cl",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
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

    # Identidad opcional desde header: puede ser wallet o sub (según cómo venga del front)
    identity_header = request.headers.get("X-Wallet-Address")

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

        # Si el header contiene una dirección Ethereum válida, tratamos como sesión con wallet
        if identity_header:
            try:
                if w3.is_address(identity_header):
                    checksum_wallet = w3.to_checksum_address(identity_header)
                else:
                    checksum_wallet = None
            except Exception:
                checksum_wallet = None

            if checksum_wallet is not None:
                wallet = checksum_wallet.lower()
                session = sessions_collection.find_one({"token": token, "wallet": wallet})
                if not session:
                    raise HTTPException(status_code=401, detail="No valid session")
                if session.get("exp", 0) < int(time.time()):
                    sessions_collection.delete_one({"token": token})
                    raise HTTPException(status_code=401, detail="Session expired")

                # Add role caching fields if not present
                if "role_level" not in session:
                    from config.roles.service import get_company_role_level
                    from config.roles.access import compute_permissions_for_identity
                    sessions_collection.update_one(
                        {"_id": session["_id"]},
                        {"$set": {
                            "role_level": get_company_role_level(wallet),
                            "permissions": compute_permissions_for_identity(wallet),
                            "last_verified": int(time.time())
                        }}
                    )
                    session = sessions_collection.find_one({"_id": session["_id"]})

                result = {
                    "id": wallet,
                    "wallet": wallet,
                    "sub": payload.get("sub"),
                    "role_level": session.get("role_level"),
                    "permissions": session.get("permissions"),
                    "last_verified": session.get("last_verified")
                }
                return result

        # token-only (sin wallet válida): identidad basada en sub
        sub = payload.get("sub")
        result = {"id": sub, "wallet": None, "sub": sub}
        try:
            result["permissions"] = compute_permissions_for_identity(sub)
        except Exception as e:
            logger.error(f"permissions compute failed (sub): {e}")
            result["permissions"] = None
        return result

    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid Privy JWT")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Session verification failed: {str(e)}")
