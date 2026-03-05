# promotions/display_rules.py
from datetime import datetime
from typing import Dict, Optional, Any
from zoneinfo import ZoneInfo
import logging

from utils.web3mongo import db

logger = logging.getLogger(__name__)

RULES_COLL = db.gamification_meritocracy_rules


def validate_display_rules(
    promotion: Dict,
    now: datetime = None,
    employee: Optional[Dict[str, Any]] = None,
    role_level: int = -1,
) -> tuple[bool, str]:
    """Valida reglas de display para una promoción.

    Además de fechas/horas, si la promo tiene reglas MERIT_RULE_FULFILLED y
    se pasa un `employee`, se usa el scope de la regla de gamificación
    (cargos/secciones) para decidir si mostrar o no la promoción al usuario.
    NO evalúa si el mérito está cumplido; sólo si el usuario pertenece al
    universo de la regla.
    """
    if now is None:
        now = datetime.now(ZoneInfo("America/Santiago"))

    # Ensure date fields are timezone-aware before comparison
    for date_field in ("display_start", "display_end"):
        val = promotion.get(date_field)
        if isinstance(val, str):
            from dateutil.parser import isoparse
            parsed = isoparse(val)
            if parsed.tzinfo is None:
                # String without tz → admin-entered in Chile time
                parsed = parsed.replace(tzinfo=ZoneInfo("America/Santiago"))
            promotion[date_field] = parsed
        elif isinstance(val, datetime) and val.tzinfo is None:
            # Naive datetime from MongoDB → stored as UTC
            promotion[date_field] = val.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("America/Santiago"))

    # Validate date range
    if not (promotion["display_start"] <= now <= promotion["display_end"]):
        return False, "Promotion not valid for current date"

    # Validate recurring days
    recurring_days = promotion.get("display_recurring_every", [])
    if recurring_days and now.strftime("%A").lower() not in recurring_days:
        return False, f"Promotion not valid on {now.strftime('%A').lower()}"

    # Validate time ranges
    if promotion.get("display_from_time") and promotion.get("display_to_time"):
        try:
            current_time = now.time()
            start_time = datetime.strptime(promotion["display_from_time"], "%H:%M:%S").time()
            end_time = datetime.strptime(promotion["display_to_time"], "%H:%M:%S").time()
            if not (start_time <= current_time <= end_time):
                return False, f"Promotion not valid at current time: {current_time}"
        except ValueError:
            return False, "Invalid display_from_time or display_to_time format"

    # Validate excluded dates
    excluded_dates = promotion.get("display_excluded_dates", [])
    if excluded_dates:
        current_date = now.strftime("%Y-%m-%d")
        if current_date in excluded_dates:
            return False, f"Promotion not valid on excluded date: {current_date}"

    # --- Validate meritocracy scope (cargos / secciones) ---
    # Si la promo tiene reglas que requieren info de empleado, el usuario DEBE
    # tener employee scope. Si no lo tiene, la promo se oculta.
    rules = promotion.get("rules") or []
    employee_required_types = {"merit_rule_fulfilled", "require_job_position"}
    has_employee_rules = any(r.get("rule_type") in employee_required_types for r in rules)

    if has_employee_rules and not employee:
        # Super admins (role_level <= 5) can see all promos regardless
        if isinstance(role_level, int) and role_level >= 0 and role_level <= 5:
            logger.info(
                f"[DISPLAY] Admin override (role_level={role_level}) for promo '{promotion.get('name')}': "
                f"skipping employee scope check"
            )
        else:
            # La promo requiere ser empleado pero no tenemos scope → ocultar
            logger.info(
                f"[DISPLAY] Hiding promo '{promotion.get('name')}': "
                f"requires employee scope but employee=None (user has no wallet or no ficha)"
            )
            return False, "Promotion requires employee scope"

    if employee and rules:
        cargo = (employee.get("cargo") or "").strip()
        emp_section_norm = str(employee.get("emp_section_norm") or "").strip().lower()
        print(f"🎯🎯🎯 [DISPLAY] Processing rules for {promotion.get('name')}, cargo='{cargo}', section='{emp_section_norm}'")

        for rule in rules:
            rule_type = rule.get("rule_type")
            
            # Procesar reglas de merit_rule_fulfilled
            if rule_type == "merit_rule_fulfilled":

                merit_rule_name = rule.get("merit_rule_name")
                if not merit_rule_name:
                    continue

                gam_rule = RULES_COLL.find_one({"rule_name": merit_rule_name})
                if not gam_rule:
                    # Config mala: mejor ocultar promo para no ensuciar el feed.
                    return False, f"Gamification rule '{merit_rule_name}' not found for display scope."

                scope = gam_rule.get("scope") or {}

                # Scope por cargos
                if "cargos" in scope:
                    include = scope["cargos"].get("include", [])
                    exclude = scope["cargos"].get("exclude", [])
                    if (include and cargo not in include) or (cargo in exclude):
                        return False, "Promotion not in scope for employee cargo."

                # Scope por secciones
                if "secciones" in scope:
                    sec_include = [str(s).strip().lower() for s in scope["secciones"].get("include", [])]
                    sec_exclude = [str(s).strip().lower() for s in scope["secciones"].get("exclude", [])]
                    if (sec_include and emp_section_norm not in sec_include) or (emp_section_norm in sec_exclude):
                        return False, "Promotion not in scope for employee section."


            # Nueva validación: REQUIRE_JOB_POSITION
            # Si la promo requiere un cargo/sección específico, solo mostrarla 
            # a empleados que cumplan ese requisito
            elif rule_type == "require_job_position":
                required_section = (rule.get("job_section") or "").strip().lower()
                required_position = (rule.get("job_position") or "").strip().lower()
                emp_position_norm = cargo.lower() if cargo else ""
                
                print(f"🔍🔍🔍 [DISPLAY_JOB_POSITION] promo={promotion.get('name')}, emp_section='{emp_section_norm}', emp_position='{emp_position_norm}', required_section='{required_section}', required_position='{required_position}'")
                logger.info(
                    f"[DISPLAY_JOB_POSITION] promo={promotion.get('name')}, "
                    f"emp_section='{emp_section_norm}', emp_position='{emp_position_norm}', "
                    f"required_section='{required_section}', required_position='{required_position}'"
                )
                
                # Si se especificó sección, validar
                if required_section:
                    if emp_section_norm != required_section:
                        print(f"❌❌❌ [DISPLAY_JOB_POSITION] Section mismatch, hiding promo")
                        logger.info(f"[DISPLAY_JOB_POSITION] Section mismatch, hiding promo")
                        return False, f"Promotion only for section '{rule.get('job_section')}'"
                
                # Si se especificó cargo, validar  
                if required_position:
                    if emp_position_norm != required_position:
                        print(f"❌❌❌ [DISPLAY_JOB_POSITION] Position mismatch, hiding promo")
                        logger.info(f"[DISPLAY_JOB_POSITION] Position mismatch, hiding promo")
                        return False, f"Promotion only for position '{rule.get('job_position')}'"
                
                print(f"✅✅✅ [DISPLAY_JOB_POSITION] Employee matches requirements, showing promo")
                logger.info(f"[DISPLAY_JOB_POSITION] ✅ Employee matches requirements, showing promo")

    return True, ""