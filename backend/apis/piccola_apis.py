from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from typing import Dict, Optional, Union
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import secrets
from utils.web3mongo import db, w3, redemption_contract
from eth_account.messages import encode_defunct
from config.promotions.models import RedeemRequest, ValidateCustomerRequest, GenerateApiTokenRequest, PromotionType, make_json_serializable
from config.promotions.redeem_rules import validate_coupon_validity, calculate_discount_price, validate_redeem_rules
from config.promotions.common import is_action_allowed, is_location_allowed
from apis.roles import get_company_role_level
import os
from zoneinfo import ZoneInfo
from utils.auth.session import verify_session

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    token = db.api_tokens.find_one({"token": api_key, "expires_at": {"$gt": datetime.utcnow()}})
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or expired API token")
    return token

def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    try:
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        return recovered.lower() == wallet.lower()
    except Exception as e:
        logger.error(f"Error verifying signature: {str(e)}")
        return False

@router.get("/api-token")
async def get_api_token(user: dict = Depends(verify_session)):
    wallet = user.get("wallet").lower()
    tokens = list(db.api_tokens.find({"wallet": wallet}).sort("created_at", -1))
    result = []
    for t in tokens:
        result.append({
            "_id": str(t.get("_id")),
            "token": t.get("token"),
            "wallet": t.get("wallet"),
            "created_at": t.get("created_at").isoformat() if t.get("created_at") else None,
            "expires_at": t.get("expires_at").isoformat() if t.get("expires_at") else None
        })
    return result

@router.post("/api-token/generate")
async def generate_api_token(request: GenerateApiTokenRequest, user: dict = Depends(verify_session)):
    try:
        if not verify_signature(request.wallet, request.plain_data, request.signature):
            raise HTTPException(status_code=400, detail="Invalid signature")
        wallet = w3.to_checksum_address(request.wallet)
        company_id = user.get('company_id') if user else os.getenv('COMPANY_ID', 1)
        role_level = get_company_role_level(wallet)
        if role_level not in [3, 4]:
            raise HTTPException(status_code=403, detail="Insufficient role level (must be 3 or 4)")
        from dateutil.relativedelta import relativedelta
        token = secrets.token_hex(32)
        now = datetime.now(ZoneInfo("UTC"))
        duration = getattr(request, "duration", "1m")
        expires_at = None
        if duration == "forever":
            expires_at = None
        elif duration == "6m":
            expires_at = now + relativedelta(months=6)
        elif duration == "1y":
            expires_at = now + relativedelta(years=1)
        else:
            expires_at = now + relativedelta(months=1)
        token_data = {
            "token": token,
            "wallet": wallet.lower(),
            "created_at": now
        }
        if expires_at:
            token_data["expires_at"] = expires_at
        db.api_tokens.insert_one(token_data)
        return {
            "success": True,
            "message": "API token generated successfully",
            "token": token,
            "expires_at": expires_at.isoformat() if expires_at is not None else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating API token for wallet {request.wallet}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating API token: {str(e)}")

@router.post("/promotions/get")
async def get_promotion(request: RedeemRequest, token: dict = Depends(verify_api_key)):
    try:
        coupon = db.promotion_claims.find_one({"codigo": request.codigo})
        if not coupon:
            return {"status": "INACTIVO", "message": f"Coupon {request.codigo} not found"}
        
        promotion = db.promotions.find_one({"_id": ObjectId(coupon["promotion_id"])})
        if not promotion:
            return {"status": "INACTIVO", "message": f"Promotion for coupon {request.codigo} not found"}
        
        customer = db.customers.find_one({"wallet": coupon["wallet"].lower()})
        if not customer:
            customer = {
                "wallet": coupon["wallet"],
                "email": None,
                "rut_num": None,
                "full_name": None,
                "customer_id": None
            }
        
        location = db.locations.find_one({"permalink_slug": request.validlocal})
        
        # Validar que el tipo del request coincida con el de la promoción
        if request.tipo != promotion["promotion_type"]:
            logger.warning(f"Tipo mismatch: request.tipo={request.tipo}, promotion_type={promotion['promotion_type']}")
            return {"status": "INACTIVO", "message": f"Tipo de promoción inválido para este cupón (se esperaba '{promotion['promotion_type']}')"}
        is_valid, error = validate_redeem_rules(request.model_dump(), coupon, promotion, customer, location)
        if not is_valid:
            return {"status": "INACTIVO", "message": error}
        
        if request.tipo == PromotionType.PRODUCT:
            status = "ACTIVA"
        else:
            status = "OK"
        
        customer_identifier = customer.get("email") or customer["wallet"]
        
        response_data = {}
        if request.tipo == PromotionType.PRODUCT:
            coupon_sku = str(coupon.get("menu_item_sku", "")).strip()
            if not coupon_sku:
                raise HTTPException(status_code=400, detail="No SKU associated with this coupon")
            menu_item = db.menus.find_one({"codigo": coupon_sku})
            if not menu_item:
                raise HTTPException(status_code=400, detail=f"Menu item {coupon_sku} not found")
            price = menu_item["precio"]
            discount_price = calculate_discount_price(price, promotion)
            response_data = {
                "status": status,
                "message": "ACTIVO",
                "customer_id": 0,
                "customer": customer["wallet"],
                "rut_num": "",
                "customer_name": "",
                "description": promotion["description"],
                "valid_from": coupon["valid_from"].isoformat() if coupon.get("valid_from") else "",
                "valid_until": coupon["valid_until"].isoformat() if coupon.get("valid_until") else "",
                "redeemed_at": coupon.get("redeemed_at", "").isoformat() if coupon.get("redeemed_at") else "",
                "request_data": coupon.get("request_data", {}),
                "item": {
                    "sku": menu_item["codigo"],
                    "name": menu_item["nombre"],
                    "description": menu_item["descripcion"],
                    "price": price,
                    "discount_price": discount_price
                }
            }
        else:
            menu_item_name = None
            if "menu_item_sku" in coupon:
                menu_item = db.menus.find_one({"codigo": coupon["menu_item_sku"]})
                if menu_item:
                    menu_item_name = menu_item["nombre"]
            
            discount_type = promotion["reward_details"].get("type", "percentage")
            descto = promotion["reward_details"].get("discount", 0)
            if discount_type == "percentage":
                discount_type = "percent"
                descto = int(descto)
            elif discount_type == "fixed":
                discount_type = "fixed"
                descto = int(descto)
            else:
                descto = int(descto)

            response_data = {
                "status": status,
                "message": "ACTIVO",
                "discount_type": discount_type,
                "descto": descto,
                "cupon": coupon["codigo"],
                "customer": customer["wallet"],
                "rut_num": "",
                "customer_name": "",
                "customer_id": 0,
                "menu_item_name": menu_item_name,
                "description": promotion["description"],
                "valid_from": coupon["valid_from"].isoformat() if coupon.get("valid_from") else "",
                "valid_until": coupon["valid_until"].isoformat() if coupon.get("valid_until") else "",
                "redeemed_at": coupon.get("redeemed_at", "").isoformat() if coupon.get("redeemed_at") else "",
                "request_data": coupon.get("request_data", {}),
                "promotion": make_json_serializable(promotion)
            }
        
        return make_json_serializable(response_data)
    except ValueError as e:
        logger.error(f"Validation error fetching promotion for code {request.codigo}: {str(e)}")
        return {"status": "INACTIVO", "message": str(e)}
    except Exception as e:
        logger.error(f"Error fetching promotion for code {request.codigo}: {str(e)}")
        return {"status": "INACTIVO", "message": str(e)}

@router.post("/promotions/redeem")
async def redeem_promotion(request: RedeemRequest, token: dict = Depends(verify_api_key)):
    try:
        coupon = db.promotion_claims.find_one({"codigo": request.codigo})
        if not coupon:
            return {"status": "INACTIVO", "message": f"Coupon {request.codigo} not found"}
        
        promotion = db.promotions.find_one({"_id": ObjectId(coupon["promotion_id"])})
        if not promotion:
            return {"status": "INACTIVO", "message": f"Promotion for coupon {request.codigo} not found"}
        
        customer = db.customers.find_one({"wallet": coupon["wallet"].lower()})
        if not customer:
            customer = {
                "wallet": coupon["wallet"],
                "email": None,
                "rut_num": None,
                "full_name": None,
                "customer_id": None
            }
        
        location = db.locations.find_one({"permalink_slug": request.validlocal})
        
        # Ensure coupon has validity fields from promotion
        coupon["valid_from"] = coupon.get("valid_from") or promotion["coupon_validity"].get("valid_from")
        coupon["valid_until"] = coupon.get("valid_until") or promotion["coupon_validity"].get("valid_until")
        coupon["validity"] = promotion["coupon_validity"].get("validity")
        coupon["recurring_every"] = promotion["coupon_validity"].get("recurring_every", [])
        coupon["recurring_from_time"] = promotion["coupon_validity"].get("recurring_from_time")
        coupon["recurring_to_time"] = promotion["coupon_validity"].get("recurring_to_time")
        coupon["excluded_dates"] = promotion["coupon_validity"].get("excluded_dates", [])
        
        # Validar que el tipo del request coincida con el de la promoción
        if request.tipo != promotion["promotion_type"]:
            logger.warning(f"Tipo mismatch: request.tipo={request.tipo}, promotion_type={promotion['promotion_type']}")
            return {"status": "INACTIVO", "message": f"Tipo de promoción inválido para este cupón (se esperaba '{promotion['promotion_type']}')"}
        is_valid, error = validate_redeem_rules(request.dict(), coupon, promotion, customer, location)
        if not is_valid:
            return {"status": "INACTIVO", "message": error}
        
        response_data = {}
        discount_amount = 0
        if request.tipo == PromotionType.PRODUCT:
            coupon_sku = str(coupon.get("menu_item_sku", "")).strip()
            if not coupon_sku:
                raise HTTPException(status_code=400, detail="No SKU associated with this coupon")
            menu_item = db.menus.find_one({"codigo": coupon_sku})
            if not menu_item:
                raise HTTPException(status_code=400, detail=f"Menu item {coupon_sku} not found")
            price = menu_item["precio"]
            discount_amount = calculate_discount_price(price, promotion)
            response_data = {
                "status": "ACTIVO",
                "message": "Coupon redeemed",
                "customer_id": 0,
                "customer": coupon["wallet"],
                "rut_num": "",
                "customer_name": "",
                "item": {
                    "sku": menu_item["codigo"],
                    "name": menu_item["nombre"],
                    "description": menu_item["descripcion"],
                    "price": price,
                    "discounted_price": discount_amount,
                }
            }
        else:
            discount_type = promotion["reward_details"].get("type", "percentage")
            descto = promotion["reward_details"].get("discount", 0)
            if discount_type == "percentage":
                discount_type = "percent"
                descto = int(descto)
            elif discount_type == "fixed":
                discount_type = "fixed"
                descto = int(descto)
            else:
                descto = int(descto)

            response_data = {
                "status": "ACTIVO",
                "message": "Coupon redeemed",
                "discount_type": discount_type,
                "descto": descto,
                "cupon": coupon["codigo"],
                "customer_id": 0,
                "customer": coupon["wallet"],
                "rut_num": "",
                "customer_name": "",
                "description": promotion["description"]
            }
        
        db.promotion_claims.update_one(
            {"_id": coupon["_id"]},
            {
                "$set": {
                    "redeemed_at": datetime.now(ZoneInfo("America/Santiago")),
                    "redeemed_by": request.validusuario,
                    "validlocal": request.validlocal,
                    "validdata": request.validdata,
                    "tipo": request.tipo
                }
            }
        )
        db.promotion_coupons_history.insert_one({
            "coupon_id": str(coupon["_id"]),
            "discount_amount": discount_amount,
            "timestamp": datetime.now(ZoneInfo("America/Santiago")),
            "promotion_id": coupon["promotion_id"],
            "wallet": coupon["wallet"],
            "customer_id": 0,
            "location_permalink": request.validlocal,
            "validusuario": request.validusuario,
            "validdata": request.validdata,
            "pos_order_id": request.validdata.get("posorderid", ""),
            "sku": coupon["menu_item_sku"],
            "tipo": request.tipo
        })
        return make_json_serializable(response_data)
    except ValueError as e:
        logger.error(f"Validation error redeeming promotion for code {request.codigo}: {str(e)}")
        return {"status": "INACTIVO", "message": str(e)}
    except Exception as e:
        logger.error(f"Error redeeming promotion for code {request.codigo}: {str(e)}")
        return {"status": "INACTIVO", "message": str(e)}

@router.post("/customers/validate")
async def validate_customer(request: ValidateCustomerRequest, token: dict = Depends(verify_api_key)):
    try:
        customer = db.customers.find_one({
            "$or": [
                {"rut_num": request.customer_id},
                {"wallet": request.customer_id.lower()},
                {"email": request.customer_id}
            ]
        })
        if not customer:
            return {
                "status": "NOEXISTE",
                "message": "Customer not found",
                "customer": None,
                "customer_name": None
            }
        if not customer.get("status", False):
            return {
                "status": "INVALIDO",
                "message": "Customer is not active",
                "customer": None,
                "customer_name": None
            }
        return {
            "status": "OK",
            "customer": customer["customer_id"],
            "customer_name": customer["full_name"],
            "rut_num": customer["rut_num"],
            "wallet": customer["wallet"]
        }
    except Exception as e:
        logger.error(f"Error validating customer {request.customer_id}: {str(e)}")
        return {
            "status": "NOEXISTE",
            "message": str(e),
            "customer": None,
            "customer_name": None
        }