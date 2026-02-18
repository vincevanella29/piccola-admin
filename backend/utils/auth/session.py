# backend/utils/auth/session.py
import os, time, logging
from fastapi import HTTPException, Request
import jwt as pyjwt

from utils.web3mongo import w3, sessions_collection
from config.roles.access import compute_permissions_for_identity

logger = logging.getLogger(__name__)

PRIVY_JWT_PUBLIC_KEY = os.getenv("PRIVY_JWT_PUBLIC_KEY", "").replace("\\n", "\n")
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")

# Session duration: 24 hours (overridable via env)
SESSION_DURATION_SECONDS = int(os.getenv("SESSION_DURATION_SECONDS", 86400))  # 24h

# Role cache refresh interval within a session — every 2 hours instead of 5 minutes
# The on-chain role itself is cached 24h in MongoDB, so this just refreshes permissions
ROLE_CACHE_TTL = int(os.getenv("SESSION_ROLE_CACHE_TTL", 7200))  # 2h

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

                # Use our 24h session duration instead of JWT exp
                session_created = session.get("iat", session.get("created_at", 0))
                current_time = int(time.time())
                
                # Check session expiration: 24 hours from creation
                session_exp = session.get("session_exp", session.get("exp", 0))
                if session_exp < current_time:
                    # If no session_exp set yet (old sessions), calculate from iat
                    if not session.get("session_exp") and session_created:
                        session_exp = session_created + SESSION_DURATION_SECONDS
                        if session_exp < current_time:
                            sessions_collection.delete_one({"token": token})
                            raise HTTPException(status_code=401, detail="Session expired")
                        # Save the extended session_exp
                        sessions_collection.update_one(
                            {"_id": session["_id"]},
                            {"$set": {"session_exp": session_exp}}
                        )
                    else:
                        sessions_collection.delete_one({"token": token})
                        raise HTTPException(status_code=401, detail="Session expired")

                # Re-validate roles every ROLE_CACHE_TTL (2h) — the underlying
                # get_company_role_level() now uses its own 24h MongoDB cache,
                # so this is cheap (just a Mongo read + permissions compute).
                last_verified = session.get("last_verified", 0)
                needs_refresh = (current_time - last_verified) > ROLE_CACHE_TTL
                
                if "role_level" not in session or needs_refresh:
                    from config.roles.service import get_company_role_level

                    sessions_collection.update_one(
                        {"_id": session["_id"]},
                        {"$set": {
                            "role_level": get_company_role_level(wallet),
                            "permissions": compute_permissions_for_identity(wallet),
                            "last_verified": current_time
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
