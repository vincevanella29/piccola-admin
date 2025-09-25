from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from utils.auth.session import verify_session
import importlib
import logging
import traceback

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Configuración de workers disponibles ---
WORKER_MODULES = {
    # MTZ
    "worker_sucursales": "utils.mtz.worker_sucursales",
    "worker_ventas_locales": "utils.mtz.worker_ventas_locales",
    "worker_cargos": "utils.mtz.worker_cargos",
    "worker_compras_bodega_gastos": "utils.mtz.worker_compras_bodega_gastos",
    "worker_consumos": "utils.mtz.worker_consumo_locales",
    "worker_recetas_productos": "utils.mtz.worker_recetas_productos",
    "worker_rentabilidad_por_producto_locales": "utils.mtz.worker_rentabilidad_por_producto_locales",
    "worker_rentabilidad_por_producto_mtz": "utils.mtz.worker_rentabilidad_por_producto_mtz",
    "worker_sales_by_waiter_hour_vpn": "utils.mtz.worker_sales_by_waiter_hour_vpn",
    "worker_restaurant_data": "utils.mtz.worker_restaurant_data",

    # Intranet
    "worker_asistencia_diaria_intranet": "utils.intranet.archivos.worker_asistencia_diaria_intranet",
    "worker_asistencia_extra_intranet": "utils.intranet.archivos.worker_asistencia_extra_intranet",
    "worker_cargos_intranet": "utils.intranet.archivos.worker_cargos_intranet",
    "worker_gastos_intranet": "utils.intranet.archivos.worker_gastos_intranet",
    "worker_ingreso_modificadores_sueldo_intranet": "utils.intranet.archivos.worker_ingreso_modificadores_sueldo_intranet",
    "worker_modificadores_sueldo_intranet": "utils.intranet.archivos.worker_modificadores_sueldo_intranet",
    "worker_pago_sueldos_intranet": "utils.intranet.archivos.worker_pago_sueldos_intranet",
    "worker_trabajadores_intranet": "utils.intranet.archivos.worker_trabajadores_intranet",
    # KPIs
    "worker_meritocracy": "utils.kpis.worker_meritocracy",
    "worker_sales_kpis_cache": "utils.kpis.worker_sales_kpis_cache",
}

class ListWorkersResponse(BaseModel):
    workers: List[str]

class ExecuteWorkersRequest(BaseModel):
    mesano: str
    include: Optional[List[str]] = None
    exclude: Optional[List[str]] = None

class ExecuteWorkersResult(BaseModel):
    worker: str
    status: str
    detail: Optional[str] = None

@router.get("/workers/list", response_model=ListWorkersResponse)
def list_workers(user: dict = Depends(verify_session)):
    # Nivel 3 o 4 requerido
    from config.roles.service import verify_admin
    if not verify_admin(user["wallet"]):
        raise HTTPException(status_code=403, detail="Insufficient role level")
    return {"workers": list(WORKER_MODULES.keys())}

@router.post("/workers/execute", response_model=List[ExecuteWorkersResult])
def execute_workers(data: ExecuteWorkersRequest, user: dict = Depends(verify_session)):
    from config.roles.service import verify_admin
    if not verify_admin(user["wallet"]):
        raise HTTPException(status_code=403, detail="Insufficient role level")
    mesano = data.mesano
    include = set(data.include) if data.include else set(WORKER_MODULES.keys())
    exclude = set(data.exclude) if data.exclude else set()
    to_run = include - exclude
    results = []
    for worker in to_run:
        module_path = WORKER_MODULES.get(worker)
        if not module_path:
            results.append({"worker": worker, "status": "not_found", "detail": "No module path registered"})
            continue
        try:
            mod = importlib.import_module(module_path)
            if hasattr(mod, "process_period"):
                mod.process_period(mesano)
                results.append({"worker": worker, "status": "ok"})
            elif hasattr(mod, "run_worker"):
                mod.run_worker(mesano)
                results.append({"worker": worker, "status": "ok"})
            elif hasattr(mod, "main"):
                import builtins as _builtins
                _orig_input = _builtins.input
                try:
                    _builtins.input = lambda prompt='': mesano
                    mod.main()
                    results.append({"worker": worker, "status": "ok"})
                finally:
                    _builtins.input = _orig_input
            else:
                results.append({"worker": worker, "status": "error", "detail": "No callable found"})
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Error ejecutando {worker}: {e}\n{tb}")
            results.append({"worker": worker, "status": "error", "detail": str(e)})
    return results
