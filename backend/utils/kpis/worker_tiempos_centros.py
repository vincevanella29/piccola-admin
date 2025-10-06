# utils/kpis/worker_tiempos_centros.py
# SOLO DOS TABLAS DE SALIDA (mensuales):
#   - kpis_tiempos_empleado_mensual
#   - kpis_tiempos_local_mensual
#
# Ejecutar:
#   python -m utils.kpis.worker_tiempos_centros --periodo 202509
#   python -m utils.kpis.worker_tiempos_centros --periodo 2025

import argparse
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any, Set
from collections import defaultdict

from pymongo import UpdateOne
from dateutil.relativedelta import relativedelta

from utils.web3mongo import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

from utils.kpis.utils.tiempos_utils import (
    _ym_to_dash,
    _load_cargos_map,   
    _load_centros_config,
    _load_admin_cargo_ids,
    _load_asistencia_mes,
    _ensure_indexes,
    build_centro_daily_inmem,
    attribute_daily_inmem,
)

from utils.kpis.worker_tiempos_centros_emp import (
    build_employee_monthly_write,
)
from utils.kpis.worker_tiempos_centros_local import (
    build_local_monthly_write,
    
)

# ==========================
# 5) Orquestador
# ==========================
def process_period(ym: str):
    logger.info(f"--- Tiempos {ym} ({_ym_to_dash(ym)}) ---")
    centros_cfg = _load_centros_config()
    cargos_map = _load_cargos_map()
    admin_cargo_ids = _load_admin_cargo_ids()
    asis_idx = _load_asistencia_mes(ym, cargos_map)

    centro_daily = build_centro_daily_inmem(ym)            # in-memory
    emp_daily = attribute_daily_inmem(centro_daily, centros_cfg, asis_idx, admin_cargo_ids)  # in-memory

    build_employee_monthly_write(ym, emp_daily)            # write mensual empleado
    build_local_monthly_write(ym, centro_daily, asis_idx, admin_cargo_ids)            # write mensual local

    logger.info(f"--- Período {ym} finalizado. ---")

def run_worker(periodo: Optional[str] = None):
    _ensure_indexes()
    try:
        periods_to_process: List[str] = []
        if periodo:
            if len(periodo) == 4 and periodo.isdigit():
                periods_to_process = [f"{periodo}{m:02d}" for m in range(1, 13)]
            elif len(periodo) == 6 and periodo.isdigit():
                periods_to_process = [periodo]
            else:
                raise ValueError("Formato inválido: use YYYY o YYYYMM")
        else:
            today = datetime.now()
            periods_to_process.append(today.strftime("%Y%m"))
            if today.day <= 7:
                periods_to_process.append((today - relativedelta(months=1)).strftime("%Y%m"))

        for ym in sorted(set(periods_to_process)):
            process_period(ym)
    except Exception as e:
        logger.exception(f"[TIEMPOS WORKER] Error inesperado: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KPIs de Tiempos (empleado/local) SIN tablas intermedias.")
    parser.add_argument("--periodo", help="YYYYMM o YYYY")
    args = parser.parse_args()
    run_worker(args.periodo)
