"""
apis/mailing/automations.py
============================
Email automation rules triggered by order status changes.

Example automations:
  - "Order confirmed" → send confirmation email immediately
  - "Order delivered" → send review request after 2 hours
  - "Order cancelled" → send sorry email after 30 minutes
"""

import logging
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

AUTOMATIONS_COLL = db.mail_automations
TEMPLATES_COLL = db.mail_templates


# ── Models ──────────────────────────────────────────────────

class AutomationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    trigger: str = Field("order_status_change", description="Event type")
    condition: dict = Field(
        ...,
        description="Condition to match. E.g. {'status': 'delivered'}"
    )
    template_id: str = Field(..., description="Template to send")
    delay_minutes: int = Field(0, ge=0, description="Delay in minutes after trigger")
    include_order_items: bool = Field(False, description="Include order items table in email")
    include_reorder: bool = Field(False, description="Include reorder button")
    include_suggestions: bool = Field(False, description="Include suggested products grid")


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[str] = None
    condition: Optional[dict] = None
    template_id: Optional[str] = None
    delay_minutes: Optional[int] = None
    include_order_items: Optional[bool] = None
    include_reorder: Optional[bool] = None
    include_suggestions: Optional[bool] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("/mailing/automations", summary="List automations")
async def list_automations(
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    automations = list(AUTOMATIONS_COLL.find().sort("created_at", -1))
    for a in automations:
        a["_id"] = str(a["_id"])
        # Resolve template name
        if a.get("template_id") and ObjectId.is_valid(a["template_id"]):
            tpl = TEMPLATES_COLL.find_one({"_id": ObjectId(a["template_id"])}, {"name": 1})
            a["template_name"] = tpl["name"] if tpl else "?"

    return {"success": True, "automations": automations, "total": len(automations)}


@router.post("/mailing/automations", summary="Create automation rule")
async def create_automation(
    payload: AutomationCreate,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    # Verify template
    if not ObjectId.is_valid(payload.template_id):
        raise HTTPException(status_code=400, detail="Template ID inválido")
    template = TEMPLATES_COLL.find_one({"_id": ObjectId(payload.template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    now = datetime.now()
    doc = {
        **payload.dict(),
        "active": True,
        "sent_count": 0,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("wallet") or user.get("id"),
    }

    result = AUTOMATIONS_COLL.insert_one(doc)
    logger.info(f"[mailing] Automation created: {payload.name} (trigger={payload.trigger}, delay={payload.delay_minutes}min)")

    return {"success": True, "automation_id": str(result.inserted_id)}


@router.put("/mailing/automations/{automation_id}", summary="Update automation")
async def update_automation(
    automation_id: str,
    payload: AutomationUpdate,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(automation_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    updates["updated_at"] = datetime.now()

    result = AUTOMATIONS_COLL.update_one(
        {"_id": ObjectId(automation_id)},
        {"$set": updates}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Automation no encontrada")

    return {"success": True}


@router.patch("/mailing/automations/{automation_id}/toggle", summary="Enable/disable automation")
async def toggle_automation(
    automation_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(automation_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    auto = AUTOMATIONS_COLL.find_one({"_id": ObjectId(automation_id)})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation no encontrada")

    new_active = not auto.get("active", True)
    AUTOMATIONS_COLL.update_one(
        {"_id": ObjectId(automation_id)},
        {"$set": {"active": new_active, "updated_at": datetime.now()}}
    )

    return {"success": True, "active": new_active}


@router.delete("/mailing/automations/{automation_id}", summary="Delete automation")
async def delete_automation(
    automation_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(automation_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    result = AUTOMATIONS_COLL.delete_one({"_id": ObjectId(automation_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Automation no encontrada")

    return {"success": True}


# =====================================================================
# Variable helpers
# =====================================================================

LOCATIONS_COLL = db.locations
MENUS_COLL = db.menus
DELIVERY_COLL = db.delivery_orders
DELIVERY_CONFIG_COLL = db.delivery_config

SITE_BASE_URL = os.getenv("PUBLIC_SITE_URL", "https://lapiccolaitalia.cl")

_MONTHS_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _format_order_date(ts) -> str:
    """Format timestamp to '6 de Mayo, 2026' style."""
    try:
        if isinstance(ts, (int, float)):
            dt = datetime.fromtimestamp(ts)
        elif isinstance(ts, datetime):
            dt = ts
        else:
            dt = datetime.fromisoformat(str(ts))
        return f"{dt.day} de {_MONTHS_ES[dt.month]}, {dt.year}"
    except Exception:
        return ""


def _get_status_label(status: str) -> str:
    """Lookup human label from delivery_config."""
    try:
        config = DELIVERY_CONFIG_COLL.find_one({"type": "internal_statuses"})
        if config:
            for s in config.get("statuses", []):
                if s.get("key") == status:
                    return s.get("label", status)
    except Exception:
        pass
    fallback = {
        "pending": "Pendiente", "confirmed": "Confirmado",
        "preparing": "En preparación", "ready": "Listo para despacho",
        "dispatched": "En camino 🛵", "delivered": "Entregado ✅",
        "cancelled": "Cancelado",
    }
    return fallback.get(status, status)


def _build_order_items_html(items: list) -> str:
    """
    Build a responsive HTML table with order items.
    Each row has: thumbnail (from db.menus), name, qty, subtotal.
    """
    # Enrich items with images from menu
    codigos = [it.get("codigo", "") for it in items if it.get("codigo")]
    menu_map = {}
    if codigos:
        for doc in MENUS_COLL.find({"codigo": {"$in": codigos}}, {"codigo": 1, "media_r2": 1}):
            menu_map[doc["codigo"]] = doc.get("media_r2", "")

    rows_html = []
    for it in items:
        nombre = it.get("nombre", it.get("codigo", "Producto"))
        qty = it.get("quantity", 1)
        price = it.get("unit_price", 0)
        subtotal = price * qty
        img_url = menu_map.get(it.get("codigo", ""), "")

        img_cell = (
            f'<img src="{img_url}" alt="{nombre}" '
            f'style="width:48px;height:48px;border-radius:8px;object-fit:cover;" />'
        ) if img_url else (
            '<div style="width:48px;height:48px;border-radius:8px;background:#f0f0f0;'
            'display:flex;align-items:center;justify-content:center;font-size:20px;">🍕</div>'
        )

        rows_html.append(
            f'<tr style="border-bottom:1px solid #f0f0f0;">'
            f'<td style="padding:8px 4px;">{img_cell}</td>'
            f'<td style="padding:8px;font-size:13px;color:#2d2d2d;">{nombre}</td>'
            f'<td style="padding:8px;text-align:center;font-size:13px;color:#666;">{qty}x</td>'
            f'<td style="padding:8px;text-align:right;font-size:13px;font-weight:600;color:#2d2d2d;">'
            f'${subtotal:,.0f}</td>'
            f'</tr>'
        )

    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
        '<thead><tr style="border-bottom:2px solid #22c55e;">'
        '<th style="width:56px;"></th>'
        '<th style="text-align:left;padding:8px;font-size:11px;color:#999;text-transform:uppercase;">Producto</th>'
        '<th style="text-align:center;padding:8px;font-size:11px;color:#999;text-transform:uppercase;">Cant.</th>'
        '<th style="text-align:right;padding:8px;font-size:11px;color:#999;text-transform:uppercase;">Subtotal</th>'
        '</tr></thead>'
        '<tbody>' + ''.join(rows_html) + '</tbody>'
        '</table>'
    )


def _build_order_items_text(items: list) -> str:
    """Plain text version: '2x Margherita, 1x Tiramisú'."""
    parts = []
    for it in items:
        nombre = it.get("nombre", it.get("codigo", "Producto"))
        qty = it.get("quantity", 1)
        parts.append(f"{qty}x {nombre}")
    return ", ".join(parts)


def _build_suggested_products_html(order_items: list, limit: int = 3) -> str:
    """
    Build a grid of suggested products based on order item categories.
    Falls back to random products with images.
    """
    # Get category_ids from ordered products
    codigos = [it.get("codigo", "") for it in order_items if it.get("codigo")]
    ordered_cats = set()
    if codigos:
        for doc in MENUS_COLL.find({"codigo": {"$in": codigos}}, {"category_ids": 1}):
            for cid in (doc.get("category_ids") or []):
                ordered_cats.add(cid)

    # Find products from same categories (excluding ordered ones)
    query = {
        "estado": {"$ne": False},
        "media_r2": {"$exists": True, "$ne": ""},
        "codigo": {"$nin": codigos},
    }
    if ordered_cats:
        query["category_ids"] = {"$in": list(ordered_cats)}

    suggestions = list(MENUS_COLL.find(
        query,
        {"nombre": 1, "precio": 1, "media_r2": 1, "codigo": 1},
    ).limit(limit * 2))

    # Fallback: any products with images
    if len(suggestions) < limit:
        fallback_query = {
            "estado": {"$ne": False},
            "media_r2": {"$exists": True, "$ne": ""},
            "codigo": {"$nin": codigos + [d["codigo"] for d in suggestions if d.get("codigo")]},
        }
        suggestions += list(MENUS_COLL.find(fallback_query, {"nombre": 1, "precio": 1, "media_r2": 1}).limit(limit))

    suggestions = suggestions[:limit]
    if not suggestions:
        return ""

    cards = []
    for prod in suggestions:
        img = prod.get("media_r2", "")
        nombre = prod.get("nombre", "")
        precio = prod.get("precio", 0)
        cards.append(
            f'<td style="width:33%;padding:4px;text-align:center;vertical-align:top;">'
            f'<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f0f0f0;">'
            f'<img src="{img}" alt="{nombre}" style="width:100%;height:120px;object-fit:cover;" />'
            f'<div style="padding:8px;">'
            f'<p style="font-size:12px;font-weight:600;color:#2d2d2d;margin:0;">{nombre}</p>'
            f'<p style="font-size:13px;font-weight:700;color:#22c55e;margin:4px 0 0;">'
            f'${precio:,.0f}</p>'
            f'</div></div></td>'
        )

    cards_html = ''.join(cards)
    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
        '<tr>' + cards_html + '</tr>'
        '</table>'
    )


# =====================================================================
# Trigger engine — called by dispatch_worker on status changes
# =====================================================================

def check_automations(order: dict, new_status: str):
    """
    Check if any active automation matches this status change.
    If so, build rich variables and enqueue the email.

    Called synchronously from the dispatch worker.
    """
    from workers.mail_worker import enqueue_automation

    order_number = order.get("order_number", str(order.get("_id", "")))
    logger.info(f"[mailing] check_automations called: order={order_number}, status={new_status}")

    automations = list(AUTOMATIONS_COLL.find({
        "active": True,
        "trigger": "order_status_change",
        "condition.status": new_status,
    }))

    if not automations:
        logger.info(f"[mailing] No active automations match status='{new_status}'")
        return

    customer = order.get("customer", {})
    email = customer.get("email", "")
    if not email or "@" not in email:
        logger.warning(f"[mailing] Order {order_number}: no valid customer email (got '{email}') — skipping automations")
        return

    logger.info(f"[mailing] Found {len(automations)} automation(s) for status='{new_status}', customer={email}")

    items = order.get("items", [])

    # Resolve location data
    location = {}
    loc_id = order.get("location_id")
    loc_slug = order.get("location_slug")
    if loc_id or loc_slug:
        try:
            q = {"permalink_slug": loc_slug} if loc_slug else {"_id": loc_id}
            loc_doc = LOCATIONS_COLL.find_one(q)
            if loc_doc:
                location = {
                    "name": loc_doc.get("nombre", ""),
                    "address": loc_doc.get("direccion", ""),
                    "phone": loc_doc.get("telefono", ""),
                }
        except Exception as e:
            logger.warning(f"[mailing] Failed to resolve location: {e}")

    for auto in automations:
        template_id = auto.get("template_id")
        delay = auto.get("delay_minutes", 0)

        # ── Core variables (always included) ─────────────────────
        # Resolve delivery app URL from provider
        delivery_app_url = SITE_BASE_URL
        provider_slug = order.get("provider_slug")
        if provider_slug:
            try:
                provider = db.delivery_providers.find_one(
                    {"slug": provider_slug, "status": "active"},
                    {"domain": 1}
                )
                if provider and provider.get("domain"):
                    delivery_app_url = provider["domain"].rstrip("/")
            except Exception:
                pass

        order_id_str = str(order.get("_id", ""))

        variables = {
            # Customer
            "customer_name": customer.get("name", "Cliente"),
            "customer_email": email,
            "customer_phone": customer.get("phone", ""),
            # Order
            "order_number": order_number,
            "order_total": f"${order.get('total_amount', 0):,.0f}",
            "delivery_fee": f"${order.get('delivery_fee', 0):,.0f}",
            "order_date": _format_order_date(order.get("created_at")),
            "order_notes": order.get("notes", "") or "",
            "delivery_address": customer.get("address", ""),
            # Status
            "status": new_status,
            "status_label": _get_status_label(new_status),
            # Restaurant
            "restaurant_name": "La Piccola Italia",
            # Location
            "location_name": location.get("name", ""),
            "location_address": location.get("address", ""),
            "location_phone": location.get("phone", ""),
            # Tracking & Links
            "tracking_url": order.get("tracking_url", ""),
            "review_url": f"{delivery_app_url}/mi-perfil?review={order_id_str}",
            "reorder_url": f"{delivery_app_url}/mi-perfil?reorder={order_id_str}",
        }

        # ── Conditional variables (based on automation flags) ─────
        if auto.get("include_order_items", False) and items:
            variables["order_items_html"] = _build_order_items_html(items)
            variables["order_items_text"] = _build_order_items_text(items)

        if auto.get("include_reorder", False):
            variables["reorder_url"] = f"{SITE_BASE_URL}/carta"

        if auto.get("include_suggestions", False) and items:
            variables["suggested_products_html"] = _build_suggested_products_html(items)

        enqueue_automation(
            to=email,
            template_id=template_id,
            variables=variables,
            delay_minutes=delay,
        )

        # Increment sent count
        AUTOMATIONS_COLL.update_one(
            {"_id": auto["_id"]},
            {"$inc": {"sent_count": 1}}
        )

        logger.info(f"[mailing] Automation '{auto['name']}' triggered for {order_number} → {email} (delay={delay}min)")
