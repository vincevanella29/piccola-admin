
import os
import re
import logging
from typing import List, Dict, Any
from telegram.constants import ParseMode
from io import BytesIO
from PIL import Image
import requests

from utils.web3mongo import db
from ..common.filters import grok_filters

logger = logging.getLogger(__name__)


def _norm_str(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()


def _img_ext(u: str) -> str:
    u = (u or "").split("?")[0]
    if "." in u:
        return u.rsplit(".", 1)[-1].lower()
    return ""


def _contains(hay: str, needle: str) -> bool:
    try:
        return needle.lower() in hay.lower()
    except Exception:
        return False


def _index_by_id(rows: List[dict]) -> Dict[str, dict]:
    out = {}
    for r in rows:
        _id = _norm_str(r.get("id") or r.get("_id"))
        if _id:
            out[_id] = r
    return out


def _wants_detail_menus(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in [
        "detalle", "detall", "¿cuál es", "cual es", "muéstrame", "muestrame", "foto", "imagen"
    ])


def _menu_detail_block(m: dict, cat_by_id: Dict[str, dict]) -> str:
    nombre = _norm_str(m.get("nombre"))
    codigo = _norm_str(m.get("codigo"))
    precio = m.get("precio")
    currency = _norm_str(m.get("currency") or "$")
    descr = _norm_str(m.get("descripcion") or m.get("description"))
    cat_ids = [ _norm_str(x) for x in (m.get("category_ids") or []) ]
    cat_names = [ _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name"))
                  for cid in cat_ids if cid in cat_by_id ]
    img = _norm_str(m.get("media_r2") or m.get("media_url") or "")

    bits = []
    if codigo: bits.append(f"Código: {codigo}")
    if precio is not None: bits.append(f"Precio: {currency}{precio:,.0f}")
    if cat_names: bits.append(f"Categorías: {', '.join(cat_names)}")

    lines = [f"**{nombre}**"]
    if bits: lines.append(" · ".join(bits))
    if descr: lines.append(descr)
    if img:   lines.append(f"Imagen: {img}")
    return "\n".join(lines)


def _menu_detail_caption(m: dict, cat_by_id: Dict[str, dict]) -> str:
    """Build a pretty caption (Markdown) for Telegram photo messages.
    Keep under 1024 chars (Telegram caption limit)."""
    nombre = _norm_str(m.get("nombre"))
    codigo = _norm_str(m.get("codigo"))
    precio = m.get("precio")
    currency = _norm_str(m.get("currency") or "$")
    descr = _norm_str(m.get("descripcion") or m.get("description"))
    cat_ids = [ _norm_str(x) for x in (m.get("category_ids") or []) ]
    cat_names = [ _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name"))
                  for cid in cat_ids if cid in cat_by_id ]

    header = f"**{nombre}**"
    meta_bits = []
    if codigo: meta_bits.append(f"Código: {codigo}")
    if precio is not None: meta_bits.append(f"Precio: {currency}{precio:,.0f}")
    if cat_names: meta_bits.append(f"Categorías: {', '.join(cat_names)}")
    meta = " \u00b7 ".join(meta_bits)

    # Trim description to fit caption limit
    MAX_CAPTION = 1024
    parts = [header]
    if meta: parts.append(meta)
    if descr: parts.append(descr)
    caption = "\n".join(parts).strip()
    if len(caption) > MAX_CAPTION:
        caption = caption[:MAX_CAPTION-1] + "…"
    return caption


def _resolve_menu_image_url(m: dict) -> str:
    """Return an absolute HTTPS URL usable by Telegram for the menu image.
    Order: media_r2 (if absolute) -> media_url (if absolute) -> R2_CDN_BASE + media_local."""
    def _is_abs(u: str) -> bool:
        return bool(u and (u.startswith("https://") or u.startswith("http://")))

    # Prefer original media_url first (often JPG/PNG) for Telegram compatibility
    media_url = _norm_str(m.get("media_url") or "")
    if _is_abs(media_url):
        return media_url
    # Then try CDN (might be webp)
    media_r2 = _norm_str(m.get("media_r2") or "")
    if _is_abs(media_r2):
        return media_r2
    media_local = _norm_str(m.get("media_local") or "")  # like /menu_images/123.webp
    cdn_base = _norm_str(os.getenv("R2_CDN_BASE") or "")
    if media_local and cdn_base:
        return f"{cdn_base.rstrip('/')}/{media_local.lstrip('/')}"
    return ""


async def handle_menus(update, context):
    """Responder consultas de menús por categoría, producto o texto.
    Une opciones usando 'option_ids'. Si 1 resultado o piden detalle, muestra una ficha con foto.
    """
    text = update.message.text or ""

    # Tomar filtros priorizados desde context.user_data; si faltan, resolver con catálogos (sin heurísticas)
    by_ctx = (context.user_data.get("menus_by") or "").lower()
    q_ctx = _norm_str(context.user_data.get("menus_q") or "")
    detail_ctx = bool(context.user_data.get("menus_detail", False))

    if by_ctx or q_ctx or detail_ctx:
        by = by_ctx or "texto"
        q = q_ctx
        detail = detail_ctx
    else:
        f = await grok_filters("menus", text) or {}
        by = ((f.get("by") or "")).lower() or "texto"
        q = _norm_str(f.get("q") or "")
        detail = bool(f.get("detail", False))

    # Load collections
    menus = list(db.menus.find({}))
    categories = list(db.categories.find({}))
    menu_options = list(db.menu_options.find({}))

    cat_by_id = _index_by_id(categories)
    opt_by_id = _index_by_id(menu_options)

    # Build filters
    matched: List[dict] = []
    ql = (q or "").lower()

    if by == "categoria":
        # find category ids whose nombre contains q or exact id match
        cat_ids = []
        for c in categories:
            cid = _norm_str(c.get("id") or c.get("_id"))
            nombre = _norm_str(c.get("nombre") or c.get("name"))
            if not ql or _contains(nombre, ql) or (ql and cid == q):
                cat_ids.append(cid)
        cat_ids_set = set(cat_ids)
        for m in menus:
            mids = [ _norm_str(x) for x in (m.get("category_ids") or []) ]
            if any(mid in cat_ids_set for mid in mids):
                matched.append(m)

    elif by == "producto":
        for m in menus:
            nombre = _norm_str(m.get("nombre"))
            codigo = _norm_str(m.get("codigo"))
            if not ql:
                matched.append(m)
            elif codigo == q or _contains(nombre, ql):
                matched.append(m)

    else:  # texto -> nombre o descripción
        for m in menus:
            nombre = _norm_str(m.get("nombre"))
            descr  = _norm_str(m.get("descripcion") or m.get("description"))
            if not ql or _contains(nombre, ql) or _contains(descr, ql):
                matched.append(m)

    # Join options for each menu
    def join_options(m: dict) -> List[str]:
        ids = [ _norm_str(x) for x in (m.get("option_ids") or []) ]
        names = []
        for oid in ids:
            opt = opt_by_id.get(oid)
            if not opt:
                continue
            oname = _norm_str(opt.get("nombre") or opt.get("name") or opt.get("title"))
            if oname:
                names.append(oname)
        return names

    if not matched:
        return update, ["No encontré productos que coincidan con tu búsqueda."]

    # Si hay 1 solo resultado o piden detalle -> tarjeta con foto/descr.
    if len(matched) == 1 or detail or _wants_detail_menus(text):
        m = matched[0]
        img = _resolve_menu_image_url(m)
        if img:
            caption = _menu_detail_caption(m, cat_by_id)
            return update, [{"type": "photo", "url": img, "caption": caption}]
        return update, [_menu_detail_block(m, cat_by_id)]

    # Listado corto (máx 20)
    MAX_ITEMS = 20
    lines = []
    header = "Menús encontrados" if not q else f"Menús encontrados para '{q}'"
    lines.append(header + ":")

    for i, m in enumerate(matched[:MAX_ITEMS], start=1):
        nombre = _norm_str(m.get("nombre"))
        codigo = _norm_str(m.get("codigo"))
        precio = m.get("precio")
        currency = _norm_str(m.get("currency") or "$")
        # categories names
        cat_ids = [ _norm_str(x) for x in (m.get("category_ids") or []) ]
        cat_names = [ _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name")) for cid in cat_ids if cid in cat_by_id ]
        # options
        opt_names = join_options(m)
        bits = []
        if codigo:
            bits.append(f"{codigo}")
        if precio is not None:
            bits.append(f"{currency}{precio:,.0f}")
        meta = (" · ".join(bits)) if bits else ""
        cat_str = f" [cat: {', '.join(cat_names)}]" if cat_names else ""
        opt_str = f" [opc: {', '.join(opt_names[:3])}{'…' if len(opt_names) > 3 else ''}]" if opt_names else ""
        lines.append(f"{i}. {nombre}{' — ' + meta if meta else ''}{cat_str}{opt_str}")

    if len(matched) > MAX_ITEMS:
        lines.append(f"… y {len(matched) - MAX_ITEMS} más")

    return update, lines
