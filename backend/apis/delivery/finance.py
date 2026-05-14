"""
delivery/finance.py
===================
Finance module for Vanellix platform.
Manages provider commissions, weekly closings, manual payments, and reconciliation.

Collections:
- delivery_finance_entries: Manual payments, adjustments
- delivery_finance_closings: Weekly closing snapshots (calculated from orders)
"""

import logging
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

PROVIDERS_COLL = db.delivery_providers
ORDERS_COLL = db.delivery_orders
ENTRIES_COLL = db.delivery_finance_entries
CLOSINGS_COLL = db.delivery_finance_closings


# =====================================================================
# Models
# =====================================================================

class FinanceEntryCreate(BaseModel):
    provider_slug: str = Field(..., description="Slug del provider")
    type: str = Field(..., description="payment | adjustment")
    amount: int = Field(..., description="Monto en CLP (positivo = pago recibido)")
    description: str = Field("", description="Descripción")
    reference: str = Field("", description="Referencia (nro transferencia, etc)")
    date: Optional[str] = Field(None, description="Fecha ISO (default: hoy)")


class ClosingRequest(BaseModel):
    provider_slug: str = Field(..., description="Slug del provider")
    period_from: str = Field(..., description="Fecha inicio ISO (YYYY-MM-DD)")
    period_to: str = Field(..., description="Fecha fin ISO (YYYY-MM-DD)")


# =====================================================================
# Weekly Closing — calculates commissions from actual orders
# =====================================================================

def _calculate_closing(provider_slug: str, commissions: dict, date_from: datetime, date_to: datetime) -> dict:
    """
    Calculate commissions for a period from delivery_orders.
    Returns breakdown with totals.
    """
    query = {
        "provider_slug": provider_slug,
        "created_at": {"$gte": date_from, "$lt": date_to},
    }
    all_orders = list(ORDERS_COLL.find(query))

    incomplete_orders_count = 0
    orders = []

    for order in all_orders:
        status = order.get("status")
        if status in ("completed", "delivered", "entregado"):
            orders.append(order)
        elif status not in ("cancelled", "canceled"):
            incomplete_orders_count += 1

    delivery_pct = commissions.get("delivery_pct", 0)
    platform_pct = commissions.get("platform_pct", 0)
    payment_pct = commissions.get("payment_pct", 0)

    total_orders = len(orders)
    total_subtotal = 0
    total_delivery_fees = 0
    total_payment_amount = 0
    commission_delivery = 0
    commission_platform = 0
    commission_payment = 0

    for order in orders:
        subtotal = order.get("subtotal", 0) or order.get("total_amount", 0) or 0
        delivery_fee = order.get("delivery_fee", 0) or 0
        payment_method = order.get("payment_method", "cash")
        order_type = order.get("order_type", "delivery")
        dispatch_count = max(1, order.get("dispatch_count", 1))

        order_total = subtotal + delivery_fee

        total_subtotal += subtotal
        total_delivery_fees += delivery_fee

        # Delivery commission: Total de la cuenta * % (solo para delivery) * dispatch_count
        if order_type == "delivery":
            commission_delivery += (order_total * delivery_pct / 100) * dispatch_count

        # Platform commission: Subtotal sin delivery * % (para todos los pedidos)
        commission_platform += subtotal * platform_pct / 100

        # Payment commission: Total pagado * % (solo pago electrónico)
        if payment_method in ("card", "oneclick", "webpay", "tarjeta", "transfer"):
            total_payment_amount += order_total
            commission_payment += order_total * payment_pct / 100

    total_commission = round(commission_delivery + commission_platform + commission_payment)

    return {
        "period_from": date_from.isoformat(),
        "period_to": date_to.isoformat(),
        "total_orders": total_orders,
        "total_subtotal": round(total_subtotal),
        "total_delivery_fees": round(total_delivery_fees),
        "total_payment_amount": round(total_payment_amount),
        "commission_delivery": round(commission_delivery),
        "commission_platform": round(commission_platform),
        "commission_payment": round(commission_payment),
        "total_commission": total_commission,
        "incomplete_orders_count": incomplete_orders_count,
        "rates": {
            "delivery_pct": delivery_pct,
            "platform_pct": platform_pct,
            "payment_pct": payment_pct,
        },
    }


@router.post("/delivery/finance/closing", summary="Generar cierre semanal")
async def generate_closing(
    payload: ClosingRequest,
    user: dict = Depends(verify_session)
):
    """
    Generate a weekly closing snapshot. Calculates all commissions from orders
    in the given period and saves it as a closing record.
    Level 3+ only.
    """
    require_admin_level(user, "delivery")

    # Validate user level (3-4 only)
    level = user.get("level", 0)
    if level < 3:
        raise HTTPException(status_code=403, detail="Nivel 3+ requerido para cierres")

    # Parse dates
    try:
        date_from = datetime.fromisoformat(payload.period_from).replace(tzinfo=timezone.utc)
        date_to = datetime.fromisoformat(payload.period_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")

    # Get provider + commissions
    prov = PROVIDERS_COLL.find_one({"slug": payload.provider_slug})
    if not prov:
        raise HTTPException(status_code=404, detail="Provider no encontrado")

    commissions = prov.get("commissions", {})

    # Check if closing already exists overlapping this period
    existing = CLOSINGS_COLL.find_one({
        "provider_slug": payload.provider_slug,
        "$or": [
            {"period_from": {"$lte": date_to}, "period_to": {"$gte": date_from}}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un cierre (estado: {existing.get('status')}) que se superpone con estas fechas"
        )

    # Calculate
    closing_data = _calculate_closing(payload.provider_slug, commissions, date_from, date_to)

    # Save closing
    doc = {
        "provider_slug": payload.provider_slug,
        "period_from": date_from,
        "period_to": date_to,
        "status": "draft",  # draft → confirmed → paid
        **closing_data,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.get("wallet") or user.get("id"),
    }
    result = CLOSINGS_COLL.insert_one(doc)

    logger.info(
        f"[finance] Closing generated for '{payload.provider_slug}' "
        f"{payload.period_from}→{payload.period_to}: "
        f"${closing_data['total_commission']:,} CLP from {closing_data['total_orders']} orders"
    )

    doc["_id"] = str(result.inserted_id)
    return {"success": True, "closing": doc}


@router.get("/delivery/finance/closings", summary="Listar cierres")
async def list_closings(
    provider_slug: str = Query(..., description="Slug del provider"),
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    closings = list(CLOSINGS_COLL.find(
        {"provider_slug": provider_slug}
    ).sort("period_from", -1).limit(52))  # último año

    for c in closings:
        c["_id"] = str(c["_id"])
        for key in ("period_from", "period_to", "created_at"):
            if c.get(key) and hasattr(c[key], "isoformat"):
                c[key] = c[key].isoformat()

    return {"success": True, "closings": closings}


@router.put("/delivery/finance/closings/{closing_id}/status", summary="Cambiar status de cierre")
async def update_closing_status(
    closing_id: str,
    status: str = Query(..., description="draft | confirmed | paid"),
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")
    level = user.get("level", 0)
    if level < 3:
        raise HTTPException(status_code=403, detail="Nivel 3+ requerido")

    if status not in ("draft", "confirmed", "paid"):
        raise HTTPException(status_code=400, detail="Status debe ser: draft, confirmed, paid")

    if not ObjectId.is_valid(closing_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    CLOSINGS_COLL.update_one(
        {"_id": ObjectId(closing_id)},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )
    return {"success": True, "status": status}


@router.delete("/delivery/finance/closings/{closing_id}", summary="Eliminar cierre draft")
async def delete_closing(
    closing_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    if not ObjectId.is_valid(closing_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    closing = CLOSINGS_COLL.find_one({"_id": ObjectId(closing_id)})
    if not closing:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")
    if closing.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar cierres en estado 'draft'")

    CLOSINGS_COLL.delete_one({"_id": ObjectId(closing_id)})
    return {"success": True}


# =====================================================================
# Manual Entries — payments & adjustments
# =====================================================================

@router.post("/delivery/finance/entry", summary="Agregar pago/ajuste manual")
async def create_finance_entry(
    payload: FinanceEntryCreate,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")
    level = user.get("level", 0)
    if level < 3:
        raise HTTPException(status_code=403, detail="Nivel 3+ requerido para ingresar pagos")

    if payload.type not in ("payment", "adjustment"):
        raise HTTPException(status_code=400, detail="Tipo debe ser 'payment' o 'adjustment'")

    entry_date = datetime.now(timezone.utc)
    if payload.date:
        try:
            entry_date = datetime.fromisoformat(payload.date).replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    doc = {
        "provider_slug": payload.provider_slug,
        "type": payload.type,
        "amount": payload.amount,
        "description": payload.description,
        "reference": payload.reference,
        "date": entry_date,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.get("wallet") or user.get("id"),
    }
    result = ENTRIES_COLL.insert_one(doc)

    logger.info(
        f"[finance] Entry created: {payload.type} ${payload.amount:,} for '{payload.provider_slug}' "
        f"by {user.get('wallet')}"
    )

    doc["_id"] = str(result.inserted_id)
    return {"success": True, "entry": doc}


@router.get("/delivery/finance/entries", summary="Listar pagos/ajustes")
async def list_finance_entries(
    provider_slug: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    skip = (page - 1) * limit
    query = {"provider_slug": provider_slug}

    total = ENTRIES_COLL.count_documents(query)
    entries = list(ENTRIES_COLL.find(query).sort("date", -1).skip(skip).limit(limit))

    for e in entries:
        e["_id"] = str(e["_id"])
        for key in ("date", "created_at"):
            if e.get(key) and hasattr(e[key], "isoformat"):
                e[key] = e[key].isoformat()

    return {
        "success": True,
        "entries": entries,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.delete("/delivery/finance/entry/{entry_id}", summary="Eliminar entrada")
async def delete_finance_entry(
    entry_id: str,
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")
    level = user.get("level", 0)
    if level < 3:
        raise HTTPException(status_code=403, detail="Nivel 3+ requerido")

    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    result = ENTRIES_COLL.delete_one({"_id": ObjectId(entry_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")

    return {"success": True}


# =====================================================================
# Summary — reconciliation overview
# =====================================================================

@router.get("/delivery/finance/summary", summary="Resumen financiero")
async def finance_summary(
    provider_slug: str = Query(...),
    user: dict = Depends(verify_session)
):
    """
    Returns: total commissions (from closings), total payments, balance.
    """
    require_admin_level(user, "delivery")

    # Total commissions from confirmed/paid closings
    pipeline = [
        {"$match": {"provider_slug": provider_slug, "status": {"$in": ["confirmed", "paid"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_commission"}, "count": {"$sum": 1}}},
    ]
    commission_agg = list(CLOSINGS_COLL.aggregate(pipeline))
    total_commissions = commission_agg[0]["total"] if commission_agg else 0
    closing_count = commission_agg[0]["count"] if commission_agg else 0

    # Total payments
    payment_pipeline = [
        {"$match": {"provider_slug": provider_slug, "type": "payment"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    payment_agg = list(ENTRIES_COLL.aggregate(payment_pipeline))
    total_payments = payment_agg[0]["total"] if payment_agg else 0

    # Adjustments
    adj_pipeline = [
        {"$match": {"provider_slug": provider_slug, "type": "adjustment"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    adj_agg = list(ENTRIES_COLL.aggregate(adj_pipeline))
    total_adjustments = adj_agg[0]["total"] if adj_agg else 0

    # Balance: commissions owed - payments made
    balance = total_commissions - total_payments - total_adjustments

    # Provider commissions config
    prov = PROVIDERS_COLL.find_one({"slug": provider_slug})
    commissions_config = prov.get("commissions", {}) if prov else {}

    # Last closing
    last_closing = CLOSINGS_COLL.find_one(
        {"provider_slug": provider_slug},
        sort=[("period_to", -1)]
    )
    if last_closing:
        last_closing["_id"] = str(last_closing["_id"])
        for k in ("period_from", "period_to", "created_at"):
            if last_closing.get(k) and hasattr(last_closing[k], "isoformat"):
                last_closing[k] = last_closing[k].isoformat()

    return {
        "success": True,
        "provider_slug": provider_slug,
        "total_commissions": total_commissions,
        "total_payments": total_payments,
        "total_adjustments": total_adjustments,
        "balance": balance,  # Positive = client owes Vanellix
        "closing_count": closing_count,
        "commissions_config": commissions_config,
        "last_closing": last_closing,
    }


# =====================================================================
# Preview — estimate without saving
# =====================================================================

@router.get("/delivery/finance/closing-preview", summary="Preview cierre sin guardar")
async def closing_preview(
    provider_slug: str = Query(...),
    period_from: str = Query(..., description="YYYY-MM-DD"),
    period_to: str = Query(..., description="YYYY-MM-DD"),
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    try:
        date_from = datetime.fromisoformat(period_from).replace(tzinfo=timezone.utc)
        date_to = datetime.fromisoformat(period_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    prov = PROVIDERS_COLL.find_one({"slug": provider_slug})
    if not prov:
        raise HTTPException(status_code=404, detail="Provider no encontrado")

    commissions = prov.get("commissions", {})
    preview = _calculate_closing(provider_slug, commissions, date_from, date_to)

    return {"success": True, "preview": preview}


# =====================================================================
# CSV Export
# =====================================================================

@router.get("/delivery/finance/export", summary="Exportar finanzas a CSV")
async def export_finance_csv(
    provider_slug: str = Query(...),
    period_from: str = Query(..., description="YYYY-MM-DD"),
    period_to: str = Query(..., description="YYYY-MM-DD"),
    user: dict = Depends(verify_session)
):
    require_admin_level(user, "delivery")

    try:
        date_from = datetime.fromisoformat(period_from).replace(tzinfo=timezone.utc)
        date_to = datetime.fromisoformat(period_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    # Closings in range
    closings = list(CLOSINGS_COLL.find({
        "provider_slug": provider_slug,
        "period_from": {"$gte": date_from},
        "period_to": {"$lte": date_to},
    }).sort("period_from", 1))

    # Entries in range
    entries = list(ENTRIES_COLL.find({
        "provider_slug": provider_slug,
        "date": {"$gte": date_from, "$lte": date_to},
    }).sort("date", 1))

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["REPORTE FINANCIERO VANELLIX"])
    writer.writerow(["Provider", provider_slug])
    writer.writerow(["Período", f"{period_from} → {period_to}"])
    writer.writerow([])

    # Closings section
    writer.writerow(["CIERRES"])
    writer.writerow([
        "Período Desde", "Período Hasta", "Órdenes", "Subtotal",
        "Delivery Fees", "Com. Delivery", "Com. Plataforma",
        "Com. Pago", "Total Comisión", "Estado"
    ])
    total_closing = 0
    for c in closings:
        pf = c.get("period_from", "").isoformat()[:10] if hasattr(c.get("period_from", ""), "isoformat") else ""
        pt = c.get("period_to", "").isoformat()[:10] if hasattr(c.get("period_to", ""), "isoformat") else ""
        writer.writerow([
            pf, pt,
            c.get("total_orders", 0),
            c.get("total_subtotal", 0),
            c.get("total_delivery_fees", 0),
            c.get("commission_delivery", 0),
            c.get("commission_platform", 0),
            c.get("commission_payment", 0),
            c.get("total_commission", 0),
            c.get("status", ""),
        ])
        total_closing += c.get("total_commission", 0)

    writer.writerow(["", "", "", "", "", "", "", "TOTAL", total_closing])
    writer.writerow([])

    # Entries section
    writer.writerow(["PAGOS Y AJUSTES"])
    writer.writerow(["Fecha", "Tipo", "Monto", "Descripción", "Referencia"])
    total_payments = 0
    for e in entries:
        d = e.get("date", "").isoformat()[:10] if hasattr(e.get("date", ""), "isoformat") else ""
        writer.writerow([
            d,
            e.get("type", ""),
            e.get("amount", 0),
            e.get("description", ""),
            e.get("reference", ""),
        ])
        total_payments += e.get("amount", 0)

    writer.writerow(["", "", total_payments, "TOTAL PAGOS"])
    writer.writerow([])

    # Summary
    balance = total_closing - total_payments
    writer.writerow(["RESUMEN"])
    writer.writerow(["Total Comisiones", total_closing])
    writer.writerow(["Total Pagos", total_payments])
    writer.writerow(["Saldo Pendiente", balance])

    output.seek(0)
    filename = f"finanzas_{provider_slug}_{period_from}_{period_to}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
