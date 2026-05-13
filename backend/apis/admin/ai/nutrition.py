"""
AI Nutrition API — Piccola Italia Admin
========================================

Endpoints:
  POST /carta/ai-nutrition/generate  → Generate nutrition facts via AI (preview)
  POST /carta/ai-nutrition/accept    → Accept & save nutrition into the product document
  GET  /carta/ai-nutrition/{id}      → Get saved nutrition from the product

Everything saves directly to the product document in `menus` collection.
No separate tables.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from config.menus.helpers import get_id_query

from config.ai_nutrition.nutrition_client import NutritionClient
from config.menus import mtz as mtz_svc
from utils.web3mongo import db

router = APIRouter()

logger = logging.getLogger("ai_nutrition")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)
logger.propagate = False


# ── Pydantic models ───────────────────────────────────────────────────────────

class RecipeIngredient(BaseModel):
    ingrediente: str
    cantidad: float
    unidad: str
    costo: Optional[float] = 0


class GenerateNutritionRequest(BaseModel):
    product_id: str
    nombre: str
    categoria: Optional[str] = ""
    precio: Optional[float] = None
    codigo: Optional[str] = ""
    receta: Optional[List[RecipeIngredient]] = None  # If empty, fetched from MTZ


class NutritionData(BaseModel):
    porcion_g: Optional[float] = None
    calorias: Optional[float] = None
    grasas_totales_g: Optional[float] = None
    grasas_saturadas_g: Optional[float] = None
    grasas_trans_g: Optional[float] = None
    colesterol_mg: Optional[float] = None
    sodio_mg: Optional[float] = None
    carbohidratos_g: Optional[float] = None
    fibra_g: Optional[float] = None
    azucares_g: Optional[float] = None
    proteinas_g: Optional[float] = None
    vitamina_d_mcg: Optional[float] = None
    calcio_mg: Optional[float] = None
    hierro_mg: Optional[float] = None
    potasio_mg: Optional[float] = None
    notas: Optional[str] = None


class GenerateNutritionResponse(BaseModel):
    nutrition: NutritionData
    ingredient_count: int
    is_pasta: bool


class AcceptNutritionRequest(BaseModel):
    product_id: str
    nutrition: NutritionData


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/carta/ai-nutrition/generate", response_model=GenerateNutritionResponse)
async def generate_product_nutrition(
    req: GenerateNutritionRequest,
    user: dict = Depends(verify_session),
):
    """
    Generate nutrition facts preview using AI.
    Does NOT save anything — the user must accept first.
    """
    require_admin_level(user, "member")

    # Get recipe — either from request or from MTZ
    receta_dicts = []
    if req.receta and len(req.receta) > 0:
        receta_dicts = [r.dict() for r in req.receta]
    else:
        codigo = req.codigo
        if not codigo:
            q = get_id_query(req.product_id)
            doc = db.menus.find_one(q, {"codigo": 1})
            codigo = doc.get("codigo", "") if doc else ""

        if codigo:
            try:
                mtz_data = mtz_svc.get_mtz_data(codigo)
                receta_dicts = mtz_data.get("receta", [])
            except Exception as e:
                logger.warning(f"[nutrition] Failed to fetch MTZ recipe for {codigo}: {e}")

    if not receta_dicts:
        raise HTTPException(
            status_code=400,
            detail="No hay receta disponible. Verifica que el producto tenga un código con receta asociada.",
        )

    logger.info(
        f"[nutrition] Generating for '{req.nombre}' "
        f"(product_id={req.product_id}, {len(receta_dicts)} ingredients)"
    )

    client = NutritionClient()
    nutrition_raw = await client.generate_nutrition(
        nombre=req.nombre,
        categoria=req.categoria or "",
        receta=receta_dicts,
        precio=req.precio,
    )

    is_pasta = client._detect_pasta(req.nombre, req.categoria or "", receta_dicts)

    logger.info(f"[nutrition] ✅ Preview ready for '{req.nombre}'")

    return GenerateNutritionResponse(
        nutrition=NutritionData(**nutrition_raw),
        ingredient_count=len(receta_dicts),
        is_pasta=is_pasta,
    )


@router.post("/carta/ai-nutrition/accept")
async def accept_product_nutrition(
    req: AcceptNutritionRequest,
    user: dict = Depends(verify_session),
):
    """
    Accept AI-generated nutrition and save it directly to the product in menus collection.
    """
    require_admin_level(user, "member")

    q = get_id_query(req.product_id)
    nutrition_data = req.nutrition.dict()

    result = db.menus.update_one(q, {"$set": {
        "nutrition": nutrition_data,
        "nutrition_generated_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }})

    logger.info(
        f"[nutrition] ✅ Saved to product {req.product_id} "
        f"(modified={result.modified_count})"
    )

    return {"success": True, "modified": result.modified_count > 0}


@router.get("/carta/ai-nutrition/{product_id}")
async def get_product_nutrition(
    product_id: str,
    user: dict = Depends(verify_session),
):
    """Get saved nutrition data from the product document."""
    q = get_id_query(product_id)
    doc = db.menus.find_one(q, {
        "nutrition": 1,
        "nutrition_generated_at": 1,
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    nutrition = doc.get("nutrition")
    return {
        "product_id": product_id,
        "nutrition": nutrition,
        "generated_at": (
            doc.get("nutrition_generated_at", "").isoformat()
            if hasattr(doc.get("nutrition_generated_at", ""), "isoformat")
            else None
        ),
        "has_nutrition": nutrition is not None,
    }
