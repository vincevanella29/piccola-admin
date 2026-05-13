# apis/b2b_partners.py
# ─────────────────────────────────────────────────────────────────────
# B2B Partner API — self-contained promotion system.
# Promotions B2B viven en b2b_allocations, NO en la colección promotions.
# ─────────────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Body, Path
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import logging
from bson import ObjectId

from utils.auth.session import verify_session
from utils.web3mongo import db
from config.roles.access import require_admin_level
from config.b2b.models import B2BPromotionCreate, generate_b2b_coupon_code

router = APIRouter()
logger = logging.getLogger(__name__)

COL_B2B_PARTNERS = db.b2b_partners
COL_B2B_ALLOCATIONS = db.b2b_allocations
COL_CLAIMS = db.promotion_claims


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _to_oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")


# ═══════════════════════════════════════════════════════════════════════
# PARTNER SELF-SERVICE (authenticated via session)
# ═══════════════════════════════════════════════════════════════════════

class B2BRegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=100)
    contact_email: str = Field(..., min_length=5, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=30)
    description: Optional[str] = Field(None, max_length=500)


class B2BCredentialResponse(BaseModel):
    mnemonic: str
    public_key: str
    message: str

class B2BMnemonicRecoverRequest(BaseModel):
    message: str
    signature: str

class B2BMnemonicRecoverResponse(BaseModel):
    mnemonic: str


@router.post("/b2b/register")
async def register_partner(req: B2BRegisterRequest, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet required")

    existing = COL_B2B_PARTNERS.find_one({"wallet_owner": wallet.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="User already has a registered company")

    doc = {
        "wallet_owner": wallet.lower(),
        "company_name": req.company_name,
        "contact_email": req.contact_email,
        "contact_phone": req.contact_phone,
        "description": req.description,
        "status": "pending",
        "dilithium_public_key": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    COL_B2B_PARTNERS.insert_one(doc)
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/b2b/my-company")
async def get_my_company(user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet required")

    partner = COL_B2B_PARTNERS.find_one({"wallet_owner": wallet.lower()})
    if not partner:
        return {"status": "not_registered"}

    partner["_id"] = str(partner["_id"])

    # Fetch active B2B promotions (self-contained in b2b_allocations)
    allocations = []
    if partner["status"] == "approved":
        allocs = list(COL_B2B_ALLOCATIONS.find({"partner_id": partner["_id"], "active": True}))
        for a in allocs:
            a["_id"] = str(a["_id"])
            # promotion_name, reward_type, reward_details are already in the doc
            allocations.append(a)

    partner["allocations"] = allocations

    has_credentials = bool(partner.get("dilithium_public_key"))
    partner["has_credentials"] = has_credentials

    return partner


@router.post("/b2b/credentials", response_model=B2BCredentialResponse)
async def generate_credentials(user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet required")

    partner = COL_B2B_PARTNERS.find_one({"wallet_owner": wallet.lower()})
    if not partner or partner.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Company is not approved or not found")

    if partner.get("dilithium_public_key"):
        raise HTTPException(status_code=400, detail="Credentials already generated")

    from utils.vanellix_crypto import generate_dilithium_keypair as generate_keypair
    from utils.vanellix_crypto import encrypt_b2b_mnemonic
    
    result = generate_keypair()
    mnemonic = result["mnemonic"]
    pk_hex = result["pk_hex"]

    encrypted_mnemonic = encrypt_b2b_mnemonic(mnemonic)

    COL_B2B_PARTNERS.update_one(
        {"_id": partner["_id"]},
        {"$set": {
            "dilithium_mnemonic_enc": encrypted_mnemonic,
            "dilithium_public_key": pk_hex,
            "updated_at": _now_iso()
        }}
    )

    return B2BCredentialResponse(
        mnemonic=mnemonic,
        public_key=pk_hex,
        message="Guardar este Mnemonic de forma segura. No se mostrará de nuevo."
    )

@router.post("/b2b/credentials/recover", response_model=B2BMnemonicRecoverResponse)
async def recover_credentials(req: B2BMnemonicRecoverRequest, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet required")

    partner = COL_B2B_PARTNERS.find_one({"wallet_owner": wallet.lower()})
    if not partner or partner.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Company is not approved or not found")

    enc_mnemonic = partner.get("dilithium_mnemonic_enc")
    if not enc_mnemonic:
        raise HTTPException(status_code=400, detail="No credentials found")

    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
        message_encoded = encode_defunct(text=req.message)
        recovered_address = Account.recover_message(message_encoded, signature=req.signature)
        if recovered_address.lower() != wallet.lower():
            raise ValueError("Signature mismatch")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid signature")

    from utils.vanellix_crypto import decrypt_b2b_mnemonic
    try:
        plain_mnemonic = decrypt_b2b_mnemonic(enc_mnemonic)
        return B2BMnemonicRecoverResponse(mnemonic=plain_mnemonic)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt mnemonic")



# ═══════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/admin/b2b/partners")
async def admin_list_partners(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")

    partners = list(COL_B2B_PARTNERS.find().sort("created_at", -1))
    for p in partners:
        p["_id"] = str(p["_id"])
        # Attach active promotion count
        p["active_promotions"] = COL_B2B_ALLOCATIONS.count_documents({"partner_id": p["_id"], "active": True})
    return partners


@router.put("/admin/b2b/partners/{partner_id}/status")
async def admin_update_partner_status(
    partner_id: str = Path(...),
    status: str = Body(..., embed=True),
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "admin")

    if status not in ["approved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    res = COL_B2B_PARTNERS.update_one(
        {"_id": _to_oid(partner_id)},
        {"$set": {"status": status, "updated_at": _now_iso()}}
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")

    return {"success": True, "status": status}


# ── B2B Promotions (self-contained) ────────────────────────────────

@router.post("/admin/b2b/partners/{partner_id}/promotions")
async def admin_create_b2b_promotion(
    partner_id: str = Path(...),
    req: B2BPromotionCreate = Body(...),
    user: dict = Depends(verify_session)
):
    """
    Creates a self-contained B2B promotion for a partner.
    Everything lives in b2b_allocations — no reference to the promotions collection.
    """
    require_admin_level(user, "admin")

    partner = COL_B2B_PARTNERS.find_one({"_id": _to_oid(partner_id)})
    if not partner or partner.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Partner not found or not approved")

    # Validate reward details
    try:
        req.validate_reward()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    doc = {
        "partner_id": partner_id,
        "promotion_name": req.name,
        "description": req.description,
        "reward_type": req.reward_type.value,
        "reward_details": req.reward_details,
        "total_quota": req.total_quota,
        "claimed_count": 0,
        "max_per_user": req.max_per_user,
        "max_per_day": req.max_per_day,
        "locations": req.locations or [],
        "active": True,
        "created_by": user.get("wallet", ""),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    res = COL_B2B_ALLOCATIONS.insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    logger.info(f"[B2B] Created promotion '{req.name}' for partner {partner_id} (alloc_id={doc['_id']})")
    return doc


@router.get("/admin/b2b/partners/{partner_id}/promotions")
async def admin_get_partner_promotions(
    partner_id: str = Path(...),
    user: dict = Depends(verify_session)
):
    """Lists all B2B promotions for a specific partner."""
    require_admin_level(user, "admin")

    allocs = list(COL_B2B_ALLOCATIONS.find({"partner_id": partner_id}).sort("created_at", -1))
    for a in allocs:
        a["_id"] = str(a["_id"])
    return allocs


@router.put("/admin/b2b/allocations/{allocation_id}/toggle")
async def admin_toggle_b2b_promotion(
    allocation_id: str = Path(...),
    user: dict = Depends(verify_session)
):
    """Toggle active/inactive status of a B2B promotion."""
    require_admin_level(user, "admin")

    alloc = COL_B2B_ALLOCATIONS.find_one({"_id": _to_oid(allocation_id)})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")

    new_active = not alloc.get("active", True)
    COL_B2B_ALLOCATIONS.update_one(
        {"_id": _to_oid(allocation_id)},
        {"$set": {"active": new_active, "updated_at": _now_iso()}}
    )

    return {"success": True, "active": new_active}
