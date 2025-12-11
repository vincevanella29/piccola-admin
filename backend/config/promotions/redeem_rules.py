# promotions/redeem_rules.py
from datetime import datetime
from typing import List, Dict
from utils.web3mongo import db
from zoneinfo import ZoneInfo
import logging
from .models import PromotionType, RuleType
from .claim_rules import validate_token_balance, RULE_EVALUATORS, chile_tz
import os
from datetime import timedelta

logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))

def validate_max_coupons_per_table(promotion: Dict, pos_order_id: str) -> tuple[bool, str]:
    """
    Validates the maximum coupons redeemed per table.
    Returns (is_valid, error_message).
    """
    max_coupon_per_table = promotion.get("max_coupon_per_table", 0)
    if max_coupon_per_table and max_coupon_per_table > 0 and pos_order_id:
        pos_order_count = db.promotion_claims.count_documents({
            "promotion_id": str(promotion["_id"]),
            "pos_order_id": pos_order_id,
            "redeemed_at": {"$exists": True}
        })
        if pos_order_count >= max_coupon_per_table:
            return False, "Maximum number of coupons reached for this table"
    return True, None

def validate_coupon_validity(coupon: Dict, now: datetime = None) -> tuple[bool, str]:
    """
    Validates coupon validity rules.
    Returns (is_valid, error_message).
    """
    if now is None:
        now = datetime.now(ZoneInfo("America/Santiago"))
    validity = coupon.get("validity", "forever")

    # Check excluded dates
    excluded_dates = coupon.get("excluded_dates", [])
    if excluded_dates:
        current_date = now.strftime("%Y-%m-%d")
        if current_date in excluded_dates:
            return False, f"Coupon not valid on excluded date: {current_date}"

    # Apply recurring day and time checks for RECURRING, PERIOD, FOREVER
    if validity in ["recurring", "period", "fixed", "forever"]:
        recurring_days = coupon.get("recurring_every", [])
        if recurring_days and now.strftime("%A").lower() not in recurring_days:
            return False, f"Coupon not valid on {now.strftime('%A').lower()}"
        if coupon.get("recurring_from_time") and coupon.get("recurring_to_time"):
            try:
                current_time = now.time()
                start_time = datetime.strptime(coupon["recurring_from_time"], "%H:%M:%S").time()
                end_time = datetime.strptime(coupon["recurring_to_time"], "%H:%M:%S").time()
                if not (start_time <= current_time <= end_time):
                    return False, f"Coupon not valid at current time: {current_time}"
            except ValueError:
                return False, "Invalid recurring_from_time or recurring_to_time format"

    if validity == "forever":
        return True, ""
    elif validity in ["fixed", "period"]:
        start = coupon["valid_from"]
        end = coupon["valid_until"]
        if not (start <= now <= end):
            return False, "Coupon not valid for current date and time"
        return True, ""
    elif validity == "birthday":
        user_profile = db.user_profiles.find_one({"wallet": coupon["wallet"]})
        birthdate = user_profile.get("birthdate") if user_profile else None
        if not birthdate:
            return False, "Debes ingresar tu fecha de nacimiento en tu perfil para canjear esta promoción de cumpleaños."
        try:
            birthdate_dt = datetime.fromisoformat(birthdate) if isinstance(birthdate, str) else birthdate
            valid_days = int(coupon.get('birthday_valid_days', 7))
            this_year_birthday = birthdate_dt.replace(year=now.year)
            if birthdate_dt.month == 2 and birthdate_dt.day == 29:
                try:
                    this_year_birthday = birthdate_dt.replace(year=now.year)
                except ValueError:
                    this_year_birthday = birthdate_dt.replace(year=now.year, day=28)
            window_start = this_year_birthday - timedelta(days=valid_days)
            window_end = this_year_birthday + timedelta(days=valid_days)
            if not (window_start.date() <= now.date() <= window_end.date()):
                return False, f"La promoción cumpleaños valida desde {window_start.strftime('%d/%m')} al {window_end.strftime('%d/%m')}"
        except Exception as e:
            return False, f"Error interpretando tu fecha de nacimiento: {birthdate} ({e})"
        return True, ""
    return False, "Invalid validity type"

def calculate_discount_price(price: float, promotion: Dict) -> float:
    """Calculates the discounted price for a promotion."""
    discount_type = promotion["reward_details"].get("type", "percentage")
    discount = promotion["reward_details"].get("discount", 0)
    logger.info(f"[calculate_discount_price] discount_type: {discount_type}, discount: {discount}")
    if discount_type == "fixed":
        if discount > price:
            return 0
        return max(0, price - discount)
    else:
        if discount > 100:
            return 0
        return max(0, price * (1 - discount / 100))

def validate_redeem_rules(request: Dict, coupon: Dict, promotion: Dict, customer: Dict, location: Dict, now: datetime = None) -> tuple[bool, str]:
    """
    Validates redeem rules for a promotion.
    Returns (is_valid, error_message).
    """
    import logging
    logger = logging.getLogger("uvicorn.error")
    from datetime import datetime
    if now is None:
        now = datetime.now(ZoneInfo("America/Santiago"))

    def parse_dt(dt):
        if isinstance(dt, str):
            try:
                d = datetime.fromisoformat(dt)
                if d.tzinfo is None:
                    d = d.replace(tzinfo=ZoneInfo("America/Santiago"))
                return d
            except Exception:
                return None
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                return dt.replace(tzinfo=ZoneInfo("America/Santiago"))
        return dt

    # Parchea fechas de coupon
    if coupon:
        if "valid_from" in coupon:
            coupon["valid_from"] = parse_dt(coupon["valid_from"])
        if "valid_until" in coupon:
            coupon["valid_until"] = parse_dt(coupon["valid_until"])
    # Parchea fechas de promotion
    if promotion:
        if "valid_from" in promotion:
            promotion["valid_from"] = parse_dt(promotion["valid_from"])
        if "valid_until" in promotion:
            promotion["valid_until"] = parse_dt(promotion["valid_until"])
        # Si tiene coupon_validity anidado
        if "coupon_validity" in promotion:
            cv = promotion["coupon_validity"]
            if "valid_from" in cv:
                cv["valid_from"] = parse_dt(cv["valid_from"])
            if "valid_until" in cv:
                cv["valid_until"] = parse_dt(cv["valid_until"])

    # Validate existence of data
    if not location:
        return False, f"Location {request['validlocal']} not found"
    if not coupon:
        return False, f"Coupon {request['codigo']} not found"
    if not promotion:
        return False, f"Promotion for coupon {request['codigo']} not found"
    if not customer or customer["wallet"].lower() != coupon["wallet"]:
        return False, "Customer not found or does not match coupon"

    # Validate location
    from .models import applies_to_location
    if not applies_to_location(promotion, request["validlocal"]):
        return False, "Coupon not valid for this location"

    # Validate SKU for product promotions
    coupon_sku = coupon.get("menu_item_sku")
    logger.info(f"[validate_redeem_rules] SKU validation: tipo={request['tipo']}, coupon_sku={coupon_sku}, menu_item_skus={promotion.get('menu_item_skus')}")
    if request["tipo"] == PromotionType.PRODUCT:
        if not promotion.get("menu_item_skus") or str(coupon_sku) not in promotion["menu_item_skus"]:
            logger.warning(f"[validate_redeem_rules] Invalid SKU: {coupon_sku} not in {promotion.get('menu_item_skus')}")
            return False, f"Invalid SKU {coupon_sku} for product promotion"

    # Validate coupon already redeemed
    logger.info(f"[validate_redeem_rules] Coupon redeemed_at: {coupon.get('redeemed_at')}")
    if coupon.get("redeemed_at"):
        logger.warning(f"[validate_redeem_rules] Coupon already redeemed: {coupon.get('codigo')}")
        return False, "Coupon already redeemed"

    # Validate max coupons per table
    pos_order_id = request["validdata"].get("posorderid")
    logger.info(f"[validate_redeem_rules] Validating max coupons per table: pos_order_id={pos_order_id}")
    is_valid_table, error_msg = validate_max_coupons_per_table(promotion, pos_order_id)
    if not is_valid_table:
        logger.warning(f"[validate_redeem_rules] Max coupons per table failed: {error_msg}")
        return False, error_msg

    # Validate coupon validity
    logger.info(f"[validate_redeem_rules] Validating coupon validity for coupon: {coupon.get('codigo')}")
    is_valid, error = validate_coupon_validity(coupon, now)
    if not is_valid:
        logger.warning(f"[validate_redeem_rules] Coupon validity failed: {error}")
        return False, error

    # Validate business rules (IMPORTANTE: acá ya NO revalidamos ranking de méritos;
    # eso se chequea en el flujo de CLAIM. En redeem solo aplican reglas ligadas al
    # contexto de canje, no al ranking histórico.)
    errors = []
    logger.info(f"[validate_redeem_rules] Validating business rules: {promotion.get('rules', [])}")
    for rule in promotion.get("rules", []):
        rule_type = rule["rule_type"]
        logger.info(f"[validate_redeem_rules] Checking rule: {rule}")
        if rule_type == RuleType.BIRTHDAY:
            # Siempre obtener birthdate de user_profiles por wallet
            user_profile = db.user_profiles.find_one({"wallet": request["wallet"].lower()})
            birthdate = user_profile.get("birthdate") if user_profile else None
            logger.info(f"[validate_redeem_rules] BIRTHDAY rule: user_profile.birthdate={birthdate}, now={now}")
            if not birthdate:
                errors.append("Debes ingresar tu fecha de nacimiento en tu perfil para canjear esta promoción de cumpleaños.")
            else:
                try:
                    birthdate_dt = datetime.fromisoformat(birthdate) if isinstance(birthdate, str) else birthdate
                    valid_days = int(rule.get('birthday_valid_days', 7))
                    # Cumpleaños de este año
                    this_year_birthday = birthdate_dt.replace(year=now.year)
                    # Si cumpleaños es 29/2 y no es año bisiesto, usar 28/2
                    if birthdate_dt.month == 2 and birthdate_dt.day == 29:
                        try:
                            this_year_birthday = birthdate_dt.replace(year=now.year)
                        except ValueError:
                            this_year_birthday = birthdate_dt.replace(year=now.year, day=28)
                    window_start = this_year_birthday - timedelta(days=valid_days)
                    window_end = this_year_birthday + timedelta(days=valid_days)
                    if not (window_start.date() <= now.date() <= window_end.date()):
                        errors.append(f"La promoción solo se puede canjear del {window_start.strftime('%d/%m')} al {window_end.strftime('%d/%m')} por tu cumpleaños.")
                except Exception as e:
                    errors.append(f"Error interpretando tu fecha de nacimiento: {birthdate} ({e})")

    if errors:
        logger.warning(f"[validate_redeem_rules] Business rule errors: {errors}")
        return False, "; ".join(errors)

    logger.info(f"[validate_redeem_rules] All validations passed.")
    return True, ""