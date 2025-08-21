"""
Utility to build and maintain reference tables derived from gastos_intranet.

Creates/updates the following collections:
- gastos_refs_cuentas    (by `cuenta`)
- gastos_refs_sucursales (by `id_sucursal`)
- gastos_refs_bancos     (by `id_banco`)

Each builder scans `db.gastos_intranet`, aggregates unique keys, and upserts the
latest known descriptive fields (e.g., nombres, resúmenes) plus simple stats.

You can import and run:
  from utils.analytics.gastos_refs import build_all_refs
  await build_all_refs()

Or call individual builders:
  await build_cuentas_table()
  await build_sucursales_table()
  await build_bancos_table()

Note: This module uses synchronous pymongo via `utils.web3mongo.db`.
Run in a thread or from a background task if needed.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict

from utils.web3mongo import db

logger = logging.getLogger(__name__)


def _safe_to_date(expr: Any) -> Any:
    """Build a MongoDB expression that converts a field to Date if needed."""
    return {
        "$cond": [
            {"$eq": [{"$type": expr}, "date"]},
            expr,
            {"$toDate": expr},
        ]
    }


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def build_cuentas_table() -> Dict[str, int]:
    """
    Build or refresh `gastos_refs_cuentas` from `gastos_intranet`.

    Groups by `cuenta` and keeps the most recent descriptive fields found
    across documents. Also tracks first_seen/last_seen and counts.
    """
    logger.info("Building cuentas reference table from gastos_intranet…")

    # Pick the most recent doc per cuenta using fecha_edicion or fecha_pago as tie-breaker
    pipeline = [
        {"$addFields": {
            "_fecha_edicion": _safe_to_date("$fecha_edicion"),
            "_fecha_pago": _safe_to_date("$fecha_pago"),
        }},
        {"$addFields": {
            # prefer fecha_edicion, else fecha_pago
            "_ts": {"$ifNull": ["$_fecha_edicion", "$_fecha_pago"]}
        }},
        {"$sort": {"_ts": -1}},
        {"$group": {
            "_id": "$cuenta",
            "latest": {"$first": "$$ROOT"},
            "count": {"$sum": 1},
            "first_ts": {"$last": "$_ts"},
            "last_ts": {"$first": "$_ts"},
            "resumenes": {"$addToSet": "$resumen"},
            "resumen2s": {"$addToSet": "$resumen2"},
            "sucursales": {"$addToSet": "$id_sucursal"},
            "siglas": {"$addToSet": "$sigla"},
        }},
        {"$project": {
            "_id": 0,
            "cuenta": "$_id",
            "nombre_cuenta": "$latest.nombre_cuenta",
            "id_cuenta_resultado": "$latest.id_cuenta_resultado",
            "nombre_cuenta_resultado": "$latest.nombre_cuenta_resultado",
            "cat_categoria_resultado": "$latest.cat_categoria_resultado",
            "resumen": "$latest.resumen",
            "resumen2": "$latest.resumen2",
            "es_operacional": {"$ifNull": ["$latest.es_operacional", 0]},
            "es_cuenta": {"$ifNull": ["$latest.es_cuenta", 0]},
            "count_docs": "$count",
            "first_seen": {"$dateToString": {"format": "%Y-%m-%d", "date": "$first_ts"}},
            "last_seen": {"$dateToString": {"format": "%Y-%m-%d", "date": "$last_ts"}},
            "updated_at": {"$literal": _now_iso()},
        }},
        {"$sort": {"cuenta": 1}},
    ]

    rows = list(db.gastos_intranet.aggregate(pipeline))
    col = db.gastos_refs_cuentas
    col.create_index("cuenta", unique=True)

    upserts = 0
    for r in rows:
        col.update_one({"cuenta": r["cuenta"]}, {"$set": r}, upsert=True)
        upserts += 1
    logger.info("Cuentas ref upserts: %d", upserts)
    return {"upserts": upserts}


def build_sucursales_table() -> Dict[str, int]:
    """
    Build or refresh `gastos_refs_sucursales` from `gastos_intranet`.

    Groups by `id_sucursal`. Stores the latest known `sigla` and aggregates basic stats.
    """
    logger.info("Building sucursales reference table from gastos_intranet…")

    pipeline = [
        {"$addFields": {
            "_ts": {"$ifNull": [_safe_to_date("$fecha_edicion"), _safe_to_date("$fecha_pago")]}
        }},
        {"$sort": {"_ts": -1}},
        {"$group": {
            "_id": "$id_sucursal",
            "latest": {"$first": "$$ROOT"},
            "count": {"$sum": 1},
            "first_ts": {"$last": "$_ts"},
            "last_ts": {"$first": "$_ts"},
            "siglas": {"$addToSet": "$sigla"},
        }},
        # Basic fields
        {"$project": {
            "_id": 0,
            "id_sucursal": "$_id",
            "sigla_from_gastos": {"$ifNull": ["$latest.sigla", None]},
            "count_docs": "$count",
            "first_seen": {"$dateToString": {"format": "%Y-%m-%d", "date": "$first_ts"}},
            "last_seen": {"$dateToString": {"format": "%Y-%m-%d", "date": "$last_ts"}},
            "siglas": "$siglas",
        }},
        # Join sucursales_mtz by id
        {"$lookup": {
            "from": "sucursales_mtz",
            "localField": "id_sucursal",
            "foreignField": "id",
            "as": "suc_mtz"
        }},
        {"$unwind": {"path": "$suc_mtz", "preserveNullAndEmptyArrays": True}},
        # Compute effective SIGLA and candidate permalink slug: prefer mtz.sigla, else latest.sigla, else from set; then build SIGLA+'LOC' fallback
        {"$addFields": {
            "_sigla_from_set": {
                "$let": {
                    "vars": {
                        "non_empty": {"$filter": {"input": {"$ifNull": ["$siglas", []]}, "as": "s", "cond": {"$and": [
                            {"$ne": ["$$s", None]},
                            {"$ne": ["$$s", ""]}
                        ]}}}
                    },
                    "in": {"$arrayElemAt": ["$$non_empty", 0]}
                }
            },
            "_sigla_effective": {"$ifNull": ["$suc_mtz.sigla", {"$ifNull": ["$sigla_from_gastos", "$__sigla_placeholder__"]}]},
        }},
        {"$addFields": {
            "_sigla_effective": {"$cond": [
                {"$or": [
                    {"$eq": ["$_sigla_effective", None]},
                    {"$eq": ["$_sigla_effective", ""]},
                    {"$eq": ["$_sigla_effective", "$__sigla_placeholder__"]}
                ]},
                "$_sigla_from_set",
                "$_sigla_effective"
            ]},
            "_sigla_clean": {"$toUpper": {"$trim": {"input": {"$ifNull": ["$_sigla_effective", ""]}}}},
            "_permalink_slug": {
                "$cond": [
                    {"$and": [
                        {"$ne": ["$suc_mtz.permalink_slug", None]},
                        {"$ne": ["$suc_mtz.permalink_slug", ""]}
                    ]},
                    "$suc_mtz.permalink_slug",
                    {"$concat": ["$_sigla_clean", "LOC"]}
                ]
            }
        }},
        # Join locations strictly by permalink_slug (IDs are unrelated)
        {"$lookup": {
            "from": "locations",
            "let": {"slug": "$_permalink_slug", "sigla": "$_sigla_clean"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$ne": ["$$slug", None]},
                    {"$ne": ["$$slug", ""]},
                    {"$or": [
                        {"$and": [
                            {"$ne": ["$$slug", None]},
                            {"$ne": ["$$slug", ""]},
                            {"$eq": [{"$toUpper": {"$trim": {"input": "$permalink_slug"}}}, "$$slug"]}
                        ]},
                        {"$eq": [
                            {"$substrCP": [
                                {"$toUpper": {"$trim": {"input": "$permalink_slug"}}},
                                0,
                                3
                            ]},
                            "$$sigla"
                        ]}
                    ]}
                ]}}},
                {"$limit": 1}
            ],
            "as": "loc"
        }},
        {"$unwind": {"path": "$loc", "preserveNullAndEmptyArrays": True}},
        # Final projection combining all sources
        {"$project": {
            "id_sucursal": 1,
            "sigla": {"$ifNull": ["$suc_mtz.sigla", "$sigla_from_gastos"]},
            "count_docs": 1,
            "first_seen": 1,
            "last_seen": 1,
            "updated_at": {"$literal": _now_iso()},
            # sucursales_mtz fields
            "mtz": {
                "id_empresa": "$suc_mtz.id_empresa",
                "id_faster": "$suc_mtz.id_faster",
                "activa": "$suc_mtz.activa",
                "selectable": "$suc_mtz.selectable",
                "permalink_slug": "$suc_mtz.permalink_slug",
                "sigla_bodega": "$suc_mtz.sigla_bodega",
                "sigla_local": "$suc_mtz.sigla_local",
                "sucursal": "$suc_mtz.sucursal",
                "last_sync_at": "$suc_mtz.last_sync_at",
            },
            # location fields (best effort)
            "location": {
                "_id": "$loc._id",
                "nombre": "$loc.nombre",
                "direccion": "$loc.direccion",
                "email": "$loc.email",
                "city": "$loc.city",
                "state": "$loc.state",
                "postcode": "$loc.postcode",
                "telephone": "$loc.telephone",
                "lat": "$loc.lat",
                "lng": "$loc.lng",
                "status": "$loc.status",
                "permalink_slug": "$loc.permalink_slug",
                "cantidad_mesas": "$loc.cantidad_mesas",
                "cantidad_sillas": "$loc.cantidad_sillas",
                "capacidad_personas": "$loc.capacidad_personas",
                "updated_at": "$loc.updated_at",
            },
            # debug helpers
            "debug": {
                "slug_candidate": "$_permalink_slug",
                "sigla_clean": "$_sigla_clean",
                "loc_slug": "$loc.permalink_slug"
            }
        }},
        {"$sort": {"id_sucursal": 1}},
    ]

    rows = list(db.gastos_intranet.aggregate(pipeline))
    col = db.gastos_refs_sucursales
    col.create_index("id_sucursal", unique=True)

    upserts = 0
    for r in rows:
        col.update_one({"id_sucursal": r["id_sucursal"]}, {"$set": r}, upsert=True)
        upserts += 1
    logger.info("Sucursales ref upserts: %d", upserts)
    return {"upserts": upserts}


def build_bancos_table() -> Dict[str, int]:
    """
    Build or refresh `gastos_refs_bancos` from `gastos_intranet`.

    Groups by `id_banco`. Keeps the latest `nombre_cuenta_bancaria` and simple stats.
    """
    logger.info("Building bancos reference table from gastos_intranet…")

    pipeline = [
        {"$addFields": {
            "_ts": {"$ifNull": [_safe_to_date("$fecha_edicion"), _safe_to_date("$fecha_pago")]}
        }},
        {"$sort": {"_ts": -1}},
        {"$group": {
            "_id": "$id_banco",
            "latest": {"$first": "$$ROOT"},
            "count": {"$sum": 1},
            "first_ts": {"$last": "$_ts"},
            "last_ts": {"$first": "$_ts"},
            "nombres": {"$addToSet": "$nombre_cuenta_bancaria"},
        }},
        {"$project": {
            "_id": 0,
            "id_banco": "$_id",
            "nombre_cuenta_bancaria": {"$ifNull": ["$latest.nombre_cuenta_bancaria", None]},
            "count_docs": "$count",
            "first_seen": {"$dateToString": {"format": "%Y-%m-%d", "date": "$first_ts"}},
            "last_seen": {"$dateToString": {"format": "%Y-%m-%d", "date": "$last_ts"}},
            "updated_at": {"$literal": _now_iso()},
        }},
        {"$sort": {"id_banco": 1}},
    ]

    rows = list(db.gastos_intranet.aggregate(pipeline))
    col = db.gastos_refs_bancos
    col.create_index("id_banco", unique=True)

    upserts = 0
    for r in rows:
        col.update_one({"id_banco": r["id_banco"]}, {"$set": r}, upsert=True)
        upserts += 1
    logger.info("Bancos ref upserts: %d", upserts)
    return {"upserts": upserts}


def build_all_refs() -> Dict[str, Dict[str, int]]:
    """Run all builders and return stats."""
    return {
        "cuentas": build_cuentas_table(),
        "sucursales": build_sucursales_table(),
        "bancos": build_bancos_table(),
    }


if __name__ == "__main__":
    # Handy CLI execution (python -m utils.analytics.gastos_refs)
    logging.basicConfig(level=logging.INFO)
    stats = build_all_refs()
    print("Build refs stats:", stats)
