# utils/kpis/worker_tiempos_centros.py
# SOLO DOS TABLAS DE SALIDA (mensuales):
#   - kpis_tiempos_empleado_mensual
#   - kpis_tiempos_local_mensual
#
# Ejecutar:
#   python -m utils.kpis.worker_tiempos_centros --periodo 202509
#   python -m utils.kpis.worker_tiempos_centros --periodo 2025

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Any, Set
from collections import defaultdict

from utils.web3mongo import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# --- Fuentes
# Cambiamos a la tabla consolidada por día-hora-centro con cantidad de producción
SRC_TIEMPOS = db.ventas_producto_dia_hora_cprodu
SRC_ASIST = db.asistencia_diaria_intranet
SRC_CARGOS = db.cargos_intranet
SRC_SUC = db.sucursales_mtz              # deprecated here: no longer used to map sucursales
EMPRESAS = db.empresas                   # new source for sucursales mapping
CFG_CENTROS = db.centros_produccion_config

# --- Destinos (SOLO estos dos mensuales)
DST_EMP_MONTHLY = db.kpis_tiempos_empleado_mensual
DST_LOCAL_MONTHLY = db.kpis_tiempos_local_mensual

# --- Parámetros de elegibilidad (ranking global empleado)
MIN_DAYS_FOR_RANK = 1
MIN_SAMPLES_SHARE = 1

def _load_sucursales_map_from_empresas() -> Dict[int, str]:
    """Build map id_sucursal -> sigla_local/permalink based on empresas.sucursales[] data.
    Prefer mtz.sigla_local, else location.permalink_slug, else mtz.permalink_slug.
    """
    suc_map: Dict[int, str] = {}
    try:
        # Read all empresas and merge their sucursales
        for emp in EMPRESAS.find({}, {"sucursales": 1}):
            for s in (emp.get("sucursales") or []):
                try:
                    sid = int(s.get("id_sucursal"))
                except Exception:
                    continue
                mtz = s.get("mtz") or {}
                loc = s.get("location") or {}
                sigla = (
                    (mtz.get("sigla_local") or "").strip() or
                    (loc.get("permalink_slug") or "").strip() or
                    (mtz.get("permalink_slug") or "").strip()
                )
                if sid and sigla:
                    suc_map[sid] = sigla
    except Exception:
        pass
    return suc_map

# --- Índices
def _ensure_indexes():
    DST_EMP_MONTHLY.create_index([("periodo", 1), ("rut", 1)], unique=True)
    DST_EMP_MONTHLY.create_index([("periodo", 1), ("tiempos.avg_seg", 1)])
    # Migrar índice único a incluir rut para permitir múltiples docs por local (uno por admin)
    # Borramos cualquier índice único previo estrictamente en (periodo, local)
    try:
        for ix in DST_LOCAL_MONTHLY.list_indexes():
            keys = ix.get("key") or {}
            # keys es un OrderedDict en pymongo
            items = list(keys.items())
            if len(items) == 2 and items[0][0] == "periodo" and items[0][1] == 1 and items[1][0] == "local" and items[1][1] == 1:
                DST_LOCAL_MONTHLY.drop_index(ix["name"])
    except Exception:
        pass
    DST_LOCAL_MONTHLY.create_index([("periodo", 1), ("local", 1), ("rut", 1)], unique=True)
    DST_LOCAL_MONTHLY.create_index([("periodo", 1), ("avg_seg", 1)])
    logger.info("Índices asegurados (solo mensuales).")

# --- Helpers
def _ym_to_dash(ym: str) -> str:
    return f"{ym[:4]}-{ym[4:6]}"

def _slugify(name: str) -> str:
    import re
    s = (name or "").strip().lower()
    s = s.replace("/", " ").replace(".", " ").replace("_", " ")
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

def _norm_local_sigla(sigla: str) -> str:
    sigla = (sigla or "").strip()
    return sigla[:-3] if sigla.endswith("LOC") else sigla

def _now():
    return datetime.utcnow()

# --- Config/Mapeos
def _load_centros_config() -> Dict[str, Dict[str, Set]]:
    cfg_index: Dict[str, Dict[str, Set]] = {}
    for c in CFG_CENTROS.find({"active": True}, {"centro_slug": 1, "cargo_ids": 1, "secciones": 1}):
        slug = c.get("centro_slug") or ""
        cfg_index[slug] = {
            "cargo_ids": set(int(x) for x in (c.get("cargo_ids") or []) if isinstance(x, (int, float))),
            "secciones": set(str(s).strip().lower() for s in (c.get("secciones") or []) if s),
        }
    logger.info(f"Centros activos configurados: {len(cfg_index)}")
    return cfg_index

def _load_cargos_map() -> Dict[int, str]:
    out: Dict[int, str] = {}
    for d in SRC_CARGOS.find({}, {"id_cargo": 1, "id": 1, "seccion": 1}):
        cid = int(d.get("id_cargo") or d.get("id") or 0)
        sec = (d.get("seccion") or "").strip().lower()
        if cid > 0:
            out[cid] = sec
    return out

def _load_admin_cargo_ids() -> Set[int]:
    """Return set of cargo IDs whose seccion is 'administracion local' (case-insensitive)."""
    admin_ids: Set[int] = set()
    for d in SRC_CARGOS.find({"seccion": {"$exists": True}}, {"id_cargo": 1, "id": 1, "seccion": 1}):
        sec = (d.get("seccion") or "").strip().lower()
        if sec == "administracion local":
            cid = int(d.get("id_cargo") or d.get("id") or 0)
            if cid > 0:
                admin_ids.add(cid)
    return admin_ids

def _load_asistencia_mes(ym: str, cargos_map: Dict[int, str]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    ym_int = int(ym)
    out: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    # Mapa id_sucursal -> sigla (desde empresas, no desde sucursales_mtz)
    suc_map: Dict[int, str] = _load_sucursales_map_from_empresas()

    # Solo consideramos asistencia con movimiento PTE
    cursor = SRC_ASIST.find(
        {"periodo": ym_int, "tipo_movimiento": "PTE"},
        {"rut": 1, "id_cargo_ficha": 1, "fecha_trabajada": 1, "sigla_local": 1, "local": 1, "id_sucursal": 1},
    )
    for a in cursor:
        rut = str(a.get("rut") or "")
        if not rut:
            continue
        cargo_id = int(a.get("id_cargo_ficha") or 0)
        seccion = cargos_map.get(cargo_id, "")
        fecha_raw = a.get("fecha_trabajada")
        if isinstance(fecha_raw, datetime):
            fday = fecha_raw.strftime("%Y-%m-%d")
        else:
            fday = str(fecha_raw or "").strip()[:10]
        if not fday:
            continue
        local_raw = (a.get("sigla_local") or a.get("local") or "").strip()
        if not local_raw:
            sid = a.get("id_sucursal")
            try:
                local_raw = suc_map.get(int(sid)) or ""
            except Exception:
                local_raw = ""
        if not local_raw:
            continue
        local_norm = _norm_local_sigla(local_raw)
        persona = {"rut": rut, "id_cargo": cargo_id, "seccion": seccion}
        for key in [(fday, local_raw), (fday, local_norm)]:
            out.setdefault(key, []).append(persona)
    logger.info(f"Asistencia indexada {ym}: {len(out)} llaves (fecha/local).")
    return out

# ==========================
# 1) Centro → agregados diarios (IN-MEMORY)
#    (Genera promedio y samples del CENTRO y, además, un breakdown opcional por subfamilia para los rankings de familia)
# ==========================
def build_centro_daily_inmem(ym: str) -> List[Dict[str, Any]]:
    ym_int = int(ym)
    pipeline = [
        {"$match": {"mesano": ym_int}},
        {"$addFields": {
            "local_raw": {"$ifNull": ["$local", ""]},
            "local_norm_calc": {"$replaceAll": {"input": {"$ifNull": ["$local", ""]}, "find": "LOC", "replacement": ""}},
            "centro_nombre": {"$ifNull": ["$centro_produccion", ""]},
            "familia": {"$ifNull": ["$familia", ""]},
            "subfamilia": {"$ifNull": ["$subfamilia", ""]},
            "tiempo": {"$toDouble": {"$ifNull": ["$tiempo_promedio", 0]}},
            "qty": {"$toDouble": {"$ifNull": ["$cantidad", 0]}},
        }},
        {"$addFields": {
            "local_norm": {"$ifNull": ["$local_norm", "$local_norm_calc"]}
        }},
        {"$match": {"tiempo": {"$gt": 0}, "qty": {"$gt": 0}}},
        {"$addFields": {"fecha_str": {"$toString": "$fecha"}}},
        # centro + subfamilia (para poder mantener ranking de familia)
        {"$group": {
            "_id": {
                "fecha": "$fecha_str",
                "local": "$local_raw",
                "local_norm": "$local_norm",
                "centro": "$centro_nombre",
                "subfamilia": "$subfamilia",
                "familia": "$familia",
            },
            "sum_tiempo_qty": {"$sum": {"$multiply": ["$tiempo", "$qty"]}},
            "qty_sum": {"$sum": "$qty"},
            "min_t": {"$min": "$tiempo"},
            "max_t": {"$max": "$tiempo"},
        }},
        {"$group": {
            "_id": {
                "fecha": "$_id.fecha",
                "local": "$_id.local",
                "local_norm": "$_id.local_norm",
                "centro": "$_id.centro",
            },
            "sum_tiempo_total": {"$sum": "$sum_tiempo_qty"},
            "samples_total": {"$sum": "$qty_sum"},
            "min_tiempo": {"$min": "$min_t"},
            "max_tiempo": {"$max": "$max_t"},
            "by_subfamilia": {"$push": {
                "subfamilia": "$_id.subfamilia",
                "familia": "$_id.familia",
                "samples": "$qty_sum",
                "avg_seg": {"$cond": [{"$gt": ["$qty_sum", 0]}, {"$divide": ["$sum_tiempo_qty", "$qty_sum"]}, 0]},
            }},
        }},
        {"$addFields": {
            "avg_tiempo": {"$cond": [{"$gt": ["$samples_total", 0]}, {"$divide": ["$sum_tiempo_total", "$samples_total"]}, 0]},
        }},
        {"$project": {
            "_id": 0,
            "fecha": "$_id.fecha",
            "local": "$_id.local",
            "local_norm": "$_id.local_norm",
            "centro_nombre": "$_id.centro",
            "avg_tiempo": {"$round": ["$avg_tiempo", 2]},
            "min_tiempo": {"$round": ["$min_tiempo", 2]},
            "max_tiempo": {"$round": ["$max_tiempo", 2]},
            "samples_total": 1,
            "by_subfamilia": 1,
        }},
    ]
    rows = list(SRC_TIEMPOS.aggregate(pipeline, allowDiskUse=True))
    out: List[Dict[str, Any]] = []
    for r in rows:
        cn = (r.get("centro_nombre") or "").strip()
        slug = _slugify(cn)
        out.append({
            "fecha": r["fecha"],
            "local": r["local"],
            "local_norm": r.get("local_norm"),
            "centro": {"nombre": cn, "slug": slug},
            "tiempos": {
                "avg_seg": float(r.get("avg_tiempo", 0) or 0),
                "min_seg": float(r.get("min_tiempo", 0) or 0),
                "max_seg": float(r.get("max_tiempo", 0) or 0),
                "samples": int(r.get("samples_total", 0) or 0),
            },
            # seguimos guardando subfamilia para los rankings por familia
            "by_subfamilia": r.get("by_subfamilia", []),
        })
    return out



# ==========================
# 2) Atribución diaria a empleados (IN-MEMORY)
#    (ahora genera by_centro + by_subfamilia en cada fila diaria de empleado)
# ==========================
def attribute_daily_inmem(centro_daily: List[Dict[str, Any]],
                          centros_cfg: Dict[str, Dict[str, Set]],
                          asis_idx: Dict[Tuple[str, str], List[Dict[str, Any]]],
                          admin_cargo_ids: Set[int]) -> List[Dict[str, Any]]:
    emp_daily: List[Dict[str, Any]] = []
    # Para evitar duplicados rut-fecha-local
    seen_triplets: Set[Tuple[str, str, str]] = set()
    # Promedio por día-local (para admins)
    day_loc_acc = defaultdict(lambda: {"sum_w": 0.0, "samples": 0})
    for cd in centro_daily:
        fecha = cd.get("fecha")
        local_raw = cd.get("local")
        local_norm = cd.get("local_norm") or _norm_local_sigla(local_raw)
        centro_slug = (cd.get("centro") or {}).get("slug", "")
        centro_nombre = (cd.get("centro") or {}).get("nombre", "")
        if not (fecha and local_raw and centro_slug):
            continue

        cfg = centros_cfg.get(centro_slug)
        if not cfg:
            continue

        candidatos = (asis_idx.get((fecha, local_raw)) or []) + (asis_idx.get((fecha, local_norm)) or [])
        if not candidatos:
            continue

        compats = []
        for p in candidatos:
            cid = int(p.get("id_cargo") or 0)
            sec = (p.get("seccion") or "").strip().lower()
            if (cid in cfg["cargo_ids"]) or (sec and sec in cfg["secciones"]):
                compats.append(p)
        if not compats:
            continue

        samples_total = int(((cd.get("tiempos") or {}).get("samples")) or 0)
        avg_seg_day = float(((cd.get("tiempos") or {}).get("avg_seg")) or 0)
        if avg_seg_day <= 0 or samples_total <= 0:
            continue

        share_total_emp = samples_total / max(1, len(compats))

        # acumular para promedio del día-local
        day_loc_acc[(fecha, local_raw)]["sum_w"] += avg_seg_day * samples_total
        day_loc_acc[(fecha, local_raw)]["samples"] += samples_total

        # breakdown por subfamilia (para ranking familia)
        bysf = cd.get("by_subfamilia") or []
        sum_sf_samples = sum(int(s.get("samples") or 0) for s in bysf) or 1

        for p in compats:
            rut = str(p["rut"])

            # contribución por centro (NUEVO)
            centro_contrib = [{
                "centro_slug": centro_slug,
                "centro_nombre": centro_nombre,
                "avg_seg": avg_seg_day,
                "samples_share": float(share_total_emp),
            }]

            # contribuciones por subfamilia (se mantienen)
            sf_contribs = []
            for s in bysf:
                sf_sam = int(s.get("samples") or 0)
                sf_avg = float(s.get("avg_seg") or 0)
                if sf_sam <= 0 or sf_avg <= 0:
                    continue
                sf_ratio = sf_sam / max(1, sum_sf_samples)
                sf_share_emp = share_total_emp * sf_ratio
                sf_contribs.append({
                    "subfamilia": s.get("subfamilia"),
                    "familia": s.get("familia"),
                    "avg_seg": sf_avg,
                    "samples_share": float(sf_share_emp),
                })

            emp_daily.append({
                "fecha": fecha,
                "local": local_raw,
                "rut": rut,
                "id_cargo_historico": int(p.get("id_cargo") or 0),
                "es_competidor": True,
                "centro": {"nombre": centro_nombre, "slug": centro_slug},
                "tiempos": {
                    "avg_seg": avg_seg_day,
                    "samples_share": float(share_total_emp),
                },
                "by_centro": centro_contrib,       # NUEVO
                "by_subfamilia": sf_contribs,      # para rankings de familia
            })
            seen_triplets.add((fecha, local_raw, rut))
    logger.info(f"Atribuciones diarias en memoria: {len(emp_daily)} filas")
    # Segunda pasada: sumar administradores (seccion 'administracion local') por RUT usando el promedio del día-local
    added_admins = 0
    for (fecha, local_raw), v in day_loc_acc.items():
        total_samples = v["samples"]
        if total_samples <= 0:
            continue
        avg_day_loc = v["sum_w"] / total_samples
        # buscar por claves raw y normalizada
        loc_norm = _norm_local_sigla(local_raw)
        candis = (asis_idx.get((fecha, local_raw)) or []) + (asis_idx.get((fecha, loc_norm)) or [])
        for p in candis:
            sec_p = (p.get("seccion") or "").strip().lower()
            idc = int(p.get("id_cargo") or 0)
            if not (sec_p == "administracion local" or (idc in admin_cargo_ids)):
                continue
            rut = str(p.get("rut") or "").strip()
            if not rut or (fecha, local_raw, rut) in seen_triplets:
                continue
            emp_daily.append({
                "fecha": fecha,
                "local": local_raw,
                "rut": rut,
                "id_cargo_historico": int(p.get("id_cargo") or 0),
                "es_competidor": True,
                "centro": {"nombre": "", "slug": ""},
                "tiempos": {
                    # damos 1 unidad de samples_share por día con asistencia PTE
                    "avg_seg": float(avg_day_loc),
                    "samples_share": 1.0,
                },
                "by_centro": [],
                "by_subfamilia": [],
            })
            seen_triplets.add((fecha, local_raw, rut))
            added_admins += 1
    if added_admins:
        logger.info(f"Administradores agregados (por RUT) a atribuciones diarias: {added_admins}")
    return emp_daily