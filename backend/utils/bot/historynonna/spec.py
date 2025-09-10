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
