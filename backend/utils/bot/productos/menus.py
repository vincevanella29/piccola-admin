import os
import logging
import difflib
from typing import List, Dict, Any, Optional

from utils.web3mongo import db
from ..common.filters import grok_filters

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


# =====================
# Matching & scoring
# =====================


def _num(v: Any) -> Optional[float]:
    try:
        return float(v)
    except Exception:
        return None


def _safe_price(m: dict) -> Optional[float]:
    p = m.get("precio")
    return _num(p)


def _pref_canon_list(preferencias: List[str]) -> List[str]:
    out: List[str] = []
    for p in preferencias or []:
        pl = (p or "").lower()
        if not pl:
            continue
        out.append(pl)
    return out


def _collect_search_surface(m: dict, cat_by_id: Dict[str, dict], opt_by_id: Dict[str, dict]) -> str:
    nombre = _norm_str(m.get("nombre"))
    descr = _norm_str(m.get("descripcion") or m.get("description"))
    # categories
    cat_ids = [_norm_str(x) for x in (m.get("category_ids") or [])]
    cat_names = [
        _norm_str(cat_by_id[cid].get("nombre") or cat_by_id[cid].get("name"))
        for cid in cat_ids if cid in cat_by_id
    ]
    # options
    opt_ids = [_norm_str(x) for x in (m.get("option_ids") or [])]
    opt_names = []
    for oid in opt_ids:
        opt = opt_by_id.get(oid)
        if not opt:
            continue
        oname = _norm_str(opt.get("nombre") or opt.get("name") or opt.get("title"))
        if oname:
            opt_names.append(oname)
    parts = [nombre, descr] + cat_names + opt_names
    return " \n ".join([x for x in parts if x])


def _pref_match_score(surface: str, preferencias: List[str]) -> int:
    if not preferencias:
        return 0
    s = (surface or "").lower()
    score = 0
    for p in preferencias:
        if not p:
            continue
        if p in s:
            score += 1
    return score


def _text_match_score(m: dict, q: str) -> int:
    if not q:
        return 0
    ql = q.lower()
    nombre = _norm_str(m.get("nombre")).lower()
    descr = _norm_str(m.get("descripcion") or m.get("description")).lower()
    codigo = _norm_str(m.get("codigo")).lower()
    if codigo == ql:
        return 10
    if nombre == ql:
        return 6
    if ql in nombre:
        return 4
    if ql in descr:
        return 2
    return 0


def _similarity(a: str, b: str) -> float:
    try:
        return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()
    except Exception:
        return 0.0


def _text_similarity_score(q: str, m: dict, cat_by_id: Dict[str, dict], opt_by_id: Dict[str, dict]) -> float:
    if not q:
        return 0.0
    ql = q.lower().strip()
    nombre = _norm_str(m.get("nombre"))
    descr = _norm_str(m.get("descripcion") or m.get("description"))
    codigo = _norm_str(m.get("codigo"))
    surface = _collect_search_surface(m, cat_by_id, opt_by_id)
    score = 0.0
    # exact boosts
    if codigo and codigo.lower() == ql:
        score += 10.0
    if nombre and nombre.lower() == ql:
        score += 6.0
    # contains boosts
    if _contains(nombre, ql):
        score += 4.0
    if _contains(descr, ql):
        score += 2.0
    # fuzzy similarity
    score += 4.0 * _similarity(ql, nombre)
    score += 2.0 * _similarity(ql, descr)
    score += 1.0 * _similarity(ql, surface)
    return score


def _price_score(price: Optional[float], min_price: Optional[float], max_price: Optional[float], budget: Optional[float]) -> float:
    if price is None:
        return 0.0
    # Hard filters are handled separately; here, score closeness to budget if provided
    if budget is not None and budget > 0:
        # higher score if price is close but not exceeding too much
        diff = abs(price - budget)
        return max(0.0, 5.0 - (diff / max(1.0, budget)) * 5.0)
    # gentle preference: inside min/max gets small bonus
    if (min_price is not None and price < min_price) or (max_price is not None and price > max_price):
        return 0.0
    return 1.0


# ====================
# UI builders (bonitos)
# ====================

def _fmt_money(v: Any, currency: str) -> str:
    try:
        n = int(v)
        # Estilo $8.990 — si prefieres coma, quita el replace
        return f"{currency}{n:,.0f}".replace(",", ".")
    except Exception:
        return f"{currency}{v}"

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

    # Pide TODO a Grok según SPEC('menus') y persiste en contexto
    gf = await grok_filters("menus", text) or {}
    logger.info(f"[menus] spec_raw => {gf}")

    by = _norm_str(gf.get("by") or "texto").lower()
    q = _norm_str(gf.get("q") or "")
    detail = bool(gf.get("detail", False))
    ql = q.lower()

    preferencias = gf.get("preferencias") or []
    if isinstance(preferencias, str):
        preferencias = [preferencias]
    preferencias = _pref_canon_list(preferencias)
    min_price = _num(gf.get("min_price"))
    max_price = _num(gf.get("max_price"))
    budget = _num(gf.get("budget"))
    sort_pref = _norm_str(gf.get("sort") or "best").lower()
    if sort_pref not in {"best", "cheap", "expensive"}:
        sort_pref = "best"

    # Persistir en contexto para siguientes turnos o handlers
    context.user_data["menus_by"] = by
    context.user_data["menus_q"] = q
    context.user_data["menus_detail"] = detail
    context.user_data["menus_preferencias"] = preferencias
    context.user_data["menus_min_price"] = min_price
    context.user_data["menus_max_price"] = max_price
    context.user_data["menus_budget"] = budget
    context.user_data["menus_sort"] = sort_pref

    # Cargar colecciones
    menus = list(db.menus.find({}))
    categories = list(db.categories.find({}))
    menu_options = list(db.menu_options.find({}))

    cat_by_id = _index_by_id(categories)
    opt_by_id = _index_by_id(menu_options)

    # Filtrado basado SOLO en Grok + similitud del prompt con productos existentes
    matched: List[dict] = []
    # Obtener catálogos válidos de categorías y menús desde SPEC
    valid_categories = set()
    valid_menus = set()
    for cat in categories:
        n = _norm_str(cat.get("nombre") or cat.get("name"))
        if n:
            valid_categories.add(n.lower())
    for menu in menus:
        n = _norm_str(menu.get("nombre"))
        if n:
            valid_menus.add(n.lower())
    # Usa q del spec; si viene vacío, usa el texto completo del usuario como query de similitud
    query_text = q or text
    query_text = _norm_str(query_text)
    for m in menus:
        # Solo considera productos cuyo nombre esté en el catálogo válido
        nombre_menu = _norm_str(m.get("nombre")).lower()
        if nombre_menu not in valid_menus:
            continue
        # aplica filtros de precio si Grok los entregó (>0)
        p = _safe_price(m)
        min_ok = (min_price is None or min_price <= 0) or (p is not None and p >= min_price)
        max_ok = (max_price is None or max_price <= 0) or (p is not None and p <= max_price)
        budget_ok = (budget is None or budget <= 0) or (p is not None and p <= budget * 1.25)
        if not (min_ok and max_ok and budget_ok):
            continue
        # preferencias: si vienen, exigimos al menos 1 match en la superficie
        if preferencias:
            surface = _collect_search_surface(m, cat_by_id, opt_by_id)
            if _pref_match_score(surface, preferencias) <= 0:
                continue
        # score de similitud textual (nombre/descr/categorías/opciones/código)
        ts = _text_similarity_score(query_text, m, cat_by_id, opt_by_id)
        if ts > 0:
            m["__score_ts"] = ts
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

    # Post filters: price and preferencias
    def passes_price(m: dict) -> bool:
        p = _safe_price(m)
        if p is None:
            return True  # keep unknown priced items
        if min_price is not None and p < min_price:
            return False
        if max_price is not None and p > max_price:
            return False
        if budget is not None and budget > 0 and p > budget * 1.25:  # allow slight tolerance
            return False
        return True

    def matches_prefs(m: dict) -> bool:
        if not preferencias:
            return True
        surface = _collect_search_surface(m, cat_by_id, opt_by_id)
        return _pref_match_score(surface, preferencias) > 0

    if not matched:
        return update, {
            "type": "text",
            "text": "No encontré productos que coincidan con tu búsqueda.",
        }

    # Scoring and sorting
    def total_score(m: dict) -> float:
        ts = float(m.get("__score_ts", 0.0))
        surface = _collect_search_surface(m, cat_by_id, opt_by_id)
        ps = _pref_match_score(surface, preferencias)
        pr = _price_score(_safe_price(m), min_price, max_price, budget)
        return ts + ps + pr

    if sort_pref == "cheap":
        matched.sort(key=lambda m: (_safe_price(m) is None, _safe_price(m) or float('inf')))
    elif sort_pref == "expensive":
        matched.sort(key=lambda m: (_safe_price(m) is None, -(_safe_price(m) or 0)))
    else:
        matched.sort(key=lambda m: total_score(m), reverse=True)

    # ---- Detalle único ----
    if len(matched) == 1 or detail or _wants_detail_menus(text):
        m = matched[0]
        # Base fields
        pid = _norm_str(m.get("id") or m.get("_id") or m.get("codigo"))
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
        # options
        opt_names = []
        for oid in [_norm_str(x) for x in (m.get("option_ids") or [])]:
            opt = opt_by_id.get(oid)
            if not opt:
                continue
            oname = _norm_str(opt.get("nombre") or opt.get("name") or opt.get("title"))
            if oname:
                opt_names.append(oname)
        # image
        img = _resolve_menu_image_url(m)
        # Texto humano corto para la UI (ej. chat preview)
        if precio is not None:
            text_preview = f"{nombre} — {_fmt_money(precio, currency)}"
        else:
            text_preview = nombre
        return update, {
            "type": "product_card",
            "text": text_preview,
            "product": {
                "id": pid,
                "name": nombre,
                "code": codigo,
                "price": precio,
                "currency": currency,
                "categories": cat_names,
                "options": opt_names,
                "description": descr,
                "image_url": img,
            }
        }

    # ---- Listado corto (máx 20) con UI linda ----
    MAX_ITEMS = 20
    items = []
    for m in matched[:MAX_ITEMS]:
        pid = _norm_str(m.get("id") or m.get("_id") or m.get("codigo"))
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
        # options (top 3 for preview)
        opt_names = join_options(m)
        # image (thumbnail)
        img = _resolve_menu_image_url(m)
        items.append({
            "id": pid,
            "name": nombre,
            "code": codigo,
            "price": precio,
            "currency": currency,
            "categories": cat_names,
            "options": opt_names[:3],
            "image_url": img,
        })

    total = len(matched)
    # Texto humano corto para la UI del listado
    if q:
        list_text = f"{len(items)}/{total} productos para '{q}'"
    else:
        list_text = f"{len(items)}/{total} productos"
    return update, {
        "type": "product_list",
        "text": list_text,
        "query": q,
        "total": total,
        "shown": len(items),
        "items": items,
    }
