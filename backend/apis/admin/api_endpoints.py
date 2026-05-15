from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import logging
import os
import math
import io
import zipfile
import json
from fastapi.responses import StreamingResponse
from utils.auth.session import verify_session
from utils.web3mongo import db
from apis.admin.piccola_apis import verify_api_key
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", 1))

# --- Models ---
class EndpointConfig(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    collection_name: str
    fields: List[str]
    allowed_filters: List[str] = []
    sort_by: Optional[str] = None
    sort_order: int = 1
    max_page_size: int = Field(default=500, le=1000)

class EndpointConfigOut(EndpointConfig):
    id: str
    owner: str
    active: bool
    created_at: str

# --- Whitelist & Schemas ---
# For simplicity, we just list the allowed collections. The frontend will fetch this.
ALLOWED_COLLECTIONS = {
    "menus": {"description": "Menu items", "fields": ["codigo", "nombre", "precio", "descripcion", "familia", "subfamilia", "status"]},
    "menu_types": {"description": "Menu types (carta)", "fields": ["codigo", "name", "active"]},
    "categories": {"description": "Menu categories", "fields": ["name", "order", "active"]},
    "menu_options": {"description": "Modifiers and options", "fields": ["codigo", "name", "price", "type"]},
    "locations": {"description": "Physical locations", "fields": ["name", "address", "permalink_slug", "status"]},
    "empresa_sucursales": {"description": "Branches", "fields": ["name", "address", "active"]},
    "ventas_locales": {"description": "Raw sales data", "fields": ["local", "date", "amount", "order_id"]},
    "local_sales_monthly": {"description": "Monthly aggregated sales", "fields": ["local", "month", "year", "total_sales"]},
    "sales_kpis_monthly": {"description": "Monthly KPIs", "fields": ["local", "month", "year", "kpi_data"]},
    "trabajadores_vpn": {"description": "Employees", "fields": ["rut", "name", "role", "active"]},
    "cargos_intranet": {"description": "Employee roles", "fields": ["role_id", "name", "level"]},
    "promotions": {"description": "Active promotions", "fields": ["codigo", "description", "promotion_type", "active"]},
    "promotion_claims": {"description": "Claimed coupons", "fields": ["codigo", "wallet", "promotion_id", "redeemed_at"]},
    "delivery_customers": {"description": "Delivery customers", "fields": ["phone", "name", "address", "total_orders"]},
    "delivery_orders": {"description": "Delivery orders", "fields": ["order_id", "customer_id", "total", "status", "created_at"]},
    "delivery_config": {"description": "Delivery configuration", "fields": ["key", "value"]},
    "kpis_admin_mensual": {"description": "Admin KPIs", "fields": ["month", "year", "metrics"]},
    "kpis_empleado_mensual": {"description": "Employee KPIs", "fields": ["employee_id", "month", "year", "score"]},
    "recetas_productos": {"description": "Product recipes", "fields": ["product_id", "ingredients", "cost"]},
    "articulos_consumo": {"description": "Consumption items", "fields": ["code", "name", "unit", "cost"]},
    "articulos_restaurant": {"description": "Restaurant items", "fields": ["code", "name", "category", "price"]}
}

COLL_CONFIGS = db.api_endpoint_configs

# --- Helpers ---
def sanitize_doc(doc: dict, allowed_fields: List[str]) -> dict:
    if not allowed_fields or "*" in allowed_fields:
        doc["_id"] = str(doc["_id"])
        return doc
    res = {}
    for f in allowed_fields:
        if f in doc:
            res[f] = str(doc[f]) if isinstance(doc[f], dict) and "_id" in f else doc[f] # simplistic
    # Always include ID if requested or implicitly
    if "_id" in doc and "_id" in allowed_fields:
        res["_id"] = str(doc["_id"])
    return res

# --- Endpoints Management (Role 3-4) ---

@router.get("/endpoints/collections")
async def list_allowed_collections(user: dict = Depends(verify_session)):
    """Returns whitelisted collections, dynamic fields, and their approximate doc counts."""
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    res = []
    for col, meta in ALLOWED_COLLECTIONS.items():
        try:
            count = db[col].estimated_document_count()
            # Fetch one document to extract real fields dynamically
            sample_doc = db[col].find_one()
            if sample_doc:
                # Extract all keys, ignoring internal '_id' as it's automatically handled
                dynamic_fields = [k for k in sample_doc.keys() if k != "_id"]
                dynamic_fields.sort()
            else:
                # Fallback to hardcoded fields if collection is currently empty
                dynamic_fields = meta.get("fields", [])
        except Exception:
            count = 0
            dynamic_fields = meta.get("fields", [])
            
        res.append({
            "name": col,
            "description": meta["description"],
            "fields": dynamic_fields,
            "estimated_docs": count
        })
    return res

@router.post("/endpoints")
async def create_endpoint(data: EndpointConfig, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Require role 3 or 4
    # require_admin_level takes (wallet, "admin") in apikeys, wait no, it takes (user, "admin") or (wallet, "admin")?
    # the function is def require_admin_level(user: Dict[str, Any], role: str):
    # wait, in apikeys.py: require_admin_level(wallet, "admin") was used. Let's use user.
    require_admin_level(user, "admin")

    if data.collection_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=400, detail="Collection not allowed")

    # check slug uniqueness
    existing = COLL_CONFIGS.find_one({"slug": data.slug, "company_id": COMPANY_ID})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")

    doc = {
        "name": data.name,
        "slug": data.slug,
        "collection_name": data.collection_name,
        "fields": data.fields,
        "allowed_filters": data.allowed_filters,
        "sort_by": data.sort_by,
        "sort_order": data.sort_order,
        "max_page_size": data.max_page_size,
        "owner": wallet.lower(),
        "company_id": COMPANY_ID,
        "active": True,
        "created_at": datetime.utcnow()
    }
    res = COLL_CONFIGS.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc["created_at"] = doc["created_at"].isoformat()
    del doc["_id"]
    return doc

@router.get("/endpoints")
async def list_endpoints(user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=401, detail="Unauthorized")
    require_admin_level(user, "admin")

    endpoints = list(COLL_CONFIGS.find({"company_id": COMPANY_ID}).sort("created_at", -1))
    for ep in endpoints:
        ep["id"] = str(ep.pop("_id"))
        ep["created_at"] = ep["created_at"].isoformat()
    return endpoints

@router.put("/endpoints/{slug}")
async def update_endpoint(slug: str, data: EndpointConfig, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    require_admin_level(user, "admin")

    existing = COLL_CONFIGS.find_one({"slug": slug, "company_id": COMPANY_ID})
    if not existing:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    if data.slug != slug:
        check_slug = COLL_CONFIGS.find_one({"slug": data.slug, "company_id": COMPANY_ID})
        if check_slug:
            raise HTTPException(status_code=400, detail="New slug already exists")

    if data.collection_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=400, detail="Collection not allowed")

    update_data = {
        "name": data.name,
        "slug": data.slug,
        "collection_name": data.collection_name,
        "fields": data.fields,
        "allowed_filters": data.allowed_filters,
        "sort_by": data.sort_by,
        "sort_order": data.sort_order,
        "max_page_size": data.max_page_size,
    }

    COLL_CONFIGS.update_one({"_id": existing["_id"]}, {"$set": update_data})
    return {"success": True, "slug": data.slug}

@router.delete("/endpoints/{slug}")
async def delete_endpoint(slug: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    res = COLL_CONFIGS.delete_one({"slug": slug, "company_id": COMPANY_ID})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return {"success": True}

# --- Data Gateway (API Key Auth) ---

@router.get("/data/{slug}")
async def query_data(slug: str, request: Request, page: int = 1, page_size: int = 50, api_key_info: dict = Depends(verify_api_key)):
    """
    Query data dynamically based on the endpoint config.
    Requires X-API-Key header.
    """
    # 1. Load config
    config = COLL_CONFIGS.find_one({"slug": slug, "active": True})
    if not config:
        raise HTTPException(status_code=404, detail="Endpoint not found or inactive")

    col_name = config["collection_name"]
    if col_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=403, detail="Collection no longer allowed")

    # 2. Build query from allowed filters
    query = {}
    query_params = dict(request.query_params)
    for filter_field in config.get("allowed_filters", []):
        if filter_field in query_params:
            # basic exact match for now
            val = query_params[filter_field]
            # Try to cast to int/bool if needed, or regex for string
            if val.lower() == "true":
                query[filter_field] = True
            elif val.lower() == "false":
                query[filter_field] = False
            elif val.isdigit():
                query[filter_field] = int(val)
            else:
                query[filter_field] = val

    # 3. Pagination & Sort
    max_ps = config.get("max_page_size", 500)
    actual_page_size = min(int(page_size), max_ps)
    skip = (int(page) - 1) * actual_page_size

    cursor = db[col_name].find(query)
    
    if config.get("sort_by"):
        cursor = cursor.sort(config["sort_by"], int(config.get("sort_order", 1)))

    # Smart batch recommendation logic:
    # If the collection is huge and they didn't filter it down, we warn them.
    # Count can be slow if query is complex, use estimated if no query, else exact
    if not query:
        total = db[col_name].estimated_document_count()
    else:
        total = db[col_name].count_documents(query)

    if total > 10000 and actual_page_size * page > 10000:
        # Prevent huge skip offsets which are slow
        raise HTTPException(status_code=400, detail="Data set too large for deep pagination. Please use batch mode or refine filters.")

    results = list(cursor.skip(skip).limit(actual_page_size))
    
    # Map fields
    mapped_results = [sanitize_doc(d, config.get("fields", [])) for d in results]

    return {
        "meta": {
            "total": total,
            "page": int(page),
            "page_size": actual_page_size,
            "total_pages": math.ceil(total / actual_page_size) if total > 0 else 0,
            "is_large_dataset": total > 10000,
            "suggest_batch": total > 10000
        },
        "data": mapped_results
    }

@router.get("/data/{slug}/download/zip")
async def download_data_zip(slug: str, request: Request, api_key_info: dict = Depends(verify_api_key)):
    """
    Download the full dataset for the endpoint as a compressed ZIP file containing JSON.
    """
    config = COLL_CONFIGS.find_one({"slug": slug, "active": True})
    if not config:
        raise HTTPException(status_code=404, detail="Endpoint not found or inactive")

    col_name = config["collection_name"]
    if col_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=403, detail="Collection no longer allowed")

    query = {}
    query_params = dict(request.query_params)
    for filter_field in config.get("allowed_filters", []):
        if filter_field in query_params:
            val = query_params[filter_field]
            if val.lower() == "true":
                query[filter_field] = True
            elif val.lower() == "false":
                query[filter_field] = False
            elif val.isdigit():
                query[filter_field] = int(val)
            else:
                query[filter_field] = val

    cursor = db[col_name].find(query)
    
    if config.get("sort_by"):
        cursor = cursor.sort(config["sort_by"], int(config.get("sort_order", 1)))

    results = list(cursor)
    mapped_results = [sanitize_doc(d, config.get("fields", [])) for d in results]

    json_data = json.dumps({"data": mapped_results}, ensure_ascii=False).encode('utf-8')
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        zip_file.writestr(f"{slug}_data.json", json_data)
    
    zip_buffer.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="{slug}_export.zip"'
    }
    
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
