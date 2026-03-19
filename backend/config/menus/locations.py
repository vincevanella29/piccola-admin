"""
Locations business logic.
"""

import logging
from datetime import datetime, timezone

from bson import ObjectId
from utils.web3mongo import db

from .helpers import serialize, sync_to_frontend
from .products import upload_image  # reuse the same R2 upload logic

logger = logging.getLogger(__name__)

# Fields exposed by list_locations
_LOCATION_FIELDS = {
    "nombre":         1,
    "permalink_slug": 1,
    "custom_buttons": 1,
    "media_r2":       1,
    "media_url":      1,
    "media_logo":     1,
    "media_urls":     1,     # gallery images array
    "cover_image_url": 1,    # hero cover image
    "direccion":      1,
    "telefono":       1,
    "horario":        1,   # legacy plain-text schedule string
    "color":          1,
    "lat":            1,
    "lng":            1,
    "menu_ids":       1,
    "estado":         1,
    "prioridad":      1,
    "email":          1,
    "city":           1,
    "commune":        1,
    # Structured schedules (added with opening-hours feature)
    "opening_hours":  1,   # { dinein: {"1":{open,close},...}, delivery: {...} }
    "special_dates":  1,   # [{date, label, closed, open, close}]
    # QR
    "qr_url":          1,  # auto-generated QR URL (our redirect endpoint)
    "qr_redirect_url": 1,  # external URL to redirect to when QR is scanned
    "qr_scan_count":   1,  # atomic counter incremented on each scan
    "qr_last_scan":    1,  # timestamp of last scan
}


def list_locations() -> list:
    locations = list(db.locations.find({}, _LOCATION_FIELDS))
    return [serialize(l) for l in locations]


async def update_location_buttons(location_id: str, custom_buttons: list) -> int:
    """Update custom buttons for a specific location."""
    return await _update_location(location_id, {"custom_buttons": custom_buttons})


async def update_location(location_id: str, fields: dict) -> int:
    """
    Generic location update.
    Only whitelisted, safe fields are persisted.
    """
    ALLOWED = {
        "nombre", "permalink_slug", "custom_buttons",
        "media_r2", "media_url", "media_logo",
        "direccion", "telefono", "horario", "color",
        "lat", "lng",
        "opening_hours", "special_dates",
        "qr_url", "qr_redirect_url",
    }
    safe = {k: v for k, v in fields.items() if k in ALLOWED}
    if not safe:
        return 0
    return await _update_location(location_id, safe)


async def _update_location(location_id: str, set_fields: dict) -> int:
    """Internal: apply $set to a location document and sync frontend."""
    set_fields["updated_at"] = datetime.now(timezone.utc)

    query = {"_id": location_id}
    if ObjectId.is_valid(location_id):
        query = {"$or": [{"_id": ObjectId(location_id)}, {"_id": location_id}]}

    result = db.locations.update_one(query, {"$set": set_fields})
    if result.matched_count == 0:
        result = db.locations.update_one({"id": location_id}, {"$set": set_fields})

    await sync_to_frontend()
    return result.matched_count


def upload_location_image(file_obj, filename: str, content_type: str) -> str:
    """
    Upload a location image to R2 using the same utility as products.
    Returns the public CDN URL.
    """
    return upload_image(file_obj, filename, content_type)


# Nota: el endpoint público de locations fue consolidado en get_public_catalog().
# La carta digital obtiene locations directamente desde GET /public/menus_catalog.


def get_location_by_slug(slug: str):
    """Find a location by its permalink_slug."""
    doc = db.locations.find_one({"permalink_slug": slug})
    if doc:
        return serialize(doc)
    return None


# ── QR Scan Tracking ──────────────────────────────────────────────────────────

def _parse_device_type(ua: str) -> str:
    """Simple mobile/tablet/desktop detection from User-Agent."""
    ua_lower = (ua or "").lower()
    if any(k in ua_lower for k in ("iphone", "android", "mobile", "opera mini", "iemobile")):
        return "mobile"
    if any(k in ua_lower for k in ("ipad", "tablet", "kindle", "playbook")):
        return "tablet"
    return "desktop"


def log_qr_scan(slug: str, location_id: str, user_agent: str = "", ip: str = "", referer: str = ""):
    """Log a QR code scan event to the qr_scans collection."""
    device_type = _parse_device_type(user_agent)
    now = datetime.now(timezone.utc)

    db.qr_scans.insert_one({
        "slug":        slug,
        "location_id": location_id,
        "timestamp":   now,
        "date":        now.strftime("%Y-%m-%d"),
        "hour":        now.hour,
        "user_agent":  user_agent[:500] if user_agent else "",
        "ip":          ip or "",
        "referer":     referer[:500] if referer else "",
        "device_type": device_type,
    })

    # Also increment a counter on the location doc for quick access
    db.locations.update_one(
        {"permalink_slug": slug},
        {"$inc": {"qr_scan_count": 1}, "$set": {"qr_last_scan": now}},
    )


def get_qr_scan_stats(slug: str) -> dict:
    """
    Return scan analytics for a location slug:
    - total:       total scans ever
    - by_day:      [{date, count}]  last 30 days
    - by_device:   {mobile, desktop, tablet}
    - by_hour:     [{hour, count}]  aggregated
    - recent:      last 10 scans with details
    """
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    base_filter = {"slug": slug}

    # Total count
    total = db.qr_scans.count_documents(base_filter)

    # By day (last 30 days)
    pipeline_day = [
        {"$match": {**base_filter, "timestamp": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    by_day = [{"date": r["_id"], "count": r["count"]} for r in db.qr_scans.aggregate(pipeline_day)]

    # By device type
    pipeline_device = [
        {"$match": base_filter},
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}},
    ]
    by_device = {}
    for r in db.qr_scans.aggregate(pipeline_device):
        by_device[r["_id"] or "unknown"] = r["count"]

    # By hour
    pipeline_hour = [
        {"$match": base_filter},
        {"$group": {"_id": "$hour", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    by_hour = [{"hour": r["_id"], "count": r["count"]} for r in db.qr_scans.aggregate(pipeline_hour)]

    # Recent 10
    recent_docs = list(
        db.qr_scans.find(base_filter, {"_id": 0, "slug": 0, "location_id": 0})
            .sort("timestamp", -1)
            .limit(10)
    )
    for r in recent_docs:
        if "timestamp" in r:
            r["timestamp"] = r["timestamp"].isoformat()

    return {
        "total":     total,
        "by_day":    by_day,
        "by_device": by_device,
        "by_hour":   by_hour,
        "recent":    recent_docs,
    }
