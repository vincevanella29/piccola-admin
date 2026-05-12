"""
workers/mail_worker.py
======================
Background worker for processing the email queue.

Priority system:
  1 = Transactional (order status) — immediate, no throttle
  2 = Automation (triggered by events) — soft limit 30/min
  3 = Bulk campaigns — hard throttle ~7/min (~10k/24h)

Runs every 10s. Processes highest priority first.
Uses Redis daily counter for bulk throttle.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from bson import ObjectId

from utils.web3mongo import db
from utils.mail_sender import send_email, render_template

logger = logging.getLogger("uvicorn.error")

QUEUE_COLL = db.mail_queue
TEMPLATES_COLL = db.mail_templates
CAMPAIGNS_COLL = db.mail_campaigns

# ── Config ────────────────────────────────────────────────────
POLL_INTERVAL = 10             # seconds between queue checks
BATCH_TRANSACTIONAL = 10       # max per cycle
BATCH_AUTOMATION = 5
BATCH_BULK = 1                 # 1 per 10s = 6/min ≈ 8640/day
BULK_DAILY_LIMIT = 10000
BULK_REDIS_KEY = "mail:bulk:today"


# =====================================================================
# Startup
# =====================================================================

async def start_mail_worker():
    """Schedule the mail worker as background task."""
    asyncio.create_task(_mail_worker_loop())
    logger.info("[mail-worker] ✅ Mail worker scheduled")


async def _mail_worker_loop():
    logger.info("[mail-worker] 🚀 Started — poll=%ds", POLL_INTERVAL)

    # Wait for startup
    await asyncio.sleep(5)

    while True:
        try:
            await _process_queue()
        except Exception as e:
            logger.error(f"[mail-worker] ❌ Queue cycle error: {e}")

        await asyncio.sleep(POLL_INTERVAL)


# =====================================================================
# Queue processor
# =====================================================================

async def _process_queue():
    """Process mail queue by priority."""
    now = datetime.now()

    # 1. Transactional — always first, no throttle
    transactional = list(QUEUE_COLL.find({
        "priority": 1,
        "status": "queued",
        "attempt": {"$lt": 3},
    }).sort("created_at", 1).limit(BATCH_TRANSACTIONAL))

    if transactional:
        logger.info(f"[mail-worker] 📧 Processing {len(transactional)} transactional emails")
        for item in transactional:
            await _send_queued_email(item)

    # 2. Automation — soft limit
    automation = list(QUEUE_COLL.find({
        "priority": 2,
        "status": "queued",
        "attempt": {"$lt": 3},
        # Respect delay — only send if scheduled_at <= now
        "$or": [
            {"scheduled_at": {"$exists": False}},
            {"scheduled_at": None},
            {"scheduled_at": {"$lte": now}},
        ],
    }).sort("created_at", 1).limit(BATCH_AUTOMATION))

    if automation:
        logger.info(f"[mail-worker] 🤖 Processing {len(automation)} automation emails")
        for item in automation:
            await _send_queued_email(item)

    # 3. Bulk — hard throttle
    bulk_today = _get_bulk_count_today()
    if bulk_today >= BULK_DAILY_LIMIT:
        return  # Daily limit reached

    bulk = list(QUEUE_COLL.find({
        "priority": 3,
        "status": "queued",
        "attempt": {"$lt": 3},
    }).sort("created_at", 1).limit(BATCH_BULK))

    if bulk:
        for item in bulk:
            await _send_queued_email(item)
            _increment_bulk_count()


async def _send_queued_email(item: dict):
    """Send a single queued email and update its status."""
    item_id = item["_id"]
    attempt = item.get("attempt", 0) + 1

    # Mark as sending
    QUEUE_COLL.update_one(
        {"_id": item_id},
        {"$set": {"status": "sending", "attempt": attempt}}
    )

    # Resolve template if needed
    html = item.get("html", "")
    subject = item.get("subject", "")

    if item.get("template_id") and not html:
        tid = item["template_id"]
        # template_id may be stored as string or ObjectId — try both
        template = TEMPLATES_COLL.find_one({"_id": tid})
        if not template and ObjectId.is_valid(str(tid)):
            template = TEMPLATES_COLL.find_one({"_id": ObjectId(str(tid))})
        if template:
            variables = item.get("vars", {})
            html = render_template(template.get("html", ""), variables)
            subject = render_template(template.get("subject", ""), variables)
        else:
            logger.warning(f"[mail-worker] Template not found: {tid}")

    if not html:
        QUEUE_COLL.update_one(
            {"_id": item_id},
            {"$set": {"status": "failed", "error": "No HTML content or template"}}
        )
        return

    # Send — try DB config first (encrypted), fallback to env vars
    from utils.mail_sender import get_mail_config_from_db, send_email_with_config
    db_config = get_mail_config_from_db()

    if db_config:
        result = await send_email_with_config(
            config=db_config,
            to=item["to"],
            subject=subject,
            html=html,
        )
    else:
        result = await send_email(
            to=item["to"],
            subject=subject,
            html=html,
        )

    if result["success"]:
        update = {
            "status": "sent",
            "sent_at": datetime.now(),
            "error": None,
        }
        # Update campaign stats if applicable
        if item.get("campaign_id"):
            CAMPAIGNS_COLL.update_one(
                {"_id": ObjectId(item["campaign_id"]) if ObjectId.is_valid(str(item["campaign_id"])) else item["campaign_id"]},
                {"$inc": {"sent": 1}}
            )
    else:
        error = result.get("error", "Unknown error")
        if attempt >= 3:
            update = {"status": "failed", "error": error}
            if item.get("campaign_id"):
                CAMPAIGNS_COLL.update_one(
                    {"_id": ObjectId(item["campaign_id"]) if ObjectId.is_valid(str(item["campaign_id"])) else item["campaign_id"]},
                    {"$inc": {"failed": 1}}
                )
        else:
            # Retry with exponential backoff
            retry_at = datetime.now() + timedelta(seconds=30 * attempt)
            update = {"status": "queued", "error": error, "scheduled_at": retry_at}

    QUEUE_COLL.update_one({"_id": item_id}, {"$set": update})


# =====================================================================
# Bulk throttle (Redis-based daily counter)
# =====================================================================

def _get_bulk_count_today() -> int:
    """Get today's bulk email count from Redis."""
    try:
        from utils.redis_cache import redis_client
        val = redis_client.get(BULK_REDIS_KEY)
        return int(val) if val else 0
    except Exception:
        return 0


def _increment_bulk_count():
    """Increment today's bulk counter in Redis."""
    try:
        from utils.redis_cache import redis_client
        pipe = redis_client.pipeline()
        pipe.incr(BULK_REDIS_KEY)
        pipe.expire(BULK_REDIS_KEY, 86400)  # TTL = 24h
        pipe.execute()
    except Exception:
        pass


# =====================================================================
# Public API: enqueue emails
# =====================================================================

def enqueue_email(
    to: str,
    subject: str,
    html: str = "",
    template_id: str = None,
    variables: dict = None,
    priority: int = 1,
    campaign_id: str = None,
    delay_minutes: int = 0,
) -> str:
    """
    Add an email to the queue.

    Args:
        to: Recipient email
        subject: Email subject (can contain {{vars}})
        html: Direct HTML content
        template_id: Template ID to render (alternative to html)
        variables: Template variables
        priority: 1=transactional, 2=automation, 3=bulk
        campaign_id: Link to campaign
        delay_minutes: Schedule N minutes from now

    Returns:
        Queue item ID
    """
    now = datetime.now()
    scheduled_at = now + timedelta(minutes=delay_minutes) if delay_minutes > 0 else None

    doc = {
        "to": to,
        "subject": subject,
        "html": html,
        "template_id": template_id,
        "vars": variables or {},
        "priority": priority,
        "status": "queued",
        "attempt": 0,
        "campaign_id": campaign_id,
        "scheduled_at": scheduled_at,
        "created_at": now,
        "sent_at": None,
        "error": None,
    }

    result = QUEUE_COLL.insert_one(doc)
    return str(result.inserted_id)


def enqueue_transactional(to: str, template_id: str, variables: dict) -> str:
    """Shortcut: enqueue a transactional email (priority 1)."""
    return enqueue_email(
        to=to,
        subject="",  # Resolved from template
        template_id=template_id,
        variables=variables,
        priority=1,
    )


def enqueue_automation(to: str, template_id: str, variables: dict, delay_minutes: int = 0) -> str:
    """Shortcut: enqueue an automation email (priority 2)."""
    return enqueue_email(
        to=to,
        subject="",
        template_id=template_id,
        variables=variables,
        priority=2,
        delay_minutes=delay_minutes,
    )
