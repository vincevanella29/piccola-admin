import os
import logging
from typing import List, Dict, Any, Tuple

from utils.web3mongo import db
from ..common.filters import grok_filters, apply_access_filters_for_product_like_intent, is_worker_in_sales_kpis
import unicodedata

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Importante para ver **negritas** y formato bonito en Telegram:
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

# Safe default in case any legacy path references this symbol at module scope
authorized = False


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


def _no_accents(txt: str) -> str:
    try:
        return "".join(
            c for c in unicodedata.normalize("NFD", txt or "")
            if unicodedata.category(c) != "Mn"
        )
    except Exception:
        return (txt or "")


def _singularize_tokens_es(text: str) -> list[str]:
    t = _no_accents((text or "").lower())
    parts = [p for p in __import__("re").split(r"\W+", t) if p]
    out = set()
    for w in parts:
        out.add(w)
        if w.endswith("es") and len(w) > 4:
            out.add(w[:-2])
        if w.endswith("s") and len(w) > 3:
            out.add(w[:-1])
    return list(out)


def _wants_detail_menus(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in [
        "detalle", "detall", "¿cuál es", "cual es", "muéstrame", "muestrame", "foto", "imagen"
    ])


async def handle_menus_intent(update, context):
    """Router lógico para el intent 'menus'.

    Desde ahora, TODO lo que sea intent 'menus' se resuelve con handle_menus:
    - Detalle/recetas/ficha de producto.
    - Listados de menús por texto/categoría.

    Las ventas por hora (por producto, local, garzón, etc.) quedan a cargo
    exclusivamente del intent 'ventas_hora' y su handler dedicatedo
    utils.bot.movimientos.ventas_hora:handle_ventas_hora.
    """
    text = update.message.text or ""
    # El engine ya puede haber parseado el SPEC de 'menus' y dejado el resultado
    # completo en context.user_data["menus_filters"]. Si no está, hacemos fallback
    # a grok_filters aquí para mantener compatibilidad.
    mf = getattr(context, "user_data", {}).get("menus_filters") or (await grok_filters("menus", text) or {})

    # Guardamos el spec completo en el contexto para que handle_menus pueda
    # reutilizarlo (filtros de acceso, periodos, etc.).
    if hasattr(context, "user_data"):
        context.user_data["menus_filters"] = mf

    # Extra para detalle/recetas: estos flags ya eran usados por handle_menus.
    _tlow = (text or "").lower()
    nl_wants_recipe = ("receta" in _tlow)
    if nl_wants_recipe:
        context.user_data["menus_recipe"] = True
    context.user_data["menus_by"] = (mf.get("by") or "").lower()
    context.user_data["menus_q"] = (mf.get("q") or "")
    context.user_data["menus_detail"] = bool(mf.get("detail", False))
    context.user_data["menus_mesanos"] = mf.get("mesanos") or []

    # Delegar SIEMPRE en handle_menus (descriptivo / recetas / listados)
    _, payload = await handle_menus(update, context)
    payload_out = payload if isinstance(payload, (dict, list)) else {
        "type": "text_block_list",
        "intent": "menus",
        "lines": payload,
    }
    return update, payload_out


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

    # Permisos / acceso
    perms = getattr(context, "user_data", {}).get("permissions") or {}
    try:
        role_level = int(getattr(context, "user_data", {}).get("role_level"))
    except Exception:
        role_level = None

    # Período actual YYYYMM para KPIs (garzón/cocina y centros de producción)
    period_ym = None
    try:
        tz = ZoneInfo("America/Santiago")
        now = datetime.now(tz)
        period_ym = now.strftime("%Y%m")
    except Exception:
        period_ym = None

    # Detectar si nivel 7 es garzón (es_competidor=True en kpis_empleado_mensual)
    is_lvl7_garzon = False
    if role_level == 7 and perms.get("rut") and period_ym:
        try:
            is_lvl7_garzon = is_worker_in_sales_kpis(period_ym, perms)
        except Exception:
            is_lvl7_garzon = False

    # Aplicar scoping global de acceso (sucursal + centros para lvl 7 cocina)
    base_filters_obj = (context.user_data.get("menus_filters") or f or {}) if hasattr(context, "user_data") else (f or {})
    filters_before = (base_filters_obj.get("filters") or {}) if isinstance(base_filters_obj, dict) else {}
    scoped_obj = apply_access_filters_for_product_like_intent(
        "menus",
        base_filters_obj if isinstance(base_filters_obj, dict) else {},
        perms or {},
        role_level,
        None if is_lvl7_garzon else period_ym,
    )
    filters_after = (scoped_obj.get("filters") or {}) if isinstance(scoped_obj, dict) else {}
    if hasattr(context, "user_data"):
        context.user_data["menus_filters"] = scoped_obj
    f = scoped_obj
    logger.info(
        "[menus.handle_menus] role_level=%s rut=%s cargo=%s seccion=%s period_ym=%s is_lvl7_garzon=%s filters_before=%s filters_after=%s",
        role_level,
        perms.get("rut"),
        perms.get("cargo"),
        perms.get("seccion"),
        period_ym,
        is_lvl7_garzon,
        filters_before,
        filters_after,
    )

    # Filtrado
    matched: List[dict] = []
    ql = (q or "").lower()

    # Respetar filtros.include_codigos si vienen del SPEC/NLP
    mf_all = {}
    try:
        mf_all = (context.user_data.get("menus_filters") or {}) if hasattr(context, "user_data") else {}
    except Exception:
        mf_all = {}
    ff_filters = (f or {}).get("filters") or mf_all.get("filters") or {}
    include_codigos_filter = [str(x).upper() for x in (ff_filters.get("include_codigos") or [])]
    seed_codes = set(include_codigos_filter)
    if seed_codes:
        set_codes = seed_codes
        for m in menus:
            code = _norm_str(m.get("codigo")).upper()
            if code and code in set_codes:
                matched.append(m)

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
        # Matching por código exacto o por tokens (sin acentos, singularizado)
        needles = set(_singularize_tokens_es(q)) if q else set()
        for m in menus:
            nombre = _norm_str(m.get("nombre"))
            codigo = _norm_str(m.get("codigo"))
            if not ql:
                matched.append(m)
                continue
            if codigo == q:
                matched.append(m)
                continue
            # nombre sin acentos/lower
            name_na = _no_accents(nombre).lower()
            if any(n in name_na for n in needles):
                matched.append(m)

    else:  # texto -> nombre o descripción con tokens (sin acentos)
        needles = set(_singularize_tokens_es(q)) if q else set()
        for m in menus:
            nombre = _norm_str(m.get("nombre"))
            descr = _norm_str(m.get("descripcion") or m.get("description"))
            if not ql:
                matched.append(m)
                continue
            name_na = _no_accents(nombre).lower()
            descr_na = _no_accents(descr).lower()
            if any(n in name_na or n in descr_na for n in needles):
                matched.append(m)

    # Deduplicar por código, por si hubo seed + matching adicional
    if matched:
        seen_codes = set()
        uniq = []
        for m in matched:
            c = _norm_str(m.get("codigo"))
            if c and c not in seen_codes:
                seen_codes.add(c)
                uniq.append(m)
        matched = uniq

    # Para nivel 7 cocina (no garzón), reforzar el scope por centros:
    # solo se permiten productos cuyo código esté en filters.include_codigos.
    # Si apply_access_filters marcó _lvl7_denied=True, bloqueamos aunque no haya allowed_codes.
    if role_level == 7 and not is_lvl7_garzon:
        ff_filters_effective = (f or {}).get("filters") or {}
        allowed_codes = {str(x).upper() for x in (ff_filters_effective.get("include_codigos") or [])}
        lvl7_denied = bool(ff_filters_effective.get("_lvl7_denied"))
        before_codes = [(_norm_str(m.get("codigo")).upper() or "") for m in matched]
        if allowed_codes:
            matched = [m for m in matched if _norm_str(m.get("codigo")).upper() in allowed_codes]
        elif lvl7_denied:
            # No hay códigos permitidos para este centro/cargo en el período: bloquea recetas.
            matched = []
        after_codes = [(_norm_str(m.get("codigo")).upper() or "") for m in matched]
        logger.info(
            "[menus.handle_menus] lvl7 cocina scope by centers codes_before=%s codes_after=%s allowed_codes=%s lvl7_denied=%s",
            before_codes,
            after_codes,
            sorted(list(allowed_codes)),
            lvl7_denied,
        )
        if not matched:
            return update, [
                "No tienes acceso a recetas para ese producto en tu centro de costos.",
            ]

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
        # Si hay más de un match y piden receta, devolvemos una tabla de productos con recipes adjuntas
        if not (q and any(_norm_str(x.get("codigo")) == q for x in matched)) and len(matched) > 1:
            # Tabla de productos (máx 20) con imagen + nombre + código + precio
            MAX_ITEMS = 20
            rows = []
            codes: list[str] = []
            for m in matched[:MAX_ITEMS]:
                nombre_i = _norm_str(m.get("nombre"))
                codigo_i = _norm_str(m.get("codigo"))
                precio_i = m.get("precio")
                currency_i = _norm_str(m.get("currency") or "$")
                img_i = _resolve_menu_image_url(m)
                rows.append({
                    "group": f"{nombre_i} ({codigo_i})" if (nombre_i and codigo_i) else (nombre_i or codigo_i),
                    "code": codigo_i,
                    "name": nombre_i,
                    "price": precio_i,
                    "currency": currency_i,
                    "image_url": img_i,
                })
                if codigo_i:
                    codes.append(codigo_i)

            columns = [
                {"key":"image_url","label":"","type":"text","align":"left","format":"image"},
                {"key":"group","label":"producto","type":"text","align":"left"},
                {"key":"price","label":"Precio","type":"number","align":"right","format":"money"},
            ]
            payload = {
                "type": "data_table",
                "title": f"Productos con receta — {len(rows)}",
                "text": f"Productos con receta — {len(rows)}",
                "subtitle": None,
                "kpis": [],
                "columns": columns,
                "rows": rows,
                "totals": None,
                "charts": None,
            }
            # Adjuntar tabla de recetas (último mesano disponible por código)
            recipes_rows = []
            try:
                for code in codes:
                    _latest = db.recetas_productos.find({"producto_codigo": code}, {"mesano":1}).sort("mesano", -1).limit(1)
                    latest_doc = next(iter(_latest), None)
                    use_mesano = str(latest_doc.get("mesano")) if latest_doc and latest_doc.get("mesano") else None
                    if not use_mesano:
                        continue
                    cur = db.recetas_productos.find({"producto_codigo": code, "mesano": use_mesano}).sort([("producto_codigo",1),("linea",1)])
                    for rr in cur:
                        ing = _norm_str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo"))
                        qty = rr.get("cantidad_ingrediente")
                        unit = _norm_str(rr.get("u_medida_compra") or rr.get("u_medida_base"))
                        pct = rr.get("porcentaje_linea")
                        recipes_rows.append({
                            "code": code,
                            "ingredient": ing,
                            "qty": float(qty) if isinstance(qty,(int,float)) else None,
                            "qty_text": (f"{qty:.3f}" if isinstance(qty,(int,float)) else (_norm_str(qty) if qty is not None else "")),
                            "unit": unit,
                            "mesano": use_mesano,
                            **({"pct": float(pct)} if isinstance(pct,(int,float)) else {}),
                        })
            except Exception:
                recipes_rows = []
            if recipes_rows:
                payload["related_tables"] = payload.get("related_tables") or []
                payload["related_tables"].append({
                    "type":"data_table",
                    "key":"recipes",
                    "title":"Recetas",
                    "columns":[
                        {"key":"code","label":"Código","type":"text","align":"left"},
                        {"key":"ingredient","label":"Ingrediente","type":"text","align":"left"},
                        {"key":"qty_text","label":"Cantidad","type":"text","align":"right"},
                        {"key":"unit","label":"Unidad","type":"text","align":"left"},
                        {"key":"pct","label":"%","type":"number","align":"right"},
                    ],
                    "rows": recipes_rows,
                })
            return update, payload

        # Elegir menú único (match exacto por código o solo 1 resultado)
        m_sel = next((x for x in matched if _norm_str(x.get("codigo")) == q), None) if q else None
        if not m_sel:
            m_sel = matched[0]

        nombre = _norm_str(m_sel.get("nombre"))
        codigo = _norm_str(m_sel.get("codigo"))

        # 1) Card de producto (estilo web)
        prod = {
            "id": str(m_sel.get("id") or m_sel.get("_id") or m_sel.get("codigo") or ""),
            "name": nombre,
            "code": codigo,
            "price": m_sel.get("precio"),
            "currency": _norm_str(m_sel.get("currency") or "$"),
            "categories": list(m_sel.get("category_ids") or []),
            "options": list(m_sel.get("option_ids") or []),
            "description": _norm_str(m_sel.get("descripcion") or m_sel.get("description") or ""),
            "image_url": _resolve_menu_image_url(m_sel),
        }
        # Preparar payload final tipo product_card (agregaremos receta inline)
        payload_pc = {"type": "product_card", "text": nombre, "product": prod}

        # 2) Recetas por mes/año (máx 2 bloques)
        # Si no viene 'mesanos', usar el último mes disponible para ese producto
        if not mesanos:
            try:
                _latest = db.recetas_productos.find({"producto_codigo": codigo}, {"mesano":1}).sort("mesano", -1).limit(1)
                latest_doc = next(iter(_latest), None)
                if latest_doc and latest_doc.get("mesano"):
                    mesanos = [str(latest_doc.get("mesano"))]
            except Exception:
                mesanos = []
        # Para compatibilidad, incluimos sólo el primer mesano (último disponible)
        recipe_block = None
        for mesano in mesanos[:1]:
            rows = list(
                db.recetas_productos.find({
                    "producto_codigo": codigo,
                    "mesano": mesano,
                }).sort("linea", 1)
            )
            recipe_rows = []
            for rr in rows:
                ing = _norm_str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo"))
                qty = rr.get("cantidad_ingrediente")
                unit = _norm_str(rr.get("u_medida_compra") or rr.get("u_medida_base"))
                pct = rr.get("porcentaje_linea")
                qty_text = (f"{qty:.3f}" if isinstance(qty, (int, float)) else _norm_str(qty))
                rec = {"ingredient": ing, "qty_text": qty_text, "unit": unit}
                if isinstance(pct, (int, float)):
                    rec["pct"] = round(float(pct), 1)
                recipe_rows.append(rec)
            recipe_block = {"mesano": mesano, "rows": recipe_rows}
            break
        if recipe_block:
            payload_pc["recipe"] = recipe_block

        # 3) Ventas por producto (sales_by_waiter_hour) para el período pedido o mes actual
        try:
            # Determinar período desde el SPEC de menus (si viene), si no mes actual
            vf_all = (context.user_data.get("menus_filters") or {}) if hasattr(context, "user_data") else {}
            per = (vf_all.get("period") or {}) if isinstance(vf_all, dict) else {}
            # Reutilizar helper de ventas_hora para rango de fechas
            start_dt, end_excl, s_str, e_str, tz = _vh_resolve_period(per)

            # Normaliza UTC naive para consultas
            from zoneinfo import ZoneInfo as _ZI
            _UTC = _ZI("UTC")
            match_start = start_dt.astimezone(_UTC).replace(tzinfo=None)
            match_end = end_excl.astimezone(_UTC).replace(tzinfo=None)

            # Filtros efectivos (sucursales/códigos) ya aplicados por access
            f_eff = (f or {}).get("filters") or {}
            include_locals   = [str(x) for x in (f_eff.get("include_locals") or [])]
            include_siglas   = [str(x).upper() for x in (f_eff.get("include_siglas") or [])]
            include_codigos  = [str(x).upper() for x in (f_eff.get("include_codigos") or [])]

            # Si estamos en receta de un producto específico, asegurar que su código está incluido
            if codigo:
                cu = codigo.upper()
                if cu not in include_codigos:
                    include_codigos.append(cu)

            tz_name = str(tz)
            stages_s = [
                {"$addFields": {"_ts": {"$cond": [{"$eq": [{"$type": "$FECHA"}, "date"]}, "$FECHA", {"$toDate": "$FECHA"}]}}},
                {"$match": {"_ts": {"$gte": match_start, "$lt": match_end}}},
                {"$addFields": {
                    "H": {"$ifNull": ["$HORA", {"$hour": {"date": "$_ts", "timezone": tz_name}}]},
                    "DATE_STR": {"$dateToString":{"format":"%Y-%m-%d","date":"$_ts","timezone":tz_name}},
                    "_SIGLA": {"$toUpper": {"$substrCP":[{"$ifNull":["$LOCAL",""]},0,3]}},
                }},
                {"$project": {
                    "_id":0, "LOCAL":1, "CODIGO_PRODUCTO":1,
                    "TOTAL": {"$ifNull":["$TOTAL",0]},
                    "CANTIDAD": {"$ifNull":["$CANTIDAD",0]},
                    "_SIGLA":1,
                }}
            ]
            if include_locals:
                real_loc_codes = [x for x in include_locals if isinstance(x, str) and x.upper().endswith("LOC")]
                if real_loc_codes:
                    stages_s += [{"$match":{"LOCAL":{"$in": real_loc_codes}}}]
            if include_siglas:
                stages_s += [{"$match":{"_SIGLA":{"$in": include_siglas}}}]
            if include_codigos:
                stages_s += [{"$match":{"CODIGO_PRODUCTO":{"$in": include_codigos}}}]

            stages_s += [
                {"$group": {
                    "_id": "$CODIGO_PRODUCTO",
                    "total": {"$sum": "$TOTAL"},
                    "cantidad": {"$sum": "$CANTIDAD"},
                }},
                {"$sort": {"_id": 1}},
            ]

            sales_rows_raw = list(db[COLL_SALES_HOURLY].aggregate(stages_s))

            # Mapear nombres de producto para la tabla de ventas
            codes_for_sales = [str(r.get("_id") or "") for r in sales_rows_raw]
            menus_map_sales = {str(m.get("codigo")): m for m in db.menus.find({"codigo": {"$in": codes_for_sales}}, {"codigo":1,"nombre":1})}

            sales_rows = []
            for r in sales_rows_raw:
                code_s = str(r.get("_id") or "")
                if not code_s:
                    continue
                t = float(r.get("total",0) or 0)
                c = float(r.get("cantidad",0) or 0)
                name_s = (menus_map_sales.get(code_s) or {}).get("nombre") or code_s
                # Para nivel 7 (cocina/garzón) ocultar montos: solo cantidades
                if role_level is not None and int(role_level) >= 7:
                    t_display = 0.0
                else:
                    t_display = t
                sales_rows.append({
                    "code": code_s,
                    "name": name_s,
                    "cantidad": int(c),
                    "total": round(t_display, 2),
                })

            if sales_rows:
                sales_table = {
                    "type": "data_table",
                    "key": "sales",
                    "title": f"Ventas por producto — {s_str} a {e_str}",
                    "columns": [
                        {"key":"code","label":"Código","type":"text","align":"left"},
                        {"key":"name","label":"Producto","type":"text","align":"left"},
                        {"key":"cantidad","label":"Unidades","type":"number","align":"right"},
                        {"key":"total","label":"Venta","type":"number","align":"right"},
                    ],
                    "rows": sales_rows,
                }
                payload_pc["related_tables"] = payload_pc.get("related_tables") or []
                payload_pc["related_tables"].append(sales_table)
        except Exception:
            pass

        return update, payload_pc

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
        title = f"**{nombre}**" if not codigo else f"**{nombre}** (\`{codigo}\`)"
        lines.append(f"{i}. {title}{(' — ' + meta) if meta else ''}{cat_str}{opt_str}")

    if len(matched) > MAX_ITEMS:
        lines.append(f"… y **{len(matched) - MAX_ITEMS}** más")

    return update, lines

# ===============================
# Ventas por hora de productos
# ===============================

from zoneinfo import ZoneInfo
from datetime import datetime, timedelta


COLL_SALES_HOURLY = "sales_by_waiter_hour"
RENTAB_COLL = "rentabilidad_producto_locales"


def _vh_resolve_period(per: dict) -> tuple[datetime, datetime, str, str, ZoneInfo]:
    tz = ZoneInfo((per.get("tz") or "America/Santiago"))
    now = datetime.now(tz).date()
    preset = (per.get("preset") or "").lower()
    s = e = None
    def _parse(d: str): return datetime.fromisoformat(d).date()
    try:
        if preset == "hoy": s=e=now
        elif preset == "ayer": s=e=(now - timedelta(days=1))
        elif preset == "este_mes":
            s = now.replace(day=1)
            n1 = s.replace(year=s.year+1,month=1,day=1) if s.month==12 else s.replace(month=s.month+1,day=1)
            e = n1 - timedelta(days=1)
        elif preset == "mes_pasado":
            f = now.replace(day=1); lp = f - timedelta(days=1)
            s = lp.replace(day=1); e = lp
        elif preset == "este_ano":
            s = now.replace(month=1, day=1); e = now
        else:
            st = (per.get("start") or "").strip(); en = (per.get("end") or "").strip()
            if st and en: s = _parse(st); e = _parse(en)
    except Exception:
        s = e = None
    if not s or not e:
        s = now.replace(day=1)
        n1 = s.replace(year=s.year+1,month=1,day=1) if s.month==12 else s.replace(month=s.month+1,day=1)
        e = n1 - timedelta(days=1)
    start_dt = datetime.combine(s, datetime.min.time()).replace(tzinfo=tz)
    end_excl = datetime.combine(e, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)
    return start_dt, end_excl, s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d"), tz


def _vh_group_expr(gb: str):
    if gb == "hora": return {"$toString":"$H"}
    if gb == "dia":  return {"$ifNull":["$DATE_STR","-"]}
    if gb == "mes":  return {"$ifNull":["$MONTH_STR","-"]}
    if gb == "local": return {"$ifNull":["$LOCAL","-"]}
    if gb == "local_mes": return {"$concat":[{"$ifNull":["$LOCAL","-"]}," | ",{"$ifNull":["$MONTH_STR","-"]}]}
    if gb == "local_dia": return {"$concat":[{"$ifNull":["$LOCAL","-"]}," | ",{"$ifNull":["$DATE_STR","-"]}]}
    if gb == "producto": return {"$ifNull":["$CODIGO_PRODUCTO","-"]}
    return {"$literal":"-"}