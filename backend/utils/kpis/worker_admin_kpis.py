# utils/kpis/worker_admin_kpis.py
# ---
# KPIs de ADMINISTRADORES con misma estructura que kpis_empleado_mensual
# Fuentes:
#   - restaurant_data (mesas/ventas crudas + Productos)
#   - asistencia_diaria_intranet (presencias con id_cargo / seccion)
#   - empresas / cargos_intranet (apoyos)
# Destino:
#   - kpis_admin_mensual
#
# Ejecutar:
#   python -m utils.kpis.worker_admin_kpis --periodo 202509
#   python -m utils.kpis.worker_admin_kpis --periodo 2025
# ---

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Set, Any
import argparse

from pymongo import UpdateOne
from dateutil.relativedelta import relativedelta

from utils.web3mongo import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# --- Colecciones (fuentes) ---
RESTAURANT_SRC = db.restaurant_data
ASISTENCIA_SRC = db.asistencia_diaria_intranet
EMPRESAS = db.empresas
CARGOS = db.cargos_intranet

# --- Colección (destino) ---
ADMIN_MONTHLY_COLL = db.kpis_admin_mensual

# --- Reglas sanidad ventas (igual que sales worker) ---
MIN_TOTAL_MESA = 1000
MAX_TOTAL_MESA = 3_000_000
VALID_TIPOS = ["BOLETA", "FACTURA"]
VALID_ESTADO = "C"

# --- Cargos/sección que cuentan como Administración de Local ---
ADMIN_CARGO_IDS: Set[int] = {10, 24, 34, 36, 45, 62}
ADMIN_SECCION = "administracion local"  # se guarda en asistencia en minúsculas en este worker

# -----------------------
# Helpers
# -----------------------
def _ym_to_dash(ym: str) -> str:
    return f"{ym[:4]}-{ym[4:6]}"

def _now() -> datetime:
    return datetime.utcnow()

def _norm_local_sigla(loc: str) -> str:
    """Normaliza siglas: quita 'LOC' y trim para comparar."""
    if not loc:
        return ""
    s = str(loc).strip()
    s = s.replace("LOC", "")
    return s

def _ensure_indexes():
    ADMIN_MONTHLY_COLL.create_index([("periodo", 1), ("rut", 1), ("local", 1)], unique=True)
    ADMIN_MONTHLY_COLL.create_index([("periodo", 1), ("local", 1), ("sales.total", -1)])
    logger.info("Índices asegurados en kpis_admin_mensual.")

# --- Sucursales helper (map id_sucursal -> sigla)
def _load_suc_map() -> Dict[int, str]:
    suc_map: Dict[int, str] = {}
    try:
        for emp in EMPRESAS.find({}, {"sucursales": 1}):
            for s in (emp.get("sucursales") or []):
                try:
                    sid = int(s.get("id_sucursal"))
                except Exception:
                    continue
                mtz = s.get("mtz") or {}
                loc = s.get("location") or {}
                sigla = (
                    (mtz.get("sigla_local") or "").strip()
                    or (loc.get("permalink_slug") or "").strip()
                    or (mtz.get("permalink_slug") or "").strip()
                )
                if sid and sigla:
                    suc_map[sid] = sigla
    except Exception:
        pass
    return suc_map

# --- Admin cargo IDs loader (mirror tiempos)
def _load_admin_cargo_ids_from_cargos() -> Set[int]:
    ids: Set[int] = set()
    try:
        for d in CARGOS.find({"seccion": {"$exists": True}}, {"id_cargo": 1, "id": 1, "seccion": 1}):
            sec = (d.get("seccion") or "").strip().lower()
            if sec == ADMIN_SECCION:
                cid = int(d.get("id_cargo") or d.get("id") or 0)
                if cid > 0:
                    ids.add(cid)
    except Exception:
        pass
    # fallback a estática si vacío
    return ids or set(ADMIN_CARGO_IDS)

# -----------------------------------------
# 1) Ventas diarias por local (a partir de restaurant_data) — agregado por día/local
#    * Dedup por (local, fecha, Mesa, Rotacion, Rut_Vendedor)
#    * Agrega por (fecha, local_norm) total/mesas/personas
# -----------------------------------------
def _build_daily_local_metrics(ym: str) -> List[Dict[str, Any]]:
    """
    Devuelve docs con shape:
      { "fecha": "YYYY-MM-DD", "local": "01" (normalizado),
        "total": float, "mesas": int, "personas": int }
    Solo días con datos válidos.
    """
    ym_int = int(ym)
    pipeline = [
        {"$addFields": {
            "local_norm": {"$replaceAll": {"input": {"$ifNull": ["$local", ""]}, "find": "LOC", "replacement": ""}},
            "fecha_norm": {"$trim": {"input": {"$ifNull": ["$Fecha", ""]}}}
        }},
        {"$match": {
            "$and": [
                {"$or": [{"mesano": ym}, {"mesano": ym_int}]},
                {"Estado": VALID_ESTADO},
                {"Tipo": {"$in": VALID_TIPOS}},
                {"Personas": {"$gte": 1}},
                {"Total": {"$gte": MIN_TOTAL_MESA, "$lte": MAX_TOTAL_MESA}}
            ]
        }},
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
        {"$group": {
            "_id": {"local": "$_id.local", "fecha": "$_id.fecha"},
            "total": {"$sum": "$TotalMesa"},
            "mesas": {"$sum": 1},
            "personas": {"$sum": "$PersonasMesa"}
        }},
        {"$project": {
            "_id": 0,
            "fecha": "$_id.fecha",
            "local": "$_id.local",
            "total": {"$round": ["$total", 2]},
            "mesas": 1,
            "personas": 1
        }}
    ]
    rows = list(RESTAURANT_SRC.aggregate(pipeline, allowDiskUse=True))
    logger.info(f"[admins_kpis] daily_local rows restaurant_data para {ym}: {len(rows)}")
    return [r for r in rows if (r.get("total", 0) > 0 and r.get("mesas", 0) > 0)]

# -----------------------------------------
# 2) Index de asistencia: (fecha, local*) -> set(ruts_admin)
# -----------------------------------------
def _build_asistencia_index(ym: str) -> Dict[Tuple[str, str], Set[str]]:
    """
    Devuelve un índice {(fecha_YYYY-MM-DD, local_sigla): set(ruts_admin)}.
    Considera seccion == 'administracion local' o id_cargo en ADMIN_CARGO_IDS.
    """
    periodo_int = int(ym)
    idx: Dict[Tuple[str, str], Set[str]] = {}

    cur = ASISTENCIA_SRC.find(
        {"periodo": periodo_int, "tipo_movimiento": "PTE"},
        {"fecha_trabajada": 1, "local": 1, "sigla_local": 1, "id_sucursal": 1, "rut": 1, "id_cargo_ficha": 1, "id_cargo": 1, "seccion": 1}
    )
    suc_map = _load_suc_map()
    admin_ids = _load_admin_cargo_ids_from_cargos()

    for doc in cur:
        rut = str(doc.get("rut") or "").strip()
        if not rut:
            continue
        seccion = str(doc.get("seccion") or "").strip().lower()
        idc = int(doc.get("id_cargo_ficha") or doc.get("id_cargo") or 0)
        if (seccion == ADMIN_SECCION) or (idc in admin_ids):
            fday_raw = doc.get("fecha_trabajada")
            if hasattr(fday_raw, "strftime"):
                fday = fday_raw.strftime("%Y-%m-%d")
            else:
                fday = str(fday_raw or "").strip()
            if not fday:
                continue
            if len(fday) == 8 and fday.isdigit():
                fday = f"{fday[:4]}-{fday[4:6]}-{fday[6:]}"
            loc_raw = str(doc.get("sigla_local") or doc.get("local") or "").strip()
            if not loc_raw:
                sid = doc.get("id_sucursal")
                try:
                    loc_raw = suc_map.get(int(sid)) or ""
                except Exception:
                    loc_raw = ""
            loc_norm = _norm_local_sigla(loc_raw)
            for key_loc in {loc_raw, loc_norm, loc_raw.upper(), loc_norm.upper()}:
                if not key_loc:
                    continue
                idx.setdefault((fday, key_loc), set()).add(rut)
    logger.info(f"[admins_kpis] asistencia index llaves: {len(idx)} para {ym}")
    return idx

def _build_presence_days(asis_idx: Dict[Tuple[str, str], Set[str]]) -> Dict[Tuple[str, str], Set[str]]:
    """
    Convierte el índice (fecha, local_variante)->ruts en (local_norm, rut)->{fechas_asistidas}.
    Cuenta TODOS los días presentes (no depende de ventas).
    """
    presence: Dict[Tuple[str, str], Set[str]] = {}
    for (fday, loc_key), ruts in asis_idx.items():
        loc_norm = _norm_local_sigla(loc_key)
        if not loc_norm:
            continue
        for rut in ruts:
            presence.setdefault((loc_norm, rut), set()).add(fday)
    return presence

# -----------------------------------------
# 3) Categorías para un admin-local: suma por familia/subfamilia (total/cantidad)
# -----------------------------------------
def _compute_categories_for_admin(ym: str, loc_norm: str, fechas: Set[str]) -> List[Dict[str, Any]]:
    if not fechas:
        return []
    ym_int = int(ym)
    fechas_list = sorted(list(fechas))
    pipeline = [
        {"$addFields": {
            "local_norm": {"$replaceAll": {"input": {"$ifNull": ["$local", ""]}, "find": "LOC", "replacement": ""}},
            "fecha_norm": {"$trim": {"input": {"$ifNull": ["$Fecha", ""]}}}
        }},
        {"$match": {
            "$and": [
                {"$or": [{"mesano": ym}, {"mesano": ym_int}]},
                {"Estado": VALID_ESTADO},
                {"Tipo": {"$in": VALID_TIPOS}},
                {"fecha_norm": {"$in": fechas_list}},
                {"local_norm": loc_norm}
            ]
        }},
        {"$unwind": "$Productos"},
        {"$group": {
            "_id": {"familia": "$Productos.Familia", "subfamilia": "$Productos.Subfamilia"},
            "total": {"$sum": {"$ifNull": ["$Productos.Total_Producto", 0]}},
            "cantidad": {"$sum": {"$ifNull": ["$Productos.Cantidad", 0]}}
        }},
        {"$project": {
            "_id": 0,
            "familia": {"$ifNull": ["$_id.familia", ""]},
            "subfamilia": {"$ifNull": ["$_id.subfamilia", ""]},
            "total": {"$round": ["$total", 2]},
            "cantidad": 1
        }}
    ]
    rows = list(RESTAURANT_SRC.aggregate(pipeline, allowDiskUse=True))
    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append({
            "familia": str(r.get("familia") or ""),
            "subfamilia": str(r.get("subfamilia") or ""),
            "total": float(r.get("total") or 0),
            "cantidad": float(r.get("cantidad") or 0),
        })
    return out

# -----------------------------------------
# 4) Construcción de KPIs por admin (mensual) — BASE SIN PUESTOS
#    - days_present_admin: días presentes por asistencia (todos).
#    - samples_days: días con venta del local ∩ presente admin.
#    - sales.avg_diario = sales.total / samples_days.
# -----------------------------------------
def _build_admin_monthly_docs(ym: str) -> List[Dict[str, Any]]:
    periodo_dash = _ym_to_dash(ym)
    daily_loc = _build_daily_local_metrics(ym)
    if not daily_loc:
        logger.warning(f"[admins_kpis] daily_loc vacío para {ym}")
        return []

    asis_idx = _build_asistencia_index(ym)
    presence_days = _build_presence_days(asis_idx)  # (loc_norm, rut) -> set(fechas_asistidas)

    # Acumuladores por (local, rut) SOLO para días con venta (samples)
    acc_days_with_sales: Dict[Tuple[str, str], Set[str]] = {}
    acc_total: Dict[Tuple[str, str], float] = {}
    acc_mesas: Dict[Tuple[str, str], int] = {}
    acc_personas: Dict[Tuple[str, str], int] = {}

    # Barrido por cada día-local con ventas válidas y cruce asistencia
    for d in daily_loc:
        fday = str(d.get("fecha") or "")
        loc = _norm_local_sigla(str(d.get("local") or ""))
        if not fday or not loc:
            continue
        total = float(d.get("total") or 0)
        mesas = int(d.get("mesas") or 0)
        personas = int(d.get("personas") or 0)
        if total <= 0 or mesas <= 0:
            continue

        # Admins presentes ese día en ese local (probando variantes de sigla al buscar en asis_idx)
        admins: Set[str] = set()
        for key_loc in {loc, f"{loc}LOC", loc.upper(), f"{loc.upper()}LOC"}:
            admins |= asis_idx.get((fday, key_loc), set())
        if not admins:
            continue

        for rut in admins:
            key = (loc, rut)
            acc_days_with_sales.setdefault(key, set()).add(fday)
            acc_total[key] = acc_total.get(key, 0.0) + total
            acc_mesas[key] = acc_mesas.get(key, 0) + mesas
            acc_personas[key] = acc_personas.get(key, 0) + personas

    docs: List[Dict[str, Any]] = []
    # Considerar todos los pares (loc,rut) donde hubo presencia, aunque no haya ventas (sales.total quedará 0)
    pairs: Set[Tuple[str, str]] = set(presence_days.keys()) | set(acc_days_with_sales.keys())

    for (loc, rut) in sorted(pairs):
        days_present = len(presence_days.get((loc, rut), set()))
        days_with_sales = len(acc_days_with_sales.get((loc, rut), set()))
        total_sum = round(acc_total.get((loc, rut), 0.0), 2)
        mesas_sum = int(acc_mesas.get((loc, rut), 0))
        personas_sum = int(acc_personas.get((loc, rut), 0))

        pm_mesa = round((total_sum / mesas_sum), 2) if mesas_sum > 0 else 0.0
        pm_persona = round((total_sum / personas_sum), 2) if personas_sum > 0 else 0.0
        avg_diario = round((total_sum / days_with_sales), 2) if days_with_sales > 0 else 0.0

        # Categorías (una sola lista sales_by_category) solo si hubo días con venta
        sales_by_category = _compute_categories_for_admin(ym, loc, acc_days_with_sales.get((loc, rut), set())) if days_with_sales > 0 else []

        doc = {
            "periodo": periodo_dash,
            "rut": str(rut),
            "es_competidor": False,
            "id_cargo_historico": 0,
            "local": loc,

            # MÉTRICAS RAÍZ (shape EXACTO)
            "personas_atendidas": {
                "valor": personas_sum,
                "promedio_empresa": None,
                "promedio_local": None,
                "puesto_empresa": 0,
                "puesto_local": 0,
                "top_empresa": None,
                "top_local": None
            },
            "promedio_por_mesa": {
                "valor": pm_mesa,
                "promedio_empresa": None,
                "promedio_local": None,
                "puesto_empresa": 0,
                "puesto_local": 0,
                "top_empresa": None,
                "top_local": None
            },
            "promedio_por_persona": {
                "valor": pm_persona,
                "promedio_empresa": None,
                "promedio_local": None,
                "puesto_empresa": 0,
                "puesto_local": 0,
                "top_empresa": None,
                "top_local": None
            },

            # BLOQUE RESTAURANT (shape EXACTO)
            "restaurant": {
                "total": total_sum,
                "personas_total": personas_sum,
                "total_mesas_atendidas": mesas_sum,
                "promedio_por_mesa": pm_mesa,
                "promedio_persona": pm_persona,
                "mesas_atendidas_promedio_diario": None,
                "personas_atendidas_promedio_diario": None,
                "platos_vendidos_promedio_diario": None,
                "puesto_local": 0,
                "puesto_empresa": 0
            },

            # BLOQUE SALES — mantiene estructura; añadimos avg_diario y samples_days
            "sales": {
                "total": total_sum,
                "puesto_local": 0,
                "top_local": None,
                "promedio_local": None,
                "puesto_empresa": 0,
                "top_empresa": None,
                "promedio_empresa": None,
                "avg_diario": avg_diario,
                "puesto_empresa_samples": 0,  # se setea en ranking de presencia
                "puesto_local_samples": 0     # se setea en ranking de presencia
            },

            # CATEGORÍAS (una sola lista)
            "sales_by_category": sales_by_category,

            # TOTALES DE MESAS
            "total_mesas": {
                "valor": mesas_sum,
                "promedio_empresa": None,
                "promedio_local": None,
                "puesto_empresa": 0,
                "puesto_local": 0,
                "top_empresa": None,
                "top_local": None
            },

            "updated_at": _now(),

            # Promedio de venta diaria (valor + dias_con_venta) — igual que ejemplo de garzones
            "promedio_venta_diaria": {
                "valor": avg_diario,
                "dias_con_venta": days_with_sales,
                "promedio_empresa": None,
                "promedio_local": None,
                "puesto_empresa": 0,
                "puesto_local": 0,
                "top_empresa": None,
                "top_local": None
            },

            # Campos RAÍZ pedidas en tus ejemplos
            "days_present_admin": days_present,
            "samples_days": days_with_sales,
        }
        docs.append(doc)

    logger.info(f"[admins_kpis] admin docs construidos (base sin puestos): {len(docs)} (período {periodo_dash})")
    return docs

# -----------------------------------------
# 5) Rankings (empresa/local) y top/promedios
#    - Sales (por total)
#    - total_mesas.valor
#    - personas_atendidas.valor
#    - promedio_por_mesa.valor
#    - promedio_por_persona.valor
#    - promedio_venta_diaria.valor
#    - **Presencia**: sales.puesto_*_samples basado en days_present_admin (más días = mejor)
# -----------------------------------------
_METRICS_SPEC = [
    ("sales", "total", True, "sales"),
    ("total_mesas", "valor", True, "total_mesas"),
    ("personas_atendidas", "valor", True, "personas_atendidas"),
    ("promedio_por_mesa", "valor", True, "promedio_por_mesa"),
    ("promedio_por_persona", "valor", True, "promedio_por_persona"),
    ("promedio_venta_diaria", "valor", True, "promedio_venta_diaria"),
]

def _apply_ranks(periodo_dash: str):
    cur = list(ADMIN_MONTHLY_COLL.find({"periodo": periodo_dash}))
    if not cur:
        return

    def rank_company(items: List[Dict], path: str, field: str, higher_better: bool):
        elig = [it for it in items if ((it.get(path) or {}).get(field) or 0) > 0]
        elig.sort(key=lambda x: (x.get(path) or {}).get(field) or 0, reverse=higher_better)
        best = float(((elig[0].get(path) or {}).get(field)) if elig else 0.0)
        avg = round(sum((x.get(path) or {}).get(field) or 0 for x in elig) / len(elig), 2) if elig else 0.0
        pos = {id(it): i + 1 for i, it in enumerate(elig)}
        return pos, best, avg

    def rank_by_local(items: List[Dict], path: str, field: str, higher_better: bool):
        by_loc: Dict[str, List[Dict]] = {}
        for it in items:
            by_loc.setdefault(str(it.get("local") or ""), []).append(it)
        out_pos: Dict[int, int] = {}
        best_map: Dict[str, float] = {}
        avg_map: Dict[str, float] = {}
        for loc, arr in by_loc.items():
            elig = [x for x in arr if ((x.get(path) or {}).get(field) or 0) > 0]
            elig.sort(key=lambda x: (x.get(path) or {}).get(field) or 0, reverse=higher_better)
            best = float(((elig[0].get(path) or {}).get(field)) if elig else 0.0)
            avg = round(sum((x.get(path) or {}).get(field) or 0 for x in elig) / len(elig), 2) if elig else 0.0
            best_map[loc] = best
            avg_map[loc] = avg
            for i, x in enumerate(elig, start=1):
                out_pos[id(x)] = i
        return out_pos, best_map, avg_map

    def rank_presence_company(items: List[Dict]):
        elig = [it for it in items if int(it.get("days_present_admin") or 0) > 0]
        elig.sort(key=lambda x: int(x.get("days_present_admin") or 0), reverse=True)
        return {id(it): i + 1 for i, it in enumerate(elig)}

    def rank_presence_by_local(items: List[Dict]):
        by_loc: Dict[str, List[Dict]] = {}
        for it in items:
            by_loc.setdefault(str(it.get("local") or ""), []).append(it)
        out_pos: Dict[int, int] = {}
        for loc, arr in by_loc.items():
            elig = [x for x in arr if int(x.get("days_present_admin") or 0) > 0]
            elig.sort(key=lambda x: int(x.get("days_present_admin") or 0), reverse=True)
            for i, x in enumerate(elig, start=1):
                out_pos[id(x)] = i
        return out_pos

    ops: List[UpdateOne] = []

    # Ranks y agregados de métricas de valor
    stats: Dict[str, Any] = {}
    for path, field, higher_better, key in _METRICS_SPEC:
        company_pos, best_emp, avg_emp = rank_company(cur, path, field, higher_better)
        local_pos, best_loc_map, avg_loc_map = rank_by_local(cur, path, field, higher_better)
        stats[key] = {
            "company_pos": company_pos,
            "best_emp": best_emp,
            "avg_emp": avg_emp,
            "local_pos": local_pos,
            "best_loc_map": best_loc_map,
            "avg_loc_map": avg_loc_map,
        }

    # Ranks de presencia (días presentes, no ventas)
    pres_company_pos = rank_presence_company(cur)
    pres_local_pos = rank_presence_by_local(cur)

    # Aplicar a cada documento
    for it in cur:
        loc = str(it.get("local") or "")
        set_fields: Dict[str, Any] = {"updated_at": _now()}

        # Espejar puesto de sales en restaurant (ventas)
        sales_stat = stats["sales"]
        sales_company_pos = int(sales_stat["company_pos"].get(id(it), 0))
        sales_local_pos = int(sales_stat["local_pos"].get(id(it), 0))
        set_fields.update({
            "sales.puesto_empresa": sales_company_pos,
            "sales.puesto_local": sales_local_pos,
            "sales.top_empresa": float(sales_stat["best_emp"] or 0.0),
            "sales.promedio_empresa": float(sales_stat["avg_emp"] or 0.0),
            "sales.top_local": float(sales_stat["best_loc_map"].get(loc, 0.0) or 0.0),
            "sales.promedio_local": float(sales_stat["avg_loc_map"].get(loc, 0.0) or 0.0),
            "restaurant.puesto_empresa": sales_company_pos,
            "restaurant.puesto_local": sales_local_pos,
        })

        # Puestos por presencia → sales.puesto_*_samples
        set_fields.update({
            "sales.puesto_empresa_samples": int(pres_company_pos.get(id(it), 0)),
            "sales.puesto_local_samples": int(pres_local_pos.get(id(it), 0)),
        })

        # Resto de métricas raíz
        for path, field, _hb, key in _METRICS_SPEC:
            if key == "sales":
                continue
            st = stats[key]
            set_fields.update({
                f"{path}.puesto_empresa": int(st["company_pos"].get(id(it), 0)),
                f"{path}.puesto_local": int(st["local_pos"].get(id(it), 0)),
                f"{path}.top_empresa": float(st["best_emp"] or 0.0),
                f"{path}.promedio_empresa": float(st["avg_emp"] or 0.0),
                f"{path}.top_local": float(st["best_loc_map"].get(loc, 0.0) or 0.0),
                f"{path}.promedio_local": float(st["avg_loc_map"].get(loc, 0.0) or 0.0),
            })

        ops.append(UpdateOne({"_id": it["_id"]}, {"$set": set_fields}, upsert=False))
        if len(ops) >= 1000:
            ADMIN_MONTHLY_COLL.bulk_write(ops, ordered=False); ops = []

    if ops:
        ADMIN_MONTHLY_COLL.bulk_write(ops, ordered=False)

# -----------------------------------------
# 6) Orquestador
# -----------------------------------------
def process_period(ym: str):
    periodo_dash = _ym_to_dash(ym)
    logger.info(f"[admins_kpis] Iniciando período {ym} ({periodo_dash})")

    # Construcción base (por admin-local) — shape EXACTO
    docs = _build_admin_monthly_docs(ym)
    if not docs:
        logger.warning(f"[admins_kpis] No hay docs para {ym}")
        return

    # Escritura base
    ops = []
    for d in docs:
        key = {"periodo": d["periodo"], "local": d["local"], "rut": d["rut"]}
        ops.append(UpdateOne(key, {"$set": d}, upsert=True))
        if len(ops) >= 1000:
            ADMIN_MONTHLY_COLL.bulk_write(ops, ordered=False); ops = []
    if ops:
        ADMIN_MONTHLY_COLL.bulk_write(ops, ordered=False)
    logger.info(f"[admins_kpis] Base escrita: {len(docs)} docs")

    # Ranks empresa/local + top/promedios + presencia
    _apply_ranks(periodo_dash)

    logger.info(f"[admins_kpis] Finalizado período {ym} ({periodo_dash})")

# -----------------------------------------
# 7) Runner
# -----------------------------------------
def run_worker(periodo: Optional[str] = None):
    _ensure_indexes()
    try:
        targets: List[str] = []
        if periodo:
            if len(periodo) == 4 and periodo.isdigit():
                targets = [f"{periodo}{m:02d}" for m in range(1, 13)]
            elif len(periodo) == 6 and periodo.isdigit():
                targets = [periodo]
            else:
                raise ValueError("Formato inválido de --periodo (usa YYYYMM o YYYY)")
        else:
            today = datetime.now()
            targets.append(today.strftime("%Y%m"))
            if today.day <= 15:
                targets.append((today - relativedelta(months=1)).strftime("%Y%m"))

        targets = sorted(list(set(targets)))
        logger.info(f"[admins_kpis] Períodos a procesar: {', '.join(targets)}")
        for ym in targets:
            process_period(ym)
    except Exception as e:
        logger.exception(f"[admins_kpis] Error inesperado: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Worker KPIs de Administradores con estructura kpis_empleado_mensual.")
    parser.add_argument("--periodo", help="YYYYMM o YYYY")
    args = parser.parse_args()
    run_worker(args.periodo)
