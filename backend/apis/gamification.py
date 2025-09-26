import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from utils.auth.session import verify_session
from utils.web3mongo import w3
from config.gamification import service as gamification_service
from config.gamification.models import SegmentDefinition

# ⬇️ NUEVO: import del requisito de nivel admin
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger(__name__)

# -------------------- MODELOS --------------------
class EmployeeInput(BaseModel):
    rut: str
    wallet: str

class BatchPlanInput(BaseModel):
    ym: Optional[str] = None
    employees: List[EmployeeInput]

class BatchTxsInput(BaseModel):
    plan: BatchPlanInput
    fast_minter_wallet: Optional[str] = None

class BatchConfirmInput(BaseModel):
    tx_hash: str
    result_ids: List[str]

class DefineFromTemplatePayload(BaseModel):
    rule_name: str
    segment_token_id: int
    template_key: str
    params: Dict[str, Any] = {}
    merit_points: int
    is_active: bool = True
    scope: Optional[Dict[str, Any]] = None

# -------------------- HELPER: enforce admin --------------------
def admin_user(user: Dict[str, Any] = Depends(verify_session)) -> Dict[str, Any]:
    """
    Devuelve el user de sesión si y solo si tiene nivel de admin (role level 3/4),
    lanzando 403 en caso contrario.
    """
    require_admin_level(user, "admin")
    return user

# -------------------- ENDPOINTS --------------------

@router.get(
    "/admin/gamification/merit/results",
    summary="Lista los resultados de méritos con filtros avanzados",
    dependencies=[Depends(admin_user)],
)
async def get_merit_results(
    periodo_start: Optional[str] = Query(None, description="Filtro de inicio de período (YYYY-MM)"),
    periodo_end: Optional[str] = Query(None, description="Filtro de fin de período (YYYY-MM)"),
    mint_status: Optional[str] = Query("pending", description="Estado del mérito: 'pending' o 'minted'"),
    status: Optional[str] = Query("fulfilled", description="Resultado de la regla: 'fulfilled' o 'not_fulfilled'")
):
    results = gamification_service.list_merit_results(
        periodo_start=periodo_start,
        periodo_end=periodo_end,
        mint_status=mint_status,
        status=status
    )
    return {"ok": True, "results": results}


@router.post(
    "/admin/gamification/merit/plan-batch",
    summary="Planifica méritos para un batch desde la BD de resultados",
    dependencies=[Depends(admin_user)],
)
async def plan_batch_merit(body: BatchPlanInput):
    employees = [
        {"rut": e.rut, "wallet": w3.to_checksum_address(e.wallet)}
        for e in body.employees
    ]
    return gamification_service.plan_batch_merit(employees=employees, ym=body.ym)


@router.post(
    "/admin/gamification/merit/build-batch-txs",
    summary="Construye la TX para un batch de méritos sin enviarla",
)
async def build_batch_txs(body: BatchTxsInput, user: dict = Depends(admin_user)):
    # Reutilizamos la planificación para normalizar/validar entradas
    plan_result = await plan_batch_merit(body.plan)

    awards_in_plan = plan_result.get("awards", [])
    if not awards_in_plan:
        raise HTTPException(status_code=400, detail="No hay méritos válidos para procesar en este batch.")

    sender_wallet_str = body.fast_minter_wallet or user.get("wallet")
    if not sender_wallet_str:
        raise HTTPException(status_code=400, detail="No se pudo determinar la wallet del firmante.")

    sender_wallet = w3.to_checksum_address(sender_wallet_str)

    txs_res = gamification_service.build_batch_txs_via_dao(plan_result.get("packed", []), sender_wallet)
    transactions_list = txs_res.get("transactions", [])

    # --- FIX: devolver objeto (no lista) ---
    transaction = transactions_list[0] if transactions_list else None
    if not transaction:
        raise HTTPException(status_code=500, detail="No se pudo construir la transacción del batch.")

    return {
        "ok": True,
        "daoAddress": txs_res.get("daoAddress"),
        "transaction": transaction,
        "result_ids_in_plan": [award['result_id'] for award in awards_in_plan],
        "totals_by_token": plan_result.get("totals_by_token", {}),
        "signer_wallet": sender_wallet,
        "processed_awards_count": len(awards_in_plan),
    }


@router.post(
    "/admin/gamification/merit/confirm-batch",
    summary="Confirma y marca un batch de méritos como pagado después de una TX exitosa",
    dependencies=[Depends(admin_user)],
)
async def confirm_batch_mint(payload: BatchConfirmInput):
    try:
        gamification_service.mark_merits_as_minted(payload.result_ids, payload.tx_hash)
        logger.info(f"Se confirmaron y marcaron {len(payload.result_ids)} méritos como 'minted' en la BD.")
        return {"ok": True, "message": "Méritos marcados como pagados exitosamente."}
    except Exception as e:
        logger.error(f"Error al confirmar el batch con hash {payload.tx_hash}: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar el estado de los méritos en la base de datos.")


# --- Reglas, Templates, Segmentos, etc. ---

@router.get(
    "/admin/gamification/rules/list",
    summary="Lista Reglas de Meritocracia",
    dependencies=[Depends(admin_user)],
)
async def list_meritocracy_rules(only_active: Optional[bool] = None, segment_token_id: Optional[int] = None):
    return gamification_service.list_meritocracy_rules(only_active=only_active, segment_token_id=segment_token_id)


@router.post(
    "/admin/gamification/rules/define-from-template",
    summary="Valida y guarda una regla basada en template",
)
async def define_rule_from_template(payload: DefineFromTemplatePayload, user: dict = Depends(admin_user)):
    # (opcional) podrías validar permisos granulares aquí
    return gamification_service.validate_and_save_rule_from_template(payload.model_dump())


@router.get(
    "/admin/gamification/rules/templates",
    summary="Lista templates de reglas predefinidas",
    dependencies=[Depends(admin_user)],
)
async def list_rule_templates():
    return gamification_service.list_rule_templates_service()


@router.post(
    "/admin/gamification/segments/create",
    summary="[PROPOSAL] Construye la TX para crear un nuevo segmento",
)
async def build_create_segment_tx(payload: SegmentDefinition, user: dict = Depends(admin_user)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    return gamification_service.build_create_segment_tx(
        admin_wallet=admin_wallet,
        name=payload.name,
        symbol=payload.symbol
    )


@router.get(
    "/admin/gamification/segments/list",
    summary="Lista segmentos permitidos para la DAO",
    dependencies=[Depends(admin_user)],
)
async def list_meritocracy_segments():
    return gamification_service.list_permitted_segments_for_company()


@router.get(
    "/admin/gamification/user/profile",
    summary="Perfil de mérito de un usuario por segmentos",
    dependencies=[Depends(admin_user)],
)
async def user_profile(wallet: str):
    return gamification_service.user_profile_summary(wallet)


@router.get(
    "/admin/gamification/catalogs",
    summary="Catálogos de cargos y secciones para UI",
    dependencies=[Depends(admin_user)],
)
async def list_catalogs(q: Optional[str] = None):
    return gamification_service.list_catalogs(q)


@router.get(
    "/admin/gamification/merit/compute",
    summary="Simula el cálculo de puntos para un empleado (preview)",
    dependencies=[Depends(admin_user)],
)
async def compute_merit_preview(rut: str, ym: Optional[str] = None):
    return gamification_service.compute_merit_preview_points(rut=rut, ym=ym)


@router.post(
    "/admin/gamification/minters/set",
    summary="[ON-CHAIN] Autoriza o desautoriza un Fast Minter",
)
async def set_fast_minter(minter_wallet: str, enabled: bool, user: dict = Depends(admin_user)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    return gamification_service.build_set_fast_minter_tx(
        admin_wallet=admin_wallet,
        minter_wallet=minter_wallet,
        enabled=enabled
    )


@router.get(
    "/admin/gamification/minters/list",
    summary="Lista wallets autorizadas como Fast Minter",
    dependencies=[Depends(admin_user)],
)
async def list_fast_minters():
    return gamification_service.list_fast_minters()
