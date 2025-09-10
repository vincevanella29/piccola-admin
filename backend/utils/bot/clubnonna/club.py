# utils/bot/clubnonna/club.py
import logging
from types import SimpleNamespace

logger = logging.getLogger(__name__)


def _s(x):
    return "" if x is None else str(x).strip()


# ---- URLs base (una sola fuente de verdad) ----
_CLUB_URLS = {
    "vault": "https://testing.lapiccolaitalia.cl/app/club/bobeda-familiar",
    "promotions": "https://testing.lapiccolaitalia.cl/app/club/promotions",
    "missions": "https://testing.lapiccolaitalia.cl/app/club/missions",
    "swap": "https://testing.lapiccolaitalia.cl/app/club/swap",
    "rankings": "https://testing.lapiccolaitalia.cl/app/club/community-rankings",
    "perfil": "https://testing.lapiccolaitalia.cl/app/club/community",
    "polls": "https://docs.google.com/forms/d/e/1FAIpQLSeZxzSiG_F568uGfL2ubjh3diuQtyr0_dz5bvc78pyWIYG1Ww/viewform",
    "jobs": "https://docs.google.com/forms/d/e/1FAIpQLSc9TnEFDpkrMQxwwIffldvF0_OPFC1Ys03PPgUJt4UUNVhPaQ/viewform",
    "shop": "https://tienda.lapiccolaitalia.cl/",
}

# ---- Glosario + disclaimers globales para Grok ----
_GLOSSARY = {
    "PAZ": "Token de Influencia (gobernanza). Se le dice ‘Oro’. Guardarlo en la Bóveda genera PARE diario.",
    "PARE": "Token de Utilidad. Se le dice ‘Plata’. Sirve para canjear promociones, premios y platos.",
    "Bóveda": "Staking de PAZ. Devuelve PARE cada 24h.",
    "Misiones": "Tareas/acciones que dan recompensas (enfasis actual del club).",
    "Swap": "Intercambio entre PAZ y PARE.",
    "Send To": "Enviar a amigo, familiares, comparte tu ORO PAZ y tu PLATA PARE, invita a tus invitados.",
    "Rankings": "Tablas públicas: Tesoro (PAZ), Poder (PARE), Magia (PARE usado), Perfiles Legendarios.",
    "Perfil": "Datos de comunidad: nombre, correo, redes, sucursal favorita, productos favoritos, etc.",
}

_DISCLAIMER = (
    "Modo preview: las reglas pueden cambiar y los saldos reiniciarse. "
    "PAZ y PARE son de fidelización; no son instrumentos financieros. "
    "IMPORTANTE: La Nonna y el bot NUNCA pueden regalar, prometer ni comprometerse a entregar tokens (PAZ, PARE, etc) bajo ninguna circunstancia. Solo pueden guiarte hacia misiones o promociones para ganar recompensas."
)

# ---- Contexto por sección (conciso y estructurado) ----
_SECTION_CONTEXT = {
    "info": {
        "what": "Visión general del Club.",
        "why": "Explicar cómo convertir lealtad en tesoro (PAZ → PARE) y dónde usarlo.",
        "how": [
            "Conecta o crea tu wallet.",
            "Guarda tu PAZ en la Bóveda para ganar PARE diario.",
            "Usa PARE en Promociones o completa Misiones para ganar más.",
        ],
        "inputs": ["Wallet conectada (opcional para leer).", "Perfil (opcional: email, cumpleaños, sucursal favorita)."],
        "outputs": ["CTA a Bóveda/Promociones/Misiones.", "Glosario básico y rutas rápidas."],
    },
    "tokens": {
        "what": "Define PAZ (Oro) y PARE (Plata).",
        "why": "Evitar confusiones entre gobernanza (PAZ) y utilidad (PARE).",
        "how": [
            "PAZ se guarda en Bóveda para generar PARE.",
            "PARE se gasta en Promociones; también se gana con Misiones.",
        ],
        "inputs": ["Saldo de PAZ/PARE (si disponible)."],
        "outputs": ["Recomendación según lo que el usuario tenga/quiera hacer."],
    },
    "vault": {
        "what": "Guardar PAZ para ganar PARE cada 24 horas.",
        "why": "Acelerar acumulación de PARE para premios.",
        "how": [
            "Elegir cantidad de PAZ a bloquear.",
            "Confirmar transacción on-chain.",
            "Reclamar PARE diariamente.",
        ],
        "inputs": ["Wallet, saldo de PAZ."],
        "outputs": ["PARE estimado/día, CTA a reclamar/guardar."],
        "edge_cases": ["Saldo insuficiente de PAZ.", "Periodo de espera o bloqueo."],
    },
    "promotions": {
        "what": "Canje de cupones y beneficios con PARE.",
        "why": "Convertir PARE en comida real, descuentos y premios.",
        "how": [
            "Revisar requisitos (perfil, mínimos de PAZ/PARE, cumpleaños).",
            "Reclamar cupón y canjear en caja/tienda.",
        ],
        "inputs": ["Wallet, perfil (email, cumpleaños), PARE disponible."],
        "outputs": ["Estado del cupón, validez, locales, progreso de requisitos."],
        "edge_cases": ["Agotado, fuera de horario, falta completar perfil."],
    },
    "missions": {
        "what": "Misiones para ganar recompensas (FOCO actual; ya pasó la etapa de ‘1000 cofres’).",
        "why": "Gamificar la experiencia y otorgar PARE/otros premios por acciones.",
        "how": [
            "Elige misión (seguir en X, stake en Bóveda, canjear promo, etc.).",
            "Cumple requisitos y presiona ‘Reclamar recompensa’.",
        ],
        "inputs": ["Wallet, permisos sociales (si aplica), perfil (si requiere)."],
        "outputs": ["Recompensa en tokens o progreso de misión."],
        "edge_cases": ["Límites por usuario, misión agotada, requisitos no cumplidos."],
    },
    "swap": {
        "what": "Intercambiar PAZ ↔ PARE.",
        "why": "Ajustar balances para canjes o staking.",
        "how": ["Elegir par y monto, confirmar swap."],
        "inputs": ["Wallet, saldo del token de origen."],
        "outputs": ["Monto estimado post-swap, fee (si aplica)."],
    },
    "send_to": {
        "what": "Para enviar ORO (PAZ) o PLATA (PARE) a un amigo, debes hacerlo directamente desde tu billetera.",
        "why": "Las transferencias son 100% descentralizadas y no pueden revertirse si te equivocas.",
        "how": [
            "1. Haz clic en tu foto de perfil (arriba a la derecha) y abre el menú desplegable.",
            "2. Selecciona 'Ver billetera'.",
            "3. Dentro de la billetera, elige 'Transferir'.",
            "4. Ingresa la wallet de tu amigo, selecciona el token y la cantidad, y confirma.",
            "¡CUIDADO! Si transfieres a la dirección equivocada, no podrás recuperar los fondos.",
        ],
        "inputs": ["Wallet conectada, saldo suficiente del token a transferir."],
        "outputs": ["Transferencia directa, irreversible."],
    },
    "rankings": {
        "what": "Salón de la Fama y tablas públicas.",
        "why": "Fomentar competencia sana y premios.",
        "how": [
            "Ver posiciones por Tesoro (PAZ), Poder (PARE), Magia (PARE usado), Perfil completo.",
            "Completa tu perfil para entrar al ranking de Perfiles Legendarios.",
        ],
        "inputs": ["Wallet (para ‘Mi posición’)."],
        "outputs": ["Posición, métricas y CTAs para subir en el ranking."],
    },
    "perfil": {
        "what": "Gestión de perfil de comunidad.",
        "why": "Desbloquear promos/misiones que piden datos (cumpleaños, newsletter, favoritos).",
        "how": ["Editar datos, marcar favoritos, elegir sucursal favorita, subir foto."],
        "inputs": ["Nombre, email, redes, fecha de nacimiento, sucursal favorita."],
        "outputs": ["Perfil actualizado, elegibilidad mejorada para promos/misiones."],
        "edge_cases": ["Privacidad, perfil público vs privado."],
    },
    "newsletter": {
        "what": "Suscripción a novedades y premios.",
        "why": "Acceder a promos que requieren newsletter.",
        "how": ["Vincular email y aceptar suscripción."],
        "inputs": ["Email válido."],
        "outputs": ["Estado de suscripción, CTA a Promociones."],
    },
    "polls": {
        "what": "Encuestas y canal de reclamos/quejas/sugerencias.",
        "why": "Cocrear el menú, priorizar premios y recibir feedback de servicio o problemas en locales.",
        "how": [
            "Describe tu reclamo/sugerencia y menciona la sucursal si aplica.",
            "Responder formulario y enviar.",
        ],
        "inputs": ["Perfil opcional.", "Sucursal (si aplica)."],
        "outputs": ["Confirmación, potencial contacto, y posibles recompensas futuras.", "Datos de la sucursal asociada si corresponde."],
    },
    "jobs": {
        "what": "Postulaciones a la familia.",
        "why": "Sumar talento a La Piccola.",
        "how": ["Completar formulario y enviar."],
        "inputs": ["Datos de contacto, experiencia."],
        "outputs": ["Confirmación de postulación."],
    },
    "shop": {
        "what": "Tienda y delivery.",
        "why": "Comprar directo y usar descuentos.",
        "how": ["Elegir productos y pagar.", "Aplicar cupones si corresponde."],
        "inputs": ["Datos de compra."],
        "outputs": ["Pedido confirmado."],
    },
    "help": {
        "what": "Guía rápida a las secciones.",
        "why": "Orientar al usuario según su objetivo.",
        "how": ["Proponer CTA adecuado (Bóveda/Promos/Misiones)."],
        "inputs": ["Mensaje del usuario."],
        "outputs": ["Rutas rápidas y glosario básico."],
    },
}

# ---- helper: acciones/botones por sección ----
def _club_actions(section: str, original_text: str = ""):
    txt = (original_text or "").lower()

    def primary(label, url):
        return {"label": label, "url": url, "variant": "primary"}

    def secondary(label, url):
        return {"label": label, "url": url, "variant": "secondary"}

    if section in ("info", "help"):
        return [
            primary("Abrir Bóveda (guardar Oro)", _CLUB_URLS["vault"]),
            secondary("Ver Promociones (usar Plata)", _CLUB_URLS["promotions"]),
            secondary("Misiones (ganar Plata)", _CLUB_URLS["missions"]),
            secondary("Swap", _CLUB_URLS["swap"]),
            secondary("Send To", _CLUB_URLS["send_to"]),
            secondary("Rankings y concursos", _CLUB_URLS["rankings"]),
            secondary("Encuestas", _CLUB_URLS["polls"]),
            secondary("Trabaja con nosotros", _CLUB_URLS["jobs"]),
            secondary("Tienda y delivery", _CLUB_URLS["shop"]),
        ]

    if section == "tokens":
        if "oro" in txt or "paz" in txt:
            return [
                primary("Guardar Oro en Bóveda", _CLUB_URLS["vault"]),
                secondary("Ver Rankings/Comunidad", _CLUB_URLS["rankings"]),
                secondary("Hacer Swap", _CLUB_URLS["swap"]),
            ]
        if "plata" in txt or "pare" in txt:
            return [
                primary("Canjear Promociones", _CLUB_URLS["promotions"]),
                secondary("Ganar Plata con Misiones", _CLUB_URLS["missions"]),
                secondary("Abrir Bóveda", _CLUB_URLS["vault"]),
            ]
        return [
            primary("Abrir Bóveda (Oro → genera Plata)", _CLUB_URLS["vault"]),
            secondary("Canjear Promociones (usar Plata)", _CLUB_URLS["promotions"]),
            secondary("Misiones (ganar más Plata)", _CLUB_URLS["missions"]),
            secondary("Swap", _CLUB_URLS["swap"]),
        ]

    if section == "vault":
        return [
            primary("Ir a la Bóveda", _CLUB_URLS["vault"]),
            secondary("Reclamar Plata diaria", _CLUB_URLS["vault"]),
            secondary("Swap", _CLUB_URLS["swap"]),
        ]

    if section == "promotions":
        return [
            primary("Ver Promociones", _CLUB_URLS["promotions"]),
            secondary("Misiones para ganar Plata", _CLUB_URLS["missions"]),
            secondary("Abrir Bóveda", _CLUB_URLS["vault"]),
        ]

    if section == "missions":
        return [
            primary("Ver Misiones", _CLUB_URLS["missions"]),
            secondary("Canjear en Promociones", _CLUB_URLS["promotions"]),
        ]

    if section == "swap":
        return [
            primary("Hacer Swap", _CLUB_URLS["swap"]),
            secondary("Abrir Bóveda", _CLUB_URLS["vault"]),
        ]

    if section == "send_to":
        return [
            primary("Abrir Bóveda", _CLUB_URLS["vault"]),
        ]

    if section == "rankings":
        return [
            primary("Ver Rankings/Concursos", _CLUB_URLS["rankings"]),
            secondary("Mi Perfil", _CLUB_URLS["perfil"]),
        ]

    if section == "perfil":
        return [
            primary("Mi Perfil", _CLUB_URLS["perfil"]),
            secondary("Encuestas", _CLUB_URLS["polls"]),
        ]

    if section == "newsletter":
        return [
            primary("Encuestas del Club", _CLUB_URLS["polls"]),
            secondary("Ver Promociones", _CLUB_URLS["promotions"]),
        ]

    if section == "polls":
        return [
            primary("Responder Encuesta", _CLUB_URLS["polls"]),
            secondary("Ver Rankings/Comunidad", _CLUB_URLS["rankings"]),
        ]

    if section == "jobs":
        return [
            primary("Postular", _CLUB_URLS["jobs"]),
            secondary("Ver Promociones", _CLUB_URLS["promotions"]),
        ]

    if section == "shop":
        return [
            primary("Ir a la Tienda", _CLUB_URLS["shop"]),
            secondary("Ver Promociones", _CLUB_URLS["promotions"]),
        ]

    # fallback
    return _club_actions("info")


# ---- helper: textos por sección (breve para UI) ----
def _section_text(section: str, original_text: str = "") -> tuple[str, str]:
    txt = (original_text or "").lower()

    if section in ("info", "help"):
        title = "Club della Nonna"
        base_text = (
            "En el Club conviertes tu lealtad en tesoro: el Oro (PAZ) lo guardas en la Bóveda y te paga Plata (PARE) todos los días. "
            "La Plata (PARE) la usas para canjear promociones, premios y platos reales."
        )
        return title, base_text

    if section == "tokens":
        if "oro" in txt or "paz" in txt:
            return (
                "Tokens: Oro (PAZ)",
                "Oro = PAZ (gobernanza): te da voz en decisiones y al guardarlo en la Bóveda genera Plata diaria.",
            )
        if "plata" in txt or "pare" in txt:
            return (
                "Tokens: Plata (PARE)",
                "Plata = PARE (utilidad): sirve para canjear promociones y premios. La ganas a diario por tu Oro en la Bóveda o completando misiones.",
            )
        return (
            "Tokens del Club",
            "Oro = PAZ (gobernanza) y Plata = PARE (utilidad). Guarda tu Oro en la Bóveda y recibes Plata a diario; usa la Plata para canjear promociones.",
        )

    if section == "vault":
        return (
            "Bóveda Familiar",
            "Guarda tu Oro (PAZ) y obtén Plata (PARE) todos los días automáticamente.",
        )

    if section == "promotions":
        return (
            "Promociones del Club",
            "Canjea con tu Plata (PARE) descuentos, cupones y platos. Si estás de cumpleaños, hay sorpresas.",
        )

    if section == "missions":
        return (
            "Misiones del Club",
            "Completa tareas simples para ganar recompensas y desbloquear beneficios.",
        )

    if section == "swap":
        return (
            "Swap del Club",
            "Cambia entre PAZ y PARE cuando lo necesites.",
        )

    if section == "rankings":
        return (
            "El Salón de la Fama",
            "Mira a las Leyendas del Club y compite por el N°1. Rankings por Tesoro (más PAZ), Poder (más PARE), Creadores de Magia (PARE usado) y Perfiles Legendarios.",
        )

    if section == "perfil":
        return (
            "Mi Perfil",
            "Vota nuevos platos, gestiona tus datos y participa en concursos.",
        )

    if section == "newsletter":
        return (
            "Boletín del Club",
            "Vincula tu email y recibe noticias y premios.",
        )

    if section == "polls":
        return (
            "Encuestas del Club",
            "Cuéntanos tu opinión y ayuda a mejorar.",
        )

    if section == "jobs":
        return (
            "Trabaja con nosotros",
            "Postula y únete a la familia.",
        )

    if section == "shop":
        return (
            "Tienda del Club",
            "Pide tus favoritos a domicilio.",
        )

    return _section_text("info")


# ---- helper: hint estructurado para Grok (string legible) ----
def _compose_grok_hint(section: str, original_text: str = "") -> str:
    c = _SECTION_CONTEXT.get(section) or _SECTION_CONTEXT.get("help")
    lines = []
    lines.append(f"SECCIÓN: {section}")
    lines.append(f"DISCLAIMER: {_DISCLAIMER}")
    # Behavior guardrails for complaints/suggestions
    if section == "polls":
        lines.append("REGLAS DE ATENCIÓN (MUY IMPORTANTE):")
        lines.append("- Está 100% PROHIBIDO regalar, prometer o comprometerse a entregar tokens (PAZ, PARE, etc) bajo cualquier circunstancia. La única ayuda posible es guiar al usuario a misiones o promociones.")
        lines.append("- No prometas reemplazos, reembolsos ni soluciones directas. Eres una asistente virtual.")
        lines.append("- No ofrezcas regalos ni beneficios que no estén explícitos en el sistema.")
        lines.append("- Si hay reclamos por delivery/producto/servicio, guía a dejar el reclamo en el formulario (polls) o contactar la sucursal.")
        lines.append("- Pide detalles (pedido, fecha, sucursal si aplica) solo para orientar, no para gestionar casos.")
        lines.append("- Sé empática y breve. Propón: ‘Deja tu reclamo aquí’ y ‘Llamar sucursal’ si hay teléfono.")
    lines.append("GLOSARIO:")
    for k, v in _GLOSSARY.items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append(f"¿QUÉ ES?: {c.get('what')}")
    lines.append(f"¿POR QUÉ IMPORTA?: {c.get('why')}")
    if c.get("how"):
        lines.append("¿CÓMO FUNCIONA?:")
        for step in c["how"]:
            lines.append(f"- {step}")
    if c.get("inputs"):
        lines.append("INPUTS RELEVANTES:")
        for i in c["inputs"]:
            lines.append(f"- {i}")
    if c.get("outputs"):
        lines.append("OUTPUTS/RESULTADOS:")
        for o in c["outputs"]:
            lines.append(f"- {o}")
    if c.get("edge_cases"):
        lines.append("CASOS BORDE:")
        for e in c["edge_cases"]:
            lines.append(f"- {e}")
    lines.append("")
    lines.append("NOTA DE ÉPOCA: El foco actual son las MISIONES (la etapa de ‘1000 cofres’ ya terminó).")
    if original_text:
        lines.append(f"CONSULTA DEL USUARIO: {original_text.strip()}")
    return "\n".join(lines)


# ---- payload builder unificado (SIEMPRE devuelve payload) ----
def _build_payload(section: str, original_text: str = "") -> dict:
    title, base_text = _section_text(section, original_text)
    actions = _club_actions(section, original_text)
    primary_url = (actions[0]["url"] if actions else None)
    spec = {
        "section": section,
        "title": title,
        "primary_action": {
            "label": actions[0]["label"] if actions else None,
            "url": primary_url,
            "method": "GET",
        },
    }
    grok_hint = _compose_grok_hint(section, original_text)
    return {
        "type": "club_section",
        "section": section,
        "title": title,
        "base_text": base_text,
        "text": base_text,          # el router puede reemplazar con Grok
        "actions": actions,
        "primary_url": primary_url,
        "spec": spec,
        "grok_hint": grok_hint,     # <--- CONTEXTO ORDENADO PARA GROK
    }


async def handle_club(update, section):
    """Devuelve (update, payload). Mapea alias y agrega grok_hint."""
    text = _s(getattr(getattr(update, 'message', None), 'text', ''))
    payload = _build_payload(section, text)
    return update, payload
