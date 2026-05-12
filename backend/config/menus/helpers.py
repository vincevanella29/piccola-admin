"""
Shared helpers for the Carta management system.
"""

import logging
import requests
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from utils.web3mongo import db

logger = logging.getLogger(__name__)


def serialize(doc: dict) -> dict:
    """Convert ObjectId and datetime to JSON-serializable values."""
    if not doc:
        return {}
    doc = dict(doc)
    if "_id" in doc:
        str_id = str(doc.pop("_id"))
        if "id" not in doc:
            doc["id"] = str_id
    elif "id" in doc:
        doc["id"] = str(doc["id"])

    for field in ("created_at", "updated_at"):
        if doc.get(field) and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()
    return doc


def get_id_query(id_str: str) -> dict:
    """Return a robust $or query to match a document by various ID formats."""
    query_match = {"$or": [
        {"id": id_str},
        {"_id": id_str}
    ]}
    try:
        query_match["$or"].append({"_id": ObjectId(id_str)})
    except Exception:
        pass
    try:
        fval = float(id_str)
        query_match["$or"].append({"id": fval})
        if fval == int(fval):
            query_match["$or"].append({"id": int(fval)})
    except Exception:
        pass
    return query_match


def clean_price(value: Any) -> float:
    """Ensure price is a clean float. Handles strings with dots/commas."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip()
    if not s:
        return 0.0

    # Remove dots (common Chilean thousand separator)
    s = s.replace(".", "")
    # Replace comma with dot for decimal
    s = s.replace(",", ".")

    try:
        return float(s)
    except (ValueError, TypeError):
        logger.warning(f"Could not parse price value: {value}")
        return 0.0


async def sync_to_frontend():
    """Notify the frontend to sync its catalog + delivery providers."""
    import asyncio

    frontend_url = "https://cartadigital.lapiccolaitalia.cl/api"
    sync_url = f"{frontend_url}/catalog/sync"
    logger.info(f"Triggering sync notification to frontend: {sync_url}")
    try:
        resp = requests.post(sync_url, timeout=5)
        logger.info(f"Frontend notification response: {resp.status_code}")
    except Exception as e:
        logger.error(f"Error notifying frontend sync at {sync_url}: {e}")

    # Fire-and-forget delivery provider sync
    try:
        from .sync import _sync_delivery_providers
        asyncio.create_task(_sync_delivery_providers())
    except Exception as e:
        logger.warning(f"[sync_to_frontend] delivery provider sync skipped: {e}")


def get_ts(doc):
    """Extract a numeric timestamp from a document for sorting."""
    ts = doc.get("updated_at") or doc.get("created_at")
    if hasattr(ts, "timestamp"):
        return ts.timestamp()
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp()
        except Exception:
            return 0
    return 0
