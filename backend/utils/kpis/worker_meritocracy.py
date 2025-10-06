import logging
import os
import importlib.util
from datetime import datetime
from typing import Dict, List, Callable, Any, Optional

import argparse
from pymongo import UpdateOne
from dateutil.relativedelta import relativedelta
from pymongo.database import Database
from zoneinfo import ZoneInfo

from utils.web3mongo import db

# -------------------------
# Configuración y Constantes
# -------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

CL_TZ = ZoneInfo("America/Santiago")

# --- Colecciones ---
RULES_COLL = db.gamification_meritocracy_rules
EMPLOYEES_COLL = db.empleados_usuarios
TRABAJADORES_COLL = db.trabajadores_vpn
KPI_RESULT_COLL = db.meritocracy_kpi_results  # Nueva colección de resultados
CARGOS_COLL = db.cargos_intranet


def _ensure_indexes():
    """Asegura que la nueva colección de resultados tenga los índices correctos."""
    KPI_RESULT_COLL.create_index(
        [("periodo", 1), ("rut", 1), ("rule_id", 1)],
        unique=True
    )
    KPI_RESULT_COLL.create_index([("rut", 1), ("periodo", -1)])
    KPI_RESULT_COLL.create_index([("rule_id", 1)])
    KPI_RESULT_COLL.create_index([("status", 1)])
    logger.info("Índices para 'meritocracy_kpi_results' asegurados.")


# -------------------------
# Helpers de período cerrado
# -------------------------
def is_month_finalized(periodo_dash: str) -> bool:
    """
    True si el mes 'YYYY-MM' ya terminó (inicio del mes siguiente en CL_TZ).
    """
    year, month = map(int, periodo_dash.split("-"))
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1, 0, 0, tzinfo=CL_TZ)
    else:
        next_month_start = datetime(year, month + 1, 1, 0, 0, tzinfo=CL_TZ)
    now = datetime.now(CL_TZ)
    return now >= next_month_start


def is_year_finalized(year: int) -> bool:
    """
    True si el año ya terminó (inicio de 1-Enero del año siguiente en CL_TZ).
    """
    year_end = datetime(year + 1, 1, 1, 0, 0, tzinfo=CL_TZ)
    now = datetime.now(CL_TZ)
    return now >= year_end


# ------------------------------
# Lógica de carga dinámica rules
# ------------------------------
RuleEvaluator = Callable[[Database, Dict[str, Any], str], List[str]]


def load_rule_evaluators() -> Dict[str, RuleEvaluator]:
    """
    Escanea dinámicamente la carpeta 'rules_models', importa los módulos
    y devuelve un diccionario que mapea template_key a su función 'evaluate'.
    """
    evaluators: Dict[str, RuleEvaluator] = {}
    base_dir = os.path.dirname(os.path.abspath(__file__))
    rules_path = os.path.join(base_dir, '..', '..', 'config', 'gamification', 'rules_models')

    for entry in os.scandir(rules_path):
        if entry.is_file() and entry.name.endswith('.py') and not entry.name.startswith('__'):
            module_name = entry.name[:-3]
            try:
                spec = importlib.util.spec_from_file_location(module_name, entry.path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                if hasattr(module, 'TEMPLATE_KEY') and hasattr(module, 'evaluate'):
                    template_key = module.TEMPLATE_KEY
                    evaluator_func = module.evaluate
                    evaluators[template_key] = evaluator_func
                else:
                    logger.warning(f"Módulo '{module_name}' no tiene TEMPLATE_KEY o función evaluate y será ignorado.")
            except Exception as e:
                logger.error(f"Error al cargar el módulo de regla '{module_name}': {e}")

    return evaluators


# -----------------------
# Fuente de verdad empleados
# -----------------------
def get_eligible_employees() -> Dict[str, Dict]:
    """
    Obtiene TODOS los empleados ACTIVOS desde trabajadores_vpn y los enriquece
    opcionalmente con la información de wallet desde empleados_usuarios.
    """
    pipeline = [
        {"$match": {"activo": 1}},
        {"$addFields": {"rut_str": {"$toString": "$rut"}}},
        {"$lookup": {
            "from": "empleados_usuarios",
            "localField": "rut_str",
            "foreignField": "rut",
            "as": "usuario_info"
        }},
        {"$unwind": {
            "path": "$usuario_info",
            "preserveNullAndEmptyArrays": True
        }},
        {"$project": {
            "_id": 0,
            "rut": "$rut_str",
            "wallet": "$usuario_info.wallet",
            "cargo": "$cargo",
            "seccion": "$seccion",
            "sucursal": "$sucursal",
            # Fecha creación de la ficha (o fecha de ingreso como respaldo)
            "ficha_created_at": {
                "$ifNull": [
                    {"$toDate": "$fechacreacion"},
                    {"$toDate": {"$concat": ["$fechaingreso", "T00:00:00Z"]}}
                ]
            }
        }}
    ]

    employees = list(TRABAJADORES_COLL.aggregate(pipeline))
    logger.info(f"Encontrados {len(employees)} empleados activos en total para evaluar.")
    return {emp['rut']: emp for emp in employees}


def get_attendance_ruts_for_period(mesano: str) -> set:
    """Devuelve RUTs que tienen al menos 1 registro de asistencia en el período YYYYMM."""
    try:
        periodo_int = int(mesano)
    except Exception:
        return set()
    try:
        ruts = db.asistencia_diaria_intranet.distinct('rut', { 'periodo': periodo_int })
        # convertir a str como en empleados (rut_str)
        return {str(r) for r in ruts}
    except Exception as e:
        logger.warning(f"No se pudo obtener asistencia para {mesano}: {e}")
        return set()


def get_attendance_roles_for_period(mesano: str) -> Dict[str, Dict[str, Optional[str]]]:
    """Devuelve por RUT la seccion y el cargo (nombre) derivados de asistencia en el período YYYYMM.
    - Si hay múltiples asistencias en el mes, toma el último registro (fecha mayor) como representativo.
    - Para 'cargo' intenta resolver nombre desde cargos_intranet usando id_cargo/id_cargo_ficha.
    """
    try:
        periodo_int = int(mesano)
    except Exception:
        return {}

    # Recoger la última asistencia por RUT en el mes
    cursor = db.asistencia_diaria_intranet.find(
        {"periodo": periodo_int},
        {"rut": 1, "seccion": 1, "id_cargo": 1, "id_cargo_ficha": 1, "fecha_trabajada": 1}
    )
    latest: Dict[str, Dict[str, Any]] = {}
    for a in cursor:
        rut = str(a.get("rut") or "").strip()
        if not rut:
            continue
        f = a.get("fecha_trabajada")
        # Normalizar comparable
        try:
            fkey = f.timestamp() if hasattr(f, "timestamp") else None
        except Exception:
            fkey = None
        # Mantener el más reciente
        prev = latest.get(rut)
        if not prev or (fkey is not None and (prev.get("_fkey") or 0) < fkey):
            latest[rut] = {"doc": a, "_fkey": fkey or 0}

    out: Dict[str, Dict[str, Optional[str]]] = {}
    for rut, bundle in latest.items():
        a = bundle.get("doc") or {}
        seccion = (a.get("seccion") or None)
        # Resolver cargo por id
        cid = a.get("id_cargo_ficha") or a.get("id_cargo")
        cargo_name = None
        try:
            cargo_doc = None
            if cid is not None:
                cargo_doc = CARGOS_COLL.find_one({"$or": [
                    {"id_cargo": cid}, {"id": cid}
                ]}, {"cargo": 1, "seccion": 1})
            if cargo_doc:
                cargo_name = (cargo_doc.get("cargo") or None)
                # Si asistencia no trae seccion, intentar derivarla desde el cargo
                if not seccion:
                    seccion = (cargo_doc.get("seccion") or None)
        except Exception:
            cargo_name = cargo_name or None
        out[rut] = {"seccion": seccion, "cargo": cargo_name}
    return out


# -----------------------
# Proceso por período (gating)
# -----------------------
def process_period(mesano: str, evaluators: Dict[str, RuleEvaluator]):
    """
    Procesa un período 'YYYYMM' con gating:
    - Reglas 'month': solo evalúa si el mes está finalizado, si no => not_eligible_yet
    - Reglas 'year' : solo evalúa si el año está finalizado, si no => not_eligible_yet
    """
    periodo_dash = f"{mesano[:4]}-{mesano[4:6]}"
    year = int(periodo_dash[:4])
    month = int(periodo_dash[5:7])

    active_rules = list(RULES_COLL.find({"is_active": True}))
    if not active_rules:
        logger.warning("No hay reglas de meritocracia activas. Terminando.")
        return

    all_employees = get_eligible_employees()
    if not all_employees:
        logger.warning("No se encontraron empleados activos en trabajadores_vpn. Terminando.")
        return

    logger.info(f"Encontrados {len(active_rules)} reglas activas y {len(all_employees)} empleados elegibles en total.")

    bulk_operations: List[UpdateOne] = []

    # cache del estado mensual (evita recalcular)
    month_finalized = is_month_finalized(periodo_dash)

    # Filtrado por fecha de creación de ficha y por asistencia del período
    # Fecha fin del mes en CL_TZ
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1, 0, 0, tzinfo=CL_TZ)
    else:
        next_month_start = datetime(year, month + 1, 1, 0, 0, tzinfo=CL_TZ)
    month_end = next_month_start

    def _aware(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        # Si viene naive, asumimos CL_TZ para comparación consistente
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=CL_TZ)

    attendance_ruts = get_attendance_ruts_for_period(mesano)
    if not attendance_ruts:
        logger.info(f"[WARN] No se encontraron asistencias para {mesano}. Se evaluarán 0 empleados.")
    
    filtered_employees = {
        rut: emp for rut, emp in all_employees.items()
        if (_aware(emp.get('ficha_created_at')) is None or _aware(emp.get('ficha_created_at')) <= month_end) and rut in attendance_ruts
    }
    logger.info(f"Empleados con ficha válida y asistencia en {mesano}: {len(filtered_employees)}")

    def _norm(s: Optional[str]) -> str:
        return (str(s or "").strip().lower())

    def _filter_by_scope(rule: Dict[str, Any], base: Dict[str, Dict]) -> Dict[str, Dict]:
        """Filtra empleados por scope de la regla (secciones/cargos) si existe.
        Estructura esperada en rule.scope:
          {
            "secciones": {"include": [..], "exclude": [..]},
            "cargos": {"include": [..], "exclude": [..]}
          }
        Matchea por nombre textual (de trabajadores_vpn: campos 'seccion' y 'cargo').
        """
        scope = rule.get("scope") or {}
        if not isinstance(scope, dict) or not scope:
            return base
        secs = scope.get("secciones") or {}
        cargos = scope.get("cargos") or {}

        sec_inc = {_norm(x) for x in (secs.get("include") or []) if _norm(x)}
        sec_exc = {_norm(x) for x in (secs.get("exclude") or []) if _norm(x)}
        car_inc = {_norm(x) for x in (cargos.get("include") or []) if _norm(x)}
        car_exc = {_norm(x) for x in (cargos.get("exclude") or []) if _norm(x)}

        def allowed(emp: Dict[str, Any]) -> bool:
            # Preferir seccion/cargo derivados de asistencia del período
            erut = str(emp.get("rut") or "").strip()
            role = attendance_roles.get(erut) or {}
            esec = _norm(role.get("seccion") or emp.get("seccion"))
            ecar = _norm(role.get("cargo") or emp.get("cargo"))
            # secciones
            if sec_inc and esec not in sec_inc:
                return False
            if sec_exc and esec in sec_exc:
                return False
            # cargos
            if car_inc and ecar not in car_inc:
                return False
            if car_exc and ecar in car_exc:
                return False
            return True

        return {rut: emp for rut, emp in base.items() if allowed(emp)}

    # Cargar mapa de roles (seccion/cargo) desde asistencia del mes para usar en scope
    attendance_roles = get_attendance_roles_for_period(mesano)

    for rule in active_rules:
        template_key = rule.get("template_key")
        rule_id = str(rule["_id"])
        params = rule.get("params", {}) or {}
        period_mode = params.get("period_mode", "month")  # muchas reglas son mensuales por defecto

        # -------------------
        # Gating por período
        # -------------------
        # Aplicar scope de la regla lo antes posible para evitar generar docs fuera de alcance
        scoped_employees = _filter_by_scope(rule, filtered_employees)

        if period_mode == "year":
            year_is_final = is_year_finalized(year)
            if not year_is_final:
                logger.info(f"[SKIP] Regla '{rule['rule_name']}' (anual) no apta: año {year} aún no finalizado.")
                # Placeholder para que el FE muestre el estado
                for rut in scoped_employees.keys():
                    bulk_operations.append(UpdateOne(
                        {"periodo": periodo_dash, "rut": rut, "rule_id": rule_id},
                        {"$set": {
                            "periodo": periodo_dash,
                            "rut": rut,
                            "rule_id": rule_id,
                            "rule_name": rule["rule_name"],
                            "template_key": template_key,
                            "period_mode": "year",
                            "status": "not_eligible_yet",
                            "finalized": False,
                            "reason": "period_open",
                            "updated_at": datetime.now(CL_TZ)
                        }},
                        upsert=True
                    ))
                # Siguiente regla
                continue

            # (Opcional) Solo ejecutar evaluación anual en diciembre para evitar doble trabajo
            # Si prefieres que corra en cualquier mes una vez finalizado el año, comenta este if.
            if month != 12:
                logger.info(f"[SKIP] Regla anual '{rule['rule_name']}' evaluada solo en diciembre. Mes actual: {periodo_dash}.")
                for rut in scoped_employees.keys():
                    bulk_operations.append(UpdateOne(
                        {"periodo": periodo_dash, "rut": rut, "rule_id": rule_id},
                        {"$set": {
                            "periodo": periodo_dash,
                            "rut": rut,
                            "rule_id": rule_id,
                            "rule_name": rule["rule_name"],
                            "template_key": template_key,
                            "period_mode": "year",
                            "status": "not_eligible_yet",
                            "finalized": True,   # el año ya cerró, pero decidimos computar en diciembre
                            "reason": "annual_evaluates_in_december",
                            "updated_at": datetime.now(CL_TZ)
                        }},
                        upsert=True
                    ))
                continue

        else:  # period_mode == "month"
            if not month_finalized:
                logger.info(f"[SKIP] Regla '{rule['rule_name']}' (mensual) no apta: mes {periodo_dash} aún no finalizado.")
                for rut in scoped_employees.keys():
                    bulk_operations.append(UpdateOne(
                        {"periodo": periodo_dash, "rut": rut, "rule_id": rule_id},
                        {"$set": {
                            "periodo": periodo_dash,
                            "rut": rut,
                            "rule_id": rule_id,
                            "rule_name": rule["rule_name"],
                            "template_key": template_key,
                            "period_mode": "month",
                            "status": "not_eligible_yet",
                            "finalized": False,
                            "reason": "period_open",
                            "updated_at": datetime.now(CL_TZ)
                        }},
                        upsert=True
                    ))
                continue

        # -------------------
        # Evaluación (período cerrado)
        # -------------------
        eval_func = evaluators.get(template_key)
        if not eval_func:
            logger.warning(f"No se encontró una función de evaluación para la regla '{rule.get('rule_name', template_key)}' (template: {template_key}). Se omitirá.")
            continue

        logger.info(f"Ejecutando regla finalizada: '{rule.get('rule_name', template_key)}' sobre {len(scoped_employees)} empleados (post-scope)...")
        try:
            winners_ruts = set(eval_func(db, rule, periodo_dash))
            logger.info(f"Regla '{rule.get('rule_name', template_key)}' evaluada. Ganadores: {len(winners_ruts)}")

            for rut in scoped_employees.keys():
                status = "fulfilled" if rut in winners_ruts else "not_fulfilled"

                doc = {
                    "periodo": periodo_dash,
                    "rut": rut,
                    "rule_id": rule_id,
                    "rule_name": rule.get("rule_name", template_key),
                    "template_key": template_key,
                    "period_mode": period_mode,
                    "status": status,
                    "merit_points": rule.get("merit_points", 0) if status == "fulfilled" else 0,
                    "segment_token_id": rule.get("segment_token_id") if status == "fulfilled" else None,
                    "finalized": True,
                    "updated_at": datetime.now(CL_TZ)
                }

                bulk_operations.append(UpdateOne(
                    {"periodo": periodo_dash, "rut": rut, "rule_id": rule_id},
                    {"$set": doc},
                    upsert=True
                ))
        except Exception as e:
            logger.error(f"Error evaluando la regla '{rule.get('rule_name', template_key)}': {e}", exc_info=True)

    if bulk_operations:
        logger.info(f"Realizando bulk write con {len(bulk_operations)} operaciones...")
        KPI_RESULT_COLL.bulk_write(bulk_operations)
    else:
        logger.info("No se generaron operaciones de méritos para este período (posiblemente todos no elegibles aún).")

    logger.info(f"--- Período {mesano} finalizado. ---")


# -----------------------
# Runner con guardas QOF
# -----------------------
def run_worker(periodo: Optional[str] = None):
    _ensure_indexes()

    rule_evaluators = load_rule_evaluators()
    if not rule_evaluators:
        logger.error("No se pudieron cargar los modelos de reglas. Abortando worker.")
        return

    try:
        periods_to_process: List[str] = []
        now = datetime.now(CL_TZ)
        this_year = now.year
        this_month = now.month

        if periodo:
            # Año completo
            if len(periodo) == 4 and periodo.isdigit():
                y = int(periodo)
                # Procesa todos los meses FINALIZADOS de ese año (aunque el año no haya finalizado)
                months = [f"{y}{m:02d}" for m in range(1, 13)]
                finalized_months: List[str] = []
                for ym in months:
                    pdash = f"{ym[:4]}-{ym[4:6]}"
                    if is_month_finalized(pdash):
                        finalized_months.append(ym)
                if not finalized_months:
                    logger.info(f"[SKIP] Ningún mes finalizado en {y}. Nada que procesar.")
                    return
                periods_to_process = finalized_months
            # Mes específico
            elif len(periodo) == 6 and periodo.isdigit():
                y = int(periodo[:4])
                m = int(periodo[4:6])
                pdash = f"{y}-{m:02d}"
                if not is_month_finalized(pdash):
                    logger.info(f"[SKIP] Mes {pdash} aún no finalizado. No se procesará.")
                    return
                periods_to_process.append(periodo)
            else:
                logger.error(f"Formato de período '{periodo}' inválido. Use YYYY o YYYYMM.")
                return
        else:
            # Por defecto: procesa SOLO el mes anterior si está finalizado
            y = this_year
            m = this_month - 1
            if m == 0:
                y -= 1
                m = 12
            pdash = f"{y}-{m:02d}"
            if not is_month_finalized(pdash):
                logger.info(f"[SKIP] Mes {pdash} aún no finalizado. Nada que procesar.")
                return
            periods_to_process.append(f"{y}{m:02d}")

        for p in sorted(set(periods_to_process)):
            process_period(p, rule_evaluators)

    except Exception as e:
        logger.exception(f"[MERITOCRACY WORKER] Falló con un error inesperado: {e}")


# -----------------------
# CLI
# -----------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Worker para procesar y cachear resultados de reglas de meritocracia.")
    parser.add_argument('--periodo', help='Período a procesar en formato YYYYMM o YYYY. Si se omite, procesa el mes anterior.')
    args = parser.parse_args()
    run_worker(args.periodo)
