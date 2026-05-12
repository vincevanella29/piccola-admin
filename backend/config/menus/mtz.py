"""
MTZ Data Integration — profitability and recipe data.
"""

import logging

from bson import ObjectId
from utils.web3mongo import db

logger = logging.getLogger(__name__)


def get_mtz_data(product_id: str) -> dict:
    """Returns profitability, unit economics, trend and recipe data for a product.

    Enriched vs legacy:
    - Up to 6 months for trend charts
    - Adds prioridad/estado from the product document
    - Adds cupro (cost-per-unit) and margin_pct per period
    - trend block: deltas (%) vs previous period
    - Recipe sorted by ingredient cost desc, with pct_costo per ingredient
    """
    query = [{"_id": product_id}, {"id": product_id}]
    if ObjectId.is_valid(product_id):
        query.append({"_id": ObjectId(product_id)})

    p = db.menus.find_one({"$or": query})
    if not p:
        return None

    codigo         = p.get("codigo")
    product_precio = p.get("precio") or p.get("precio_especial") or 0.0
    product_prio   = p.get("prioridad") or 0
    product_estado = p.get("estado", True)

    if not codigo:
        return {
            "rentabilidad": [], "receta": [], "latest_puven": None,
            "prioridad": product_prio, "estado": product_estado, "trend": None,
        }

    # 1. Rentabilidad — aggregate across all locations
    rentabilidad_cursor = db.rentabilidad_producto_locales.find({"codig": codigo}).sort("mesano", -1)
    rentabilidad_list = list(rentabilidad_cursor)

    unique_mesanos: list = []
    agg_by_mesano: dict = {}

    for r in rentabilidad_list:
        m = r.get("mesano")
        if not m:
            continue
        if m not in agg_by_mesano:
            agg_by_mesano[m] = {
                "mesano": m, "cantidad": 0,
                "total_costo": 0.0, "total_venta": 0.0, "total_margen": 0.0,
                "puven": r.get("puven") or 0.0, "locales": [],
            }
            unique_mesanos.append(m)

        agg_by_mesano[m]["cantidad"]     += r.get("cantidad", 0)
        agg_by_mesano[m]["total_costo"]  += r.get("total_costo", 0.0)
        agg_by_mesano[m]["total_venta"]  += r.get("total_venta", 0.0)
        agg_by_mesano[m]["total_margen"] += r.get("total_margen", 0.0)
        agg_by_mesano[m]["locales"].append({
            "centroproduccion": r.get("centroproduccion", ""),
            "cantidad": r.get("cantidad", 0),
            "puven": r.get("puven", 0.0),
        })

    # Newest first, up to 6 months
    sorted_mesanos  = sorted(unique_mesanos, reverse=True)[:6]
    rentabilidad_raw = [agg_by_mesano[m] for m in sorted_mesanos]

    rentabilidad_final = []
    for entry in rentabilidad_raw:
        cant   = entry["cantidad"] or 0
        venta  = entry["total_venta"] or 0.0
        costo  = entry["total_costo"] or 0.0
        margen = entry["total_margen"] or 0.0
        puven  = entry["puven"] or product_precio or 0.0
        cupro      = round(costo  / cant,  2) if cant  > 0 else None
        margin_pct = round(margen / venta * 100, 1) if venta > 0 else None
        rentabilidad_final.append({**entry, "cupro": cupro, "margin_pct": margin_pct, "puven": puven})

    latest_puven = rentabilidad_final[0].get("puven") if rentabilidad_final else None

    # 2. Trend: current vs previous period deltas
    trend = None
    if len(rentabilidad_final) >= 2:
        curr = rentabilidad_final[0]
        prev = rentabilidad_final[1]

        def _dpct(c, p):
            try:
                return round((c - p) / abs(p) * 100, 1) if p and p != 0 else None
            except Exception:
                return None

        trend = {
            "curr_mesano":            curr["mesano"],
            "prev_mesano":            prev["mesano"],
            "cantidad_delta_pct":     _dpct(curr["cantidad"],     prev["cantidad"]),
            "total_venta_delta_pct":  _dpct(curr["total_venta"],  prev["total_venta"]),
            "total_margen_delta_pct": _dpct(curr["total_margen"], prev["total_margen"]),
            "margin_pct_delta": None if (curr.get("margin_pct") is None or prev.get("margin_pct") is None)
                                else round((curr.get("margin_pct") or 0) - (prev.get("margin_pct") or 0), 1),
        }

    # 3. Receta — latest mesano, sorted by cost desc
    receta_cursor = db.recetas_productos.find(
        {"$or": [{"producto_codigo": codigo}, {"producto_cod": codigo}]}
    ).sort("mesano", -1)
    receta_list = list(receta_cursor)

    receta_final = []
    if receta_list:
        latest_mesano = receta_list[0].get("mesano")
        costo_total = 0.0
        for ing in receta_list:
            if ing.get("mesano") == latest_mesano:
                c = ing.get("costo_linea", 0.0) or ing.get("costo", 0.0) or 0.0
                costo_total += c
                receta_final.append({
                    "ingrediente_codigo": ing.get("ingrediente_codigo") or ing.get("ingrediente_cod"),
                    "ingrediente":        ing.get("ingrediente_nombre") or ing.get("ingrediente", "Desconocido"),
                    "cantidad":           ing.get("cantidad_ingrediente") or ing.get("cantidad", 0.0),
                    "unidad":             ing.get("u_medida_base") or ing.get("unidad", ""),
                    "costo":              c,
                    "pct_costo":          None,
                })
        if costo_total > 0:
            for ing in receta_final:
                ing["pct_costo"] = round(ing["costo"] / costo_total * 100, 1)
        receta_final.sort(key=lambda x: x["costo"], reverse=True)

    return {
        "codigo":       codigo,
        "prioridad":    product_prio,
        "estado":       product_estado,
        "precio":       product_precio,
        "latest_puven": latest_puven,
        "rentabilidad": rentabilidad_final,
        "trend":        trend,
        "receta":       receta_final,
    }


def get_missing_products() -> dict:
    """
    Returns products that exist in MTZ (rentabilidad_producto_locales)
    but are NOT present in the Carta (db.menus).

    For each missing product, includes:
    - nombre, codigo, familia, subfamilia, precio_sugerido
    - ventas_meses: last 3 months with cantidad + total_venta + margen
    - total_vendido (last 3 months combined units)
    - total_venta (last 3 months revenue)
    - available_mesanos: sorted list of months with data (for UI filter)
    """
    carta_menus = list(db.menus.find({"codigo": {"$exists": True, "$ne": ""}}, {"codigo": 1}))
    carta_codigos = {m["codigo"] for m in carta_menus if m.get("codigo")}

    # 1. Aggregate latest meta per product (nombre, familia, puven) from most recent month
    meta_pipeline = [
        {"$sort": {"mesano": -1}},
        {"$group": {
            "_id": "$codig",
            "producto": {"$first": "$producto"},
            "puven": {"$first": "$puven"},
            "familia": {"$first": "$familia"},
            "subfamilia": {"$first": "$subfamilia"},
            "latest_mesano": {"$first": "$mesano"},
        }}
    ]
    meta_list = list(db.rentabilidad_producto_locales.aggregate(meta_pipeline))

    # Build set of missing codigos first
    missing_codigos = {
        mp["_id"] for mp in meta_list
        if mp.get("_id") and mp["_id"] not in carta_codigos
    }

    if not missing_codigos:
        return {"missing_products": [], "available_mesanos": []}

    # 2. Get all monthly data for missing products — aggregate by (codig, mesano)
    sales_pipeline = [
        {"$match": {"codig": {"$in": list(missing_codigos)}}},
        {"$sort": {"mesano": -1}},
        {"$group": {
            "_id": {"codig": "$codig", "mesano": "$mesano"},
            "cantidad": {"$sum": "$cantidad"},
            "total_venta": {"$sum": "$total_venta"},
            "total_costo": {"$sum": "$total_costo"},
            "total_margen": {"$sum": "$total_margen"},
            "puven": {"$first": "$puven"},
        }},
        {"$sort": {"_id.mesano": -1}},
    ]
    sales_data = list(db.rentabilidad_producto_locales.aggregate(sales_pipeline))

    # Collect all mesanos that appear in data (for UI filter selector)
    all_mesanos_set = set()
    # Group sales by codig
    sales_by_codig: dict = {}
    for s in sales_data:
        codig = s["_id"]["codig"]
        mesano = s["_id"]["mesano"]
        all_mesanos_set.add(mesano)
        sales_by_codig.setdefault(codig, []).append({
            "mesano": mesano,
            "cantidad": s.get("cantidad", 0),
            "total_venta": s.get("total_venta", 0.0),
            "total_costo": s.get("total_costo", 0.0),
            "total_margen": s.get("total_margen", 0.0),
            "puven": s.get("puven", 0.0),
        })

    available_mesanos = sorted(all_mesanos_set, reverse=True)  # newest first

    # 3. Build result list
    meta_by_codig = {mp["_id"]: mp for mp in meta_list if mp.get("_id") in missing_codigos}

    missing = []
    for codig, mp in meta_by_codig.items():
        monthly_sales = sorted(sales_by_codig.get(codig, []), key=lambda x: x["mesano"], reverse=True)
        last_3 = monthly_sales[:3]

        total_vendido = sum(m["cantidad"] for m in last_3)
        total_venta = sum(m["total_venta"] for m in last_3)
        total_margen = sum(m["total_margen"] for m in last_3)

        missing.append({
            "codigo": codig,
            "nombre": (mp.get("producto") or "").strip(),
            "precio_sugerido": mp.get("puven") or 0.0,
            "familia": (mp.get("familia") or "").strip(),
            "subfamilia": (mp.get("subfamilia") or "").strip(),
            "latest_mesano": mp.get("latest_mesano"),
            "ventas_meses": last_3,       # last 3 months detail
            "total_vendido": total_vendido,   # units in last 3 months
            "total_venta": total_venta,       # revenue
            "total_margen": total_margen,     # margin
        })

    missing.sort(key=lambda x: x["total_vendido"], reverse=True)  # hottest first
    return {
        "missing_products": missing,
        "available_mesanos": available_mesanos,
    }
