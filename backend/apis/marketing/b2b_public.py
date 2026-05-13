from fastapi import APIRouter, Request, HTTPException, Body
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import logging
import hmac
import time
from bson import ObjectId

from utils.web3mongo import db
from utils.vanellix_crypto import verify_dilithium as dilithium_verify
from config.b2b.models import generate_b2b_coupon_code

router = APIRouter()
logger = logging.getLogger(__name__)

COL_B2B_PARTNERS = db.b2b_partners
COL_B2B_ALLOCATIONS = db.b2b_allocations
COL_CLAIMS = db.promotion_claims
NONCES_COLL = db.dilithium_nonces

_TIMESTAMP_WINDOW = 300

def _now_iso() -> str:
    return datetime.utcnow().isoformat()

class DistributeRequest(BaseModel):
    partner_id: str
    allocation_id: str  # Now references b2b_allocations directly
    target_email: EmailStr

async def verify_b2b_dilithium(request: Request, partner_id: str):
    partner = COL_B2B_PARTNERS.find_one({"_id": ObjectId(partner_id)})
    if not partner or partner.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Partner not found or not approved")
        
    stored_pk = partner.get("dilithium_public_key")
    if not stored_pk:
        raise HTTPException(status_code=403, detail="Partner has no Dilithium credentials")

    sig_hex = request.headers.get("X-Dilithium-Signature", "")
    if not sig_hex:
        raise HTTPException(status_code=403, detail="Missing X-Dilithium-Signature")

    signable = await request.body()
    
    received_pk = request.headers.get("X-Dilithium-PK", "")
    if received_pk and not hmac.compare_digest(stored_pk, received_pk):
        raise HTTPException(status_code=403, detail="Public key mismatch")

    if not dilithium_verify(stored_pk, signable, sig_hex):
        raise HTTPException(status_code=403, detail="Invalid Dilithium signature")

    ts_header = request.headers.get("X-Dilithium-Timestamp", "")
    nonce = request.headers.get("X-Dilithium-Nonce", "")

    if ts_header:
        try:
            ts = float(ts_header)
            now = time.time()
            if abs(now - ts) > _TIMESTAMP_WINDOW:
                raise HTTPException(status_code=403, detail="Request expired")
        except ValueError:
            pass
            
    if nonce:
        try:
            existing = NONCES_COLL.find_one({"_id": nonce})
            if existing:
                raise HTTPException(status_code=403, detail="Nonce replay detected")
            NONCES_COLL.insert_one({
                "_id": nonce,
                "created_at": datetime.utcnow()
            })
        except HTTPException:
            raise
        except Exception:
            pass

    return partner

@router.post("/public/b2b/distribute")
async def distribute_coupon(request: Request):
    """
    Public endpoint for B2B partners to assign a coupon to a target_email.
    Must be signed using Dilithium.
    Reads reward info directly from b2b_allocations (self-contained).
    """
    try:
        body_json = await request.json()
        req_data = DistributeRequest(**body_json)
    except Exception as e:
        raise HTTPException(status_code=422, detail="Invalid JSON body")

    partner = await verify_b2b_dilithium(request, req_data.partner_id)
    
    # Read directly from b2b_allocations (self-contained doc)
    allocation = COL_B2B_ALLOCATIONS.find_one({
        "_id": ObjectId(req_data.allocation_id),
        "partner_id": req_data.partner_id,
        "active": True
    })
    
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found or inactive")
        
    if allocation.get("claimed_count", 0) >= allocation.get("total_quota", 0):
        raise HTTPException(status_code=400, detail="Quota exceeded")

    # Check limits per user
    source_tag = f"b2b_{req_data.partner_id}_{req_data.allocation_id}"
    user_claims = COL_CLAIMS.count_documents({
        "email": req_data.target_email,
        "source": source_tag,
    })
    
    if user_claims >= allocation.get("max_per_user", 1):
        raise HTTPException(status_code=400, detail="Max per user limit reached")

    # Check daily limit
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_claims = COL_CLAIMS.count_documents({
        "source": source_tag,
        "created_at": {"$gte": today_start.isoformat()},
    })
    if daily_claims >= allocation.get("max_per_day", 5):
        raise HTTPException(status_code=400, detail="Max per day limit reached")
        
    # Generate coupon code
    code = generate_b2b_coupon_code()
    
    # Create Claim — reward data comes from the allocation doc
    claim_doc = {
        "allocation_id": req_data.allocation_id,
        "email": req_data.target_email,
        "codigo": code,
        "source": source_tag,
        "partner_name": partner.get("company_name"),
        "promotion_name": allocation.get("promotion_name"),
        "reward_type": allocation.get("reward_type"),
        "reward_details": allocation.get("reward_details"),
        "estado": "A",
        "created_at": _now_iso()
    }
    
    COL_CLAIMS.insert_one(claim_doc)
    
    # Increment allocation counter
    COL_B2B_ALLOCATIONS.update_one(
        {"_id": allocation["_id"]},
        {"$inc": {"claimed_count": 1}}
    )

    return {
        "success": True,
        "coupon_code": code,
        "target_email": req_data.target_email,
        "promotion_name": allocation.get("promotion_name"),
        "message": "Coupon distributed successfully"
    }

