"""
Menu Options business logic.

Terminology
-----------
• Product Group  (group_type inferred: menu_id == "" or missing)
    Values ARE actual menu products (cada value.codigo = product.codigo).
    Rule: a product codigo can appear in AT MOST ONE product group.
    Rendered in the carta digital as "pick one from this set".

• Modifier Group  (group_type inferred: menu_id != "")
    Linked to ONE parent product via menu_id = product._id.
    Values are modifier options (poco queso, extra salsa, etc.).
    A product CAN have MULTIPLE modifier groups.
    A modifier group's values can have empty codigos — that's fine.
    Rendered in the carta digital as "customize your item".

Both types are stored in the same `menu_options` collection; the type is
inferred from the `menu_id` field (no separate `group_type` DB field needed).
"""

import logging
from datetime import datetime, timezone

from utils.web3mongo import db

from .helpers import serialize, get_id_query

logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _is_modifier(opt: dict) -> bool:
    """Return True if this option group is a modifier (linked to at least one parent product)."""
    mid = str(opt.get("menu_id") or "").strip()
    if mid and mid != "None":
        return True
    # Also check menu_ids array (multi-product linking)
    for x in (opt.get("menu_ids") or []):
        px = str(x).strip()
        if px and px != "None":
            return True
    return False


def _is_product_group(opt: dict) -> bool:
    return not _is_modifier(opt)


# ── read ──────────────────────────────────────────────────────────────────────

def list_menu_options() -> list:
    """Return ALL menu_options documents — always includes 'option_type' in response."""
    options = list(db.menu_options.find())
    result = []
    for o in options:
        s = serialize(o)
        # Always compute & return option_type, even if not stored in DB yet
        s["option_type"] = "modifier" if _is_modifier(o) else "product_group"
        result.append(s)
    return result


def list_product_groups() -> list:
    """Return only product-group type option groups (no menu_id)."""
    opts = list(db.menu_options.find({"$or": [{"menu_id": {"$exists": False}}, {"menu_id": ""}, {"menu_id": None}]}))
    return [serialize(o) for o in opts]


def list_modifiers() -> list:
    """Return only modifier-type option groups (have a non-empty menu_id)."""
    opts = list(db.menu_options.find({"menu_id": {"$exists": True, "$nin": ["", None]}}))
    return [serialize(o) for o in opts]


def list_modifiers_for_product(product_id: str) -> list:
    """
    Return all modifier groups linked to a specific product.
    Matches on legacy menu_id == product._id OR product._id in menu_ids array.
    """
    pid = str(product_id).strip()
    opts = list(db.menu_options.find({
        "$or": [
            {"menu_id": pid},
            {"menu_ids": pid},
        ]
    }))
    return [serialize(o) for o in opts]


# ── create ────────────────────────────────────────────────────────────────────

def create_option_group(data: dict) -> str:
    """
    Create a new menu_option group (product-group or modifier).

    data keys:
        option_name   : str   (required)
        display_type  : str   default 'select'
        required      : bool  default False
        priority      : int   default 0
        min_selected  : int   default 0
        max_selected  : int   default 1
        menu_id       : str   "" = product-group, <product._id> = modifier
        option_id     : str   optional – canonical type id
        values        : list  default []

    Auto-generates a numeric string _id (max existing + 1).
    Returns the new _id as a string.
    """
    existing = list(db.menu_options.find({}, {"_id": 1}))
    max_id = 0
    for doc in existing:
        try:
            max_id = max(max_id, int(str(doc["_id"])))
        except (ValueError, TypeError):
            pass
    new_id = str(max_id + 1)

    now = datetime.now(timezone.utc).isoformat()
    is_modifier_group = bool(
        str(data.get("menu_id", "")).strip() and
        str(data.get("menu_id", "")).strip() != "None"
    ) or bool([x for x in (data.get("menu_ids") or []) if str(x).strip() and str(x).strip() != "None"])
    doc = {
        "_id":          new_id,
        "menu_id":      data.get("menu_id", ""),
        "menu_ids":     [str(x).strip() for x in (data.get("menu_ids") or []) if str(x).strip()],
        "option_type":  "modifier" if is_modifier_group else "product_group",  # persisted
        "option_id":    data.get("option_id", new_id),
        "option_name":  data.get("option_name", "Nuevo Grupo"),
        "display_type": data.get("display_type", "select"),
        "required":     data.get("required", False),
        "priority":     int(data.get("priority", 0)),
        "min_selected": int(data.get("min_selected", 0)),
        "max_selected": int(data.get("max_selected", 1)),
        "values":       data.get("values", []),
        "created_at":   now,
        "updated_at":   now,
    }
    db.menu_options.insert_one(doc)
    return new_id


def update_option_group(option_id: str, data: dict) -> int:
    """
    Update an existing menu_option group (product-group or modifier).

    Accepts any of:
        option_name, display_type, required, priority,
        min_selected, max_selected, menu_id, menu_ids, values
    Returns matched_count.
    """
    q = get_id_query(option_id)
    existing = db.menu_options.find_one(q)
    if not existing:
        return 0

    update: dict = {}
    for key in ("option_name", "display_type", "required", "priority",
                "min_selected", "max_selected", "menu_id", "values"):
        if key in data:
            val = data[key]
            if key in ("priority", "min_selected", "max_selected"):
                val = int(val)
            update[key] = val

    if "menu_ids" in data:
        update["menu_ids"] = [str(x).strip() for x in (data["menu_ids"] or []) if str(x).strip()]

    # Recalculate option_type
    mid = str(update.get("menu_id", existing.get("menu_id", ""))).strip()
    mids = update.get("menu_ids", existing.get("menu_ids", []))
    is_modifier = bool(mid and mid != "None") or bool(
        [x for x in (mids or []) if str(x).strip() and str(x).strip() != "None"]
    )
    update["option_type"] = "modifier" if is_modifier else "product_group"
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = db.menu_options.update_one(q, {"$set": update})
    return result.matched_count


# ── link / unlink modifier ─────────────────────────────────────────────────────

def link_modifier_to_product(option_id: str, product_id: str) -> int:
    """
    Link a modifier group to a parent product by setting menu_id = product_id.
    Pass product_id="" to unlink (convert back to a product-group or standalone).
    Also updates option_type accordingly.
    Returns matched_count.
    """
    new_type = "modifier" if (str(product_id).strip() and str(product_id).strip() != "None") else "product_group"
    q = get_id_query(option_id)
    result = db.menu_options.update_one(q, {
        "$set": {
            "menu_id":      str(product_id).strip(),
            "option_type":  new_type,
            "updated_at":   datetime.now(timezone.utc),
        }
    })
    return result.matched_count


def unlink_modifier_from_product(option_id: str) -> int:
    """Remove the parent link from a modifier group (sets menu_id to "")."""
    return link_modifier_to_product(option_id, "")


# ── update / delete ───────────────────────────────────────────────────────────

def update_value(option_id: str, value_id: str, update_fields: dict) -> int:
    """Update a single value inside a menu_option."""
    set_doc = {}
    for k, v in update_fields.items():
        set_doc[f"values.$[elem].{k}"] = v
    set_doc["updated_at"] = datetime.now(timezone.utc)

    q = get_id_query(option_id)
    result = db.menu_options.update_one(
        q,
        {"$set": set_doc},
        array_filters=[{"elem.id": value_id}],
    )
    return result.matched_count


def delete_value(option_id: str, value_id: str) -> int:
    """Remove a single value from a menu_option."""
    q = get_id_query(option_id)
    result = db.menu_options.update_one(q, {"$pull": {"values": {"id": value_id}}})
    return result.matched_count


def delete_option(option_id: str) -> int:
    """Delete an entire menu_option group and all its values."""
    q = get_id_query(option_id)
    result = db.menu_options.delete_one(q)
    return result.deleted_count


def move_value(src_option_id: str, value_id: str, target_option_id: str) -> dict:
    """
    Move a value from src_option_id to target_option_id.
    Returns { moved: bool, value: dict }.
    """
    src_q = get_id_query(src_option_id)
    dst_q = get_id_query(target_option_id)

    src = db.menu_options.find_one(src_q)
    if not src:
        return {"moved": False, "error": "Source option not found"}
    value = next((v for v in (src.get("values") or []) if str(v.get("id")) == str(value_id)), None)
    if not value:
        return {"moved": False, "error": "Value not found in source option"}

    db.menu_options.update_one(src_q, {"$pull": {"values": {"id": value_id}}})
    db.menu_options.update_one(dst_q, {
        "$push": {"values": value},
        "$set": {"updated_at": datetime.now(timezone.utc)},
    })
    return {"moved": True, "value": value}


# ── duplicate detection (product-groups only) ─────────────────────────────────

def find_duplicate_codigos() -> dict:
    """
    Scan menu_options.values[].codigo only across PRODUCT-GROUP type options
    (menu_id empty / None) and return every codigo that appears in more than
    one group.

    Modifier groups are intentionally excluded: the same product can legitimately
    appear as an option in multiple modifier groups (e.g. 'Bebida' in two
    different modifier sets).
    """
    from collections import defaultdict
    all_opts = list(db.menu_options.find())
    # Only product groups: menu_id is empty / absent / 'None'
    product_groups = [o for o in all_opts if _is_product_group(o)]

    mapping: dict = defaultdict(list)
    for opt in product_groups:
        for val in (opt.get("values") or []):
            code = str(val.get("codigo") or "").strip()
            if not code or code == "None":
                continue
            mapping[code].append({
                "option_id":   str(opt.get("_id")),
                "option_name": opt.get("option_name", ""),
                "value_id":    str(val.get("id", "")),
                "value_name":  val.get("name", ""),
                "is_modifier": False,
            })

    dups = {k: v for k, v in mapping.items() if len(v) > 1}
    extra = sum(len(v) - 1 for v in dups.values())
    return {
        "duplicates": dups,
        "total_duplicate_codigos": len(dups),
        "total_extra_occurrences": extra,
    }


def bulk_remove_duplicate_values(dry_run: bool = False) -> dict:
    """
    Remove duplicates from PRODUCT-GROUP type options only.
    Modifier groups are excluded: their values CAN legitimately repeat
    across different modifier sets.
    """
    return bulk_remove_duplicate_values_in_product_groups(dry_run=dry_run, all_groups=False)


def bulk_remove_duplicate_values_in_product_groups(dry_run: bool = False, all_groups: bool = False) -> dict:
    """
    For each codigo that appears in more than one product-group:
      - Keep the FIRST occurrence (lowest numeric option _id)
      - Remove all subsequent occurrences

    If all_groups=True, considers modifier groups too (used by the manual panel).
    If all_groups=False (default / called from clean_database_duplicates),
    only product-groups are checked — modifier group values are untouched.

    Returns report of deleted values.
    """
    from collections import defaultdict
    all_opts = list(db.menu_options.find())

    # Sort by _id numerically to get deterministic 'first' order
    try:
        all_opts.sort(key=lambda o: int(str(o.get("_id", 0))))
    except Exception:
        pass

    # Filter to relevant group types
    if not all_groups:
        all_opts = [o for o in all_opts if _is_product_group(o)]

    seen_codes: set = set()
    to_delete: list = []

    for opt in all_opts:
        for val in (opt.get("values") or []):
            code = str(val.get("codigo") or "").strip()
            if not code or code == "None":
                continue
            if code in seen_codes:
                to_delete.append({
                    "option_id":   str(opt.get("_id")),
                    "option_name": opt.get("option_name", ""),
                    "value_id":    str(val.get("id", "")),
                    "value_name":  val.get("name", ""),
                    "codigo":      code,
                })
            else:
                seen_codes.add(code)

    if not dry_run:
        for item in to_delete:
            q = get_id_query(item["option_id"])
            db.menu_options.update_one(q, {"$pull": {"values": {"id": item["value_id"]}}})

    return {
        "dry_run":       dry_run,
        "deleted_count": len(to_delete),
        "deleted":       to_delete,
    }
