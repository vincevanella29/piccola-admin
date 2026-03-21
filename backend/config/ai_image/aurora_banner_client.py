"""
Aurora Banner Client — Piccola Italia
======================================
Prompt builder + helpers for AI-generated banner images.

The banner AI generates a composed promotional image from:
  - Up to 4 product reference images (platos/bebidas)
  - Optional location name / context
  - Optional promotion text overlay
  - Custom headline text

Uses the same AuroraClient from aurora_client.py for the actual API call.
"""

from __future__ import annotations

import os
import io
import uuid
import logging
from typing import Optional, List
from datetime import datetime, timezone

from utils.r2_upload import upload_to_r2
from utils.web3mongo import db

logger = logging.getLogger("aurora_banner")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)
logger.propagate = False


# ── Estilos de banner ────────────────────────────────────────────────────────

BANNER_STYLES = {
    "promo_dark": {
        "label": "Promoción Oscura",
        "desc": "Fondo negro premium con productos destacados y texto dorado"
    },
    "promo_vibrant": {
        "label": "Promoción Vibrante",
        "desc": "Colores vivos, gradientes modernos, estilo editorial"
    },
    "elegant_minimal": {
        "label": "Elegante Minimalista",
        "desc": "Fondo limpio, tipografía serif, composición aireada"
    },
    "rustic_italian": {
        "label": "Rústico Italiano",
        "desc": "Texturas de madera, colores tierra, vibraciones artesanales"
    },
    "neon_modern": {
        "label": "Neón Moderno",
        "desc": "Fondo oscuro con acentos neón, estilo urbano contemporáneo"
    },
}


# ── Size formats ─────────────────────────────────────────────────────────────

SIZE_FORMATS = {
    "3:1":  { "ratio": "3:1",  "pixels": "1200x400px", "desc": "panorámico horizontal ultra-wide" },
    "2:1":  { "ratio": "2:1",  "pixels": "1200x600px", "desc": "banner horizontal wide" },
    "16:9": { "ratio": "16:9", "pixels": "1280x720px", "desc": "widescreen horizontal" },
    "4:3":  { "ratio": "4:3",  "pixels": "1200x900px", "desc": "formato clásico" },
    "1:1":  { "ratio": "1:1",  "pixels": "800x800px",  "desc": "cuadrado" },
    "9:16": { "ratio": "9:16", "pixels": "720x1280px", "desc": "vertical portrait story (celular)" },
}


# ── Prompt builder ────────────────────────────────────────────────────────────

_BANNER_PROMPT_BASE = """\
[meta]
tipo = "banner_publicitario_restaurante_premium"
proposito = "promocion_digital_carta_web_y_app"
calidad_tecnica = "4k_fotorealista_composicion_profesional"
formato = "{size_desc} {size_ratio} ({size_pixels})"
vibe = "{style_vibe}"

[escena]
composicion = "Banner {size_desc} con composición editorial equilibrada."
{productos_desc}
fondo = "{fondo_desc}"
"""

_BANNER_PROMPT_TEXT = """\
[texto_overlay]
headline = "{headline}"
{promo_text_desc}
fuente = "Serif moderna italiana premium (Bodoni o Didot), contraste alto."
color_texto = "Blanco con sombra sutil o dorado, legible sobre el fondo."
disposicion = "Texto alineado a la izquierda o centrado, no obstruye los productos."
"""

_BANNER_PROMPT_LOCATION = """\
[contexto_local]
ubicacion = "{location_name}"
descripcion_local = "{location_desc}"
integracion = "Incorporar sutilmente la identidad del local en la composición."
"""

_BANNER_PROMPT_FINAL = """\
[iluminacion]
estilo = "Iluminación de estudio cinematográfica, moody y premium."
acentos = "Brillos especulares en los platos y elementos jugosos."

[restricciones_criticas]
orden = "NO deformar ni transformar la comida de referencia. Los productos DEBEN verse apetitosos y reconocibles."
texto = "El texto DEBE ser legible y correcto ortográficamente. Si no puedes renderizar texto perfecto, omítelo y enfoca en la composición visual."
calidad = "Composición profesional de banner publicitario, no un collage amateur."
"""


STYLE_VIBES = {
    "promo_dark": "oscuro_premium_elegante_sofisticado_lujoso",
    "promo_vibrant": "vibrante_editorial_moderno_apetitoso",
    "elegant_minimal": "minimalista_aireado_limpio_serif_premium",
    "rustic_italian": "rustico_artesanal_italiano_calido_tierra",
    "neon_modern": "neon_urbano_nocturno_contemporaneo_cool",
}

STYLE_FONDOS = {
    "promo_dark": "Negro absoluto premium con textura sutil de piedra volcánica. Moody y dramático.",
    "promo_vibrant": "Gradiente vibrante de tonos cálidos (naranja a rojo profundo) con textura difusa.",
    "elegant_minimal": "Mármol blanco Carrara luminoso con vetas grises suaves y espacio negativo generoso.",
    "rustic_italian": "Mesa de madera de nogal oscuro con textura artesanal, cálida y rústica.",
    "neon_modern": "Negro profundo con líneas de neón verde/azul sutiles en los bordes.",
}


def build_banner_prompt(
    product_names: List[str],
    product_images: List[str],
    headline: str = "",
    promo_text: str = "",
    style: str = "promo_dark",
    image_size: str = "3:1",
    location_name: str = "",
    location_desc: str = "",
) -> str:
    """
    Build the AI prompt for a promotional banner composing up to 4 products.
    """
    style_key = style if style in STYLE_VIBES else "promo_dark"
    style_vibe = STYLE_VIBES[style_key]
    fondo_desc = STYLE_FONDOS[style_key]

    size_info = SIZE_FORMATS.get(image_size, SIZE_FORMATS["3:1"])

    # Products description
    n_products = len(product_names)
    if n_products == 0:
        productos_desc = 'productos = "Banner genérico de promoción sin productos específicos."'
    elif n_products == 1:
        productos_desc = (
            f'producto_principal = "{product_names[0]}" — protagonista central, bien visible y apetitoso.\n'
            f'disposicion = "Hero shot del producto centrado o levemente a la derecha para dejar espacio al texto."'
        )
    else:
        items_str = ", ".join(f'"{ n}"' for n in product_names[:4])
        productos_desc = (
            f'productos = [{items_str}]\n'
            f'disposicion = "Composición armoniosa de {min(n_products, 4)} productos distribuidos horizontalmente. '
            f'Cada producto de tamaño similar, sin superpolición. Estilo editorial de menú premium."'
        )

    # Build parts
    parts = [_BANNER_PROMPT_BASE.format(
        style_vibe=style_vibe,
        productos_desc=productos_desc,
        fondo_desc=fondo_desc,
        size_ratio=size_info["ratio"],
        size_pixels=size_info["pixels"],
        size_desc=size_info["desc"],
    )]

    # Text overlay
    if headline or promo_text:
        promo_text_desc = f'subtitulo = "{promo_text}"' if promo_text else ""
        parts.append(_BANNER_PROMPT_TEXT.format(
            headline=headline or "La Piccola Italia",
            promo_text_desc=promo_text_desc,
        ))

    # Location context
    if location_name:
        parts.append(_BANNER_PROMPT_LOCATION.format(
            location_name=location_name,
            location_desc=location_desc or "Restaurante italiano premium",
        ))

    parts.append(_BANNER_PROMPT_FINAL)

    return "\n".join(parts).strip()


# ── R2 upload ─────────────────────────────────────────────────────────────────

def upload_banner_ai_image(image_bytes: bytes, title: str) -> str:
    """Upload AI-generated banner image to R2 and return public URL."""
    safe = "".join(c if c.isalnum() or c == "-" else "_" for c in title.lower())[:40]
    key = f"banners/ai_generated/{safe}_{uuid.uuid4().hex[:8]}.png"
    return upload_to_r2(io.BytesIO(image_bytes), key=key, content_type="image/png", public=True)


# ── MongoDB: banner generation history ────────────────────────────────────────

def save_banner_generation(
    banner_id: Optional[str],
    image_url: str,
    prompt_headline: str,
    model: str,
    wallet: str,
    product_names: List[str],
    style: str,
) -> str:
    """Save a banner AI generation to history. Returns generation_id."""
    generation_id = uuid.uuid4().hex
    db.ai_banner_generations.insert_one({
        "_id": generation_id,
        "banner_id": banner_id,
        "image_url": image_url,
        "model": model,
        "prompt_headline": prompt_headline,
        "product_names": product_names,
        "style": style,
        "wallet": wallet,
        "accepted": None,
        "created_at": datetime.now(timezone.utc),
    })
    logger.info(f"[aurora_banner] ✅ Saved generation {generation_id}")
    return generation_id


def get_banner_generation_history(limit: int = 50) -> list:
    """Get recent banner AI generation history."""
    cursor = db.ai_banner_generations.find(
        {},
        {"_id": 1, "image_url": 1, "prompt_headline": 1, "model": 1,
         "accepted": 1, "created_at": 1, "product_names": 1, "style": 1}
    ).sort("created_at", -1).limit(limit)

    items = []
    for doc in cursor:
        items.append({
            "generation_id": doc["_id"],
            "image_url": doc.get("image_url"),
            "prompt_headline": doc.get("prompt_headline", ""),
            "product_names": doc.get("product_names", []),
            "style": doc.get("style", ""),
            "model": doc.get("model", ""),
            "accepted": doc.get("accepted"),
            "created_at": doc["created_at"].isoformat() if hasattr(doc.get("created_at", ""), "isoformat") else "",
        })
    return items
