import os
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from utils.auth.session import verify_session
from utils.web3mongo import db, w3
from config.gamification.service import (
    bootstrap_special_via_dao_service,
    list_dao_proposals_service,
    build_vote_tx_service,
    build_execute_tx_service,
    get_company_dao_address_service,
    build_set_fast_minter_tx,
)
from config.roles.service import verify_admin

router = APIRouter()
logger = logging.getLogger(__name__)


async def verify_admin(user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    if not wallet:
        raise HTTPException(status_code=401, detail="Wallet no encontrada en la sesión.")
    if not verify_admin(user):
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere nivel de administrador.")
    return user


@router.get(
    "/admin/gamification/company-dao",
    summary="Obtiene la dirección de la DAO de la compañía principal",
    dependencies=[Depends(verify_admin)]
)
async def get_company_dao_address():
    return get_company_dao_address_service()


@router.post(
    "/admin/gamification/segments/bootstrap-special-dao",
    summary="[PROPOSAL] Construye propuestas DAO->GlobalMeritocracy.createCategoryToken para SPECIAL",
    dependencies=[Depends(verify_admin)]
)
async def bootstrap_special_via_dao(user: dict = Depends(verify_session)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    return bootstrap_special_via_dao_service(admin_wallet)


@router.post(
    "/admin/gamification/segments/propose-create",
    summary="[PROPOSAL] Construye propuesta DAO->GM.createCategoryToken(name,symbol)",
    dependencies=[Depends(verify_admin)]
)
async def propose_create_segment(name: str, symbol: str, user: dict = Depends(verify_session)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    return propose_create_segment_service(admin_wallet, name, symbol)


# ==== DAO proposals: list, vote, execute ====

@router.get(
    "/admin/dao/proposals",
    summary="Lista propuestas de la DAO desde Mongo (dao_events)",
    dependencies=[Depends(verify_admin)]
)
async def list_dao_proposals(from_block: int | None = None, to_block: int | None = None):
    return list_dao_proposals_service(from_block, to_block)


@router.post(
    "/admin/dao/vote",
    summary="Construye TX para votar una propuesta (support=true/false)",
    dependencies=[Depends(verify_admin)]
)
async def build_vote_tx(payload: Dict[str, Any] = Body(...), user: dict = Depends(verify_session)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    proposal_id = int((payload or {}).get("proposal_id"))
    support = bool((payload or {}).get("support"))
    return build_vote_tx_service(admin_wallet, proposal_id, support)


@router.post(
    "/admin/dao/execute",
    summary="Construye TX para ejecutar una propuesta",
    dependencies=[Depends(verify_admin)]
)
async def build_execute_tx(payload: Dict[str, Any] = Body(...), user: dict = Depends(verify_session)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    proposal_id = int((payload or {}).get("proposal_id"))
    return build_execute_tx_service(admin_wallet, proposal_id)
    

@router.post(
    "/admin/dao/set-fast-minter",
    summary="Construye TX para autorizar/desautorizar un fast minter en la DAO",
    dependencies=[Depends(verify_admin)]
)
async def build_set_fast_minter_tx_endpoint(payload: Dict[str, Any] = Body(...), user: dict = Depends(verify_session)):
    admin_wallet = w3.to_checksum_address(user.get("wallet"))
    minter_wallet = (payload or {}).get("minter_wallet")
    enabled = bool((payload or {}).get("enabled"))
    
    if not minter_wallet or not isinstance(minter_wallet, str):
        raise HTTPException(status_code=400, detail="minter_wallet (string) es obligatorio")

    return build_set_fast_minter_tx(admin_wallet, minter_wallet, enabled)
