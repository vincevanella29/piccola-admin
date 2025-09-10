import logging
from typing import Any, List, Dict, Optional

from utils.web3mongo import db

logger = logging.getLogger(__name__)


def _s(x: Any) -> str:
    return "" if x is None else str(x).strip()


# Expose a reusable formatter for a single location row
def to_location_item(r: dict) -> dict:
    loc_id = _s(r.get("id") or r.get("_id"))
    nombre = _s(r.get("nombre"))
    addr = _s(r.get("direccion"))
    city = _s(r.get("city"))
    state = _s(r.get("state"))
    phone = _s(r.get("telephone"))
    status = bool(r.get("status"))
    menu_count = len(r.get("menu_ids") or [])
    image_url = _s(r.get("image_url")) or _s(r.get("media_url")) or _s(r.get("media_r2"))
    map_url = _s(r.get("map_url"))
    permalink = _s(r.get("permalink") or r.get("permalink_slug"))
    return {
        "id": loc_id,
        "name": nombre,
        "address": addr,
        "city": city,
        "state": state,
        "phone": phone,
        "status": "activo" if status else "inactivo",
        "menu_count": menu_count,
        "image_url": image_url,
        "map_url": map_url,
        "permalink": permalink,
    }


# Simple best-effort matcher to find a single location by a free-text query
def find_location_by_query(q: str) -> Optional[Dict[str, Any]]:
    q = _s(q)
    if not q:
        return None
    ql = q.lower()
    rows = list(db.locations.find({}))
    if not rows:
        return None
    # Exact or contains by nombre/city/state; prefer exact nombre, then contains nombre, then city/state
    exact_nombre = [r for r in rows if _s(r.get("nombre")).lower() == ql]
    if exact_nombre:
        return to_location_item(exact_nombre[0])
    contains_nombre = [r for r in rows if ql in _s(r.get("nombre")).lower()]
    if contains_nombre:
        return to_location_item(contains_nombre[0])
    city_state = [r for r in rows if (ql in _s(r.get("city")).lower() or ql in _s(r.get("state")).lower())]
    if city_state:
        return to_location_item(city_state[0])
    return None


async def handle_locations(update, context):
    """Listar ubicaciones (locales). Permite filtrar por texto (nombre, ciudad, estado).
    """

    # Intent may carry q
    q = _s(context.user_data.get("locations_q"))

    ql = q.lower()
    # Treat generic words as no filter
    GENERIC = {"sucursales", "sucursal", "locales", "local", "ubicaciones", "ubicacion", "ubicación", "tiendas", "tienda"}
    if ql in GENERIC:
        ql = ""

    rows = list(db.locations.find({}))
    matched: List[Dict[str, Any]] = []
    for r in rows:
        nombre = _s(r.get("nombre"))
        city = _s(r.get("city"))
        state = _s(r.get("state"))
        if not ql or ql in nombre.lower() or ql in city.lower() or ql in state.lower():
            matched.append(r)

    # Si no hay datos en DB
    if not rows:
        return update, {
            "type": "text",
            "text": "No encontré locales que coincidan con tu búsqueda.",
        }

    # Si el filtro no trajo nada, mostramos todos como listado
    if not matched:
        matched = rows

    # Si hay 1 sola coincidencia, devolvemos ficha (card)
    if len(matched) == 1:
        item = to_location_item(matched[0])
        return update, {
            "type": "location_card",
            "location": item,
        }

    # Listado (máx 30) para UI
    MAX_ITEMS = 30
    items = [to_location_item(r) for r in matched[:MAX_ITEMS]]
    total = len(matched)
    return update, {
        "type": "location_list",
        "query": q,
        "total": total,
        "shown": len(items),
        "items": items,
    }
