# utils/bot/clubnonna/spec.py
from ..common.filters import FilterSpec, register_filter_spec

SCHEMA = (
    '{"section":"info|tokens|vault|promotions|missions|swap|rankings|perfil|newsletter|polls|jobs|shop|help|send_to"}'
)
RULES = (
    "- Clasifica a una sola sección del Club della Nonna según la consulta.\n"
    "- PRIORIDAD: Si hay reclamos/quejas/sugerencias/problemas/faltantes/no llegó/mal/erróneo/incorrecto/dañado/dañada => polls (aunque mencione delivery/pedido/tienda).\n"
    "- Si preguntan por cómo funciona en general, qué es el club, beneficios => info.\n"
    "- Si mencionan tokens, PAZ, PARE, oro, plata, utilidad, gobernanza, coin, moneda => tokens.\n"
    "- Si preguntan por bóveda, bobeda, boveda, staking, stake, cofre, guardar oro, depositar, intereses diarios => vault.\n"
    "- Si preguntan por promociones, promo, cumpleaños, cumple, canje, cupones, descuentos, quemar plata, productos gratis => promotions.\n"
    "- Si preguntan por misiones, tareas, quests, retos, desafíos, regalos => missions.\n"
    "- Si preguntan por swap, intercambiar, cambiar tokens, convertir, exchange => swap.\n"
    "- Si preguntan por ranking, concursos, top, competencia, mejores usuarios, familia => rankings.\n"
    "- Si preguntan por perfil, comunidad, votar, participación, votar platos, propuestas => perfil.\n"
    "- Si preguntan por boletín, newsletter, email, correo => newsletter.\n"
    "- Si preguntan por encuestas, formulario, opinión, feedback, reclamos, quejas, sugerencias, problemas => polls.\n"
    "- Si preguntan por trabaja con nosotros, empleo, trabajo, postular, postulaciones => jobs.\n"
    "- Si preguntan por tienda, e-commerce, delivery, pedidos, comprar online, despacho => shop (solo si NO hay palabras de reclamo).\n"
    "- Si preguntan por enviar a alguien tokens, oro, plata, utilidad, gobernanza, coin, moneda => send_to.\n"
    "- Por defecto => help."
)

register_filter_spec(FilterSpec(
    key="club",
    schema_text=SCHEMA,
    rules_text=RULES,
    catalogs=[],
    add_today=False,
))


# Metadata declarativa de la intent 'club' para el router de intents (common.grok_route_intent)
INTENT_META = {
    "key": "club",
    "desc": "Club della Nonna: secciones como bóveda, tokens, misiones, rankings, perfil, encuestas, tienda, etc.",
    "classification_hints": [
        "- Usa 'club' cuando el usuario pregunte explícitamente por el Club della Nonna, tokens PAZ/PARE, bóveda, misiones, rankings, comunidad, newsletter o encuestas del club.",
        "- El filtro 'club' clasifica la sección interna (info|tokens|vault|promotions|missions|swap|rankings|perfil|newsletter|polls|jobs|shop|help|send_to).",
        "- Para reclamos/quejas/sugerencias asociadas al Club o a la experiencia en locales, la sección preferida es 'polls'.",
    ],
}


ENGINE_ROUTES = {
    "club": {
        "intent": "club",
        "kind": "filter_handler",
        "filter_key": "club",
        "filter_timeout": 2.0,
        "handler": "utils.bot.clubnonna.club:handle_club",
        "handler_timeout": 4.0,
        "filter_to_context": {},
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Para club usamos el texto/base del payload, así que no necesitamos resumen adicional.
        "summary": {},
        "default_payload": {
            "type": "club_section",
            "section": "help",
            "title": "Club della Nonna",
            "text": "No hay datos del Club ahora.",
        },
    },
}

