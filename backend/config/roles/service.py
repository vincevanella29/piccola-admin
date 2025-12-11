# backend/config/roles/service.py
from __future__ import annotations

import os
import logging
from typing import Optional

from web3.exceptions import ContractLogicError
from eth_account.messages import encode_defunct

from utils.web3mongo import w3, launchpad_contract

logger = logging.getLogger(__name__)

COMPANY_ID: int = int(os.getenv("COMPANY_ID", "1"))

ROLE_LEVELS = {
    "DOMINUS_SAPORIS": 3,    # admin total
    "CENTURIO_MENSARUM": 4,  # sub-admin
    "MILITES_CULINAE": 5,    # miembro base
}
ROLE_NAMES = {v: k for k, v in ROLE_LEVELS.items()}

def normalize_address(addr: str) -> str:
    if not isinstance(addr, str) or not w3.is_address(addr):
        raise ValueError(f"Invalid wallet address: {addr}")
    return w3.to_checksum_address(addr)

def get_role_name(level: int) -> Optional[str]:
    return ROLE_NAMES.get(level)

def get_level_by_role_name(role_name: str) -> Optional[int]:
    return ROLE_LEVELS.get(role_name)

def is_member_level(level: int) -> bool:
    return level in (3, 4, 5)

def get_company_role_level(wallet: str, company_id: Optional[int] = None) -> int:
    # Si no es una dirección Ethereum válida (p.ej. did:privy:...), no intentamos
    # llamar al contrato y devolvemos -1 silenciosamente.
    if not isinstance(wallet, str) or not w3.is_address(wallet):
        return -1

    try:
        checksum = normalize_address(wallet)
        cid = int(company_id if company_id is not None else COMPANY_ID)
        role_level = launchpad_contract.functions.getCompanyLevel(checksum, cid).call()
        if not isinstance(role_level, int) or role_level < 0 or role_level > 5:
            return -1
        return role_level
    except ContractLogicError as e:
        logger.error(f"[roles.service] Contract error getCompanyLevel({wallet}): {e}")
        return -1
    except Exception as e:
        logger.error(f"[roles.service] Unexpected error getCompanyRoleLevel({wallet}): {e}")
        return -1

def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    try:
        checksum = normalize_address(wallet)
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        return recovered.lower() == checksum.lower()
    except Exception as e:
        logger.error(f"[roles.service] verify_signature error: {e}")
        return False

def validate_hierarchy(caller_level: int, target_level: int) -> bool:
    if caller_level in (-1, 5):
        return False
    if caller_level == 3:
        return target_level in (4, 5)
    if caller_level == 4:
        return target_level == 5
    return False

def verify_admin(wallet: str) -> bool:
    role_level = get_company_role_level(wallet)
    return role_level in (3, 4)

def verify_subadmin(wallet: str) -> bool:
    role_level = get_company_role_level(wallet)
    return role_level in (3, 5)
