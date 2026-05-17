"""
delivery/last_mile.py
=====================
Last-mile dispatch engine — requests pickups from external carriers
(Uber Direct, PedidosYa, GetJusto) and receives their webhook callbacks.

All business logic has been extracted to `utils/delivery/` to ensure 
this router file remains clean and < 500 lines.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

# --- Import logic from utils/delivery ---
from utils.delivery.coverage import run_coverage_test
from utils.delivery.quote import get_delivery_quote, request_admin_quote
from utils.delivery.dispatch_logic import execute_admin_dispatch, execute_cancel_dispatch
from utils.delivery.webhooks import process_webhook_registration, process_carrier_webhook, disable_webhook_logic
from utils.delivery.test_orders import execute_test_order, poll_test_order_logic, cancel_test_order_logic

router = APIRouter()
logger = logging.getLogger(__name__)

DELIVERY_COLL = db.delivery_orders
CARRIERS_COLL = db.delivery_carriers

# =====================================================================
# Pydantic Models
# =====================================================================

class QuoteRequest(BaseModel):
    order_id: str = Field(..., description="ID del pedido a cotizar")
    carrier_slug: str = Field(..., description="Slug del carrier (uber_direct, pedidosya, getjusto)")

class DispatchRequest(BaseModel):
    order_id: str = Field(..., description="ID del pedido a despachar")
    carrier_slug: str = Field(..., description="Slug del carrier")
    quote_id: Optional[str] = Field(None, description="ID del quote (si aplica)")

class CancelRequest(BaseModel):
    order_id: str = Field(..., description="ID del pedido a cancelar dispatch")

class CoverageTestRequest(BaseModel):
    location_id: str = Field(..., description="ID de la sucursal (pickup)")
    dropoff_lat: float = Field(..., description="Latitud destino")
    dropoff_lng: float = Field(..., description="Longitud destino")
    dropoff_address: str = Field("", description="Dirección destino (opcional, para display)")
    carrier_slugs: Optional[list] = Field(None, description="Slugs a probar (None = todos activos)")

class QuoteDeliveryRequest(BaseModel):
    location_id: str = Field(..., description="Sucursal ID (pickup)")
    delivery_info: dict = Field(..., description="Info de delivery con lat, lng y address")
    order_total: float = Field(0, description="Total del pedido para calcular delivery gratis")

class RegisterWebhookRequest(BaseModel):
    carrier_slug: str = Field(..., description="Slug del carrier (pedidosya, uber_direct, etc.)")

class TestOrderRequest(BaseModel):
    carrier_slug: str = Field(..., description="Slug del carrier")
    pickup_address: str = Field("Av. Providencia 1234", description="Dirección de pickup")
    pickup_city: str = Field("Santiago", description="Ciudad pickup")
    pickup_lat: float = Field(-33.4265)
    pickup_lng: float = Field(-70.6155)
    pickup_name: str = Field("La Piccola Italia")
    pickup_phone: str = Field("+56912345678")
    dropoff_address: str = Field("Av. Las Condes 5678", description="Dirección de dropoff")
    dropoff_city: str = Field("Santiago", description="Ciudad dropoff")
    dropoff_lat: float = Field(-33.4087)
    dropoff_lng: float = Field(-70.5667)
    dropoff_name: str = Field("Cliente Test")
    dropoff_phone: str = Field("+56987654321")
    item_description: str = Field("Pizza Margherita Test")
    item_value: float = Field(12000)

# =====================================================================
# Coverage & Quotes
# =====================================================================

@router.post("/delivery/last-mile/coverage-test", summary="Testear cobertura de carriers para un local")
async def test_carrier_coverage(payload: CoverageTestRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    try:
        return await run_coverage_test(payload, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from apis.admin.ecosystem_providers import verify_satellite_webhook

@router.post("/delivery/last-mile/quote-delivery", summary="Quote delivery for delivery app")
async def quote_for_delivery(request: Request, payload: QuoteDeliveryRequest, provider: dict = Depends(verify_satellite_webhook)):

    try:
        return await get_delivery_quote(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delivery/last-mile/quote", summary="Cotizar delivery con un carrier")
async def request_quote(payload: QuoteRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")
    try:
        return await request_admin_quote(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================================
# Dispatch API
# =====================================================================

@router.post("/delivery/last-mile/dispatch", summary="Solicitar pickup a un carrier")
async def dispatch_to_carrier(payload: DispatchRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")
    try:
        return await execute_admin_dispatch(payload, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delivery/last-mile/cancel", summary="Cancelar dispatch con carrier")
async def cancel_dispatch(payload: CancelRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")
    try:
        return await execute_cancel_dispatch(payload, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/delivery/last-mile/status/{order_id}", summary="Status del dispatch activo")
async def get_dispatch_status(order_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    return {
        "success": True,
        "dispatch": {
            "carrier_slug": order.get("carrier_slug"),
            "carrier_delivery_id": order.get("carrier_delivery_id"),
            "carrier_status": order.get("carrier_status"),
            "courier_info": order.get("courier_info"),
            "dispatched_at": order["dispatched_at"].isoformat() if order.get("dispatched_at") else None,
        },
    }

# =====================================================================
# Webhooks
# =====================================================================

@router.post("/delivery/last-mile/register-webhook", summary="Registrar webhook URL con el carrier")
async def register_carrier_webhook(payload: RegisterWebhookRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    try:
        return await process_webhook_registration(payload, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/delivery/last-mile/webhook-status/{carrier_slug}", summary="Estado del webhook registrado")
async def get_webhook_status(carrier_slug: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    carrier = CARRIERS_COLL.find_one({"slug": carrier_slug})
    if not carrier:
        raise HTTPException(status_code=404, detail=f"Carrier '{carrier_slug}' no encontrado")

    webhook = carrier.get("webhook", {})
    return {
        "success": True,
        "slug": carrier_slug,
        "callback_url": webhook.get("callback_url"),
        "status": webhook.get("status", "not_registered"),
        "registered_at": webhook.get("registered_at").isoformat() if webhook.get("registered_at") else None,
        "secret": "configured" if webhook.get("secret") else "not_configured",
    }

@router.delete("/delivery/last-mile/webhook/{carrier_slug}", summary="Desactivar webhook y volver a polling")
async def disable_carrier_webhook(carrier_slug: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    try:
        return await disable_webhook_logic(carrier_slug, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delivery/webhook/{carrier_slug}", summary="Recibir webhook de carrier")
async def receive_carrier_webhook(carrier_slug: str, request: Request):
    body = await request.body()
    try:
        return await process_carrier_webhook(carrier_slug, body, dict(request.headers))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[webhook] Processing failed: {e}")
        raise HTTPException(status_code=500, detail="Internal webhook processing error")

# =====================================================================
# Test Orders
# =====================================================================

@router.post("/delivery/last-mile/test-order", summary="Crear orden de test con un carrier")
async def create_test_order(payload: TestOrderRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    try:
        return await execute_test_order(payload, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/delivery/last-mile/test-orders", summary="Listar órdenes de test")
async def list_test_orders(user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    orders = list(db["delivery_test_orders"].find().sort("created_at", -1).limit(50))
    for o in orders:
        o["_id"] = str(o["_id"])
        if o.get("created_at"):
            o["created_at"] = o["created_at"].isoformat()
        if o.get("updated_at"):
            o["updated_at"] = o["updated_at"].isoformat()
    return {"success": True, "orders": orders}

@router.post("/delivery/last-mile/test-orders/{test_order_id}/poll", summary="Poll carrier status for test order")
async def poll_test_order_status(test_order_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    try:
        return await poll_test_order_logic(test_order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delivery/last-mile/test-order/{test_order_id}/cancel", summary="Cancelar test order con el carrier")
async def cancel_test_order(test_order_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "delivery")
    try:
        return await cancel_test_order_logic(test_order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
