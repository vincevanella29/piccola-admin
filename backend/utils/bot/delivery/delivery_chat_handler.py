"""
Delivery Chat Handler — processes delivery_order intents.

Gets order context from user_data (injected by delivery_chat.py)
and returns structured responses about order status, items, courier, ETA.
"""
import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Optional

from utils.web3mongo import db

logger = logging.getLogger(__name__)

DELIVERY_COLL = db.delivery_orders

STATUS_LABELS = {
    "pending": "pendiente de confirmación",
    "confirmed": "confirmado por el local",
    "preparing": "en preparación 👨‍🍳",
    "ready": "listo para despacho",
    "dispatched": "en camino 🛵",
    "delivered": "entregado ✅",
    "cancelled": "cancelado ❌",
}


def _format_items_summary(items: list) -> str:
    """Create a short text summary of order items."""
    if not items:
        return "Sin productos"
    parts = []
    for it in items[:6]:
        name = it.get("nombre") or it.get("name") or "Item"
        qty = it.get("quantity") or it.get("qty") or 1
        parts.append(f"{qty}x {name}")
    text = ", ".join(parts)
    if len(items) > 6:
        text += f" y {len(items) - 6} más"
    return text


def _estimate_eta(order: dict) -> Optional[str]:
    """
    Very basic ETA estimation based on status.
    In a real system this would use courier GPS data.
    """
    status = order.get("status", "")
    if status == "pending":
        return "30-45 minutos (estimado)"
    elif status == "confirmed":
        return "25-40 minutos (estimado)"
    elif status == "preparing":
        return "15-30 minutos (estimado)"
    elif status == "ready":
        return "10-20 minutos (estimado)"
    elif status == "dispatched":
        # If we have dispatch timestamp, calculate real time
        dispatched_at = order.get("dispatched_at")
        if dispatched_at:
            try:
                if isinstance(dispatched_at, (int, float)):
                    dt = datetime.fromtimestamp(dispatched_at, tz=timezone.utc)
                else:
                    dt = datetime.fromisoformat(str(dispatched_at).replace("Z", "+00:00"))
                elapsed = (datetime.now(timezone.utc) - dt).total_seconds() / 60
                remaining = max(5, 20 - int(elapsed))
                return f"~{remaining} minutos"
            except Exception:
                pass
        return "5-15 minutos (en camino)"
    elif status == "delivered":
        return "Ya entregado"
    return None


async def handle_delivery_query(update: SimpleNamespace, context: SimpleNamespace) -> tuple:
    """
    Handler for delivery_order intent.
    
    Args:
        update: SimpleNamespace with .text (user message)
        context: SimpleNamespace with .user_data containing order context
    
    Returns:
        (grok_text, payload) tuple
    """
    user_data = getattr(context, "user_data", {}) if context else {}
    order_number = user_data.get("order_number")
    order_context = user_data.get("order_context", {})
    query_spec = user_data.get("delivery_spec", {})
    query_type = query_spec.get("query_type", "general") if isinstance(query_spec, dict) else "general"

    # Get order from context or DB
    order = order_context if order_context else None
    if not order and order_number:
        try:
            order = DELIVERY_COLL.find_one({"order_number": order_number})
        except Exception as e:
            logger.warning(f"[delivery_handler] DB query failed: {e}")

    if not order:
        return None, {
            "type": "text_block_list",
            "intent": "delivery_order",
            "lines": ["No encontré información de tu pedido. ¿Podrías darme el número de orden?"],
        }

    status = order.get("status", "unknown")
    status_label = STATUS_LABELS.get(status, status)
    items = order.get("items", [])
    courier = order.get("courier_info", {}) or {}
    items_summary = _format_items_summary(items)

    # Build response based on query type
    if query_type == "status":
        text = f"Tu pedido #{order_number} está {status_label}."
        eta = _estimate_eta(order)
        if eta and status not in ("delivered", "cancelled"):
            text += f" Tiempo estimado: {eta}."

    elif query_type == "items":
        text = f"En tu pedido #{order_number} tienes: {items_summary}."
        total = order.get("total")
        if total:
            text += f" Total: ${int(total):,}."

    elif query_type == "courier":
        if courier and status in ("dispatched", "delivered"):
            courier_name = courier.get("name", "un repartidor")
            vehicle = courier.get("vehicle_type", "")
            text = f"Tu pedido va con {courier_name}"
            if vehicle:
                text += f" en {vehicle}"
            text += "."
            phone = courier.get("phone")
            if phone:
                text += f" Puedes contactarlo al {phone}."
        elif status in ("pending", "confirmed", "preparing", "ready"):
            text = f"Aún no se ha asignado un repartidor. Tu pedido está {status_label}."
        else:
            text = f"No hay información del repartidor disponible."

    elif query_type == "eta":
        eta = _estimate_eta(order)
        if status == "delivered":
            text = f"Tu pedido #{order_number} ya fue entregado. ¡Buen provecho! 🍕"
        elif status == "cancelled":
            text = f"Tu pedido #{order_number} fue cancelado."
        elif eta:
            text = f"Tiempo estimado para tu pedido #{order_number}: {eta}."
        else:
            text = f"Tu pedido está {status_label}. Pronto tendremos un estimado."

    else:  # general
        text = f"Tu pedido #{order_number} está {status_label}."
        if items_summary:
            text += f" Contiene: {items_summary}."
        eta = _estimate_eta(order)
        if eta and status not in ("delivered", "cancelled"):
            text += f" ETA: {eta}."

    payload = {
        "type": "delivery_order_status",
        "intent": "delivery_order",
        "order_number": order_number,
        "status": status,
        "status_label": status_label,
        "items": [
            {
                "nombre": i.get("nombre") or i.get("name"),
                "quantity": i.get("quantity") or i.get("qty", 1),
                "imagen": i.get("imagen"),
            }
            for i in items[:10]
        ],
        "courier": courier if courier else None,
        "text": text,
    }

    eta = _estimate_eta(order)
    if eta:
        payload["eta"] = eta

    return None, payload
