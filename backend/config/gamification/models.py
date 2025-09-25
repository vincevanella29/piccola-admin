from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


class SegmentDefinition(BaseModel):
    name: str
    symbol: str


DEFAULT_SPECIAL_SEGMENTS: List[SegmentDefinition] = [
    SegmentDefinition(name="Intelecto", symbol="INT"),
    SegmentDefinition(name="Carisma", symbol="CHA"),
    SegmentDefinition(name="Fuerza", symbol="STR"),
    SegmentDefinition(name="Agilidad", symbol="AGI"),
    SegmentDefinition(name="Percepción", symbol="PER"),
    SegmentDefinition(name="Resistencia", symbol="END"),
    SegmentDefinition(name="Suerte", symbol="LCK"),
]


class RuleContext(BaseModel):
    rut: str
    ym: str  # YYYY-MM
    company_id: int


class RuleAward(BaseModel):
    wallet: str = Field(..., description="Wallet del empleado")
    token_id: int = Field(..., gt=0)
    amount_wei: int = Field(..., ge=0)
    reason: str = ""
    metadata: Dict[str, Any] = {}


class RuleResult(BaseModel):
    rule_name: str
    awards: List[RuleAward] = []
    extra: Dict[str, Any] = {}


class BatchPlan(BaseModel):
    ym: str
    company_id: int
    totals_by_token: Dict[int, int]
    awards: List[RuleAward]
    note: Optional[str] = None
