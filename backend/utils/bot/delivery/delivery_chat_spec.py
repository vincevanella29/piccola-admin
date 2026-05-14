"""
Delivery Chat Spec — registers INTENT_META, ENGINE_ROUTES, and FilterSpec
for delivery order queries from the delivery chat system.

Following the same pattern as consumos_spec.py:
1. INTENT_META  → registers "delivery_order" in intent classification
2. FilterSpec   → extracts order-related info from user text
3. ENGINE_ROUTES → routes to delivery_chat_handler
"""
from ..common.filters import FilterSpec, register_filter_spec


# ─── Intent Meta (for grok_route_intent classification) ────────────────

INTENT_META = {
    "key": "delivery_order",
    "desc": (
        "Consultas del cliente sobre su pedido de delivery: estado, ETA, "
        "qué pidió, dónde está el repartidor, cuánto falta para que llegue."
    ),
    "classification_hints": [
        "- Si el usuario pregunta 'dónde está mi pedido', 'cuánto falta', "
        "'qué pedí', 'estado de mi orden', 'quién lo trae', 'cuánto demora' => 'delivery_order'.",
    ],
}


# ─── Filter Spec ──────────────────────────────────────────────────────
# Simple spec — delivery chat context is injected by delivery_chat.py,
# so we only need to classify the user's intent sub-type.

SCHEMA = (
    '{'
    '  "query_type": "status|items|courier|eta|general",'
    '  "order_number": "PI-XXXXX (if mentioned, else null)"'
    '}'
)

RULES = (
    "- Clasifica la consulta del cliente sobre su pedido.\n"
    "- 'status': preguntas sobre el estado actual del pedido.\n"
    "- 'items': preguntas sobre qué pidió, cuántos productos, detalle.\n"
    "- 'courier': preguntas sobre quién lo trae, el repartidor.\n"
    "- 'eta': preguntas sobre cuánto falta, tiempo estimado.\n"
    "- 'general': cualquier otra consulta relacionada al pedido.\n"
    "- Si menciona un número de orden como PI-XXXXX, extráelo.\n"
    "- Devuelve SOLO JSON."
)


def _postprocess(plan: dict) -> dict:
    plan = plan or {}
    qt = (plan.get("query_type") or "general").strip().lower()
    if qt not in {"status", "items", "courier", "eta", "general"}:
        qt = "general"
    plan["query_type"] = qt
    return plan


SPEC = FilterSpec(
    key="delivery_order",
    schema_text=SCHEMA,
    rules_text=RULES,
    catalogs=[],
    postprocess=_postprocess,
    add_today=False,
)
register_filter_spec(SPEC)


# ─── Engine Routes ────────────────────────────────────────────────────

ENGINE_ROUTES = {
    "delivery_order": {
        "intent": "delivery_order",
        "kind": "filter_handler",
        "filter_key": "delivery_order",
        "filter_timeout": 2.0,
        "handler": "utils.bot.delivery.delivery_chat_handler:handle_delivery_query",
        "handler_timeout": 5.0,
        "filter_to_context": {"__full__": "delivery_spec"},
        # No access guard needed — delivery_chat_complete bypasses role checks
        "default_payload": {
            "type": "text_block_list",
            "intent": "delivery_order",
            "lines": [
                "No pude encontrar información de tu pedido. ¿Podrías darme más detalles?",
            ],
        },
    },
}
