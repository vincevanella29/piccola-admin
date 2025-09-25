from fastapi import APIRouter, Depends, HTTPException, Request, Path
from pydantic import BaseModel, Field
from typing import List, Optional
import hashlib
import secrets
from datetime import datetime, timedelta
import os
import logging

from utils.auth.session import verify_session
from utils.web3mongo import db, w3
from config.roles.service import verify_admin

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID"))

# ---------- Models ----------
class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    # Expiration in months: 1, 3, 6, 12. If null -> infinite (no expiration)
    expiry_months: Optional[int] = Field(default=None)

class ApiKeyOut(BaseModel):
    id: str
    name: str
    created_at: str
    last_used_at: Optional[str] = None
    active: bool
    expires_at: Optional[str] = None

class CreateApiKeyResponse(BaseModel):
    id: str
    name: str
    api_key: str  # key_id.secret (solo se entrega una vez)
    created_at: str
    expires_at: Optional[str] = None

# ---------- Helpers ----------
COLL = db.api_keys


def generate_key_pair() -> (str, str):
    """Return (key_id, secret)."""
    key_id = secrets.token_urlsafe(10).replace('-', '').replace('_', '')  # short id
    secret = secrets.token_urlsafe(32)
    return key_id, secret


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode('utf-8')).hexdigest()


# ---------- Endpoints ----------
@router.post("/apikeys", response_model=CreateApiKeyResponse)
async def create_api_key(data: CreateApiKeyRequest, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet or not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Invalid wallet in session")

    ensure_level_3_or_4(wallet)

    # validate expiry selection
    allowed = {1, 3, 6, 12}
    if data.expiry_months is not None and data.expiry_months not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid expiry_months. Allowed: {sorted(list(allowed))} or null for infinite")

    key_id, secret = generate_key_pair()
    secret_hash = hash_secret(secret)

    created_at = datetime.utcnow()
    expires_at = None
    if data.expiry_months is not None:
        # Approximate month as 30 days
        expires_at = created_at + timedelta(days=30 * int(data.expiry_months))

    doc = {
        "_id": key_id,
        "name": data.name,
        "owner": wallet.lower(),
        "company_id": COMPANY_ID,
        "secret_hash": secret_hash,
        "active": True,
        "created_at": created_at,
        "last_used_at": None,
        "expires_at": expires_at,
    }
    try:
        COLL.insert_one(doc)
    except Exception as e:
        logger.error(f"Error creating api key: {e}")
        raise HTTPException(status_code=500, detail="Failed to create API key")

    api_key_value = f"{key_id}.{secret}"
    return CreateApiKeyResponse(
        id=key_id,
        name=data.name,
        api_key=api_key_value,
        created_at=doc["created_at"].isoformat(),
        expires_at=doc["expires_at"].isoformat() if doc.get("expires_at") else None,
    )


@router.get("/apikeys", response_model=List[ApiKeyOut])
async def list_my_api_keys(user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet or not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Invalid wallet in session")

    # listing permitido para el dueño y roles 3/4, pero filtrado por owner
    items = []
    for d in COLL.find({"owner": wallet.lower(), "company_id": COMPANY_ID}).sort("created_at", -1):
        items.append(ApiKeyOut(
            id=d["_id"],
            name=d.get("name", ""),
            created_at=d["created_at"].isoformat(),
            last_used_at=d["last_used_at"].isoformat() if d.get("last_used_at") else None,
            active=bool(d.get("active", False)),
            expires_at=d.get("expires_at").isoformat() if d.get("expires_at") else None,
        ))
    return items


@router.delete("/apikeys/{key_id}")
async def revoke_api_key(key_id: str = Path(...), user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet or not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Invalid wallet in session")

    doc = COLL.find_one({"_id": key_id, "company_id": COMPANY_ID})
    if not doc:
        raise HTTPException(status_code=404, detail="API key not found")

    # Solo el dueño o roles 3/4 (del dueño) pueden revocar. Como owner es el propio usuario, basta validar ownership
    if doc["owner"] != wallet.lower():
        # permitir si el caller es 3/4 (admin de la compañía)
        if not verify_admin(user):
            raise HTTPException(status_code=403, detail="Not allowed to revoke this API key")

    COLL.update_one({"_id": key_id}, {"$set": {"active": False}})
    return {"success": True}


# Utilidad para validar API keys (para uso futuro en middlewares/otras rutas)
def validate_api_key(raw_key: str) -> Optional[dict]:
    """
    raw_key format: keyId.secret
    Return the key document if valid and active (without secret hash), else None.
    """
    try:
        key_id, secret = raw_key.split('.', 1)
    except ValueError:
        return None
    doc = COLL.find_one({"_id": key_id, "active": True})
    if not doc:
        return None
    if hash_secret(secret) != doc.get("secret_hash"):
        return None
    return {
        "id": doc["_id"],
        "owner": doc["owner"],
        "company_id": doc.get("company_id"),
        "expires_at": doc.get("expires_at").isoformat() if doc.get("expires_at") else None,
    }
