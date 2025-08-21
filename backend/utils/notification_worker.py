import schedule
import time
import logging
from datetime import datetime, timezone
from utils.web3mongo import db
from firebase_admin import messaging
import asyncio
from typing import Dict, Optional

logger = logging.getLogger(__name__)

def render_template(template: str, data: Dict) -> str:
    result = template
    for key, value in data.items():
        result = result.replace(f"{{{key}}}", str(value)).replace(f"#{key}", str(value))
    return result

async def send_fcm_notification(api_config: Dict, title: str, body: str, image_url: Optional[str], target_type: str, target_value: str):
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

async def send_scheduled_notification(schedule):
    notification_type = db.notification_types.find_one({"id": schedule["notification_type_id"]})
    if not notification_type:
        logger.error(f"Notification type {schedule['notification_type_id']} not found")
        db.notification_schedules.update_one(
            {"_id": schedule["_id"]}, {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
        )
        return
    
    api_config = db.notification_api_configs.find_one({"id": notification_type["api_config_id"]})
    if not api_config:
        logger.error(f"API config {notification_type['api_config_id']} not found")
        db.notification_schedules.update_one(
            {"_id": schedule["_id"]}, {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
        )
        return

    title = render_template(notification_type["title_template"], schedule["data"])
    body = render_template(notification_type["body_template"], schedule["data"])
    image_url = notification_type.get("image_url")

    if notification_type["target_type"] == "user":
        token = db.user_notification_tokens.find_one({"wallet": notification_type["target_value"], "permissions_granted": True})
        if not token:
            logger.error(f"No valid token for user {notification_type['target_value']}")
            db.notification_schedules.update_one(
                {"_id": schedule["_id"]}, {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
            )
            return
        notification_type["target_value"] = token["token"]

    response = await send_fcm_notification(
        api_config, title, body, image_url,
        notification_type["target_type"], notification_type["target_value"]
    )
    db.notification_schedules.update_one(
        {"_id": schedule["_id"]}, {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc)}}
    )
    logger.info(f"Scheduled notification sent: {response}")

def check_scheduled_notifications():
    now = datetime.now(timezone.utc)
    schedules = db.notification_schedules.find({"status": "pending", "schedule_time": {"$lte": now}})
    for schedule in schedules:
        asyncio.run(send_scheduled_notification(schedule))

def run_worker():
    logger.info("Starting notification worker")
    schedule.every(60).seconds.do(check_scheduled_notifications)
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    run_worker()