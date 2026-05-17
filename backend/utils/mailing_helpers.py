import os
from datetime import datetime
from utils.web3mongo import db

LOCATIONS_COLL = db.locations
MENUS_COLL = db.menus
DELIVERY_CONFIG_COLL = db.delivery_config

SITE_BASE_URL = os.getenv("PUBLIC_SITE_URL", "https://lapiccolaitalia.cl")

_MONTHS_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

def _format_order_date(ts) -> str:
    try:
        if isinstance(ts, (int, float)):
            dt = datetime.fromtimestamp(ts)
        elif isinstance(ts, datetime):
            dt = ts
        else:
            dt = datetime.fromisoformat(str(ts))
        return f"{dt.day} de {_MONTHS_ES[dt.month]}, {dt.year}"
    except Exception:
        return ""

def _get_status_label(status: str) -> str:
    try:
        config = DELIVERY_CONFIG_COLL.find_one({"type": "internal_statuses"})
        if config:
            for s in config.get("statuses", []):
                if s.get("key") == status:
                    return s.get("label", status)
    except Exception:
        pass
    fallback = {
        "pending": "Pendiente", "confirmed": "Confirmado",
        "preparing": "En preparación", "ready": "Listo para despacho",
        "dispatched": "En camino 🛵", "delivered": "Entregado ✅",
        "cancelled": "Cancelado",
    }
    return fallback.get(status, status)

def _build_order_items_html(items: list) -> str:
    codigos = [it.get("codigo", "") for it in items if it.get("codigo")]
    menu_map = {}
    if codigos:
        for doc in MENUS_COLL.find({"codigo": {"$in": codigos}}, {"codigo": 1, "media_r2": 1}):
            menu_map[doc["codigo"]] = doc.get("media_r2", "")

    rows_html = []
    for it in items:
        nombre = it.get("nombre", it.get("codigo", "Producto"))
        qty = it.get("quantity", 1)
        price = it.get("unit_price", 0)
        subtotal = price * qty
        img_url = menu_map.get(it.get("codigo", ""), "")

        img_cell = (
            f'<img src="{img_url}" alt="{nombre}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" />'
        ) if img_url else (
            '<div style="width:48px;height:48px;border-radius:8px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:20px;">🍕</div>'
        )

        rows_html.append(
            f'<tr style="border-bottom:1px solid #f0f0f0;">'
            f'<td style="padding:8px 4px;">{img_cell}</td>'
            f'<td style="padding:8px;font-size:13px;color:#2d2d2d;">{nombre}</td>'
            f'<td style="padding:8px;text-align:center;font-size:13px;color:#666;">{qty}x</td>'
            f'<td style="padding:8px;text-align:right;font-size:13px;font-weight:600;color:#2d2d2d;">${subtotal:,.0f}</td>'
            f'</tr>'
        )

    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
        '<thead><tr style="border-bottom:2px solid #22c55e;">'
        '<th style="width:56px;"></th>'
        '<th style="text-align:left;padding:8px;font-size:11px;color:#999;text-transform:uppercase;">Producto</th>'
        '<th style="text-align:center;padding:8px;font-size:11px;color:#999;text-transform:uppercase;">Cant.</th>'
        '<th style="text-align:right;padding:8px;font-size:11px;color:#999;text-transform:uppercase;">Subtotal</th>'
        '</tr></thead>'
        '<tbody>' + ''.join(rows_html) + '</tbody>'
        '</table>'
    )

def _build_order_items_text(items: list) -> str:
    parts = []
    for it in items:
        nombre = it.get("nombre", it.get("codigo", "Producto"))
        qty = it.get("quantity", 1)
        parts.append(f"{qty}x {nombre}")
    return ", ".join(parts)

def _build_suggested_products_html(order_items: list, limit: int = 3) -> str:
    codigos = [it.get("codigo", "") for it in order_items if it.get("codigo")]
    ordered_cats = set()
    if codigos:
        for doc in MENUS_COLL.find({"codigo": {"$in": codigos}}, {"category_ids": 1}):
            for cid in (doc.get("category_ids") or []):
                ordered_cats.add(cid)

    query = {
        "estado": {"$ne": False},
        "media_r2": {"$exists": True, "$ne": ""},
        "codigo": {"$nin": codigos},
    }
    if ordered_cats:
        query["category_ids"] = {"$in": list(ordered_cats)}

    suggestions = list(MENUS_COLL.find(
        query,
        {"nombre": 1, "precio": 1, "media_r2": 1, "codigo": 1},
    ).limit(limit * 2))

    if len(suggestions) < limit:
        fallback_query = {
            "estado": {"$ne": False},
            "media_r2": {"$exists": True, "$ne": ""},
            "codigo": {"$nin": codigos + [d["codigo"] for d in suggestions if d.get("codigo")]},
        }
        suggestions += list(MENUS_COLL.find(fallback_query, {"nombre": 1, "precio": 1, "media_r2": 1}).limit(limit))

    suggestions = suggestions[:limit]
    if not suggestions:
        return ""

    cards = []
    for prod in suggestions:
        img = prod.get("media_r2", "")
        nombre = prod.get("nombre", "")
        precio = prod.get("precio", 0)
        cards.append(
            f'<td style="width:33%;padding:4px;text-align:center;vertical-align:top;">'
            f'<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f0f0f0;">'
            f'<img src="{img}" alt="{nombre}" style="width:100%;height:120px;object-fit:cover;" />'
            f'<div style="padding:8px;">'
            f'<p style="font-size:12px;font-weight:600;color:#2d2d2d;margin:0;">{nombre}</p>'
            f'<p style="font-size:13px;font-weight:700;color:#22c55e;margin:4px 0 0;">${precio:,.0f}</p>'
            f'</div></div></td>'
        )

    cards_html = ''.join(cards)
    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
        '<tr>' + cards_html + '</tr>'
        '</table>'
    )
