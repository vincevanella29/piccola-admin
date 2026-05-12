"""
apis/mailing/products.py
========================
Product search & bestsellers for the marketing template editor.

Endpoints:
  GET /mailing/products?search=pizza&limit=20    → Search menu products
  GET /mailing/products/bestsellers?limit=6&days=30 → Top sold from delivery_orders
"""

import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from typing import Optional

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

MENUS_COLL = db.menus
DELIVERY_COLL = db.delivery_orders

# Projection for lightweight product responses
_PRODUCT_FIELDS = {
    "_id": 1, "nombre": 1, "descripcion": 1, "precio": 1,
    "media_r2": 1, "codigo": 1, "category_ids": 1, "estado": 1,
}


def _serialize_product(doc: dict) -> dict:
    """Serialize a menu document for the frontend."""
    return {
        "_id": str(doc["_id"]),
        "nombre": doc.get("nombre", ""),
        "descripcion": doc.get("descripcion", ""),
        "precio": doc.get("precio", 0),
        "media_r2": doc.get("media_r2", ""),
        "codigo": doc.get("codigo", ""),
    }


@router.get("/mailing/products", summary="Search products for template editor")
async def search_products(
    search: Optional[str] = Query(None, min_length=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(verify_session),
):
    """Search menu products by name for inserting into email templates."""
    require_admin_level(user, "marketing")

    query = {"estado": {"$ne": False}}
    if search:
        query["nombre"] = {"$regex": search, "$options": "i"}

    docs = list(MENUS_COLL.find(query, _PRODUCT_FIELDS).limit(limit))

    return {
        "success": True,
        "products": [_serialize_product(d) for d in docs],
        "total": len(docs),
    }


@router.get("/mailing/products/bestsellers", summary="Top selling products")
async def get_bestsellers(
    limit: int = Query(6, ge=1, le=20),
    days: int = Query(30, ge=7, le=365),
    user: dict = Depends(verify_session),
):
    """
    Aggregate bestsellers from delivery_orders (delivered orders only).
    Groups by item codigo, counts total quantity sold, enriches with menu data.
    """
    require_admin_level(user, "marketing")

    cutoff = datetime.now() - timedelta(days=days)

    pipeline = [
        {"$match": {
            "created_at": {"$gte": cutoff},
            "status": "delivered",
        }},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.codigo",
            "total_sold": {"$sum": "$items.quantity"},
            "nombre": {"$first": "$items.nombre"},
        }},
        {"$sort": {"total_sold": -1}},
        {"$limit": limit},
    ]

    top_items = list(DELIVERY_COLL.aggregate(pipeline))

    if not top_items:
        return {"success": True, "products": [], "total": 0}

    # Enrich with full product data from menus
    codigos = [item["_id"] for item in top_items if item["_id"]]
    menu_docs = {
        d["codigo"]: d
        for d in MENUS_COLL.find({"codigo": {"$in": codigos}}, _PRODUCT_FIELDS)
    }

    products = []
    for item in top_items:
        codigo = item["_id"]
        menu = menu_docs.get(codigo)
        if menu:
            prod = _serialize_product(menu)
            prod["total_sold"] = item["total_sold"]
            products.append(prod)
        else:
            # Product no longer in menu but was sold
            products.append({
                "_id": "",
                "nombre": item.get("nombre", codigo),
                "descripcion": "",
                "precio": 0,
                "media_r2": "",
                "codigo": codigo,
                "total_sold": item["total_sold"],
            })

    logger.info(f"[mailing] Bestsellers: {len(products)} products (last {days} days)")

    return {
        "success": True,
        "products": products,
        "total": len(products),
    }
