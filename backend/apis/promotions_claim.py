from fastapi import APIRouter, HTTPException, Depends, Request, Header
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging
from utils.web3mongo import db, w3, redemption_contract
from utils.auth.session import verify_session
from eth_account.messages import encode_defunct
from config.promotions.claim_rules import ClaimRequest, update_user_burn_summary
from config.promotions.models import make_json_serializable, generate_coupon_code, RuleType, BaseModel
from config.promotions.claim_rules import get_token_decimals, convert_to_base_units, convert_from_base_units, validate_claim_rules
from config.promotions.display_rules import validate_display_rules
import os
from dateutil.parser import isoparse
from zoneinfo import ZoneInfo
from apis.fiat import get_platform_tokens
from dateutil import parser
from fastapi import Query
from bson.decimal128 import Decimal128
from decimal import Decimal
from utils.time_utils import get_chile_time
from apis.mi_ficha.mi_meritos import (
    get_rule_templates,
    get_rule_evaluators,
    get_rule_progress_evaluators,
    LINKS,
    RULES_COLL,
)

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

class BurnRequest(BaseModel):
    promotion_id: str
    wallet: str
    signature: str
    plain_data: str

def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    try:
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        return recovered.lower() == wallet.lower()
    except Exception as e:
        logger.error(f"Error verifying signature: {str(e)}")
        return False

async def optional_verify_session(request: Request):
    authorization = request.headers.get("authorization")
    cookie_token = request.cookies.get("privy_token")
    if not authorization and not cookie_token:
        return None
    return await verify_session(request)

@router.post("/promotions/burn")
async def burn_for_promotion(request: BurnRequest, user: dict = Depends(verify_session)):
    try:
        if user["wallet"].lower() != request.wallet.lower():
            raise HTTPException(status_code=403, detail="Wallet does not match session")
        wallet = w3.to_checksum_address(request.wallet)
        promotion = db.promotions.find_one({"_id": ObjectId(request.promotion_id)})
        if not promotion:
            raise HTTPException(status_code=404, detail="Promotion not found")
        burn_rule = next((rule for rule in promotion["rules"] if rule["rule_type"] == RuleType.BURN_TOKENS), None)
        if not burn_rule:
            raise HTTPException(status_code=400, detail="No burn rule for this promotion")
        token_address = burn_rule["token_address"]
        decimals = get_token_decimals(token_address)
        required_amount = convert_to_base_units(burn_rule["amount"], decimals)
        burned_amount = redemption_contract.functions.totalBurnedByUserCompanyToken(
            wallet, COMPANY_ID, token_address
        ).call()
        amount_to_burn = max(0, required_amount - burned_amount)
        if amount_to_burn == 0:
            raise HTTPException(status_code=400, detail="Already burned enough for this promotion")
        token_contract = w3.eth.contract(address=token_address, abi=ERC20_ABI)
        balance = token_contract.functions.balanceOf(wallet).call()
        if balance < amount_to_burn:
            raise HTTPException(status_code=400, detail="Insufficient token balance for burn")
        allowance = token_contract.functions.allowance(wallet, redemption_contract.address).call()
        if allowance < amount_to_burn:
            raise HTTPException(status_code=400, detail="Insufficient allowance for burn")
        nonce = w3.eth.get_transaction_count(wallet)
        tx = redemption_contract.functions.burnTokens(
            COMPANY_ID,
            token_address,
            amount_to_burn,
            f"Burn for promotion {promotion['name']} ID: {str(promotion['_id'])}"
        ).build_transaction({
            "from": wallet,
            "nonce": nonce,
            "gas": 500000,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        })
        burn_tx = {
            "from": tx["from"],
            "to": tx["to"],
            "data": tx["data"],
            "nonce": tx["nonce"],
            "gas": hex(tx["gas"]),
            "gasPrice": hex(tx["gasPrice"]),
            "chainId": tx["chainId"]
        }
        # Actualizar resumen de quema igual que en claim
        summary = update_user_burn_summary(wallet, token_address)
        return {
            "success": True,
            "message": "Burn transaction constructed. Sign and send from your wallet.",
            "tx": burn_tx,
            "amount_burned": convert_from_base_units(amount_to_burn, decimals),
            "burn_summary": summary
        }
    except ValueError as e:
        logger.error(f"Validation error burning for promotion: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing burn for promotion {request.promotion_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing burn: {str(e)}")

@router.post("/promotions/claim")
async def claim_promotion(request: ClaimRequest, user: dict = Depends(verify_session)):
    now = datetime.now(chile_tz)
    try:
        if user["wallet"].lower() != request.wallet.lower():
            raise HTTPException(status_code=403, detail="Wallet does not match session")
        wallet = w3.to_checksum_address(request.wallet)
        promotion = db.promotions.find_one({"_id": ObjectId(request.promotion_id)})
        customer = None
        is_valid, error = validate_claim_rules(request.model_dump(), promotion, customer, now)
        if not is_valid:
            raise ValueError(error)
        burn_rule = next((rule for rule in promotion["rules"] if rule["rule_type"] == RuleType.BURN_TOKENS), None)
        points_used = 0
        token_address = None
        burn_tx = None
        if burn_rule:
            token_address = burn_rule["token_address"]
            decimals = get_token_decimals(token_address)
            required = burn_rule["amount"]
            # Usar la tabla resumen para burns
            def to_int(val):
                if isinstance(val, Decimal128):
                    return int(val.to_decimal())
                return int(val)
            summary = update_user_burn_summary(wallet, token_address)
            saldo = to_int(summary["saldo"])
            required_int = to_int(required)
            if saldo < required_int:
                raise ValueError(f"Insufficient burned tokens. Please burn required amount first. Saldo: {saldo}, Required: {required_int}")
            points_used = required_int

        coupon_validity = promotion["coupon_validity"]
        validity_data = {
            "validity": coupon_validity["validity"],
            "valid_from": coupon_validity.get("valid_from"),
            "valid_until": coupon_validity.get("valid_until"),
            "recurring_every": coupon_validity.get("recurring_every"),
            "recurring_from_time": coupon_validity.get("recurring_from_time"),
            "recurring_to_time": coupon_validity.get("recurring_to_time"),
            "birthday_valid_days": coupon_validity.get("birthday_valid_days")
        }

        coupon_code = generate_coupon_code()
        claim_data = {
            "promotion_id": request.promotion_id,
            "wallet": wallet.lower(),
            "customer_id": None,
            "codigo": coupon_code,
            "timestamp": now,
            "points_used": Decimal128(str(points_used)) if points_used else Decimal128('0'),
            "points_token_address": token_address,
            "company_id": COMPANY_ID,
            **validity_data
        }
        if request.menu_item_sku:
            claim_data["menu_item_sku"] = request.menu_item_sku
        db.promotion_claims.insert_one(claim_data)
        db.promotions.update_one(
            {"_id": ObjectId(request.promotion_id)},
            {"$inc": {"current_claims": 1}}
        )
        # Actualizar total_redeemed y saldo en user_burn_summary
        if points_used > 0:
            current_summary = db.user_burn_summary.find_one(
                {"wallet": wallet.lower(), "token_address": token_address, "company_id": COMPANY_ID}
            )
            current_total_redeemed = int(current_summary["total_redeemed"].to_decimal()) if current_summary and "total_redeemed" in current_summary else 0
            current_total_burned = int(current_summary["total_burned"].to_decimal()) if current_summary and "total_burned" in current_summary else 0
            new_total_redeemed = current_total_redeemed + points_used
            new_saldo = current_total_burned - new_total_redeemed
            db.user_burn_summary.update_one(
                {"wallet": wallet.lower(), "token_address": token_address, "company_id": COMPANY_ID},
                {"$set": {
                    "total_redeemed": Decimal128(str(new_total_redeemed)),
                    "saldo": Decimal128(str(new_saldo)),
                    "last_update": datetime.now(chile_tz)
                }},
                upsert=True
            )
        return {
            "success": True,
            "message": "Promotion claimed successfully",
            "coupon_code": coupon_code,
            "points_used": convert_from_base_units(points_used, decimals) if points_used > 0 else 0
        }

    except ValueError as e:
        error_str = str(e)
        logger.error(f"Validation error claiming promotion: {error_str}")
        if "Insufficient burned tokens" in error_str or "Te faltan" in error_str:
            raise HTTPException(status_code=400, detail={"code": "INSUFFICIENT_BURNED_TOKENS", "message": error_str})
        else:
            raise HTTPException(status_code=400, detail=error_str)
    except Exception as e:
        logger.error(f"Error processing promotion claim for wallet {request.wallet}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing promotion claim: {str(e)}")

@router.get("/promotions_claim/active")
async def get_active_promotions(user: Optional[dict] = Depends(optional_verify_session)):
    try:
        wallet_raw = user.get("wallet") if user else None
        wallet = wallet_raw.lower() if isinstance(wallet_raw, str) and wallet_raw else None
        rut = None
        employee_scope = None
        rules_map = {}
        templates_map = {}
        evaluators = {}
        progress_evaluators = {}
        periodo_dash = get_chile_time().strftime("%Y-%m")
        if wallet:
            link = LINKS.find_one({"wallet": wallet})
            if link and link.get("rut"):
                rut = str(link.get("rut"))
                rules_map = {str(r["_id"]): r for r in RULES_COLL.find()}
                templates_map = get_rule_templates()
                evaluators = get_rule_evaluators()
                progress_evaluators = get_rule_progress_evaluators()

                # Derivar scope de empleado (cargo + seccion normalizada) igual que mi_meritos
                emp = db.trabajadores_vpn.find_one({
                    "$or": [
                        {"rut": rut},
                        {"rut": int(rut) if rut.isdigit() else None},
                    ]
                }) or {}
                cargo = (emp.get("cargo") or "").strip()
                emp_section_raw = (
                    emp.get("seccion")
                    or emp.get("Seccion")
                    or emp.get("sección")
                    or emp.get("section")
                    or ""
                )
                if not str(emp_section_raw).strip() and cargo:
                    cargo_doc = db.cargos_intranet.find_one({"cargo": cargo}) or db.cargos_intranet.find_one(
                        {"cargo": {"$regex": f"^{cargo}$", "$options": "i"}}
                    )
                    emp_section_raw = (cargo_doc or {}).get("seccion", "")
                emp_section_norm = str(emp_section_raw).strip().lower()
                employee_scope = {"cargo": cargo, "emp_section_norm": emp_section_norm}
        q = {"company_id": COMPANY_ID, "status": True}
        promos = list(db.promotions.find(q).sort("created_at", -1))
        now = datetime.now(chile_tz)
        active_promos = []
        platform_tokens = (await get_platform_tokens())["all_token_addresses"]
        token_map = {
            addr.lower(): t
            for t in platform_tokens
            if isinstance(t, dict)
            and isinstance(t.get("address"), str)
            and t.get("address")
            for addr in [t.get("address")]
        }
        for p in promos:
            # Patch: Ensure date fields are datetime objects
            for date_field in [
                "display_start", "display_end", "claim_start", "claim_end"
            ]:
                if date_field in p and isinstance(p[date_field], str):
                    try:
                        p[date_field] = isoparse(p[date_field]).replace(tzinfo=chile_tz)
                    except Exception:
                        pass  # Ignore parse errors
            is_valid, _ = validate_display_rules(p, now, employee_scope)
            if is_valid:
                p["id"] = str(p["_id"])
                del p["_id"]
                p["total_claimed"] = p.get("current_claims", 0)
                if wallet:
                    user_claim_query = {"promotion_id": p["id"], "wallet": wallet}
                    p["user_claimed"] = db.promotion_claims.count_documents(user_claim_query)
                else:
                    p["user_claimed"] = 0

                # Add menu items
                if "menu_item_skus" in p and p["menu_item_skus"]:
                    skus = p["menu_item_skus"]
                    menu_items = list(db.menus.find({"codigo": {"$in": skus}}, {"codigo":1, "nombre":1, "descripcion":1, "media_r2":1, "precio":1}))
                    for item in menu_items:
                        if "_id" in item:
                            del item["_id"]
                    p["menu_items"] = menu_items

                # Add token metadata to rules
                for rule in p["rules"]:
                    if rule.get("rule_type") in ["hold_tokens", "burn_tokens"] and "token_address" in rule:
                        addr = rule["token_address"].lower()
                        if addr in token_map:
                            rule["metadata"] = {
                                "symbol": token_map[addr].get("symbol"),
                                "name": token_map[addr].get("name"),
                                "imagePath": token_map[addr].get("imagePath"),
                                "type": token_map[addr].get("type"),
                                "companyId": token_map[addr].get("companyId")
                            }

                if wallet and rut and p.get("rules"):
                    for rule in p["rules"]:
                        if rule.get("rule_type") == "merit_rule_fulfilled":
                            rule_name = rule.get("merit_rule_name")
                            raw_ranking_period = rule.get("ranking_period") or "current"
                            if not rule_name:
                                continue
                            rule_instance = RULES_COLL.find_one({"rule_name": rule_name})
                            if not rule_instance:
                                continue

                            # Determinar periodo según ranking_period (nuevo modelo) y period_mode de la regla
                            params = dict(rule_instance.get("params") or {})
                            period_mode = params.get("period_mode", "month")  # 'month' | 'year'

                            # Normalizar ranking_period (compat con valores antiguos)
                            if raw_ranking_period in ("current_month", "current_year"):
                                ranking_period = "current"
                            elif raw_ranking_period in ("last_month", "last_year"):
                                ranking_period = "last"
                            else:
                                ranking_period = raw_ranking_period

                            now_cl = now.astimezone(chile_tz)
                            year = now_cl.year
                            month = now_cl.month

                            if period_mode == "month":
                                if ranking_period == "current":
                                    periodo_for_rule = f"{year}-{month:02d}"
                                elif ranking_period == "last":
                                    month -= 1
                                    if month == 0:
                                        year -= 1
                                        month = 12
                                    periodo_for_rule = f"{year}-{month:02d}"
                                else:
                                    logger.warning("[PROMOS_ACTIVE] ranking_period inválido en promoción: %s", ranking_period)
                                    continue
                            else:  # period_mode == 'year'
                                if ranking_period == "current":
                                    periodo_for_rule = f"{year}-12"
                                elif ranking_period == "last":
                                    year -= 1
                                    periodo_for_rule = f"{year}-12"
                                else:
                                    logger.warning("[PROMOS_ACTIVE] ranking_period inválido en promoción: %s", ranking_period)
                                    continue

                            # Clonar regla para no mutar la de base
                            rule_for_eval = dict(rule_instance)
                            rule_for_eval["params"] = params

                            template_key = rule_for_eval.get("template_key")
                            status_evaluator = evaluators.get(template_key)
                            current_status = "pending_evaluation"
                            if status_evaluator:
                                try:
                                    winners = set(status_evaluator(db, rule_for_eval, periodo_for_rule))
                                    current_status = "fulfilled" if rut in winners else "not_fulfilled"
                                except Exception as e:
                                    logger.warning(f"Error evaluando regla de ranking '{rule_name}' para {rut}: {e}")
                                    current_status = "evaluation_error"

                            # Progreso: usamos el mismo periodo que para la evaluación
                            # (periodo_for_rule), dejando que el template resuelva
                            # internamente month/year según params.period_mode.
                            progress_data = None
                            progress_evaluator = progress_evaluators.get(template_key)
                            if progress_evaluator:
                                try:
                                    progress_data = progress_evaluator(db, rule_for_eval, rut, periodo_for_rule)
                                except Exception as e:
                                    logger.error(f"Error obteniendo progreso de ranking para '{rule_name}': {e}")
                                    progress_data = {"error": "No se pudo calcular el progreso."}

                            template_details = templates_map.get(template_key, {})
                            rule["merit_progress"] = {
                                "status": current_status,
                                "template_key": template_key,
                                "params": rule_instance.get("params"),
                                "segment_token_id": rule_instance.get("segment_token_id"),
                                "description": template_details.get("description"),
                                "progress": progress_data,
                                "ranking_period": ranking_period,
                                "periodo_dash": periodo_for_rule,
                                "progress_periodo_dash": periodo_for_rule,
                            }

                active_promos.append(p)
        return {"promotions": [make_json_serializable(p) for p in active_promos]}
    except Exception as e:
        logger.error(f"Error fetching active promotions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching active promotions: {str(e)}")

@router.get("/promotions/burned-balance")
async def get_burned_balance(
    wallet: str = Query(..., description="Wallet address del usuario"),
    token_address: str = Query(..., description="Dirección del token de puntos")
):
    def to_int(val):
        if isinstance(val, Decimal128):
            return int(val.to_decimal())
        return int(val)
    wallet = w3.to_checksum_address(wallet)
    decimals = get_token_decimals(token_address)
    summary = update_user_burn_summary(wallet, token_address)
    total_burned = to_int(summary["total_burned"])
    total_redeemed = to_int(summary["total_redeemed"])
    saldo = to_int(summary["saldo"])
    # Convertir a string para evitar notación científica y pérdida de precisión
    def to_str(val):
        return str(val)
    def to_str_decimal(val):
        # Mostrar todos los decimales posibles, sin notación científica
        return format(Decimal(val) / (10 ** decimals), 'f')

    return {
        "wallet": wallet,
        "token_address": token_address,
        "total_burned": to_str(total_burned),
        "total_burned_human": to_str_decimal(total_burned),
        "total_redeemed": to_str(total_redeemed),
        "total_redeemed_human": to_str_decimal(total_redeemed),
        "saldo": to_str(saldo),
        "saldo_human": to_str_decimal(saldo)
    }

@router.get("/promotions/my-coupons")
async def get_my_coupons(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    user: Optional[dict] = Depends(verify_session)
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

    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required for my coupons")
    try:
        wallet_raw = user.get("wallet")
        if not isinstance(wallet_raw, str) or not wallet_raw:
            raise HTTPException(status_code=401, detail="Wallet session required for my coupons")
        wallet = wallet_raw.lower()
        q = {"wallet": wallet}
        if status:
            if status == "claimed":
                q["redeemed_at"] = {"$exists": False}
            elif status == "redeemed":
                q["redeemed_at"] = {"$exists": True}
            # Add more statuses if needed
        
        total = db.promotion_claims.count_documents(q)
        claims = list(db.promotion_claims.find(q).sort("timestamp", -1).skip((page - 1) * limit).limit(limit))
        
        result = []
        for claim in claims:
            promotion = db.promotions.find_one({"_id": ObjectId(claim["promotion_id"])})
            promotion_data = promotion if promotion else {}
            if "_id" in promotion_data:
                promotion_data["id"] = str(promotion_data["_id"])
                del promotion_data["_id"]
            
            menu_item = None
            if "menu_item_sku" in claim and claim["menu_item_sku"]:
                menu_item = db.menus.find_one({"codigo": claim["menu_item_sku"]}, {"codigo":1, "nombre":1, "descripcion":1, "media_r2":1, "precio":1})
                if menu_item and "_id" in menu_item:
                    del menu_item["_id"]
            
            history = list(db.promotion_coupons_history.find({"coupon_id": str(claim["_id"])}).sort("timestamp", -1))
            history_data = [
                {
                    "action": h.get("action", ""),
                    "discount_amount": h.get("discount_amount", 0),
                    "timestamp": parse_and_convert_datetime(h.get("timestamp")),

                    "admin_wallet": h.get("admin_wallet", ""),
                } for h in history
            ]
            
            coupon_status = "claimed"
            if claim.get("redeemed_at"):
                coupon_status = "redeemed"
            elif any(h["action"] == "reactivated" for h in history_data):
                coupon_status = "reactivated"
            
            coupon_data = {
                "coupon_code": claim["codigo"],
                "promotion": promotion_data,
                "status": coupon_status,
                "timestamp": parse_and_convert_datetime(claim.get("timestamp")),
                "redeemed_at": parse_and_convert_datetime(claim.get("redeemed_at")),
                "valid_from": parse_and_convert_datetime(claim.get("valid_from")),
                "valid_until": parse_and_convert_datetime(claim.get("valid_until")),
                "menu_item": menu_item,
                "history": history_data,
            }
            result.append(coupon_data)
        
        return {"coupons": result, "total": total}
    except Exception as e:
        logger.error(f"Error fetching my coupons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching coupons: {str(e)}")