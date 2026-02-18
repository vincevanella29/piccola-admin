# backend/config/roles/service.py
from __future__ import annotations

import os
import logging
import time
from typing import Optional

from web3.exceptions import ContractLogicError
from eth_account.messages import encode_defunct

from utils.web3mongo import w3, launchpad_contract, db

logger = logging.getLogger(__name__)

COMPANY_ID: int = int(os.getenv("COMPANY_ID", "1"))

# Cache TTL para role_level on-chain: 24 horas
ROLE_CACHE_TTL = int(os.getenv("ROLE_CACHE_TTL_SECONDS", 86400))  # 24h default

ROLE_LEVELS = {
    "DOMINUS_SAPORIS": 3,    # admin total
    "CENTURIO_MENSARUM": 4,  # sub-admin
    "MILITES_CULINAE": 5,    # miembro base
}
ROLE_NAMES = {v: k for k, v in ROLE_LEVELS.items()}

# MongoDB cache collection for on-chain role levels
_role_cache_col = db.role_level_cache

# Ensure index for fast lookups (idempotent)
try:
    _role_cache_col.create_index([("wallet", 1), ("company_id", 1)], unique=True)
except Exception:
    pass


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

def get_company_role_level(wallet: str, company_id: Optional[int] = None, force_refresh: bool = False) -> int:
    """Get on-chain role level with 24h MongoDB cache.
    
    Resolution order:
    1) MongoDB role cache (fast, 24h TTL — but -1 values only cached 60s)
    2) Blockchain call (authoritative, expensive)
    3) MongoDB events fallback (if blockchain returns -1 or fails)
    
    NEVER caches -1 for more than 60s to avoid locking users out.
    """
    if not isinstance(wallet, str) or not w3.is_address(wallet):
        return -1

    wallet_lower = wallet.lower()
    cid = int(company_id if company_id is not None else COMPANY_ID)
    now = int(time.time())

    # 1) Check MongoDB cache first (unless force_refresh)
    if not force_refresh:
        try:
            cached = _role_cache_col.find_one({"wallet": wallet_lower, "company_id": cid})
            if cached:
                cached_level = cached.get("role_level", -1)
                cached_at = cached.get("cached_at", 0)
                age = now - cached_at
                
                # Valid roles (3/4/5) → trust for full TTL (24h)
                if cached_level in (3, 4, 5) and age < ROLE_CACHE_TTL:
                    logger.debug(f"[ROLE] ✅ Cache hit for {wallet_lower}: level={cached_level} (age={age}s)")
                    return cached_level
                
                # Negative results (-1/0) → only trust for 60s then retry
                if cached_level <= 0 and age < 60:
                    logger.debug(f"[ROLE] Cache hit (negative, short TTL) for {wallet_lower}: level={cached_level} (age={age}s)")
                    return cached_level
                
                # Cache expired or negative cache stale → proceed to blockchain
        except Exception as e:
            logger.warning(f"[roles.service] Cache read error: {e}")

    # 2) Call blockchain (the expensive part)
    role_level = None
    try:
        checksum = normalize_address(wallet)
        raw = launchpad_contract.functions.getCompanyLevel(checksum, cid).call()
        if isinstance(raw, int) and 3 <= raw <= 5:
            role_level = raw
            logger.info(f"[ROLE] 🔗 Blockchain confirmed for {wallet_lower}: level={role_level}")
        else:
            # Blockchain returned 0 or invalid → treat as "not found", try events
            logger.info(f"[ROLE] 🔗 Blockchain returned {raw} for {wallet_lower} (not a valid member level)")
            role_level = None  # Will trigger events fallback
    except ContractLogicError as e:
        logger.error(f"[ROLE] ❌ Contract error getCompanyLevel({wallet_lower}): {e}")
        role_level = None
    except Exception as e:
        logger.error(f"[ROLE] ❌ Web3 error getCompanyLevel({wallet_lower}): {e}")
        role_level = None

    # 3) MongoDB events fallback (if blockchain failed OR returned non-member)
    if role_level is None:
        events_level = _role_from_events_fallback(wallet_lower, cid)
        if events_level in (3, 4, 5):
            role_level = events_level  # Events found a valid role!
        else:
            role_level = -1  # Truly no role

    # 4) Save to cache
    try:
        _role_cache_col.update_one(
            {"wallet": wallet_lower, "company_id": cid},
            {"$set": {"role_level": role_level, "cached_at": now}},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"[roles.service] Cache write error: {e}")

    return role_level


# Role name → level mapping for events fallback
_EVENT_ROLE_MAP = {
    "DOMINUS_SAPORIS": 3,
    "CENTURIO_MENSARUM": 4,
    "MILITES_CULINAE": 5,
}


def _role_from_events_fallback(wallet_lower: str, company_id: int) -> int:
    """Derive role level from UserRegistered/UserRemoved events in MongoDB.
    
    This is the LAST RESORT when both cache and blockchain are unavailable.
    It uses events already synced to MongoDB by the event listener.
    """
    try:
        checksum = w3.to_checksum_address(wallet_lower)
        events = list(db.company_events.find({
            "event": {"$in": ["UserRegistered", "UserRemoved"]},
            "args.companyId": company_id,
            "args.wallet": checksum,
        }).sort([("blockNumber", -1), ("logIndex", -1)]).limit(1))

        if not events:
            # Also try lowercase wallet (some events may store it differently)
            events = list(db.company_events.find({
                "event": {"$in": ["UserRegistered", "UserRemoved"]},
                "args.companyId": company_id,
                "args.wallet": wallet_lower,
            }).sort([("blockNumber", -1), ("logIndex", -1)]).limit(1))

        if events:
            last = events[0]
            if last["event"] == "UserRemoved":
                logger.warning(f"🟡 [FALLBACK] Role for {wallet_lower} derived from events: REMOVED (level=-1)")
                return -1
            role_name = last.get("args", {}).get("role", "")
            level = _EVENT_ROLE_MAP.get(role_name, -1)
            logger.warning(f"🟡 [FALLBACK] Role for {wallet_lower} derived from events: {role_name}={level} (Web3 was unavailable)")
            return level
        else:
            logger.warning(f"🟡 [FALLBACK] No events found for {wallet_lower} in company {company_id} — returning -1")
            return -1
    except Exception as e:
        logger.error(f"🔴 [FALLBACK FAILED] Events fallback also failed for {wallet_lower}: {e}")
        return -1


def invalidate_role_cache(wallet: str, company_id: Optional[int] = None):
    """Invalidate cached role level (call after assign/revoke operations)."""
    cid = int(company_id if company_id is not None else COMPANY_ID)
    try:
        _role_cache_col.delete_one({"wallet": wallet.lower(), "company_id": cid})
    except Exception as e:
        logger.warning(f"[roles.service] Cache invalidation error: {e}")


def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    """Verifica la firma de dos formas:

    1) Firma ECDSA estándar (65 bytes) usada por eth_sign / personal_sign.
    2) Hash de 32 bytes generado con ethers.id(plain_data) (keccak256 del texto).

    Esto permite compatibilidad con el flujo antiguo y el nuevo "simulado".
    """

    if not isinstance(signature, str):
        logger.error("verify_signature: signature is not a string")
        return False

    sig = signature.strip()
    logger.info(
        "verify_signature: wallet=%s, plain_len=%s, sig_len=%s, sig_prefix=%s",
        wallet,
        len(plain_data) if isinstance(plain_data, str) else None,
        len(sig),
        sig[:10],
    )

    # Caso 1: hash de 32 bytes (0x + 64 hex) generado con ethers.id(plain_data)
    if sig.startswith("0x") and len(sig) == 66:
        try:
            expected_hash = w3.keccak(text=plain_data).hex()
            # Normalizar para que coincidan aunque uno tenga '0x' y el otro no
            sig_norm = sig[2:] if sig.startswith("0x") else sig
            exp_norm = expected_hash[2:] if expected_hash.startswith("0x") else expected_hash
            ok = sig_norm.lower() == exp_norm.lower()
            logger.info(
                "verify_signature: 32-byte hash mode, expected=%s, match=%s",
                exp_norm[:18],
                ok,
            )
            return ok
        except Exception as e:
            logger.error(f"Error computing expected hash for signature verification: {e}")
            return False

    # Caso 2: firma ECDSA completa (65 bytes) en hex (0x + 130 chars o 130 chars sin 0x)
    # Normalizamos a bytes antes de llamar a recover_message.
    try:
        if sig.startswith("0x"):
            sig_hex = sig[2:]
        else:
            sig_hex = sig

        # Si mide 64 hex (32 bytes), no es una firma ECDSA válida, es un hash → ya manejado arriba.
        if len(sig_hex) not in (130, 132):  # 65 o 66 bytes en hex, por si incluye v extendido
            logger.error(f"verify_signature: unexpected hex signature length: {len(sig_hex)}")
            return False

        sig_bytes = bytes.fromhex(sig_hex)
    except Exception as e:
        logger.error(f"Error parsing hex signature: {e}")
        return False

    try:
        checksum = normalize_address(wallet)
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=sig_bytes)
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
