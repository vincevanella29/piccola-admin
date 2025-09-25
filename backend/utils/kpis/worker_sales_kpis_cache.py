# utils/kpis/worker_sales_kpis_cache.py

import logging
from datetime import datetime
from typing import Dict, List, Tuple

import argparse
from pymongo import UpdateOne
from dateutil.relativedelta import relativedelta

from utils.web3mongo import db

# --- Configuración ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- Colecciones (fuentes) ---
RESTAURANT_SRC = db.restaurant_data
LOCAL_SALES_SRC = db.ventas_locales
ASISTENCIA_SRC = db.asistencia_diaria_intranet

# --- Colecciones (destino) ---
KPI_EMPLEADO_COLL = db.kpis_empleado_mensual
LOCAL_SALES_COLL = db.local_sales_monthly

# --- IDs de Cargos que compiten en Rankings ---
COMPETING_ROLE_IDS = [10, 24, 34, 36, 45, 62]

# --- Reglas de sanidad para "mesas" ---
MIN_TOTAL_MESA = 1000
MAX_TOTAL_MESA = 3000000
VALID_TIPOS = ["BOLETA", "FACTURA"]
VALID_ESTADO = "C"


def _ensure_indexes():
    KPI_EMPLEADO_COLL.create_index([("periodo", 1), ("rut", 1)], unique=True)
    KPI_EMPLEADO_COLL.create_index([("periodo", 1), ("local", 1), ("sales.total", -1)])
    LOCAL_SALES_COLL.create_index([("periodo", 1), ("local", 1)], unique=True)
    logger.info("Índices asegurados.")


def _ym_to_dash(ym: str) -> str:
    return f"{ym[:4]}-{ym[4:6]}"


# =========================
# FASE A: BASE SIN PUESTOS
# =========================
def _compute_employee_kpis_base(periodo_dash: str, periodo_ym: str, competing_role_ids: list) -> List[Dict]:
    """
    Arma TODA la data (competidores y no competidores) SIN rank.
    Deja el mismo formato de documento que usas en FE:
      - personas_atendidas / total_mesas / promedio_por_mesa / promedio_por_persona:
        incluyen "valor" y (en esta fase) NO incluyen aún top/promedios/puestos.
      - restaurant incluye puesto_local/puesto_empresa en 0 para mantener el shape.
    """
    periodo_ym_int = int(periodo_ym)

    pipeline = [
        # Normalización simple
        {"$addFields": {
            "local_norm": {"$replaceAll": {"input": {"$ifNull": ["$local", ""]}, "find": "LOC", "replacement": ""}},
            "fecha_norm": {"$trim": {"input": {"$ifNull": ["$Fecha", ""]}}}
        }},
        # Filtros de sanidad
        {"$match": {
            "mesano": periodo_ym,  # STRING
            "Estado": VALID_ESTADO,
            "Tipo": {"$in": VALID_TIPOS},
            "Personas": {"$gte": 1},
            "Total": {"$gte": MIN_TOTAL_MESA, "$lte": MAX_TOTAL_MESA},
            "Rut_Vendedor": {"$ne": None, "$exists": True}
        }},
        # DEDUP mesa: (local, fecha, Mesa, Rotacion, Rut)
        {"$group": {
            "_id": {
                "local": "$local_norm",
                "fecha": "$fecha_norm",
                "mesa": "$Mesa",
                "rot": "$Rotacion",
                "rut": "$Rut_Vendedor"
            },
            "TotalMesa": {"$max": "$Total"},
            "PersonasMesa": {"$max": "$Personas"}
        }},
        # Agregado por vendedor (rut+local)
        {"$group": {
            "_id": {"rut": "$_id.rut", "local": "$_id.local"},
            "total_mes": {"$sum": "$TotalMesa"},
            "personas_mes": {"$sum": "$PersonasMesa"},
            "mesas_mes": {"$sum": 1},
            "fechas": {"$addToSet": "$_id.fecha"}
        }},
        # Asistencia -> id_cargo + flag competidor
        {"$lookup": {
            "from": "asistencia_diaria_intranet",
            "let": {"employee_rut_str": "$_id.rut", "periodo_int": periodo_ym_int},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$rut", {"$toLong": "$$employee_rut_str"}]},
                    {"$eq": ["$periodo", "$$periodo_int"]}
                ]}}},
                {"$sort": {"fecha_trabajada": -1}},
                {"$limit": 1},
                {"$project": {"_id": 0, "id_cargo_ficha": 1}}
            ],
            "as": "asistencia_info"
        }},
        {"$unwind": {"path": "$asistencia_info", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {
            "rut": {"$toString": "$_id.rut"},
            "local": "$_id.local",
            "periodo": periodo_dash,
            "id_cargo_historico": {"$ifNull": ["$asistencia_info.id_cargo_ficha", 0]},
            "es_competidor": {"$and": [
                {"$in": ["$asistencia_info.id_cargo_ficha", competing_role_ids]},
                {"$gte": [{"$toLong": "$_id.rut"}, 1000000]},
                {"$lt": [{"$toLong": "$_id.rut"}, 50000000]}
            ]},
            # Totales base
            "sales.total": {"$ifNull": ["$total_mes", 0]},
            "restaurant.total": {"$ifNull": ["$total_mes", 0]},
            "restaurant.personas_total": {"$ifNull": ["$personas_mes", 0]},
            "restaurant.total_mesas_atendidas": {"$ifNull": ["$mesas_mes", 0]}
        }},
        # Promedios base (redondeados)
        {"$addFields": {
            "metric.pm_mesa": {
                "$round": [
                    {"$cond": [
                        {"$gt": ["$restaurant.total_mesas_atendidas", 0]},
                        {"$divide": ["$restaurant.total", "$restaurant.total_mesas_atendidas"]},
                        0
                    ]},
                    2
                ]
            },
            "metric.pm_persona": {
                "$round": [
                    {"$cond": [
                        {"$gt": ["$restaurant.personas_total", 0]},
                        {"$divide": ["$restaurant.total", "$restaurant.personas_total"]},
                        0
                    ]},
                    2
                ]
            },
            "dias_con_venta": {"$size": {"$ifNull": ["$fechas", []]}},
            "metric.pm_diario": {
                "$round": [
                    {"$cond": [
                        {"$gt": [ {"$size": {"$ifNull": ["$fechas", []]}}, 0]},
                        {"$divide": ["$restaurant.total", {"$size": {"$ifNull": ["$fechas", []]}}]},
                        0
                    ]}, 2]
            }
        }},
        {"$addFields": {
            "restaurant.promedio_por_mesa": "$metric.pm_mesa",
            "restaurant.promedio_persona": "$metric.pm_persona"
        }},
        # PROYECCIÓN FINAL — FORMATO ESTÁNDAR SIN RANK
        {"$project": {
            "_id": 0,
            "rut": 1,
            "periodo": 1,
            "local": 1,
            "id_cargo_historico": 1,
            "es_competidor": 1,

            "personas_atendidas": {"valor": {"$ifNull": ["$restaurant.personas_total", 0]}},
            "total_mesas": {"valor": {"$ifNull": ["$restaurant.total_mesas_atendidas", 0]}},
            "promedio_por_mesa": {"valor": {"$ifNull": ["$metric.pm_mesa", 0]}},
            "promedio_por_persona": {"valor": {"$ifNull": ["$metric.pm_persona", 0]}},
            "promedio_venta_diaria": {"valor": {"$ifNull": ["$metric.pm_diario", 0]}, "dias_con_venta": {"$ifNull": ["$dias_con_venta", 0]}},

            "restaurant": {
                "total": {"$round": ["$restaurant.total", 2]},
                "personas_total": {"$ifNull": ["$restaurant.personas_total", 0]},
                "total_mesas_atendidas": {"$ifNull": ["$restaurant.total_mesas_atendidas", 0]},
                "promedio_por_mesa": {"$ifNull": ["$restaurant.promedio_por_mesa", 0]},
                "promedio_persona": {"$ifNull": ["$restaurant.promedio_persona", 0]},
                # Mantener shape del ejemplo
                "mesas_atendidas_promedio_diario": {"$literal": None},
                "personas_atendidas_promedio_diario": {"$literal": None},
                "platos_vendidos_promedio_diario": {"$literal": None},
                "puesto_local": {"$literal": 0},
                "puesto_empresa": {"$literal": 0}
            },

            "sales": {
                "total": {"$round": ["$sales.total", 2]},
                "puesto_local": {"$literal": 0},   # shape
                "top_local": {"$literal": None},
                "promedio_local": {"$literal": None},
                "puesto_empresa": {"$literal": 0},
                "top_empresa": {"$literal": None},
                "promedio_empresa": {"$literal": None}
            },

            "sales_by_category": {"$literal": []},
            "updated_at": datetime.utcnow()
        }}
    ]

    base_docs = list(RESTAURANT_SRC.aggregate(pipeline, allowDiskUse=True))
    # Normaliza None -> elimina claves None opcionales (para ahorrar espacio) si quieres
    return base_docs


def _compute_sales_by_category(periodo_ym: str) -> Dict[str, List]:
    pipeline = [
        {"$match": {
            "mesano": periodo_ym,
            "Estado": VALID_ESTADO,
            "Tipo": {"$in": VALID_TIPOS},
            "Rut_Vendedor": {"$ne": None, "$exists": True}
        }},
        {"$unwind": "$Productos"},
        {"$group": {
            "_id": {
                "rut": "$Rut_Vendedor",
                "familia": "$Productos.Familia",
                "subfamilia": "$Productos.Subfamilia"
            },
            "total": {"$sum": "$Productos.Total_Producto"},
            "cantidad": {"$sum": "$Productos.Cantidad"}
        }},
        {"$group": {
            "_id": "$_id.rut",
            "categories": {"$push": {
                "familia": "$_id.familia",
                "subfamilia": "$_id.subfamilia",
                "total": "$total",
                "cantidad": "$cantidad"
            }}
        }}
    ]
    results = list(RESTAURANT_SRC.aggregate(pipeline, allowDiskUse=True))
    return {str(item['_id']): item['categories'] for item in results}


# =========================================
# FASE B: RANKS + TOP/PROMEDIOS (COMPETIDORES)
# =========================================
def _rank_metric_rows(periodo_dash: str, metric_field: str) -> List[Dict]:
    """
    Devuelve {rut, periodo, local, puesto_empresa_tmp, puesto_local_tmp}
    SOLO competidores y metric > 0
    """
    pipeline = [
        {"$match": {
            "periodo": periodo_dash,
            "es_competidor": True,
            metric_field: {"$gt": 0}
        }},
        # Rank empresa (entre competidores)
        {"$setWindowFields": {
            "sortBy": {metric_field: -1},
            "output": {"puesto_empresa_tmp": {"$denseRank": {}}}
        }},
        # Rank local (entre competidores por local)
        {"$setWindowFields": {
            "partitionBy": "$local",
            "sortBy": {metric_field: -1},
            "output": {"puesto_local_tmp": {"$denseRank": {}}}
        }},
        {"$project": {"_id": 0, "rut": 1, "periodo": 1, "local": 1,
                      "puesto_empresa_tmp": 1, "puesto_local_tmp": 1}}
    ]
    return list(KPI_EMPLEADO_COLL.aggregate(pipeline, allowDiskUse=True))


def _top_avg_company(periodo_dash: str, metric_field: str) -> Tuple[float, float]:
    pipeline = [
        {"$match": {"periodo": periodo_dash, "es_competidor": True, metric_field: {"$gt": 0}}},
        {"$group": {"_id": None, "top": {"$max": f"${metric_field}"}, "avg": {"$avg": f"${metric_field}"}}},
        {"$project": {"_id": 0, "top": 1, "avg": 1}}
    ]
    rows = list(KPI_EMPLEADO_COLL.aggregate(pipeline))
    if not rows:
        return 0.0, 0.0
    r = rows[0]
    return float(r.get("top", 0) or 0), float(r.get("avg", 0) or 0)


def _top_avg_by_local(periodo_dash: str, metric_field: str) -> Dict[str, Tuple[float, float]]:
    pipeline = [
        {"$match": {"periodo": periodo_dash, "es_competidor": True, metric_field: {"$gt": 0}}},
        {"$group": {"_id": "$local", "top": {"$max": f"${metric_field}"}, "avg": {"$avg": f"${metric_field}"}}},
        {"$project": {"_id": 0, "local": "$_id", "top": 1, "avg": 1}}
    ]
    rows = list(KPI_EMPLEADO_COLL.aggregate(pipeline))
    out: Dict[str, Tuple[float, float]] = {}
    for r in rows:
        out[str(r["local"])] = (float(r.get("top", 0) or 0), float(r.get("avg", 0) or 0))
    return out


def _apply_metric_for_all(periodo_dash: str, metric_field: str, prefix: str):
    """
    Escribe top/promedios para TODOS (competidores y no competidores).
    Escribe puestos SOLO para competidores; en no competidores deja puesto_* = 0.
    """
    # Mapear prefijos a rutas anidadas en el documento
    path_map = {
        "ventas": "sales",
        "total_mesas": "total_mesas",
        "personas": "personas_atendidas",
        "promedio_mesa": "promedio_por_mesa",
        "promedio_persona": "promedio_por_persona",
        "promedio_venta_diaria": "promedio_venta_diaria",
    }
    target_root = path_map.get(prefix)
    if not target_root:
        logger.warning(f"Prefijo desconocido para ranking: {prefix}")
        return

    # Ranks (solo competidores)
    comp_rows = _rank_metric_rows(periodo_dash, metric_field)
    comp_index = {(r["periodo"], r["rut"]): r for r in comp_rows}

    # Top/Avg empresa y por local (calculados solo con competidores)
    top_emp, avg_emp = _top_avg_company(periodo_dash, metric_field)
    local_stats = _top_avg_by_local(periodo_dash, metric_field)

    # 1) Actualiza COMPETIDORES
    ops: List[UpdateOne] = []
    for key, r in comp_index.items():
        loc = r["local"]
        top_loc, avg_loc = local_stats.get(loc, (0.0, 0.0))
        filt = {"periodo": r["periodo"], "rut": r["rut"]}
        set_fields = {
            f"{target_root}.puesto_empresa": int(r.get("puesto_empresa_tmp", 0) or 0),
            f"{target_root}.puesto_local": int(r.get("puesto_local_tmp", 0) or 0),
            f"{target_root}.top_empresa": round(top_emp, 2),
            f"{target_root}.promedio_empresa": round(avg_emp, 2),
            f"{target_root}.top_local": round(top_loc, 2),
            f"{target_root}.promedio_local": round(avg_loc, 2),
            "updated_at": datetime.utcnow()
        }
        # También reflejar los puestos de ventas en restaurant
        if prefix == "ventas":
            set_fields.update({
                "restaurant.puesto_empresa": int(r.get("puesto_empresa_tmp", 0) or 0),
                "restaurant.puesto_local": int(r.get("puesto_local_tmp", 0) or 0),
            })
        # Eliminar campos legacy planos para este prefijo
        unset_fields = {
            f"puesto_empresa_{prefix}": "",
            f"puesto_local_{prefix}": "",
            f"top_empresa_{prefix}": "",
            f"promedio_empresa_{prefix}": "",
            f"top_local_{prefix}": "",
            f"promedio_local_{prefix}": "",
        }
        ops.append(UpdateOne(filt, {"$set": set_fields, "$unset": unset_fields}, upsert=False))

    if ops:
        KPI_EMPLEADO_COLL.bulk_write(ops, ordered=False)

    # 2) Actualiza NO COMPETIDORES (puesto=0 pero con top/promedios poblados)
    noncomp_cursor = KPI_EMPLEADO_COLL.find(
        {"periodo": periodo_dash, "es_competidor": False},
        {"rut": 1, "periodo": 1, "local": 1}
    )
    ops_nc: List[UpdateOne] = []
    for nc in noncomp_cursor:
        loc = nc.get("local")
        top_loc, avg_loc = local_stats.get(loc, (0.0, 0.0))
        filt = {"periodo": nc["periodo"], "rut": nc["rut"]}
        set_fields = {
            f"{target_root}.puesto_empresa": 0,
            f"{target_root}.puesto_local": 0,
            f"{target_root}.top_empresa": round(top_emp, 2),
            f"{target_root}.promedio_empresa": round(avg_emp, 2),
            f"{target_root}.top_local": round(top_loc, 2),
            f"{target_root}.promedio_local": round(avg_loc, 2),
            "updated_at": datetime.utcnow()
        }
        if prefix == "ventas":
            set_fields.update({
                "restaurant.puesto_empresa": 0,
                "restaurant.puesto_local": 0,
            })
        unset_fields = {
            f"puesto_empresa_{prefix}": "",
            f"puesto_local_{prefix}": "",
            f"top_empresa_{prefix}": "",
            f"promedio_empresa_{prefix}": "",
            f"top_local_{prefix}": "",
            f"promedio_local_{prefix}": "",
        }
        ops_nc.append(UpdateOne(filt, {"$set": set_fields, "$unset": unset_fields}, upsert=False))

    if ops_nc:
        KPI_EMPLEADO_COLL.bulk_write(ops_nc, ordered=False)


def apply_ranks_and_aggregates(periodo_dash: str):
    """
    Aplica top/promedios a TODOS los docs (se calculan desde competidores),
    y aplica puestos SOLO a competidores.
    """
    _apply_metric_for_all(periodo_dash, "sales.total", "ventas")
    _apply_metric_for_all(periodo_dash, "total_mesas.valor", "total_mesas")
    _apply_metric_for_all(periodo_dash, "personas_atendidas.valor", "personas")
    _apply_metric_for_all(periodo_dash, "promedio_por_mesa.valor", "promedio_mesa")
    _apply_metric_for_all(periodo_dash, "promedio_por_persona.valor", "promedio_persona")
    _apply_metric_for_all(periodo_dash, "promedio_venta_diaria.valor", "promedio_venta_diaria")


# ==========================
# Ventas por local (mensual)
# ==========================
def _compute_local_sales_period(periodo_dash: str) -> List[Dict]:
    ym_int = int(periodo_dash.replace("-", ""))
    pipeline = [
        {"$match": {"mesano": ym_int}},
        {"$group": {
            "_id": {"$replaceAll": {"input": "$local", "find": "LOC", "replacement": ""}},
            "total": {"$sum": {"$ifNull": ["$total", 0]}},
            "mesas": {"$sum": {"$ifNull": ["$mesas", 0]}},
            "personas": {"$sum": {"$ifNull": ["$personas", 0]}}
        }},
        {"$setWindowFields": {
            "sortBy": {"total": -1},
            "output": {"puesto_empresa": {"$denseRank": {}}}
        }}
    ]
    rows = list(LOCAL_SALES_SRC.aggregate(pipeline, allowDiskUse=True))
    return [{
        "periodo": periodo_dash,
        "local": r["_id"],
        "total": r.get("total", 0),
        "mesas": r.get("mesas", 0),
        "personas": r.get("personas", 0),
        "puesto_empresa": r.get("puesto_empresa", 0),
        "updated_at": datetime.utcnow()
    } for r in rows]


# ============
# Orquestador
# ============
def process_period(mesano: str):
    periodo_dash = _ym_to_dash(mesano)
    logger.info(f"--- Iniciando procesamiento para el período {mesano} ({periodo_dash}) ---")

    # FASE A: construir base SIN puestos (pero con el mismo shape)
    base_docs = _compute_employee_kpis_base(periodo_dash, mesano, COMPETING_ROLE_IDS)
    if not base_docs:
        logger.warning(f"No se generaron KPIs base para el período {mesano}.")
    else:
        sales_by_category_data = _compute_sales_by_category(mesano)
        ops = []
        for doc in base_docs:
            rut = doc["rut"]
            if rut in sales_by_category_data:
                doc["sales_by_category"] = sales_by_category_data[rut]
            ops.append(UpdateOne(
                {"periodo": doc["periodo"], "rut": doc["rut"]},
                {"$set": doc},
                upsert=True
            ))
        res = KPI_EMPLEADO_COLL.bulk_write(ops, ordered=False)
        logger.info(f"FASE A escrita (base sin puestos): {res.bulk_api_result}")

    # FASE B: ranks y top/promedios
    apply_ranks_and_aggregates(periodo_dash)

    # Ventas por local (agregado mensual)
    local_sales_docs = _compute_local_sales_period(periodo_dash)
    if local_sales_docs:
        ops2 = [UpdateOne(
            {"periodo": doc["periodo"], "local": doc["local"]},
            {"$set": doc},
            upsert=True
        ) for doc in local_sales_docs]
        LOCAL_SALES_COLL.bulk_write(ops2, ordered=False)
        logger.info("Ventas por local mensual escritas.")

    logger.info(f"--- Período {mesano} finalizado. ---")


def run_worker(periodo: str | None = None):
    _ensure_indexes()
    try:
        periods_to_process: List[str] = []
        if periodo:
            if len(periodo) == 4 and periodo.isdigit():
                periods_to_process = [f"{periodo}{m:02d}" for m in range(1, 13)]
            elif len(periodo) == 6 and periodo.isdigit():
                periods_to_process.append(periodo)
        else:
            today = datetime.now()
            periods_to_process.append(today.strftime("%Y%m"))
            if today.day <= 15:
                periods_to_process.append((today - relativedelta(months=1)).strftime("%Y%m"))

        unique_periods = sorted(list(set(periods_to_process)))
        logger.info(f"Períodos finales a procesar: {', '.join(unique_periods)}")
        for p in unique_periods:
            process_period(p)
    except Exception as e:
        logger.exception(f"[KPIS WORKER] Falló con un error inesperado: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Worker KPIs Ventas — Fase A (base) + Fase B (ranks de competidores).")
    parser.add_argument('--periodo', help='Período a procesar en formato YYYYMM o YYYY.')
    args = parser.parse_args()
    run_worker(args.periodo)
