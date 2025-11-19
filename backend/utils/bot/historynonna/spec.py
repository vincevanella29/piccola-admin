# utils/bot/historynonna/spec.py
from ..common.filters import FilterSpec, register_filter_spec

SCHEMA = (
    '{"section":"timeline"}'
)
RULES = (
    "- Clasifica consultas relacionadas a la historia de La Piccola Italia.\n"
    "- Si preguntan por historia, cronología, timeline, hitos, fechas, años, trayectoria => timeline.\n"
    "- Por defecto => timeline."
)

register_filter_spec(FilterSpec(
    key="history",
    schema_text=SCHEMA,
    rules_text=RULES,
    catalogs=[],
    add_today=False,
))


# Metadata declarativa de la intent 'history' para el router de intents (common.grok_route_intent)
INTENT_META = {
    "key": "history",
    "desc": "Historia de La Piccola Italia: cronología de hitos importantes, visión y resiliencia familiar.",
    "classification_hints": [
        "- Usa 'history' cuando el usuario pregunte por la historia de La Piccola Italia, cronología, años, hitos, quiebras, expansión o visión futura.",
        "- El filtro 'history' siempre devuelve la sección 'timeline'.",
        "- No uses 'history' para preguntas de ventas, sueldos, gastos ni menú; sólo para contexto institucional/histórico.",
    ],
}


ENGINE_ROUTES = {
    "history": {
        "intent": "history",
        "kind": "filter_handler",
        "filter_key": "history",
        "filter_timeout": 1.5,
        "handler": "utils.bot.historynonna.history:handle_history",
        "handler_timeout": 4.0,
        "filter_to_context": {},
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Para history usamos el texto/intro del payload como resumen principal; no necesitamos summary extra.
        "summary": {},
        "default_payload": {
            "type": "history_timeline",
            "section": "timeline",
            "title": "Cronología de Hitos Importantes",
            "items": [],
        },
    },
}

