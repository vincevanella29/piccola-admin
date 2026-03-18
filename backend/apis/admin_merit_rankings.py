# apis/admin_merit_rankings.py
"""
Admin Merit Rankings API
────────────────────────
Nivel 3-5 → ven TODA la empresa (igual que ventas.py)
Nivel 6   → ven solo sus locales (por allowed_local_filter / perms)

GET /admin/merits/competitions        → lista de reglas activas/históricas
GET /admin/merits/leaderboard         → ranking por regla+periodo con ventas
GET /admin/merits/leaderboard/filters → opciones de filtros
"""

import logging
from typing import Optional, List, Dict, Any, Set
from collections import defaultdict
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, HTTPException
from dateutil.relativedelta import relativedelta

from utils.web3mongo import db
from utils.auth.session import verify_session

from config.roles.access_locals import (
    get_perms_from_user,
    allowed_local_filter,
    validate_include_local_or_403,
    derive_allowed_siglas_from_slugs,
)
from config.roles.access import get_effective_role_level_from_user
from config.gamification.rules import get_rule_modules as _get_rule_modules

router = APIRouter()
logger = logging.getLogger(__name__)

RULES       = db.gamification_meritocracy_rules
RESULTS     = db.meritocracy_kpi_results
WORKERS     = db.trabajadores_vpn
KPIS_EMP    = db.kpis_empleado_mensual     # Garzones, meseros, cocina…
KPIS_ADM    = db.kpis_admin_mensual        # Administradores, supervisores


# ── Helpers ──────────────────────────────────────────────────────────────────

def _last_n_months(n: int) -> List[str]:
    now = datetime.now()
    start = datetime(now.year, now.month, 1)
    return list(reversed([
        (start - relativedelta(months=i)).strftime("%Y-%m")
        for i in range(n)
    ]))


def _to_objectid(val: Any) -> Optional[ObjectId]:
    """Convierte un string a ObjectId, devuelve None si falla."""
    try:
        return ObjectId(str(val))
    except Exception:
        return None


def _rank_with_ties(items: List[Dict], key: str) -> Dict[str, int]:
    ranks: Dict[str, int] = {}
    last_val = None
    rank = 0
    for i, item in enumerate(items, 1):
        v = float(item.get(key) or 0)
        if last_val is None or v < last_val:
            rank = i
            last_val = v
        ranks[str(item["rut"])] = rank
    return ranks


def _enrich_workers(ruts: List[str]) -> Dict[str, Dict]:
    int_ruts = [int(r) for r in ruts if r.isdigit()]
    workers = list(WORKERS.find(
        {"$or": [{"rut": {"$in": ruts}}, {"rut": {"$in": int_ruts}}]},
        {"rut": 1, "nombres": 1, "apellidopaterno": 1, "cargo": 1,
         "sucursal": 1, "seccion": 1, "profile_image_url": 1}
    ))
    out: Dict[str, Dict] = {}
    for w in workers:
        rut_str = str(w.get("rut", ""))
        out[rut_str] = {
            "nombre":            w.get("nombres", ""),
            "apellido":          w.get("apellidopaterno", ""),
            "local":             w.get("sucursal", ""),
            "cargo":             w.get("cargo", ""),
            "seccion":           w.get("seccion", ""),
            "profile_image_url": w.get("profile_image_url"),
        }
    return out


# ── KPI collection routing por template_key ──────────────────────────────────
# Indica qué colecciones se leen y cómo interpretar los campos.
# Es la única fuente de verdad para el Admin Merit Rankings.

_TEMPLATE_CATEGORY: Dict[str, str] = {
    "sales_ranking_position":   "sales",
    "sales_top_category":       "sales",
    "admin_sales_ranking":      "sales_admin",
    "admin_sales_top_category": "sales_admin",
    "times_metrics_employee":   "times_employee",
    "times_metrics_local":      "times_local",
    "attendance_full_month":    "attendance",
}


# Mapeo metric_key → campo del doc + label legible (sales_ranking_position y admin_sales_ranking)
_SALES_METRIC_FIELDS: Dict[str, Dict[str, str]] = {
    "sales":            {"path": "sales",              "valor_key": "total",  "label": "Ventas totales",    "unit": "clp"},
    "avg_per_table":    {"path": "promedio_por_mesa",  "valor_key": "valor",  "label": "Prom. por mesa",    "unit": "clp"},
    "customers_served": {"path": "personas_atendidas", "valor_key": "valor",  "label": "Personas atendidas","unit": "pers"},
    "avg_per_customer": {"path": "promedio_por_persona","valor_key": "valor", "label": "Prom. por persona", "unit": "clp"},
    "avg_daily_sales":  {"path": "promedio_venta_diaria","valor_key": "valor","label": "Venta diaria prom", "unit": "clp"},
}


def _get_kpis_dynamic(
    template_key: str,
    periodo_dash: str,
    ruts: List[str],
    rule: Optional[Dict] = None,
) -> Dict[str, Dict]:
    """
    Lee la colección primaria según el template_key del módulo,
    devolviendo un mapa rut -> kpi_dict con campos normalizados.
    Respeta metric_key / level / metric / position_metric de la regla.
    """
    if not ruts:
        return {}
    int_ruts = [int(r) for r in ruts if r.isdigit()]
    ruts_query = ruts + [str(r) for r in int_ruts]

    category = _TEMPLATE_CATEGORY.get(template_key, "sales")
    params   = (rule or {}).get("params") or {}

    # ── Ventas empleado ────────────────────────────────────────────────────────
    if category == "sales" and template_key == "sales_ranking_position":
        metric_key = params.get("metric_key", "sales")
        mf = _SALES_METRIC_FIELDS.get(metric_key, _SALES_METRIC_FIELDS["sales"])
        docs = list(KPIS_EMP.find(
            {"periodo": periodo_dash, "rut": {"$in": ruts_query}},
            {"rut": 1, "local": 1, "sales": 1, "promedio_por_mesa": 1,
             "personas_atendidas": 1, "total_mesas": 1, "promedio_por_persona": 1,
             "promedio_venta_diaria": 1, "es_competidor": 1}
        ))
        out: Dict[str, Dict] = {}
        for d in docs:
            rut   = str(d.get("rut", ""))
            sales = d.get("sales") or {}
            pm    = d.get("promedio_por_mesa") or {}
            ppers = d.get("promedio_por_persona") or {}
            pvd   = d.get("promedio_venta_diaria") or {}
            # valor según metric_key de la regla
            field_doc = d.get(mf["path"]) or {}
            mval = float(sales.get("total") or 0) if mf["path"] == "sales" else float(field_doc.get(mf["valor_key"]) or 0)
            out[rut] = {
                "kpi_source": "empleado", "kpi_category": "sales",
                "metric_value": mval, "metric_label": mf["label"], "metric_unit": mf["unit"],
                "sales_total": float(sales.get("total") or 0),
                "puesto_empresa_ventas": int(sales.get("puesto_empresa") or 0),
                "puesto_local_ventas":   int(sales.get("puesto_local") or 0),
                "top_empresa": float(sales.get("top_empresa") or sales.get("best_empresa") or 0),
                "top_local":   float(sales.get("top_local") or sales.get("best_local") or 0),
                "avg_empresa": float(sales.get("avg_empresa") or 0),
                "avg_local":   float(sales.get("avg_local") or 0),
                "promedio_mesa":       float(pm.get("valor") or 0),
                "pm_mesa_puesto_emp":  int(pm.get("puesto_empresa") or 0),
                "pm_mesa_puesto_local":int(pm.get("puesto_local") or 0),
                "promedio_persona":    float(ppers.get("valor") or 0),
                "avg_venta_diaria":    float(pvd.get("valor") or pvd.get("avg_diario") or 0),
                "dias_con_venta":      int(pvd.get("dias_con_venta") or pvd.get("dias") or 0),
                "personas_atendidas":  int((d.get("personas_atendidas") or {}).get("valor") or 0),
                "total_mesas":         int((d.get("total_mesas") or {}).get("valor") or 0),
                "kpi_local": d.get("local", ""), "es_competidor": bool(d.get("es_competidor")),
            }
        logger.info(f"[ADMIN_MERITS] _get_kpis_dynamic sales metric={metric_key} template={template_key} → {len(out)} docs")
        return out

    # ── Ventas por categoría (sales_top_category / admin_sales_top_category) ──
    if template_key in ("sales_top_category", "admin_sales_top_category"):
        metric   = params.get("metric", "amount")   # 'amount' | 'quantity'
        level    = params.get("level", "family")     # 'family' | 'subfamily' | 'product'
        sel_keys = [str(x).strip() for x in (params.get("selected_keys") or []) if str(x).strip()]
        if not sel_keys:
            raw = (params.get("name") or "").strip()
            cut = raw.split("—")[0].split("-")[0].strip() if raw else ""
            if cut:
                sel_keys = [cut]
        label_keys = ", ".join(sel_keys[:2]) + ("..." if len(sel_keys) > 2 else "")
        label = f"{'Monto' if metric == 'amount' else 'Qty'} {level}: {label_keys or 'todas'}"
        unit  = "clp" if metric == "amount" else "qty"
        coll_sales = KPIS_EMP if template_key == "sales_top_category" else KPIS_ADM
        cat_src = "sales" if template_key == "sales_top_category" else "sales_admin"
        docs = list(coll_sales.find(
            {"periodo": periodo_dash, "rut": {"$in": ruts_query}},
            {"rut": 1, "local": 1, "sales": 1, "sales_by_category": 1, "sales_by_item": 1, "es_competidor": 1}
        ))
        out_cat: Dict[str, Dict] = {}
        for d in docs:
            rut   = str(d.get("rut", ""))
            sales = d.get("sales") or {}
            cat_val = 0.0
            if level in ("family", "subfamily"):
                key_field = "familia" if level == "family" else "subfamilia"
                for cat in (d.get("sales_by_category") or []):
                    norm = (cat.get(key_field) or "").strip()
                    if not sel_keys or norm in sel_keys:
                        cat_val += float(cat.get("total" if metric == "amount" else "cantidad") or 0)
            elif level == "product":
                for item in (d.get("sales_by_item") or []):
                    key = (item.get("nombre") or str(item.get("sku", "")) or "").strip()
                    if not sel_keys or key in sel_keys:
                        cat_val += float(item.get("total" if metric == "amount" else "cantidad") or 0)
            out_cat[rut] = {
                "kpi_source": cat_src, "kpi_category": cat_src,
                "metric_value": cat_val, "metric_label": label, "metric_unit": unit,
                "sales_total": float(sales.get("total") or 0),
                "puesto_empresa_ventas": int(sales.get("puesto_empresa") or 0),
                "puesto_local_ventas":   int(sales.get("puesto_local") or 0),
                "top_empresa": 0.0, "top_local": 0.0, "avg_empresa": 0.0, "avg_local": 0.0,
                "kpi_local": d.get("local", ""), "es_competidor": bool(d.get("es_competidor")),
            }
        logger.info(f"[ADMIN_MERITS] _get_kpis_dynamic sales_top_category level={level} metric={metric} → {len(out_cat)} docs")
        return out_cat

    # ── Ventas admin ranking (admin_sales_ranking y fallback sales genérico) ──
    if category in ("sales", "sales_admin"):
        metric_key = params.get("metric_key", "sales")
        mf = _SALES_METRIC_FIELDS.get(metric_key, _SALES_METRIC_FIELDS["sales"])
        coll_s = KPIS_ADM if category == "sales_admin" else KPIS_EMP
        docs = list(coll_s.find(
            {"periodo": periodo_dash, "rut": {"$in": ruts_query}},
            {"rut": 1, "local": 1, "sales": 1, "promedio_por_mesa": 1,
             "promedio_por_persona": 1, "promedio_venta_diaria": 1, "personas_atendidas": 1,
             "total_mesas": 1, "days_present_admin": 1, "es_competidor": 1}
        ))
        out_adm: Dict[str, Dict] = {}
        for d in docs:
            rut   = str(d.get("rut", ""))
            sales = d.get("sales") or {}
            pm    = d.get("promedio_por_mesa") or {}
            ppers = d.get("promedio_por_persona") or {}
            pvd   = d.get("promedio_venta_diaria") or {}
            field_doc = d.get(mf["path"]) or {}
            mval = float(sales.get("total") or 0) if mf["path"] == "sales" else float(field_doc.get(mf["valor_key"]) or 0)
            out_adm[rut] = {
                "kpi_source": "admin" if category == "sales_admin" else "empleado",
                "kpi_category": category,
                "metric_value": mval, "metric_label": mf["label"], "metric_unit": mf["unit"],
                "sales_total": float(sales.get("total") or 0),
                "puesto_empresa_ventas": int(sales.get("puesto_empresa") or 0),
                "puesto_local_ventas":   int(sales.get("puesto_local") or 0),
                "top_empresa": float(sales.get("top_empresa") or sales.get("best_empresa") or 0),
                "top_local":   float(sales.get("top_local") or sales.get("best_local") or 0),
                "avg_empresa": float(sales.get("avg_empresa") or 0),
                "avg_local":   float(sales.get("avg_local") or 0),
                "promedio_mesa":       float(pm.get("valor") or 0),
                "pm_mesa_puesto_emp":  int(pm.get("puesto_empresa") or 0),
                "pm_mesa_puesto_local":int(pm.get("puesto_local") or 0),
                "promedio_persona":    float(ppers.get("valor") or 0),
                "avg_venta_diaria":    float(pvd.get("valor") or pvd.get("avg_diario") or 0),
                "dias_con_venta":      int(pvd.get("dias_con_venta") or pvd.get("dias") or 0),
                "personas_atendidas":  int((d.get("personas_atendidas") or {}).get("valor") or 0),
                "total_mesas":         int((d.get("total_mesas") or {}).get("valor") or 0),
                "days_present_admin":  int(d.get("days_present_admin") or 0),
                "kpi_local": d.get("local", ""), "es_competidor": bool(d.get("es_competidor", True)),
            }
        logger.info(f"[ADMIN_MERITS] _get_kpis_dynamic {category} metric={metric_key} template={template_key} → {len(out_adm)} docs")
        return out_adm

    # ── Tiempos empleado (times_metrics_employee) ─────────────────────────────
    if category == "times_employee":
        position_metric = params.get("position_metric", "avg")  # 'avg' | 'samples'
        level           = params.get("level", "overall")
        scope           = params.get("ranking_scope", "empresa")
        min_days_worked = int(params.get("min_days_worked", 0) or 0)
        sel_keys        = [str(x).strip() for x in (params.get("selected_keys") or []) if str(x).strip()]
        if not sel_keys:
            raw = (params.get("name") or "").strip()
            if raw:
                if level == "center":
                    from config.gamification.rules_models.times_metrics_employee import _slugify
                    sel_keys = [_slugify(raw)]
                else:
                    cut = raw.split("—")[0].split("-")[0].strip()
                    if cut:
                        sel_keys = [cut]
        lk     = ", ".join(sel_keys[:2]) + ("..." if len(sel_keys) > 2 else "") if sel_keys else "overall"
        mlabel = f"{'Muestras' if position_metric == 'samples' else 'T.Prom'} ({lk})"
        munit  = "muestras" if position_metric == "samples" else "seg"

        # ── 1 query bulk — usar puestos PRE-CALCULADOS por el worker ──
        proj = {"rut": 1, "local": 1, "tiempos": 1, "samples_total": 1, "es_competidor": 1}
        if level == "center":    proj["by_centro"]    = 1
        if level == "family":    proj["by_familia"]   = 1
        if level == "subfamily": proj["by_subfamilia"] = 1
        docs_t = list(db.kpis_tiempos_empleado_mensual.find(
            {"periodo": periodo_dash, "rut": {"$in": ruts_query}, "es_competidor": True}, proj
        ))
        out_t: Dict[str, Dict] = {}
        for d in docs_t:
            rut = str(d.get("rut", ""))
            t   = d.get("tiempos") or {}

            if level == "overall":
                # Puestos pre-calculados en tiempos.*
                if position_metric == "samples":
                    mval = float(d.get("samples_total") or t.get("samples_share") or 0)
                    p_emp = int(t.get("puesto_empresa_samples") or 0)
                    p_loc = int(t.get("puesto_local_samples") or 0)
                else:
                    mval = float(t.get("avg_seg") or 0)
                    p_emp = int(t.get("puesto_empresa") or 0)
                    p_loc = int(t.get("puesto_local") or 0)
                if mval <= 0:
                    continue
                out_t[rut] = {
                    "kpi_source": "tiempos_empleado", "kpi_category": "times_employee",
                    "metric_value": mval, "metric_label": mlabel, "metric_unit": munit,
                    "avg_seg": float(t.get("avg_seg") or 0),
                    "samples": float(d.get("samples_total") or t.get("samples_share") or 0),
                    "puesto_empresa_tiempos": p_emp,
                    "puesto_local_tiempos":   p_loc,
                    "top_empresa": float(t.get("best_empresa") or 0),
                    "top_local":   float(t.get("best_local") or 0),
                    "avg_empresa": float(t.get("avg_empresa") or 0),
                    "avg_local":   float(t.get("avg_local") or 0),
                    "dias_registro": int(t.get("dias_con_registro") or 0),
                    "kpi_local": d.get("local", ""), "es_competidor": True,
                    "sales_total": 0,
                }
            else:
                # Category levels: leer puestos pre-calculados del sub-array
                bk_map = {"center": "by_centro", "family": "by_familia", "subfamily": "by_subfamilia"}
                kf_map = {"center": "centro_slug", "family": "familia", "subfamily": "subfamilia"}
                bk_field = bk_map.get(level, "by_centro")
                kf       = kf_map.get(level, "centro_slug")
                breakdown = d.get(bk_field) or []
                # Filtrar items relevantes por selected_keys
                relevant = []
                for item in breakdown:
                    kv = (item.get(kf) or "").strip()
                    if not sel_keys or kv in sel_keys:
                        relevant.append(item)
                if not relevant:
                    continue
                # Calcular métrica agregada y tomar el mejor puesto
                if position_metric == "samples":
                    mval = sum(float(i.get("samples_total") or 0) for i in relevant)
                    # Puesto: si hay 1 key, usar el pre-calculado; si hay varias, usar el mejor
                    p_emp = min((int(i.get("puesto_empresa_samples") or 999) for i in relevant), default=0)
                    p_loc = min((int(i.get("puesto_local_samples") or 999) for i in relevant), default=0)
                else:
                    total_w = sum(float(i.get("dias_con_registro") or 1) for i in relevant)
                    mval = (sum(float(i.get("avg_seg") or 0) * float(i.get("dias_con_registro") or 1) for i in relevant) / total_w) if total_w > 0 else 0.0
                    p_emp = min((int(i.get("puesto_empresa") or 999) for i in relevant), default=0)
                    p_loc = min((int(i.get("puesto_local") or 999) for i in relevant), default=0)
                if mval <= 0:
                    continue
                # Limpiar 999 (sin puesto)
                p_emp = p_emp if p_emp < 999 else 0
                p_loc = p_loc if p_loc < 999 else 0
                # best/avg del primer item relevante (referencia)
                ref = relevant[0]
                out_t[rut] = {
                    "kpi_source": "tiempos_empleado", "kpi_category": "times_employee",
                    "metric_value": mval, "metric_label": mlabel, "metric_unit": munit,
                    "avg_seg": mval if position_metric != "samples" else 0.0,
                    "samples": mval if position_metric == "samples" else 0.0,
                    "puesto_empresa_tiempos": p_emp,
                    "puesto_local_tiempos":   p_loc,
                    "top_empresa": float(ref.get("best_empresa") or 0),
                    "top_local":   float(ref.get("best_local") or 0),
                    "avg_empresa": float(ref.get("avg_empresa") or 0),
                    "avg_local":   float(ref.get("avg_local") or 0),
                    "dias_registro": sum(int(i.get("dias_con_registro") or 0) for i in relevant),
                    "kpi_local": d.get("local", ""), "es_competidor": True,
                    "sales_total": 0,
                }
        logger.info(
            f"[ADMIN_MERITS] _get_kpis_dynamic times_employee level={level} pm={position_metric} "
            f"sel={sel_keys} scope={scope} → {len(out_t)} docs (1 find query)"
        )
        return out_t



    # ── Tiempos local (la métrica es del local, no del empleado directamente) ──
    if category == "times_local":
        # Para times_local los ganadores se determinan por el local donde trabajan.
        # Solo devolvemos info básica de asistencia (sin KPI numérico por empleado).
        out_l: Dict[str, Dict] = {}
        for rut in ruts:
            out_l[rut] = {
                "kpi_source":   "tiempos_local",
                "kpi_category": "times_local",
                "metric_value": 0,
                "metric_label": "Tiempos de local",
                "metric_unit":  "seg",
                "sales_total":  0,
                "top_empresa":  0,
            }
        return out_l

    # ── Asistencia ───────────────────────────────────────────────────────────
    if category == "attendance":
        out_a: Dict[str, Dict] = {}
        for rut in ruts:
            out_a[rut] = {
                "kpi_source":   "asistencia",
                "kpi_category": "attendance",
                "metric_value": 1,          # ganador = asistencia perfecta
                "metric_label": "Asistencia perfecta",
                "metric_unit":  "bool",
                "sales_total":  0,
                "top_empresa":  0,
            }
        return out_a

    # Fallback genérico
    return {}


def _run_evaluate_fallback(
    rule: Dict, periodo_dash: str
) -> List[str]:
    """
    Llama module.evaluate(db, rule, periodo_dash) directamente cuando
    meritocracy_kpi_results no tiene resultados (worker pendiente).
    Devuelve la lista de RUTs ganadores o [] si falla.
    """
    template_key = rule.get("template_key", "")
    try:
        modules = _get_rule_modules()
        mod = modules.get(template_key)
        if mod and hasattr(mod, "evaluate"):
            winners = mod.evaluate(db, rule, periodo_dash)
            logger.info(f"[ADMIN_MERITS] _run_evaluate_fallback template={template_key} → {len(winners)} ganadores en vivo")
            return winners
    except Exception as e:
        logger.warning(f"[ADMIN_MERITS] _run_evaluate_fallback falló para '{template_key}': {e}")
    return []


def _extract_rule_metadata(rule: Dict) -> Dict[str, Any]:
    """Extrae metadata relevante de la regla para mostrar en el frontend.
    Usa get_rule_modules() como fuente de verdad para saber qué KPI collection usar.
    """
    params        = rule.get("params") or {}
    scope         = rule.get("scope") or {}
    cargos_cfg    = scope.get("cargos") or {}
    secciones_cfg = scope.get("secciones") or {}
    conditions    = params.get("conditions") or []
    template_key  = rule.get("template_key", "")

    # Fuente de verdad: extraer data_sources + category del módulo cargado dinámicamente
    kpi_collections: List[str] = []
    template_category = ""
    template_name     = ""
    try:
        modules = _get_rule_modules()
        mod = modules.get(template_key)
        tpl_var = f"{template_key.upper()}_RULE_TEMPLATE"
        tpl = getattr(mod, tpl_var, None) if mod else None
        if tpl:
            kpi_collections   = [s.get("collection", "") for s in (tpl.get("data_sources") or [])]
            template_category = tpl.get("category", _TEMPLATE_CATEGORY.get(template_key, "sales"))
            template_name     = tpl.get("name", "")
    except Exception:
        pass

    if not template_category:
        template_category = _TEMPLATE_CATEGORY.get(template_key, "sales")

    is_admin_rule = (
        template_key.startswith("admin_") or
        any("admin" in c for c in kpi_collections)
    )

    return {
        "metric_key":        params.get("metric_key", params.get("level", "total_sales")),
        "period_mode":       params.get("period_mode", "month"),
        "ranking_scope":     params.get("ranking_scope", "empresa"),
        "position_type":     params.get("position_type", "top_n"),
        "ranking_position":  params.get("ranking_position"),
        "position_from":     params.get("position_from"),
        "position_to":       params.get("position_to"),
        "min_days_worked":   params.get("min_days_worked", 0),
        "conditions":        conditions,
        "include_cargos":    cargos_cfg.get("include") or [],
        "exclude_cargos":    cargos_cfg.get("exclude") or [],
        "include_secciones": secciones_cfg.get("include") or [],
        "exclude_secciones": secciones_cfg.get("exclude") or [],
        "template_key":      template_key,
        "template_category": template_category,
        "template_name":     template_name,
        "kpi_collections":   kpi_collections,
        "is_admin_rule":     is_admin_rule,
        # Extra params por tipo de template
        "level":             params.get("level"),
        "position_metric":   params.get("position_metric"),
        "selected_keys":     params.get("selected_keys") or params.get("selected_centers") or [],
        "label_name":        params.get("name") or params.get("names") or "",
        "metric":            params.get("metric"),
    }


def _results_for_rule(rid_str: str, periodo_dash: str) -> List[Dict]:
    """
    Busca en meritocracy_kpi_results por rule_id que puede ser:
      - ObjectId
      - string (algunos documentos viejos usan string directo)
    Hace OR de ambas formas para no perder nada.
    """
    oid = _to_objectid(rid_str)
    query: Dict[str, Any] = {"periodo": periodo_dash}
    if oid:
        query["rule_id"] = {"$in": [oid, rid_str]}
    else:
        query["rule_id"] = rid_str

    docs = list(RESULTS.find(query, {"rut": 1, "status": 1, "merit_points": 1, "finalized": 1}))
    logger.info(
        f"[ADMIN_MERITS] _results_for_rule rule_id={rid_str} periodo={periodo_dash} "
        f"oid_ok={oid is not None} → {len(docs)} results_docs"
    )
    return docs


# ═════════════════════════════════════════════════════════════════════════════
# 1) Lista de competencias
# ═════════════════════════════════════════════════════════════════════════════
@router.get(
    "/admin/merits/competitions",
    summary="Lista de competencias de meritocracia (activas e históricas)",
)
async def list_competitions(
    only_active: Optional[bool] = Query(None),
    user: dict = Depends(verify_session),
):
    query: Dict[str, Any] = {}
    if only_active is True:
        query["is_active"] = True
    elif only_active is False:
        query["is_active"] = {"$ne": True}

    rules = list(RULES.find(query, {
        "_id": 1, "rule_name": 1, "template_key": 1, "is_active": 1,
        "merit_points": 1, "segment_token_id": 1, "params": 1, "scope": 1
    }))

    logger.info(
        f"[ADMIN_MERITS] list_competitions only_active={only_active} → {len(rules)} rules en BD"
    )

    competitions = []
    for r in rules:
        params = r.get("params") or {}
        is_act = bool(r.get("is_active"))
        logger.info(
            f"[ADMIN_MERITS]   regla='{r.get('rule_name')}' "
            f"id={r['_id']} is_active={is_act} template={r.get('template_key')}"
        )
        competitions.append({
            "rule_id":          str(r["_id"]),
            "rule_name":        r.get("rule_name", ""),
            "template_key":     r.get("template_key", ""),
            "is_active":        is_act,
            "merit_points":     r.get("merit_points", 0),
            "segment_token_id": r.get("segment_token_id"),
            "period_mode":      params.get("period_mode", "month"),
            "metric_key":       params.get("metric_key", "sales"),
            "ranking_scope":    params.get("ranking_scope", "empresa"),
            "ranking_position": params.get("ranking_position"),
            "conditions":       params.get("conditions", []),
            "scope":            r.get("scope"),
        })

    return {"ok": True, "competitions": competitions, "total": len(competitions)}


# ═════════════════════════════════════════════════════════════════════════════
# 2) Filtros disponibles
# ═════════════════════════════════════════════════════════════════════════════
@router.get(
    "/admin/merits/leaderboard/filters",
    summary="Opciones de filtros para el leaderboard admin",
)
async def leaderboard_filters(user: dict = Depends(verify_session)):
    perms = get_perms_from_user(user)
    periods = _last_n_months(13)

    allowed_slugs = allowed_local_filter(perms)
    locs_docs = list(WORKERS.aggregate([
        {"$match": {"activo": 1, "sucursal": {"$ne": None}}},
        {"$group": {"_id": "$sucursal"}},
        {"$sort":  {"_id": 1}}
    ]))
    all_locales = [str(x["_id"]) for x in locs_docs if x.get("_id")]

    if allowed_slugs is None:
        locales = all_locales
    elif not allowed_slugs:
        locales = []
    else:
        allowed_siglas = derive_allowed_siglas_from_slugs(allowed_slugs)
        locales = [l for l in all_locales if l.upper() in allowed_siglas or l in allowed_slugs]

    logger.info(
        f"[ADMIN_MERITS] leaderboard_filters allowed_slugs={allowed_slugs} "
        f"→ {len(locales)} locales, {len(periods)} periodos"
    )

    cargos_docs = list(WORKERS.aggregate([
        {"$match": {"activo": 1, "cargo": {"$ne": None}}},
        {"$group": {"_id": "$cargo"}},
        {"$sort":  {"_id": 1}}
    ]))
    cargos = [str(x["_id"]) for x in cargos_docs if x.get("_id")]

    return {
        "ok":      True,
        "periodos": ["all", *periods],
        "locales":  ["all", *locales],
        "cargos":   ["all", *cargos],
    }


# ═════════════════════════════════════════════════════════════════════════════
# 3) Leaderboard
# ═════════════════════════════════════════════════════════════════════════════
@router.get(
    "/admin/merits/leaderboard",
    summary="Ranking de empleados por competencia y período con datos de ventas",
)
async def merit_leaderboard(
    rule_id:       Optional[str] = Query(None),
    periodo:       Optional[str] = Query(None),
    sucursal:      Optional[str] = Query(None),
    cargo:         Optional[str] = Query(None),
    seccion:       Optional[str] = Query(None),
    include_sales: bool          = Query(True),
    user: dict = Depends(verify_session),
):
    # ── Permisos ──────────────────────────────────────────────────────────
    perms = get_perms_from_user(user)
    role_level = get_effective_role_level_from_user(user) or -1

    # Nivel 3-5 → acceso TOTAL (admin/sub-admin). Solo nivel 6 queda restringido a su local.
    allowed_siglas: Optional[Set[str]] = None  # None = sin filtro de local

    if role_level >= 6:
        # Supervisor de local: validar sucursal explícita y calcular sus locales
        sucursal_list = [sucursal] if sucursal else []
        validate_include_local_or_403(perms, sucursal_list)

        allowed_slugs = allowed_local_filter(perms)
        if allowed_slugs is not None and not allowed_slugs:
            logger.warning(
                f"[ADMIN_MERITS] leaderboard: usuario nivel={role_level} sin locales asignados → vacío"
            )
            return {"ok": True, "periodo": periodo or datetime.now().strftime("%Y-%m"),
                    "restricted_to_locals": [], "competitions": []}

        if allowed_slugs is not None:
            allowed_siglas = derive_allowed_siglas_from_slugs(allowed_slugs)

    logger.info(
        f"[ADMIN_MERITS] leaderboard: role_level={role_level} "
        f"allowed_siglas={allowed_siglas} (None=sin restriccion de local)"
    )

    # ── Periodo ───────────────────────────────────────────────────────────
    periodo_dash = periodo or datetime.now().strftime("%Y-%m")

    # ── Reglas ────────────────────────────────────────────────────────────
    rules_to_query: List[Dict] = []
    if rule_id:
        oid = _to_objectid(rule_id)
        rule_doc = RULES.find_one({"_id": oid}) if oid else RULES.find_one({"_id": rule_id})
        if not rule_doc:
            raise HTTPException(404, f"Regla '{rule_id}' no encontrada.")
        rules_to_query = [rule_doc]
        logger.info(f"[ADMIN_MERITS] leaderboard: consultando regla específica rule_id={rule_id}")
    else:
        # Sin rule_id: traemos TODAS las reglas activas
        rules_to_query = list(RULES.find({"is_active": True}))
        logger.info(
            f"[ADMIN_MERITS] leaderboard: periodo={periodo_dash} "
            f"→ {len(rules_to_query)} reglas activas en BD"
        )
        for r in rules_to_query:
            logger.info(f"[ADMIN_MERITS]   regla activa: '{r.get('rule_name')}' id={r['_id']}")

    if not rules_to_query:
        logger.warning("[ADMIN_MERITS] leaderboard: no hay reglas activas en la BD")
        return {"ok": True, "periodo": periodo_dash,
                "restricted_to_locals": list(allowed_siglas) if allowed_siglas else None,
                "competitions": []}

    # ── Procesar cada regla ───────────────────────────────────────────────
    competition_results = []

    for rule in rules_to_query:
        rid   = str(rule["_id"])
        rname = rule.get("rule_name", "")
        params = rule.get("params") or {}

        # BUG FIX: usar helper que busca por ObjectId Y string
        results_docs = _results_for_rule(rid, periodo_dash)

        logger.info(
            f"[ADMIN_MERITS] regla='{rname}' id={rid} periodo={periodo_dash} "
            f"→ {len(results_docs)} resultados en meritocracy_kpi_results"
        )

        if not results_docs:
            # Sin resultados = el worker aún no corrió para este periodo/regla.
            rule_meta = _extract_rule_metadata(rule)
            competition_results.append({
                "rule_id":            rid,
                "rule_name":          rname,
                "periodo":            periodo_dash,
                "is_active":          bool(rule.get("is_active")),
                "merit_points":       rule.get("merit_points", 0),
                **rule_meta,
                "total_participants": 0,
                "fulfilled_count":    0,
                "leaderboard":        [],
                "has_data":           False,
            })
            continue

        # Mapa rut → resultado
        rut_result_map: Dict[str, Dict] = {}
        for d in results_docs:
            rut = str(d.get("rut", ""))
            if not rut:
                continue
            rut_result_map[rut] = {
                "rut":          rut,
                "status":       d.get("status", ""),
                "merit_points": float(d.get("merit_points") or 0),
                "finalized":    bool(d.get("finalized")),
            }

        all_ruts = list(rut_result_map.keys())
        logger.info(
            f"[ADMIN_MERITS] regla='{rname}' → {len(all_ruts)} ruts únicos en resultados"
        )

        worker_map = _enrich_workers(all_ruts)
        logger.info(
            f"[ADMIN_MERITS] regla='{rname}' → {len(worker_map)} workers enriquecidos de {len(all_ruts)} ruts"
        )

        kpis_map: Dict[str, Dict] = {}
        if include_sales:
            _tkey = rule.get("template_key", "")
            kpis_map = _get_kpis_dynamic(_tkey, periodo_dash, all_ruts, rule=rule)
            ruts_sin_kpi = [r for r in all_ruts if r not in kpis_map]
            if ruts_sin_kpi:
                logger.debug(
                    f"[ADMIN_MERITS] regla='{rname}' template={_tkey} — "
                    f"{len(ruts_sin_kpi)}/{len(all_ruts)} ruts sin KPI"
                )

        # Filtros de permisos + explícitos
        def _rut_has_access(rut: str) -> bool:
            if allowed_siglas is None:
                return True  # acceso total
            local = (
                worker_map.get(rut, {}).get("local") or
                kpis_map.get(rut, {}).get("kpi_local") or ""
            ).upper()
            has = local in allowed_siglas
            if not has:
                logger.debug(
                    f"[ADMIN_MERITS] rut={rut} local='{local}' NO en allowed_siglas={allowed_siglas}"
                )
            return has

        def _rut_matches_sucursal(rut: str) -> bool:
            if not sucursal:
                return True
            local = (
                worker_map.get(rut, {}).get("local") or
                kpis_map.get(rut, {}).get("kpi_local") or ""
            ).upper()
            return local == sucursal.upper()

        def _rut_matches_cargo(rut: str) -> bool:
            if not cargo:
                return True
            return worker_map.get(rut, {}).get("cargo", "") == cargo

        def _rut_matches_seccion(rut: str) -> bool:
            if not seccion:
                return True
            return worker_map.get(rut, {}).get("seccion", "") == seccion

        filtered_ruts = [
            r for r in all_ruts
            if _rut_has_access(r)
            and _rut_matches_sucursal(r)
            and _rut_matches_cargo(r)
            and _rut_matches_seccion(r)
        ]

        logger.info(
            f"[ADMIN_MERITS] regla='{rname}' template={rule.get('template_key','?')} "
            f"→ {len(filtered_ruts)} ruts tras filtros "
            f"(sucursal={sucursal}, cargo={cargo}, seccion={seccion}, allowed_siglas={allowed_siglas})"
        )

        if not filtered_ruts:
            rule_meta = _extract_rule_metadata(rule)
            competition_results.append({
                "rule_id":            rid,
                "rule_name":          rname,
                "periodo":            periodo_dash,
                "is_active":          bool(rule.get("is_active")),
                "merit_points":       rule.get("merit_points", 0),
                **rule_meta,
                "total_participants": 0,
                "fulfilled_count":    0,
                "leaderboard":        [],
                "has_data":           True,
            })
            continue

        # Construir filas enriquecidas
        leaderboard_rows = []
        for rut in filtered_ruts:
            result_info = rut_result_map.get(rut, {})
            worker_info = worker_map.get(rut, {})
            sales_info  = kpis_map.get(rut, {})

            # Valor de ranking: metric_value si hay datos, sino merit_points
            # Para tiempos (avg_seg), menor = mejor → usar puesto_empresa_tiempos pre-calculado
            _cat = sales_info.get("kpi_category", "")
            if _cat == "times_employee" and sales_info.get("puesto_empresa_tiempos"):
                # Invertir: puesto 1 (mejor) debe quedar arriba → rank_value alto
                rank_value = 10000 - sales_info.get("puesto_empresa_tiempos", 0)
            elif include_sales and sales_info.get("metric_value", 0) != 0:
                rank_value = sales_info.get("metric_value", 0)
            else:
                rank_value = result_info.get("merit_points", 0)


            leaderboard_rows.append({
                # ─ Identidad
                "rut":                   rut,
                "nombre":                worker_info.get("nombre", ""),
                "apellido":              worker_info.get("apellido", ""),
                "local":                 worker_info.get("local") or sales_info.get("kpi_local", ""),
                "cargo":                 worker_info.get("cargo", ""),
                "seccion":               worker_info.get("seccion", ""),
                "profile_image_url":     worker_info.get("profile_image_url"),
                # ─ Mérito
                "status":                result_info.get("status", ""),
                "merit_points":          result_info.get("merit_points", 0),
                "finalized":             result_info.get("finalized", False),
                # ─ KPI genérico (funciona para ventas, tiempos, asistencia)
                "kpi_source":            sales_info.get("kpi_source", ""),
                "kpi_category":          sales_info.get("kpi_category", ""),
                "metric_value":          sales_info.get("metric_value", 0),
                "metric_label":          sales_info.get("metric_label", ""),
                "kpi_unit":              sales_info.get("metric_unit", ""),
                # ─ Ventas (compat para template sales)
                "sales_total":           sales_info.get("sales_total", 0),
                "puesto_empresa_ventas": sales_info.get("puesto_empresa_ventas", 0),
                "puesto_local_ventas":   sales_info.get("puesto_local_ventas", 0),
                # ─ Benchmarks
                "top_empresa":           sales_info.get("top_empresa", 0),
                "top_local":             sales_info.get("top_local", 0),
                "avg_empresa":           sales_info.get("avg_empresa", 0),
                "avg_local":             sales_info.get("avg_local", 0),
                # ─ KPIs extra (ventas)
                "promedio_mesa":         sales_info.get("promedio_mesa", 0),
                "pm_mesa_puesto_emp":     sales_info.get("pm_mesa_puesto_emp", 0),
                "pm_mesa_puesto_local":   sales_info.get("pm_mesa_puesto_local", 0),
                "promedio_persona":       sales_info.get("promedio_persona", 0),
                "avg_venta_diaria":       sales_info.get("avg_venta_diaria", 0),
                "dias_con_venta":         sales_info.get("dias_con_venta", 0),
                "personas_atendidas":    sales_info.get("personas_atendidas", 0),
                "total_mesas":           sales_info.get("total_mesas", 0),
                "days_present_admin":     sales_info.get("days_present_admin", 0),
                "es_competidor":         sales_info.get("es_competidor", False),
                # ─ Tiempos
                "avg_seg":               sales_info.get("avg_seg", 0),
                "samples":               sales_info.get("samples", 0),
                "puesto_empresa_tiempos":sales_info.get("puesto_empresa_tiempos", 0),
                "puesto_local_tiempos":  sales_info.get("puesto_local_tiempos", 0),
                "dias_registro":         sales_info.get("dias_registro", 0),
                # ─ Progreso completo (para que el front use el template correcto)
                "progress":              sales_info.get("progress", []),
                # ─ Sorting interno
                "_rank_value":           rank_value,
            })

        leaderboard_rows.sort(key=lambda x: float(x["_rank_value"] or 0), reverse=True)

        comp_ranks = _rank_with_ties(
            [{"rut": r["rut"], "_rank_value": r["_rank_value"]} for r in leaderboard_rows],
            key="_rank_value"
        )

        by_local: Dict[str, List] = defaultdict(list)
        for row in leaderboard_rows:
            by_local[str(row.get("local") or "—")].append(row)

        local_ranks: Dict[str, Dict[str, int]] = {}
        for loc, arr in by_local.items():
            arr_s = sorted(arr, key=lambda x: float(x["_rank_value"] or 0), reverse=True)
            local_ranks[loc] = _rank_with_ties(
                [{"rut": r["rut"], "_rank_value": r["_rank_value"]} for r in arr_s],
                key="_rank_value"
            )

        for row in leaderboard_rows:
            loc = str(row.get("local") or "—")
            row["puesto_empresa"] = comp_ranks.get(row["rut"], 0)
            row["puesto_local"]   = (local_ranks.get(loc) or {}).get(row["rut"], 0)
            del row["_rank_value"]

        fulfilled_count = sum(1 for r in leaderboard_rows if r.get("status") == "fulfilled")

        logger.info(
            f"[ADMIN_MERITS] regla='{rname}' LISTO: "
            f"{len(leaderboard_rows)} participantes, {fulfilled_count} ganadores"
        )

        rule_meta = _extract_rule_metadata(rule)
        competition_results.append({
            "rule_id":            rid,
            "rule_name":          rname,
            "periodo":            periodo_dash,
            "is_active":          bool(rule.get("is_active")),
            "merit_points":       rule.get("merit_points", 0),
            **rule_meta,
            "scope":              rule.get("scope"),
            "total_participants": len(leaderboard_rows),
            "fulfilled_count":    fulfilled_count,
            "leaderboard":        leaderboard_rows,
            "has_data":           True,
        })

    logger.info(
        f"[ADMIN_MERITS] leaderboard FINAL: "
        f"{len(competition_results)} competencias retornadas para periodo={periodo_dash}"
    )

    return {
        "ok":                   True,
        "periodo":              periodo_dash,
        "restricted_to_locals": list(allowed_siglas) if allowed_siglas is not None else None,
        "competitions":         competition_results,
    }
