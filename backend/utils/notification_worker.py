import asyncio
import logging
from datetime import datetime, timezone
from utils.web3mongo import db
from firebase_admin import messaging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

POLL_INTERVAL = 60

import re

def render_template(template: str, data: Dict) -> str:
    if not template:
        return ""
    result = template
    for key, value in data.items():
        result = result.replace(f"{{{key}}}", str(value)).replace(f"#{key}", str(value)).replace(f"[{key}]", str(value))
        
    # Remove leftover placeholders
    result = re.sub(r'\{[\w_]+\}', '', result)
    result = re.sub(r'\[[\w_]+\]', '', result)
    result = re.sub(r'#\{?[\w_]+\}?', '', result)
    
    # Clean up extra spaces
    result = re.sub(r'\s+', ' ', result).strip()
    return result

from services.fcm_service import broadcast_and_log_fcm, send_and_log_single

async def send_scheduled_notification(schedule_doc):
    notification_type = db.notification_types.find_one({"id": schedule_doc["notification_type_id"]})
    if not notification_type:
        logger.error(f"Notification type {schedule_doc['notification_type_id']} not found")
        db.notification_schedules.update_one(
            {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
        )
        return
    
    api_config = db.notification_api_configs.find_one({"id": notification_type["api_config_id"]})
    if not api_config:
        logger.error(f"API config {notification_type['api_config_id']} not found")
        db.notification_schedules.update_one(
            {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
        )
        return

    title = render_template(notification_type["title_template"], schedule_doc.get("data", {}))
    body = render_template(notification_type["body_template"], schedule_doc.get("data", {}))
    image_url = notification_type.get("image_url")

    # Si el schedule trae un target_token específico (override manual)
    target_type = notification_type["target_type"]
    target_value = notification_type.get("target_value")
    
    if schedule_doc.get("target_token"):
        target_type = "user"
        target_value = schedule_doc["target_token"]

    tokens_to_send = []

    if target_type == "user":
        # target_value podría ser una wallet, email, privy_id, o ya el token FCM en sí.
        # Si parece un token FCM (largo) lo usamos directo, si no, lo buscamos.
        if len(target_value) > 100 and ":" in target_value:
            tokens_to_send.append(target_value)
        else:
            token_doc = db.user_notification_tokens.find_one({
                "$or": [{"wallet": target_value}, {"privy_id": target_value}, {"email": target_value}],
                "permissions_granted": True
            })
            if token_doc:
                tokens_to_send.append(token_doc["token"])
            else:
                logger.error(f"No valid token found for user/identity {target_value}")
                db.notification_schedules.update_one(
                    {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": "No token found for user", "updated_at": datetime.now(timezone.utc)}}
                )
                return

    elif target_type == "all":
        all_docs = db.user_notification_tokens.find({"permissions_granted": True})
        for d in all_docs:
            if d.get("token"):
                tokens_to_send.append(d["token"])
    
    elif target_type == "topic":
        try:
            res = await send_and_log_single(
                title=title,
                body=body,
                target_type="topic",
                target_value=target_value,
                image_url=image_url,
                sender_wallet="worker",
                force_campaign_id=str(schedule_doc["_id"])
            )
            if res["success"]:
                db.notification_schedules.update_one(
                    {"_id": schedule_doc["_id"]}, {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc)}}
                )
                logger.info(f"[push-worker] 🚀 Scheduled notification sent to topic {target_value}")
            else:
                raise Exception(str(res.get("errors")))
            return
        except Exception as e:
            logger.error(f"[push-worker] ❌ Error sending to topic: {e}")
            db.notification_schedules.update_one(
                {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.now(timezone.utc)}}
            )
            return

    # Enviar a todos los tokens recolectados
    if not tokens_to_send:
        logger.warning(f"[push-worker] No valid tokens to send for target_type {target_type}")
        db.notification_schedules.update_one(
            {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": "No valid tokens found", "updated_at": datetime.now(timezone.utc)}}
        )
        return

    try:
        res = await broadcast_and_log_fcm(
            tokens=tokens_to_send,
            title=title,
            body=body,
            logical_target_type=target_type,
            logical_target_value=target_value or "all",
            image_url=image_url,
            sender_wallet="worker",
            force_campaign_id=str(schedule_doc["_id"])
        )
        
        if res["success"]:
            db.notification_schedules.update_one(
                {"_id": schedule_doc["_id"]}, {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"[push-worker] 🚀 Scheduled notification complete: {res.get('success_count')} sent, {res.get('error_count')} failed.")
        else:
            db.notification_schedules.update_one(
                {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": str(res.get("errors")), "updated_at": datetime.now(timezone.utc)}}
            )
    except Exception as e:
        logger.error(f"[push-worker] ❌ Error broadcasting: {e}")
        db.notification_schedules.update_one(
            {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.now(timezone.utc)}}
        )

async def check_scheduled_notifications():
    now = datetime.now(timezone.utc)
    schedules = list(db.notification_schedules.find({"status": "pending", "schedule_time": {"$lte": now}}))
    if schedules:
        logger.info(f"[push-worker] 📧 Processing {len(schedules)} scheduled notifications")
    for schedule_doc in schedules:
        await send_scheduled_notification(schedule_doc)

async def _notification_worker_loop():
    logger.info("[push-worker] 🚀 Started — poll=%ds", POLL_INTERVAL)
    await asyncio.sleep(5)
    while True:
        try:
            await check_scheduled_notifications()
        except Exception as e:
            logger.error(f"[push-worker] ❌ Queue cycle error: {e}")
        await asyncio.sleep(POLL_INTERVAL)

async def start_notification_worker():
    """Schedule the push notification worker as background task."""
    asyncio.create_task(_notification_worker_loop())
    logger.info("[push-worker] ✅ Push notification worker scheduled")