"""
AI Nutrition Client — Piccola Italia
=====================================
Uses Grok (xAI) chat completions to generate a nutrition facts table.
Follows the EXACT same pattern as utils.bot.common.filters.grok_filters.
"""

from __future__ import annotations

import os
import json
import re
import logging
from typing import Optional

import httpx
from fastapi import HTTPException

logger = logging.getLogger("ai_nutrition")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)
logger.propagate = False

# ── Config — same env vars as the bot ─────────────────────────────────────────

XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
XAI_MODEL   = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY = os.getenv("XAI_API_KEY")


# ── JSON parser — copied from filters._json_first_object ─────────────────────

def _json_first_object(text: str) -> Optional[dict]:
    try:
        return json.loads(text)
    except Exception:
        pass
    if text.startswith("```"):
        try:
            t = re.sub(r"^```(?:json)?\s*\n", "", text, flags=re.I)
            t = re.sub(r"\n```\s*$", "", t)
            return json.loads(t)
        except Exception:
            pass
    first = text.find("{")
    if first != -1:
        depth, end = 0, None
        for i, ch in enumerate(text[first:], start=first):
            if ch == "{": depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end:
            try:
                return json.loads(text[first:end])
            except Exception:
                return None
    return None


# ── Pasta context ─────────────────────────────────────────────────────────────

PASTA_CONTEXT = (
    "PASTAS: todas las pastas son frescas artesanales. "
    "Masa: 9 huevos/kg. Composición: 80% sémola, 10% harina, 10% huevos."
)

# ── System prompt — corto y directo como los del bot ──────────────────────────

SYSTEM_PROMPT = (
    "Eres un nutricionista. Devuelve SOLO JSON con este esquema:\n"
    '{"porcion_g":N,"calorias":N,"grasas_totales_g":N,"grasas_saturadas_g":N,'
    '"grasas_trans_g":N,"colesterol_mg":N,"sodio_mg":N,"carbohidratos_g":N,'
    '"fibra_g":N,"azucares_g":N,"proteinas_g":N,'
    '"vitamina_d_mcg":N,"calcio_mg":N,"hierro_mg":N,"potasio_mg":N,'
    '"notas":"alérgenos relevantes"}\n'
    "Reglas: usa USDA/FAO, redondea a 1 decimal, porción = 1 plato completo. "
    "SOLO JSON, nada más."
)


class NutritionClient:

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or XAI_API_KEY
        if not self.api_key:
            raise RuntimeError("XAI_API_KEY no configurada")

    async def generate_nutrition(
        self,
        nombre: str,
        categoria: str,
        receta: list[dict],
        precio: Optional[float] = None,
    ) -> dict:
        if not receta:
            raise HTTPException(status_code=400, detail="No hay receta")

        is_pasta = self._detect_pasta(nombre, categoria, receta)

        # Build compact ingredient list
        ing_lines = []
        for ing in receta:
            ing_lines.append(
                f"- {ing.get('ingrediente','?')}: "
                f"{ing.get('cantidad',0)} {ing.get('unidad','un')}"
            )

        user_msg = f"Producto: {nombre}\nReceta:\n" + "\n".join(ing_lines)
        if is_pasta:
            user_msg += f"\n{PASTA_CONTEXT}"
        user_msg += "\nCalcula nutrición por porción. SOLO JSON."

        # EXACT same pattern as grok_filters in filters.py
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": XAI_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }

        logger.info(
            f"[nutrition] Calling xAI: model={XAI_MODEL} "
            f"product='{nombre}' ({len(receta)} ings, pasta={is_pasta})\n"
            f"  user_msg ({len(user_msg)} chars):\n{user_msg}"
        )

        try:
            # 45s — same timeout as chat.py _bot_reply (line 265)
            async with httpx.AsyncClient(timeout=45) as client:
                r = await client.post(XAI_API_URL, headers=headers, json=body)
                r.raise_for_status()
                data = r.json()
                content = (
                    (data.get("choices", [{}])[0].get("message", {}) or {})
                    .get("content", "")
                )
                logger.info(f"[nutrition] Raw AI response ({len(content)} chars):\n{content[:2000]}")
        except httpx.ReadTimeout:
            logger.error(f"[nutrition] ReadTimeout 45s for '{nombre}'")
            raise HTTPException(status_code=504, detail="AI tardó demasiado (timeout 45s)")
        except httpx.HTTPStatusError as e:
            logger.error(f"[nutrition] HTTP {e.response.status_code}: {e.response.text[:300]}")
            raise HTTPException(status_code=502, detail=f"AI error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"[nutrition] {type(e).__name__}: {repr(e)}")
            raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {str(e)}")

        # Parse JSON — same as filters._json_first_object
        nutrition = _json_first_object(content or "")
        if not isinstance(nutrition, dict):
            logger.error(f"[nutrition] No JSON in response: {(content or '')[:500]}")
            raise HTTPException(status_code=502, detail="AI no devolvió JSON válido")

        logger.info(
            f"[nutrition] ✅ OK '{nombre}': "
            f"{nutrition.get('calorias','?')} kcal, "
            f"{nutrition.get('proteinas_g','?')}g prot"
        )
        return nutrition

    @staticmethod
    def _detect_pasta(nombre: str, categoria: str, receta: list[dict]) -> bool:
        texto = (nombre + " " + (categoria or "")).lower()
        pasta_kw = [
            "pasta", "ravioli", "raviolo", "tagliatelle", "spaghetti",
            "fettuccine", "lasagna", "lasaña", "canelón", "caneloni",
            "ñoqui", "gnocchi", "pappardelle", "linguine", "rigatoni",
            "penne", "fusilli", "tortellini", "agnolotti", "cappelletti",
            "carbonara", "bolognesa", "boloñesa", "alfredo",
            "amatriciana", "arrabbiata", "raviol",
        ]
        if any(k in texto for k in pasta_kw):
            return True
        for ing in receta:
            n = (ing.get("ingrediente") or "").lower()
            if any(k in n for k in ["pasta", "masa", "semolina", "sémola", "ravioli"]):
                return True
        return False
