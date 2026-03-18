"""
Menu Types — business logic + migration.

Each category belongs to a menu_type (slug). Defaults: carta, promociones, ora_felice, bar.
"""

import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from utils.web3mongo import db
from .helpers import serialize

logger = logging.getLogger(__name__)

# ── Default menu types ─────────────────────────────────────────────────────────

DEFAULTS = [
    {"slug": "carta",       "name": "Carta Principal", "icon": "BookOpen", "color": "#4CAF50", "is_default": True,  "priority": 0},
    {"slug": "promociones", "name": "Promociones",     "icon": "Zap",      "color": "#FF9800", "is_default": False, "priority": 1},
    {"slug": "ora_felice",  "name": "Ora Felice",      "icon": "Clock",    "color": "#9C27B0", "is_default": False, "priority": 2},
    {"slug": "bar",         "name": "Carta Bar",        "icon": "Wine",     "color": "#E91E63", "is_default": False, "priority": 3},
]


def ensure_defaults():
    """
    Called on app startup — ensures menu_types collection has the defaults
    and all categories have a menu_type field.
    Safe to call multiple times (idempotent).
    """
    # 1. Upsert default menu types
    for d in DEFAULTS:
        d_with_ts = {**d, "created_at": datetime.now(timezone.utc)}
        db.menu_types.update_one(
            {"slug": d["slug"]},
            {"$setOnInsert": d_with_ts},
            upsert=True,
        )

    # 2. Migrate existing categories: add menu_type="carta" if missing
    result = db.categories.update_many(
        {"menu_type": {"$exists": False}},
        {"$set": {"menu_type": "carta"}},
    )
    if result.modified_count > 0:
        logger.info(f"[menu_types] Migrated {result.modified_count} categories → menu_type='carta'")

    logger.info(f"[menu_types] Defaults ensured. {db.menu_types.count_documents({})} menu types in DB.")


# ── CRUD ───────────────────────────────────────────────────────────────────────

def list_menu_types() -> list:
    """Return all menu types sorted by priority."""
    docs = list(db.menu_types.find().sort("priority", 1))
    return [serialize(d) for d in docs]


def get_menu_type(slug: str) -> Optional[dict]:
    doc = db.menu_types.find_one({"slug": slug})
    return serialize(doc) if doc else None


def create_menu_type(data: dict) -> str:
    slug = data.get("slug", "").strip().lower().replace(" ", "_")
    if not slug:
        raise ValueError("slug is required")
    if db.menu_types.find_one({"slug": slug}):
        raise ValueError(f"Menu type '{slug}' already exists")

    doc = {
        "slug":       slug,
        "name":       data.get("name", slug).strip(),
        "icon":       data.get("icon", "BookOpen"),
        "color":      data.get("color", "#607D8B"),
        "is_default": False,
        "priority":   int(data.get("priority", 99)),
        "created_at": datetime.now(timezone.utc),
    }
    db.menu_types.insert_one(doc)
    logger.info(f"[menu_types] Created: {slug}")
    return slug


def update_menu_type(slug: str, data: dict) -> int:
    allowed = {"name", "icon", "color", "priority"}
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        return 0
    update["updated_at"] = datetime.now(timezone.utc)
    result = db.menu_types.update_one({"slug": slug}, {"$set": update})
    return result.matched_count


def delete_menu_type(slug: str) -> dict:
    """Delete a menu type. Cannot delete the default. Moves categories to 'carta'."""
    mt = db.menu_types.find_one({"slug": slug})
    if not mt:
        return {"deleted": False, "error": "not_found"}
    if mt.get("is_default"):
        return {"deleted": False, "error": "cannot_delete_default"}

    # Move categories with this type to 'carta'
    moved = db.categories.update_many(
        {"menu_type": slug},
        {"$set": {"menu_type": "carta"}},
    )
    db.menu_types.delete_one({"slug": slug})
    logger.info(f"[menu_types] Deleted '{slug}', moved {moved.modified_count} categories to 'carta'")
    return {"deleted": True, "moved_categories": moved.modified_count}
