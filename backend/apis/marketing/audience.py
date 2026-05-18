# backend/apis/marketing/audience.py
"""
Marketing Audience (Unified CRM)
================================
Unifica las principales fuentes de verdad (delivery_customers y empleados_usuarios) 
en un solo listado de audiencia para campañas de marketing (WhatsApp, Email, Push).

Permite agregar leads de forma manual, insertándolos directamente en la colección de customers
con el provider 'marketing_lead'.
"""

import logging
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.time_utils import get_chile_time

router = APIRouter()
logger = logging.getLogger(__name__)

CUSTOMERS_COLL = db.delivery_customers
EMPLOYEES_COLL = db.empleados_usuarios
VPN_COLL = db.trabajadores_vpn


# =====================================================================
# Models
# =====================================================================
class ManualLeadModel(BaseModel):
    phone: str = Field(..., description="Número de teléfono (ej. 56912345678)")
    name: Optional[str] = None
    email: Optional[str] = None
    segment: str = Field("lead", description="Categoría para tagging manual (ej. lead, vip)")


# =====================================================================
# Endpoints
# =====================================================================

@router.get("/marketing/audience", summary="Obtener audiencia unificada de marketing")
async def get_marketing_audience(user: dict = Depends(verify_session)):
    """
    Returns a unified list from `delivery_customers` and `empleados_usuarios`.
    Normalizes the output so the frontend marketing tools can easily consume it.
    Requires marketing role (Level 3+).
    """
    require_admin_level(user, "marketing")
    
    unified_audience = []
    
    # 1. Fetch Customers
    customers = list(CUSTOMERS_COLL.find({}))
    for c in customers:
        if c.get("phone") or c.get("email"):
            unified_audience.append({
                "id": c.get("privy_id", str(c.get("_id"))),
                "name": c.get("name") or "Cliente Anónimo",
                "phone": c.get("phone", ""),
                "email": c.get("email", ""),
                "segment": "customer",
                "provider_slug": c.get("provider_slug", "unknown"),
                "fcm_tokens": c.get("fcm_tokens", []),
                "registered_at": c.get("registered_at"),
            })
            
    # 2. Fetch Employees (Joining with VPN collection for names/roles)
    # We'll do a python-level join here for simplicity and safety, since employees is a small collection
    employees = list(EMPLOYEES_COLL.find({"status": "active"}))
    ruts = [e.get("rut") for e in employees if e.get("rut")]
    
    # Convert ruts to strings and ints for robust matching against VPN coll
    str_ruts = [str(r) for r in ruts]
    int_ruts = [int(r) for r in ruts if str(r).isdigit()]
    
    vpn_profiles = list(VPN_COLL.find({"$or": [{"rut": {"$in": str_ruts}}, {"rut": {"$in": int_ruts}}]}))
    vpn_map = {str(p.get("rut")): p for p in vpn_profiles}
    
    for e in employees:
        rut_str = str(e.get("rut"))
        vpn_data = vpn_map.get(rut_str, {})
        
        # Combine VPN name
        nombres = vpn_data.get("nombres", "")
        apellidop = vpn_data.get("apellidopaterno", "")
        name = f"{nombres} {apellidop}".strip() or "Empleado Desconocido"
        
        # Get phone (might be in employee link or VPN profile)
        phone = e.get("phone") or vpn_data.get("telefono") or vpn_data.get("celular", "")
        email = e.get("email") or vpn_data.get("email", "")
        
        if phone or email:
            unified_audience.append({
                "id": rut_str,
                "name": name,
                "phone": str(phone),
                "email": email,
                "segment": "employee",
                "provider_slug": "rrhh",
                "role": vpn_data.get("cargo", e.get("cargo", "Staff")),
                "fcm_tokens": e.get("fcm_tokens", []),
                "registered_at": e.get("created_at") or e.get("linked_at"),
            })
            
    # Remove exact duplicates (e.g. if an employee is also a customer, we might want to merge them, 
    # but for now we just return them. For marketing, having both might be useful to target "employees who ordered").
    
    return {"success": True, "audience": unified_audience, "total": len(unified_audience)}


@router.post("/marketing/audience/lead", summary="Ingresar lead manual al CRM de customers")
async def add_marketing_lead(
    payload: ManualLeadModel,
    user: dict = Depends(verify_session)
):
    """
    Agrega un contacto manual directamente a la colección `delivery_customers`.
    Se marca con provider_slug = "marketing_lead".
    """
    require_admin_level(user, "marketing")
    
    now = get_chile_time()
    phone = payload.phone.replace("+", "").strip()
    
    # Check if already exists by phone
    existing = CUSTOMERS_COLL.find_one({"phone": phone})
    
    if existing:
        # Update existing
        update_data = {"updated_at": now}
        if payload.name and not existing.get("name"):
            update_data["name"] = payload.name
        if payload.email and not existing.get("email"):
            update_data["email"] = payload.email
            
        # Append marketing segment tags if needed
        tags = existing.get("tags", [])
        if payload.segment not in tags:
            tags.append(payload.segment)
            update_data["tags"] = tags
            
        CUSTOMERS_COLL.update_one({"_id": existing["_id"]}, {"$set": update_data})
        logger.info(f"[audience] Updated existing customer with phone {phone} as lead.")
        return {"success": True, "action": "updated", "id": existing.get("privy_id")}
        
    else:
        # Create new marketing lead in customers
        # Generate a dummy privy_id for the lead since it's a required field for DB integrity
        dummy_privy = f"lead_{int(time.time()*1000)}"
        
        new_customer = {
            "privy_id": dummy_privy,
            "provider_slug": "marketing_lead",
            "name": payload.name or "Lead",
            "phone": phone,
            "email": payload.email,
            "addresses": [],
            "tags": [payload.segment],
            "registered_at": now,
            "updated_at": now,
            "login_count": 0,
            "order_count": 0,
            "total_spent": 0.0,
            "created_by": user.get("wallet")
        }
        
        result = CUSTOMERS_COLL.insert_one(new_customer)
        logger.info(f"[audience] Created new manual lead: {phone} ({dummy_privy})")
        return {"success": True, "action": "created", "id": dummy_privy}
