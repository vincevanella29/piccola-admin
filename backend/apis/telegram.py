from fastapi import APIRouter, HTTPException, Request
import logging
import os
import jwt as pyjwt
from utils.web3mongo import db, w3
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

PRIVY_JWT_PUBLIC_KEY = os.getenv("PRIVY_JWT_PUBLIC_KEY")
if PRIVY_JWT_PUBLIC_KEY:
    PRIVY_JWT_PUBLIC_KEY = PRIVY_JWT_PUBLIC_KEY.replace('\\n', '\n')
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")

@router.post("/telegram/link/confirm")
async def telegram_link_confirm(request: Request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    token = data.get("token")
    wallet = data.get("wallet")
    tg_id = data.get("tg_id")
    state = data.get("state")  # reserved for future CSRF/state validation

    if not token or not wallet or not tg_id:
        raise HTTPException(status_code=400, detail="Missing token, wallet or tg_id")

    # Verify Privy JWT
    try:
        payload = pyjwt.decode(
            token,
            PRIVY_JWT_PUBLIC_KEY,
            algorithms=["ES256"],
            issuer="privy.io",
            audience=PRIVY_APP_ID,
        )
        logger.info(f"[telegram_link_confirm] Privy JWT payload: {payload}")
    except pyjwt.InvalidTokenError as e:
        logger.error(f"Invalid Privy JWT in link confirm: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Privy JWT")

    # Validate wallet format
    try:
        _ = w3.to_checksum_address(wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid wallet address format: {str(e)}")

    # Persist the link in MongoDB
    try:
        now = datetime.utcnow()
        db.telegram_links.update_one(
            {"tg_id": str(tg_id)},
            {
                "$set": {
                    "tg_id": str(tg_id),
                    "wallet": wallet.lower(),
                    "state": state,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        # Also ensure a reverse lookup doc (optional but handy)
        db.telegram_links_by_wallet.update_one(
            {"wallet": wallet.lower()},
            {
                "$set": {
                    "wallet": wallet.lower(),
                    "tg_id": str(tg_id),
                    "state": state,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        logger.info(f"Linked Telegram tg_id={tg_id} to wallet={wallet.lower()}")
        return {"success": True, "tg_id": str(tg_id), "wallet": wallet.lower()}
    except Exception as e:
        logger.error(f"Error saving telegram link: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save link")
