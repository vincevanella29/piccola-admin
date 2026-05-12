# config/b2b/models.py
# ─────────────────────────────────────────────────────────────────────
# Modelos self-contained para promociones B2B.
# NO dependen de config/promotions — esto vive en su propio mundo.
# ─────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from typing import Optional, Dict, Union, List
from enum import Enum
import uuid
import logging

from utils.web3mongo import db

logger = logging.getLogger(__name__)


class B2BRewardType(str, Enum):
    DISCOUNT = "discount"
    PRODUCT = "product"


class B2BPromotionCreate(BaseModel):
    """
    Schema simple para crear una promoción B2B.
    Sin reglas de tokens, sin display windows, sin claim windows.
    Solo: nombre, reward, cuotas y límites.
    """
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(default="", max_length=500)
    reward_type: B2BRewardType
    # discount → {"discount": 20, "type": "percentage"|"fixed"}
    # product  → {"product_name": "Pizza Margherita"}
    reward_details: Dict[str, Union[str, float, int]] = Field(...)
    total_quota: int = Field(..., ge=1, description="Total coupons available")
    max_per_user: int = Field(default=1, ge=1, description="Max coupons per unique user/email")
    max_per_day: int = Field(default=5, ge=1, description="Max coupons distributed globally per day")
    locations: Optional[List[str]] = Field(default_factory=list, description="Slugs de locales donde aplica (vacío = todos)")

    def validate_reward(self):
        """Validates reward_details against reward_type."""
        if self.reward_type == B2BRewardType.DISCOUNT:
            discount = self.reward_details.get("discount")
            dtype = self.reward_details.get("type")
            if discount is None or dtype is None:
                raise ValueError("reward_details must contain 'discount' and 'type' for discount promotions")
            if dtype not in ("percentage", "fixed"):
                raise ValueError("discount type must be 'percentage' or 'fixed'")
            try:
                dval = float(discount)
            except (ValueError, TypeError):
                raise ValueError("discount must be a number")
            if dtype == "percentage" and not (0 < dval <= 100):
                raise ValueError("percentage discount must be between 1 and 100")
            if dtype == "fixed" and dval <= 0:
                raise ValueError("fixed discount must be a positive amount")
        elif self.reward_type == B2BRewardType.PRODUCT:
            if not self.reward_details.get("product_name"):
                raise ValueError("reward_details must contain 'product_name' for product promotions")


def generate_b2b_coupon_code() -> str:
    """Genera un código de cupón único para distribución B2B."""
    while True:
        code = "B2B-" + str(uuid.uuid4()).replace("-", "").upper()[:10]
        if not db.promotion_claims.find_one({"codigo": code}):
            return code
