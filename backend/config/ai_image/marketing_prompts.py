"""
config/ai_image/marketing_prompts.py
====================================
Prompt templates for marketing email image generation.
Uses the same Aurora/Grok infrastructure as ai_imagen.py.

Styles:
  banner — Horizontal header for newsletters (600x250 feel)
  promo  — Product highlight card (600x400 feel)
  hero   — Full-width hero scene with restaurant ambiance
"""

from typing import Optional


# ── Banner: Newsletter header ────────────────────────────────────────────────

BANNER_PROMPT = """\
[meta]
tipo = "banner_marketing_email_horizontal"
proposito = "header_newsletter_restaurante_italiano_premium"
estilo_general = "food_photography_editorial_premium"
calidad_tecnica = "4k_hiperrealista"
formato = "horizontal_16:7_centrado"
vibe = "elegante_apetitoso_premium"

[composicion]
layout = "Composición horizontal editorial. Los productos del menú son protagonistas."
balance = "Balance visual entre producto, espacio negativo y potencial área de texto."
regla_tercios = "Productos posicionados en puntos de interés según regla de tercios."

[sujeto_principal]
productos = "{productos_descripcion}"
presentacion = "Cada producto perfectamente iluminado y estilizado. Frescura visible."
estilo_comida = "Food styling editorial: gotas de condensación, vapor sutil, texturas vibrantes."

[iluminacion]
estilo = "Luz natural difusa lateral tipo ventana italiana, cálida y acogedora."
acentos = "Brillos especulares sutiles en salsas, aceites y superficies húmedas."
sombras = "Sombras suaves y envolventes, sin dureza."

[fondo_ambiente]
tipo = "Superficie de madera oscura rústica italiana o mármol oscuro."
profundidad = "Fondo ligeramente desenfocado (bokeh f/2.8) para resaltar productos."
extras = "Ingredientes decorativos sutiles (albahaca, tomates cherry, aceite de oliva) fuera de foco."

[restricciones]
texto = "NO incluir texto, logos ni watermarks. Solo fotografía pura."
limpieza = "Bordes limpios y simétricos para encajar en email de 600px de ancho."
{prompt_extra}
"""


# ── Promo: Product spotlight card ────────────────────────────────────────────

PROMO_PROMPT = """\
[meta]
tipo = "card_producto_destacado_email"
proposito = "destacar_producto_estrella_promocion"
estilo_general = "hero_shot_producto_premium_cenital_o_45grados"
calidad_tecnica = "4k_hiperrealista"
formato = "vertical_3:4_centrado"
vibe = "irresistible_premium_exclusivo"

[sujeto_principal]
productos = "{productos_descripcion}"
angulo = "Ángulo cenital (top-down) o 45 grados. El producto es ÚNICO protagonista."
limpieza = "Eliminación total de imperfecciones. Presentación impecable de restaurante Michelin."

[iluminacion]
estilo = "Spotlight cenital dramático sobre fondo oscuro."
enfoque = "Resaltar texturas, colores y frescura contra la oscuridad."
acentos = "Brillos especulares precisos en jugos, salsas, quesos derretidos."

[fondo]
color = "Negro absoluto o antracita profundo."
superficie = "Piedra volcánica negra o pizarra oscura natural."
composicion = "Producto centrado con espacio limpio arriba y abajo."

[restricciones]
texto = "NO incluir texto, precios ni logos. Solo la fotografía del producto."
{prompt_extra}
"""


# ── Hero: Full-width scene ───────────────────────────────────────────────────

HERO_PROMPT = """\
[meta]
tipo = "hero_image_email_restaurante"
proposito = "escena_ambiental_restaurante_italiano_premium"
estilo_general = "fotografia_lifestyle_gastronomica"
calidad_tecnica = "4k_cinematic"
formato = "horizontal_16:9_centrado"
vibe = "acogedor_italiano_autentico_premium"

[escena]
ambiente = "Mesa de restaurante italiano premium al anochecer. Iluminación cálida de velas."
elementos = "Platos italianos variados servidos elegantemente. Copa de vino. Pan artesanal."
productos_referencia = "{productos_descripcion}"
feeling = "Invitación a una experiencia gastronómica única. Hambre visual instantánea."

[iluminacion]
tipo = "Luz cálida ambiental tipo golden hour + velas. Moody pero acogedor."
temperatura = "Cálida (3200K-4000K). Tonos dorados y ámbar."
dramatismo = "Contraste medio. Zonas de sombra ricas que dan profundidad."

[fotografia]
lente = "35mm f/2.0 — perspectiva natural, ligeramente wide."
enfoque = "Profundidad de campo media. Primer plano nítido, fondo con bokeh suave."
composicion = "Perspectiva desde el lugar del comensal. Inmersiva."

[restricciones]
personas = "NO mostrar personas. Solo la mesa, los platos y el ambiente."
texto = "NO incluir texto, logos ni watermarks."
{prompt_extra}
"""


# ── Prompt builder ───────────────────────────────────────────────────────────

STYLE_MAP = {
    "banner": BANNER_PROMPT,
    "promo": PROMO_PROMPT,
    "hero": HERO_PROMPT,
}


def build_marketing_prompt(
    productos: list[dict],
    style: str = "banner",
    prompt_extra: str = "",
) -> str:
    """
    Build a marketing image prompt from product data and style.

    Args:
        productos: List of dicts with {nombre, descripcion, categoria, precio}
        style: 'banner' | 'promo' | 'hero'
        prompt_extra: Additional user instructions
    """
    template = STYLE_MAP.get(style, BANNER_PROMPT)

    # Build product description string
    prod_parts = []
    for p in productos[:5]:  # Max 5 products in context
        name = p.get("nombre", "Producto")
        desc = p.get("descripcion", "")
        cat = p.get("categoria", "")
        line = f'"{name}"'
        if desc:
            line += f" — {desc[:80]}"
        if cat:
            line += f" ({cat})"
        prod_parts.append(line)

    productos_descripcion = "; ".join(prod_parts) if prod_parts else "Platos italianos premium variados"

    extra_section = ""
    if prompt_extra:
        extra_section = f'instrucciones_extra = "{prompt_extra}"'

    return template.format(
        productos_descripcion=productos_descripcion,
        prompt_extra=extra_section,
    ).strip()
