from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional

from utils.web3mongo import db
from utils.time_utils import get_chile_time
from . import rules as rulelib

logger = logging.getLogger(__name__)

# ---- Merit preview (points-only) ----

def compute_merit_preview_points(rut: str, ym: Optional[str]) -> Dict[str, Any]:
    ym_final = ym or get_chile_time().strftime('%Y-%m')
    rules = list(db.gamification_meritocracy_rules.find({"is_active": True}, {"_id": 0}))
    total_points = 0
    breakdown: List[Dict[str, Any]] = []

    # Simple replica of existing logic but points-only
    for rule in rules:
        try:
            points_earned = 0
            details = ""
            params: Dict[str, Any] = rule.get("trigger_params", {})
            merit_points = int(rule.get("merit_points", 0))

            if rule.get("trigger_type") == "experience":
                # Month-based experience as before
                scope_type = params.get("scope_type")
                scope_value = params.get("scope_value")
                if params.get("unit") == "month" and scope_type and scope_value:
                    months = rulelib.compute_employee_months_in_scope(db, rut, scope_type, scope_value)
                    points_earned = months * merit_points
                    details = f"{months} meses en '{scope_value}' x {merit_points} pts/mes"
                elif params.get("unit") == "day":
                    days = rulelib.count_days_worked(db, rut, ym_final)
                    mode = params.get("mode", "per_day")
                    if mode == "per_day":
                        points_earned = days * merit_points
                        details = f"{days} días x {merit_points}"
                    else:
                        min_days = int(params.get("min_days", 0) or 0)
                        if days >= min_days:
                            points_earned = merit_points
                            details = f"threshold {days}/{min_days}"

            elif rule.get("trigger_type") == "achievement":
                if params.get("kpi") == "perfect_attendance_month":
                    if rulelib.check_perfect_attendance(db, rut, ym_final):
                        points_earned = merit_points
                        details = f"Asistencia perfecta en {ym_final}"

            elif rule.get("trigger_type") == "performance":
                details = "KPI de rendimiento (lógica pendiente)"

            elif rule.get("trigger_type") == "production":
                details = "KPI de producción (lógica pendiente)"

            if points_earned > 0:
                total_points += points_earned
                breakdown.append({
                    "rule_name": rule.get("rule_name"),
                    "points_earned": points_earned,
                    "details": details,
                })
        except Exception as e:
            logger.error(f"Error evaluando la regla '{rule.get('rule_name')}' para el RUT {rut}: {e}")

    return {
        "ok": True,
        "rut": rut,
        "evaluation_month": ym_final,
        "total_merit_points": total_points,
        "breakdown": breakdown,
    }
