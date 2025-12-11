from datetime import datetime
from typing import List, Dict, Union, Any
from decimal import Decimal
from utils.web3mongo import db, w3, redemption_contract
from zoneinfo import ZoneInfo
import logging
from .models import RuleType
from config.gamification.profile_services import user_profile_summary
import os
from decimal import ROUND_DOWN
from typing import Optional
from pydantic import BaseModel
from bson.decimal128 import Decimal128
from utils.kpis.worker_meritocracy import load_rule_evaluators

logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))
chile_tz = ZoneInfo("America/Santiago")

# Cargamos los evaluadores de reglas de gamificación una sola vez
RULE_EVALUATORS: Dict[str, Any] = load_rule_evaluators()

def get_token_decimals(token_address: str) -> int:
    """Obtains the decimals of an ERC20 token."""
    try:
        token_contract = w3.eth.contract(address=w3.to_checksum_address(token_address), abi=[
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "payable": False,
                "stateMutability": "view",
                "type": "function"
            }
        ])
        return token_contract.functions.decimals().call()
    except Exception as e:
        logger.error(f"Error getting decimals for token {token_address}: {str(e)}")
        return 18

def convert_to_base_units(amount: Union[str, float, Decimal], decimals: int) -> int:
    """Converts a decimal amount to base units."""
    try:
        amount_decimal = Decimal(str(amount))
        factor = Decimal(10) ** decimals
        return int((amount_decimal * factor).to_integral_value(rounding=ROUND_DOWN))
    except Exception as e:
        logger.error(f"Error converting amount {amount} to base units: {str(e)}")
        raise ValueError(f"Invalid amount: {str(e)}")

def convert_from_base_units(amount: int, decimals: int) -> float:
    """Converts a base unit amount to decimal format."""
    try:
        factor = Decimal(10) ** decimals
        return float(Decimal(str(amount)) / factor)
    except Exception as e:
        logger.error(f"Error converting amount {amount} from base units: {str(e)}")
        raise ValueError(f"Invalid amount: {str(e)}")

def validate_token_balance(wallet: str, token_address: str, required_amount: Union[str, float, Decimal]) -> tuple[bool, int, int, int]:
    """
    Valida si el wallet tiene suficiente balance del token, normalizando el amount a base units según los decimales del token.
    La lógica es idéntica a la de swaps/liquidity en fiat.py: siempre se espera amount en decimales humanos.
    """
    try:
        # El amount ya viene en base units (wei), úsalo directo
        required_amount_base = int(required_amount)
        token_contract = w3.eth.contract(address=w3.to_checksum_address(token_address), abi=[
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function",
            }
        ])
        balance = token_contract.functions.balanceOf(w3.to_checksum_address(wallet)).call()
        logger.warning(f"[validate_token_balance] wallet={wallet}, required_amount={required_amount_base}, actual_balance={balance}")
        difference = max(0, required_amount_base - balance)
        is_valid = balance >= required_amount_base
        return is_valid, required_amount_base, balance, difference
    except Exception as e:
        logger.error(f"Error checking token balance for {wallet}: {str(e)}")
        return False, None, None, None

# config/promotions/claim_rules.py
def validate_burned_tokens(wallet: str, token_address: str, required_amount: Union[str, int, float, Decimal]) -> tuple[bool, int, int, int]:
    try:
        # Convert required_amount to integer in base units
        required_amount_base = int(str(required_amount))
        logger.info(f"[validate_burned_tokens] wallet={wallet}, required_amount={required_amount_base}")
        # Sumar burns en Python para evitar overflow de MongoDB
        events = db.redemption_events.find({
            "event": "TokensBurned",
            "args.user": wallet.lower(),
            "args.companyId": COMPANY_ID,
            "args.token": w3.to_checksum_address(token_address)
        })
        mongo_amount = 0
        for idx, e in enumerate(events):
            amt = e.get("args", {}).get("amount")
            logger.info(f"[validate_burned_tokens] Evento #{idx}: {e}")
            logger.info(f"[validate_burned_tokens]   amount type: {type(amt)}, value: {amt}")
            try:
                if amt is not None:
                    mongo_amount += int(str(amt))  # Ensure amount is converted to int
                    logger.info(f"[validate_burned_tokens]   mongo_amount acumulado: {mongo_amount}")
            except Exception as ex:
                logger.error(f"[validate_burned_tokens]   ERROR convirtiendo/sumando amount: {amt} - {ex}")
        logger.info(f"[validate_burned_tokens] mongo_amount FINAL: {mongo_amount}")

        contract_amount = redemption_contract.functions.totalBurnedByUserCompanyToken(
            w3.to_checksum_address(wallet), COMPANY_ID, w3.to_checksum_address(token_address)
        ).call()
        logger.info(f"[validate_burned_tokens] contract_amount: {contract_amount}")
        if mongo_amount != contract_amount:
            db.burn_discrepancy_logs.insert_one({
                "wallet": wallet.lower(),
                "company_id": COMPANY_ID,
                "token_address": token_address,
                "mongo_amount": Decimal128(str(mongo_amount)),
                "contract_amount": Decimal128(str(contract_amount)),
                "timestamp": datetime.now(chile_tz)
            })
            logger.warning(f"Burn discrepancy for wallet {wallet}: MongoDB={mongo_amount}, Contract={contract_amount}")
        # Use contract_amount as source of truth
        burned = contract_amount
        is_valid = burned >= required_amount_base
        difference = max(0, required_amount_base - burned)
        return is_valid, required_amount_base, burned, difference
    except Exception as e:
        logger.error(f"Error checking burned tokens for {wallet}: {str(e)}")
        return False, None, None, None

def get_burned_points_balance(wallet: str, token_address: str) -> float:
    try:
        decimals = get_token_decimals(token_address)
        summary = update_user_burn_summary(wallet, token_address)
        total_burned = summary.get("total_burned")
        if isinstance(total_burned, Decimal128):
            total_burned = int(total_burned.to_decimal())
        else:
            total_burned = 0
        total_points_used_agg = db.promotion_claims.aggregate([
            {
                "$match": {
                    "wallet": wallet.lower(),
                    "points_token_address": w3.to_checksum_address(token_address),
                    "points_used": {"$exists": True}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_points_used": {"$sum": "$points_used"}
                }
            }
        ])
        total_points_used = list(total_points_used_agg)
        points_used = int(total_points_used[0]["total_points_used"].to_decimal()) if total_points_used and "total_points_used" in total_points_used[0] else 0
        points_balance = total_burned - points_used
        return convert_from_base_units(points_balance, decimals)
    except Exception as e:
        logger.error(f"Error calculating burned points balance for {wallet}: {str(e)}")
        return 0.0

def validate_claim_rules(request: Dict, promotion: Dict, customer: Optional[Dict], now: datetime = None) -> tuple[bool, str]:
    """
    Validates claim rules for a promotion.
    Returns (is_valid, error_message).
    """
    if now is None:
        now = datetime.now(chile_tz)

    # Add tzinfo to promotion dates assuming they are in Chile time
    from dateutil.parser import isoparse
    def ensure_datetime(val):
        if isinstance(val, str):
            return isoparse(val)
        return val
    for field in ["claim_start", "claim_end"]:
        if field in promotion:
            promotion[field] = ensure_datetime(promotion[field])
            if promotion[field].tzinfo is None:
                promotion[field] = promotion[field].replace(tzinfo=chile_tz)

    # Validate max claims
    max_claims = promotion.get("max_claims", 0)
    if max_claims > 0:
        claim_count = db.promotion_claims.count_documents({
            "promotion_id": request["promotion_id"],
            "wallet": request["wallet"].lower()
        })
        if claim_count >= max_claims:
            return False, "Maximum claims reached for this customer"

    # Validate max total coupons
    max_coupon_per_promo = promotion.get("max_coupon_per_promo", 0)
    if max_coupon_per_promo > 0:
        total_claims = db.promotion_claims.count_documents({
            "promotion_id": request["promotion_id"]
        })
        if total_claims >= max_coupon_per_promo:
            return False, "Maximum coupons reached for this promotion"

    # Validate date range
    if not (promotion["claim_start"] <= now <= promotion["claim_end"]):
        return False, "Promotion not valid for current date"

    # Validate recurring days
    recurring_days = promotion.get("claim_recurring_every", [])
    if recurring_days and now.strftime("%A").lower() not in recurring_days:
        return False, f"Promotion not valid on {now.strftime('%A').lower()}"

    # Validate time ranges
    if promotion.get("claim_from_time") and promotion.get("claim_to_time"):
        try:
            current_time = now.time()
            start_time = datetime.strptime(promotion["claim_from_time"], "%H:%M:%S").time()
            end_time = datetime.strptime(promotion["claim_to_time"], "%H:%M:%S").time()
            if not (start_time <= current_time <= end_time):
                return False, f"Promotion not valid at current time: {current_time}"
        except ValueError:
            return False, "Invalid claim_from_time or claim_to_time format"

    # Validate excluded dates
    excluded_dates = promotion.get("claim_excluded_dates", [])
    if excluded_dates:
        current_date = now.strftime("%Y-%m-%d")
        if current_date in excluded_dates:
            return False, f"Promotion not valid on excluded date: {current_date}"

    # Validate product promotion
    if promotion["promotion_type"] == "P":
        if not request.get("menu_item_sku"):
            return False, "menu_item_sku is required to claim a product promotion"
        if "menu_item_skus" in promotion and request["menu_item_sku"] not in promotion["menu_item_skus"]:
            return False, "Selected SKU is not valid for this promotion"

    # Validate business rules
    errors = []
    user_profile = None
    for rule in promotion.get("rules", []):
        rule_type = rule["rule_type"]
        logger.info(f"Validating rule: {rule_type}")

        # Only query user_profile from DB if any rule type needs it and not already loaded
        if user_profile is None and rule_type in [
            RuleType.BIRTHDAY,
            RuleType.REQUIRE_PUBLIC_PROFILE,
            RuleType.REQUIRE_SUBSCRIBE_NEWS,
            RuleType.REQUIRE_BIRTHDATE,
            RuleType.REQUIRE_FAVORITE_LOCATION,
            RuleType.REQUIRE_MIN_LIKED_PRODUCTS
        ]:
            user_profile = db.user_profiles.find_one({"wallet": request["wallet"].lower()})

        if rule_type == RuleType.HOLD_TOKENS:
            logger.info(f"Validating hold tokens for {request['wallet']}: {rule['amount']}")
            is_valid, required, hold, difference = validate_token_balance(request["wallet"], rule["token_address"], rule["amount"])
            if not is_valid:
                errors.append(
                    f"Insufficient token balance. Required: {required}, Held: {hold}, Difference: {difference}"
                )
        elif rule_type == RuleType.BURN_TOKENS:
            is_valid, required, burned, difference = validate_burned_tokens(request["wallet"], rule["token_address"], rule["amount"])
            if not is_valid:
                decimals = get_token_decimals(rule["token_address"])
                required_int = robust_to_int(required)
                burned_int = robust_to_int(burned)
                diff_int = required_int - burned_int
                if burned_int < required_int:
                    errors.append(
                        f"Te faltan {diff_int} tokens por quemar para reclamar esta promoción. Requiere: {required_int}, quemados: {burned_int}"
                    )
        elif rule_type == RuleType.MERIT_MIN_WALLET:
            try:
                segment_token_id = rule.get("segment_token_id")
                required_points = int(str(rule["amount"]))
                if segment_token_id is None:
                    raise ValueError("segment_token_id is required for MERIT_MIN_WALLET rule")

                profile = user_profile_summary(request["wallet"])
                segments = profile.get("segments", [])
                balance = 0
                for seg in segments:
                    if seg.get("token_id") == segment_token_id:
                        balance = int(seg.get("balance", 0))
                        break

                logger.info(
                    f"[MERIT_MIN_WALLET] wallet={request['wallet']}, segment_token_id={segment_token_id}, "
                    f"required_points={required_points}, balance={balance}"
                )
                if balance < required_points:
                    diff = required_points - balance
                    errors.append(
                        f"Te faltan {diff} puntos de mérito para reclamar esta promoción."
                    )
            except Exception as e:
                logger.error(f"Error validating MERIT_MIN_WALLET rule for wallet {request['wallet']}: {e}")
                errors.append("No se pudo validar tu saldo de puntos de mérito para esta promoción.")
        elif rule_type == RuleType.MERIT_RULE_FULFILLED:
            try:
                merit_rule_name = rule.get("merit_rule_name")
                # Nuevo modelo: solo 'current' o 'last'. Mantenemos compat con
                # valores antiguos (current_month, last_month, current_year, last_year)
                raw_ranking_period = rule.get("ranking_period") or "current"

                if not merit_rule_name:
                    errors.append("Falta configurar 'merit_rule_name' en la regla de la promoción.")
                    continue

                # 1) Resolver RUT del empleado desde la wallet (mismo vínculo que gamificación)
                link = db.empleados_usuarios.find_one({"wallet": request["wallet"].lower()})
                if not link or not link.get("rut"):
                    errors.append("No se encontró ficha de empleado asociada a tu wallet para validar el ranking.")
                    continue

                rut = str(link["rut"]).strip()
                if not rut:
                    errors.append("No se pudo resolver tu RUT para validar el ranking.")
                    continue

                # 2) Buscar la regla de gamificación por nombre
                gam_rule = db.gamification_meritocracy_rules.find_one({"rule_name": merit_rule_name})
                if not gam_rule:
                    logger.error("[MERIT_RULE_FULFILLED] Regla de gamificación '%s' no encontrada", merit_rule_name)
                    errors.append("Configuración de ranking inválida para esta promoción.")
                    continue

                template_key = gam_rule.get("template_key")
                evaluator = RULE_EVALUATORS.get(template_key)
                if not evaluator:
                    logger.error(
                        "[MERIT_RULE_FULFILLED] No se encontró evaluator para template_key=%s (rule_name=%s)",
                        template_key,
                        merit_rule_name,
                    )
                    errors.append("No se pudo evaluar la regla de ranking configurada para esta promoción.")
                    continue

                # 3) Determinar período a evaluar según ranking_period y period_mode de la regla
                params = gam_rule.get("params") or {}
                period_mode = params.get("period_mode", "month")  # 'month' | 'year'

                # Normalizar ranking_period
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
                        periodo_dash = f"{year}-{month:02d}"
                    elif ranking_period == "last":
                        month -= 1
                        if month == 0:
                            year -= 1
                            month = 12
                        periodo_dash = f"{year}-{month:02d}"
                    else:
                        errors.append("ranking_period inválido en la configuración de la promoción.")
                        continue
                else:  # period_mode == 'year'
                    if ranking_period == "current":
                        periodo_dash = f"{year}-12"
                    elif ranking_period == "last":
                        year -= 1
                        periodo_dash = f"{year}-12"
                    else:
                        errors.append("ranking_period inválido en la configuración de la promoción.")
                        continue

                # 4) Ejecutar evaluación en caliente sobre las colecciones de KPIs
                rule_eval: Dict[str, Any] = dict(gam_rule)
                winners = evaluator(db, rule_eval, periodo_dash) or []

                logger.info(
                    "[MERIT_RULE_FULFILLED] wallet=%s rut=%s rule_name=%s template_key=%s periodo=%s winners=%d",
                    request["wallet"],
                    rut,
                    merit_rule_name,
                    template_key,
                    periodo_dash,
                    len(winners),
                )

                if str(rut) not in set(str(r) for r in winners):
                    errors.append("No cumpliste la regla de ranking requerida para esta promoción.")
            except Exception as e:
                logger.error(
                    "Error validating MERIT_RULE_FULFILLED rule for wallet %s: %s",
                    request.get("wallet"),
                    e,
                )
                errors.append("No se pudo validar tu ranking para esta promoción.")
        elif rule_type == RuleType.BIRTHDAY:
            birthdate = user_profile.get("birthdate") if user_profile else None
            if not birthdate:
                errors.append("Birthdate required in user profile to claim this birthday promotion.")
        elif rule_type == RuleType.REQUIRE_PUBLIC_PROFILE:
            if not user_profile or not user_profile.get("public_profile", False):
                errors.append("Public profile required to claim this promotion.")
        elif rule_type == RuleType.REQUIRE_SUBSCRIBE_NEWS:
            email = user_profile.get("email") if user_profile else None
            subscribe_news = user_profile.get("subscribe_news", False) if user_profile else False
            if not email:
                errors.append("A valid email is required in your profile to claim this promotion.")
            elif not subscribe_news:
                errors.append("Newsletter subscription must be active to claim this promotion.")
        elif rule_type == RuleType.REQUIRE_BIRTHDATE:
            if not user_profile or not user_profile.get("birthdate"):
                errors.append("Birthdate required in user profile to claim this promotion.")
        elif rule_type == RuleType.REQUIRE_FAVORITE_LOCATION:
            if not user_profile or not user_profile.get("favorite_location"):
                errors.append("Favorite location required in user profile to claim this promotion.")
        elif rule_type == RuleType.REQUIRE_MIN_LIKED_PRODUCTS:
            min_count = rule.get("min_count", 0)
            liked_products = user_profile.get("liked_products", {}) if user_profile else {}
            liked_count = len([k for k, v in liked_products.items() if v])
            if liked_count < min_count:
                errors.append(
                    f"At least {min_count} liked products required. Current: {liked_count}"
                )

    if errors:
        return False, "; ".join(errors)

    return True, ""

def update_user_burn_summary(wallet: str, token_address: str) -> dict:
    """
    Sincroniza la tabla resumen user_burn_summary con el total burned del contrato,
    calcula saldo y retorna el dict resumen.
    """
    contract_amount = robust_to_int(redemption_contract.functions.totalBurnedByUserCompanyToken(
        w3.to_checksum_address(wallet), COMPANY_ID, w3.to_checksum_address(token_address)
    ).call())
    summary = db.user_burn_summary.find_one({
        "wallet": wallet.lower(),
        "token_address": token_address,
        "company_id": COMPANY_ID,
    }) or {}
    total_redeemed = summary.get("total_redeemed")
    total_redeemed = robust_to_int(total_redeemed) if total_redeemed is not None else 0
    saldo = contract_amount - total_redeemed
    db.user_burn_summary.update_one(
        {"wallet": wallet.lower(), "token_address": token_address, "company_id": COMPANY_ID},
        {"$set": {
            "total_burned": Decimal128(str(contract_amount)),
            "total_redeemed": Decimal128(str(total_redeemed)),
            "saldo": Decimal128(str(saldo)),
            "last_update": datetime.now(chile_tz)
        }},
        upsert=True
    )
    return {
        "total_burned": Decimal128(str(contract_amount)),
        "total_redeemed": Decimal128(str(total_redeemed)),
        "saldo": Decimal128(str(saldo))
    }


def robust_to_int(val):
    from decimal import Decimal
    from bson.decimal128 import Decimal128
    if isinstance(val, Decimal128):
        return int(val.to_decimal())
    if isinstance(val, Decimal):
        return int(val)
    if isinstance(val, str):
        try:
            return int(Decimal(val))
        except Exception:
            return int(val)
    return int(val)

class ClaimRequest(BaseModel):
    promotion_id: str
    wallet: str
    signature: Optional[str] = None
    plain_data: Optional[str] = None
    customer_id: Optional[str] = None
    burn_amount: Optional[float] = None
    menu_item_sku: Optional[str] = None