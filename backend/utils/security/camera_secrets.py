# utils/security/camera_secrets.py
import os
import json
import base64
import hashlib
import hmac
from typing import Any, Dict

AES_KEY_B64_CODE = "<base64-32-bytes>"
HMAC_KEY_B64_CODE = "<base64-32-bytes>"

# Lazy import cryptography
_AESGCM = None

# Prefer DB-backed key storage (already used elsewhere) over a local JSON file
try:
    from utils.web3mongo import db  # provides a global Mongo client/db
except Exception:
    db = None  # Fallback handled below

def _ensure_crypto():
    global _AESGCM
    if _AESGCM is None:
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore
        except Exception as e:
            raise RuntimeError("Missing dependency 'cryptography'. Install with: python3 -m pip install cryptography") from e
        _AESGCM = AESGCM
    return _AESGCM


def _load_keys() -> Dict[str, str]:
    if db is not None:
        try:
            coll = db["secrets"]
            doc = coll.find_one({"_id": "camera_keys"})
            if doc and doc.get("aes_key") and doc.get("hmac_key"):
                return {"aes_key": doc["aes_key"], "hmac_key": doc["hmac_key"], "version": doc.get("version", 1)}
        except Exception:
            pass

    if AES_KEY_B64_CODE and HMAC_KEY_B64_CODE:
        return {"aes_key": AES_KEY_B64_CODE, "hmac_key": HMAC_KEY_B64_CODE, "version": 1}

    aes_key = os.urandom(32)
    hmac_key = os.urandom(32)
    data = {
        "aes_key": base64.b64encode(aes_key).decode(),
        "hmac_key": base64.b64encode(hmac_key).decode(),
        "version": 1,
    }
    if db is not None:
        try:
            db["secrets"].update_one(
                {"_id": "camera_keys"},
                {"$set": {"aes_key": data["aes_key"], "hmac_key": data["hmac_key"], "version": data["version"]}},
                upsert=True,
            )
            return data
        except Exception:
            pass
    return data


def _get_aes_key() -> bytes:
    return base64.b64decode(_load_keys()["aes_key"])  # 32 bytes


def _get_hmac_key() -> bytes:
    return base64.b64decode(_load_keys()["hmac_key"])  # 32 bytes


def encrypt_str(plaintext: str) -> str:
    if plaintext is None:
        return plaintext
    AESGCM = _ensure_crypto()
    key = _get_aes_key()
    aes = AESGCM(key)
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
    return "enc:gcm:" + base64.b64encode(nonce).decode() + "." + base64.b64encode(ct).decode()


def decrypt_str(value: str) -> str:
    if not value or not isinstance(value, str) or not value.startswith("enc:gcm:"):
        return value
    AESGCM = _ensure_crypto()
    key = _get_aes_key()
    aes = AESGCM(key)
    try:
        _, _, rest = value.partition(":gcm:")
        nonce_b64, _, ct_b64 = rest.partition(".")
        nonce = base64.b64decode(nonce_b64)
        ct = base64.b64decode(ct_b64)
        pt = aes.decrypt(nonce, ct, None)
        return pt.decode("utf-8")
    except Exception:
        return ""


def mask_secret(value: str, keep: int = 2) -> str:
    if not value:
        return ""
    if value.startswith("enc:gcm:"):
        return "***enc***"
    if len(value) <= keep:
        return "*" * len(value)
    return "*" * (len(value) - keep) + value[-keep:]


def hmac_sign(obj: Dict[str, Any]) -> str:
    key = _get_hmac_key()
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(key, payload, hashlib.sha256).digest()
    return base64.b64encode(sig).decode()


def hmac_verify(obj: Dict[str, Any], sig_b64: str) -> bool:
    try:
        key = _get_hmac_key()
        payload = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
        expected = hmac.new(key, payload, hashlib.sha256).digest()
        got = base64.b64decode(sig_b64)
        return hmac.compare_digest(expected, got)
    except Exception:
        return False
