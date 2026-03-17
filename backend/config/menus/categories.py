"""
Categories business logic.
"""

import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from bson import ObjectId
from utils.web3mongo import db

from .helpers import serialize, get_id_query, sync_to_frontend

logger = logging.getLogger(__name__)


def list_categories(only_active: bool = False) -> list:
    query: dict[str, Any] = {}
    if only_active:
        query["estado"] = True
    categories = list(db.categories.find(query).sort("prioridad", 1))
    return [serialize(c) for c in categories]


def get_category(category_id: str) -> dict:
    doc = db.categories.find_one(get_id_query(category_id))
    return serialize(doc) if doc else None


async def create_category(doc: dict) -> str:
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = doc["created_at"]
    result = db.categories.insert_one(doc)
    db.categories.update_one({"_id": result.inserted_id}, {"$set": {"id": str(result.inserted_id)}})
    await sync_to_frontend()
    return str(result.inserted_id)


async def update_category(category_id: str, update_fields: dict) -> int:
    update_fields["updated_at"] = datetime.now(timezone.utc)
    logger.info(f"Updating category {category_id} with fields: {list(update_fields.keys())}")
    result = db.categories.update_one(get_id_query(category_id), {"$set": update_fields})
    logger.info(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
    await sync_to_frontend()
    return result.matched_count


async def delete_category(category_id: str) -> int:
    result = db.categories.delete_one(get_id_query(category_id))
    await sync_to_frontend()
    return result.deleted_count


async def bulk_delete_categories(ids: List[str]) -> int:
    ids_to_select = []
    object_ids = []
    numeric_ids = []
    for cid in ids:
        try:
            object_ids.append(ObjectId(cid))
        except Exception:
            pass
        ids_to_select.append(cid)
        try:
            numeric_ids.append(int(cid))
        except Exception:
            pass

    query = {"$or": [
        {"_id": {"$in": object_ids}},
        {"_id": {"$in": ids_to_select}},
        {"id": {"$in": ids_to_select}},
        {"id": {"$in": numeric_ids}}
    ]}
    result = db.categories.delete_many(query)
    await sync_to_frontend()
    return result.deleted_count
