import logging
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.delivery.dispatch import create_carrier_delivery
from utils.delivery.client import _carrier_request

logger = logging.getLogger(__name__)
DELIVERY_COLL = db.delivery_orders
CARRIERS_COLL = db.delivery_carriers
LOCATIONS_COLL = db.locations

async def execute_admin_dispatch(payload, user):
    if not ObjectId.is_valid(payload.order_id):
        raise ValueError("ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.order_id)})
    if not order:
        raise ValueError("Pedido no encontrado")

    if order.get("order_type") == "pickup":
        raise ValueError("Los pedidos pickup no requieren carrier")

    if order.get("carrier_delivery_id"):
        raise ValueError("Este pedido ya fue despachado a un carrier")

    carrier = CARRIERS_COLL.find_one({"slug": payload.carrier_slug, "status": "active"})
    if not carrier:
        raise ValueError(f"Carrier '{payload.carrier_slug}' no encontrado o inactivo")

    loc = None
    location_id = order.get("location_id")
    if location_id:
        if ObjectId.is_valid(location_id):
            loc = LOCATIONS_COLL.find_one({"_id": ObjectId(location_id)})
        if not loc:
            loc = LOCATIONS_COLL.find_one({"permalink_slug": order.get("location_slug") or location_id})

    if not loc:
        logger.error(f"[dispatch_to_carrier] Order {payload.order_id} has no valid location")
        raise ValueError("No se encontró la sucursal origen para este pedido. Verifique que el local exista y esté activo.")

    try:
        carrier_delivery_id = await create_carrier_delivery(carrier, order, loc)
    except Exception as e:
        logger.error(f"[dispatch_to_carrier] Error dispatching to {payload.carrier_slug}: {e}")
        raise

    now = datetime.now(timezone.utc)

    DELIVERY_COLL.update_one(
        {"_id": ObjectId(payload.order_id)},
        {"$set": {
            "status": "dispatched",
            "carrier_slug": payload.carrier_slug,
            "carrier_delivery_id": carrier_delivery_id,
            "carrier_quote_id": payload.quote_id,
            "carrier_status": "pending",
            "dispatched_at": now,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }, "$inc": {
            "dispatch_count": 1
        }}
    )

    logger.info(f"[last_mile] Dispatched order {payload.order_id} to {payload.carrier_slug} → delivery_id={carrier_delivery_id}")

    return {
        "success": True,
        "message": f"Pedido enviado a {carrier['name']}",
        "carrier_delivery_id": carrier_delivery_id,
    }

async def execute_cancel_dispatch(payload, user):
    if not ObjectId.is_valid(payload.order_id):
        raise ValueError("ID de orden inválido")
    order = DELIVERY_COLL.find_one({"_id": ObjectId(payload.order_id)})
    if not order:
        raise ValueError("Pedido no encontrado")

    if not order.get("carrier_delivery_id"):
        raise ValueError("Este pedido no tiene un dispatch activo")

    carrier = CARRIERS_COLL.find_one({"slug": order["carrier_slug"], "status": "active"})
    if not carrier:
        raise ValueError("Carrier no encontrado")

    cancel_endpoint = carrier.get("endpoints", {}).get("cancel_delivery")
    if cancel_endpoint:
        cancel_path = cancel_endpoint.replace("{id}", order["carrier_delivery_id"])
        try:
            payload_data = {"reasonText": "Cancelled by admin", "reason": "Cancelled by admin"}
            await _carrier_request(carrier, "POST", cancel_path, json_data=payload_data)
        except Exception as e:
            logger.warning(f"[last_mile] Cancel request to carrier failed: {e}")

    now = datetime.now(timezone.utc)
    DELIVERY_COLL.update_one(
        {"_id": ObjectId(payload.order_id)},
        {"$set": {
            "status": "ready",
            "carrier_slug": None,
            "carrier_delivery_id": None,
            "carrier_quote_id": None,
            "carrier_status": None,
            "courier_info": None,
            "dispatched_at": None,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[last_mile] Cancelled dispatch for order {payload.order_id}")

    return {"success": True, "message": "Dispatch cancelado. Pedido vuelve a estado 'ready'."}
