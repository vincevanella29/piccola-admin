"""
workers_api.py — API de ejecución de workers automáticos
Tipado con Pydantic v2, respuestas enriquecidas con timing y metadatos.
"""

from __future__ import annotations

import importlib
import logging
import time
import traceback
from enum import Enum
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from utils.auth.session import verify_session

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Catálogo de workers con metadatos ────────────────────────────────────────

class WorkerCategory(str, Enum):
    MTZ      = "mtz"
    INTRANET = "intranet"
    KPIS     = "kpis"


class WorkerDefinition(BaseModel):
    """Metadatos estáticos de un worker registrado."""
    name: str
    module: str
    category: WorkerCategory
    description: str


# Registro central: nombre → definición
WORKER_REGISTRY: Dict[str, WorkerDefinition] = {
    # ── MTZ ──────────────────────────────────────────────────────────────────
    "worker_sucursales": WorkerDefinition(
        name="worker_sucursales",
        module="utils.mtz.worker_sucursales",
        category=WorkerCategory.MTZ,
        description="Sincroniza datos de sucursales y locales.",
    ),
    "worker_ventas_locales": WorkerDefinition(
        name="worker_ventas_locales",
        module="utils.mtz.worker_ventas_locales",
        category=WorkerCategory.MTZ,
        description="Procesa ventas por local del período.",
    ),
    "worker_cargos": WorkerDefinition(
        name="worker_cargos",
        module="utils.mtz.worker_cargos",
        category=WorkerCategory.MTZ,
        description="Importa cargos y puestos desde MTZ.",
    ),
    "worker_compras_bodega_gastos": WorkerDefinition(
        name="worker_compras_bodega_gastos",
        module="utils.mtz.worker_compras_bodega_gastos",
        category=WorkerCategory.MTZ,
        description="Consolida compras de bodega y gastos del período.",
    ),
    "worker_consumos": WorkerDefinition(
        name="worker_consumos",
        module="utils.mtz.worker_consumo_locales",
        category=WorkerCategory.MTZ,
        description="Calcula consumos internos por local.",
    ),
    "worker_recetas_productos": WorkerDefinition(
        name="worker_recetas_productos",
        module="utils.mtz.worker_recetas_productos",
        category=WorkerCategory.MTZ,
        description="Actualiza recetas y productos desde MTZ.",
    ),
    "worker_rentabilidad_por_producto_locales": WorkerDefinition(
        name="worker_rentabilidad_por_producto_locales",
        module="utils.mtz.worker_rentabilidad_por_producto_locales",
        category=WorkerCategory.MTZ,
        description="Calcula rentabilidad por producto a nivel de local.",
    ),
    "worker_rentabilidad_por_producto_mtz": WorkerDefinition(
        name="worker_rentabilidad_por_producto_mtz",
        module="utils.mtz.worker_rentabilidad_por_producto_mtz",
        category=WorkerCategory.MTZ,
        description="Calcula rentabilidad por producto a nivel MTZ consolidado.",
    ),
    "worker_sales_by_waiter_hour_vpn": WorkerDefinition(
        name="worker_sales_by_waiter_hour_vpn",
        module="utils.mtz.worker_sales_by_waiter_hour_vpn",
        category=WorkerCategory.MTZ,
        description="Ventas por mesero y hora vía VPN.",
    ),
    "worker_restaurant_data": WorkerDefinition(
        name="worker_restaurant_data",
        module="utils.mtz.worker_restaurant_data",
        category=WorkerCategory.MTZ,
        description="Consolida datos generales del restaurante.",
    ),
    "worker_ventas_hora_tiempo_promedio": WorkerDefinition(
        name="worker_ventas_hora_tiempo_promedio",
        module="utils.mtz.worker_ventas_hora_tiempo_promedio",
        category=WorkerCategory.MTZ,
        description="Ventas por hora con tiempo promedio de atención.",
    ),
    "worker_ventas_producto_cprodu": WorkerDefinition(
        name="worker_ventas_producto_cprodu",
        module="utils.mtz.worker_ventas_producto_cprodu",
        category=WorkerCategory.MTZ,
        description="Ventas desglosadas por código de producto (CPRODU).",
    ),

    # ── INTRANET ─────────────────────────────────────────────────────────────
    "worker_asistencia_diaria_intranet": WorkerDefinition(
        name="worker_asistencia_diaria_intranet",
        module="utils.intranet.archivos.worker_asistencia_diaria_intranet",
        category=WorkerCategory.INTRANET,
        description="Importa asistencia diaria desde el sistema intranet.",
    ),
    "worker_asistencia_extra_intranet": WorkerDefinition(
        name="worker_asistencia_extra_intranet",
        module="utils.intranet.archivos.worker_asistencia_extra_intranet",
        category=WorkerCategory.INTRANET,
        description="Importa registros de asistencia extra (horas adicionales).",
    ),
    "worker_cargos_intranet": WorkerDefinition(
        name="worker_cargos_intranet",
        module="utils.intranet.archivos.worker_cargos_intranet",
        category=WorkerCategory.INTRANET,
        description="Sincroniza cargos desde intranet hacia la base de datos.",
    ),
    "worker_gastos_intranet": WorkerDefinition(
        name="worker_gastos_intranet",
        module="utils.intranet.archivos.worker_gastos_intranet",
        category=WorkerCategory.INTRANET,
        description="Importa gastos operacionales desde intranet.",
    ),
    "worker_ingreso_modificadores_sueldo_intranet": WorkerDefinition(
        name="worker_ingreso_modificadores_sueldo_intranet",
        module="utils.intranet.archivos.worker_ingreso_modificadores_sueldo_intranet",
        category=WorkerCategory.INTRANET,
        description="Registra modificadores de ingreso a sueldo desde intranet.",
    ),
    "worker_modificadores_sueldo_intranet": WorkerDefinition(
        name="worker_modificadores_sueldo_intranet",
        module="utils.intranet.archivos.worker_modificadores_sueldo_intranet",
        category=WorkerCategory.INTRANET,
        description="Procesa modificadores de sueldo (bonos, descuentos, etc.).",
    ),
    "worker_pago_sueldos_intranet": WorkerDefinition(
        name="worker_pago_sueldos_intranet",
        module="utils.intranet.archivos.worker_pago_sueldos_intranet",
        category=WorkerCategory.INTRANET,
        description="Importa y registra el pago de sueldos del período.",
    ),
    "worker_trabajadores_intranet": WorkerDefinition(
        name="worker_trabajadores_intranet",
        module="utils.intranet.archivos.worker_trabajadores_intranet",
        category=WorkerCategory.INTRANET,
        description="Sincroniza el padrón de trabajadores desde intranet.",
    ),

    # ── KPIS ─────────────────────────────────────────────────────────────────
    "worker_meritocracy": WorkerDefinition(
        name="worker_meritocracy",
        module="utils.kpis.worker_meritocracy",
        category=WorkerCategory.KPIS,
        description="Calcula puntuaciones de meritocracia por trabajador.",
    ),
    "worker_sales_kpis_cache": WorkerDefinition(
        name="worker_sales_kpis_cache",
        module="utils.kpis.worker_sales_kpis_cache",
        category=WorkerCategory.KPIS,
        description="Precalcula y cachea KPIs de ventas para dashboards.",
    ),
    "worker_tiempos_centros": WorkerDefinition(
        name="worker_tiempos_centros",
        module="utils.kpis.worker_tiempos_centros",
        category=WorkerCategory.KPIS,
        description="Analiza tiempos de atención por centro de producción.",
    ),
    "worker_admin_kpis": WorkerDefinition(
        name="worker_admin_kpis",
        module="utils.kpis.worker_admin_kpis",
        category=WorkerCategory.KPIS,
        description="KPIs administrativos consolidados del período.",
    ),
}


# ─── Schemas tipados ──────────────────────────────────────────────────────────

class WorkerSummary(BaseModel):
    """Worker con metadatos, para el listado del frontend."""
    name: str
    category: WorkerCategory
    description: str


class WorkersByCategory(BaseModel):
    """Workers agrupados por categoría para el frontend."""
    mtz: List[WorkerSummary] = Field(default_factory=list)
    intranet: List[WorkerSummary] = Field(default_factory=list)
    kpis: List[WorkerSummary] = Field(default_factory=list)


class ListWorkersResponse(BaseModel):
    """Respuesta del endpoint GET /workers/list."""
    workers: List[str]
    total: int
    by_category: WorkersByCategory


class ExecuteWorkersRequest(BaseModel):
    """Payload para ejecutar workers."""
    mesano: str = Field(
        ...,
        description="Período en formato YYYYMM (ej: 202408)",
        examples=["202408"],
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )
    include: Optional[List[str]] = Field(
        default=None,
        description="Lista de workers a ejecutar. Si es null, se ejecutan todos.",
    )
    exclude: Optional[List[str]] = Field(
        default=None,
        description="Lista de workers a excluir de la ejecución.",
    )

    @field_validator("mesano")
    @classmethod
    def validate_mesano(cls, v: str) -> str:
        import re
        if not re.match(r"^\d{6}$", v):
            raise ValueError("mesano debe tener formato YYYYMM (6 dígitos numéricos)")
        year = int(v[:4])
        month = int(v[4:])
        if not (1 <= month <= 12):
            raise ValueError(f"Mes inválido: {month}. Debe ser entre 01 y 12.")
        if year < 2000 or year > 2100:
            raise ValueError(f"Año fuera de rango: {year}.")
        return v

    @field_validator("include", "exclude", mode="before")
    @classmethod
    def validate_worker_names(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        unknown = [name for name in v if name not in WORKER_REGISTRY]
        if unknown:
            raise ValueError(f"Workers no reconocidos: {unknown}")
        return v


class WorkerStatus(str, Enum):
    OK         = "ok"
    ERROR      = "error"
    NOT_FOUND  = "not_found"
    NO_HANDLER = "no_handler"


class ExecuteWorkerResult(BaseModel):
    """Resultado de ejecución de un worker individual."""
    worker: str = Field(..., description="Nombre del worker ejecutado")
    status: WorkerStatus = Field(..., description="Estado de la ejecución")
    category: Optional[WorkerCategory] = Field(None, description="Categoría del worker")
    handler: Optional[Literal["run_worker", "process_period", "main"]] = Field(
        None, description="Función del módulo que se invocó"
    )
    duration_ms: Optional[float] = Field(
        None, description="Duración de la ejecución en milisegundos"
    )
    detail: Optional[str] = Field(None, description="Mensaje de error o detalle adicional")


class ExecuteWorkersResponse(BaseModel):
    """Respuesta completa del endpoint POST /workers/execute."""
    mesano: str = Field(..., description="Período ejecutado")
    total: int = Field(..., description="Total de workers ejecutados")
    success_count: int = Field(..., description="Workers completados con éxito")
    error_count: int = Field(..., description="Workers que fallaron")
    total_duration_ms: float = Field(..., description="Duración total en ms")
    results: List[ExecuteWorkerResult] = Field(..., description="Resultados individuales")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _require_admin(user: dict) -> None:
    """Lanza 403 si el usuario no es admin (nivel 3 o 4)."""
    from config.roles.service import verify_admin
    if not verify_admin(user["wallet"]):
        raise HTTPException(
            status_code=403,
            detail="Nivel de rol insuficiente. Se requiere DOMINUS_SAPORIS o CENTURIO_MENSARUM.",
        )


def _run_worker_module(defn: WorkerDefinition, mesano: str) -> ExecuteWorkerResult:
    """
    Intenta invocar un módulo de worker en este orden:
      1) run_worker(mesano)
      2) process_period(mesano)
      3) main() con input() interceptado

    Devuelve un ExecuteWorkerResult siempre (nunca lanza).
    """
    start = time.perf_counter()

    try:
        mod = importlib.import_module(defn.module)
    except ModuleNotFoundError as e:
        return ExecuteWorkerResult(
            worker=defn.name,
            status=WorkerStatus.NOT_FOUND,
            category=defn.category,
            detail=f"Módulo no encontrado: {defn.module} — {e}",
            duration_ms=round((time.perf_counter() - start) * 1000, 2),
        )
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[workers] Import error {defn.name}: {e}\n{tb}")
        return ExecuteWorkerResult(
            worker=defn.name,
            status=WorkerStatus.ERROR,
            category=defn.category,
            detail=f"Error al importar módulo: {e}",
            duration_ms=round((time.perf_counter() - start) * 1000, 2),
        )

    try:
        handler: Optional[Literal["run_worker", "process_period", "main"]] = None

        if hasattr(mod, "run_worker"):
            handler = "run_worker"
            mod.run_worker(mesano)

        elif hasattr(mod, "process_period"):
            handler = "process_period"
            mod.process_period(mesano)

        elif hasattr(mod, "main"):
            import builtins as _b
            _orig = _b.input
            try:
                handler = "main"
                _b.input = lambda prompt="": mesano
                mod.main()
            finally:
                _b.input = _orig

        else:
            return ExecuteWorkerResult(
                worker=defn.name,
                status=WorkerStatus.NO_HANDLER,
                category=defn.category,
                detail="El módulo no expone run_worker(), process_period() ni main().",
                duration_ms=round((time.perf_counter() - start) * 1000, 2),
            )

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(f"[workers] ✅ {defn.name} ({handler}) completado en {duration_ms}ms")
        return ExecuteWorkerResult(
            worker=defn.name,
            status=WorkerStatus.OK,
            category=defn.category,
            handler=handler,
            duration_ms=duration_ms,
        )

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[workers] ❌ {defn.name}: {e}\n{tb}")
        return ExecuteWorkerResult(
            worker=defn.name,
            status=WorkerStatus.ERROR,
            category=defn.category,
            detail=str(e),
            duration_ms=round((time.perf_counter() - start) * 1000, 2),
        )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get(
    "/workers/list",
    response_model=ListWorkersResponse,
    summary="Listar workers disponibles",
    description="Retorna todos los workers registrados con metadatos y agrupados por categoría.",
    tags=["workers"],
)
def list_workers(user: dict = Depends(verify_session)):
    _require_admin(user)

    by_cat = WorkersByCategory()
    all_names: List[str] = []

    for defn in WORKER_REGISTRY.values():
        summary = WorkerSummary(
            name=defn.name,
            category=defn.category,
            description=defn.description,
        )
        all_names.append(defn.name)
        if defn.category == WorkerCategory.MTZ:
            by_cat.mtz.append(summary)
        elif defn.category == WorkerCategory.INTRANET:
            by_cat.intranet.append(summary)
        elif defn.category == WorkerCategory.KPIS:
            by_cat.kpis.append(summary)

    return ListWorkersResponse(
        workers=all_names,
        total=len(all_names),
        by_category=by_cat,
    )


@router.post(
    "/workers/execute",
    response_model=ExecuteWorkersResponse,
    summary="Ejecutar workers",
    description=(
        "Ejecuta uno, varios o todos los workers disponibles para el período `mesano` (YYYYMM). "
        "Requiere nivel de admin 3 o 4."
    ),
    tags=["workers"],
)
def execute_workers(
    data: ExecuteWorkersRequest,
    user: dict = Depends(verify_session),
):
    _require_admin(user)

    # Determinar set a ejecutar
    if data.include:
        to_run = [WORKER_REGISTRY[n] for n in data.include if n in WORKER_REGISTRY]
    else:
        to_run = list(WORKER_REGISTRY.values())

    if data.exclude:
        exclude_set = set(data.exclude)
        to_run = [d for d in to_run if d.name not in exclude_set]

    if not to_run:
        raise HTTPException(
            status_code=422,
            detail="La lista de workers a ejecutar está vacía. Revisa include/exclude.",
        )

    wall_start = time.perf_counter()
    results: List[ExecuteWorkerResult] = []

    for defn in to_run:
        logger.info(f"[workers] 🚀 Iniciando {defn.name} para mesano={data.mesano}")
        result = _run_worker_module(defn, data.mesano)
        results.append(result)

    total_duration_ms = round((time.perf_counter() - wall_start) * 1000, 2)
    success_count = sum(1 for r in results if r.status == WorkerStatus.OK)
    error_count = len(results) - success_count

    logger.info(
        f"[workers] Ejecución completada: {success_count}/{len(results)} OK "
        f"en {total_duration_ms}ms para mesano={data.mesano}"
    )

    return ExecuteWorkersResponse(
        mesano=data.mesano,
        total=len(results),
        success_count=success_count,
        error_count=error_count,
        total_duration_ms=total_duration_ms,
        results=results,
    )
