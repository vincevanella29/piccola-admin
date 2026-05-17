# routers/mi_meritos.py

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, Dict, Callable, Any, List
from utils.web3mongo import db
from utils.auth.session import verify_session
from utils.time_utils import get_chile_time
import os
import importlib.util
import logging

from config.roles.identity import get_employee_context

router = APIRouter()
RULES_COLL = db.gamification_meritocracy_rules
RESULTS_COLL = db.meritocracy_kpi_results

logger = logging.getLogger(__name__)

# --- Carga Dinámica de Módulos de Reglas (Optimizada con Caché) ---

RULE_MODULES_CACHE = None

def _load_rule_modules() -> Dict[str, Any]:
    """Carga los módulos de Python de la carpeta de reglas y los cachea."""
    global RULE_MODULES_CACHE
    if RULE_MODULES_CACHE is not None:
        return RULE_MODULES_CACHE

    modules = {}
    base_dir = os.path.dirname(os.path.abspath(__file__))
    rules_path = os.path.abspath(os.path.join(base_dir, '..', '..', 'config', 'gamification', 'rules_models'))
    
    if not os.path.isdir(rules_path):
        logger.error(f"El directorio de reglas no existe: {rules_path}")
        RULE_MODULES_CACHE = {}
        return {}

    for entry in os.scandir(rules_path):
        if entry.is_file() and entry.name.endswith('.py') and not entry.name.startswith('__'):
            module_name = entry.name[:-3]
            try:
                spec = importlib.util.spec_from_file_location(module_name, entry.path)
                module = importlib.util.module_from_spec(spec)
                assert spec and spec.loader
                spec.loader.exec_module(module)
                if hasattr(module, 'TEMPLATE_KEY'):
                    modules[getattr(module, 'TEMPLATE_KEY')] = module
            except Exception as e:
                logger.error(f"Error cargando el módulo de regla '{module_name}': {e}")
                continue
    
    RULE_MODULES_CACHE = modules
    return modules

def get_rule_evaluators() -> Dict[str, Callable]:
    """Extrae las funciones 'evaluate' de los módulos cargados."""
    modules = _load_rule_modules()
    return {key: mod.evaluate for key, mod in modules.items() if hasattr(mod, 'evaluate')}

def get_rule_templates() -> Dict[str, Dict]:
    """Extrae las definiciones de plantillas (templates) de los módulos cargados."""
    modules = _load_rule_modules()
    templates = {}
    for key, mod in modules.items():
        template_name = f"{key.upper()}_RULE_TEMPLATE"
        if hasattr(mod, template_name):
            templates[key] = getattr(mod, template_name)
    return templates

def get_rule_progress_evaluators() -> Dict[str, Callable]:
    """Extrae las funciones 'get_progress_data' de los módulos cargados."""
    modules = _load_rule_modules()
    return {key: mod.get_progress_data for key, mod in modules.items() if hasattr(mod, 'get_progress_data')}


@router.get("/mi/meritos", summary="Estado de méritos del empleado: mes actual e historial")
async def mi_meritos(
    ym: Optional[str] = None,  # YYYY-MM opcional
    user: dict = Depends(verify_session),
):
    emp_data = get_employee_context(user)
    rut = emp_data["rut"]
    wallet = emp_data["wallet"]
    cargo = emp_data["cargo"]
    emp_section_norm = emp_data["seccion"].lower()
    
    rules_map = {str(r["_id"]): r for r in RULES_COLL.find()}
    templates_map = get_rule_templates()
    evaluators = get_rule_evaluators()
    progress_evaluators = get_rule_progress_evaluators() # <-- Carga las nuevas funciones
    periodo_dash = ym or get_chile_time().strftime("%Y-%m")

    # --- 2. Obtener TODO el historial de resultados para el usuario ---
    historical_results = list(RESULTS_COLL.find({"rut": rut, "periodo": {"$ne": periodo_dash}}).sort("periodo", -1))
    
    merits_history_fulfilled = []
    merits_history_not_fulfilled = []

    for result in historical_results:
        rule_id = result.get("rule_id")
        rule_instance = rules_map.get(rule_id)
        if not rule_instance: continue

        template_key = rule_instance.get("template_key")
        template_details = templates_map.get(template_key)
        
        merit_entry = {
            "result_id": str(result["_id"]), 
            "rule_id": rule_id,
            "template_key": template_key,
            "periodo": result.get("periodo"),
            "name": rule_instance.get("rule_name"),
            "description": template_details.get("description") if template_details else "N/A",
            "params": rule_instance.get("params"),
            "merit_points": result.get("merit_points"),
            "segment_token_id": rule_instance.get("segment_token_id"),
        }
        
        if result.get("status") == "fulfilled":
            merit_entry["mint_status"] = result.get("mint_status") or "pending"
            merits_history_fulfilled.append(merit_entry)
        else:
            merits_history_not_fulfilled.append(merit_entry)
            
    # --- 3. Evaluar el estado y PROGRESO de TODAS las reglas activas para el mes actual ---
    merits_current_month = []
    active_rules = {k: v for k, v in rules_map.items() if v.get("is_active")}

    for rule_id, rule_instance in active_rules.items():
        # Verificar scope
        scope = rule_instance.get("scope")
        if scope and "cargos" in scope:
            include = scope["cargos"].get("include", [])
            exclude = scope["cargos"].get("exclude", [])
            if (include and cargo not in include) or (cargo in exclude):
                continue

        # Filtrar por secciones (include/exclude) si está definido en el scope
        if scope and "secciones" in scope:
            sec_include = [str(s).strip().lower() for s in scope["secciones"].get("include", [])]
            sec_exclude = [str(s).strip().lower() for s in scope["secciones"].get("exclude", [])]
            if (sec_include and emp_section_norm not in sec_include) or (emp_section_norm in sec_exclude):
                continue
        
        template_key = rule_instance.get("template_key")
        
        # Evaluar estado de cumplimiento (fulfilled/not_fulfilled)
        status_evaluator = evaluators.get(template_key)
        current_status = "pending_evaluation"
        if status_evaluator:
            try:
                winners = set(status_evaluator(db, rule_instance, periodo_dash))
                current_status = "fulfilled" if rut in winners else "not_fulfilled"
            except Exception as e:
                logger.warning(f"Error evaluando regla '{rule_instance.get('rule_name')}' para {rut}: {e}")
                current_status = "evaluation_error"
        
        # OBTENER DATOS DE PROGRESO EN TIEMPO REAL
        progress_data = None
        progress_evaluator = progress_evaluators.get(template_key)
        if progress_evaluator:
            try:
                progress_data = progress_evaluator(db, rule_instance, rut, periodo_dash)
            except Exception as e:
                logger.error(f"Error obteniendo progreso para '{rule_instance.get('rule_name')}': {e}")
                progress_data = {"error": "No se pudo calcular el progreso."}

        # Ensamblar el objeto final
        template_details = templates_map.get(template_key)
        merits_current_month.append({
            "rule_id": rule_id,
            "template_key": template_key,
            "name": rule_instance.get("rule_name"),
            "description": template_details.get("description") if template_details else "N/A",
            "params": rule_instance.get("params"),
            "merit_points": rule_instance.get("merit_points"),
            "segment_token_id": rule_instance.get("segment_token_id"),
            "status": current_status,
            "progress": progress_data  # <-- OBJETO DE PROGRESO AÑADIDO
        })

    return {
        "rut": rut,
        "wallet": wallet,
        "current_period": periodo_dash,
        "merits": {
            "current_month": merits_current_month,
            "history_fulfilled": merits_history_fulfilled,
            "history_not_fulfilled": merits_history_not_fulfilled,
        }
    }