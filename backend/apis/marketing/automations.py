from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime
import logging

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.time_utils import get_chile_time

router = APIRouter(tags=["Marketing Automations"])
logger = logging.getLogger(__name__)

class AutomationRuleCreate(BaseModel):
    name: str
    trigger_event: str
    action_type: str = "push" # "push" o "email"
    template_id: str
    delay_minutes: int = 0
    active: bool = True
    segment: str # "customers" o "employees"
    condition: Optional[dict] = None
    include_order_items: Optional[bool] = False
    include_reorder: Optional[bool] = False
    include_suggestions: Optional[bool] = False

class AutomationRuleResponse(BaseModel):
    id: str
    name: str
    trigger_event: str
    action_type: str
    template_id: str
    delay_minutes: int
    active: bool
    segment: str
    condition: Optional[dict] = None
    include_order_items: Optional[bool] = False
    include_reorder: Optional[bool] = False
    include_suggestions: Optional[bool] = False
    created_at: datetime
    updated_at: datetime

from services.automations.triggers import TRIGGERS

@router.get("/automations/config/triggers")
async def get_automation_triggers(user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    triggers_config = {}
    for trigger_id, plugin_class in TRIGGERS.items():
        segment = getattr(plugin_class, "segment", "customers")
        if segment not in triggers_config:
            triggers_config[segment] = []
            
        triggers_config[segment].append({
            "value": trigger_id,
            "label": getattr(plugin_class, "label", trigger_id),
            "emoji": getattr(plugin_class, "emoji", "⚡"),
            "variables": getattr(plugin_class, "available_variables", []),
            "mock_payload": getattr(plugin_class, "mock_payload", {})
        })
        
    return {"success": True, "triggers": triggers_config}

@router.get("/automations/{segment}", response_model=List[AutomationRuleResponse])
async def get_automations(segment: str, action_type: Optional[str] = None, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    if segment not in ["customers", "employees"]:
        raise HTTPException(status_code=400, detail="Invalid segment. Must be 'customers' or 'employees'")
        
    query = {"segment": segment}
    if action_type:
        query["action_type"] = action_type
        
    rules = list(db.automation_rules.find(query, {"_id": 0}))
    return rules

@router.post("/automations", response_model=AutomationRuleResponse)
async def create_automation(data: AutomationRuleCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    rule = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "trigger_event": data.trigger_event,
        "action_type": data.action_type,
        "template_id": data.template_id,
        "delay_minutes": data.delay_minutes,
        "active": data.active,
        "segment": data.segment,
        "condition": data.condition,
        "include_order_items": data.include_order_items,
        "include_reorder": data.include_reorder,
        "include_suggestions": data.include_suggestions,
        "created_at": get_chile_time(),
        "updated_at": get_chile_time()
    }
    
    db.automation_rules.insert_one(rule)
    rule.pop("_id", None)
    return rule

@router.put("/automations/{rule_id}", response_model=AutomationRuleResponse)
async def update_automation(rule_id: str, data: AutomationRuleCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    existing = db.automation_rules.find_one({"id": rule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    update_data = {
        "name": data.name,
        "trigger_event": data.trigger_event,
        "action_type": data.action_type,
        "template_id": data.template_id,
        "delay_minutes": data.delay_minutes,
        "active": data.active,
        "segment": data.segment,
        "condition": data.condition,
        "include_order_items": data.include_order_items,
        "include_reorder": data.include_reorder,
        "include_suggestions": data.include_suggestions,
        "updated_at": get_chile_time()
    }
    
    db.automation_rules.update_one({"id": rule_id}, {"$set": update_data})
    
    updated = db.automation_rules.find_one({"id": rule_id}, {"_id": 0})
    return updated

@router.delete("/automations/{rule_id}")
async def delete_automation(rule_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    result = db.automation_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True, "message": "Rule deleted"}
