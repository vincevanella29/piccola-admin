import os
import logging
from typing import List, Dict, Any, Tuple

from utils.web3mongo import db
from ..common.filters import grok_filters
from ..common.common import get_link_info

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 🧭 Importante para ver **negritas** y formato bonito en Telegram:
# Configura el bot con parse_mode por defecto en Application:
#
# from telegram.ext import Application, Defaults
# from telegram.constants import ParseMode
# application = (
#     Application.builder()
#     .token(TELEGRAM_BOT_TOKEN)
#     .defaults(Defaults(parse_mode=ParseMode.MARKDOWN))
#     .build()
# )
# ---------------------------------------------------------------------------

# Allowed photo extensions for Telegram sendPhoto
ALLOWED_PHOTO_EXTS = {"jpg", "jpeg", "png"}


# ===============
# Utils de texto
# ===============

def _norm_str(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()


def _contains(hay: str, needle: str) -> bool:
    try:
        return needle.lower() in hay.lower()
    except Exception:
        return False


def _index_by_id(rows: List[dict]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    for r in rows:
        _id = _norm_str(r.get("id") or r.get("_id"))
        if _id:
            out[_id] = r
    return out


def _img_ext(u: str) -> str:
    u = (u or "").split("?")[0]
    if "." in u:
        return u.rsplit(".", 1)[-1].lower()
    return ""


def _is_abs(u: str) -> bool:
    return bool(u and (u.startswith("https://") or u.startswith("http://")))


def _is_photo_ext(u: str) -> bool:
    return _img_ext(u) in ALLOWED_PHOTO_EXTS


def _cf_to_jpeg(u: str) -> str:
    """
    Si el CDN (Cloudflare) tiene Image Resizing habilitado,
    convierte cualquier ruta a JPEG con calidad 85.
    Genera: https://<cdn>/cdn-cgi/image/format=jpeg,q=85/<path>
    """
    try:
        from urllib.parse import urlparse

        p = urlparse(u)
        if not p.netloc:
            return ""
        path = p.path.lstrip("/")
        return f"{p.scheme}://{p.netloc}/cdn-cgi/image/format=jpeg,q=85/{path}"
    except Exception:
        return ""


def _wants_detail_menus(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in [
        "detalle", "detall", "¿cuál es", "cual es", "muéstrame", "muestrame", "foto", "imagen"
    ])


# ====================
# UI builders (bonitos)
# ====================

def _badge_list(bits: List[str]) -> str:
    """Convierte meta en línea con separadores bonitos."""
    cleaned = [b for b in bits if b]
    return "  ·  ".join(cleaned)


def _fmt_money(v: Any, currency: str) -> str:
    try:
        n = int(v)
        # Estilo $8.990 — si prefieres coma, quita el replace
        return f"{currency}{n:,.0f}".replace(",", ".")
    except Exception:
        return f"{currency}{v}"


def _menu_detail_caption(m: dict, cat_by_id: Dict[str, dict]) -> str:
    """Caption corto y elegante para la foto (<=1024 chars)."""
    nombre = _norm_str(m.get("nombre"))
    codigo = _norm_str(m.get("codigo"))
    precio = m.get("precio")
    currency = _norm_str(m.get("currency") or "$")
    descr = _norm_str(m.get("descripcion") or m.get("description"))
    cat_ids = [_norm_str(x) for x in (m.get("category_ids") or [])]
    cat_names = [
        _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name"))
        for cid in cat_ids if cid in cat_by_id
    ]

    meta_bits: List[str] = []
    if codigo:
        meta_bits.append(f"**Código:** {codigo}")
    if precio is not None:
        meta_bits.append(f"**Precio:** {_fmt_money(precio, currency)}")
    if cat_names:
        meta_bits.append(f"**Categorías:** {', '.join(cat_names)}")

    # Descripción breve: primer enunciado o hasta 240 chars
    short_descr = (descr.split(". ")[0] if descr else "").strip()[:240]

    parts: List[str] = [f"**{nombre}**"]
    meta_line = _badge_list(meta_bits)
    if meta_line:
        parts.append(meta_line)
    if short_descr:
        parts.append(short_descr)
    caption = "\n".join(parts).strip()

    # recorte duro a 1024 por si acaso
    return caption[:1024]


def _menu_detail_block(m: dict, cat_by_id: Dict[str, dict]) -> str:
    """Bloque textual (fallback sin imagen) en estilo bonito."""
    nombre = _norm_str(m.get("nombre"))
    codigo = _norm_str(m.get("codigo"))
    precio = m.get("precio")
    currency = _norm_str(m.get("currency") or "$")
    descr = _norm_str(m.get("descripcion") or m.get("description"))
    cat_ids = [_norm_str(x) for x in (m.get("category_ids") or [])]
    cat_names = [
        _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name"))
        for cid in cat_ids if cid in cat_by_id
    ]

    bits: List[str] = []
    if codigo:
        bits.append(f"**Código:** {codigo}")
    if precio is not None:
        bits.append(f"**Precio:** {_fmt_money(precio, currency)}")
    if cat_names:
        bits.append(f"**Categorías:** {', '.join(cat_names)}")

    lines = [f"**{nombre}**"]
    if bits:
        lines.append(_badge_list(bits))
    if descr:
        lines.append(descr)
    return "\n".join(lines)


def _build_ambiguous_list(matched: List[dict]) -> List[str]:
    lines = ["**Encontré varios productos** — especifica por *nombre* o *código*: "]
    for i, m in enumerate(matched[:10], start=1):
        nombre = _norm_str(m.get("nombre"))
        codigo = _norm_str(m.get("codigo"))
        lines.append(f"{i}. **{nombre}** — `{codigo}`")
    return lines


def _build_recipe_block(nombre: str, codigo: str, mesano: str, rows: List[dict]) -> str:
    if not rows:
        return f"Receta de **{nombre}** (código `{codigo}`) — **{mesano}**: *sin datos*."

    out: List[str] = [f"** {nombre}** — Receta `{codigo}` — **{mesano}**"]
    for r in rows:
        ing = _norm_str(r.get("ingrediente_nombre") or r.get("ingrediente_codigo"))
        qty = r.get("cantidad_ingrediente")
        unit = _norm_str(r.get("u_medida_compra") or r.get("u_medida_base"))
        pct = r.get("porcentaje_linea")
        qty_s = (f"{qty:.3f}" if isinstance(qty, (int, float)) else _norm_str(qty))
        pct_s = (f" · {pct:.1f}%" if isinstance(pct, (int, float)) else "")
        out.append(f"- **{ing}** — {qty_s} {unit}{pct_s}")
    return "\n".join(out)


# ==================
# Imagen (Telegram)
# ==================

def _resolve_menu_image_url(m: dict) -> str:
    """
    URL absoluta y 'telegram-safe' para foto.
    Preferimos CDN (R2) en JPEG/PNG; si está en WEBP, intentamos transformarlo a JPEG vía Cloudflare.
    Evitamos 'media_url' del sitio si no es claramente una imagen directa (p.ej. podría devolver HTML/challenge).
    """
    media_r2 = _norm_str(m.get("media_r2") or "")
    media_url = _norm_str(m.get("media_url") or "")
    media_local = _norm_str(m.get("media_local") or "")
    cdn_base = _norm_str(os.getenv("R2_CDN_BASE") or "")

    # 1) Si R2 ya está en jpg/png, úsalo
    if _is_abs(media_r2) and _is_photo_ext(media_r2):
        return media_r2

    # 2) Si R2 es webp, intenta Cloudflare Image Resizing -> jpeg
    if _is_abs(media_r2) and _img_ext(media_r2) == "webp":
        jpeg_r2 = _cf_to_jpeg(media_r2)
        if jpeg_r2:
            return jpeg_r2

    # 3) Construye desde cdn_base + media_local (y pasa por jpeg si es webp)
    if cdn_base and media_local:
        raw = f"{cdn_base.rstrip('/')}/{media_local.lstrip('/')}"
        if _is_photo_ext(raw):
            return raw
        if _img_ext(raw) == "webp":
            jpeg_raw = _cf_to_jpeg(raw)
            if jpeg_raw:
                return jpeg_raw

    # 4) Último recurso: media_url (solo si es jpg/png)
    if _is_abs(media_url) and _is_photo_ext(media_url):
        return media_url

    # 5) Nada seguro
    return media_r2 or media_url or ""


# ===============
# Handler principal
# ===============

async def handle_menus(update, context):
    """Responder consultas de menús por categoría, producto o texto.
    Une opciones usando 'option_ids'. Si 1 resultado o piden detalle, muestra una ficha con foto.
    """
    text = update.message.text or ""
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[menus_handler] tg_id={tg_id} text='{text}'")

    link = get_link_info(tg_id) if tg_id else None
    if not link or link.get("expired"):
        return update, ["Primero conecta tu cuenta con Privy para ver menús. Usa /link."]

    # Filtros desde contexto o por NLP
    by_ctx = (context.user_data.get("menus_by") or "").lower()
    q_ctx = _norm_str(context.user_data.get("menus_q") or "")
    detail_ctx = bool(context.user_data.get("menus_detail", False))

    f: Dict[str, Any] = {}
    if by_ctx or q_ctx or detail_ctx:
        by = by_ctx or "texto"
        q = q_ctx
        detail = detail_ctx
    else:
        f = await grok_filters("menus", text) or {}
        by = ((f.get("by") or "")).lower() or "texto"
        q = _norm_str(f.get("q") or "")
        detail = bool(f.get("detail", False))

    # Extras estructurados
    recipe = bool(context.user_data.get("menus_recipe", False)) if hasattr(context, "user_data") else False
    if not recipe:
        recipe = bool((f or {}).get("recipe", False))
    mesanos = list(context.user_data.get("menus_mesanos") or []) if hasattr(context, "user_data") else []
    if not mesanos:
        mesanos = list((f or {}).get("mesanos") or [])  # normalizados por spec

    # Cargar colecciones
    menus = list(db.menus.find({}))
    categories = list(db.categories.find({}))
    menu_options = list(db.menu_options.find({}))

    cat_by_id = _index_by_id(categories)
    opt_by_id = _index_by_id(menu_options)

    # Filtrado
    matched: List[dict] = []
    ql = (q or "").lower()

    if by == "categoria":
        cat_ids = []
        for c in categories:
            cid = _norm_str(c.get("id") or c.get("_id"))
            nombre = _norm_str(c.get("nombre") or c.get("name"))
            if not ql or _contains(nombre, ql) or (ql and cid == q):
                cat_ids.append(cid)
        cat_ids_set = set(cat_ids)
        for m in menus:
            mids = [_norm_str(x) for x in (m.get("category_ids") or [])]
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
            descr = _norm_str(m.get("descripcion") or m.get("description"))
            if not ql or _contains(nombre, ql) or _contains(descr, ql):
                matched.append(m)

    # Join options (para listado)
    def join_options(m: dict) -> List[str]:
        ids = [_norm_str(x) for x in (m.get("option_ids") or [])]
        names: List[str] = []
        for oid in ids:
            opt = opt_by_id.get(oid)
            if not opt:
                continue
            oname = _norm_str(opt.get("nombre") or opt.get("name") or opt.get("title"))
            if oname:
                names.append(oname)
        return names

    if not matched:
        return update, ["**No encontré productos** que coincidan con tu búsqueda."]

    # ---- Recetas ----
    if recipe:
        # Elegir menú
        m_sel = None
        if q and any(_norm_str(x.get("codigo")) == q for x in matched):
            m_sel = next(x for x in matched if _norm_str(x.get("codigo")) == q)
        elif len(matched) == 1:
            m_sel = matched[0]
        else:
            return update, _build_ambiguous_list(matched)

        nombre = _norm_str(m_sel.get("nombre"))
        codigo = _norm_str(m_sel.get("codigo"))

        # 1) Tarjeta (foto + caption) o fallback
        out_items: List[Dict[str, Any] | str] = []
        img = _resolve_menu_image_url(m_sel)
        if img:
            caption = _menu_detail_caption(m_sel, cat_by_id)
            out_items.append({"type": "photo", "url": img, "caption": caption})
        else:
            out_items.append(_menu_detail_block(m_sel, cat_by_id))

        # 2) Recetas por mes/año (máx 2 bloques)
        for mesano in mesanos[:2]:
            rows = list(
                db.recetas_productos.find({
                    "producto_codigo": codigo,
                    "mesano": mesano,
                }).sort("linea", 1)
            )
            out_items.append(_build_recipe_block(nombre, codigo, mesano, rows))

        return update, out_items

    # ---- Detalle único ----
    if len(matched) == 1 or detail or _wants_detail_menus(text):
        m = matched[0]
        img = _resolve_menu_image_url(m)
        if img:
            caption = _menu_detail_caption(m, cat_by_id)
            return update, [{"type": "photo", "url": img, "caption": caption}]
        return update, [_menu_detail_block(m, cat_by_id)]

    # ---- Listado corto (máx 20) con UI linda ----
    MAX_ITEMS = 20
    lines: List[str] = []
    header = "**Menús encontrados**" if not q else f"**Menús encontrados** para `'{q}'`"
    lines.append(header)

    for i, m in enumerate(matched[:MAX_ITEMS], start=1):
        nombre = _norm_str(m.get("nombre"))
        codigo = _norm_str(m.get("codigo"))
        precio = m.get("precio")
        currency = _norm_str(m.get("currency") or "$")
        # categories names
        cat_ids = [_norm_str(x) for x in (m.get("category_ids") or [])]
        cat_names = [
            _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name"))
            for cid in cat_ids if cid in cat_by_id
        ]
        # options
        opt_names = join_options(m)

        meta_bits: List[str] = []
        # el código va en el título, mantenemos precio en meta
        if precio is not None:
            meta_bits.append(_fmt_money(precio, currency))
        meta = (" · ".join(meta_bits)) if meta_bits else ""

        cat_str = f"  —  *{', '.join(cat_names)}*" if cat_names else ""
        opt_str = (
            f"  —  _opc: {', '.join(opt_names[:3])}{'…' if len(opt_names) > 3 else ''}_"
            if opt_names else ""
        )
        title = f"**{nombre}**" if not codigo else f"**{nombre}** (`{codigo}`)"
        lines.append(f"{i}. {title}{(' — ' + meta) if meta else ''}{cat_str}{opt_str}")

    if len(matched) > MAX_ITEMS:
        lines.append(f"… y **{len(matched) - MAX_ITEMS}** más")

    return update, lines
