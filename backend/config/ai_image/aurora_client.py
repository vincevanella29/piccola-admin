"""
Aurora AI Client — Piccola Italia
==================================
Librería centralizada para llamadas a la API de xAI (Grok Aurora).

Incluye:
  - Generación de imagen (image-to-image  /v1/images/edits)
  - Generación de imagen (text-to-image   /v1/images/generations)
  - Generación de video                   /v1/video/generations
  - Generación de descripción             /v1/chat/completions
  - Descarga de imagen como base64
  - Construcción de prompts (imagen + video)
  - Upload a R2 (imagen + video)
  - Helpers MongoDB (galería, video, descripción)

Uso:
    from config.aurora_client import AuroraClient
    client = AuroraClient()
    image_bytes, revised = await client.generate_image(prompt, ref_url="https://...")
"""

from __future__ import annotations

import os
import io
import uuid
import base64
import logging
from typing import Optional

import httpx
from fastapi import HTTPException
try:
    from PIL import Image as _PILImage
    _PIL_OK = True
except ImportError:
    _PIL_OK = False
from bson import ObjectId

from utils.r2_upload import upload_to_r2
from utils.web3mongo import db
from datetime import datetime, timezone

# ── Logger ────────────────────────────────────────────────────────────────────

logger = logging.getLogger("aurora_client")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)
logger.propagate = False


# ── Config ────────────────────────────────────────────────────────────────────

IMAGE_MODEL_PRO  = os.getenv("XAI_IMAGE_MODEL_PRO",  "grok-imagine-image-pro")
IMAGE_MODEL_STD  = os.getenv("XAI_IMAGE_MODEL_STD",  "grok-imagine-image")
VIDEO_MODEL      = os.getenv("XAI_VIDEO_MODEL",       "grok-imagine-video")
TEXT_MODEL       = os.getenv("XAI_MODEL",             "grok-2-latest")
XAI_API_KEY      = os.getenv("XAI_API_KEY")

# Endpoints según docs xAI (https://docs.x.ai/developers/model-capabilities/images/generation)
ENDPOINT_IMG_GEN  = os.getenv("XAI_IMAGE_URL",       "https://api.x.ai/v1/images/generations")
ENDPOINT_IMG_EDIT = os.getenv("XAI_IMAGE_EDIT_URL",  "https://api.x.ai/v1/images/edits")
ENDPOINT_VIDEO    = os.getenv("XAI_VIDEO_URL",        "https://api.x.ai/v1/videos/generations")  # plural!
ENDPOINT_VIDEO_GET= os.getenv("XAI_VIDEO_GET_URL",   "https://api.x.ai/v1/videos")              # GET /{request_id}
ENDPOINT_CHAT     = os.getenv("XAI_CHAT_URL",         "https://api.x.ai/v1/chat/completions")

MAX_IMAGES_PER_PRODUCT = 4


# ── Paletas de colores ────────────────────────────────────────────────────────

COLORES_RECIPIENTE: dict[str, str] = {
    "ceramica_negra":  "cerámica negra mate premium, superficie aterciopelada, oscura y opulenta",
    "pizarra_oscura":  "pizarra oscura natural con textura irregular y acabado artesanal premium",
    "ceramica_blanca": "cerámica blanca porcelana impecable, minimalista, clean",
    "terracota":       "terracota italiana artesanal, tonos tierra naranja-rojo cálidos",
    "carbon":          "carbón texturizado con destellos metálicos antracita sutiles",
    "marmol_negro":    "mármol negro Marquina con vetas blancas, ultra lujoso",
    "cobre":           "cobre metálico pulido con pátina oscura premium",
}

COLORES_FONDO: dict[str, tuple[str, str]] = {
    "negro_absoluto": (
        "Negro absoluto y profundo, mate y sin distracciones",
        "Piedra volcanica negra texturizada con reflejos de aceite sutiles (moody lighting)",
    ),
    "antracita": (
        "Negro antracita profundo y sofisticado, con profundidad gráfica",
        "Mármol antracita oscuro con venas grises finas y textura pulida",
    ),
    "azul_marino": (
        "Azul marino muy oscuro y profundo, aterciopelado e intenso",
        "Piedra pizarra azul-gris texturizada con matices marítimos",
    ),
    "verde_bosque": (
        "Verde bosque oscuro premium, profundo y misterioso",
        "Piedra verde oscura texturizada con humedad sutil, tipo musgo premium",
    ),
    "nogal_oscuro": (
        "Madera de nogal oscuro, rica y cálida, premium",
        "Madera de nogal oscuro con veta pronunciada y acabado satinado",
    ),
    "marmol_blanco": (
        "Mármol blanco Carrara luminoso, minimalista high-key",
        "Mármol blanco Carrara con vetas grises suaves y superficie fría",
    ),
    "granito_gris": (
        "Granito gris oscuro profundo, industrial y elegante",
        "Granito gris oscuro con grano fino y superficie semipulida",
    ),
}


# ── Prompt builders ───────────────────────────────────────────────────────────

_PROMPT_META = (
    '[meta]\n'
    'tipo = "fotografia_comercial_catalogo_restaurante_estudio"\n'
    'proposito = "presentacion_menu_web_premium_ecom"\n'
    'estilo_general = "minimalismo_oscuro_premium"\n'
    'calidad_tecnica = "8k_hiperrealista_uhd"\n'
    'formato = "1:1 cuadrado_perfectamente_centrado"\n'
    'vibe = "exclusiva_impecable_sofisticada"'
)

_PROMPT_SUJETO = (
    '[sujeto_principal.articulo]\n'
    'analisis_entrada = "REPLICAR CON EXACTITUD EL TIPO DE PRODUCTO Y LA DISPOSICION DE ELEMENTOS '
    'DE LA IMAGEN DE ENTRADA (ej. el plato final, el coctel completo, la botella especifica, el postre, etc.)"\n'
    'limpieza = "Eliminar cualquier imperfeccion, miga no deseada, mancha o elemento del fondo '
    'original para un acabado impecable."'
)

_PROMPT_TEXTURAS = (
    'mejoras_textura = "Resaltar las texturas naturales del producto. '
    'CARNE: mas jugosa con marcas marcadas; '
    'VEGETALES/FRUTAS: mas frescos y vibrantes; '
    'LIQUIDOS/COCTELES: mas claros y con viscosidad visible; '
    'HIELO: cristalino; '
    'PAN/PASTELERIA: dorado y crujiente."'
)

_PROMPT_ILUMINACION = (
    '[iluminacion]\n'
    'estilo = "Luz cenital dramatica o de estudio enfocada (Spotlight selectivo)"\n'
    'enfoque = "Resaltar la frescura, color y texturas del PRODUCTO contra la oscuridad absoluta '
    'de la superficie y fondo."\n'
    'acentos = "Brillos especulares precisos en las salsas, jugos, vidrios y hielo para que se '
    'vean recien preparados."\n'
    'espectro_color = "Optimizar la saturacion y viveza de los colores naturales del producto contra el fondo."'
)

_PROMPT_BRANDING = (
    '[branding.texto_opcional]\n'
    'fuente = "Serif moderna italiana (estilo Bodoni o Didot)"\n'
    'color_texto = "Blanco hueso y toques en Oro"\n'
    'titulo = "{nombre}"\n'
    'subtitulo = "{categoria}"'
)

_PROMPT_GARNITURA = (
    'toque_maestro_contextual = "Si es un plato salado, anadir micro-brotes de albahaca verde neon '
    'o flores comestibles sutiles para contraste. Si es un postre o bebida, anadir un toque sutil '
    'de polvo de oro comestible o una garnitura fresca perfecta (ej. una hoja de menta vibrante)."'
)

_PROMPT_DETALLES = (
    '[detalles_finales]\n'
    'limpieza_extrema = "Perfecta simetria y limpieza total de los bordes del producto para una '
    'grilla web cuadrada impecable."'
)


def _detect_product_type(nombre: str, categoria: str) -> str:
    """
    Detecta si el producto es bebida/coctel, postre/frío o comida caliente.
    Retorna: 'bebida' | 'postre' | 'caliente'
    """
    texto = (nombre + " " + categoria).lower()
    bebidas = [
        "pisco", "sour", "coctel", "cóctel", "cocktail", "copa", "vino", "cerveza",
        "limonada", "jugo", "agua", "bebida", "trago", "shot", "whisky", "ron",
        "vodka", "gin", "mojito", "espumante", "champagne", "aperol", "campari",
        "negroni", "spritz", "piña colada", "margarita", "daiquiri", "m&m",
    ]
    postres_frios = [
        "helado", "sorbete", "tiramisú", "tiramisú", "panna cotta", "pannacotta",
        "cheesecake", "torta fría", "mousse", "parfait", "brownie", "postre frío",
        "semifrío", "tarta fría", "gelato",
    ]
    if any(k in texto for k in bebidas):
        return "bebida"
    if any(k in texto for k in postres_frios):
        return "postre"
    return "caliente"


_VIDEO_DINAMICA = {
    "bebida": 'opcion_bebidas_cocteles = "Burbujas finas subiendo lentamente por el liquido. Una gota de condensacion resbala despacio por el exterior del vaso. El hielo brilla."',
    "postre": 'opcion_postres_frios = "Destellos de luz (specular highlights) moviendose suavemente sobre las texturas humedas o escarchadas."',
    "caliente": 'opcion_comida_caliente = "Finas y sutiles volutas de vapor (steam) elevandose lentamente. Los jugos y salsas tienen un brillo dinamico sutil."',
}

_VIDEO_PROMPT_V3 = """\
[meta]
tipo = "cinematografia_gastronomica_b-roll"
proposito = "animacion_loop_menu_web_premium"
estilo_movimiento = "slow_motion_elegante_sutil"
calidad_tecnica = "4k_cinematic_food_porn_fotorealista"
vibe = "hipnotico_apetitoso_exclusivo"
duracion = "{duration} segundos"
sujeto = '"{nombre}" — {categoria}'

[movimiento_camara]
tipo = "Ligerísimo acercamiento (slow zoom in) o paneo lateral ultra lento (subtle slider move)."
estabilidad = "Movimiento ultra suave, como cámara en trípode con cabezal fluido."
enfoque = "Profundidad de campo superficial (cinematic bokeh). El producto se mantiene perfectamente enfocado."

[dinamica_del_producto]
{dinamica}

[escena]
fondo = "{fondo_desc}"
superficie = "{superficie_desc}"
{transformacion_recipiente}

[iluminacion_y_ambiente]
dinamica = "La iluminación cenital (moody spotlight) parpadea o se mueve un milímetro, creando destellos cambiantes sobre la textura de la comida y la piedra negra del fondo."
consistencia = "MANTENER el fondo y la estética premium oscuro."

[restricciones_criticas_ia]
orden = "MANTENER LA FORMA ORIGINAL PERFECTA. NO DEFORMAR LA COMIDA NI EL VASO. Cero morphing. Movimiento 100% realista y físico."
"""


def build_video_prompt(
    nombre: str,
    categoria: str,
    descripcion: str,
    duration: int,
    color_fondo: str = "negro_absoluto",
    color_recipiente: Optional[str] = None,
) -> str:
    """
    Construye el prompt cinematográfico de video B-roll gastronómico.
    Detecta automáticamente el tipo de producto para insertar la dinámica correcta.
    """
    fondo_key = color_fondo if color_fondo in COLORES_FONDO else "negro_absoluto"
    fondo_desc, superficie_desc = COLORES_FONDO[fondo_key]

    tipo = _detect_product_type(nombre or "", categoria or "")
    dinamica = _VIDEO_DINAMICA[tipo]

    recipiente_desc = ""
    if color_recipiente and color_recipiente in COLORES_RECIPIENTE:
        mat = COLORES_RECIPIENTE[color_recipiente]
        recipiente_desc = f'transformacion_recipiente = "TRANSFORMAR EL RECIPIENTE EN {mat}. El contenido debe parecer flotar sobre la nueva superficie."'
    else:
        recipiente_desc = 'recipiente = "MANTENER EL PLATO, VASO O RECIPIENTE EXACTAMENTE COMO ESTÁ EN LA IMAGEN DE REFERENCIA."'

    return _VIDEO_PROMPT_V3.format(
        nombre=nombre or "Producto",
        categoria=categoria or "menú",
        duration=duration,
        fondo_desc=fondo_desc,
        superficie_desc=superficie_desc,
        transformacion_recipiente=recipiente_desc,
        dinamica=dinamica,
    ).strip()


def build_image_prompt(
    nombre: str,
    descripcion: str,
    categoria: str,
    precio: Optional[float],
    color_fondo: str = "negro_absoluto",
    color_recipiente: Optional[str] = None,
    mejorar_texturas: bool = True,
    agregar_garnitura: bool = True,
    agregar_branding: bool = False,
) -> str:
    """Construye el prompt de imagen dinámicamente según los parámetros de estilo."""
    fondo_key = color_fondo if color_fondo in COLORES_FONDO else "negro_absoluto"
    fondo_desc, superficie_desc = COLORES_FONDO[fondo_key]

    escena = (
        '[escena]\n'
        f'fondo = "{fondo_desc}"\n'
        f'superficie = "{superficie_desc}"\n'
        'composicion = "Hero shot cenital perfectly square and symmetrical. '
        'El articulo del menu es el unico protagonista, centrado."'
    )

    parts = [_PROMPT_META, escena, _PROMPT_SUJETO]

    if color_recipiente and color_recipiente in COLORES_RECIPIENTE:
        mat = COLORES_RECIPIENTE[color_recipiente]
        parts.append(
            f'transformacion_recipiente = "TRANSFORMAR EL RECIPIENTE EN {mat}. '
            f'El contenido debe parecer flotar sobre la nueva superficie."'
        )
    else:
        # Original: instrucción EXPLÍCITA de no tocar el recipiente
        parts.append(
            'recipiente = "MANTENER EL PLATO, VASO O RECIPIENTE EXACTAMENTE COMO ESTÁ EN LA IMAGEN DE REFERENCIA. '
            'NO lo cambies, NO lo transformes, NO cambies su material, color ni forma. '
            'Solo mejora el fondo, la iluminación y la presentación general."'
        )

    if mejorar_texturas:
        parts.append(_PROMPT_TEXTURAS)

    parts.append(_PROMPT_ILUMINACION)

    if agregar_branding:
        parts.append(_PROMPT_BRANDING.format(nombre=nombre or "Producto", categoria=categoria or "Menú"))

    detalles = _PROMPT_DETALLES
    if agregar_garnitura:
        detalles = detalles + "\n" + _PROMPT_GARNITURA
    parts.append(detalles)

    return "\n\n".join(parts).strip()


# ── Aurora Client ─────────────────────────────────────────────────────────────

class AuroraClient:
    """
    Cliente para la API de xAI Aurora (imagen y video).

    image-to-image → POST /v1/images/edits
        image field: { url, type } para URL pública ó data URI para base64

    text-to-image  → POST /v1/images/generations
        solo prompt, sin imagen

    video          → POST /v1/video/generations
    descripción    → POST /v1/chat/completions
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or XAI_API_KEY
        if not self.api_key:
            raise RuntimeError("XAI_API_KEY no configurada")

    @property
    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    # ── Imagen ─────────────────────────────────────────────────────────────────

    async def generate_image(
        self,
        prompt: str,
        model: str = IMAGE_MODEL_PRO,
        ref_url: Optional[str] = None,
        ref_b64: Optional[str] = None,
    ) -> tuple[bytes, str]:
        """
        Genera imagen con Aurora.

        Con ref_url o ref_b64  → image-to-image (/v1/images/edits)
        Sin ninguno            → text-to-image  (/v1/images/generations)

        Returns:
            (image_bytes, revised_prompt)
        """
        if ref_url or ref_b64:
            return await self._image_edit(prompt, model, ref_url=ref_url, ref_b64=ref_b64)
        else:
            return await self._image_generate(prompt, model)

    async def generate_image_with_fallback(
        self,
        prompt: str,
        model: str,
        ref_url: Optional[str],
    ) -> tuple[bytes, str]:
        """
        Intenta image-to-image con URL pública.
        Si falla (500/502 → CDN no accesible desde xAI), descarga como base64 y reintenta.
        """
        try:
            return await self.generate_image(prompt, model, ref_url=ref_url)
        except HTTPException as e:
            if ref_url and e.status_code in (500, 502):
                logger.warning(f"[aurora] URL pública falló ({e.status_code}) — descargando base64...")
                ref_b64 = await self.fetch_image_as_b64(ref_url)
                if ref_b64:
                    logger.info(f"[aurora] Descargada OK {len(ref_b64)//1000}KB — reintentando con base64")
                    return await self.generate_image(prompt, model, ref_b64=ref_b64)
                logger.error("[aurora] Descarga base64 falló — abortando")
            raise

    async def _image_edit(
        self,
        prompt: str,
        model: str,
        ref_url: Optional[str] = None,
        ref_b64: Optional[str] = None,
    ) -> tuple[bytes, str]:
        """POST /v1/images/edits — image-to-image."""
        final_prompt = (
            "[MODO IMAGE-TO-IMAGE]\n"
            "USA LA IMAGEN ADJUNTA COMO BASE EXACTA. "
            "El producto que ves en la imagen es el ÚNICO protagonista. "
            "NO cambies qué comida/bebida es, NO inventes un plato diferente. "
            "Tu trabajo es TRANSFORMAR la presentación visual aplicando el siguiente estilo:\n\n"
            f"{prompt}"
        )

        if ref_url:
            image_field: dict = {"url": ref_url, "type": "image_url"}
            img_log = f"URL: {ref_url}"
        else:
            # xAI espera SIEMPRE un objeto {url, type}, nunca string plano
            image_field = {"url": ref_b64, "type": "image_url"}
            img_log = f"base64 {len(ref_b64 or '')//1000}KB"

        body = {
            "model":           model,
            "prompt":          final_prompt,
            "image":           image_field,
            "n":               1,
            "response_format": "b64_json",
        }

        logger.info(
            f"[aurora] IMAGE-TO-IMAGE\n"
            f"  endpoint : {ENDPOINT_IMG_EDIT}\n"
            f"  model    : {model}\n"
            f"  imagen   : {img_log}\n"
            f"  prompt   : {len(final_prompt)} chars"
        )

        return await self._post_image(ENDPOINT_IMG_EDIT, body)

    async def _image_generate(self, prompt: str, model: str) -> tuple[bytes, str]:
        """POST /v1/images/generations — text-to-image."""
        body = {
            "model":           model,
            "prompt":          prompt,
            "n":               1,
            "response_format": "b64_json",
        }
        logger.warning(
            f"[aurora] TEXT-TO-IMAGE (sin imagen de referencia)\n"
            f"  endpoint : {ENDPOINT_IMG_GEN}\n"
            f"  ⚠️  Resultado puede no coincidir con el producto real"
        )
        return await self._post_image(ENDPOINT_IMG_GEN, body)

    async def _post_image(self, endpoint: str, body: dict) -> tuple[bytes, str]:
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(endpoint, headers=self._headers, json=body)
                if not r.is_success:
                    logger.error(f"[aurora] HTTP {r.status_code}: {r.text[:800]}")
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPStatusError as e:
            err = e.response.text[:500]
            raise HTTPException(status_code=502, detail=f"Aurora error {e.response.status_code}: {err}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

        items = data.get("data", [])
        if not items:
            raise HTTPException(status_code=502, detail="Aurora no devolvió imagen")
        b64_str = items[0].get("b64_json")
        if not b64_str:
            raise HTTPException(status_code=502, detail="Aurora no devolvió b64_json")

        return base64.b64decode(b64_str), items[0].get("revised_prompt", "")

    # ── Video ──────────────────────────────────────────────────────────────────

    async def generate_video(self, prompt: str, ref_b64: Optional[str] = None, ref_url: Optional[str] = None) -> str:
        """
        POST /v1/videos/generations  →  returns request_id
        GET  /v1/videos/{request_id} →  polls until status == 'done'

        The API is asynchronous: it never returns b64_json — it returns a URL.
        We download the video bytes from that URL and return them.

        image body format (per docs):
            { "image": { "url": "<public_url_or_data_uri>" } }
        """
        # Build image field
        if ref_url:
            image_field = {"url": ref_url}
            img_log = f"URL: {ref_url}"
        elif ref_b64:
            image_field = {"url": ref_b64}   # data URI (data:image/jpeg;base64,...)
            img_log = f"base64 {len(ref_b64)//1000}KB"
        else:
            raise HTTPException(status_code=400, detail="Se requiere imagen de referencia para generar video")

        body = {
            "model":        VIDEO_MODEL,
            "prompt":       prompt,
            "duration":     5,
            "aspect_ratio": "1:1",
            "resolution":   "480p",
            "image":        image_field,
        }

        logger.info(
            f"[aurora] VIDEO POST\n"
            f"  endpoint : {ENDPOINT_VIDEO}\n"
            f"  model    : {VIDEO_MODEL}\n"
            f"  imagen   : {img_log}\n"
            f"  prompt   : {len(prompt)} chars"
        )

        # ── Step 1: submit generation request ────────────────────────────────
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(ENDPOINT_VIDEO, headers=self._headers, json=body)
                if not r.is_success:
                    logger.error(f"[aurora] VIDEO submit HTTP {r.status_code}: {r.text[:800]}")
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPStatusError as e:
            err = e.response.text[:500]
            raise HTTPException(status_code=502, detail=f"Aurora video error {e.response.status_code}: {err}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

        request_id = data.get("request_id")
        if not request_id:
            raise HTTPException(status_code=502, detail=f"Aurora video no devolvió request_id: {data}")

        logger.info(f"[aurora] VIDEO request_id={request_id} — iniciando polling...")

        # ── Step 2: poll until done ───────────────────────────────────────────
        poll_url     = f"{ENDPOINT_VIDEO_GET}/{request_id}"
        # No timeout de httpx para el cliente de polling, só el límite de reintentos
        poll_headers = {"Authorization": f"Bearer {self.api_key}"}
        max_polls    = 60   # 60 × 5s = 5 min máximo
        poll_interval = 5

        import asyncio
        for attempt in range(max_polls):
            await asyncio.sleep(poll_interval)
            try:
                async with httpx.AsyncClient(timeout=20) as pc:
                    pr = await pc.get(poll_url, headers=poll_headers)
                    pr.raise_for_status()
                    pd = pr.json()
            except Exception as e:
                logger.warning(f"[aurora] VIDEO poll error (intento {attempt+1}): {e}")
                continue

            status = pd.get("status", "")
            logger.info(f"[aurora] VIDEO poll {attempt+1}/{max_polls}: status={status}")

            if status == "done":
                video_url = (pd.get("video") or {}).get("url")
                if not video_url:
                    raise HTTPException(status_code=502, detail=f"Aurora video done pero sin URL: {pd}")
                logger.info(f"[aurora] VIDEO done → {video_url}")
                # Download the video bytes
                async with httpx.AsyncClient(timeout=120) as dc:
                    vr = await dc.get(video_url)
                    vr.raise_for_status()
                    return vr.content

            elif status in ("expired", "failed", "error"):
                raise HTTPException(status_code=502, detail=f"Aurora video {status}: {pd}")
            # else: 'pending' | 'processing' — keep polling

        raise HTTPException(status_code=504, detail="Aurora video: timeout de polling (5 min superados)")

    # ── Descripción ────────────────────────────────────────────────────────────

    async def generate_description(
        self,
        nombre: str,
        descripcion: str = "",
        categoria: str = "",
        precio: Optional[float] = None,
        codigo: Optional[str] = None,
    ) -> str:
        """POST /v1/chat/completions — descripción gastronómica premium."""
        system = (
            "Eres un copywriter gastronómico de lujo, especialista en restaurantes italianos premium. "
            "Escribes descripciones concisas, evocadoras y apetitosas en español. "
            "Máximo 2 oraciones. Tono: sofisticado, sensorial, directo. Sin emojis."
        )

        ctx = [f"Nombre: {nombre}"]
        if categoria:
            ctx.append(f"Categoría: {categoria}")
        if precio:
            ctx.append(f"Precio: ${int(precio):,}".replace(",", "."))
        if codigo:
            ctx.append(f"Código: {codigo}")
        ctx.append(f"Descripción actual: {descripcion or '(ninguna)'}")

        user_msg = (
            f"Escríbeme una descripción de menú premium para:\n"
            f"{chr(10).join(ctx)}\n\n"
            "Devuelve SOLO la descripción mejorada, sin comillas ni explicaciones."
        )

        body = {
            "model": TEXT_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user_msg},
            ],
            "temperature": 0.75,
        }

        logger.info(f"[aurora] DESC: model={TEXT_MODEL} producto='{nombre}'")
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                r = await client.post(ENDPOINT_CHAT, headers=self._headers, json=body)
                r.raise_for_status()
                data = r.json()
            result = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip()
            logger.info(f"[aurora] DESC OK: '{result[:80]}'")
            return result
        except Exception as e:
            logger.error(f"[aurora] DESC error: {e}")
            return descripcion or ""

    # ── Utils ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def fetch_image_as_b64(url: str) -> Optional[str]:
        """
        Descarga imagen desde URL y retorna data URI base64 en formato JPEG.
        Convierte WebP/otros formatos a JPEG — xAI solo garantiza soporte JPG/PNG.
        """
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                r = await client.get(url)
                r.raise_for_status()
                content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].lower()

                raw = r.content

                # Si es WebP o formato no soportado → convertir a JPEG con PIL
                is_webp = "webp" in content_type or url.lower().endswith(".webp")
                if is_webp and _PIL_OK:
                    img = _PILImage.open(io.BytesIO(raw)).convert("RGB")
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=92)
                    raw = buf.getvalue()
                    content_type = "image/jpeg"
                    logger.info(f"[aurora] WebP→JPEG OK ({len(raw)//1000}KB)")
                elif is_webp:
                    logger.warning("[aurora] PIL no disponible — enviando WebP sin convertir")

                b64 = base64.b64encode(raw).decode("utf-8")
                return f"data:{content_type};base64,{b64}"
        except Exception as e:
            logger.warning(f"[aurora] No se pudo descargar {url}: {e}")
            return None


# ── MongoDB helpers ───────────────────────────────────────────────────────────

def get_product_query(product_id: str) -> dict:
    q: dict = {"$or": [{"id": product_id}]}
    try:
        q["$or"].append({"_id": ObjectId(product_id)})
    except Exception:
        pass
    return q


def add_image_to_gallery(product_id: str, image_url: str) -> int:
    """
    Agrega imagen AI generada a media_images[] del producto como CANDIDATA (máx 4).
    NO actualiza media_r2 ni media_url — eso ocurre solo cuando el usuario acepta
    explícitamente vía el endpoint organize-media.
    Retorna el nuevo count de imágenes.
    """
    # Construir query robusto (string e int) para compatibilidad
    q: dict = {"$or": [{"id": product_id}]}
    try:
        q["$or"].append({"_id": ObjectId(product_id)})
    except Exception:
        pass
    try:
        pid_int = int(product_id)
        q["$or"].append({"id": pid_int})
    except (ValueError, TypeError):
        pass

    doc = db.menus.find_one(q)
    if not doc:
        return 0
    images: list = list(doc.get("media_images") or [])
    if image_url in images:
        return len(images)
    images.append(image_url)
    if len(images) > MAX_IMAGES_PER_PRODUCT:
        images = images[-MAX_IMAGES_PER_PRODUCT:]
    # Solo actualiza el array — no toca media_r2 ni media_url
    db.menus.update_one(q, {"$set": {
        "media_images": images,
        "updated_at":   datetime.now(timezone.utc),
    }})
    return len(images)


def update_product_video(product_id: str, video_url: str) -> bool:
    q = get_product_query(product_id)
    r = db.menus.update_one(q, {"$set": {
        "media_video": video_url,
        "updated_at":  datetime.now(timezone.utc),
    }})
    return r.modified_count > 0


def update_product_description(product_id: str, description: str) -> bool:
    q = get_product_query(product_id)
    r = db.menus.update_one(q, {"$set": {
        "descripcion": description,
        "updated_at":  datetime.now(timezone.utc),
    }})
    return r.modified_count > 0


def upload_image(image_bytes: bytes, nombre: str) -> str:
    safe = "".join(c if c.isalnum() or c == "-" else "_" for c in nombre.lower())[:40]
    key = f"carta/ai_generated/img/_{safe}_{uuid.uuid4().hex[:8]}.png"
    return upload_to_r2(io.BytesIO(image_bytes), key=key, content_type="image/png", public=True)


def upload_video(video_bytes: bytes, nombre: str) -> str:
    safe = "".join(c if c.isalnum() or c == "-" else "_" for c in nombre.lower())[:40]
    key = f"carta/ai_generated/video/_{safe}_{uuid.uuid4().hex[:8]}.mp4"
    return upload_to_r2(io.BytesIO(video_bytes), key=key, content_type="video/mp4", public=True)
