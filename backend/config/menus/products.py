"""
Product (menus) business logic.
"""

import io as _io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

import httpx as _httpx
from bson import ObjectId
from utils.r2_upload import upload_to_r2
from utils.web3mongo import db

from .helpers import serialize, get_id_query, clean_price, sync_to_frontend

logger = logging.getLogger(__name__)

from collections import defaultdict as _dd

def _build_options_indexes() -> tuple:
    """
    Build TWO reverse indexes for embedding options into products:

    by_codigo  : { product_codigo: [option_doc, ...] }  — Strategy A (Product Groups)
                 Option appears here when product.codigo is a VALUE in the group.
                 These are PRODUCT GROUPS (menu_id is empty).

    by_menu_id : { product_id: [option_doc, ...] }      — Strategy B (Modifiers)
                 Option appears here when option.menu_id == product._id.
                 These are MODIFIERS linked to a specific parent product.

    Each returned doc already has 'option_type' set.
    """
    raw = list(db.menu_options.find())
    by_codigo: dict = _dd(list)
    by_menu_id: dict = _dd(list)
    seen_codigo: dict = _dd(set)
    seen_menuId: dict = _dd(set)

    for opt in raw:
        s = serialize(opt)
        dedup_key = str(opt.get("option_id") or opt.get("_id") or "")
        mid = str(opt.get("menu_id") or "").strip()
        is_mod = bool(mid and mid != "None")

        # Strategy A: index by value.codigo → product_group
        for value in (opt.get("values") or []):
            codigo = str(value.get("codigo") or "").strip()
            if not codigo or codigo == "None":
                continue
            if dedup_key not in seen_codigo[codigo]:
                seen_codigo[codigo].add(dedup_key)
                tagged = dict(s)
                tagged["option_type"] = "modifier" if is_mod else "product_group"
                by_codigo[codigo].append(tagged)

        # Strategy B: index by menu_id → modifier
        if is_mod:
            if dedup_key not in seen_menuId[mid]:
                seen_menuId[mid].add(dedup_key)
                tagged = dict(s)
                tagged["option_type"] = "modifier"
                by_menu_id[mid].append(tagged)

    # Sort each list by priority
    for lst in list(by_codigo.values()) + list(by_menu_id.values()):
        lst.sort(key=lambda o: int(o.get("priority") or o.get("prioridad") or 0))

    return dict(by_codigo), dict(by_menu_id)


def _embed_options_and_media(product: dict, options_by_codigo: dict,
                             options_by_menu_id: dict = None) -> dict:
    """
    Attach option groups to a product using BOTH strategies (merged + deduped).
    Each option has 'option_type': 'modifier' | 'product_group'.
    """
    codigo = str(product.get("codigo") or "").strip()
    pid    = str(product.get("id") or product.get("_id") or "").strip()

    from_menu_id = (options_by_menu_id or {}).get(pid, []) if pid else []
    from_codigo  = options_by_codigo.get(codigo, []) if codigo else []

    # Merge, deduped by option_id — modifiers (B) take priority
    seen_ids = set()
    merged = []
    for o in from_menu_id + from_codigo:
        key = str(o.get("option_id") or o.get("id") or o.get("_id") or "")
        if key not in seen_ids:
            seen_ids.add(key)
            merged.append(o)

    product["options"] = merged

    imgs = product.get("media_images") or []
    if not imgs and product.get("media_r2"):
        imgs = [product["media_r2"]]
    elif not imgs and product.get("media_url"):
        imgs = [product["media_url"]]
    product["media_images"] = imgs[:4]

    if "media_video" not in product:
        product["media_video"] = None

    return product



# ── List ──────────────────────────────────────────────────────────────────

def list_products(search: Optional[str], category_id: Optional[str],
                  only_active: bool, skip: int, limit: int) -> list:
    """List products with optional filters. Enriches with menu options and unused AI images."""
    query: dict[str, Any] = {}
    if only_active:
        query["estado"] = True
    if category_id:
        query["category_ids"] = category_id
    if search:
        query["nombre"] = {"$regex": search, "$options": "i"}

    products = list(db.menus.find(query).sort("prioridad", 1).skip(skip).limit(limit))

    # Build BOTH indexes ONCE for all products
    options_by_codigo, options_by_menu_id = _build_options_indexes()

    # Enrich with unused AI images
    p_ids = []
    for p in products:
        pid = str(p.get("id") or p.get("_id") or "")
        if pid:
            p_ids.append(pid)
            try:
                p_ids.append(int(pid))
            except Exception:
                pass

    ai_gens = list(db.ai_imagen_generations.find({
        "product_id": {"$in": p_ids},
        "accepted": {"$ne": False}
    }, {"_id": 0, "product_id": 1, "image_url": 1}))

    ai_by_pid = {}
    for g in ai_gens:
        pid_str = str(g.get("product_id", ""))
        ai_by_pid.setdefault(pid_str, []).append(g.get("image_url"))

    result = []
    for p in products:
        pid = str(p.get("id") or p.get("_id") or "")
        s = serialize(p)
        # Embed options + normalize media (correct direction: menu_id → product)
        s = _embed_options_and_media(s, options_by_codigo, options_by_menu_id)
        # Attach unused AI images
        local_gallery = set(s.get("media_images") or [])
        if s.get("media_r2"):
            local_gallery.add(s["media_r2"])
        ai_urls = ai_by_pid.get(pid, [])
        unused = [u for u in ai_urls if u and u not in local_gallery]
        s["unused_ai_images"] = list(dict.fromkeys(unused))  # dedup preserve order
        result.append(s)

    return result


# ── Get ──────────────────────────────────────────────────────────────────────

def get_product(product_id: str) -> dict:
    doc = db.menus.find_one(get_id_query(product_id))
    if not doc:
        return None
    s = serialize(doc)
    options_by_codigo, options_by_menu_id = _build_options_indexes()
    return _embed_options_and_media(s, options_by_codigo, options_by_menu_id)


# ── Create ───────────────────────────────────────────────────────────────────

async def create_product(doc: dict) -> str:
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = doc["created_at"]
    result = db.menus.insert_one(doc)
    db.menus.update_one({"_id": result.inserted_id}, {"$set": {"id": str(result.inserted_id)}})
    await sync_to_frontend()
    return str(result.inserted_id)


# ── Update ───────────────────────────────────────────────────────────────────

async def update_product(product_id: str, update_fields: dict) -> int:
    if "precio" in update_fields:
        update_fields["precio"] = clean_price(update_fields["precio"])
    update_fields["updated_at"] = datetime.now(timezone.utc)

    logger.info(f"Updating product {product_id} with fields: {list(update_fields.keys())}")
    result = db.menus.update_one(get_id_query(product_id), {"$set": update_fields})
    logger.info(f"Update result: matched={result.matched_count}, modified={result.modified_count}")

    await sync_to_frontend()
    return result.matched_count


# ── Delete ───────────────────────────────────────────────────────────────────

async def delete_product(product_id: str):
    db.menus.delete_one(get_id_query(product_id))
    await sync_to_frontend()


async def bulk_delete_products(ids: List[str]) -> int:
    ids_to_select = []
    object_ids = []
    numeric_ids = []
    for pid in ids:
        try:
            object_ids.append(ObjectId(pid))
        except Exception:
            pass
        ids_to_select.append(pid)
        try:
            numeric_ids.append(int(pid))
        except Exception:
            pass

    query = {"$or": [
        {"_id": {"$in": object_ids}},
        {"_id": {"$in": ids_to_select}},
        {"id": {"$in": ids_to_select}},
        {"id": {"$in": numeric_ids}}
    ]}
    result = db.menus.delete_many(query)
    await sync_to_frontend()
    return result.deleted_count


# ── Upload image ─────────────────────────────────────────────────────────────

def upload_image(file_obj, filename: str, content_type: str) -> str:
    ext = os.path.splitext(filename or "image.webp")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise ValueError("Invalid file type")
    key = f"carta/products/{uuid.uuid4()}{ext}"
    return upload_to_r2(file_obj, key, content_type=content_type or "image/webp")


def upload_video(file_obj, filename: str, content_type: str) -> str:
    """Upload a product video file to R2. Accepts mp4, mov, webm."""
    ext = os.path.splitext(filename or "video.mp4")[1].lower()
    if ext not in (".mp4", ".mov", ".webm"):
        raise ValueError("Tipo de archivo inválido — solo mp4, mov o webm")
    key = f"carta/videos/{uuid.uuid4()}{ext}"
    ct = content_type or ("video/mp4" if ext == ".mp4" else "video/webm")
    return upload_to_r2(file_obj, key, content_type=ct, public=True)



# ── Organize media gallery ───────────────────────────────────────────────────

async def organize_media(product_id: str, images: List[str], video_url: Optional[str]) -> dict:
    """
    Promote gallery images to canonical CDN paths:
      images[0] → menu_images/{product_id}.webp         (principal)
      images[1] → menu_images/{product_id}-2.webp
      ...
    """
    # Deduplicate images (strip query params for comparison, keep first occurrence)
    raw_imgs = (images or [])[:4]
    seen_bases = set()
    images = []
    for url in raw_imgs:
        base = url.split("?")[0] if url else ""
        if base and base not in seen_bases:
            seen_bases.add(base)
            images.append(url)
    if not images:
        raise ValueError("Debe haber al menos una imagen")

    async def _download(url: str) -> bytes:
        async with _httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(url)
            r.raise_for_status()
            return r.content

    async def _upload_slot(raw: bytes, key: str) -> str:
        return upload_to_r2(_io.BytesIO(raw), key=key, content_type="image/webp", public=True)

    # 1. Download ALL raw images first
    raw_images = []
    for i, src_url in enumerate(images):
        try:
            raw = await _download(src_url)
            raw_images.append(raw)
        except Exception as e:
            logger.error(f"[organize] Error slot {i} ({src_url}): {e}")
            raise RuntimeError(f"Error descargando imagen {i}: {e}")

    # 2. Upload ALL to canonical paths
    final_urls: list[str] = []
    for i, raw in enumerate(raw_images):
        suffix = "" if i == 0 else f"-{i + 1}"
        key = f"menu_images/{product_id}{suffix}.webp"
        try:
            base_url = await _upload_slot(raw, key)
            final_urls.append(base_url)
            logger.info(f"[organize] slot {i} → {key} ({len(raw) // 1000}KB)")
        except Exception as e:
            logger.error(f"[organize] Error subiendo imagen {i}: {e}")
            raise RuntimeError(f"Error subiendo imagen {i}: {e}")

    principal = final_urls[0]

    # Update product in MongoDB
    q = {"$or": [{"id": product_id}]}
    try:
        q["$or"].append({"_id": ObjectId(product_id)})
    except Exception:
        pass

    now_ts = datetime.now(timezone.utc)
    db.menus.update_one(q, {"$set": {
        "media_r2": principal,
        "media_url": principal,
        "media_images": final_urls,
        "media_video": video_url or "",
        "updated_at": now_ts,
    }})

    await sync_to_frontend()

    logger.info(f"[organize] Producto {product_id} → principal={principal} extras={final_urls[1:]}")
    return {
        "success": True,
        "principal": principal,
        "images": final_urls,
        "video_url": video_url,
        "updated_at": now_ts.isoformat()
    }
