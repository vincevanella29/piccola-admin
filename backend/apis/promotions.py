# apis/promotions.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, time
from bson import ObjectId
import logging
from utils.web3mongo import db, w3
from utils.auth.session import verify_session
from eth_account.messages import encode_defunct
from web3 import Web3
from web3.exceptions import ContractLogicError
from config.promotions.models import PromotionCreate, PromotionType, ReactivateCouponRequest, make_json_serializable
from config.promotions.claim_rules import get_token_decimals, convert_from_base_units
from config.promotions.display_rules import validate_display_rules
from apis.roles import get_company_role_level
import os
from pydantic import ValidationError
from zoneinfo import ZoneInfo
from decimal import Decimal
from enum import Enum

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))
CHAIN_ID = int(os.getenv("CHAIN_ID"))
chile_tz = ZoneInfo("America/Santiago")

# ERC20 ABI
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    }
]

def make_json_serializable(obj):
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(i) for i in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, time):
        return obj.strftime("%H:%M:%S")
    elif isinstance(obj, Decimal):
        return str(obj)  # Convert Decimal to string to preserve precision
    elif isinstance(obj, Enum):
        return obj.value
    else:
        return obj

def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    try:
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        return recovered.lower() == wallet.lower()
    except Exception as e:
        logger.error(f"Error verifying signature: {str(e)}")
        return False

# apis/promotions.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime
from bson import ObjectId
import logging
from utils.web3mongo import db
from utils.auth.session import verify_session
from config.promotions.models import PromotionCreate, make_json_serializable
from apis.roles import get_company_role_level
import os
from pydantic import ValidationError
from zoneinfo import ZoneInfo

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))
chile_tz = ZoneInfo("America/Santiago")

def make_json_serializable(obj):
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(i) for i in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, time):
        return obj.strftime("%H:%M:%S")
    elif isinstance(obj, Decimal):
        return str(obj)  # Convert Decimal to string to preserve precision
    elif isinstance(obj, Enum):
        return obj.value
    else:
        return obj

@router.post("/promotions/create")
async def create_promotion(promotion: PromotionCreate, user: dict = Depends(verify_session)):
    try:
        wallet = user["wallet"].lower()
        promotion = PromotionCreate.validate_create(promotion, wallet)
        promotion_data = promotion.dict()
        promotion_data["company_id"] = COMPANY_ID
        promotion_data["created_at"] = datetime.now(chile_tz)
        promotion_data["created_by"] = wallet
        promotion_data["current_claims"] = 0
        promotion_data["status"] = True
        promotion_data = make_json_serializable(promotion_data)
        try:
            result = db.promotions.insert_one(promotion_data)
        except Exception as e:
            logger.error(f"MongoDB error inserting promotion: {str(e)}")
            raise HTTPException(status_code=422, detail=f"MongoDB error: {str(e)}")
        promotion_data["id"] = str(result.inserted_id)
        return make_json_serializable(promotion_data)
    except ValidationError as e:
        logger.error(f"Validation error creating promotion: {e}")
        error_details = [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in e.errors()]
        raise HTTPException(status_code=422, detail={"errors": error_details})
    except ValueError as e:
        logger.error(f"Validation error creating promotion: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating promotion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating promotion: {str(e)}")

@router.put("/promotions/update/{promotion_id}")
async def update_promotion(promotion_id: str, promotion: PromotionCreate, user: dict = Depends(verify_session)):
    try:
        wallet = user["wallet"].lower()
        promotion = PromotionCreate.validate_create(promotion, wallet)
        promotion_data = promotion.dict()
        existing_promotion = db.promotions.find_one({"_id": ObjectId(promotion_id)})
        if not existing_promotion:
            raise HTTPException(status_code=404, detail="Promotion not found")
        promotion_data["company_id"] = COMPANY_ID
        promotion_data["updated_at"] = datetime.now(chile_tz)
        promotion_data["updated_by"] = wallet
        promotion_data["created_at"] = existing_promotion["created_at"]
        promotion_data["created_by"] = existing_promotion["created_by"]
        promotion_data["current_claims"] = existing_promotion["current_claims"]
        promotion_data = make_json_serializable(promotion_data)
        result = db.promotions.update_one(
            {"_id": ObjectId(promotion_id)},
            {"$set": promotion_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Promotion not found")
        promotion_data["id"] = promotion_id
        return make_json_serializable(promotion_data)
    except ValueError as e:
        logger.error(f"Validation error updating promotion {promotion_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating promotion {promotion_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating promotion: {str(e)}")

@router.get("/promotions/all")
async def get_all_promotions(
    page: int = 1,
    limit: int = 20,
    query: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    try:
        wallet = user["wallet"].lower()
        role_level = get_company_role_level(wallet)
        if role_level not in [3, 4, 5]:
            raise HTTPException(status_code=403, detail="Insufficient role level (must be 3 or 4)")
        q = {"company_id": COMPANY_ID}
        if query:
            q["name"] = {"$regex": query, "$options": "i"}
        if status == "active":
            q["status"] = True
        elif status == "inactive":
            q["status"] = False
        if start_date:
            try:
                q.setdefault("created_at", {})["$gte"] = datetime.fromisoformat(start_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date + "T23:59:59")
                q.setdefault("created_at", {})["$lte"] = end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        total = db.promotions.count_documents(q)
        promos = list(db.promotions.find(q).sort("created_at", -1).skip((page - 1) * limit).limit(limit))
        for p in promos:
            p["id"] = str(p["_id"])
            del p["_id"]
        return {"promotions": [make_json_serializable(p) for p in promos], "total": total}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching all promotions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching all promotions: {str(e)}")

@router.post("/promotions/coupon/reactivate")
async def reactivate_coupon(request: ReactivateCouponRequest, user: dict = Depends(verify_session)):
    try:
        wallet = user["wallet"].lower()
        coupon_code = request.coupon_code
        role_level = get_company_role_level(wallet)
        if role_level not in [3, 4, 5]:
            raise HTTPException(status_code=403, detail="Insufficient role level (must be 3 or 4)")
        coupon = db.promotion_claims.find_one({"codigo": coupon_code})
        if not coupon:
            raise HTTPException(status_code=404, detail=f"Coupon {coupon_code} not found")
        if not coupon.get("redeemed_at"):
            raise HTTPException(status_code=400, detail="Coupon is not redeemed")
        result = db.promotion_claims.update_one(
            {"codigo": coupon_code},
            {
                "$unset": {
                    "redeemed_at": "",
                    "response_data": "",
                    "pos_order_id": "",
                    "request_data": "",
                    "redeemed_by": "",
                    "validlocal": "",
                    "validdata": "",
                    "sku": "",
                    "tipo": ""
                },
                "$set": {
                    "reactivated_at": datetime.now(chile_tz),
                    "reactivated_by": wallet
                }
            }
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Coupon not found")
        db.promotion_coupons_history.insert_one({
            "coupon_id": str(coupon["_id"]),
            "action": "reactivated",
            "timestamp": datetime.now(chile_tz),
            "promotion_id": coupon["promotion_id"],
            "wallet": coupon["wallet"],
            "customer_id": coupon["wallet"],
            "admin_wallet": wallet,
            "reactivation_id": str(ObjectId())  # Unique identifier for reactivation
        })
        return {
            "success": True,
            "message": f"Coupon {coupon_code} reactivated successfully"
        }
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error reactivating coupon {coupon_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reactivating coupon: {str(e)}")

@router.get("/promotions/coupons")
async def get_coupons(
    page: int = 1,
    limit: int = 20,
    wallet: Optional[str] = None,
    promotion: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(verify_session)
):
    def parse_and_convert_datetime(dt_val):
        """
        Robustly parse a datetime or string, convert to chile_tz, and return ISO string. Return None if not parseable.
        """
        if not dt_val:
            return None
        try:
            if hasattr(dt_val, "astimezone"):
                return dt_val.astimezone(chile_tz).isoformat()
            if isinstance(dt_val, str):
                from dateutil import parser
                dt = parser.isoparse(dt_val)
                return dt.astimezone(chile_tz).isoformat()
        except Exception as e:
            logger.warning(f"Could not parse datetime value '{dt_val}': {e}")
            return None
        return None

    try:
        admin_wallet = user["wallet"].lower()
        role_level = get_company_role_level(admin_wallet)
        if role_level not in [3, 4, 5]:
            raise HTTPException(status_code=403, detail="Insufficient role level (must be 3 or 4)")
        
        q = {"company_id": COMPANY_ID}
        if wallet:
            q["wallet"] = {"$regex": wallet, "$options": "i"}
        if promotion:
            q["promotion.name"] = {"$regex": promotion, "$options": "i"}
        if start_date:
            try:
                q.setdefault("timestamp", {})["$gte"] = datetime.fromisoformat(start_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date + "T23:59:59")
                q.setdefault("timestamp", {})["$lte"] = end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        if status:
            # Note: status is derived, so we need to adjust query based on logic
            if status == "claimed":
                q["redeemed_at"] = {"$exists": False}
            elif status == "redeemed":
                q["redeemed_at"] = {"$exists": True}
            elif status == "reactivated":
                q["history.action"] = "reactivated"  # This might need $elemMatch

        total = db.promotion_claims.count_documents(q)
        coupons = list(db.promotion_claims.find(q).sort("timestamp", -1).skip((page - 1) * limit).limit(limit))
        
        result = []
        for coupon in coupons:
            customer = db.customers.find_one({"$or": [{"customer_id": coupon["customer_id"]}, {"wallet": coupon["wallet"]}]})
            customer_data = {
                "customer_id": customer.get("customer_id", ""),
                "email": customer.get("email", ""),
                "rut_num": customer.get("rut_num", ""),
                "full_name": customer.get("full_name", ""),
                "wallet": customer.get("wallet", ""),
            } if customer else {}
            promotion = db.promotions.find_one({"_id": ObjectId(coupon["promotion_id"])})
            promotion_data = make_json_serializable(promotion) if promotion else {}
            history = list(db.promotion_coupons_history.find({"coupon_id": str(coupon["_id"])}).sort("timestamp", -1))
            history_data = [
                {
                    "action": h.get("action", ""),
                    "discount_amount": h.get("discount_amount", 0),
                    "timestamp": parse_and_convert_datetime(h.get("timestamp")),

                    "admin_wallet": h.get("admin_wallet", ""),
                } for h in history
            ]
            status = "claimed"
            if coupon.get("redeemed_at"):
                status = "redeemed"
            elif any(h["action"] == "reactivated" for h in history):
                status = "reactivated"
            coupon_data = {
                "coupon_code": coupon["codigo"],
                "promotion_id": coupon["promotion_id"],
                "status": status,
                "wallet": coupon["wallet"],
                "customer_id": coupon["customer_id"],
                "timestamp": parse_and_convert_datetime(coupon.get("timestamp")),

                "valid_from": parse_and_convert_datetime(coupon.get("valid_from")),

                "valid_until": parse_and_convert_datetime(coupon.get("valid_until")),

                "points_used": convert_from_base_units(
                    coupon.get("points_used", 0),
                    get_token_decimals(coupon["points_token_address"]) if coupon.get("points_token_address") and coupon.get("points_token_address") not in (None, "", "0x0") else 18
                ) if coupon.get("points_used") else 0,
                "points_token_address": coupon.get("points_token_address", ""),
                "redeemed_at": parse_and_convert_datetime(coupon.get("redeemed_at")),

                "pos_order_id": coupon.get("pos_order_id", ""),
                "request_data": coupon.get("request_data", {}),
                "response_data": coupon.get("response_data", {}),
                "customer": customer_data,
                "promotion": promotion_data,
                "history": history_data,
            }
            result.append(coupon_data)
        return {"coupons": result, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching coupons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching coupons: {str(e)}")

from pydantic import BaseModel
class RedeemCouponAdminRequest(BaseModel):
    coupon_code: str

@router.post("/promotions/coupon/redeem")
async def admin_redeem_coupon(request: RedeemCouponAdminRequest, user: dict = Depends(verify_session)):
    try:
        wallet = user["wallet"].lower()
        coupon_code = request.coupon_code
        role_level = get_company_role_level(wallet)
        if role_level not in [3, 4, 5]:
            raise HTTPException(status_code=403, detail="Insufficient role level (must be 3 or 4)")
        coupon = db.promotion_claims.find_one({"codigo": coupon_code})
        if not coupon:
            raise HTTPException(status_code=404, detail=f"Coupon {coupon_code} not found")
        if coupon.get("redeemed_at"):
            raise HTTPException(status_code=400, detail="Coupon is already redeemed")
            
        now_chile = datetime.now(chile_tz)
        result = db.promotion_claims.update_one(
            {"codigo": coupon_code},
            {
                "$set": {
                    "redeemed_at": now_chile,
                    "redeemed_by": wallet,
                    "pos_order_id": "MANUAL_ADMIN_REDEEM"
                }
            }
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Coupon not found")
            
        db.promotion_coupons_history.insert_one({
            "coupon_id": str(coupon["_id"]),
            "action": "redeemed",
            "timestamp": now_chile,
            "promotion_id": coupon["promotion_id"],
            "wallet": coupon["wallet"],
            "admin_wallet": wallet,
            "discount_amount": 0,
            "pos_order_id": "MANUAL_ADMIN_REDEEM"
        })
        return {
            "success": True,
            "message": f"Coupon {coupon_code} redeemed successfully"
        }
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error redeeming coupon {coupon_code} manually: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error redeeming coupon: {str(e)}")