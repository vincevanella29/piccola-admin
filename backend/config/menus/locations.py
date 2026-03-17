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
    # Structured schedules (added with opening-hours feature)
    "opening_hours":  1,   # { dinein: {"1":{open,close},...}, delivery: {...} }
    "special_dates":  1,   # [{date, label, closed, open, close}]
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
