"""
Public catalog API logic.

Options are resolved by TWO strategies — both are active simultaneously:

  Strategy A (Type 2 — Product Groups):
    product.codigo appears as a VALUE in an option group
    → that group is embedded in the product.
    Use case: "Postres" group has values = [Brownie, Vulcano] — those products
    each get the Postres group attached so the digital menu can up-sell.

  Strategy B (Type 1 — Modifiers, linked via menu_id):
    option group has menu_id = product._id
    → that group is embedded in the parent product.
    Use case: Lasagna has modifier groups (Salsas, Quesos) created with menu_id=lasagna._id.

  Both lists are merged and deduplicated per product by option_id.

Each product returned carries:
  - media_images  : [url1, url2, url3, url4]  (up to 4 images)
  - media_video   : video URL or null
  - options       : merged list from both strategies
"""

import logging
from collections import defaultdict

from utils.web3mongo import db
from .helpers import serialize, get_ts

logger = logging.getLogger(__name__)

EXTERNAL_API_KEY = "1fSypihaCuh9g.ql4Ly8qqw7Usa3OMWRUVlM3YvO9eo1EDAVB_vkN3A0A"


def _build_options_indexes() -> tuple:
    """
    Load all menu_options once and return TWO indexes:

    by_codigo  : { product_codigo:  [option_group_doc, ...] }  (Strategy A)
    by_menu_id : { product_str_id:  [option_group_doc, ...] }  (Strategy B)

    Dedup key = option_id (canonical type) to avoid duplicate groups.
    """
    raw = list(db.menu_options.find())
    by_codigo: dict = defaultdict(list)
    by_menu_id: dict = defaultdict(list)
    seen_codigo: dict = defaultdict(set)
    seen_menuId: dict = defaultdict(set)

    for opt in raw:
        s = serialize(opt)
        dedup_key = str(opt.get("option_id") or opt.get("_id") or "")
        mid = str(opt.get("menu_id") or "").strip()
        is_mod = bool(mid and mid not in ("", "None"))

        # Strategy A: index by value.codigo → always product_group unless has menu_id
        for value in (opt.get("values") or []):
            codigo = str(value.get("codigo") or "").strip()
            if not codigo or codigo == "None":
                continue
            if dedup_key not in seen_codigo[codigo]:
                seen_codigo[codigo].add(dedup_key)
                entry = dict(s)
                entry["option_type"] = "modifier" if is_mod else "product_group"
                by_codigo[codigo].append(entry)

        # Strategy B: index by menu_id → always modifier
        if is_mod:
            if dedup_key not in seen_menuId[mid]:
                seen_menuId[mid].add(dedup_key)
                entry = dict(s)
                entry["option_type"] = "modifier"
                by_menu_id[mid].append(entry)

    # Sort each list by priority
    for lst in list(by_codigo.values()) + list(by_menu_id.values()):
        lst.sort(key=lambda o: int(o.get("priority") or 0))

    return dict(by_codigo), dict(by_menu_id)


def _embed_options_and_media(product: dict, by_codigo: dict, by_menu_id: dict) -> dict:
    """
    Attach option groups to a product using BOTH strategies (merged + deduped).
    Each option has 'option_type':
      - Uses the stored DB value if present (new documents have it persisted).
      - Falls back to computing it from menu_id if the field is missing (old docs).
    """
    codigo = str(product.get("codigo") or "").strip()
    pid    = str(product.get("id")     or product.get("_id") or "").strip()

    from_menu_id = []
    for o in (by_menu_id.get(pid, []) if pid else []):
        tagged = dict(o)
        tagged["option_type"] = "modifier"
        from_menu_id.append(tagged)

    from_codigo = []
    for o in (by_codigo.get(codigo, []) if codigo else []):
        tagged = dict(o)
        mid = str(o.get("menu_id") or "").strip()
        tagged["option_type"] = "modifier" if (mid and mid != "None") else "product_group"
        from_codigo.append(tagged)

    # Merge deduped by option_id — modifiers (B) take priority
    seen_ids = set()
    merged = []
    for o in from_menu_id + from_codigo:
        key = str(o.get("option_id") or o.get("id") or o.get("_id") or "")
        if key not in seen_ids:
            seen_ids.add(key)
            merged.append(o)

    product["options"] = merged

    # ── Media normalisation ───
    imgs = product.get("media_images") or []
    if not imgs and product.get("media_r2"):
        imgs = [product["media_r2"]]
    elif not imgs and product.get("media_url"):
        imgs = [product["media_url"]]
    product["media_images"] = imgs[:4]

    if "media_video" not in product:
        product["media_video"] = None

    return product



def _build_sales_index() -> dict:
    """Build { codigo: { mesano, total, por_local: {location_id: qty} } }.

    Uses ventas_producto_dia_hora_cprodu which has per-location sales data.
    The 'local' field in that collection matches location.permalink_slug (e.g. PRVLOC).

    Rules:
      - Only 'cantidad' (units sold) — NO revenue, margin, or cost exposed.
      - Walks backwards up to 6 months to find the FIRST month with ANY sales globally.
      - por_local is keyed by location_id (not slug), for frontend consumption.
    """
    from datetime import datetime

    now = datetime.now()

    # Build candidate periods (integers in this collection)
    candidates = []
    y, m = now.year, now.month
    for _ in range(6):
        candidates.append(int(f"{y}{str(m).zfill(2)}"))
        m -= 1
        if m < 1:
            m = 12
            y -= 1

    # Find which candidate periods have data
    try:
        existing = db.ventas_producto_dia_hora_cprodu.distinct(
            "mesano", {"mesano": {"$in": candidates}}
        )
    except Exception as e:
        logger.warning(f"[public_catalog] sales_index distinct error: {e}")
        return {}

    if not existing:
        return {}

    existing_set = set(existing)
    target_period = None
    for c in candidates:
        if c in existing_set:
            target_period = c
            break

    if not target_period:
        return {}

    logger.info(f"[public_catalog] sales_index using period: {target_period}")

    # Build permalink_slug → location_id mapping
    slug_to_lid: dict = {}
    for loc in db.locations.find({}, {"_id": 1, "permalink_slug": 1}):
        slug = loc.get("permalink_slug", "").strip()
        if slug:
            slug_to_lid[slug] = str(loc["_id"])

    pipeline = [
        {"$match": {"mesano": target_period}},
        {"$group": {
            "_id":     {"codigo": "$codigo", "local": "$local"},
            "cantidad": {"$sum": "$cantidad"},
        }},
    ]

    idx: dict = {}
    try:
        for doc in db.ventas_producto_dia_hora_cprodu.aggregate(pipeline):
            cod   = str(doc["_id"].get("codigo") or "").strip()
            slug  = str(doc["_id"].get("local") or "").strip()
            qty   = int(doc.get("cantidad") or 0)
            if not cod:
                continue
            if cod not in idx:
                idx[cod] = {"mesano": str(target_period), "total": 0, "por_local": {}}
            idx[cod]["total"] += qty
            lid = slug_to_lid.get(slug)
            if lid:
                idx[cod]["por_local"][lid] = idx[cod]["por_local"].get(lid, 0) + qty
    except Exception as e:
        logger.warning(f"[public_catalog] sales_index error: {e}")
        return {}

    return idx



def get_public_catalog(api_key: str) -> dict:
    """
    Único endpoint público de la carta digital.

    Autenticación: X-API-Key header con EXTERNAL_API_KEY.

    Devuelve:
      - categories : lista con menús anidados (cada menú incluye options, media, sales_units)
      - products   : lista plana deduplicada
      - locations  : sucursales con TODOS los campos del documento:
                       nombre, direccion, email, city, state, postcode,
                       telephone, lat, lng, status, permalink_slug,
                       media_r2, media_logo, custom_buttons, menu_ids, horario, color
    """
    if api_key != EXTERNAL_API_KEY:
        raise PermissionError("Invalid API Key")

    categories = list(db.categories.find().sort("prioridad", 1))
    products   = list(db.menus.find().sort("prioridad", 1))

    # Build BOTH indexes in one pass
    by_codigo, by_menu_id = _build_options_indexes()

    # Build sales index (quantities only, no money)
    sales_idx = _build_sales_index()

    # Deduplicate products by 'id' / '_id'
    menus_by_id: dict = {}
    for p in products:
        mid = str(p.get("id") or p.get("_id") or "")
        if not mid:
            continue
        existing = menus_by_id.get(mid)
        if existing is None or get_ts(p) > get_ts(existing):
            menus_by_id[mid] = serialize(p)

    # Embed options + normalize media + attach sales_units on every product
    for mid in menus_by_id:
        prod = _embed_options_and_media(menus_by_id[mid], by_codigo, by_menu_id)
        codigo = str(prod.get("codigo") or "").strip()
        prod["sales_units"] = sales_idx.get(codigo)  # {mesano, total, por_local} or None
        menus_by_id[mid] = prod

    # Build category output with nested menus
    categories_out = []
    for c in categories:
        c_out = serialize(c)
        menu_ids = [str(x) for x in (c.get("menu_ids") or [])]
        cat_menus = [menus_by_id[mid] for mid in menu_ids if mid in menus_by_id]
        cat_menus.sort(key=lambda x: int(x.get("prioridad") or 0))
        c_out["menus"] = cat_menus
        # Ensure menu_type is always present (defaults to 'carta')
        if "menu_type" not in c_out or not c_out.get("menu_type"):
            c_out["menu_type"] = "carta"
        categories_out.append(c_out)

    # Build locations output with ALL rich fields from the DB document
    locations_out = []
    for loc in db.locations.find({}):
        s = serialize(loc)
        # Guarantee media_r2 falls back to media_url if missing
        if not s.get("media_r2") and s.get("media_url"):
            s["media_r2"] = s["media_url"]
        locations_out.append({
            "id":             s.get("id", ""),
            "nombre":         s.get("nombre", ""),
            "direccion":      s.get("direccion", ""),
            "email":          s.get("email", ""),
            "city":           s.get("city", ""),
            "state":          s.get("state", ""),
            "postcode":       s.get("postcode", ""),
            "telephone":      s.get("telephone", ""),
            "telefono":       s.get("telefono", ""),   # alias editable desde el admin
            "lat":            s.get("lat"),
            "lng":            s.get("lng"),
            "status":         s.get("status", False),
            "permalink_slug": s.get("permalink_slug", ""),
            "media_r2":       s.get("media_r2", ""),
            "media_logo":     s.get("media_logo", ""),
            "media_url":      s.get("media_url", ""),
            "custom_buttons": s.get("custom_buttons", []),
            "menu_ids":       s.get("menu_ids", []),
            "media_ids":      s.get("media_ids", []),
            "horario":        s.get("horario", ""),
            "color":          s.get("color", ""),
            # Structured schedules
            "opening_hours":  s.get("opening_hours", {}),
            "special_dates":  s.get("special_dates", []),
            # QR
            "qr_url":          s.get("qr_url", ""),
            "qr_redirect_url": s.get("qr_redirect_url", ""),
            "created_at":     s.get("created_at"),
            "updated_at":     s.get("updated_at"),
        })


    return {
        "categories": categories_out,
        "products":   list(menus_by_id.values()),
        "locations":  locations_out,
    }

