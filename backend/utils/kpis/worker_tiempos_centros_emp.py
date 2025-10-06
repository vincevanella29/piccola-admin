# utils/kpis/worker_tiempos_centros.py
# SOLO DOS TABLAS DE SALIDA (mensuales):
#   - kpis_tiempos_empleado_mensual
#   - kpis_tiempos_local_mensual
#
# Ejecutar:
#   python -m utils.kpis.worker_tiempos_centros --periodo 202509
#   python -m utils.kpis.worker_tiempos_centros --periodo 2025

import logging
from typing import Dict, List, Tuple, Any
from collections import defaultdict

from pymongo import UpdateOne
from utils.web3mongo import db
from utils.kpis.utils.tiempos_utils import (
    _ym_to_dash,
    _now,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# --- Fuentes
EMPRESAS = db.empresas                   # new source for sucursales mapping

# --- Destinos (SOLO estos dos mensuales)
DST_EMP_MONTHLY = db.kpis_tiempos_empleado_mensual

# --- Parámetros de elegibilidad (ranking global empleado)
MIN_DAYS_FOR_RANK = 1
MIN_SAMPLES_SHARE = 1

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
                "puesto_empresa_samples": 0,
                "puesto_local_samples": 0,
                "best_empresa": 0.0,
                "avg_empresa": 0.0,
                "best_local": 0.0,
                "avg_local": 0.0,
            },
            # Total de cantidad atribuida al empleado en el período (entero)
            "samples_total": int(round(sum_share)),
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
            # Cantidad de producción atribuida a este centro para el empleado
            "samples_total": int(round(sum_share)),
            "dias_con_registro": len(bc["days"]),
            "puesto_empresa": 0,
            "puesto_local": 0,
            "puesto_empresa_samples": 0,
            "puesto_local_samples": 0,
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
            # Cantidad total atribuida por subfamilia
            "samples_total": int(round(sum_share)),
            "dias_con_registro": len(b["days"]),
            "puesto_empresa": 0,
            "puesto_local": 0,
            "puesto_empresa_samples": 0,
            "puesto_local_samples": 0,
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
            # Cantidad total atribuida por familia
            "samples_total": int(round(sum_share)),
            "dias_con_registro": len(c["days"]),
            "puesto_empresa": 0,
            "puesto_local": 0,
            "puesto_empresa_samples": 0,
            "puesto_local_samples": 0,
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

    # --- RANKS por PRODUCCIÓN (samples) EMPLEADO
    # empresa por samples
    prod_sorted = sorted([d for d in docs_emp if d["tiempos"]["samples_share"] >= MIN_SAMPLES_SHARE],
                         key=lambda x: x["tiempos"]["samples_share"], reverse=True)
    for i, d in enumerate(prod_sorted, start=1):
        d["tiempos"]["puesto_empresa_samples"] = i
    # local por samples
    by_local_prod = defaultdict(list)
    for d in docs_emp:
        by_local_prod[d["local"]].append(d)
    for loc, arr in by_local_prod.items():
        arr.sort(key=lambda x: x["tiempos"]["samples_share"], reverse=True)
        for i, d in enumerate(arr, start=1):
            d["tiempos"]["puesto_local_samples"] = i

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
    # empresa por samples (by_centro)
    by_centro_emp_samples = defaultdict(list)
    for rut, loc, cslug, it in centro_pool:
        by_centro_emp_samples[cslug].append((rut, loc, it))
    for cslug, arr in by_centro_emp_samples.items():
        arr.sort(key=lambda x: x[2].get("samples_share", 0), reverse=True)
        for rank, (rut, loc, it) in enumerate(arr, start=1):
            for target in idx_emp[(rut, loc)]["by_centro"]:
                if target["centro_slug"] == cslug:
                    target["puesto_empresa_samples"] = rank
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
    # local por samples (by_centro)
    for cslug, locmap in by_centro_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1].get("samples_share", 0), reverse=True)
            for rank, (rut, it) in enumerate(arr, start=1):
                for target in idx_emp[(rut, loc)]["by_centro"]:
                    if target["centro_slug"] == cslug:
                        target["puesto_local_samples"] = rank
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
    # empresa por samples (subfamilia)
    for sf, arr in by_sf_emp.items():
        arr.sort(key=lambda x: x[2].get("samples_share", 0), reverse=True)
        for rank, (rut, loc, it) in enumerate(arr, start=1):
            for target in idx_emp[(rut, loc)]["by_subfamilia"]:
                if target["subfamilia"] == sf:
                    target["puesto_empresa_samples"] = rank
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
    # local por samples (subfamilia)
    for sf, locmap in by_sf_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1].get("samples_share", 0), reverse=True)
            for rank, (rut, it) in enumerate(arr, start=1):
                for target in idx_emp[(rut, loc)]["by_subfamilia"]:
                    if target["subfamilia"] == sf:
                        target["puesto_local_samples"] = rank
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
    # empresa por samples (familia)
    for fam, arr in by_fam_emp.items():
        arr.sort(key=lambda x: x[2].get("samples_share", 0), reverse=True)
        for rank, (rut, loc, it) in enumerate(arr, start=1):
            for target in idx_emp[(rut, loc)]["by_familia"]:
                if target["familia"] == fam:
                    target["puesto_empresa_samples"] = rank
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
    # local por samples (familia)
    for fam, locmap in by_fam_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1].get("samples_share", 0), reverse=True)
            for rank, (rut, it) in enumerate(arr, start=1):
                for target in idx_emp[(rut, loc)]["by_familia"]:
                    if target["familia"] == fam:
                        target["puesto_local_samples"] = rank
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
