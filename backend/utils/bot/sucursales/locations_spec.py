# bots/utils/sucursales/locations_spec.py
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm


def _catalog_locations(limit=800) -> List[str]:
    rows = list(db.locations.find({}, {"_id": 0, "nombre": 1, "permalink_slug": 1}).limit(limit))
    out = []
    for r in rows:
        out.append(f"{_norm(r.get('permalink_slug'))}|{_norm(r.get('nombre'))}")
    return out


def _postprocess_locations(obj: dict) -> dict:
    obj["q"] = _norm(obj.get("q"))
    return obj


SCHEMA = '{"q":""}'
RULES = "- Devuelve 'q' con texto para filtrar por nombre/ciudad/barrio."


SPEC = FilterSpec(
    key="locations",
    schema_text=SCHEMA,
    rules_text=RULES,
    catalogs=[("LOCALES(slug|nombre)", _catalog_locations)],
    postprocess=_postprocess_locations,
)
register_filter_spec(SPEC)


# Metadata declarativa de la intent 'locations' para el router de intents (common.grok_route_intent)
INTENT_META = {
    "key": "locations",
    "desc": "Ubicación/tiendas/sucursales (búsqueda por nombre/ciudad/barrio, direcciones y horarios).",
    # Texto que se puede inyectar en el prompt de clasificación para ayudar a Grok
    "classification_hints": [
        "- Usa 'locations' cuando el usuario pregunte por sucursales/locales/tiendas, direcciones, mapa, cómo llegar, horarios o qué locales hay en una ciudad/barrio.",
        "- Preguntas típicas: 'dónde queda Providencia', 'qué locales hay en Rancagua', 'horario del local de Alameda', 'dirección del local de Ñuñoa'.",
        "- No uses 'locations' para ventas, consumos ni sueldos; solo para información de ubicación y metadata de sucursales.",
    ],
}


ENGINE_ROUTES = {
    "locations": {
        "intent": "locations",
        "kind": "filter_handler",
        "filter_key": "locations",
        "filter_timeout": 2.0,
        "handler": "utils.bot.sucursales.locations:handle_locations",
        "handler_timeout": 4.0,
        "filter_to_context": {
            "q": "locations_q",
        },
        "access": {
            # Solo control por niveles (no centros de producción)
            "min_role_level": 1,
            "max_role_level": 7,
        },
        "default_payload": {
            "type": "text",
            "text": "No hay datos de sucursales ahora.",
        },
    }
}
