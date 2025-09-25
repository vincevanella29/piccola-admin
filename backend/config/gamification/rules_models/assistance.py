# config/gamification/rules_models/assistance.py

from __future__ import annotations
from typing import Dict, Any, List
from pymongo.database import Database
from web3 import Web3
from datetime import datetime
from dateutil.relativedelta import relativedelta

# --- Constante requerida por el worker dinámico ---
TEMPLATE_KEY = "attendance_full_month"


# --- Lógica de la Regla ---
WEI = 10 ** 18

def to_wei(amount_float: float | int) -> int:
    return int(float(amount_float) * WEI)

def check_perfect_attendance(db: Database, rut: str, year_month: str) -> bool:
    try:
        start_date = datetime.strptime(f"{year_month}-01", "%Y-%m-%d")
        end_date = (start_date + relativedelta(months=1) - relativedelta(days=1)).strftime("%Y-%m-%d")
        start_date = start_date.strftime("%Y-%m-%d")

        absent_days = db.asistencia_diaria_intranet.count_documents({
            "rut": {"$in": [rut, int(rut)] if rut.isdigit() else [rut]},
            "fecha_trabajada": {"$gte": start_date, "$lte": end_date},
            "tipo_movimiento": {"$in": ["AUS", "LIC", "NVI", "PSG"]}
        })
        return absent_days == 0
    except Exception as e:
        print(f"Error checking attendance for RUT {rut}: {str(e)}")
        return False

def has_wallet(db: Database, rut: str) -> str | None:
    try:
        employee = db.empleados_usuarios.find_one({"rut": str(rut), "status": "active"})
        return employee.get("wallet") if employee else None
    except Exception as e:
        print(f"Error checking wallet for RUT {rut}: {str(e)}")
        return None

def evaluate_perfect_attendance_rule(
    db: Database,
    w3: Web3,
    ctx: 'RuleContext',
    rule: Dict[str, Any]
) -> List['RuleAward']:
    from ..models import RuleContext, RuleAward

    awards: List[RuleAward] = []
    
    if not rule.get("is_active", True) or rule.get("template_key") != TEMPLATE_KEY:
        return awards
    
    params = rule.get("params", {})
    merit_points = float(rule.get("merit_points", 0.0))
    token_id = int(rule.get("segment_token_id", 0))
    
    if token_id <= 0 or merit_points <= 0.0:
        return awards

    wallet = has_wallet(db, ctx.rut)
    if not wallet:
        return awards

    if check_perfect_attendance(db, ctx.rut, ctx.ym):
        amount_wei = to_wei(merit_points)
        reason = f"Perfect attendance for {ctx.ym} (no absent days)"
        awards.append(RuleAward(
            wallet=wallet, token_id=token_id, amount_wei=int(amount_wei), reason=reason
        ))
    
    return awards

# ### CORRECCIÓN AQUÍ ### - El nombre de la variable ahora coincide con la convención
ATTENDANCE_FULL_MONTH_RULE_TEMPLATE = {
    "key": TEMPLATE_KEY,
    "name": "Asistencia Perfecta del Mes",
    "description": "Otorga mérito si el empleado no tiene días ausentes (AUS, LIC, NVI, PSG) en el mes.",
    "category": "attendance",
    "period": "month",
    "data_sources": [
        {
            "collection": "asistencia_diaria_intranet",
            "fields": ["rut", "fecha_trabajada", "tipo_movimiento"],
        },
        {
            "collection": "empleados_usuarios",
            "fields": ["rut", "wallet", "status"],
        }
    ],
    "required_params": {
        "required_attendance_percent": {
            "type": "number", "min": 100, "max": 100, "default": 100,
            "description": "Porcentaje de asistencia requerido (100% para asistencia perfecta)."
        }
    },
    "metrics": {
        "check": "perfect_attendance(rut, ym)",
        "notes": "Valida que no existan días con tipo_movimiento en ['AUS', 'LIC', 'NVI', 'PSG']."
    },
    "example_payload": {
        "rule_name": "asistencia_perfecta_mes", "segment_token_id": 2, "template_key": TEMPLATE_KEY,
        "params": {"required_attendance_percent": 100}, "merit_points": 1, "is_active": True
    }
}

def evaluate(db: Database, rule: Dict[str, Any], periodo_dash: str) -> List[str]:
    pipeline_absent = [
        {"$addFields": {"_ts": {"$toDate": "$fecha_trabajada"}, "rut_str": {"$toString": "$rut"}}},
        {"$addFields": {"MONTH_STR": {"$dateToString": {"format": "%Y-%m", "date": "$_ts"}}}},
        {"$match": {"MONTH_STR": periodo_dash, "tipo_movimiento": {"$in": ["AUS", "LIC", "NVI", "PSG"]}}},
        {"$group": {"_id": "$rut_str"}},
    ]
    absent_ruts = {res["_id"] for res in db.asistencia_diaria_intranet.aggregate(pipeline_absent)}
    
    pipeline_worked = [
        {"$addFields": {"_ts": {"$toDate": "$fecha_trabajada"}, "rut_str": {"$toString": "$rut"}}},
        {"$addFields": {"MONTH_STR": {"$dateToString": {"format": "%Y-%m", "date": "$_ts"}}}},
        {"$match": {"MONTH_STR": periodo_dash}},
        {"$group": {"_id": "$rut_str"}}
    ]
    worked_ruts = {res["_id"] for res in db.asistencia_diaria_intranet.aggregate(pipeline_worked)}

    winner_ruts = worked_ruts - absent_ruts
    return list(winner_ruts)

# ### NUEVA FUNCIÓN DE PROGRESO ###
def get_progress_data(db: Database, rule: Dict[str, Any], rut: str, periodo_dash: str) -> Dict[str, Any]:
    """
    Calcula y devuelve el progreso actual para la regla de asistencia.
    """
    try:
        start_date = datetime.strptime(f"{periodo_dash}-01", "%Y-%m-%d").strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")

        # Contar días trabajados hasta hoy en el período
        days_worked = db.asistencia_diaria_intranet.count_documents({
            "rut": {"$in": [rut, int(rut)] if rut.isdigit() else [rut]},
            "fecha_trabajada": {"$gte": start_date, "$lte": today},
        })

        # Contar ausencias hasta hoy en el período
        absent_days = db.asistencia_diaria_intranet.count_documents({
            "rut": {"$in": [rut, int(rut)] if rut.isdigit() else [rut]},
            "fecha_trabajada": {"$gte": start_date, "$lte": today},
            "tipo_movimiento": {"$in": ["AUS", "LIC", "NVI", "PSG"]}
        })
        
        return {
            "progress_metric": f"{absent_days} Ausencias",
            "detail": f"Has registrado {absent_days} ausencias este mes. Para lograr el mérito, debes terminar el mes con 0 ausencias.",
            "is_competitive": False,
            "current_value": absent_days,
            "target_value": 0,
        }
    except Exception as e:
        return {"error": str(e)}