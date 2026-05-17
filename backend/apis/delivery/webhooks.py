"""
delivery/webhooks.py
====================
Outgoing webhook system for delivery orders.
Allows configuring HTTP endpoints that receive order data
when specific events occur (order.created, status changes, etc.).

Payload templates use {{variable}} dot-notation to extract
fields from the order document dynamically.

Endpoints:
  GET    /delivery/webhooks              → list configured webhooks
  POST   /delivery/webhooks              → create webhook
  PUT    /delivery/webhooks/{id}         → update webhook
  DELETE /delivery/webhooks/{id}         → delete webhook
  POST   /delivery/webhooks/{id}/test    → send test payload
  GET    /delivery/webhooks/{id}/logs    → recent delivery logs
"""

import asyncio
from utils.time_utils import get_chile_time
import hashlib
import hmac
import json
import logging
import re
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger(__name__)

WEBHOOKS_COLL = db.delivery_webhooks
WEBHOOK_LOGS_COLL = db.delivery_webhook_logs
DELIVERY_COLL = db.delivery_orders


# ── Pydantic Models ───────────────────────────────────────────

VALID_EVENTS = [
    "order.created",
    "order.status_changed",
    "order.delivered",
    "order.cancelled",
    "customer.created",
    "customer.updated",
]

class WebhookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=8)
    events: List[str] = Field(default=["order.created"])
    payload_template: Optional[str] = Field(None, description="JSON template with {{var}} placeholders")
    headers: Optional[Dict[str, str]] = Field(default_factory=dict)
    secret: Optional[str] = Field(None, description="HMAC-SHA256 signing secret")
    active: bool = True
    retry_count: int = Field(default=3, ge=0, le=10)

class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    payload_template: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    secret: Optional[str] = None
    active: Optional[bool] = None
    retry_count: Optional[int] = None


# ── Template Engine ───────────────────────────────────────────

def _resolve_dot(obj: Any, path: str) -> Any:
    """
    Resolve a dot-notation path against a dict/object.
    e.g. 'customer.name' on {'customer': {'name': 'John'}} → 'John'
    """
    parts = path.split(".")
    current = obj
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
        if current is None:
            return None
    return current


def _render_template(template_str: str, data: dict) -> str:
    """
    Replace {{variable.path}} placeholders in a JSON template string.
    Handles nested objects and arrays. Returns valid JSON string.
    """
    def replacer(match):
        path = match.group(1).strip()
        value = _resolve_dot(data, path)
        if value is None:
            return "null"
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False, default=str)
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        # String — escape for JSON
        escaped = json.dumps(str(value), ensure_ascii=False)
        return escaped[1:-1]  # Remove outer quotes (template is inside quotes)

    return re.sub(r'\{\{(.+?)\}\}', replacer, template_str)


def render_webhook_payload(template_str: Optional[str], event: str, order_doc: dict) -> dict:
    """
    Render the final payload dict for a webhook.
    If no template, sends the full order data with event metadata.
    """
    # Normalize order doc (ObjectId → str, datetime → iso)
    data = _serialize_for_template(order_doc)

    if not template_str or not template_str.strip():
        # Default: send everything
        return {
            "event": event,
            "timestamp": get_chile_time().isoformat(),
            "data": data,
        }

    try:
        rendered = _render_template(template_str, {"order": data, "event": event})
        return json.loads(rendered)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"[webhook] Template render failed, sending raw: {e}")
        return {
            "event": event,
            "timestamp": get_chile_time().isoformat(),
            "data": data,
            "_template_error": str(e),
        }


def _serialize_for_template(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict."""
    result = {}
    for k, v in doc.items():
        if k == "_id":
            result[k] = str(v)
        elif isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = _serialize_for_template(v)
        elif isinstance(v, list):
            result[k] = [
                _serialize_for_template(i) if isinstance(i, dict) else
                str(i) if isinstance(i, ObjectId) else
                i.isoformat() if isinstance(i, datetime) else i
                for i in v
            ]
        else:
            result[k] = v
    return result


# ── Webhook Dispatch (fire-and-forget) ────────────────────────

async def fire_webhooks(event: str, order_doc: dict):
    """
    Fire all active webhooks matching this event.
    Called as asyncio.create_task() from order endpoints.
    """
    try:
        webhooks = list(WEBHOOKS_COLL.find({
            "active": True,
            "events": event,
        }))

        if not webhooks:
            return

        logger.info(f"[webhook] Firing {len(webhooks)} webhook(s) for event={event}")

        for wh in webhooks:
            asyncio.create_task(_dispatch_single(wh, event, order_doc))

    except Exception as e:
        logger.error(f"[webhook] Error loading webhooks: {e}")


async def _dispatch_single(webhook: dict, event: str, order_doc: dict, attempt: int = 1):
    """Send a single webhook with retries."""
    wh_id = str(webhook["_id"])
    url = webhook.get("url", "")
    max_retries = webhook.get("retry_count", 3)

    try:
        # Render payload
        payload = render_webhook_payload(
            webhook.get("payload_template"),
            event,
            order_doc,
        )

        body = json.dumps(payload, ensure_ascii=False, default=str)
        body_bytes = body.encode("utf-8")

        # Build headers
        headers = {"Content-Type": "application/json"}
        custom_headers = webhook.get("headers") or {}
        headers.update(custom_headers)

        # HMAC-SHA256 signature
        secret = webhook.get("secret")
        if secret:
            sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={sig}"

        headers["X-Webhook-Event"] = event
        headers["X-Webhook-Id"] = wh_id
        headers["X-Webhook-Timestamp"] = str(int(time.time()))

        # Send
        start_time = time.time()
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, content=body_bytes, headers=headers)

        elapsed_ms = int((time.time() - start_time) * 1000)
        success = 200 <= resp.status_code < 300

        # Log
        _log_delivery(wh_id, event, url, resp.status_code, elapsed_ms, success,
                       body[:500], resp.text[:500] if not success else None, attempt)

        if success:
            logger.info(f"[webhook] ✅ {webhook.get('name')} → {resp.status_code} ({elapsed_ms}ms)")
        else:
            logger.warning(f"[webhook] ⚠️ {webhook.get('name')} → {resp.status_code}")
            if attempt < max_retries:
                await asyncio.sleep(min(2 ** attempt, 30))
                await _dispatch_single(webhook, event, order_doc, attempt + 1)

    except Exception as e:
        _log_delivery(wh_id, event, url, 0, 0, False, "", str(e), attempt)
        logger.error(f"[webhook] ❌ {webhook.get('name')}: {e}")
        if attempt < max_retries:
            await asyncio.sleep(min(2 ** attempt, 30))
            await _dispatch_single(webhook, event, order_doc, attempt + 1)


def _log_delivery(wh_id, event, url, status_code, elapsed_ms, success, payload_preview, error, attempt):
    """Save webhook delivery log to MongoDB."""
    try:
        WEBHOOK_LOGS_COLL.insert_one({
            "webhook_id": wh_id,
            "event": event,
            "url": url,
            "status_code": status_code,
            "elapsed_ms": elapsed_ms,
            "success": success,
            "payload_preview": payload_preview[:500] if payload_preview else None,
            "error": error[:500] if error else None,
            "attempt": attempt,
            "created_at": get_chile_time(),
        })
    except Exception:
        pass  # Non-critical


# ── Example Order for Test/Preview ────────────────────────────

EXAMPLE_ORDER = {
    "_id": "683b5a1f0000000000000000",
    "provider_slug": "piccola-delivery",
    "provider_name": "Piccola Delivery",
    "location_id": "16",
    "location_slug": "ALMLOC",
    "location_name": "Piccola Alameda",
    "customer": {
        "name": "Richard Soares",
        "email": "cliente@ejemplo.com",
        "phone": "+56954834418",
        "address": "314 Diez de Julio, Santiago",
        "depto": None,
    },
    "items": [
        {"codigo": "0205005", "nombre": "Fontana Di Lasagna", "quantity": 1, "unit_price": 35999, "modifiers": []},
        {"codigo": "9003180", "nombre": "Fontana Di Pasta Delivery", "quantity": 1, "unit_price": 13999, "modifiers": []},
        {"codigo": "0205003", "nombre": "Fontana Di Fetuccini", "quantity": 1, "unit_price": 24999, "modifiers": []},
    ],
    "delivery_fee": 3688,
    "total_amount": 78685,
    "notes": "Por favor enviar bien embalado los envase",
    "order_type": "delivery",
    "status": "pending",
    "order_number": "PI-38236",
    "payment_method": "card",
    "payment_status": "paid",
    "created_at": get_chile_time().isoformat(),
    "updated_at": get_chile_time().isoformat(),
}


# ── Endpoints ──────────────────────────────────────────────────

@router.get("/delivery/webhooks", summary="Listar webhooks configurados")
async def list_webhooks(user: dict = Depends(verify_session)):
    require_admin_level(user, "member")

    docs = list(WEBHOOKS_COLL.find().sort("created_at", -1))
    webhooks = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        if doc.get("secret"):
            doc["secret"] = "***"
        for dt in ("created_at", "updated_at"):
            if isinstance(doc.get(dt), datetime):
                doc[dt] = doc[dt].isoformat()
        webhooks.append(doc)

    return {"success": True, "webhooks": webhooks}


@router.post("/delivery/webhooks", summary="Crear webhook de salida")
async def create_webhook(payload: WebhookCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")

    # Validate events
    invalid = [e for e in payload.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Eventos inválidos: {invalid}. Válidos: {VALID_EVENTS}")

    now = get_chile_time()
    doc = {
        "name": payload.name,
        "url": payload.url,
        "events": payload.events,
        "payload_template": payload.payload_template,
        "headers": payload.headers or {},
        "secret": payload.secret or "",
        "active": payload.active,
        "retry_count": payload.retry_count,
        "created_by": user.get("wallet") or user.get("id"),
        "created_at": now,
        "updated_at": now,
    }

    result = WEBHOOKS_COLL.insert_one(doc)
    logger.info(f"[webhook] ✅ Created '{payload.name}' → {payload.url} events={payload.events}")

    return {"success": True, "webhook_id": str(result.inserted_id)}


@router.put("/delivery/webhooks/{webhook_id}", summary="Actualizar webhook")
async def update_webhook(webhook_id: str, payload: WebhookUpdate, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(webhook_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = WEBHOOKS_COLL.find_one({"_id": ObjectId(webhook_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    update_fields = {}
    for field in ("name", "url", "events", "payload_template", "headers", "secret", "active", "retry_count"):
        val = getattr(payload, field, None)
        if val is not None:
            update_fields[field] = val

    if payload.events:
        invalid = [e for e in payload.events if e not in VALID_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Eventos inválidos: {invalid}")

    update_fields["updated_at"] = get_chile_time()
    update_fields["updated_by"] = user.get("wallet") or user.get("id")

    WEBHOOKS_COLL.update_one({"_id": ObjectId(webhook_id)}, {"$set": update_fields})
    logger.info(f"[webhook] Updated '{webhook_id}': {list(update_fields.keys())}")

    return {"success": True}


@router.delete("/delivery/webhooks/{webhook_id}", summary="Eliminar webhook")
async def delete_webhook(webhook_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(webhook_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    result = WEBHOOKS_COLL.delete_one({"_id": ObjectId(webhook_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    # Clean up logs
    WEBHOOK_LOGS_COLL.delete_many({"webhook_id": webhook_id})
    logger.info(f"[webhook] Deleted '{webhook_id}'")

    return {"success": True}


@router.post("/delivery/webhooks/{webhook_id}/test", summary="Enviar webhook de prueba")
async def test_webhook(webhook_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(webhook_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    webhook = WEBHOOKS_COLL.find_one({"_id": ObjectId(webhook_id)})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    # Use example order for test
    event = webhook.get("events", ["order.created"])[0]

    try:
        payload = render_webhook_payload(
            webhook.get("payload_template"),
            event,
            EXAMPLE_ORDER,
        )

        body = json.dumps(payload, ensure_ascii=False, default=str)
        body_bytes = body.encode("utf-8")

        headers = {"Content-Type": "application/json"}
        headers.update(webhook.get("headers") or {})

        secret = webhook.get("secret")
        if secret:
            sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={sig}"

        headers["X-Webhook-Event"] = f"test.{event}"
        headers["X-Webhook-Id"] = str(webhook["_id"])

        start_time = time.time()
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(webhook["url"], content=body_bytes, headers=headers)
        elapsed_ms = int((time.time() - start_time) * 1000)

        success = 200 <= resp.status_code < 300

        _log_delivery(
            str(webhook["_id"]), f"test.{event}", webhook["url"],
            resp.status_code, elapsed_ms, success,
            body[:500], resp.text[:500] if not success else None, 1,
        )

        return {
            "success": success,
            "status_code": resp.status_code,
            "elapsed_ms": elapsed_ms,
            "response_preview": resp.text[:300],
            "payload_sent": payload,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/delivery/webhooks/{webhook_id}/logs", summary="Logs de envío del webhook")
async def get_webhook_logs(webhook_id: str, limit: int = 20, user: dict = Depends(verify_session)):
    require_admin_level(user, "member")

    if not ObjectId.is_valid(webhook_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    docs = list(
        WEBHOOK_LOGS_COLL.find({"webhook_id": webhook_id})
        .sort("created_at", -1)
        .limit(limit)
    )

    logs = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        logs.append(doc)

    return {"success": True, "logs": logs}


@router.post("/delivery/webhooks/preview", summary="Preview de template con data de ejemplo")
async def preview_template(
    payload: dict,
    user: dict = Depends(verify_session),
):
    """Render a template against example order data — for live preview in the UI."""
    require_admin_level(user, "member")

    template_str = payload.get("template", "")
    event = payload.get("event", "order.created")

    if not template_str:
        return {"success": True, "result": render_webhook_payload(None, event, EXAMPLE_ORDER)}

    try:
        result = render_webhook_payload(template_str, event, EXAMPLE_ORDER)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
