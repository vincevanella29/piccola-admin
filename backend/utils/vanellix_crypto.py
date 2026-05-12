"""
utils/vanellix_crypto.py
========================
Vanellix Universal Cryptography Core.
Consolidates all security logic: Post-Quantum Signatures (Dilithium2),
Symmetric Encryption (AES-128 via Fernet), and API Security Guards.

Follows the "Apple Simple" and "Single Source of Truth" mandates.
"""

import os
import time
import hmac
import json
import base64
import hashlib
import logging
from typing import Optional, Tuple

from fastapi import HTTPException, Request
from mnemonic import Mnemonic
from dilithium_py.dilithium import Dilithium2

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from dotenv import load_dotenv

from utils.web3mongo import db

load_dotenv()
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# 1. POST-QUANTUM SIGNATURES (CRYSTALS-Dilithium2)
# ═══════════════════════════════════════════════════════════════════════

_BIP39 = Mnemonic("english")

def _entropy_to_dili_seed(entropy: bytes) -> bytes:
    """Derive a 48-byte Dilithium DRBG seed from 32-byte BIP39 entropy."""
    return hashlib.sha384(entropy).digest()

def generate_dilithium_keypair() -> dict:
    """
    Generate a new Dilithium2 keypair with a BIP39 mnemonic.
    Returns: { "mnemonic": str, "pk_hex": str, "sk_hex": str }
    """
    entropy = os.urandom(32)
    mnemonic = _BIP39.to_mnemonic(entropy)
    dili_seed = _entropy_to_dili_seed(entropy)
    
    Dilithium2.set_drbg_seed(dili_seed)
    pk, sk = Dilithium2.keygen()
    
    logger.info(f"[crypto] Generated new Dilithium2 keypair.")
    return {"mnemonic": mnemonic, "pk_hex": pk.hex(), "sk_hex": sk.hex()}

def keypair_from_mnemonic(mnemonic: str) -> dict:
    """Recover a Dilithium2 keypair from a BIP39 mnemonic phrase."""
    if not _BIP39.check(mnemonic):
        raise ValueError("Invalid BIP39 mnemonic")
    
    entropy = bytes(_BIP39.to_entropy(mnemonic))
    dili_seed = _entropy_to_dili_seed(entropy)
    
    Dilithium2.set_drbg_seed(dili_seed)
    pk, sk = Dilithium2.keygen()
    return {"pk": pk, "sk": sk, "pk_hex": pk.hex()}

def sign_dilithium(sk: bytes, message: bytes) -> str:
    """Sign a message with Dilithium secret key. Returns Hex signature."""
    return Dilithium2.sign(sk, message).hex()

def verify_dilithium(pk_hex: str, message: bytes, signature_hex: str) -> bool:
    """Verify a Dilithium signature."""
    try:
        pk = bytes.fromhex(pk_hex)
        sig = bytes.fromhex(signature_hex)
        return Dilithium2.verify(pk, message, sig)
    except Exception as e:
        logger.warning(f"[crypto] Dilithium verification failed: {e}")
        return False

def sign_with_mnemonic(mnemonic: str, message: bytes) -> Tuple[str, str]:
    """Convenience wrapper: returns (signature_hex, pk_hex)"""
    kp = keypair_from_mnemonic(mnemonic)
    sig_hex = sign_dilithium(kp["sk"], message)
    return sig_hex, kp["pk_hex"]


# ═══════════════════════════════════════════════════════════════════════
# 2. SYMMETRIC ENCRYPTION (AES-128-CBC via Fernet)
# ═══════════════════════════════════════════════════════════════════════

# B2B Encryption Constants
_B2B_SALT = b"vanellix_b2b_salt_2026"
_B2B_MASTER_SECRET = os.getenv("B2B_MASTER_SECRET", "super_secret_vanellix_b2b_key_change_me")

# Config Sync Constants (Legacy compatibility)
_SYNC_SALT = b"vanellix-transbank"
_SYNC_INFO = b"piccola-creds-v1"

def _derive_fernet_pbkdf2(secret: str, salt: bytes) -> Fernet:
    """Derive key using PBKDF2 (Used for backend-only secrets like B2B DB storage)"""
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000)
    return Fernet(base64.urlsafe_b64encode(kdf.derive(secret.encode())))

def _derive_fernet_hkdf(secret: str, salt: bytes, info: bytes) -> Fernet:
    """Derive key using HKDF (Used for cross-server shared secrets like Config Sync)"""
    seed = hashlib.sha256(secret.encode("utf-8")).digest()
    kdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info)
    return Fernet(base64.urlsafe_b64encode(kdf.derive(seed)))

# --- B2B Mnemonic Encryption (PBKDF2) ---
def encrypt_b2b_mnemonic(mnemonic: str) -> str:
    f = _derive_fernet_pbkdf2(_B2B_MASTER_SECRET, _B2B_SALT)
    return f.encrypt(mnemonic.encode('utf-8')).decode('utf-8')

def decrypt_b2b_mnemonic(encrypted_mnemonic: str) -> str:
    f = _derive_fernet_pbkdf2(_B2B_MASTER_SECRET, _B2B_SALT)
    return f.decrypt(encrypted_mnemonic.encode('utf-8')).decode('utf-8')

# --- Cross-Server Config Sync Encryption (HKDF) ---
def encrypt_sync_config(data: dict, shared_mnemonic: str) -> str:
    f = _derive_fernet_hkdf(shared_mnemonic, _SYNC_SALT, _SYNC_INFO)
    plaintext = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return f.encrypt(plaintext).decode("utf-8")

def decrypt_sync_config(blob: str, shared_mnemonic: str) -> dict:
    f = _derive_fernet_hkdf(shared_mnemonic, _SYNC_SALT, _SYNC_INFO)
    return json.loads(f.decrypt(blob.encode("utf-8")))


# ═══════════════════════════════════════════════════════════════════════
# 3. API SECURITY GUARDS (FastAPI Middleware)
# ═══════════════════════════════════════════════════════════════════════

PROVIDERS_COLL = db.delivery_providers
CARTA_PROVIDERS_COLL = db.carta_providers
NONCES_COLL = db.dilithium_nonces

_REQUIRE_DILITHIUM = os.getenv("REQUIRE_DILITHIUM", "true").lower() == "true"
_TIMESTAMP_WINDOW = int(os.getenv("DILITHIUM_TIMESTAMP_WINDOW", "300"))
_ACCEPTED_ALGORITHMS = {"dilithium2"}

def _resolve_provider(key_doc: dict) -> Optional[dict]:
    key_id = key_doc.get("id")
    if not key_id: return None
    prov = PROVIDERS_COLL.find_one({"api_key_id": key_id, "status": "active"})
    if prov: return prov
    return CARTA_PROVIDERS_COLL.find_one({"api_key_id": key_id, "status": "active"})

async def verify_dilithium_request(request: Request, key_doc: dict, context: str = "crypto") -> None:
    """
    Verifies Dilithium2 signatures on incoming requests.
    Enforces timestamp anti-replay and nonce uniqueness.
    """
    provider = _resolve_provider(key_doc)
    stored_pk = (provider or {}).get("dilithium_pk", "")
    slug = (provider or {}).get("slug", "?")

    if not stored_pk:
        if _REQUIRE_DILITHIUM:
            logger.warning(f"[{context}] Provider '{slug}' has no dilithium_pk (REQUIRE_DILITHIUM=true)")
            raise HTTPException(status_code=403, detail="Provider sin clave Dilithium registrada.")
        return

    sig_hex = request.headers.get("X-Dilithium-Signature", "")
    sig_algo = request.headers.get("X-Dilithium-Algorithm", "dilithium2")

    if not sig_hex:
        if _REQUIRE_DILITHIUM:
            raise HTTPException(status_code=403, detail="Firma Dilithium requerida.")
        return

    if sig_algo not in _ACCEPTED_ALGORITHMS:
        raise HTTPException(status_code=403, detail=f"Algoritmo '{sig_algo}' no soportado.")

    if request.method in ("GET", "DELETE", "HEAD", "OPTIONS"):
        query_str = "&".join(f"{k}={v}" for k, v in sorted(request.query_params.items()))
        signable = f"{request.method}\n{request.url.path}\n{query_str}".encode("utf-8")
    else:
        signable = await request.body()

    received_pk = request.headers.get("X-Dilithium-PK", "")
    if received_pk and not hmac.compare_digest(stored_pk, received_pk):
        raise HTTPException(status_code=403, detail="Public key mismatch.")

    if not verify_dilithium(stored_pk, signable, sig_hex):
        raise HTTPException(status_code=403, detail="Firma Dilithium inválida.")

    # Anti-replay
    ts_header = request.headers.get("X-Dilithium-Timestamp", "")
    nonce = request.headers.get("X-Dilithium-Nonce", "")

    if ts_header:
        try:
            ts = float(ts_header)
            now = time.time()
            if abs(now - ts) > _TIMESTAMP_WINDOW:
                raise HTTPException(status_code=403, detail="Request expirado (Timestamp).")
        except (ValueError, TypeError):
            pass

    if nonce:
        try:
            if NONCES_COLL.find_one({"_id": nonce}):
                raise HTTPException(status_code=403, detail="Nonce reutilizado (Replay attack).")
            from datetime import datetime, timezone, timedelta
            NONCES_COLL.insert_one({
                "_id": nonce,
                "provider": slug,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=_TIMESTAMP_WINDOW * 2),
            })
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[{context}] Nonce check failed: {e}")

def ensure_nonce_ttl_index():
    try:
        NONCES_COLL.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"[crypto] Could not create TTL index: {e}")
