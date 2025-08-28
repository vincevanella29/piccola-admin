import logging
from typing import Any

from utils.web3mongo import db
from ..common.common import grok_route_intent

logger = logging.getLogger(__name__)


def _s(x: Any) -> str:
    return "" if x is None else str(x).strip()


async def handle_locations(update, context):
    """Listar ubicaciones (locales). Permite filtrar por texto (nombre, ciudad, estado).
    """
    text = update.message.text or ""

    # Intent may carry q
    q = _s(context.user_data.get("locations_q"))
    if not q:
        intent = await grok_route_intent(text)
        if intent and intent.get("intent") == "locations":
            q = _s(intent.get("q"))

    ql = q.lower()
    # Treat generic words as no filter
    GENERIC = {"sucursales", "sucursal", "locales", "local", "ubicaciones", "ubicacion", "ubicación", "tiendas", "tienda"}
    if ql in GENERIC:
        ql = ""

    rows = list(db.locations.find({}))
    matched = []
    for r in rows:
        nombre = _s(r.get("nombre"))
        city = _s(r.get("city"))
        state = _s(r.get("state"))
        if not ql or ql in nombre.lower() or ql in city.lower() or ql in state.lower():
            matched.append(r)

    # Fallback: if filter yielded nothing, show all
    if not matched:
        matched = rows
        # If still empty, report no data
        if not matched:
            # Return early with a simple line response
            return update, ["No encontré locales con ese filtro."]

    MAX_ITEMS = 30
    lines = []
    header = "Locales disponibles" if not q else f"Locales que coinciden con '{q}'"
    lines.append(header + ":")

    for i, r in enumerate(matched[:MAX_ITEMS], start=1):
        _id = _s(r.get("_id") or r.get("id"))
        nombre = _s(r.get("nombre"))
        addr = _s(r.get("direccion"))
        city = _s(r.get("city"))
        phone = _s(r.get("telephone"))
        status = "activo" if r.get("status") else "inactivo"
        menu_count = len(r.get("menu_ids") or [])
        details = []
        if city:
            details.append(city)
        if phone:
            details.append(phone)
        if menu_count:
            details.append(f"{menu_count} menús")
        meta = " · ".join(details)
        lines.append(f"{i}. {_id} — {nombre}{' — ' + addr if addr else ''}{' — ' + meta if meta else ''} ({status})")

    if len(matched) > MAX_ITEMS:
        lines.append(f"… y {len(matched) - MAX_ITEMS} más")

    # Return the prepared lines to be sent/logged by telegram_bot
    return update, lines
