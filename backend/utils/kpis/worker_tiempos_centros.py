# utils/kpis/worker_tiempos_centros.py
# SOLO DOS TABLAS DE SALIDA (mensuales):
#   - kpis_tiempos_empleado_mensual
#   - kpis_tiempos_local_mensual
#
# Ejecutar:
#   python -m utils.kpis.worker_tiempos_centros --periodo 202509
#   python -m utils.kpis.worker_tiempos_centros --periodo 2025

import argparse
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any, Set
from collections import defaultdict

from pymongo import UpdateOne
from dateutil.relativedelta import relativedelta

from utils.web3mongo import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# --- Fuentes
SRC_TIEMPOS = db.ventas_hora_tiempo_promedio
SRC_ASIST = db.asistencia_diaria_intranet
SRC_CARGOS = db.cargos_intranet
SRC_SUC = db.sucursales_mtz              # opcional: id_sucursal -> sigla
CFG_CENTROS = db.centros_produccion_config

# --- Destinos (SOLO estos dos mensuales)
DST_EMP_MONTHLY = db.kpis_tiempos_empleado_mensual
DST_LOCAL_MONTHLY = db.kpis_tiempos_local_mensual

# --- Parámetros de elegibilidad (ranking global empleado)
MIN_DAYS_FOR_RANK = 1
MIN_SAMPLES_SHARE = 1

# --- Índices
def _ensure_indexes():
    DST_EMP_MONTHLY.create_index([("periodo", 1), ("rut", 1)], unique=True)
    DST_EMP_MONTHLY.create_index([("periodo", 1), ("tiempos.avg_seg", 1)])
    DST_LOCAL_MONTHLY.create_index([("periodo", 1), ("local", 1)], unique=True)
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

def _load_asistencia_mes(ym: str, cargos_map: Dict[int, str]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    ym_int = int(ym)
    out: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    # Mapa id_sucursal -> sigla
    suc_map: Dict[int, str] = {}
    try:
        for s in SRC_SUC.find({}, {"id": 1, "sigla_local": 1, "permalink_slug": 1}):
            sid = s.get("id")
            if sid is None:
                continue
            try:
                sid_int = int(sid)
            except Exception:
                continue
            sigla = (s.get("sigla_local") or s.get("permalink_slug") or "").strip()
            if sigla:
                suc_map[sid_int] = sigla
    except Exception:
        pass

    cursor = SRC_ASIST.find(
        {"periodo": ym_int},
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
        {"$match": {"MESANO": ym_int}},
        {"$addFields": {
            "local_raw": {"$ifNull": ["$LOCAL", ""]},
            "local_norm": {"$replaceAll": {"input": {"$ifNull": ["$LOCAL", ""]}, "find": "LOC", "replacement": ""}},
            "fecha_date": {"$toDate": "$FECHA"},
            "centro_nombre": {"$ifNull": ["$CENTROPRODUCCION", ""]},
            "familia": {"$ifNull": ["$FAMILIA", ""]},
            "subfamilia": {"$ifNull": ["$SUBFAMILIA", ""]},
            "tiempo": {"$toDouble": {"$ifNull": ["$TIEMPO", 0]}},
        }},
        {"$match": {"tiempo": {"$gt": 0}}},
        {"$addFields": {"fecha_str": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_date"}}}},
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
            "sum_tiempo": {"$sum": "$tiempo"},
            "cnt": {"$sum": 1},
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
            "sum_tiempo_total": {"$sum": "$sum_tiempo"},
            "samples_total": {"$sum": "$cnt"},
            "min_tiempo": {"$min": "$min_t"},
            "max_tiempo": {"$max": "$max_t"},
            "by_subfamilia": {"$push": {
                "subfamilia": "$_id.subfamilia",
                "familia": "$_id.familia",
                "samples": "$cnt",
                "avg_seg": {"$divide": ["$sum_tiempo", "$cnt"]},
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
                          asis_idx: Dict[Tuple[str, str], List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    emp_daily: List[Dict[str, Any]] = []
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
    logger.info(f"Atribuciones diarias en memoria: {len(emp_daily)} filas")
    return emp_daily

# ==========================
# 3) Agregado mensual EMPLEADO (en memoria) + RANKS
#    (general + by_centro + by_subfamilia/by_familia)
# ==========================
def build_employee_monthly_write(ym: str, emp_daily: List[Dict[str, Any]]):
    periodo_dash = _ym_to_dash(ym)

    # --- acumuladores
    agg_emp: Dict[Tuple[str, str], Dict[str, Any]] = {}
    agg_centro: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    agg_sf: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    agg_fam: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    for d in emp_daily:
        key = (d["rut"], d["local"])
        a = agg_emp.setdefault(key, {
            "rut": d["rut"],
            "local": d["local"],
            "id_cargo_historico": d.get("id_cargo_historico") or 0,
            "days": set(),
            "sum_samples_share": 0.0,
            "sum_avg_weighted": 0.0,
            "best_day_seg": None,
        })
        a["days"].add(d["fecha"])
        sshare = float(((d.get("tiempos") or {}).get("samples_share")) or 0)
        avgd = float(((d.get("tiempos") or {}).get("avg_seg")) or 0)
        a["sum_samples_share"] += sshare
        a["sum_avg_weighted"] += (avgd * sshare)
        a["best_day_seg"] = min(a["best_day_seg"], avgd) if a["best_day_seg"] is not None else avgd

        # centros
        for c in (d.get("by_centro") or []):
            cslug = str(c.get("centro_slug") or "")
            cn = str(c.get("centro_nombre") or "")
            if not cslug:
                continue
            kc = (d["rut"], d["local"], cslug)
            bc = agg_centro.setdefault(kc, {
                "rut": d["rut"], "local": d["local"], "centro_slug": cslug, "centro_nombre": cn,
                "days": set(), "sum_samples_share": 0.0, "sum_avg_weighted": 0.0
            })
            bc["days"].add(d["fecha"])
            bc["sum_samples_share"] += float(c.get("samples_share") or 0)
            bc["sum_avg_weighted"] += float(c.get("avg_seg") or 0) * float(c.get("samples_share") or 0)

        # subfamilias (para familia)
        for s in (d.get("by_subfamilia") or []):
            sf = str(s.get("subfamilia") or "")
            fam = str(s.get("familia") or "")
            if not sf:
                continue
            key_sf = (d["rut"], d["local"], sf)
            b = agg_sf.setdefault(key_sf, {
                "rut": d["rut"], "local": d["local"], "subfamilia": sf, "familia": fam,
                "days": set(), "sum_samples_share": 0.0, "sum_avg_weighted": 0.0
            })
            b["days"].add(d["fecha"])
            b["sum_samples_share"] += float(s.get("samples_share") or 0)
            b["sum_avg_weighted"] += float(s.get("avg_seg") or 0) * float(s.get("samples_share") or 0)

            if fam:
                key_fam = (d["rut"], d["local"], fam)
                c = agg_fam.setdefault(key_fam, {
                    "rut": d["rut"], "local": d["local"], "familia": fam,
                    "days": set(), "sum_samples_share": 0.0, "sum_avg_weighted": 0.0
                })
                c["days"].add(d["fecha"])
                c["sum_samples_share"] += float(s.get("samples_share") or 0)
                c["sum_avg_weighted"] += float(s.get("avg_seg") or 0) * float(s.get("samples_share") or 0)

    # --- construir docs base
    docs_emp: List[Dict[str, Any]] = []
    for (rut, local), a in agg_emp.items():
        sum_share = a["sum_samples_share"]
        avg_seg = (a["sum_avg_weighted"] / sum_share) if sum_share > 0 else 0.0
        docs_emp.append({
            "periodo": periodo_dash,
            "rut": rut,
            "local": local,
            "id_cargo_historico": int(a["id_cargo_historico"] or 0),
            "tiempos": {
                "avg_seg": round(avg_seg, 2),
                "best_day_seg": round(a["best_day_seg"] or 0, 2),
                "dias_con_registro": len(a["days"]),
                "samples_share": round(sum_share, 4),
                "puesto_empresa": 0,
                "puesto_local": 0,
                "best_empresa": 0.0,
                "avg_empresa": 0.0,
                "best_local": 0.0,
                "avg_local": 0.0,
            },
            "by_centro": [],      # NUEVO
            "by_subfamilia": [],  # se mantiene
            "by_familia": [],
            "es_competidor": False,
            "updated_at": _now(),
        })

    # índices auxiliares
    idx_emp = {(d["rut"], d["local"]): d for d in docs_emp}

    # --- centros embebidos (sin avg 0)
    for key, bc in agg_centro.items():
        rut, local, cslug = key
        sum_share = bc["sum_samples_share"]
        if (rut, local) not in idx_emp or sum_share <= 0:
            continue
        avg_val = (bc["sum_avg_weighted"] / sum_share) if sum_share > 0 else None
        if not avg_val or avg_val <= 0:
            continue
        item = {
            "centro_slug": bc["centro_slug"],
            "centro_nombre": bc["centro_nombre"],
            "avg_seg": round(avg_val, 2),
            "samples_share": round(sum_share, 4),
            "dias_con_registro": len(bc["days"]),
            "puesto_empresa": 0,
            "puesto_local": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
            "best_local": 0.0,
            "avg_local": 0.0,
        }
        idx_emp[(rut, local)]["by_centro"].append(item)

    # --- subfamilias/familias embebidas (igual que antes, sin avg 0)
    for key, b in agg_sf.items():
        rut, local, sf = key
        sum_share = b["sum_samples_share"]
        if (rut, local) not in idx_emp or sum_share <= 0:
            continue
        avg_val = (b["sum_avg_weighted"] / sum_share) if sum_share > 0 else None
        if not avg_val or avg_val <= 0:
            continue
        item = {
            "subfamilia": b["subfamilia"],
            "familia": b["familia"],
            "avg_seg": round(avg_val, 2),
            "samples_share": round(sum_share, 4),
            "dias_con_registro": len(b["days"]),
            "puesto_empresa": 0,
            "puesto_local": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
            "best_local": 0.0,
            "avg_local": 0.0,
        }
        idx_emp[(rut, local)]["by_subfamilia"].append(item)

    for key, c in agg_fam.items():
        rut, local, fam = key
        sum_share = c["sum_samples_share"]
        if (rut, local) not in idx_emp or sum_share <= 0:
            continue
        avg_val = (c["sum_avg_weighted"] / sum_share) if sum_share > 0 else None
        if not avg_val or avg_val <= 0:
            continue
        item = {
            "familia": c["familia"],
            "avg_seg": round(avg_val, 2),
            "samples_share": round(sum_share, 4),
            "dias_con_registro": len(c["days"]),
            "puesto_empresa": 0,
            "puesto_local": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
            "best_local": 0.0,
            "avg_local": 0.0,
        }
        idx_emp[(rut, local)]["by_familia"].append(item)

    # --- RANKS generales (empleado)
    eligibles = [d for d in docs_emp if d["tiempos"]["dias_con_registro"] >= MIN_DAYS_FOR_RANK
                 and d["tiempos"]["samples_share"] >= MIN_SAMPLES_SHARE
                 and d["tiempos"]["avg_seg"] > 0]

    # empresa
    elig_sorted = sorted(eligibles, key=lambda x: x["tiempos"]["avg_seg"])
    if elig_sorted:
        best_emp = elig_sorted[0]["tiempos"]["avg_seg"]
        avg_emp = round(sum(x["tiempos"]["avg_seg"] for x in elig_sorted) / len(elig_sorted), 2)
    else:
        best_emp = 0.0
        avg_emp = 0.0
    for i, d in enumerate(elig_sorted, start=1):
        d["tiempos"]["puesto_empresa"] = i
        d["tiempos"]["best_empresa"] = best_emp
        d["tiempos"]["avg_empresa"] = avg_emp
        d["es_competidor"] = True

    # local
    by_local = defaultdict(list)
    for d in elig_sorted:
        by_local[d["local"]].append(d)
    for loc, arr in by_local.items():
        arr.sort(key=lambda x: x["tiempos"]["avg_seg"])
        best_loc = arr[0]["tiempos"]["avg_seg"]
        avg_loc = round(sum(x["tiempos"]["avg_seg"] for x in arr) / len(arr), 2)
        for rank, d in enumerate(arr, start=1):
            d["tiempos"]["puesto_local"] = rank
            d["tiempos"]["best_local"] = best_loc
            d["tiempos"]["avg_local"] = avg_loc

    # --- RANKS por CENTRO (empresa + local)
    # empresa
    centro_pool = []
    for d in docs_emp:
        for it in d.get("by_centro", []):
            if it.get("avg_seg") and it["avg_seg"] > 0:
                centro_pool.append((d["rut"], d["local"], it["centro_slug"], it))
    by_centro_emp = defaultdict(list)
    for rut, loc, cslug, it in centro_pool:
        by_centro_emp[cslug].append((rut, loc, it))
    for cslug, arr in by_centro_emp.items():
        arr.sort(key=lambda x: x[2]["avg_seg"])
        best = arr[0][2]["avg_seg"]
        avg = round(sum(x[2]["avg_seg"] for x in arr) / len(arr), 2)
        for rank, (rut, loc, it) in enumerate(arr, start=1):
            for target in idx_emp[(rut, loc)]["by_centro"]:
                if target["centro_slug"] == cslug:
                    target["puesto_empresa"] = rank
                    target["best_empresa"] = best
                    target["avg_empresa"] = avg
                    break
    # local
    by_centro_loc = defaultdict(lambda: defaultdict(list))
    for rut, loc, cslug, it in centro_pool:
        by_centro_loc[cslug][loc].append((rut, it))
    for cslug, locmap in by_centro_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1]["avg_seg"])
            best = arr[0][1]["avg_seg"]
            avg = round(sum(x[1]["avg_seg"] for x in arr) / len(arr), 2)
            for rank, (rut, it) in enumerate(arr, start=1):
                for target in idx_emp[(rut, loc)]["by_centro"]:
                    if target["centro_slug"] == cslug:
                        target["puesto_local"] = rank
                        target["best_local"] = best
                        target["avg_local"] = avg
                        break

    # --- RANKS por SUBFAMILIA (empresa + local) [se mantiene]
    docs_for_cat = [d for d in docs_emp if d["tiempos"]["avg_seg"] > 0]
    sf_pool = []
    for d in docs_for_cat:
        for it in d["by_subfamilia"]:
            if it.get("avg_seg") and it["avg_seg"] > 0:
                sf_pool.append((d["rut"], d["local"], it["subfamilia"], it))

    by_sf_emp = defaultdict(list)
    for rut, loc, sf, it in sf_pool:
        by_sf_emp[sf].append((rut, loc, it))
    for sf, arr in by_sf_emp.items():
        arr.sort(key=lambda x: x[2]["avg_seg"])
        best = arr[0][2]["avg_seg"]
        avg = round(sum(x[2]["avg_seg"] for x in arr) / len(arr), 2)
        for rank, (rut, loc, it) in enumerate(arr, start=1):
            for target in idx_emp[(rut, loc)]["by_subfamilia"]:
                if target["subfamilia"] == sf:
                    target["puesto_empresa"] = rank
                    target["best_empresa"] = best
                    target["avg_empresa"] = avg
                    break

    by_sf_loc = defaultdict(lambda: defaultdict(list))
    for rut, loc, sf, it in sf_pool:
        by_sf_loc[sf][loc].append((rut, it))
    for sf, locmap in by_sf_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1]["avg_seg"])
            best = arr[0][1]["avg_seg"]
            avg = round(sum(x[1]["avg_seg"] for x in arr) / len(arr), 2)
            for rank, (rut, it) in enumerate(arr, start=1):
                for target in idx_emp[(rut, loc)]["by_subfamilia"]:
                    if target["subfamilia"] == sf:
                        target["puesto_local"] = rank
                        target["best_local"] = best
                        target["avg_local"] = avg
                        break

    # --- RANKS por FAMILIA (empresa + local) [se mantiene]
    fam_pool = []
    for d in docs_for_cat:
        for it in d["by_familia"]:
            if it.get("avg_seg") and it["avg_seg"] > 0:
                fam_pool.append((d["rut"], d["local"], it["familia"], it))

    by_fam_emp = defaultdict(list)
    for rut, loc, fam, it in fam_pool:
        by_fam_emp[fam].append((rut, loc, it))
    for fam, arr in by_fam_emp.items():
        arr.sort(key=lambda x: x[2]["avg_seg"])
        best = arr[0][2]["avg_seg"]
        avg = round(sum(x[2]["avg_seg"] for x in arr) / len(arr), 2)
        for rank, (rut, loc, it) in enumerate(arr, start=1):
            for target in idx_emp[(rut, loc)]["by_familia"]:
                if target["familia"] == fam:
                    target["puesto_empresa"] = rank
                    target["best_empresa"] = best
                    target["avg_empresa"] = avg
                    break

    by_fam_loc = defaultdict(lambda: defaultdict(list))
    for rut, loc, fam, it in fam_pool:
        by_fam_loc[fam][loc].append((rut, it))
    for fam, locmap in by_fam_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1]["avg_seg"])
            best = arr[0][1]["avg_seg"]
            avg = round(sum(x[1]["avg_seg"] for x in arr) / len(arr), 2)
            for rank, (rut, it) in enumerate(arr, start=1):
                for target in idx_emp[(rut, loc)]["by_familia"]:
                    if target["familia"] == fam:
                        target["puesto_local"] = rank
                        target["best_local"] = best
                        target["avg_local"] = avg
                        break

    # --- escritura
    ops: List[UpdateOne] = []
    for d in docs_emp:
        ops.append(UpdateOne({"periodo": periodo_dash, "rut": d["rut"]}, {"$set": d}, upsert=True))
        if len(ops) >= 1000:
            DST_EMP_MONTHLY.bulk_write(ops, ordered=False); ops = []
    if ops:
        DST_EMP_MONTHLY.bulk_write(ops, ordered=False)
    logger.info(f"[empleado_mensual] escritos {len(docs_emp)} docs")

# ==========================
# 4) Agregado mensual LOCAL (en memoria) + RANKS
#    (general local + by_centro con ranking empresa entre locales; se mantienen subfamilias por compatibilidad)
# ==========================
def build_local_monthly_write(ym: str, centro_daily: List[Dict[str, Any]]):
    periodo_dash = _ym_to_dash(ym)

    # general local
    acc_loc = defaultdict(lambda: {"sum_w": 0.0, "samples": 0})
    # centro por local (NUEVO)
    acc_loc_centro = defaultdict(lambda: {"sum_w": 0.0, "samples": 0, "centro_nombre": None})
    # subfamilia por local (para compatibilidad de familia)
    acc_loc_sf = defaultdict(lambda: {"sum_w": 0.0, "samples": 0, "familia": None})

    for d in centro_daily:
        loc = d["local"]
        samples = int(((d.get("tiempos") or {}).get("samples")) or 0)
        avg = float(((d.get("tiempos") or {}).get("avg_seg")) or 0)
        if samples <= 0 or avg <= 0:
            continue

        # general local
        acc_loc[loc]["sum_w"] += samples * avg
        acc_loc[loc]["samples"] += samples

        # centro
        cslug = (d.get("centro") or {}).get("slug", "")
        cn = (d.get("centro") or {}).get("nombre", "")
        if cslug:
            keyc = (loc, cslug)
            acc_loc_centro[keyc]["sum_w"] += samples * avg
            acc_loc_centro[keyc]["samples"] += samples
            acc_loc_centro[keyc]["centro_nombre"] = cn

        # subfamilias (compatibilidad)
        for s in (d.get("by_subfamilia") or []):
            sf = str(s.get("subfamilia") or "")
            fam = str(s.get("familia") or "")
            sf_avg = float(s.get("avg_seg") or 0)
            sf_sam = int(s.get("samples") or 0)
            if not sf or sf_sam <= 0 or sf_avg <= 0:
                continue
            key = (loc, sf)
            acc_loc_sf[key]["sum_w"] += sf_avg * sf_sam
            acc_loc_sf[key]["samples"] += sf_sam
            acc_loc_sf[key]["familia"] = fam

    # construir base local
    docs_local: List[Dict[str, Any]] = []
    for loc, v in acc_loc.items():
        samples = v["samples"]
        avg_seg = (v["sum_w"]/samples) if samples > 0 else None
        docs_local.append({
            "periodo": periodo_dash,
            "local": loc,
            "samples_total": samples,
            "avg_seg": round(avg_seg, 2) if (avg_seg and avg_seg > 0) else None,
            "puesto_empresa": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
            "by_centro": [],      # NUEVO
            "by_subfamilia": [],  # compatibilidad
            "updated_at": _now(),
        })
    idx_loc = {d["local"]: d for d in docs_local}

    # by_centro embebido + ranking EMPRESA entre locales (solo avg > 0)
    tmp_by_centro = defaultdict(list)  # cslug -> [(local, avg)]
    for (loc, cslug), v in acc_loc_centro.items():
        samples = v["samples"]
        avg_c = (v["sum_w"]/samples) if samples > 0 else None
        if not avg_c or avg_c <= 0:
            continue
        item = {
            "centro_slug": cslug,
            "centro_nombre": v["centro_nombre"],
            "samples_total": samples,
            "avg_seg": round(avg_c, 2),
            "puesto_empresa": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
        }
        if loc in idx_loc:
            idx_loc[loc]["by_centro"].append(item)
        tmp_by_centro[cslug].append((loc, round(avg_c, 2)))

    # subfamilia embebida (compatibilidad) con rank empresa
    tmp_by_sf = defaultdict(list)  # sf -> [(local, avg)]
    for (loc, sf), v in acc_loc_sf.items():
        samples = v["samples"]
        avg_sf = (v["sum_w"]/samples) if samples > 0 else None
        if not avg_sf or avg_sf <= 0:
            continue
        item = {
            "subfamilia": sf,
            "familia": v["familia"],
            "samples_total": samples,
            "avg_seg": round(avg_sf, 2),
            "puesto_empresa": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
        }
        if loc in idx_loc:
            idx_loc[loc]["by_subfamilia"].append(item)
        tmp_by_sf[sf].append((loc, round(avg_sf, 2)))

    # rank empresa (general local) — solo locales con avg_seg > 0
    elig_loc = [d for d in docs_local if d["avg_seg"] is not None and d["avg_seg"] > 0 and d["samples_total"] > 0]
    elig_loc.sort(key=lambda x: x["avg_seg"])
    if elig_loc:
        best_emp = elig_loc[0]["avg_seg"]
        avg_emp = round(sum(x["avg_seg"] for x in elig_loc)/len(elig_loc), 2)
    else:
        best_emp = 0.0; avg_emp = 0.0
    for rank, d in enumerate(elig_loc, start=1):
        d["puesto_empresa"] = rank
        d["best_empresa"] = best_emp
        d["avg_empresa"] = avg_emp

    # rank empresa por centro entre locales
    for cslug, arr in tmp_by_centro.items():
        arr.sort(key=lambda x: x[1])
        best = arr[0][1]
        avg = round(sum(x[1] for x in arr)/len(arr), 2)
        pos = {loc: i+1 for i, (loc, _) in enumerate(arr)}
        for loc, doc in idx_loc.items():
            for it in doc["by_centro"]:
                if it["centro_slug"] == cslug and it["avg_seg"] is not None and it["avg_seg"] > 0:
                    it["puesto_empresa"] = pos.get(loc, 0)
                    it["best_empresa"] = best
                    it["avg_empresa"] = avg

    # rank empresa por subfamilia entre locales (compatibilidad existente)
    for sf, arr in tmp_by_sf.items():
        arr.sort(key=lambda x: x[1])
        best = arr[0][1]
        avg = round(sum(x[1] for x in arr)/len(arr), 2)
        pos = {loc: i+1 for i, (loc, _) in enumerate(arr)}
        for loc, doc in idx_loc.items():
            for it in doc["by_subfamilia"]:
                if it["subfamilia"] == sf and it["avg_seg"] is not None and it["avg_seg"] > 0:
                    it["puesto_empresa"] = pos.get(loc, 0)
                    it["best_empresa"] = best
                    it["avg_empresa"] = avg

    # escritura
    ops: List[UpdateOne] = []
    for d in docs_local:
        ops.append(UpdateOne({"periodo": periodo_dash, "local": d["local"]}, {"$set": d}, upsert=True))
        if len(ops) >= 1000:
            DST_LOCAL_MONTHLY.bulk_write(ops, ordered=False); ops = []
    if ops:
        DST_LOCAL_MONTHLY.bulk_write(ops, ordered=False)
    logger.info(f"[local_mensual] escritos {len(docs_local)} docs")

# ==========================
# 5) Orquestador
# ==========================
def process_period(ym: str):
    logger.info(f"--- Tiempos {ym} ({_ym_to_dash(ym)}) ---")
    centros_cfg = _load_centros_config()
    cargos_map = _load_cargos_map()
    asis_idx = _load_asistencia_mes(ym, cargos_map)

    centro_daily = build_centro_daily_inmem(ym)            # in-memory
    emp_daily = attribute_daily_inmem(centro_daily, centros_cfg, asis_idx)  # in-memory

    build_employee_monthly_write(ym, emp_daily)            # write mensual empleado
    build_local_monthly_write(ym, centro_daily)            # write mensual local

    logger.info(f"--- Período {ym} finalizado. ---")

def run_worker(periodo: Optional[str] = None):
    _ensure_indexes()
    try:
        periods_to_process: List[str] = []
        if periodo:
            if len(periodo) == 4 and periodo.isdigit():
                periods_to_process = [f"{periodo}{m:02d}" for m in range(1, 13)]
            elif len(periodo) == 6 and periodo.isdigit():
                periods_to_process = [periodo]
            else:
                raise ValueError("Formato inválido: use YYYY o YYYYMM")
        else:
            today = datetime.now()
            periods_to_process.append(today.strftime("%Y%m"))
            if today.day <= 7:
                periods_to_process.append((today - relativedelta(months=1)).strftime("%Y%m"))

        for ym in sorted(set(periods_to_process)):
            process_period(ym)
    except Exception as e:
        logger.exception(f"[TIEMPOS WORKER] Error inesperado: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KPIs de Tiempos (empleado/local) SIN tablas intermedias.")
    parser.add_argument("--periodo", help="YYYYMM o YYYY")
    args = parser.parse_args()
    run_worker(args.periodo)
