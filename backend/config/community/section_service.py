import logging
from typing import Optional
from utils.web3mongo import db
from utils.time_utils import get_chile_time

logger = logging.getLogger(__name__)

DEFAULT_SECTION_PERMS = {
    "can_create_groups": True,
    "can_create_channels": False,
    "can_post_announcements": False,
    "can_upload_media": True,
    "can_invite_members": True,
    "can_pin_messages": False,
    "max_groups": 5,
}

def get_all_section_perms():
    cursor = db.cargos_intranet.find({}, {"_id": 0, "seccion": 1})
    all_sections = sorted({(doc.get("seccion") or "").strip() for doc in cursor if doc.get("seccion")})

    stored = {
        doc["seccion"]: doc
        for doc in db.community_section_perms.find({}, {"_id": 0})
        if doc.get("seccion")
    }

    result = []
    for sec in all_sections:
        doc = stored.get(sec, {})
        entry = {"seccion": sec}
        for k, default_val in DEFAULT_SECTION_PERMS.items():
            entry[k] = doc.get(k, default_val)
        entry["color"] = doc.get("color")
        entry["updated_by"] = doc.get("updated_by")
        entry["updated_at"] = doc.get("updated_at")
        result.append(entry)

    return result


def update_section_permissions(seccion: str, data: dict, admin_wallet: str):
    update = {}
    for field in ("can_create_groups", "can_create_channels", "can_post_announcements",
                  "can_upload_media", "can_invite_members", "can_pin_messages", "max_groups", "color"):
        val = data.get(field)
        if val is not None:
            update[field] = val

    if not update:
        return False

    update["updated_by"] = admin_wallet
    update["updated_at"] = get_chile_time()

    db.community_section_perms.update_one(
        {"seccion": seccion},
        {"$set": {**update, "seccion": seccion}},
        upsert=True,
    )

    logger.info(f"Section perms updated: {seccion} by {admin_wallet}")
    return True


def get_section_perms(seccion: str) -> dict:
    if not seccion:
        return dict(DEFAULT_SECTION_PERMS)
    doc = db.community_section_perms.find_one({"seccion": seccion}, {"_id": 0})
    result = dict(DEFAULT_SECTION_PERMS)
    if doc:
        for k in DEFAULT_SECTION_PERMS:
            if k in doc:
                result[k] = doc[k]
    return result
