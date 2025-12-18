import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from utils.web3mongo import db

logger = logging.getLogger(__name__)


def run_worker():
    tz = ZoneInfo("America/Santiago")
    now = datetime.now(tz)
    generated_at = now.isoformat()

    # Leemos todos los códigos presentes en menus (la cache solo para lo que se sirve al front)
    menus = list(db.menus.find({}, {"codigo": 1}))
    codes = sorted({str(m.get("codigo") or "").strip() for m in menus if m.get("codigo")})

    # Colección de cache: 1 doc por producto_codigo
    col = db.menus_recipes_cache

    try:
        col.create_index("producto_codigo", unique=True)
    except Exception:
        pass

    processed = 0
    for code in codes:
        if not code:
            continue

        # Encontrar mesano más reciente
        latest = db.recetas_productos.find_one(
            {"producto_codigo": code},
            {"mesano": 1},
            sort=[("mesano", -1)],
        )
        if not latest or not latest.get("mesano"):
            continue

        use_mesano = str(latest.get("mesano"))

        cur = db.recetas_productos.find(
            {"producto_codigo": code, "mesano": use_mesano},
            {
                "ingrediente_nombre": 1,
                "ingrediente_codigo": 1,
                "cantidad_ingrediente": 1,
                "u_medida_compra": 1,
                "u_medida_base": 1,
                "porcentaje_linea": 1,
                "linea": 1,
            },
        ).sort("linea", 1)

        rows = []
        for rr in cur:
            ing = str(
                rr.get("ingrediente_nombre")
                or rr.get("ingrediente_codigo")
                or ""
            ).strip()
            qty = rr.get("cantidad_ingrediente")
            unit = str(rr.get("u_medida_compra") or rr.get("u_medida_base") or "").strip()
            pct = rr.get("porcentaje_linea")

            qty_text = (
                f"{qty:.3f}"
                if isinstance(qty, (int, float))
                else str(qty).strip()
                if qty is not None
                else ""
            )

            row = {
                "ingredient": ing,
                "qty_text": qty_text,
                "unit": unit,
            }
            if isinstance(pct, (int, float)):
                row["pct"] = round(float(pct), 1)
            rows.append(row)

        if not rows:
            continue

        doc = {
            "producto_codigo": code,
            "mesano": use_mesano,
            "recipe": {
                "mesano": use_mesano,
                "rows": rows,
            },
            "generated_at": generated_at,
        }

        # upsert por producto_codigo
        col.update_one(
            {"producto_codigo": code},
            {"$set": doc},
            upsert=True,
        )
        processed += 1

    # Marcador de última corrida
    db.menus_recipes_cache_meta.update_one(
        {"_id": "last_run"},
        {"$set": {"generated_at": generated_at, "processed": processed}},
        upsert=True,
    )

    logger.info(f"[menus_recipes_cache] generated_at={generated_at} processed={processed}")
    return {"status": "completed", "generated_at": generated_at, "processed": processed}
