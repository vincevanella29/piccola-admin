import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from utils.auth.session import verify_session
from utils.web3mongo import w3
from config.gamification import service as gamification_service
from config.gamification.models import SegmentDefinition

# ⬇️ Reglas de acceso por nivel de rol
from config.roles.access import require_admin_level, get_effective_role_level_from_user

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
    mint_nonce: Optional[str] = None

class BatchConfirmInput(BaseModel):
    tx_hash: str
    result_ids: List[str]
    mint_nonce: Optional[str] = None

class DefineFromTemplatePayload(BaseModel):
    rule_name: str
    segment_token_id: int
    template_key: str
    params: Dict[str, Any] = {}
    merit_points: int
    is_active: bool = True
    scope: Optional[Dict[str, Any]] = None

class _UserSession(BaseModel):
    permissions: Dict[str, Any] = {}


# -------------------- HELPERS DE ACCESO --------------------
def admin_user(user: Dict[str, Any] = Depends(verify_session)) -> Dict[str, Any]:
    """Restringe a niveles 3/5 (member/subadmin on-chain)."""
    require_admin_level(user, "member")
    return user


def staff_user(user: Dict[str, Any] = Depends(verify_session)) -> Dict[str, Any]:
    """Permite cualquier usuario con role_level efectivo 1..7 según permissions.

    Útil para vistas de staff (empleados) que no requieren rol admin on-chain,
    como la lista de segmentos disponibles.
    """
    rl_int = get_effective_role_level_from_user(user or {})
    if rl_int is None:
        raise HTTPException(status_code=403, detail="No tienes un nivel de acceso válido para ver esta información.")

    return user

# -------------------- ENDPOINTS --------------------

@router.get(
    "/admin/gamification/merit/periods",
    summary="Lista los períodos únicos con méritos pendientes",
    dependencies=[Depends(admin_user)],
)
async def get_merit_periods():
    periods = gamification_service.list_merit_periods()
    return {"ok": True, "periods": periods}


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
    # Filtrar solo empleados con wallet EVM válida; ignorar DIDs de Privy u otros formatos
    employees = []
    for e in body.employees:
        wallet_str = (e.wallet or "").strip()
        # Ignorar explícitamente DIDs u otros identificadores no EVM
        if not wallet_str or wallet_str.startswith("did:"):
            logger.info(f"Ignorando empleado sin wallet EVM válida en plan-batch: rut={e.rut}, wallet={wallet_str}")
            continue
        try:
            checksum_wallet = w3.to_checksum_address(wallet_str)
        except ValueError:
            logger.info(f"Ignorando empleado con wallet inválida en plan-batch: rut={e.rut}, wallet={wallet_str}")
            continue
        employees.append({"rut": e.rut, "wallet": checksum_wallet})

    if not employees:
        raise HTTPException(status_code=400, detail="No hay empleados con wallet EVM válida para este batch.")

    return gamification_service.plan_batch_merit(employees=employees, ym=body.ym)


@router.post(
    "/admin/gamification/merit/build-batch-txs",
    summary="Construye la TX para un batch de méritos sin enviarla",
)
async def build_batch_txs(body: BatchTxsInput, user: dict = Depends(admin_user)):
    from utils.web3mongo import db
    
    # Layer 2: Idempotency Check (PRE-FIRMA)
    if body.mint_nonce:
        existing = db.meritocracy_mint_nonces.find_one({"mint_nonce": body.mint_nonce})
        if existing:
            if existing.get("status") == "confirmed" or existing.get("tx_hash"):
                return {
                    "ok": True,
                    "deduplicated": True,
                    "transaction": None,
                    "tx_hash": existing.get("tx_hash"),
                    "message": "Este batch ya fue minteado exitosamente."
                }
            elif existing.get("status") == "pending":
                raise HTTPException(
                    status_code=409,
                    detail="Este batch ya tiene una transacción pendiente de firma. Por favor, verifica en tu wallet o reconcilia la transacción antes de reintentar."
                )

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

    # Guardar en Mongo como "pending" ANTES de que el usuario firme
    if body.mint_nonce:
        from datetime import datetime
        db.meritocracy_mint_nonces.insert_one({
            "mint_nonce": body.mint_nonce,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "transaction_built": transaction,
            "result_ids": [award['result_id'] for award in awards_in_plan],
            "signer_wallet": sender_wallet
        })

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
    from utils.web3mongo import db
    from datetime import datetime
    try:
        gamification_service.mark_merits_as_minted(payload.result_ids, payload.tx_hash)
        
        # Actualizar idempotency key a "confirmed"
        if payload.mint_nonce:
            db.meritocracy_mint_nonces.update_one(
                {"mint_nonce": payload.mint_nonce},
                {"$set": {
                    "status": "confirmed", 
                    "tx_hash": payload.tx_hash, 
                    "confirmed_at": datetime.utcnow()
                }},
                upsert=True
            )
            
        logger.info(f"Se confirmaron y marcaron {len(payload.result_ids)} méritos como 'minted' en la BD.")
        return {"ok": True, "message": "Méritos marcados como pagados exitosamente."}
    except Exception as e:
        logger.error(f"Error al confirmar el batch con hash {payload.tx_hash}: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar el estado de los méritos en la base de datos.")


@router.post(
    "/admin/gamification/merit/reconcile-nonce",
    summary="Permite reconciliar o abandonar un nonce pendiente (ej. si el usuario rechazó la firma en MetaMask)",
    dependencies=[Depends(admin_user)],
)
async def reconcile_pending_nonce(mint_nonce: str = Query(...)):
    from utils.web3mongo import db
    from datetime import datetime
    
    existing = db.meritocracy_mint_nonces.find_one({"mint_nonce": mint_nonce})
    if not existing:
        raise HTTPException(status_code=404, detail="Nonce no encontrado.")
        
    if existing.get("status") == "confirmed":
        return {"ok": False, "message": "El nonce ya está confirmado y minteado."}
        
    # TODO: Podríamos consultar el RPC de Polygon para ver si existe un evento asociado
    # a este sender en los últimos minutos, pero como no guardamos el tx_hash de antemano
    # (porque MetaMask genera el hash), tenemos que confiar en el admin.
    
    # Marcamos como abandonado para liberar el retry
    db.meritocracy_mint_nonces.update_one(
        {"mint_nonce": mint_nonce},
        {"$set": {
            "status": "abandoned",
            "abandoned_at": datetime.utcnow()
        }}
    )
    return {"ok": True, "message": "Nonce pendiente abandonado. Ya puedes reintentar."}


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


# ---- Update Rule (PATCH-like) ----
class UpdateRulePayload(BaseModel):
    # Identificador de la regla a actualizar
    identifier: str = Field(..., description="rule_name o _id (según use_id)")
    use_id: bool = Field(False, description="Si True, 'identifier' se interpreta como _id")

    # Campos actualizables (patch, opcionales)
    rule_name: Optional[str] = None
    segment_token_id: Optional[int] = None
    template_key: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    merit_points: Optional[int] = None
    is_active: Optional[bool] = None
    scope: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Para eliminar scope pásalo explícitamente como null, para mantenerlo omite el campo",
    )

    # Flags
    validates: bool = Field(True, description="Validar contra template + segmentos permitidos")


@router.put(
    "/admin/gamification/rules/update",
    summary="Actualiza (patch) una regla de meritocracia",
    dependencies=[Depends(admin_user)],
)
async def update_meritocracy_rule(payload: UpdateRulePayload):
    """
    - Identifica por rule_name (default) o por _id (use_id=True).
    - Aplica patch solo a los campos provistos.
    - Si validates=True: valida template, params, merit_points y que el segment_token_id esté permitido.
    - Para remover 'scope' envía scope=null.
    """
    return gamification_service.update_meritocracy_rule(payload.model_dump())


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
    dependencies=[Depends(staff_user)],
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
