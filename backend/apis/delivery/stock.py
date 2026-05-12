"""
delivery/stock.py
=================
Per-location product stock control for delivery.
Binary (available/unavailable) with history tracking for analytics.

Level 3-5: all locations
Level 6: own sucursales only (same pattern as delivery/orders)
"""

import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from config.roles.access_locals import (
    get_perms_from_user,
    allowed_local_filter,
    validate_include_local_or_403,
)
from utils.time_utils import get_chile_time, CHILE_TZ

router = APIRouter()
logger = logging.getLogger(__name__)

STOCK_COLL = db.delivery_stock
MENUS_COLL = db.menus
CATEGORIES_COLL = db.categories


# ── Models ────────────────────────────────────────────────

class StockToggleRequest(BaseModel):
    location_slug: str = Field(..., description="Slug de la sucursal")
    available: bool = Field(..., description="True = hay stock, False = sin stock")
    reason: Optional[str] = Field(None, description="Razón del cambio (opcional)")


class BulkStockToggleRequest(BaseModel):
    location_slug: str = Field(..., description="Slug de la sucursal")
    items: List[dict] = Field(..., description="[{codigo, available, reason?}]")


# ── Helpers ───────────────────────────────────────────────

def _ensure_indexes():
    """Create indexes once (idempotent)."""
    try:
        STOCK_COLL.create_index([("codigo", 1), ("location_slug", 1)], unique=True)
        STOCK_COLL.create_index("location_slug")
        STOCK_COLL.create_index("available")
    except Exception as e:
        logger.warning(f"[stock] Index creation: {e}")


_ensure_indexes()


def _get_wallet(user: dict) -> str:
    """Extract wallet from session user."""
    return (user.get("wallet") or user.get("address") or "unknown").lower()


# ── Endpoints ─────────────────────────────────────────────


@router.patch("/delivery/stock/bulk", summary="Toggle stock masivo")
async def bulk_toggle_stock(
    data: BulkStockToggleRequest,
    user: dict = Depends(verify_session),
):
    """Bulk toggle stock for multiple products at a single location."""
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    validate_include_local_or_403(perms, [data.location_slug])

    now = get_chile_time()
    wallet = _get_wallet(user)
    updated = 0

    for item in data.items:
        codigo = item.get("codigo")
        available = item.get("available", True)
        reason = item.get("reason")
        if not codigo:
            continue

        history_entry = {
            "available": available,
            "at": now.isoformat(),
            "by": wallet,
        }
        if reason:
            history_entry["reason"] = reason

        STOCK_COLL.update_one(
            {"codigo": codigo, "location_slug": data.location_slug},
            {
                "$set": {
                    "codigo": codigo,
                    "location_slug": data.location_slug,
                    "available": available,
                    "updated_at": now,
                    "updated_by": wallet,
                },
                "$push": {
                    "history": {
                        "$each": [history_entry],
                        "$slice": -100,
                    }
                },
            },
            upsert=True,
        )
        updated += 1

    logger.info(f"[stock] Bulk toggle: {updated} items @ {data.location_slug} by {wallet}")
    return {"success": True, "updated": updated}


@router.get("/delivery/stock", summary="Stock por sucursal — lista de productos con estado")
async def get_delivery_stock(
    location_slug: Optional[str] = None,
    only_unavailable: bool = False,
    user: dict = Depends(verify_session),
):
    """
    Returns all products with their stock state for a location.
    Products not in delivery_stock are assumed available (default).

    Level 3-5: can query any location.
    Level 6: restricted to own sucursales.
    """
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    allowed_slugs = allowed_local_filter(perms)

    # Determine target location(s)
    target_slugs = set()
    if location_slug:
        validate_include_local_or_403(perms, [location_slug])
        target_slugs = {location_slug}
    elif allowed_slugs is not None:
        target_slugs = allowed_slugs
    # else: all locations (level 3-5 without filter)

    # Fetch stock overrides
    stock_query = {}
    if target_slugs:
        stock_query["location_slug"] = {"$in": list(target_slugs)} if len(target_slugs) > 1 else list(target_slugs)[0]
    if only_unavailable:
        stock_query["available"] = False

    stock_docs = list(STOCK_COLL.find(stock_query, {"history": 0}))

    # Build index: { codigo: { location_slug: doc } }
    stock_index = {}
    for doc in stock_docs:
        doc["_id"] = str(doc["_id"])
        stock_index.setdefault(doc["codigo"], {})[doc["location_slug"]] = doc


    # Fetch categories — only delivery type
    categories = list(CATEGORIES_COLL.find(
        {"menu_type": "delivery"},
        {"nombre": 1, "menu_ids": 1}
    ))

    # Build product_id → category mapping AND allowed product IDs set
    cat_map = {}
    delivery_product_ids = set()
    for cat in categories:
        cat_id = str(cat["_id"])
        for mid in (cat.get("menu_ids") or []):
            mid_str = str(mid)
            cat_map[mid_str] = {"id": cat_id, "nombre": cat.get("nombre", "")}
            delivery_product_ids.add(mid_str)

    # Fetch only delivery products (by _id in delivery categories)
    if not delivery_product_ids:
        return {
            "success": True,
            "products": [],
            "total": 0,
            "unavailable_count": 0,
        }

    # Build filter: menu _id can be plain strings ("904") or ObjectIds
    id_filter = []
    for pid in delivery_product_ids:
        id_filter.append(pid)  # string form
        try:
            id_filter.append(ObjectId(pid))  # ObjectId form (legacy)
        except Exception:
            pass

    products = list(MENUS_COLL.find(
        {"_id": {"$in": id_filter}, "estado": {"$ne": False}},
        {"codigo": 1, "nombre": 1, "media_r2": 1, "media_url": 1, "category_ids": 1, "prioridad": 1}
    ))

    # Build response
    result = []
    for p in products:
        pid = str(p["_id"])
        codigo = p.get("codigo", "")
        if not codigo:
            continue

        # Image
        img = p.get("media_r2") or p.get("media_url") or ""

        # Category
        cat_info = cat_map.get(pid, {})

        # Stock state for each target location
        overrides = stock_index.get(codigo, {})

        if only_unavailable and not overrides:
            continue

        item = {
            "id": pid,
            "codigo": codigo,
            "nombre": p.get("nombre", ""),
            "image": img,
            "category": cat_info.get("nombre", ""),
            "category_id": cat_info.get("id", ""),
            "overrides": {},
        }

        if target_slugs:
            for slug in target_slugs:
                override = overrides.get(slug)
                if override:
                    item["overrides"][slug] = {
                        "available": override.get("available", True),
                        "updated_at": override.get("updated_at"),
                        "updated_by": override.get("updated_by"),
                    }
                else:
                    item["overrides"][slug] = {"available": True}
        else:
            # No location filter — include all overrides
            for slug, override in overrides.items():
                item["overrides"][slug] = {
                    "available": override.get("available", True),
                    "updated_at": override.get("updated_at"),
                    "updated_by": override.get("updated_by"),
                }

        result.append(item)

    # Sort by category then name
    result.sort(key=lambda x: (x.get("category", ""), x.get("nombre", "")))

    # Count unavailable
    unavailable_count = sum(
        1 for doc in stock_docs if doc.get("available") is False
    )

    return {
        "success": True,
        "products": result,
        "total": len(result),
        "unavailable_count": unavailable_count,
    }


@router.patch("/delivery/stock/{codigo}", summary="Toggle stock de un producto")
async def toggle_stock(
    codigo: str,
    data: StockToggleRequest,
    user: dict = Depends(verify_session),
):
    """
    Toggle stock for a product at a specific location.
    Creates or updates the delivery_stock document.
    Appends to history for analytics.
    """
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)
    validate_include_local_or_403(perms, [data.location_slug])

    now = get_chile_time()
    wallet = _get_wallet(user)

    history_entry = {
        "available": data.available,
        "at": now.isoformat(),
        "by": wallet,
    }
    if data.reason:
        history_entry["reason"] = data.reason

    result = STOCK_COLL.update_one(
        {"codigo": codigo, "location_slug": data.location_slug},
        {
            "$set": {
                "codigo": codigo,
                "location_slug": data.location_slug,
                "available": data.available,
                "updated_at": now,
                "updated_by": wallet,
            },
            "$push": {
                "history": {
                    "$each": [history_entry],
                    "$slice": -100,  # Keep last 100 entries
                }
            },
        },
        upsert=True,
    )

    action = "available" if data.available else "unavailable"
    logger.info(f"[stock] {codigo} @ {data.location_slug} → {action} by {wallet}")

    return {
        "success": True,
        "codigo": codigo,
        "location_slug": data.location_slug,
        "available": data.available,
    }





@router.get("/delivery/stock/history", summary="Historial de cambios de stock")
async def get_stock_history(
    location_slug: Optional[str] = None,
    codigo: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(verify_session),
):
    """
    Returns recent stock change history for analytics.
    Level 3-5 only (analytics).
    """
    rl = require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)

    query = {}
    if location_slug:
        validate_include_local_or_403(perms, [location_slug])
        query["location_slug"] = location_slug
    else:
        allowed_slugs = allowed_local_filter(perms)
        if allowed_slugs is not None:
            if not allowed_slugs:
                return {"success": True, "history": []}
            query["location_slug"] = {"$in": list(allowed_slugs)}

    if codigo:
        query["codigo"] = codigo

    # Only docs with history
    query["history"] = {"$exists": True, "$ne": []}

    docs = list(STOCK_COLL.find(query).sort("updated_at", -1).limit(limit))

    # Flatten history entries with product info
    result = []
    # Fetch product names
    codigos = list({d["codigo"] for d in docs})
    products = list(MENUS_COLL.find({"codigo": {"$in": codigos}}, {"codigo": 1, "nombre": 1}))
    name_map = {p["codigo"]: p.get("nombre", "") for p in products}

    for doc in docs:
        for entry in reversed(doc.get("history", [])[-20:]):
            result.append({
                "codigo": doc["codigo"],
                "nombre": name_map.get(doc["codigo"], ""),
                "location_slug": doc["location_slug"],
                **entry,
            })

    # Sort by timestamp descending
    result.sort(key=lambda x: x.get("at", ""), reverse=True)

    return {"success": True, "history": result[:limit]}


@router.get("/delivery/stock/analytics", summary="Analytics de stock")
async def get_stock_analytics(
    location_slug: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    """
    Stock analytics: top out-of-stock products, frequency, etc.
    """
    require_admin_level(user, "delivery")
    perms = get_perms_from_user(user)

    query = {"available": False}
    if location_slug:
        validate_include_local_or_403(perms, [location_slug])
        query["location_slug"] = location_slug
    else:
        allowed_slugs = allowed_local_filter(perms)
        if allowed_slugs is not None:
            if not allowed_slugs:
                return {"success": True, "top_unavailable": [], "total_unavailable": 0}
            query["location_slug"] = {"$in": list(allowed_slugs)}

    # Currently unavailable products
    unavailable = list(STOCK_COLL.find(query, {"codigo": 1, "location_slug": 1, "updated_at": 1, "history": 1}))

    # Fetch names
    codigos = list({d["codigo"] for d in unavailable})
    products = list(MENUS_COLL.find({"codigo": {"$in": codigos}}, {"codigo": 1, "nombre": 1}))
    name_map = {p["codigo"]: p.get("nombre", "") for p in products}

    # Top unavailable (by count of times marked unavailable from history)
    freq = {}
    for doc in unavailable:
        codigo = doc["codigo"]
        times_unavailable = sum(1 for h in (doc.get("history") or []) if not h.get("available", True))
        freq[codigo] = freq.get(codigo, 0) + times_unavailable

    top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10]
    top_unavailable = [
        {"codigo": c, "nombre": name_map.get(c, ""), "times_out": count}
        for c, count in top
    ]

    return {
        "success": True,
        "total_unavailable": len(unavailable),
        "top_unavailable": top_unavailable,
    }
