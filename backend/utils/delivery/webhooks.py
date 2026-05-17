import json
import logging
import hashlib
import hmac
import os
import httpx
from datetime import datetime, timezone

from utils.web3mongo import db
from utils.delivery.auth import _get_carrier_token

logger = logging.getLogger(__name__)
CARRIERS_COLL = db.delivery_carriers
DELIVERY_COLL = db.delivery_orders

async def process_webhook_registration(payload, user):
    slug = payload.carrier_slug

    carrier = CARRIERS_COLL.find_one({"slug": slug})
    if not carrier:
        raise ValueError(f"Carrier '{slug}' no encontrado")

    admin_public_url = os.getenv("ADMIN_PUBLIC_URL", f"http://localhost:{os.getenv('PORT', '8081')}/api")
    webhook_url = f"{admin_public_url}/delivery/webhook/{slug}"

    now = datetime.now(timezone.utc)

    if slug == "pedidosya":
        token = await _get_carrier_token(carrier)
        base_url = carrier.get("endpoints", {}).get("base_url", "https://courier-api.pedidosya.com")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                check_resp = await client.get(
                    f"{base_url}/v2/webhooks-configuration",
                    headers={"Authorization": f"Bearer {token}"}
                )
                current_config = check_resp.json() if check_resp.status_code == 200 else {}

                resp = await client.put(
                    f"{base_url}/v2/webhooks-configuration",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"callback_url": webhook_url}
                )

            if resp.status_code in (200, 201, 204):
                CARRIERS_COLL.update_one(
                    {"_id": carrier["_id"]},
                    {"$set": {
                        "webhook.callback_url": webhook_url,
                        "webhook.registered_at": now,
                        "webhook.status": "active",
                        "webhook.previous_config": current_config,
                    }}
                )
                logger.info(f"[webhook-register] ✅ PedidosYa webhook registered: {webhook_url}")
                return {
                    "success": True,
                    "message": f"Webhook registrado con PedidosYa",
                    "callback_url": webhook_url,
                    "carrier_response": resp.json() if resp.text else {},
                }
            else:
                error_text = resp.text[:500]
                logger.error(f"[webhook-register] ❌ PedidosYa rejected: {resp.status_code} {error_text}")
                raise ValueError(f"PedidosYa rechazó la configuración: {resp.status_code} — {error_text}")

        except Exception as e:
            logger.error(f"[webhook-register] ❌ PedidosYa error: {e}")
            raise ValueError(f"Error conectando con PedidosYa: {e}")

    elif slug == "uber_direct":
        CARRIERS_COLL.update_one(
            {"_id": carrier["_id"]},
            {"$set": {
                "webhook.callback_url": webhook_url,
                "webhook.registered_at": now,
                "webhook.status": "manual",
            }}
        )
        return {
            "success": True,
            "message": f"Para Uber Direct, registra esta URL manualmente en el Uber Developer Dashboard",
            "callback_url": webhook_url,
            "manual": True,
        }

    else:
        CARRIERS_COLL.update_one(
            {"_id": carrier["_id"]},
            {"$set": {
                "webhook.callback_url": webhook_url,
                "webhook.registered_at": now,
                "webhook.status": "pending",
            }}
        )
        return {
            "success": True,
            "message": f"URL de webhook guardada. Configúrala manualmente en el panel del carrier.",
            "callback_url": webhook_url,
        }

async def process_carrier_webhook(carrier_slug: str, body: bytes, headers: dict):
    carrier = CARRIERS_COLL.find_one({"slug": carrier_slug})
    if not carrier:
        logger.warning(f"[webhook] Unknown carrier slug: {carrier_slug}")
        raise ValueError("Carrier not found")

    webhook_config = carrier.get("webhook", {})
    secret = webhook_config.get("secret", "")
    sig_header = webhook_config.get("signature_header", "")

    if secret and sig_header:
        received_sig = headers.get(sig_header, "")
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(received_sig, expected_sig):
            logger.warning(f"[webhook] HMAC verification failed for {carrier_slug}")
            raise ValueError("Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON payload")

    logger.info(f"[webhook] Received from {carrier_slug}: {json.dumps(payload)[:500]}")

    carrier_delivery_id = (
        payload.get("delivery_id") or
        payload.get("id") or
        payload.get("shipping_id") or
        payload.get("data", {}).get("id") or
        payload.get("data", {}).get("delivery_id")
    )

    carrier_status_raw = (
        payload.get("status") or
        payload.get("event_type") or
        payload.get("data", {}).get("status") or
        payload.get("kind")
    )

    if not carrier_delivery_id:
        logger.warning(f"[webhook] Could not extract delivery_id from payload")
        return {"success": True, "message": "Received but no delivery_id found"}

    order = DELIVERY_COLL.find_one({"carrier_delivery_id": carrier_delivery_id})
    if not order:
        logger.warning(f"[webhook] No order found for carrier_delivery_id={carrier_delivery_id}")
        return {"success": True, "message": "No matching order found"}

    carrier_terminal = {"cancelled", "canceled", "rejected", "returned", "failed"}
    is_rejection = carrier_status_raw and carrier_status_raw.lower() in carrier_terminal

    internal = order.get("status", "")
    if is_rejection and internal not in {"delivered", "cancelled"}:
        DELIVERY_COLL.update_one(
            {"_id": order["_id"]},
            {"$set": {
                "carrier_rejected": True,
                "carrier_rejection_reason": carrier_status_raw,
                "carrier_delivery_id": "",
                "carrier_status": "",
                "needs_recovery": True,
                "dispatch_failed": False,
                "dispatch_retries": 0,
                "updated_at": datetime.now(timezone.utc),
            }}
        )
        logger.warning(f"[webhook] ⚠️ Carrier rejected order {order['_id']} ({carrier_status_raw}) — marked for recovery")
        
        try:
            from utils.kds_ws import kds_manager
            import asyncio
            asyncio.create_task(kds_manager.broadcast(
                {"type": "status_change", "order_id": str(order["_id"]), "status": internal,
                 "carrier_status": "", "location_id": order.get("location_id")},
                location_id=order.get("location_id"),
            ))
        except Exception:
            pass
            
        return {"success": True, "message": "Carrier rejected order — entered recovery"}

    status_mapping = carrier.get("status_mapping", {})
    internal_status = status_mapping.get(carrier_status_raw)

    now = datetime.now(timezone.utc)
    update_fields = {
        "carrier_status": carrier_status_raw,
        "updated_at": now,
    }

    if internal_status:
        update_fields["status"] = internal_status
        if internal_status == "delivered":
            update_fields["delivered_at"] = now

    courier = payload.get("courier") or payload.get("data", {}).get("courier")
    if courier:
        update_fields["courier_info"] = {
            "name": courier.get("name") or courier.get("first_name", ""),
            "phone": courier.get("phone") or courier.get("phone_number", ""),
            "vehicle": courier.get("vehicle", {}).get("type", "") if isinstance(courier.get("vehicle"), dict) else courier.get("vehicle_type", ""),
            "photo_url": courier.get("img_href") or courier.get("photo_url", ""),
            "location": courier.get("location"),
        }

    DELIVERY_COLL.update_one(
        {"_id": order["_id"]},
        {"$set": update_fields}
    )

    logger.info(f"[webhook] Updated order {order['_id']} → carrier_status={carrier_status_raw}, internal={internal_status}")

    if internal_status:
        import asyncio
        from apis.delivery.orders import _notify_delivery_provider
        order_updated = {**order, **update_fields}
        asyncio.create_task(_notify_delivery_provider(
            order_updated, internal_status,
            carrier_status=carrier_status_raw,
            courier_info=update_fields.get("courier_info"),
        ))

    return {"success": True, "message": "Webhook processed"}

async def disable_webhook_logic(carrier_slug: str, user: dict):
    carrier = CARRIERS_COLL.find_one({"slug": carrier_slug})
    if not carrier:
        raise ValueError(f"Carrier '{carrier_slug}' no encontrado")

    CARRIERS_COLL.update_one(
        {"_id": carrier["_id"]},
        {"$set": {
            "webhook.status": "disabled",
            "webhook.disabled_at": datetime.now(timezone.utc),
            "webhook.disabled_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[webhook] Disabled webhook for {carrier_slug} — falling back to polling")

    return {
        "success": True,
        "message": f"Webhook desactivado para {carrier.get('name', carrier_slug)}. Se usará polling cada 30s.",
    }
