# backend/config/roles/service.py
from __future__ import annotations

import os
import logging
from typing import Optional

from web3.exceptions import ContractLogicError
from eth_account.messages import encode_defunct

# Solo dependencias "puras" del proyecto (no importan apis.* ni main)
from utils.web3mongo import w3, launchpad_contract

logger = logging.getLogger(__name__)

# Company por defecto (puedes sobreescribir por parámetro en las funciones)
COMPANY_ID: int = int(os.getenv("COMPANY_ID", "1"))

# Constantes de roles (on-chain)
ROLE_LEVELS = {
    "DOMINUS_SAPORIS": 3,    # admin total (puede gestionar 4 y 5)
    "CENTURIO_MENSARUM": 4,  # sub-admin (gestiona 5)
    "MILITES_CULINAE": 5,    # miembro base
}
ROLE_NAMES = {v: k for k, v in ROLE_LEVELS.items()}


# ---------- Helpers básicos ----------

def normalize_address(addr: str) -> str:
    """
    Valida y devuelve la dirección en formato checksum.
    Lanza ValueError si el formato es inválido.
    """
    if not isinstance(addr, str) or not w3.is_address(addr):
        raise ValueError(f"Invalid wallet address: {addr}")
    return w3.to_checksum_address(addr)


def get_role_name(level: int) -> Optional[str]:
    """Devuelve el nombre on-chain del nivel (3/4/5) o None si no corresponde."""
    return ROLE_NAMES.get(level)


def get_level_by_role_name(role_name: str) -> Optional[int]:
    """Devuelve el nivel para un nombre on-chain válido (o None si no corresponde)."""
    return ROLE_LEVELS.get(role_name)


def is_member_level(level: int) -> bool:
    """True si level es miembro conocido (3,4,5)."""
    return level in (3, 4, 5)


# ---------- Lógica de dominio ----------

def get_company_role_level(wallet: str, company_id: Optional[int] = None) -> int:
    """
    Lee en cadena el nivel de rol del wallet para la compañía dada.
    Retorna:
      - 3, 4, 5 si tiene rol
      - -1 si no tiene rol o ante cualquier error/valor fuera de rango
    """
    try:
        checksum = normalize_address(wallet)
        cid = int(company_id if company_id is not None else COMPANY_ID)

        role_level = launchpad_contract.functions.getCompanyLevel(checksum, cid).call()
        # Sanitizar valor
        if not isinstance(role_level, int) or role_level < 0 or role_level > 5:
            logger.info(f"[roles.service] Out-of-range role_level={role_level} for {checksum} cid={cid}; returning -1")
            return -1
        return role_level
    except (ValueError, TypeError) as e:
        logger.error(f"[roles.service] Invalid wallet/company_id: {e}")
        return -1
    except ContractLogicError as e:
        logger.error(f"[roles.service] Contract error getCompanyLevel({wallet}): {e}")
        return -1
    except Exception as e:
        logger.error(f"[roles.service] Unexpected error getCompanyRoleLevel({wallet}): {e}")
        return -1


def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    """
    Verifica que la firma 'signature' (EIP-191) corresponde a 'plain_data'
    firmado por 'wallet'.
    """
    try:
        checksum = normalize_address(wallet)
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        return recovered.lower() == checksum.lower()
    except Exception as e:
        logger.error(f"[roles.service] verify_signature error: {e}")
        return False


def validate_hierarchy(caller_level: int, target_level: int) -> bool:
    """
    Reglas de jerarquía:
      - -1 o 5: no pueden gestionar
      - 4: solo puede gestionar nivel 5
      - 3: puede gestionar 4 y 5
    """
    if caller_level in (-1, 5):
        return False
    if caller_level == 3:
        return target_level in (4, 5)
    if caller_level == 4:
        return target_level == 5
    return False

def verify_admin(wallet: str) -> bool:
    role_level = get_company_role_level(wallet)
    if role_level not in [3, 4]:
        return False
    return True

def verify_subadmin(wallet: str) -> bool:
    role_level = get_company_role_level(wallet)
    if role_level not in [3, 5]:
        return False
    return True