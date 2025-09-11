import os
import logging
from typing import List, Dict, Any, Tuple

from utils.web3mongo import db
from ..common.filters import grok_filters
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
    if include_codigos_filter:
        set_codes = set(include_codigos_filter)
        for m in menus:
            code = _norm_str(m.get("codigo")).upper()
            if code and code in set_codes:
                matched.append(m)
        # Si ya logramos matches por include_codigos, continuamos al render/receta
        # (dejamos by/q como señal secundaria)
        if matched:
            # fall through to next phases (recipe/detail/listado) sin volver a filtrar
            pass
        else:
            # si no coincidió nada por include_codigos, seguimos con matching normal
            include_codigos_filter = []

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

        # 1) Card de producto (estilo web) — usamos product_card para que el front lo pinte bonito
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
        out_items: List[Dict[str, Any] | str] = [
            {"type": "product_card", "text": nombre, "product": prod}
        ]

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
        for mesano in mesanos[:2]:
            rows = list(
                db.recetas_productos.find({
                    "producto_codigo": codigo,
                    "mesano": mesano,
                }).sort("linea", 1)
            )
            # Tabla estructurada de receta
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

            cols = [
                {"key":"ingredient","label":"Ingrediente","type":"text","align":"left"},
                {"key":"qty_text","label":"Cantidad","type":"text","align":"right"},
                {"key":"unit","label":"Unidad","type":"text","align":"left"},
            ]
            # Agregar columna de porcentaje si existe al menos uno
            if any("pct" in r for r in recipe_rows):
                cols.append({"key":"pct","label":"%","type":"number","align":"right"})

            out_items.append({
                "type": "data_table",
                "key": "recipe",
                "title": f"Receta — {mesano}",
                "columns": cols,
                "rows": recipe_rows,
            })

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


async def handle_productos_hora(update, context):
    """Ventas por hora de productos, con grouping flexible y payload estructurado (data_table)."""
    text = update.message.text or ""
    vf = await grok_filters("menus", text) or {}
    per = vf.get("period") or {}
    start_dt, end_excl, s_str, e_str, tz = _vh_resolve_period(per)
    # cap por carga (como ventas_hora)
    now = datetime.now(tz)
    loaded_until = now.date() - timedelta(days=(1 if now.hour>=4 else 2))
    cap_end = datetime.combine(loaded_until, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)
    end_excl = min(end_excl, cap_end)
    if end_excl <= start_dt: start_dt = end_excl - timedelta(days=1)

    # Normaliza UTC naive para consultas
    from zoneinfo import ZoneInfo as _ZI
    _UTC = _ZI("UTC")
    match_start = start_dt.astimezone(_UTC).replace(tzinfo=None)
    match_end   = end_excl.astimezone(_UTC).replace(tzinfo=None)

    group_by = (vf.get("group_by") or "producto").lower()
    measure  = (vf.get("measure") or "total").lower()  # total|cantidad|avg_precio
    order_by = (vf.get("order_by") or "value_desc").lower()
    view     = vf.get("view") or {}
    limit_groups = int(view.get("limit_groups", 200))

    f = vf.get("filters") or {}
    include_locals   = [str(x) for x in (f.get("include_locals") or [])]
    include_siglas   = [str(x).upper() for x in (f.get("include_siglas") or [])]
    include_codigos  = [str(x).upper() for x in (f.get("include_codigos") or [])]
    hour_in          = f.get("hour_in") or []
    dow_in           = f.get("dow_in") or []

    # Si el query textual sugiere familia (p.ej., "lasagnas") y venimos con 0/1 código, amplía derivando desde menus/categories
    q_text = (vf.get("q") or "").strip() or (text or "").strip()
    by = (vf.get("by") or "texto").lower()
    if q_text:
        try:
            needles = set(_singularize_tokens_es(q_text))
            # nombres/descr
            extra_codes = set()
            for m in db.menus.find({}, {"codigo":1, "nombre":1, "descripcion":1, "category_ids":1}).limit(6000):
                name = _no_accents(str(m.get("nombre") or "").lower())
                descr = _no_accents(str(m.get("descripcion") or "").lower())
                if any(n in name or n in descr for n in needles):
                    c = str(m.get("codigo") or "").upper()
                    if c:
                        extra_codes.add(c)
            # categorías por nombre también
            cat_needles = set(list(needles))
            cat_ids = set()
            for cdoc in db.categories.find({}, {"id":1, "nombre":1, "name":1}).limit(4000):
                nm = _no_accents(str(cdoc.get("nombre") or cdoc.get("name") or "").lower())
                if any(n in nm for n in cat_needles):
                    cid = str(cdoc.get("id") or cdoc.get("_id") or "").strip()
                    if cid:
                        cat_ids.add(cid)
            if cat_ids:
                for m in db.menus.find({"category_ids": {"$in": list(cat_ids)}}, {"codigo":1}).limit(10000):
                    c = str(m.get("codigo") or "").upper()
                    if c:
                        extra_codes.add(c)
            # Si ya hay include_codigos, únelo; si había 0 o 1, expándelo
            if extra_codes:
                merged = list({*include_codigos, *extra_codes})[:500]
                include_codigos = merged
        except Exception:
            pass

    tz_name = str(tz)
    stages = [
        {"$addFields": {"_ts": {"$cond": [{"$eq": [{"$type": "$FECHA"}, "date"]}, "$FECHA", {"$toDate": "$FECHA"}]}}},
        {"$match": {"_ts": {"$gte": match_start, "$lt": match_end}}},
        {"$addFields": {
            "H": {"$ifNull": ["$HORA", {"$hour": {"date": "$_ts", "timezone": tz_name}}]},
            "DATE_STR": {"$dateToString":{"format":"%Y-%m-%d","date":"$_ts","timezone":tz_name}},
            "MONTH_STR": {"$dateToString":{"format":"%Y-%m","date":"$_ts","timezone":tz_name}},
            "_SIGLA": {"$toUpper": {"$substrCP":[{"$ifNull":["$LOCAL",""]},0,3]}},
        }},
        {"$project": {
            "_id":0, "LOCAL":1, "CODIGO_PRODUCTO":1,
            "TOTAL": {"$ifNull":["$TOTAL",0]},
            "CANTIDAD": {"$ifNull":["$CANTIDAD",0]},
            "H":1, "DATE_STR":1, "MONTH_STR":1, "_SIGLA":1,
        }}
    ]
    if include_locals:
        real_loc_codes = [x for x in include_locals if isinstance(x, str) and x.upper().endswith("LOC")]
        if real_loc_codes: stages += [{"$match":{"LOCAL":{"$in": real_loc_codes}}}]
    if include_siglas: stages += [{"$match":{"_SIGLA":{"$in": include_siglas}}}]
    if include_codigos: stages += [{"$match":{"CODIGO_PRODUCTO":{"$in": include_codigos}}}]
    if hour_in: stages += [{"$match":{"H":{"$in": hour_in}}}]

    gid = _vh_group_expr(group_by)
    stages += [
        {"$addFields":{"_g": gid}},
        {"$group":{
            "_id":"$_g",
            "total":{"$sum":"$TOTAL"},
            "cantidad":{"$sum":"$CANTIDAD"},
        }}
    ]
    if measure == "total":
        stages += [{"$addFields":{"value":"$total"}}]
    elif measure == "cantidad":
        stages += [{"$addFields":{"value":"$cantidad"}}]
    else:
        stages += [{"$addFields":{"value":{"$cond":[{"$gt":["$cantidad",0]}, {"$divide":["$total","$cantidad"]}, 0]}}}]

    if order_by == "group_asc": stages += [{"$sort":{"_id":1}}]
    elif order_by == "value_asc": stages += [{"$sort":{"value":1}}]
    else: stages += [{"$sort":{"value":-1}}]
    stages += [{"$limit": int(max(5, min(limit_groups, 500)))}]

    rows = list(db[COLL_SALES_HOURLY].aggregate(stages))

    # Enriquecer con metadata de producto y recetas (si corresponde)
    role_level = None
    try:
        role_level = int(getattr(context, "user_data", {}).get("role_level"))
    except Exception:
        role_level = None
    authorized = role_level in {3,4}
    detail = bool((vf.get("view") or {}).get("detail", False))
    menus_map = {}
    if group_by == "producto":
        # Minimapa de menus por código
        menus_map = {str(m.get("codigo")): m for m in db.menus.find({}, {"codigo":1,"nombre":1,"precio":1,"currency":1,"media_r2":1,"media_url":1,"media_local":1})}

    # Build data_table payload
    nice_measure = {"total":"Venta","cantidad":"Unidades","avg_precio":"Precio prom."}[measure if measure in {"total","cantidad","avg_precio"} else "total"]
    title = f"Ventas por hora — {nice_measure} — {s_str} a {e_str} — agrupado por {group_by}"
    columns = [
        {"key":"group","label":group_by,"type":"text","align":"left"},
        {"key":"total","label":"Venta","type":"number","align":"right"},
        {"key":"cantidad","label":"Unidades","type":"number","align":"right"},
        {"key":"avg_precio","label":"Precio prom.","type":"number","align":"right"},
    ]
    out_rows = []
    for r in rows:
        t = float(r.get("total",0) or 0)
        c = float(r.get("cantidad",0) or 0)
        ap = (t/c) if c else 0.0
        row = {
            "group": str(r.get("_id")),
            "total": round(t,2),
            "cantidad": int(c),
            "avg_precio": round(ap,2),
        }
        # Si agrupo por producto, adjunto nombre/imágen, y receta si autorizado+detail
        if group_by == "producto":
            code = str(r.get("_id") or "")
            m = menus_map.get(code) or {}
            name = (m.get("nombre") or code)
            row["code"] = code
            row["name"] = name
            # Mostrar nombre + código en la columna principal también (como en 'productos')
            row["group"] = f"{name} ({code})" if name and code else (name or code)
            # simple image URL chooser
            img = m.get("media_r2") or m.get("media_url")
            row["image_url"] = img
            if authorized and detail and s_str and e_str and s_str[:7] == e_str[:7]:
                mesano = s_str.replace("-","")[:6]
                try:
                    recs = list(db.recetas_productos.find({"producto_codigo": code, "mesano": mesano}).sort("linea", 1))
                    lines = []
                    for rr in recs[:50]:
                        ing = str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo") or "").strip()
                        qty = rr.get("cantidad_ingrediente")
                        unit = str(rr.get("u_medida_compra") or rr.get("u_medida_base") or "").strip()
                        qty_s = (f"{qty:.3f}" if isinstance(qty,(int,float)) else str(qty))
                        lines.append(f"- {ing} — {qty_s} {unit}".strip())
                    if lines:
                        row["recipe"] = {"mesano": mesano, "lines": lines}
                except Exception:
                    pass
        out_rows.append(row)

    totals = {
        "total": sum(float(r.get("total",0) or 0) for r in rows),
        "cantidad": int(sum(float(r.get("cantidad",0) or 0) for r in rows)),
    }
    csum = totals["cantidad"] or 1
    totals["avg_precio"] = round((totals["total"]/csum), 2)

    payload = {
        "type": "data_table",
        "title": title,
        "text": title,
        "subtitle": None,
        "kpis": [
            {"label":"Venta", "value": _fmt_money(totals["total"], "$")},
            {"label":"Unidades", "value": f"{totals['cantidad']:,} uds".replace(",",".")},
            {"label":"Precio prom.", "value": _fmt_money(totals["avg_precio"], "$")},
        ],
        "columns": columns,
        "rows": out_rows,
        "totals": totals,
        "charts": None,
    }

    # Tabla separada de recetas (fuente para el front): por producto listado
    if group_by == "producto":
        codes = [r.get("code") or str(r.get("group")) for r in out_rows]
        codes = [str(c) for c in codes if c]
        # Si viene un filtro include_codigos desde el SPEC/NLP, intersectamos para enviar SOLO los activos
        try:
            filt_codes = [str(x).upper() for x in (f.get("include_codigos") or [])]
        except Exception:
            filt_codes = []
        if filt_codes:
            s = set(codes)
            codes = [c for c in codes if c in s and c in filt_codes]
        recipes_rows = []
        if codes:
            try:
                same_month = bool(s_str and e_str and s_str[:7] == e_str[:7])
                mesano_fixed = s_str.replace("-", "")[:6] if same_month else None
                for code in codes:
                    # Determinar mesano a usar: el del período si es único, si no, el último disponible por código
                    use_mesano = mesano_fixed
                    if not use_mesano:
                        _latest = db.recetas_productos.find({"producto_codigo": code}, {"mesano":1}).sort("mesano", -1).limit(1)
                        latest_doc = next(iter(_latest), None)
                        use_mesano = str(latest_doc.get("mesano")) if latest_doc and latest_doc.get("mesano") else None
                    if not use_mesano:
                        continue
                    cur = db.recetas_productos.find({"producto_codigo": code, "mesano": use_mesano}).sort([("producto_codigo",1),("linea",1)])
                    for rr in cur:
                        ing = str(rr.get("ingrediente_nombre") or rr.get("ingrediente_codigo") or "").strip()
                        qty = rr.get("cantidad_ingrediente")
                        unit = str(rr.get("u_medida_compra") or rr.get("u_medida_base") or "").strip()
                        recipes_rows.append({
                            "code": code,
                            "ingredient": ing,
                            "qty": float(qty) if isinstance(qty,(int,float)) else None,
                            "qty_text": (f"{qty:.3f}" if isinstance(qty,(int,float)) else (str(qty) if qty is not None else "")),
                            "unit": unit,
                            "mesano": use_mesano,
                        })
            except Exception:
                recipes_rows = []
        if recipes_rows:
            payload["related_tables"] = payload.get("related_tables") or []
            payload["related_tables"].append({
                "type":"data_table",
                "key":"recipes",
                "title": "Recetas",
                "columns":[
                    {"key":"code","label":"Código","type":"text","align":"left"},
                    {"key":"ingredient","label":"Ingrediente","type":"text","align":"left"},
                    {"key":"qty_text","label":"Cantidad","type":"text","align":"right"},
                    {"key":"unit","label":"Unidad","type":"text","align":"left"},
                ],
                "rows": recipes_rows,
            })

    # Drilldown por día: lista de productos por fecha con cantidades/totales para abrir modal en el front
    if group_by == "dia":
        stages2 = [
            {"$addFields": {"_ts": {"$cond": [{"$eq": [{"$type": "$FECHA"}, "date"]}, "$FECHA", {"$toDate": "$FECHA"}]}}},
            {"$match": {"_ts": {"$gte": match_start, "$lt": match_end}}},
            {"$addFields": {
                "H": {"$ifNull": ["$HORA", {"$hour": {"date": "$_ts", "timezone": tz_name}}]},
                "DATE_STR": {"$dateToString": {"format": "%Y-%m-%d", "date": "$_ts", "timezone": tz_name}},
                "_SIGLA": {"$toUpper": {"$substrCP": [{"$ifNull": ["$LOCAL", ""]}, 0, 3]}}
            }},
            {"$project": {"_id":0, "DATE_STR":1, "CODIGO_PRODUCTO":1, "TOTAL": {"$ifNull":["$TOTAL",0]}, "CANTIDAD": {"$ifNull":["$CANTIDAD",0]}, "LOCAL":1, "_SIGLA":1}},
        ]
        if include_locals:
            real_loc_codes = [x for x in include_locals if isinstance(x, str) and x.upper().endswith("LOC")]
            if real_loc_codes: stages2 += [{"$match":{"LOCAL":{"$in": real_loc_codes}}}]
        if include_siglas: stages2 += [{"$match":{"_SIGLA":{"$in": include_siglas}}}]
        if include_codigos: stages2 += [{"$match":{"CODIGO_PRODUCTO":{"$in": include_codigos}}}]
        if dow_in:
            # Si envían dow_in, filtramos por el día de semana equivalente
            stages2.insert(2, {"$addFields": {"_DOW": {"$isoDayOfWeek": {"date": "$_ts", "timezone": tz_name}}}})
            stages2.append({"$match": {"_DOW": {"$in": [((d % 7) or 7) for d in dow_in]}}})
        # Agrupar por día y producto
        stages2 += [
            {"$group": {"_id": {"day": "$DATE_STR", "code": "$CODIGO_PRODUCTO"}, "total": {"$sum": "$TOTAL"}, "cantidad": {"$sum": "$CANTIDAD"}}},
            {"$sort": {"_id.day": 1, "cantidad": -1}},
            {"$limit": 20000}
        ]
        rows2 = list(db[COLL_SALES_HOURLY].aggregate(stages2))
        # join nombres
        menus_map2 = {str(m.get("codigo")): m for m in db.menus.find({}, {"codigo":1,"nombre":1,"media_r2":1,"media_url":1})}
        drill_rows = []
        seen = set()
        days_present = set()
        for r in rows2:
            code = str((r.get("_id") or {}).get("code") or "")
            day = str((r.get("_id") or {}).get("day") or "")
            days_present.add(day)
            m = menus_map2.get(code) or {}
            name = (m.get("nombre") or code)
            t = float(r.get("total") or 0.0)
            c = int(r.get("cantidad") or 0)
            ap = (t/c) if c else 0.0
            drill_rows.append({
                "day": day,
                "code": code,
                "name": name,
                "total": round(t,2),
                "cantidad": c,
                "avg_precio": round(ap,2),
                "image_url": (m.get("media_r2") or m.get("media_url") or None),
            })
            seen.add((day, code))
        # Completar con 0 para todos los códigos solicitados en cada día detectado
        if include_codigos and days_present:
            for day in sorted(days_present):
                for code in include_codigos:
                    key = (day, code)
                    if key in seen:
                        continue
                    m = menus_map2.get(code) or {}
                    name = (m.get("nombre") or code)
                    drill_rows.append({
                        "day": day,
                        "code": code,
                        "name": name,
                        "total": 0,
                        "cantidad": 0,
                        "avg_precio": 0,
                        "image_url": (m.get("media_r2") or m.get("media_url") or None),
                    })
        if drill_rows:
            payload["related_tables"] = payload.get("related_tables") or []
            payload["related_tables"].append({
                "type": "data_table",
                "key": "products_by_day",
                "title": "Productos por día (detalle)",
                "columns": [
                    {"key":"day","label":"Día","type":"text","align":"left"},
                    {"key":"code","label":"Código","type":"text","align":"left"},
                    {"key":"name","label":"Producto","type":"text","align":"left"},
                    {"key":"total","label":"Venta","type":"number","align":"right"},
                    {"key":"cantidad","label":"Unidades","type":"number","align":"right"},
                    {"key":"avg_precio","label":"Precio prom.","type":"number","align":"right"},
                ],
                "rows": drill_rows,
            })
    return update, payload
