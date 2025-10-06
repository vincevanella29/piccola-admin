# utils/kpis/worker_tiempos_centros.py
# SOLO DOS TABLAS DE SALIDA (mensuales):
#   - kpis_tiempos_empleado_mensual
#   - kpis_tiempos_local_mensual
#
# Ejecutar:
#   python -m utils.kpis.worker_tiempos_centros --periodo 202509
#   python -m utils.kpis.worker_tiempos_centros --periodo 2025

import logging
from typing import Dict, List, Tuple, Any, Set
from collections import defaultdict

from pymongo import UpdateOne

from utils.web3mongo import db
from utils.kpis.utils.tiempos_utils import (
    _ym_to_dash,
    _now,
    _norm_local_sigla
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# --- Fuentes
EMPRESAS = db.empresas                   # new source for sucursales mapping

# --- Destinos (SOLO estos dos mensuales)
DST_LOCAL_MONTHLY = db.kpis_tiempos_local_mensual

# ==========================
# 4) Agregado mensual LOCAL (en memoria) + RANKS
#    (general local + by_centro con ranking empresa entre locales; se mantienen subfamilias por compatibilidad)
# ==========================
def build_local_monthly_write(ym: str, centro_daily: List[Dict[str, Any]],
                              asis_idx: Dict[Tuple[str, str], List[Dict[str, Any]]],
                              admin_cargo_ids: Set[int]):
    periodo_dash = _ym_to_dash(ym)

    # general local
    acc_loc = defaultdict(lambda: {"sum_w": 0.0, "samples": 0})
    # centro por local (NUEVO)
    acc_loc_centro = defaultdict(lambda: {"sum_w": 0.0, "samples": 0, "centro_nombre": None})
    # subfamilia por local (para compatibilidad de familia)
    acc_loc_sf = defaultdict(lambda: {"sum_w": 0.0, "samples": 0, "familia": None})
    # familia por local (nuevo)
    acc_loc_fam = defaultdict(lambda: {"sum_w": 0.0, "samples": 0})

    # Para poder sumar administradores al promedio del local, primero
    # acumulamos por (fecha, local) los promedios/datos del día del local.
    acc_day_loc = defaultdict(lambda: {"sum_w": 0.0, "samples": 0})
    # Promedios por día-local-centro para poder calcular by_centro por admin
    acc_day_loc_centro = defaultdict(lambda: {"sum_w": 0.0, "samples": 0, "centro_nombre": None})  # (fday, loc, cslug)
    day_loc_centers_index = defaultdict(list)  # (fday, loc) -> [cslug]
    # Acumuladores de administradores por local
    admins_by_loc = defaultdict(set)        # local -> set(RUT)
    admins_days_count = defaultdict(int)    # local -> total presencias de admins (suma de admins por día)
    admins_days_by_loc_rut = defaultdict(int)  # (local, rut) -> días presente
    # NUEVOS: acumuladores por admin (promedio mensual por días con tiempos del local)
    admin_avg_sum = defaultdict(float)      # (local, rut) -> suma de promedios diarios del local
    admin_avg_days = defaultdict(int)       # (local, rut) -> conteo días con tiempos del local
    # NUEVOS: acumuladores por admin y centro (promedio mensual por días con ese centro)
    admin_cslug_sum = defaultdict(float)    # (local, rut, centro_slug) -> suma de promedios diarios del centro
    admin_cslug_days = defaultdict(int)     # (local, rut, centro_slug) -> conteo días con ese centro
    # NUEVO: cantidad de producción atribuida al admin por centro (suma de samples del día-centro cuando el admin estuvo presente)
    admin_cslug_samples = defaultdict(int)  # (local, rut, centro_slug) -> samples_total

    for d in centro_daily:
        loc = d["local"]
        samples = int(((d.get("tiempos") or {}).get("samples")) or 0)
        avg = float(((d.get("tiempos") or {}).get("avg_seg")) or 0)
        if samples <= 0 or avg <= 0:
            continue

        # general local
        acc_loc[loc]["sum_w"] += samples * avg
        acc_loc[loc]["samples"] += samples

        # acumulador por día-local
        fday = d.get("fecha")
        if fday:
            acc_day_loc[(fday, loc)]["sum_w"] += samples * avg
            acc_day_loc[(fday, loc)]["samples"] += samples

        # centro
        cslug = (d.get("centro") or {}).get("slug", "")
        cn = (d.get("centro") or {}).get("nombre", "")
        if cslug:
            keyc = (loc, cslug)
            acc_loc_centro[keyc]["sum_w"] += samples * avg
            acc_loc_centro[keyc]["samples"] += samples
            acc_loc_centro[keyc]["centro_nombre"] = cn
            # por día-local-centro
            if fday:
                keydlc = (fday, loc, cslug)
                acc_day_loc_centro[keydlc]["sum_w"] += samples * avg
                acc_day_loc_centro[keydlc]["samples"] += samples
                acc_day_loc_centro[keydlc]["centro_nombre"] = cn
                day_loc_centers_index[(fday, loc)].append(cslug)

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
            # familia
            if fam:
                keyf = (loc, fam)
                acc_loc_fam[keyf]["sum_w"] += sf_avg * sf_sam
                acc_loc_fam[keyf]["samples"] += sf_sam

    # Ahora, por cada (fecha, local), contamos administradores presentes (PTE)
    # y los agregamos como muestras adicionales con el promedio del día del local.
    # Esto incrementa el "samples_total" del local sin alterar su promedio.
    for (fday, loc), v in acc_day_loc.items():
        total_samples_day = v["samples"]
        if total_samples_day <= 0:
            continue
        avg_day_loc = v["sum_w"] / total_samples_day
        # Buscar asistencia tanto por local raw como normalizado
        admins_ruts: Set[str] = set()
        # clave raw
        for p in asis_idx.get((fday, loc), []) or []:
            sec_p = (p.get("seccion") or "").strip().lower()
            idc = int(p.get("id_cargo") or 0)
            if sec_p == "administracion local" or (idc in admin_cargo_ids):
                rut = str(p.get("rut") or "").strip()
                if rut:
                    admins_ruts.add(rut)
        # clave norm
        loc_norm = _norm_local_sigla(loc)
        for p in asis_idx.get((fday, loc_norm), []) or []:
            sec_p = (p.get("seccion") or "").strip().lower()
            idc = int(p.get("id_cargo") or 0)
            if sec_p == "administracion local" or (idc in admin_cargo_ids):
                rut = str(p.get("rut") or "").strip()
                if rut:
                    admins_ruts.add(rut)

        admin_count = len(admins_ruts)
        if admin_count > 0:
            acc_loc[loc]["sum_w"] += avg_day_loc * admin_count
            acc_loc[loc]["samples"] += admin_count
            admins_by_loc[loc].update(admins_ruts)
            admins_days_count[loc] += admin_count
            for arut in admins_ruts:
                admins_days_by_loc_rut[(loc, arut)] += 1
                # acumular promedio del día para el admin (solo días con tiempos)
                admin_avg_sum[(loc, arut)] += avg_day_loc
                admin_avg_days[(loc, arut)] += 1
                # acumular por centro del día
                for cslug in day_loc_centers_index.get((fday, loc), []):
                    keydlc = (fday, loc, cslug)
                    vdlc = acc_day_loc_centro.get(keydlc)
                    if not vdlc or vdlc["samples"] <= 0:
                        continue
                    avg_day_centro = vdlc["sum_w"] / vdlc["samples"]
                    admin_cslug_sum[(loc, arut, cslug)] += avg_day_centro
                    admin_cslug_days[(loc, arut, cslug)] += 1
                    # Atribuir cantidad de producción de ese centro en ese día al admin presente
                    admin_cslug_samples[(loc, arut, cslug)] += int(vdlc["samples"])

    # Enriquecer admins (conteo por RUT) con días sin tiempos (si existen)
    # Escanear asistencia indexada: si el local de la clave coincide con el local raw o su normalizado,
    # sumar presencia de admins aunque no haya acc_day_loc para ese día.
    # Para evitar doble conteo, saltar días/locals que ya están en acc_day_loc (ya contabilizados arriba)
    acc_day_loc_keys = set(acc_day_loc.keys())
    seen_admin_presence: Set[Tuple[str, str, str]] = set()  # (fecha, loc_base, rut)
    for (fday, a_loc), personas in asis_idx.items():
        # mapeo para buscar match con locales que tenemos en acc_loc/idx_loc
        # Usamos ambos: el asist local y su normalizado
        a_loc_u = (a_loc or "").strip().upper()
        a_loc_norm = _norm_local_sigla(a_loc)
        a_loc_norm_u = (a_loc_norm or "").strip().upper()
        # try both representations against known locals (acc_loc keys)
        for loc in list(acc_loc.keys()):
            loc_u = (loc or "").strip().upper()
            loc_norm_u = (_norm_local_sigla(loc) or "").strip().upper()
            # match conditions: raw match, normalized match, and LOC-suffix tolerant match
            if (
                a_loc_u == loc_u or
                a_loc_norm_u == loc_u or
                loc_norm_u == a_loc_u or
                loc_norm_u == a_loc_norm_u or
                (a_loc_u + "LOC" == loc_u) or
                (a_loc_norm_u + "LOC" == loc_u)
            ):
                # si ya tenemos ese (fecha, loc) en acc_day_loc, no sumar otra vez aquí
                if (fday, loc) in acc_day_loc_keys:
                    continue
                # contar admins en este día
                day_admins: Set[str] = set()
                for p in personas:
                    sec_p = (p.get("seccion") or "").strip().lower()
                    idc = int(p.get("id_cargo") or 0)
                    if sec_p == "administracion local" or (idc in admin_cargo_ids):
                        rut = str(p.get("rut") or "").strip()
                        if rut:
                            # dedupe por (fecha, loc, rut)
                            if (fday, loc, rut) not in seen_admin_presence:
                                day_admins.add(rut)
                                seen_admin_presence.add((fday, loc, rut))
                if day_admins:
                    admins_by_loc[loc].update(day_admins)
                    admins_days_count[loc] += len(day_admins)
                    for arut in day_admins:
                        admins_days_by_loc_rut[(loc, arut)] += 1

    # construir base local (solo en memoria, NO se persiste)
    base_loc_map: Dict[str, Dict[str, Any]] = {}
    for loc, v in acc_loc.items():
        samples = v["samples"]
        avg_seg = (v["sum_w"]/samples) if samples > 0 else None
        base_loc_map[loc] = {
            "periodo": periodo_dash,
            "local": loc,
            "samples_total": samples,
            "avg_seg": round(avg_seg, 2) if (avg_seg and avg_seg > 0) else None,
            "puesto_empresa": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
            # info admins solo para referencia en admin docs
            "admins_present_ruts": sorted(list(admins_by_loc.get(loc, set()))),
            "days_present_admin": int(admins_days_count.get(loc, 0)),
            "by_centro": [],
            "by_subfamilia": [],
            "updated_at": _now(),
        }
    idx_loc = base_loc_map

    # by_centro embebido + ranking EMPRESA entre locales (solo avg > 0)
    tmp_by_centro = defaultdict(list)  # cslug -> [(local, avg)]
    tmp_by_centro_samples = defaultdict(list)  # cslug -> [(local, samples_total)]
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
            "puesto_empresa_samples": 0,
            "puesto_local_samples": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
        }
        if loc in idx_loc:
            idx_loc[loc]["by_centro"].append(item)
        tmp_by_centro[cslug].append((loc, round(avg_c, 2)))
        tmp_by_centro_samples[cslug].append((loc, int(samples)))

    # subfamilia embebida (compatibilidad) con rank empresa
    tmp_by_sf = defaultdict(list)  # sf -> [(local, avg)]
    tmp_by_sf_samples = defaultdict(list)  # sf -> [(local, samples_total)]
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
            "puesto_empresa_samples": 0,
            "puesto_local_samples": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
        }
        if loc in idx_loc:
            idx_loc[loc]["by_subfamilia"].append(item)
        tmp_by_sf[sf].append((loc, round(avg_sf, 2)))
        tmp_by_sf_samples[sf].append((loc, int(samples)))

    # familia embebida y rankings
    tmp_by_fam = defaultdict(list)  # fam -> [(local, avg)]
    tmp_by_fam_samples = defaultdict(list)  # fam -> [(local, samples_total)]
    for (loc, fam), v in acc_loc_fam.items():
        samples = v["samples"]
        avg_f = (v["sum_w"]/samples) if samples > 0 else None
        if not avg_f or avg_f <= 0:
            continue
        item = {
            "familia": fam,
            "samples_total": samples,
            "avg_seg": round(avg_f, 2),
            "puesto_empresa": 0,
            "puesto_empresa_samples": 0,
            "puesto_local_samples": 0,
            "best_empresa": 0.0,
            "avg_empresa": 0.0,
        }
        if loc in idx_loc:
            idx_loc[loc].setdefault("by_familia", []).append(item)
        tmp_by_fam[fam].append((loc, round(avg_f, 2)))
        tmp_by_fam_samples[fam].append((loc, int(samples)))

    # rank empresa (general local) — solo locales con avg_seg > 0
    elig_loc = [d for d in base_loc_map.values() if d["avg_seg"] is not None and d["avg_seg"] > 0 and d["samples_total"] > 0]
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

    # rank empresa (general local) por producción (samples_total)
    elig_loc_samples = [d for d in base_loc_map.values() if d["samples_total"] > 0]
    elig_loc_samples.sort(key=lambda x: x["samples_total"], reverse=True)
    for rank, d in enumerate(elig_loc_samples, start=1):
        d["puesto_empresa_samples"] = rank

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

    # rank empresa por centro entre locales (producción por samples_total)
    for cslug, arr in tmp_by_centro_samples.items():
        arr.sort(key=lambda x: x[1], reverse=True)
        pos = {loc: i+1 for i, (loc, _) in enumerate(arr)}
        for loc, doc in idx_loc.items():
            for it in doc["by_centro"]:
                if it["centro_slug"] == cslug:
                    it["puesto_empresa_samples"] = pos.get(loc, 0)

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

    # rank empresa por subfamilia entre locales (producción por samples_total)
    for sf, arr in tmp_by_sf_samples.items():
        arr.sort(key=lambda x: x[1], reverse=True)
        pos = {loc: i+1 for i, (loc, _) in enumerate(arr)}
        for loc, doc in idx_loc.items():
            for it in doc["by_subfamilia"]:
                if it["subfamilia"] == sf:
                    it["puesto_empresa_samples"] = pos.get(loc, 0)

    # rank local por producción (samples_total) dentro de cada local
    for loc, doc in idx_loc.items():
        # by_centro dentro del local
        centers = doc.get("by_centro", [])
        centers.sort(key=lambda x: x.get("samples_total", 0), reverse=True)
        for i, it in enumerate(centers, start=1):
            it["puesto_local_samples"] = i
        # by_subfamilia dentro del local
        sfs = doc.get("by_subfamilia", [])
        sfs.sort(key=lambda x: x.get("samples_total", 0), reverse=True)
        for i, it in enumerate(sfs, start=1):
            it["puesto_local_samples"] = i
        # by_familia dentro del local
        fams = doc.get("by_familia", [])
        fams.sort(key=lambda x: x.get("samples_total", 0), reverse=True)
        for i, it in enumerate(fams, start=1):
            it["puesto_local_samples"] = i

    # ranking empresa por familia entre locales
    for fam, arr in tmp_by_fam.items():
        arr.sort(key=lambda x: x[1])
        best = arr[0][1]
        avg = round(sum(x[1] for x in arr)/len(arr), 2)
        pos = {loc: i+1 for i, (loc, _) in enumerate(arr)}
        for loc, doc in idx_loc.items():
            for it in doc.get("by_familia", []):
                if it["familia"] == fam and it["avg_seg"] is not None and it["avg_seg"] > 0:
                    it["puesto_empresa"] = pos.get(loc, 0)
                    it["best_empresa"] = best
                    it["avg_empresa"] = avg
    # ranking empresa por familia por producción
    for fam, arr in tmp_by_fam_samples.items():
        arr.sort(key=lambda x: x[1], reverse=True)
        pos = {loc: i+1 for i, (loc, _) in enumerate(arr)}
        for loc, doc in idx_loc.items():
            for it in doc.get("by_familia", []):
                if it["familia"] == fam:
                    it["puesto_empresa_samples"] = pos.get(loc, 0)

    # Crear documentos por administrador (uno por RUT) con promedio propio por días trabajados con tiempos
    admin_docs: List[Dict[str, Any]] = []
    for loc, ruts in admins_by_loc.items():
        for rut in sorted(list(ruts)):
            days_with_times = int(admin_avg_days.get((loc, rut), 0))
            avg_admin = None
            if days_with_times > 0:
                avg_admin = round(admin_avg_sum.get((loc, rut), 0.0) / days_with_times, 2)
            # construir by_centro específico del admin
            admin_by_centro = []
            # inicializar estructuras si no existen
            # NOTA: definimos default dicts antes de su uso
            
            admin_docs.append({
                "periodo": periodo_dash,
                "local": loc,
                "rut": rut,
                # usamos días con tiempos como "samples_total" del admin (representa cantidad de días promediados)
                "samples_total": days_with_times,
                "avg_seg": avg_admin,
                # métricas empresa se calcularán más abajo entre admins
                "puesto_empresa": 0,
                "puesto_empresa_samples": 0,
                "best_empresa": 0.0,
                "avg_empresa": 0.0,
                # total de días presente (incluye días sin tiempos)
                "days_present_admin": int(admins_days_by_loc_rut.get((loc, rut), 0)),
                # by_centro por admin (se calcula abajo)
                "by_centro": admin_by_centro,
                "by_subfamilia": idx_loc.get(loc, {}).get("by_subfamilia", []),
                "by_familia": idx_loc.get(loc, {}).get("by_familia", []),
                "updated_at": _now(),
            })

    # Calcular by_centro por admin (promedio de promedios diarios por días con ese centro)
    # Estructuras auxiliares globales para ranking
    admin_centro_pool = []  # (loc, rut, cslug, item)
    for d in admin_docs:
        loc = d["local"]; rut = d["rut"]
        # para cada centro visto en el local, si el admin tiene días para ese centro, computar
        seen_cslugs = set()
        # usar índice day_loc_centers_index para el local: recolectar cslugs del local
        # construimos un set de cslugs presentes en el local en el mes
        local_cslugs = set(c for (fday, l) in day_loc_centers_index.keys() if l == loc for c in day_loc_centers_index[(fday, l)])
        # calcular samples_total del admin como suma de samples de todos los centros en días presentes
        total_admin_samples = 0
        for cslug in sorted(local_cslugs):
            days_c = admin_cslug_days.get((loc, rut, cslug), 0)
            if days_c <= 0:
                continue
            sum_c = admin_cslug_sum.get((loc, rut, cslug), 0.0)
            avg_c = round(sum_c / days_c, 2)
            cn = None
            # buscar nombre desde acc_loc_centro o acc_day_loc_centro
            base_keyc = (loc, cslug)
            cn = acc_loc_centro.get(base_keyc, {}).get("centro_nombre")
            if not cn:
                # fallback: tomar cualquier día con ese centro
                for (fday, l, cs), vdlc in acc_day_loc_centro.items():
                    if l == loc and cs == cslug and vdlc.get("centro_nombre"):
                        cn = vdlc["centro_nombre"]; break
            samples_c = int(admin_cslug_samples.get((loc, rut, cslug), 0))
            total_admin_samples += samples_c
            item = {
                "centro_slug": cslug,
                "centro_nombre": cn or cslug,
                # cantidad de producción atribuida al admin para este centro (suma de samples del día-centro cuando estuvo presente)
                "samples_total": int(samples_c),
                "avg_seg": avg_c,
                "puesto_empresa": 0,
                "puesto_empresa_samples": 0,
                "puesto_local_samples": 0,
                "best_empresa": 0.0,
                "avg_empresa": 0.0,
                "puesto_local": 0,
                "best_local": 0.0,
                "avg_local": 0.0,
            }
            d["by_centro"].append(item)
            admin_centro_pool.append((loc, rut, cslug, item))
        # actualizar samples_total top-level del admin con la suma por centros
        d["samples_total"] = int(total_admin_samples)

    # Ranks por centro entre admins (empresa y local)
    # Empresa (todos los admins) por avg_seg
    by_cslug_emp = defaultdict(list)
    for loc, rut, cslug, it in admin_centro_pool:
        if it.get("avg_seg") and it["avg_seg"] > 0:
            by_cslug_emp[cslug].append((loc, rut, it))
    for cslug, arr in by_cslug_emp.items():
        arr.sort(key=lambda x: x[2]["avg_seg"])  # menor es mejor
        best = arr[0][2]["avg_seg"]
        avg = round(sum(x[2]["avg_seg"] for x in arr)/len(arr), 2)
        for rank, (loc, rut, it) in enumerate(arr, start=1):
            it["puesto_empresa"] = rank
            it["best_empresa"] = best
            it["avg_empresa"] = avg
    # Empresa por presencia (samples_total = días con ese centro)
    for cslug, arr in by_cslug_emp.items():
        arr.sort(key=lambda x: x[2].get("samples_total", 0), reverse=True)
        for rank, (loc, rut, it) in enumerate(arr, start=1):
            it["puesto_empresa_samples"] = rank
    # Local por avg_seg
    by_cslug_loc = defaultdict(lambda: defaultdict(list))
    for loc, rut, cslug, it in admin_centro_pool:
        if it.get("avg_seg") and it["avg_seg"] > 0:
            by_cslug_loc[cslug][loc].append((rut, it))
    for cslug, locmap in by_cslug_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1]["avg_seg"])  # asc
            best = arr[0][1]["avg_seg"]
            avg = round(sum(x[1]["avg_seg"] for x in arr)/len(arr), 2)
            for rank, (rut, it) in enumerate(arr, start=1):
                it["puesto_local"] = rank
                it["best_local"] = best
                it["avg_local"] = avg
    # Local por presencia
    for cslug, locmap in by_cslug_loc.items():
        for loc, arr in locmap.items():
            arr.sort(key=lambda x: x[1].get("samples_total", 0), reverse=True)
            for rank, (rut, it) in enumerate(arr, start=1):
                it["puesto_local_samples"] = rank

    # Solo persistimos documentos por admin
    docs_local = admin_docs

    # Ranks empresa entre administradores (por avg_seg, menor es mejor)
    elig_admins = [d for d in docs_local if d.get("avg_seg") is not None and d["avg_seg"] > 0]
    elig_admins.sort(key=lambda x: x["avg_seg"])  # ascendente
    if elig_admins:
        best_emp = elig_admins[0]["avg_seg"]
        avg_emp = round(sum(x["avg_seg"] for x in elig_admins) / len(elig_admins), 2)
    else:
        best_emp = 0.0
        avg_emp = 0.0
    for i, d in enumerate(elig_admins, start=1):
        d["puesto_empresa"] = i
        d["best_empresa"] = best_emp
        d["avg_empresa"] = avg_emp

    # Rank empresa por "producción" del admin: priorizamos días presente (desc)
    admins_by_presence = sorted(docs_local, key=lambda x: int(x.get("days_present_admin", 0)), reverse=True)
    for i, d in enumerate(admins_by_presence, start=1):
        d["puesto_empresa_samples"] = i

    # Ranks por local entre administradores (por avg_seg y por presencia)
    by_local_admins = defaultdict(list)
    for d in docs_local:
        by_local_admins[d["local"]].append(d)
    # por avg_seg (menor es mejor)
    for loc, arr in by_local_admins.items():
        elig_loc = [x for x in arr if x.get("avg_seg") is not None and x["avg_seg"] > 0]
        elig_loc.sort(key=lambda x: x["avg_seg"])  # asc
        if elig_loc:
            best_loc = elig_loc[0]["avg_seg"]
            avg_loc = round(sum(x["avg_seg"] for x in elig_loc)/len(elig_loc), 2)
        else:
            best_loc = 0.0
            avg_loc = 0.0
        for rank, x in enumerate(elig_loc, start=1):
            x["puesto_local"] = rank
            x["best_local"] = best_loc
            x["avg_local"] = avg_loc
    # por presencia (días presente, desc)
    for loc, arr in by_local_admins.items():
        arr.sort(key=lambda x: int(x.get("days_present_admin", 0)), reverse=True)
        for rank, x in enumerate(arr, start=1):
            x["puesto_local_samples"] = rank

    # escritura
    ops: List[UpdateOne] = []
    # Limpieza: eliminar docs base sin rut del periodo (si existen de ejecuciones previas)
    try:
        DST_LOCAL_MONTHLY.delete_many({"periodo": periodo_dash, "rut": {"$exists": False}})
    except Exception:
        pass

    for d in docs_local:
        key = {"periodo": periodo_dash, "local": d["local"]}
        if d.get("rut") is not None:
            key["rut"] = d.get("rut")
        ops.append(UpdateOne(key, {"$set": d}, upsert=True))
        if len(ops) >= 1000:
            DST_LOCAL_MONTHLY.bulk_write(ops, ordered=False); ops = []
    if ops:
        DST_LOCAL_MONTHLY.bulk_write(ops, ordered=False)
    logger.info(f"[local_mensual] escritos {len(docs_local)} docs")
