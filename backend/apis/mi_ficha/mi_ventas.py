# routers/mi_ventas.py

import logging
import asyncio
from typing import Optional, List, Dict
from datetime import datetime
from dateutil.relativedelta import relativedelta
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from utils.web3mongo import db
from utils.auth.session import verify_session

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Colecciones ---
LINKS = db.empleados_usuarios
TRABAJADORES_COLL = db.trabajadores_vpn
CARGOS_COLL = db.cargos_intranet
KPI_EMPLEADO_COLL = db.kpis_empleado_mensual
KPI_ADMIN_COLL = db.kpis_admin_mensual

# --- Helper Functions ---

def _find_worker_by_rut(rut_value) -> Optional[Dict]:
    """Busca en `trabajadores_vpn` probando rut como int y como string."""
    candidates = []
    if isinstance(rut_value, int):
        candidates = [{"rut": rut_value}, {"rut": str(rut_value)}]
    elif isinstance(rut_value, str):
        r = rut_value.strip()
        candidates = [{"rut": r}]
        try:
            candidates.append({"rut": int(r)})
        except Exception:
            pass
    else:
        try:
            candidates.append({"rut": int(rut_value)})
        except Exception:
            pass
        candidates.append({"rut": str(rut_value)})
    for q in candidates:
        doc = TRABAJADORES_COLL.find_one(q)
        if doc:
            return doc
    return None

def get_user_rut_and_local(user: dict) -> tuple[str, Optional[str]]:
    """Obtiene el RUT y el local actual del perfil del usuario."""
    link = LINKS.find_one({"wallet": user.get("wallet")})
    if not link or not link.get("rut"):
        raise HTTPException(status_code=404, detail="No hay ficha de empleado vinculada a esta identidad.")
    
    rut_raw = link.get("rut")
    rut = str(rut_raw)
    worker = _find_worker_by_rut(rut_raw)
    return rut, (worker.get("sucursal") if worker else None)

def _norm(s: Optional[str]) -> str:
    if not s:
        return ""
    return unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode('ascii').strip().lower()

def get_user_seccion(user: dict) -> Optional[str]:
    """Obtiene la sección (área) del trabajador vinculado a la sesión.
    Si `trabajadores_vpn` no la tiene, la resuelve desde `cargos_intranet` por nombre de cargo.
    """
    link = LINKS.find_one({"wallet": user.get("wallet")})
    if not link or not link.get("rut"):
        return None
    worker = _find_worker_by_rut(link.get("rut")) or {}
    # 1) Si viene directo en VPN, úsala
    seccion = (worker or {}).get("seccion")
    if seccion:
        return seccion
    # 2) Resolver por cargo en cargos_intranet
    cargo_name = (worker or {}).get("cargo")
    if not cargo_name:
        return None
    try:
        cargo_doc = CARGOS_COLL.find_one({"cargo": {"$regex": f"^{cargo_name}$", "$options": "i"}}, {"_id": 0, "seccion": 1})
        return (cargo_doc or {}).get("seccion")
    except Exception:
        return None

def _kpi_coll_for_user(user: dict):
    """Devuelve la colección de KPIs a consultar según la sección del usuario.
    Si la sección es 'Administración Local' => usa KPIs de administradores.
    Caso contrario => KPIs de empleados.
    """
    seccion = _norm(get_user_seccion(user))
    if seccion == "administracion local":
        return KPI_ADMIN_COLL
    return KPI_EMPLEADO_COLL

def _get_ranks_sync(coll, rut: str, group_key: dict, periods: Optional[List[str]] = None) -> dict:
    """Función síncrona para calcular rankings de productos (usada por detalle-productos).
    Usa la colección entregada (empleado o admin). Para admin no exige es_competidor.
    """
    is_admin = getattr(coll, 'name', '') == 'kpis_admin_mensual'
    match_filter: Dict[str, any] = {}
    if not is_admin:
        match_filter["es_competidor"] = True
    if periods:
        match_filter["periodo"] = {"$in": periods}

    pipeline = [
        {"$match": match_filter},
        {"$unwind": "$sales_by_category"},
        {"$addFields": {
            "sales_by_category.familia": {"$ifNull": ["$sales_by_category.familia", "S/F"]},
            "sales_by_category.subfamilia": {"$ifNull": ["$sales_by_category.subfamilia", "S/SF"]}
        }},
        {"$group": {
            "_id": {
                "rut": "$rut", "local": "$local",
                "category": group_key
            },
            "total": {"$sum": "$sales_by_category.total"}
        }},
        {"$setWindowFields": {
            "partitionBy": {"local": "$_id.local", "category": "$_id.category"},
            "sortBy": {"total": -1}, "output": {"puesto_local": {"$rank": {}}}
        }},
        {"$setWindowFields": {
            "partitionBy": "$_id.category",
            "sortBy": {"total": -1}, "output": {"puesto_empresa": {"$rank": {}}}
        }},
        {"$match": {"_id.rut": rut}},
        {"$project": {"_id": 0, "category": "$_id.category", "puesto_local": 1, "puesto_empresa": 1}}
    ]
    rows = list(coll.aggregate(pipeline, allowDiskUse=True))
    return {r["category"]: r for r in rows if r.get("category")}

# --- Endpoints ---

@router.get("/mi/ventas/total", summary="Ventas totales del empleado (toda la historia)")
async def mi_ventas_total(user: dict = Depends(verify_session)):
    """Calcula el total histórico y los rankings generales del empleado."""
    rut, local_actual = get_user_rut_and_local(user)
    coll = _kpi_coll_for_user(user)

    if not coll.find_one({"rut": rut}):
        return {"rut": rut, "local": local_actual, "mi_total": 0, "puesto_empresa": 0, "puesto_local": 0}

    user_total_data = list(coll.aggregate([
        {"$match": {"rut": rut}},
        {"$group": {"_id": None, "mi_total": {"$sum": "$sales.total"}}}
    ]))
    mi_total = user_total_data[0]['mi_total'] if user_total_data else 0
    
    is_admin = getattr(coll, 'name', '') == 'kpis_admin_mensual'
    base_match = ({}) if is_admin else {"es_competidor": True}
    pipeline_ranks = [
        {"$match": base_match},
        {"$group": {"_id": {"rut": "$rut", "local": "$local"}, "total_sales": {"$sum": "$sales.total"}}},
        {"$sort": {"total_sales": -1}},
        {"$group": {"_id": "$_id.local", "employees": {"$push": {"rut": "$_id.rut", "total_sales": "$total_sales"}}}},
        {"$unwind": {"path": "$employees", "includeArrayIndex": "rank_local"}},
        {"$replaceRoot": {"newRoot": {"rut": "$employees.rut", "local": "$_id", "total_sales": "$employees.total_sales", "puesto_local": {"$add": ["$rank_local", 1]}}}},
        {"$sort": {"total_sales": -1}},
        {"$group": {"_id": None, "employees": {"$push": "$$ROOT"}}},
        {"$unwind": {"path": "$employees", "includeArrayIndex": "rank_empresa"}},
        {"$replaceRoot": {"newRoot": {"rut": "$employees.rut", "local": "$employees.local", "total_sales": "$employees.total_sales", "puesto_local": "$employees.puesto_local", "puesto_empresa": {"$add": ["$rank_empresa", 1]}}}},
        {"$match": {"rut": rut}}
    ]
    ranks = list(coll.aggregate(pipeline_ranks, allowDiskUse=True))
    
    if not ranks:
        return {"rut": rut, "local": local_actual, "mi_total": mi_total, "puesto_empresa": 0, "puesto_local": 0}

    selected = next((r for r in ranks if r.get("local") == local_actual), max(ranks, key=lambda x: x.get("total_sales", 0), default={}))
    
    return {
        "rut": rut, "local": local_actual, "mi_total": mi_total,
        "puesto_empresa": selected.get("puesto_empresa", 0),
        "puesto_local": selected.get("puesto_local", 0)
    }


@router.get("/mi/ventas/por-periodo", summary="Historial de ventas y KPIs por período (Ultra Rápido)")
async def mi_ventas_por_periodo(
    user: dict = Depends(verify_session),
    periodo_start: Optional[str] = Query(None, description="Formato YYYY-MM"),
    periodo_end: Optional[str] = Query(None, description="Formato YYYY-MM"),
):
    """
    Devuelve el historial mensual detallado leyendo TODOS los datos pre-calculados,
    incluyendo rankings, tops y PROMEDIOS de benchmarks.
    """
    rut, local_actual = get_user_rut_and_local(user)

    coll = _kpi_coll_for_user(user)
    match_filter = {"rut": rut}
    if periodo_start or periodo_end:
        period_query = {}
        if periodo_start: period_query["$gte"] = periodo_start
        if periodo_end: period_query["$lte"] = periodo_end
        match_filter["periodo"] = period_query
    
    pipeline = [
        {"$match": match_filter},
        {"$sort": {"periodo": -1}},
        {"$project": {
            "_id": 0,
            "periodo": 1, 
            "local": 1,
            "ventas": "$sales", # Obtenemos el objeto 'sales' completo
            "total_mesas": 1,
            "promedio_por_mesa": 1,
            "personas_atendidas": 1,
            "promedio_por_persona": 1
        }}
    ]

    try:
        results = list(coll.aggregate(pipeline))
        return {"rut": rut, "local_actual": local_actual, "ventas_por_periodo": results}
    except Exception as e:
        logger.exception(f"Error al obtener historial de ventas para RUT {rut}: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar el historial de ventas.")


@router.get("/mi/ventas/kpis-ultimos", summary="KPIs de ventas (últimos 3 meses)")
async def mi_ventas_kpis_ultimos(user: dict = Depends(verify_session)):
    """Obtiene los KPIs completos de los últimos 3 meses desde el caché."""
    rut, local = get_user_rut_and_local(user)
    now = datetime.now()
    last_months = [(now - relativedelta(months=i)).strftime("%Y-%m") for i in range(3)]
    
    coll = _kpi_coll_for_user(user)
    cursor = coll.find(
        {"rut": rut, "periodo": {"$in": last_months}},
        {"_id": 0, "periodo": 1, "sales": 1, "restaurant": 1, "total_mesas": 1, "promedio_por_mesa": 1, "personas_atendidas": 1, "promedio_por_persona": 1}
    )
    cached = {r["periodo"]: r for r in cursor}
    
    final_kpis = []
    for month in last_months:
        final_kpis.append(cached.get(month, {
            "periodo": month,
            "sales": {"total": 0, "puesto_local": 0, "puesto_empresa": 0, "promedio_local": 0, "promedio_empresa": 0, "top_local": 0, "top_empresa": 0},
            "restaurant": {},
            "total_mesas": {"valor": 0, "puesto_local": 0, "top_local": 0, "promedio_local": 0, "puesto_empresa": 0, "top_empresa": 0, "promedio_empresa": 0},
            "promedio_por_mesa": {"valor": 0, "puesto_local": 0, "top_local": 0, "promedio_local": 0, "puesto_empresa": 0, "top_empresa": 0, "promedio_empresa": 0},
            "personas_atendidas": {"valor": 0, "puesto_local": 0, "top_local": 0, "promedio_local": 0, "puesto_empresa": 0, "top_empresa": 0, "promedio_empresa": 0},
            "promedio_por_persona": {"valor": 0, "puesto_local": 0, "top_local": 0, "promedio_local": 0, "puesto_empresa": 0, "top_empresa": 0, "promedio_empresa": 0}
        }))
    return {"rut": rut, "local": local, "kpis_ultimos_periodos": final_kpis}

@router.get("/mi/ventas/detalle-productos", summary="Análisis de ventas para coaching")
async def mi_ventas_detalle_productos_enriquecido(
    user: dict = Depends(verify_session),
    periodo_start: Optional[str] = Query(None, description="Fecha de inicio YYYY-MM-DD"),
    periodo_end: Optional[str] = Query(None, description="Fecha de fin YYYY-MM-DD")
):
    """Realiza cálculos en tiempo real para benchmarks y comparativas anuales por categoría."""
    rut, _ = get_user_rut_and_local(user)

    try:
        end_date = datetime.strptime(periodo_end, "%Y-%m-%d") if periodo_end else datetime.now()
        start_date = datetime.strptime(periodo_start, "%Y-%m-%d") if periodo_start else end_date - relativedelta(days=29)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD.")

    periodo_analisis = f"Del {start_date.strftime('%Y-%m-%d')} al {end_date.strftime('%Y-%m-%d')}"
    current_periods = sorted(list(set([(start_date + relativedelta(days=i)).strftime("%Y-%m") for i in range((end_date - start_date).days + 1)])))
    previous_periods = sorted(list(set([(datetime.strptime(p, "%Y-%m") - relativedelta(years=1)).strftime("%Y-%m") for p in current_periods])))
    empty_response = {"rut": rut, "local": "N/A", "periodo_analisis": periodo_analisis, "analisis_por_familia": [], "analisis_por_subfamilia": []}

    coll = _kpi_coll_for_user(user)
    most_frequent_local_list = list(coll.aggregate([
        {"$match": {"rut": rut, "periodo": {"$in": current_periods}}},
        {"$group": {"_id": "$local", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 1}
    ]))
    primary_local = most_frequent_local_list[0]['_id'] if most_frequent_local_list else None

    if not primary_local:
        return empty_response

    is_admin = getattr(coll, 'name', '') == 'kpis_admin_mensual'
    cond_es_comp = ({}) if is_admin else {"es_competidor": True}
    main_pipeline = [
        {"$match": {"periodo": {"$in": current_periods + previous_periods}}},
        {"$unwind": "$sales_by_category"},
        {"$addFields": {
            "year_type": {"$cond": [{"$in": ["$periodo", current_periods]}, "actual", "anterior"]},
            "familia_norm": {"$ifNull": ["$sales_by_category.familia", "S/F"]},
            "subfamilia_norm": {"$ifNull": ["$sales_by_category.subfamilia", "S/SF"]},
        }},
        {"$facet": {
            "mis_ventas": [ {"$match": {"rut": rut}}, {"$group": {"_id": {"familia": "$familia_norm", "subfamilia": "$subfamilia_norm", "year": "$year_type"}, "total": {"$sum": "$sales_by_category.total"}}} ],
            "ventas_local": [ {"$match": {"local": primary_local, "periodo": {"$in": current_periods}, **cond_es_comp}}, {"$group": {"_id": {"familia": "$familia_norm", "subfamilia": "$subfamilia_norm", "rut": "$rut"}, "total": {"$sum": "$sales_by_category.total"}}}, {"$group": {"_id": {"familia": "$_id.familia", "subfamilia": "$_id.subfamilia"}, "promedio": {"$avg": "$total"}, "top": {"$max": "$total"}}} ],
            "ventas_empresa": [ {"$match": {"periodo": {"$in": current_periods}, **cond_es_comp}}, {"$group": {"_id": {"familia": "$familia_norm", "subfamilia": "$subfamilia_norm", "rut": "$rut"}, "total": {"$sum": "$sales_by_category.total"}}}, {"$group": {"_id": {"familia": "$_id.familia", "subfamilia": "$_id.subfamilia"}, "promedio": {"$avg": "$total"}, "top": {"$max": "$total"}}} ],
            "ventas_local_familia": [ {"$match": {"local": primary_local, "periodo": {"$in": current_periods}, **cond_es_comp}}, {"$group": {"_id": {"familia": "$familia_norm", "rut": "$rut"}, "total": {"$sum": "$sales_by_category.total"}}}, {"$group": {"_id": "$_id.familia", "promedio": {"$avg": "$total"}, "top": {"$max": "$total"}}} ],
            "ventas_empresa_familia": [ {"$match": {"periodo": {"$in": current_periods}, **cond_es_comp}}, {"$group": {"_id": {"familia": "$familia_norm", "rut": "$rut"}, "total": {"$sum": "$sales_by_category.total"}}}, {"$group": {"_id": "$_id.familia", "promedio": {"$avg": "$total"}, "top": {"$max": "$total"}}} ]
        }}
    ]
    try:
        group_key_subfamily = {"$concat": ["$sales_by_category.familia", "||", "$sales_by_category.subfamilia"]}
        group_key_family = "$sales_by_category.familia"
        
        tasks = [
            asyncio.to_thread(lambda: list(coll.aggregate(main_pipeline, allowDiskUse=True))),
            asyncio.to_thread(_get_ranks_sync, coll, rut, group_key_subfamily, current_periods),
            asyncio.to_thread(_get_ranks_sync, coll, rut, group_key_subfamily, previous_periods),
            asyncio.to_thread(_get_ranks_sync, coll, rut, group_key_subfamily),
            asyncio.to_thread(_get_ranks_sync, coll, rut, group_key_family, current_periods),
            asyncio.to_thread(_get_ranks_sync, coll, rut, group_key_family, previous_periods),
            asyncio.to_thread(_get_ranks_sync, coll, rut, group_key_family)
        ]
        results, sf_actual, sf_anterior, sf_historico, f_actual, f_anterior, f_historico = await asyncio.gather(*tasks)
        data = results[0] if results else {}

    except Exception as e:
        logger.exception(f"Error crítico al generar análisis detallado para RUT {rut}: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar el análisis detallado.")

    mis_ventas = {(v['_id']['familia'], v['_id']['subfamilia'], v['_id']['year']): v['total'] for v in data.get('mis_ventas', [])}
    local_bench = {(b['_id']['familia'], b['_id']['subfamilia']): b for b in data.get('ventas_local', [])}
    empresa_bench = {(b['_id']['familia'], b['_id']['subfamilia']): b for b in data.get('ventas_empresa', [])}
    local_bench_familia = {b['_id']: b for b in data.get('ventas_local_familia', [])}
    empresa_bench_familia = {b['_id']: b for b in data.get('ventas_empresa_familia', [])}
    all_keys = set((k[0], k[1]) for k in mis_ventas.keys()) | set(local_bench.keys()) | set(empresa_bench.keys())

    analisis_subfamilia, family_sales_agg = [], {}
    for familia, subfamilia in all_keys:
        if not familia or not subfamilia: continue
        cat_key = f"{familia}||{subfamilia}"
        actual, anterior = mis_ventas.get((familia, subfamilia, 'actual'), 0), mis_ventas.get((familia, subfamilia, 'anterior'), 0)
        variacion = 100.0 if actual > 0 and anterior == 0 else (round(((actual - anterior) / anterior) * 100, 2) if anterior > 0 else 0.0)
        
        analisis_subfamilia.append({
            "familia": familia, "subfamilia": subfamilia, "tus_ventas": round(actual),
            "ranking": {"actual": sf_actual.get(cat_key, {}), "anterior": sf_anterior.get(cat_key, {}), "historico": sf_historico.get(cat_key, {})},
            "comparativo_anual": {"anterior": round(anterior), "variacion_porcentual": variacion},
            "benchmark_local": local_bench.get((familia, subfamilia), {}),
            "benchmark_empresa": empresa_bench.get((familia, subfamilia), {})
        })
        fam_agg = family_sales_agg.setdefault(familia, {"actual": 0, "anterior": 0})
        fam_agg["actual"] += actual
        fam_agg["anterior"] += anterior
    
    analisis_familia = []
    for fam, sales in family_sales_agg.items():
        variacion_fam = 100.0 if sales["actual"] > 0 and sales["anterior"] == 0 else (round(((sales["actual"] - sales["anterior"]) / sales["anterior"]) * 100, 2) if sales["anterior"] > 0 else 0.0)
        analisis_familia.append({
            "familia": fam, "subfamilia": "Todas", "tus_ventas": round(sales["actual"]),
            "ranking": {"actual": f_actual.get(fam, {}), "anterior": f_anterior.get(fam, {}), "historico": f_historico.get(fam, {})},
            "comparativo_anual": {"anterior": round(sales["anterior"]), "variacion_porcentual": variacion_fam},
            "benchmark_local": local_bench_familia.get(fam, {}),
            "benchmark_empresa": empresa_bench_familia.get(fam, {})
        })

    analisis_subfamilia.sort(key=lambda x: x['tus_ventas'], reverse=True)
    analisis_familia.sort(key=lambda x: x['tus_ventas'], reverse=True)
    return {"rut": rut, "local": primary_local, "periodo_analisis": periodo_analisis, "analisis_por_familia": analisis_familia, "analisis_por_subfamilia": analisis_subfamilia}