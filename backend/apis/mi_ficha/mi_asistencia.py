# routers/mi_asistencia.py

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from datetime import date, datetime
import calendar
from utils.web3mongo import db
from utils.auth.session import verify_session

from config.roles.identity import get_employee_context

router = APIRouter()

def _get_perfect_attendance_status(rut: str, target_date: date) -> dict:
    month_start = date(target_date.year, target_date.month, 1)
    _, days_in_month = calendar.monthrange(target_date.year, target_date.month)
    month_end = date(target_date.year, target_date.month, days_in_month)

    pipeline = [
        {"$addFields": {"fecha_norm": {"$toDate": "$fecha_trabajada"}}},
        {"$match": {
            "rut": {"$in": [rut, int(rut) if rut.isdigit() else None]},
            "fecha_norm": {"$gte": datetime.combine(month_start, datetime.min.time()), "$lte": datetime.combine(month_end, datetime.max.time())}
        }},
        {"$project": {"_id": 0, "d": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}}}},
        {"$group": {"_id": "$d"}}
    ]
    worked_dates = {r["_id"] for r in db.asistencia_diaria_intranet.aggregate(pipeline)}
    business_days = [date(target_date.year, target_date.month, d) for d in range(1, days_in_month + 1) if date(target_date.year, target_date.month, d).weekday() < 5]
    dias_habiles_mes = len(business_days)
    dias_trabajados_mes = len({d.isoformat() for d in business_days} & worked_dates)
    return {
        "dias_trabajados": dias_trabajados_mes,
        "dias_habiles": dias_habiles_mes,
        "asistencia_perfecta": dias_habiles_mes > 0 and dias_trabajados_mes >= dias_habiles_mes,
        "mes": target_date.strftime("%Y-%m")
    }

@router.get("/mi/asistencia-kpis", summary="KPIs de asistencia por periodo")
async def get_mi_asistencia_kpis(
    periodo_start: str = Query(..., description="YYYYMM"),
    periodo_end: str = Query(..., description="YYYYMM"),
    user: dict = Depends(verify_session),
):
    emp_data = get_employee_context(user)
    rut = emp_data["rut"]

    try:
        start_y, start_m = int(periodo_start[:4]), int(periodo_start[4:])
        end_y, end_m = int(periodo_end[:4]), int(periodo_end[4:])
        start_date = date(start_y, start_m, 1)
        end_date = date(end_y, end_m, 1)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Períodos deben ser YYYYMM")

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="El período de inicio no puede ser posterior al de fin")

    results: List[dict] = []
    current_date = start_date
    while current_date <= end_date:
        kpis = _get_perfect_attendance_status(rut, current_date)
        results.append(kpis)
        current_date = date(current_date.year + (1 if current_date.month == 12 else 0), 1 if current_date.month == 12 else current_date.month + 1, 1)
    
    return {"rut": rut, "kpis": results}