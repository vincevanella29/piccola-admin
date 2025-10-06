from __future__ import annotations
from typing import Dict, Any, List, Optional
from pymongo.database import Database
import logging
import re

logger = logging.getLogger(__name__)

TEMPLATE_KEY = "times_metrics_local"

# ===========================
# Helpers compartidos
# ===========================

def _pos_filter(position_type: str, pos: int, lo: int, hi: int) -> Dict[str, Any]:
    if position_type == "exact":
        return {"$eq": int(pos)}
    if position_type == "range":
        lo = max(1, int(lo or 1))
        hi = max(lo, int(hi or lo))
        return {"$gte": lo, "$lte": hi}
    return {"$lte": int(pos), "$gt": 0}


def _norm_sigla(sigla: str) -> str:
    sigla = (sigla or "").strip()
    return sigla[:-3] if sigla.endswith("LOC") else sigla


def _suc_id_to_sigla(db: Database) -> Dict[int, str]:
    m: Dict[int, str] = {}
    for emp in db.empresas.find({}, {"sucursales": 1}):
        for s in (emp.get("sucursales") or []):
            try:
                sid_i = int(s.get("id_sucursal"))
            except Exception:
                continue
            mtz = s.get("mtz") or {}
            loc = s.get("location") or {}
            sig = (
                (mtz.get("sigla_local") or "").strip() or
                (loc.get("permalink_slug") or "").strip() or
                (mtz.get("permalink_slug") or "").strip()
            )
            if sid_i and sig:
                m[sid_i] = sig
    return m


def _attendance_ruts_for_local(db: Database, ym: str, local_sigla: str, min_days: int, suc_map: Dict[int, str]) -> List[str]:
    ym_int = int(ym)
    norm_target = {_norm_sigla(local_sigla), local_sigla}
    by_rut_days: Dict[str, int] = {}
    cursor = db.asistencia_diaria_intranet.find(
        {"periodo": ym_int},
        {"rut": 1, "sigla_local": 1, "local": 1, "id_sucursal": 1}
    )
    for a in cursor:
        rut = str(a.get("rut") or "").strip()
        if not rut:
            continue
        loc = (a.get("sigla_local") or a.get("local") or "").strip()
        if not loc:
            sid = a.get("id_sucursal")
            try:
                loc = suc_map.get(int(sid)) or ""
            except Exception:
                loc = ""
        if not loc:
            continue
        if _norm_sigla(loc) in norm_target or loc in norm_target:
            by_rut_days[rut] = by_rut_days.get(rut, 0) + 1
    if min_days > 0:
        return [r for r, d in by_rut_days.items() if d >= min_days]
    return list(by_rut_days.keys())


# ===========================
# Catálogo de Centros para UI
# ===========================

_RENTAB_COLL = "rentabilidad_producto_locales"
_CFG_CENTROS = "centros_produccion_config"
_SRC_TIEMPOS = "ventas_hora_tiempo_promedio"  # fallback para nombres de centro


def _slugify(name: str) -> str:
    s = (name or "").strip().lower()
    s = s.replace("/", " ").replace(".", " ").replace("_", " ")
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s


def _get_centers_catalog(db: Database, *, mesano: Optional[str], year: Optional[str]) -> List[Dict[str, Any]]:
    cfg = list(db[_CFG_CENTROS].find({"active": True}, {"centro_slug": 1}))
    slugs = sorted({(c.get("centro_slug") or "").strip() for c in cfg if (c.get("centro_slug") or "").strip()})
    centers = {s: {"slug": s, "label": None} for s in slugs}

    match: Dict[str, Any] = {}
    if mesano:
        match["MESANO"] = int(mesano)
    elif year:
        match["MESANO"] = {"$gte": int(f"{year}01"), "$lte": int(f"{year}12")}
    pipe = [
        {"$match": match} if match else {"$match": {"CENTROPRODUCCION": {"$ne": None}}},
        {"$group": {"_id": {"nombre": "$CENTROPRODUCCION"}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "nombre": "$_id.nombre"}},
    ]
    for r in db[_SRC_TIEMPOS].aggregate(pipe):
        nombre = (r.get("nombre") or "").strip()
        if not nombre:
            continue
        slug = _slugify(nombre)
        if slug not in centers:
            centers[slug] = {"slug": slug, "label": nombre}
        else:
            centers[slug]["label"] = centers[slug]["label"] or nombre

    out: List[Dict[str, Any]] = []
    for v in centers.values():
        label = (v["label"] or v["slug"].replace("-", " ").upper()).strip()
        out.append({"slug": v["slug"], "label": label})
    out.sort(key=lambda x: x["label"])
    return out


# ===========================
# Template descriptor
# ===========================

TIMES_METRICS_LOCAL_TEMPLATE: Dict[str, Any] = {
    "key": TEMPLATE_KEY,
    "name": "Tiempos (Local): Métricas por Local / Centro",
    "description": "Premia a empleados por ranking de tiempos a nivel de local (overall) o por centro de producción (selected_centers).",
    "category": "times",
    "period": "month",
    "data_sources": [
        {"collection": "kpis_tiempos_local_mensual", "fields": ["periodo", "local", "avg_seg", "samples_total", "by_centro"], "filter": "KPIs de tiempos por local y por centro."},
        {"collection": "asistencia_diaria_intranet", "fields": ["rut", "periodo", "sigla_local", "local", "id_sucursal"], "filter": "Mapea locales ganadores a empleados con asistencia."},
        {"collection": "empresas", "fields": ["sucursales.id_sucursal", "sucursales.mtz.sigla_local", "sucursales.location.permalink_slug", "sucursales.mtz.permalink_slug"], "filter": "Normaliza id_sucursal → sigla"},
    ],
    "required_params": {
        "level": {"type": "select", "options": ["overall", "center"], "default": "overall"},
        "period_mode": {"type": "select", "options": ["month", "year"], "default": "month"},
        "position_type": {"type": "select", "options": ["top_n", "exact", "range"], "default": "top_n"},
        "ranking_position": {"type": "number", "min": 1, "max": 100, "default": 1},
        "position_from": {"type": "number", "min": 1, "max": 100, "default": 1},
        "position_to": {"type": "number", "min": 1, "max": 100, "default": 10},
    },
    "optional_params": {
        "position_metric": {"type": "select", "options": ["avg", "samples"], "default": "avg"},
        "min_days_worked": {"type": "number", "min": 0, "default": 0},
        "selected_centers": {"type": "multiselect", "default": []},
        "selected_center_labels": {"type": "multiselect", "default": []},
        "name": {"type": "text", "default": ""},
        "names": {"type": "multiselect", "default": []},
    }
}


# Alias requerido por el cargador dinámico de reglas
# Debe coincidir con f"{TEMPLATE_KEY.upper()}_RULE_TEMPLATE"
TIMES_METRICS_LOCAL_RULE_TEMPLATE = TIMES_METRICS_LOCAL_TEMPLATE


def get_template_descriptor(
    db: Database,
    *,
    mesano: Optional[str] = None,
    year: Optional[str] = None,
    include_products: bool = False,
    max_products_per_subfamily: Optional[int] = None,
) -> Dict[str, Any]:
    centers = _get_centers_catalog(db, mesano=mesano, year=year)
    tpl = dict(TIMES_METRICS_LOCAL_TEMPLATE)
    tpl["catalogs"] = {"centers": centers}
    return tpl


# ===========================
# Evaluación unificada
# ===========================

def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    params = rule.get("params", {}) or {}
    level = params.get("level", "overall")
    period_mode = params.get("period_mode", "month")
    position_metric = params.get("position_metric", "avg")
    position_type = params.get("position_type", "top_n")
    ranking_position = int(params.get("ranking_position", 1) or 1)
    position_from = int(params.get("position_from", 1) or 1)
    position_to = int(params.get("position_to", max(1, position_from)) or max(1, position_from))
    min_days = int(params.get("min_days_worked", 0) or 0)

    suc_map = _suc_id_to_sigla(db)
    ym = periodo_dash.replace("-", "")

    winners_locals: List[str] = []

    if level == "overall":
        # Ranking por local (promedio o samples)
        if period_mode == "month":
            if position_metric == "samples":
                pipe = [
                    {"$match": {"periodo": periodo_dash}},
                    {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                    {"$project": {"_id": 0, "local": "$_id.local", "samples_total": 1}},
                    {"$addFields": {"_tb": {"$subtract": [
                        {"$toDouble": "$samples_total"}, {"$divide": [{"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6]}
                    ]}}},
                    {"$setWindowFields": {"sortBy": {"_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}},
                    {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                    {"$project": {"_id": 0, "local": 1}},
                ]
            else:
                pipe = [
                    {"$match": {"periodo": periodo_dash, "avg_seg": {"$ne": None, "$gt": 0}}},
                    {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                    {"$project": {"_id": 0, "local": "$_id.local", "avg_seg": 1}},
                    {"$addFields": {"_tb": {"$add": ["$avg_seg", {"$divide": [
                        {"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6
                    ]}]}}},
                    {"$setWindowFields": {"sortBy": {"_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
                    {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                    {"$project": {"_id": 0, "local": 1}},
                ]
        else:
            year = (periodo_dash or "")[:4]
            if position_metric == "samples":
                pipe = [
                    {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                    {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                    {"$project": {"_id": 0, "local": "$_id.local", "samples_total": 1}},
                    {"$addFields": {"_tb": {"$subtract": [
                        {"$toDouble": "$samples_total"}, {"$divide": [{"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6]}
                    ]}}},
                    {"$setWindowFields": {"sortBy": {"_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}},
                    {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                    {"$project": {"_id": 0, "local": 1}},
                ]
            else:
                pipe = [
                    {"$match": {"periodo": {"$regex": f"^{year}-"}, "avg_seg": {"$ne": None, "$gt": 0}}},
                    {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                    {"$project": {"_id": 0, "local": "$_id.local", "avg_seg": 1}},
                    {"$addFields": {"_tb": {"$add": ["$avg_seg", {"$divide": [
                        {"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6
                    ]}]}}},
                    {"$setWindowFields": {"sortBy": {"_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
                    {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                    {"$project": {"_id": 0, "local": 1}},
                ]
        winners_locals = [d["local"] for d in db.kpis_tiempos_local_mensual.aggregate(pipe)]

    else:  # level == "center"
        centers = [str(x).strip() for x in (params.get("selected_centers") or []) if str(x).strip()]
        if not centers:
            # Fallback: usar misma lógica que 'overall' si no hay centros seleccionados
            if period_mode == "month":
                if position_metric == "samples":
                    pipe = [
                        {"$match": {"periodo": periodo_dash}},
                        {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "samples_total": 1}},
                        {"$addFields": {"_tb": {"$subtract": [
                            {"$toDouble": "$samples_total"}, {"$divide": [{"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6]}
                        ]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
                else:
                    pipe = [
                        {"$match": {"periodo": periodo_dash, "avg_seg": {"$ne": None, "$gt": 0}}},
                        {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "avg_seg": 1}},
                        {"$addFields": {"_tb": {"$add": ["$avg_seg", {"$divide": [
                            {"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6
                        ]}]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
            else:
                year = (periodo_dash or "")[:4]
                if position_metric == "samples":
                    pipe = [
                        {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                        {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "samples_total": 1}},
                        {"$addFields": {"_tb": {"$subtract": [
                            {"$toDouble": "$samples_total"}, {"$divide": [{"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6]}
                        ]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
                else:
                    pipe = [
                        {"$match": {"periodo": {"$regex": f"^{year}-"}, "avg_seg": {"$ne": None, "$gt": 0}}},
                        {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "avg_seg": 1}},
                        {"$addFields": {"_tb": {"$add": ["$avg_seg", {"$divide": [
                            {"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6
                        ]}]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
            winners_locals = [d["local"] for d in db.kpis_tiempos_local_mensual.aggregate(pipe)]
        elif period_mode == "month":
            for cslug in centers:
                if position_metric == "samples":
                    pipe = [
                        {"$match": {"periodo": periodo_dash}},
                        {"$unwind": "$by_centro"},
                        {"$match": {"by_centro.centro_slug": cslug}},
                        {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$by_centro.samples_total", 0]}}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "samples_total": 1}},
                        {"$addFields": {"_tb": {"$subtract": [
                            {"$toDouble": "$samples_total"}, {"$divide": [{"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6]}
                        ]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
                else:
                    pipe = [
                        {"$match": {"periodo": periodo_dash}},
                        {"$unwind": "$by_centro"},
                        {"$match": {"by_centro.centro_slug": cslug, "by_centro.avg_seg": {"$ne": None, "$gt": 0}}},
                        {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$by_centro.avg_seg"}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "avg_seg": 1}},
                        {"$addFields": {"_tb": {"$add": ["$avg_seg", {"$divide": [
                            {"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6
                        ]}]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
                locs = [d["local"] for d in db.kpis_tiempos_local_mensual.aggregate(pipe)]
                winners_locals.extend(locs)
        else:
            year = (periodo_dash or "")[:4]
            for cslug in centers:
                if position_metric == "samples":
                    pipe = [
                        {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                        {"$unwind": "$by_centro"},
                        {"$match": {"by_centro.centro_slug": cslug}},
                        {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$by_centro.samples_total", 0]}}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "samples_total": 1}},
                        {"$addFields": {"_tb": {"$subtract": [
                            {"$toDouble": "$samples_total"}, {"$divide": [{"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6]}
                        ]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": -1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
                else:
                    pipe = [
                        {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                        {"$unwind": "$by_centro"},
                        {"$match": {"by_centro.centro_slug": cslug, "by_centro.avg_seg": {"$ne": None, "$gt": 0}}},
                        {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$by_centro.avg_seg"}}},
                        {"$project": {"_id": 0, "local": "$_id.local", "avg_seg": 1}},
                        {"$addFields": {"_tb": {"$add": ["$avg_seg", {"$divide": [
                            {"$convert": {"input": {"$substr": ["$local", 0, 10]}, "to": "double", "onError": 0.0, "onNull": 0.0}}, 1e6
                        ]}]}}},
                        {"$setWindowFields": {"sortBy": {"_tb": 1}, "output": {"rownum": {"$documentNumber": {}}}}},
                        {"$match": {"rownum": _pos_filter(position_type, ranking_position, position_from, position_to)}},
                        {"$project": {"_id": 0, "local": 1}},
                    ]
                locs = [d["local"] for d in db.kpis_tiempos_local_mensual.aggregate(pipe)]
                winners_locals.extend(locs)

    # Mapear a RUTs por asistencia
    winners_ruts: List[str] = []
    for loc in set(winners_locals):
        winners_ruts.extend(_attendance_ruts_for_local(db, ym, loc, min_days, suc_map))

    return list(sorted(set(winners_ruts)))


# ===========================
# Progreso (para app Mi Perfil)
# ===========================
def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    """Devuelve progreso del usuario según level y métrica.
    - overall: ranking del local primario del usuario entre locales.
    - center: para cada centro seleccionado, muestra KPIs del local primario y su puesto entre locales.
    """
    params = rule.get("params", {}) or {}
    level = params.get("level", "overall")
    period_mode = params.get("period_mode", "month")
    position_metric = params.get("position_metric", "avg")
    min_days = int(params.get("min_days_worked", 0) or 0)

    # Determinar local primario del usuario por asistencia (mes o año)
    if period_mode == "month":
        ym = periodo_dash.replace("-", "")
        ym_int = int(ym)
        by_local: Dict[str, int] = {}
        suc_map = _suc_id_to_sigla(db)
        for a in db.asistencia_diaria_intranet.find({"periodo": ym_int, "rut": int(rut) if rut.isdigit() else rut}, {"sigla_local": 1, "local": 1, "id_sucursal": 1}):
            loc = (a.get("sigla_local") or a.get("local") or "").strip()
            if not loc:
                sid = a.get("id_sucursal")
                try:
                    loc = (suc_map.get(int(sid)) or "").strip()
                except Exception:
                    loc = ""
            if not loc:
                continue
            by_local[loc] = by_local.get(loc, 0) + 1
        if not by_local:
            return {"progress": [], "summary": "Sin asistencia en el período"}
        local = max(by_local.items(), key=lambda x: x[1])[0]
        local_norm = _norm_sigla(local)

        if level == "overall":
            # Valor actual del local (mes)
            if position_metric == "samples":
                rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash, "local": {"$in": [local, local_norm]}}},
                    {"$group": {"_id": None, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                ]))
            else:
                rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash, "local": {"$in": [local, local_norm]}, "avg_seg": {"$ne": None, "$gt": 0}}},
                    {"$group": {"_id": None, "avg_seg": {"$avg": "$avg_seg"}}},
                ]))
            if not rows:
                return {"progress": [], "summary": f"Sin KPIs de local para {local}"}
            current_val = rows[0].get("avg_seg") if position_metric == "avg" else rows[0].get("samples_total")

            # Ranking del local entre locales (mes)
            if position_metric == "samples":
                rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash}},
                    {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                    {"$sort": {"samples_total": -1}},
                ]))
            else:
                rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash, "avg_seg": {"$ne": None, "$gt": 0}}},
                    {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                    {"$sort": {"avg_seg": 1}},
                ]))
            pos = 0; best = None; avg_all = None
            if rank_rows:
                if position_metric == "samples":
                    best = rank_rows[0]["samples_total"]
                    avg_all = round(sum(r["samples_total"] for r in rank_rows)/len(rank_rows), 2)
                else:
                    best = rank_rows[0]["avg_seg"]
                    avg_all = round(sum(r["avg_seg"] for r in rank_rows)/len(rank_rows), 2)
                for i, r in enumerate(rank_rows, start=1):
                    if r["_id"]["local"] in (local, local_norm):
                        pos = i
                        break
            return {"progress": [{
                "type": "local_ranking",
                "scope": "empresa",
                "local": local,
                "current_value": round(current_val, 2) if (current_val is not None and position_metric == "avg") else current_val,
                "current_position": pos,
                "best_value": best,
                "avg_value": avg_all,
            }]}

        # level == center (mes)
        centers = [str(x).strip() for x in (params.get("selected_centers") or []) if str(x).strip()]
        if not centers:
            # Fallback: mostrar progreso 'overall' si no hay centros seleccionados
            if position_metric == "samples":
                rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash, "local": {"$in": [local, local_norm]}}},
                    {"$group": {"_id": None, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                ]))
            else:
                rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash, "local": {"$in": [local, local_norm]}, "avg_seg": {"$ne": None, "$gt": 0}}},
                    {"$group": {"_id": None, "avg_seg": {"$avg": "$avg_seg"}}},
                ]))
            if not rows:
                return {"progress": [], "summary": f"Sin KPIs de local para {local}"}
            current_val = rows[0].get("avg_seg") if position_metric == "avg" else rows[0].get("samples_total")

            if position_metric == "samples":
                rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash}},
                    {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                    {"$sort": {"samples_total": -1}},
                ]))
            else:
                rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash, "avg_seg": {"$ne": None, "$gt": 0}}},
                    {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                    {"$sort": {"avg_seg": 1}},
                ]))
            pos = 0; best = None; avg_all = None
            if rank_rows:
                if position_metric == "samples":
                    best = rank_rows[0]["samples_total"]
                    avg_all = round(sum(r["samples_total"] for r in rank_rows)/len(rank_rows), 2)
                else:
                    best = rank_rows[0]["avg_seg"]
                    avg_all = round(sum(r["avg_seg"] for r in rank_rows)/len(rank_rows), 2)
                for i, r in enumerate(rank_rows, start=1):
                    if r["_id"]["local"] in (local, local_norm):
                        pos = i
                        break
            return {"progress": [{
                "type": "local_ranking",
                "scope": "empresa",
                "local": local,
                "current_value": round(current_val, 2) if (current_val is not None and position_metric == "avg") else current_val,
                "current_position": pos,
                "best_value": best,
                "avg_value": avg_all,
            }]} 
        doc = db.kpis_tiempos_local_mensual.find_one({"periodo": periodo_dash, "local": {"$in": [local, local_norm]}})
        if not doc:
            return {"progress": [], "summary": f"Sin KPIs de local para {local}"}
        byc = doc.get("by_centro") or []
        progress: List[Dict[str, Any]] = []
        for cslug in centers:
            it = next((x for x in byc if (x.get("centro_slug") or "") == cslug), None)
            if not it:
                continue
            if position_metric == "samples":
                rows = list(db.kpis_tiempos_local_mensual.aggregate([
                    {"$match": {"periodo": periodo_dash}},
                    {"$unwind": "$by_centro"},
                    {"$match": {"by_centro.centro_slug": cslug}},
                    {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$by_centro.samples_total", 0]}}}},
                    {"$sort": {"samples_total": -1}},
                ]))
                pos = 0; best = None; avg_all = None
                if rows:
                    best = rows[0]["samples_total"]
                    avg_all = round(sum(r["samples_total"] for r in rows)/len(rows), 2)
                    for i, r in enumerate(rows, start=1):
                        if r["_id"]["local"] in (local, local_norm):
                            pos = i
                            break
                progress.append({
                    "type": "local_center",
                    "center": {"slug": cslug, "name": it.get("centro_nombre")},
                    "local": local,
                    "current_value": it.get("samples_total"),
                    "current_position": pos or it.get("puesto_empresa_samples"),
                    "best_value": best,
                    "avg_value": avg_all,
                })
            else:
                progress.append({
                    "type": "local_center",
                    "center": {"slug": cslug, "name": it.get("centro_nombre")},
                    "local": local,
                    "current_value": it.get("avg_seg"),
                    "current_position": it.get("puesto_empresa"),
                    "best_value": it.get("best_empresa"),
                    "avg_value": it.get("avg_empresa"),
                })
        if not progress:
            return {"progress": [], "summary": "Sin datos para los centros seleccionados"}
        return {"progress": progress}

    # ---------------- Anual ----------------
    year = (periodo_dash or "")[:4]
    pmin = int(f"{year}01"); pmax = int(f"{year}12")
    by_local: Dict[str, int] = {}
    suc_map = _suc_id_to_sigla(db)
    for a in db.asistencia_diaria_intranet.find({"periodo": {"$gte": pmin, "$lte": pmax}, "rut": int(rut) if rut.isdigit() else rut}, {"sigla_local": 1, "local": 1, "id_sucursal": 1}):
        loc = (a.get("sigla_local") or a.get("local") or "").strip()
        if not loc:
            sid = a.get("id_sucursal")
            try:
                loc = (suc_map.get(int(sid)) or "").strip()
            except Exception:
                loc = ""
        if not loc:
            continue
        by_local[loc] = by_local.get(loc, 0) + 1
    if not by_local:
        return {"progress": [], "summary": "Sin asistencia en el año"}
    local = max(by_local.items(), key=lambda x: x[1])[0]
    local_norm = _norm_sigla(local)

    if level == "overall":
        rows = list(db.kpis_tiempos_local_mensual.aggregate([
            {"$match": {"local": {"$in": [local, local_norm]}, "periodo": {"$regex": f"^{year}-"}, **({"avg_seg": {"$ne": None, "$gt": 0}} if position_metric == "avg" else {})}},
            {"$group": {"_id": None, **({"avg_seg": {"$avg": "$avg_seg"}} if position_metric == "avg" else {"samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}})}},
        ]))
        if not rows:
            return {"progress": [], "summary": f"Sin KPIs anuales para {local}"}
        current_val = rows[0].get("avg_seg") if position_metric == "avg" else rows[0].get("samples_total")

        if position_metric == "samples":
            rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                {"$sort": {"samples_total": -1}},
            ]))
        else:
            rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                {"$match": {"periodo": {"$regex": f"^{year}-"}, "avg_seg": {"$ne": None, "$gt": 0}}},
                {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                {"$sort": {"avg_seg": 1}},
            ]))
        pos = 0; best = None; avg_all = None
        if rank_rows:
            if position_metric == "samples":
                best = rank_rows[0]["samples_total"]
                avg_all = round(sum(r["samples_total"] for r in rank_rows)/len(rank_rows), 2)
            else:
                best = rank_rows[0]["avg_seg"]
                avg_all = round(sum(r["avg_seg"] for r in rank_rows)/len(rank_rows), 2)
            for i, r in enumerate(rank_rows, start=1):
                if r["_id"]["local"] in (local, local_norm):
                    pos = i
                    break
        return {"progress": [{
            "type": "local_ranking",
            "scope": "empresa",
            "local": local,
            "current_value": round(current_val, 2) if (current_val is not None and position_metric == "avg") else current_val,
            "current_position": pos,
            "best_value": best,
            "avg_value": avg_all,
        }]}

    # level == center (anual)
    centers = [str(x).strip() for x in (params.get("selected_centers") or []) if str(x).strip()]
    if not centers:
        # Fallback anual: mostrar progreso 'overall' si no hay centros seleccionados
        rows = list(db.kpis_tiempos_local_mensual.aggregate([
            {"$match": {"local": {"$in": [local, local_norm]}, "periodo": {"$regex": f"^{year}-"}, **({"avg_seg": {"$ne": None, "$gt": 0}} if position_metric == "avg" else {})}},
            {"$group": {"_id": None, **({"avg_seg": {"$avg": "$avg_seg"}} if position_metric == "avg" else {"samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}})}},
        ]))
        if not rows:
            return {"progress": [], "summary": f"Sin KPIs anuales para {local}"}
        current_val = rows[0].get("avg_seg") if position_metric == "avg" else rows[0].get("samples_total")

        if position_metric == "samples":
            rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$samples_total", 0]}}}},
                {"$sort": {"samples_total": -1}},
            ]))
        else:
            rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                {"$match": {"periodo": {"$regex": f"^{year}-"}, "avg_seg": {"$ne": None, "$gt": 0}}},
                {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$avg_seg"}}},
                {"$sort": {"avg_seg": 1}},
            ]))
        pos = 0; best = None; avg_all = None
        if rank_rows:
            if position_metric == "samples":
                best = rank_rows[0]["samples_total"]
                avg_all = round(sum(r["samples_total"] for r in rank_rows)/len(rank_rows), 2)
            else:
                best = rank_rows[0]["avg_seg"]
                avg_all = round(sum(r["avg_seg"] for r in rank_rows)/len(rank_rows), 2)
            for i, r in enumerate(rank_rows, start=1):
                if r["_id"]["local"] in (local, local_norm):
                    pos = i
                    break
        return {"progress": [{
            "type": "local_ranking",
            "scope": "empresa",
            "local": local,
            "current_value": round(current_val, 2) if (current_val is not None and position_metric == "avg") else current_val,
            "current_position": pos,
            "best_value": best,
            "avg_value": avg_all,
        }]} 

    progress: List[Dict[str, Any]] = []
    for cslug in centers:
        if position_metric == "samples":
            rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                {"$unwind": "$by_centro"},
                {"$match": {"by_centro.centro_slug": cslug}},
                {"$group": {"_id": {"local": "$local"}, "samples_total": {"$sum": {"$ifNull": ["$by_centro.samples_total", 0]}}}},
                {"$sort": {"samples_total": -1}},
            ]))
            pos = 0; best = None; avg_all = None
            cur_val = None
            if rank_rows:
                best = rank_rows[0]["samples_total"]
                avg_all = round(sum(x["samples_total"] for x in rank_rows)/len(rank_rows), 2)
                for i, rr in enumerate(rank_rows, start=1):
                    if rr["_id"]["local"] in (local, local_norm):
                        pos = i
                        cur_val = rr.get("samples_total")
                        break
            progress.append({
                "type": "local_center",
                "center": {"slug": cslug, "name": None},
                "local": local,
                "current_value": cur_val,
                "current_position": pos,
                "best_value": best,
                "avg_value": avg_all,
            })
        else:
            rank_rows = list(db.kpis_tiempos_local_mensual.aggregate([
                {"$match": {"periodo": {"$regex": f"^{year}-"}}},
                {"$unwind": "$by_centro"},
                {"$match": {"by_centro.centro_slug": cslug, "by_centro.avg_seg": {"$ne": None, "$gt": 0}}},
                {"$group": {"_id": {"local": "$local"}, "avg_seg": {"$avg": "$by_centro.avg_seg"}}},
                {"$sort": {"avg_seg": 1}},
            ]))
            pos = 0; best = None; avg_all = None; cur_val = None
            if rank_rows:
                best = rank_rows[0]["avg_seg"]
                avg_all = round(sum(x["avg_seg"] for x in rank_rows)/len(rank_rows), 2)
                for i, rr in enumerate(rank_rows, start=1):
                    if rr["_id"]["local"] in (local, local_norm):
                        pos = i
                        cur_val = rr.get("avg_seg")
                        break
            progress.append({
                "type": "local_center",
                "center": {"slug": cslug, "name": None},
                "local": local,
                "current_value": round(cur_val, 2) if (cur_val is not None) else None,
                "current_position": pos,
                "best_value": best,
                "avg_value": avg_all,
            })

    if not progress:
        return {"progress": [], "summary": "Sin datos para los centros seleccionados"}
    return {"progress": progress}
