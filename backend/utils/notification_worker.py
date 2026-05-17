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

async def send_fcm_notification(api_config: Dict, title: str, body: str, image_url: Optional[str], target_type: str, target_value: str):
    from apis.marketing.notifications import _ensure_firebase
    if not _ensure_firebase():
        raise Exception("Firebase Admin SDK could not be initialized")
        
    message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url
            ),
            topic=target_value if target_type == "topic" else None,
            token=target_value if target_type == "user" else None
        )
    response = messaging.send(message)
    return response

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
            response = await send_fcm_notification(api_config, title, body, image_url, "topic", target_value)
            db.notification_schedules.update_one(
                {"_id": schedule_doc["_id"]}, {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"[push-worker] 🚀 Scheduled notification sent to topic {target_value}: {response}")
            return
        except Exception as e:
            logger.error(f"[push-worker] ❌ Error sending to topic: {e}")
            db.notification_schedules.update_one(
                {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.now(timezone.utc)}}
            )
            return

    # Enviar a todos los tokens recolectados
    success_count = 0
    fail_count = 0
    last_error = ""

    for fcm_token in tokens_to_send:
        try:
            await send_fcm_notification(api_config, title, body, image_url, "user", fcm_token)
            success_count += 1
        except Exception as e:
            fail_count += 1
            err_str = str(e).lower()
            last_error = err_str
            if "senderid mismatch" in err_str or "notregistered" in err_str or "unregistered" in err_str or "invalid registration" in err_str:
                logger.warning(f"[push-worker] Invalid token detected ({err_str}). Deleting from DB.")
                db.user_notification_tokens.delete_one({"token": fcm_token})
            else:
                logger.error(f"[push-worker] ❌ Error sending to token: {e}")

    if success_count > 0 or (fail_count == 0 and len(tokens_to_send) == 0):
        # Consider it successful if at least one reached, or if there was simply no audience (no error)
        db.notification_schedules.update_one(
            {"_id": schedule_doc["_id"]}, {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc)}}
        )
        logger.info(f"[push-worker] 🚀 Scheduled notification complete: {success_count} sent, {fail_count} failed.")
    else:
        db.notification_schedules.update_one(
            {"_id": schedule_doc["_id"]}, {"$set": {"status": "failed", "error": last_error or "All tokens failed", "updated_at": datetime.now(timezone.utc)}}
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