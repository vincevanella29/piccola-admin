from pydantic import BaseModel, Field, model_validator, ValidationError

class ValidateCustomerRequest(BaseModel):
    customer_id: str = Field(..., description="Customer RUT or email")

class GenerateApiTokenRequest(BaseModel):
    wallet: str = Field(..., description="Wallet address for the API token")
    plain_data: str = Field(..., description="Plain data to be signed for verification")
    signature: str = Field(..., description="Signature of the plain data")
    duration: str = Field(default="1m", description="Token duration: 'forever', '1m', '6m', '1y'")
    # company_id removed (scoping should be inferred from session or wallet)
    # Add more fields as needed, e.g., permissions, expiration, etc.

class RedeemRequest(BaseModel):
    validlocal: str = Field(..., description="Location slug for redemption")
    codigo: str = Field(..., description="Coupon code")
    tipo: str = Field(..., description="Promotion type, e.g. 'P' or 'D'")
    validdata: dict = Field(default_factory=dict, description="Additional validation data, e.g. {'posorderid': str}")
    validusuario: str = Field(..., description="Usuario que canjea el cupón")
    # Optionally, add more fields as needed for compatibility with the redeem flow
    # Example: wallet: Optional[str] = None

    def is_product_type(self) -> bool:
        return self.tipo == 'P'

from typing import List, Dict, Optional, Union
from decimal import Decimal
from datetime import datetime, time
from enum import Enum
from bson import ObjectId
import uuid
import logging
from fastapi import HTTPException
from utils.web3mongo import db
import os
from apis.roles import get_company_role_level
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))

class RuleType(str, Enum):
    HOLD_TOKENS = "hold_tokens"
    BURN_TOKENS = "burn_tokens"
    DATE_RANGE = "date_range"
    WEEKDAY = "weekday"
    TIME_RANGE = "time_range"
    BIRTHDAY = "birthday"
    REQUIRE_PUBLIC_PROFILE = "require_public_profile"
    REQUIRE_SUBSCRIBE_NEWS = "require_subscribe_news"
    REQUIRE_BIRTHDATE = "require_birthdate"
    REQUIRE_FAVORITE_LOCATION = "require_favorite_location"
    REQUIRE_MIN_LIKED_PRODUCTS = "require_min_liked_products"
    MERIT_MIN_WALLET = "merit_min_wallet"
    MERIT_RULE_FULFILLED = "merit_rule_fulfilled"
    REQUIRE_JOB_POSITION = "require_job_position"

class ValidityType(str, Enum):
    FIXED = "fixed"
    PERIOD = "period"
    RECURRING = "recurring"
    FOREVER = "forever"
    BIRTHDAY = "birthday"

class RewardType(str, Enum):
    DISCOUNT = "discount"
    PRODUCT = "product"

class PromotionType(str, Enum):
    PRODUCT = "P"
    DISCOUNT = "D"

class PromotionRule(BaseModel):
    rule_type: RuleType
    token_address: Optional[str] = None
    amount: Optional[Union[str, int]] = Field(None, description="Amount in base units (integer) or raw points for merit rules")
    segment_token_id: Optional[int] = Field(None, description="Segment token id for meritocracy rules (MERIT_MIN_WALLET, MERIT_RULE_FULFILLED)")
    merit_rule_name: Optional[str] = Field(None, description="Nombre de la regla de meritocracia a validar (rule_name en gamification_meritocracy_rules)")
    ranking_period: Optional[str] = Field(
        None,
        description=(
            "Ventana de evaluación para MERIT_RULE_FULFILLED: "
            "current | last (antes: current_month | last_month | current_year | last_year)"
        ),
    )
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    valid_days: Optional[List[str]] = None
    time_ranges: Optional[List[Dict[str, str]]] = None
    min_count: Optional[int] = Field(None, description="Minimum count for rules like require_min_liked_products")
    job_section: Optional[str] = Field(None, description="Required employee section (e.g., 'Cocina', 'Sala')")
    job_position: Optional[str] = Field(None, description="Required employee position/cargo (e.g., 'Garzón', 'Jefe de Cocina')")

    @model_validator(mode="before")
    def preprocess_amount(cls, values):
        logger.warning(f"[PromotionRule.preprocess_amount] raw values: {values}")
        if "amount" in values and values["amount"] is not None:
            try:
                # Convert amount to string and allow decimal strings like "100.0", "100.00"
                amount_str = str(values["amount"]).strip()
                # If it's a decimal string (e.g. "100.0"), convert to int if possible
                if "." in amount_str:
                    float_val = float(amount_str)
                    if not float_val.is_integer() or float_val < 0:
                        raise ValueError(f"Amount must be a non-negative integer: {amount_str}")
                    amount_str = str(int(float_val))
                if not amount_str.isdigit():
                    raise ValueError(f"Amount must be a non-negative integer: {amount_str}")
                values["amount"] = amount_str  # Store as string to preserve precision
            except (ValueError, TypeError) as e:
                raise ValueError(f"Invalid amount format: {values['amount']}. Must be a non-negative integer: {str(e)}")
        return values

    @model_validator(mode="after")
    def validate_rule(self):
        rule_type = self.rule_type
        if rule_type in [RuleType.HOLD_TOKENS, RuleType.BURN_TOKENS]:
            if not self.token_address or self.amount is None:
                raise ValueError("token_address and amount are required for token rules")
            # Ensure amount is a valid integer
            try:
                int(self.amount)
            except ValueError:
                raise ValueError(f"Amount must be a valid integer in base units: {self.amount}")
        elif rule_type == RuleType.MERIT_MIN_WALLET:
            if self.segment_token_id is None or self.amount is None:
                raise ValueError("segment_token_id and amount are required for MERIT_MIN_WALLET rule")
        elif rule_type == RuleType.MERIT_RULE_FULFILLED:
            # Esta regla apunta a una regla de gamificación existente (gamification_meritocracy_rules)
            # y evalúa el ranking directamente sobre los KPIs al momento del claim.
            if not self.merit_rule_name:
                raise ValueError("merit_rule_name is required for MERIT_RULE_FULFILLED rule")
            # Nuevo modelo: solo 'current' o 'last'.
            # Los valores antiguos ya no se usan al crear promos desde el admin.
            allowed_periods = {"current", "last"}
            if self.ranking_period not in allowed_periods:
                raise ValueError(
                    "ranking_period must be one of 'current', 'last' "
                    "for MERIT_RULE_FULFILLED rule"
                )
        elif rule_type == RuleType.DATE_RANGE:
            if not self.start_date or not self.end_date:
                raise ValueError("start_date and end_date are required for date_range rule")
        elif rule_type == RuleType.WEEKDAY:
            if not self.valid_days:
                raise ValueError("valid_days are required for weekday rule")
        elif rule_type == RuleType.TIME_RANGE:
            if not self.time_ranges:
                raise ValueError("time_ranges are required for time_range rule")
        elif rule_type == RuleType.REQUIRE_MIN_LIKED_PRODUCTS:
            if self.min_count is None or self.min_count <= 0:
                raise ValueError("min_count is required and must be positive for require_min_liked_products rule")
        elif rule_type in [
            RuleType.REQUIRE_PUBLIC_PROFILE,
            RuleType.REQUIRE_SUBSCRIBE_NEWS,
            RuleType.REQUIRE_BIRTHDATE,
            RuleType.REQUIRE_FAVORITE_LOCATION,
        ]:
            if self.token_address or self.amount or self.start_date or self.end_date or self.valid_days or self.time_ranges or self.min_count:
                raise ValueError(f"No additional fields allowed for {rule_type} rule")
        return self

class CouponValidity(BaseModel):
    validity: ValidityType
    valid_from: Optional[datetime] = Field(None, description="Required for fixed, period, or birthday")
    valid_until: Optional[datetime] = Field(None, description="Required for fixed, period, or birthday")
    recurring_every: Optional[List[str]] = None
    recurring_from_time: Optional[str] = None
    recurring_to_time: Optional[str] = None
    birthday_valid_days: Optional[int] = None
    excluded_dates: Optional[List[str]] = None

    @model_validator(mode="before")
    def log_raw_input(cls, values):
        logger.warning(f"[CouponValidity.validate_raw] raw values: {values}")
        for field in ["recurring_from_time", "recurring_to_time"]:
            if field in values and values[field] == "":
                values[field] = None
        return values

    @model_validator(mode="after")
    def validate_fields(self):
        logger.warning(f"[CouponValidity.validate_fields] values: {self.dict()}")
        def normalize_time(t):
            if t and len(t) == 5 and ":" in t:
                return t + ":00"
            return t
        self.recurring_from_time = normalize_time(self.recurring_from_time)
        self.recurring_to_time = normalize_time(self.recurring_to_time)

        if self.recurring_from_time or self.recurring_to_time:
            if not (self.recurring_from_time and self.recurring_to_time):
                raise ValueError("Both recurring_from_time and recurring_to_time must be provided if one is specified")
            try:
                datetime.strptime(self.recurring_from_time, "%H:%M:%S")
                datetime.strptime(self.recurring_to_time, "%H:%M:%S")
            except ValueError:
                raise ValueError("recurring_from_time and recurring_to_time must be in HH:MM or HH:MM:SS format")

        valid_days = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
        if self.recurring_every:
            for day in self.recurring_every:
                if day not in valid_days:
                    raise ValueError(f"Invalid day in recurring_every: {day}")

        if self.excluded_dates:
            for date in self.excluded_dates:
                try:
                    datetime.strptime(date, "%Y-%m-%d")
                except ValueError:
                    raise ValueError(f"Invalid date format in excluded_dates: {date}. Must be YYYY-MM-DD")

        if self.validity in [ValidityType.FIXED, ValidityType.PERIOD]:
            if self.valid_from is None or self.valid_until is None:
                raise ValueError(f"valid_from and valid_until are required for {self.validity} validity")
            if self.valid_from >= self.valid_until:
                raise ValueError("valid_from must be before valid_until")

        return self

class PromotionCreate(BaseModel):
    status: Optional[bool] = None
    name: str
    description: str
    reward_type: RewardType
    promotion_type: PromotionType  # Changed from Optional to required
    rules: Optional[List[PromotionRule]] = []
    reward_details: Dict[str, Union[str, float]]
    display_start: datetime
    display_end: datetime
    display_recurring_every: Optional[List[str]] = None
    display_from_time: Optional[str] = None
    display_to_time: Optional[str] = None
    display_excluded_dates: Optional[List[str]] = None
    claim_start: datetime
    claim_end: datetime
    claim_recurring_every: Optional[List[str]] = None
    claim_from_time: Optional[str] = None
    claim_to_time: Optional[str] = None
    claim_excluded_dates: Optional[List[str]] = None
    max_coupon_per_table: Optional[int] = None
    max_coupon_per_promo: Optional[int] = None
    max_claims: int = Field(..., gt=0)
    max_claims_per_day: Optional[int] = Field(None, gt=0, description="Maximum claims per user per day (optional)")
    locations: Optional[List[str]] = []
    menu_item_skus: Optional[List[str]] = []
    coupon_validity: CouponValidity
    is_birthday_coupon: bool = False

    @model_validator(mode="before")
    def log_raw_input(cls, values):
        logger.warning(f"[PromotionCreate.validate_raw] raw values: {values}")
        for field in ["display_from_time", "display_to_time", "claim_from_time", "claim_to_time"]:
            if field in values and values[field] == "":
                values[field] = None
        # Ensure promotion_type is set based on reward_type if not provided
        if "reward_type" in values and "promotion_type" not in values:
            reward_type = values["reward_type"]
            values["promotion_type"] = "P" if reward_type == "product" else "D"
        return values

    @model_validator(mode="after")
    def validate_types_and_promotion_type(self):
        logger.warning(f"[PromotionCreate.validate_types_and_promotion_type] values: {self.dict()}")
        # Enforce consistency between reward_type and promotion_type
        if self.reward_type == RewardType.DISCOUNT and self.promotion_type != PromotionType.DISCOUNT:
            raise ValueError("promotion_type must be 'D' when reward_type is 'discount'")
        if self.reward_type == RewardType.PRODUCT and self.promotion_type != PromotionType.PRODUCT:
            raise ValueError("promotion_type must be 'P' when reward_type is 'product'")
        # Clear menu_item_skus for discount promotions
        if self.reward_type == RewardType.DISCOUNT:
            self.menu_item_skus = []
        return self

    @model_validator(mode="after")
    def validate_dates_and_times(self):
        def normalize_time(t):
            if t and len(t) == 5 and ":" in t:
                return t + ":00"
            return t

        if self.display_start > self.display_end:
            raise ValueError("display_start must be before or equal to display_end")
        if self.claim_start > self.claim_end:
            raise ValueError("claim_start must be before or equal to claim_end")
        if self.claim_start < self.display_start or self.claim_end > self.display_end:
            raise ValueError("claim_start and claim_end must be within display_start and display_end")

        for field, (start, end) in zip(
            [
                "display_from_time/display_to_time",
                "claim_from_time/claim_to_time",
                "coupon_validity.recurring_from_time/recurring_to_time",
            ],
            [
                (self.display_from_time, self.display_to_time),
                (self.claim_from_time, self.claim_to_time),
                (self.coupon_validity.recurring_from_time, self.coupon_validity.recurring_to_time),
            ],
        ):
            if start or end:
                if not (start and end):
                    raise ValueError(f"Both from_time and to_time must be provided if one is specified in {field}")
                start = normalize_time(start)
                end = normalize_time(end)
                if field == "display_from_time/display_to_time":
                    self.display_from_time = start
                    self.display_to_time = end
                elif field == "claim_from_time/claim_to_time":
                    self.claim_from_time = start
                    self.claim_to_time = end
                elif field == "coupon_validity.recurring_from_time/recurring_to_time":
                    if hasattr(self, "coupon_validity") and self.coupon_validity:
                        self.coupon_validity.recurring_from_time = start
                        self.coupon_validity.recurring_to_time = end
                try:
                    datetime.strptime(start, "%H:%M:%S")
                    datetime.strptime(end, "%H:%M:%S")
                except ValueError:
                    raise ValueError(f"from_time and to_time must be in HH:MM or HH:MM:SS format in {field}")

        valid_days = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
        for field, days in [
            ("display_recurring_every", self.display_recurring_every),
            ("claim_recurring_every", self.claim_recurring_every),
            ("coupon_validity.recurring_every", self.coupon_validity.recurring_every),
        ]:
            if days:
                for day in days:
                    if day not in valid_days:
                        raise ValueError(f"Invalid day in {field}: {day}")

        return self

    @model_validator(mode="after")
    def validate_reward(self):
        reward_details = self.reward_details
        menu_item_skus = self.menu_item_skus
        promotion_type = self.promotion_type

        if promotion_type == PromotionType.DISCOUNT:
            if "discount" not in reward_details or "type" not in reward_details:
                raise ValueError("reward_details must contain discount and type for discount promotions")
            if reward_details["type"] not in ["fixed", "percentage"]:
                raise ValueError("discount type must be fixed or percentage")
            discount = reward_details["discount"]
            try:
                discount_value = float(discount)
            except (ValueError, TypeError):
                raise ValueError("discount must be a number")
            if reward_details["type"] == "percentage":
                if not (0 <= discount_value <= 100):
                    raise ValueError("percentage discount must be between 0 and 100 inclusive")
            elif reward_details["type"] == "fixed":
                if discount_value <= 0:
                    raise ValueError("fixed discount must be a positive amount")
            if menu_item_skus:
                raise ValueError("menu_item_skus must be empty for discount promotions")
        elif promotion_type == PromotionType.PRODUCT:
            if not menu_item_skus or not isinstance(menu_item_skus, list) or len(menu_item_skus) == 0:
                raise ValueError("menu_item_skus (non-empty list) is required for product promotions")
        return self

    @model_validator(mode="after")
    def validate_birthday(self):
        if self.is_birthday_coupon and self.coupon_validity.validity != ValidityType.BIRTHDAY:
            raise ValueError("Birthday coupon must have BIRTHDAY validity type")
        return self

    @model_validator(mode="after")
    def validate_locations(self):
        if not self.locations:
            return self
        for location in self.locations:
            if not db.locations.find_one({"permalink_slug": location}):
                raise ValueError(f"Location {location} not found")
        return self

    @model_validator(mode="after")
    def validate_rules(self):
        if not self.rules:
            return self
        burn_rules = [r for r in self.rules if r.rule_type == RuleType.BURN_TOKENS]
        if len(burn_rules) > 1:
            raise ValueError("Only one burn_tokens rule is allowed")
        return self

    @classmethod
    def validate_create(cls, promotion, wallet: str):
        try:
            role_level = get_company_role_level(wallet)
            if role_level not in [3, 4]:
                raise ValueError("Insufficient role level (must be 3 or 4)")
            if isinstance(promotion, dict):
                promotion = cls(**promotion)
            return promotion
        except ValidationError as e:
            logger.error(f"Validation error in create promotion: {e}")
            error_details = [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in e.errors()]
            raise HTTPException(status_code=422, detail={"errors": error_details})
        except ValueError as e:
            logger.error(f"Value error in create promotion: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in create promotion: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Unexpected error in validate_create: {str(e)}")

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
        return float(obj)
    elif isinstance(obj, Enum):
        return obj.value
    else:
        return obj

def applies_to_location(obj: dict, location_slug: str) -> bool:
    """
    Helper para determinar si una promoción o regla aplica a una sucursal.
    - Si 'locations' no viene, es None o es [], aplica a todas las sucursales.
    - Si 'locations' tiene valores, aplica solo a esas sucursales.
    """
    locations = obj.get('locations')
    if not locations:
        return True
    return location_slug in locations

def generate_coupon_code() -> str:
    while True:
        # Genera un UUID, elimina guiones y toma los primeros 12 caracteres en mayúsculas
        code = str(uuid.uuid4()).replace('-', '').upper()[:13]
        if not db.promotion_claims.find_one({"codigo": code}):
            return code

class ReactivateCouponRequest(BaseModel):
    coupon_code: str