"""
mailing/mail_settings.py
========================
CRUD for email provider configuration.
Credentials are encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256)
derived from the shared Dilithium mnemonic (config_crypto.py).

Supported providers: smtp, ses (SMTP relay), gmail, direct (MX delivery).

Endpoints:
  GET    /mailing/settings      → current config (NO passwords)
  POST   /mailing/settings      → save/update config (encrypted)
  POST   /mailing/settings/test → send test email with current config
  DELETE /mailing/settings      → remove config (fallback to env vars)
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db
from utils.vanellix_crypto import encrypt_sync_config, decrypt_sync_config

router = APIRouter()
logger = logging.getLogger(__name__)

SETTINGS_COLL = db.mail_settings
PROVIDERS_COLL = db.delivery_providers


# ── Helpers ────────────────────────────────────────────────────────────

def _get_mnemonic() -> str:
    """Get the Dilithium mnemonic from the first active delivery provider."""
    prov = PROVIDERS_COLL.find_one(
        {"status": "active", "dilithium_mnemonic_enc": {"$exists": True, "$ne": ""}},
        {"dilithium_mnemonic_enc": 1}
    )
    if not prov or not prov.get("dilithium_mnemonic_enc"):
        raise HTTPException(
            status_code=500,
            detail="No hay mnemónica Dilithium configurada. Vincula un proveedor delivery primero.",
        )
    from utils.vanellix_crypto import decrypt_b2b_mnemonic
    return decrypt_b2b_mnemonic(prov["dilithium_mnemonic_enc"])


def _mask(s: str) -> str:
    """Mask a secret string: show first 3 and last 2 chars."""
    if len(s) <= 5:
        return "***"
    return f"{s[:3]}{'*' * (len(s) - 5)}{s[-2:]}"


# ── Pydantic Models ───────────────────────────────────────────────────

class MailSettingsSave(BaseModel):
    provider: str = Field(..., description="smtp | ses | gmail | direct")
    from_email: str = Field(..., min_length=3)
    from_name: str = Field("La Piccola Italia")
    # SMTP / Gmail fields
    host: Optional[str] = None
    port: Optional[int] = Field(587, ge=1, le=65535)
    user: Optional[str] = None
    password: Optional[str] = None
    tls: Optional[bool] = True
    ssl: Optional[bool] = False
    # SES fields (SMTP relay mode)
    ses_region: Optional[str] = Field(None, description="e.g. us-east-1")
    ses_access_key: Optional[str] = None
    ses_secret_key: Optional[str] = None
    # Direct (Vanellix MX) rate limits
    rate_per_hour: Optional[int] = Field(50, ge=1, le=1000)
    rate_per_day: Optional[int] = Field(500, ge=1, le=50000)


class MailSettingsTest(BaseModel):
    to: str = Field(..., description="Email de prueba")


# ── Endpoints ──────────────────────────────────────────────────────────

@router.get("/mailing/settings", summary="Get current mail provider config (masked)")
async def get_mail_settings(user: dict = Depends(verify_session)):
    """Returns current mail config WITHOUT passwords (masked)."""
    require_admin_level(user, "member")

    doc = SETTINGS_COLL.find_one({"_id": "mail_config"})
    if not doc:
        return {"configured": False, "provider": None}

    # Decrypt to show non-secret fields
    try:
        mnemonic = _get_mnemonic()
        config = decrypt_sync_config(doc["encrypted_blob"], mnemonic)
    except Exception as e:
        logger.warning(f"[mail_settings] Could not decrypt config: {e}")
        return {
            "configured": True,
            "provider": doc.get("provider", "?"),
            "from_email": doc.get("from_email", "?"),
            "from_name": doc.get("from_name", "?"),
            "error": "No se pudo descifrar la configuración",
        }

    # Mask sensitive fields
    masked = {
        "configured": True,
        "provider": config.get("provider"),
        "from_email": config.get("from_email"),
        "from_name": config.get("from_name"),
        "host": config.get("host"),
        "port": config.get("port"),
        "user": config.get("user"),
        "password_set": bool(config.get("password")),
        "password_masked": _mask(config.get("password", "")) if config.get("password") else None,
        "tls": config.get("tls"),
        "ssl": config.get("ssl"),
        "ses_region": config.get("ses_region"),
        "ses_access_key_masked": _mask(config.get("ses_access_key", "")) if config.get("ses_access_key") else None,
        "rate_per_hour": config.get("rate_per_hour", 50),
        "rate_per_day": config.get("rate_per_day", 500),
        "configured_at": doc.get("configured_at", "").isoformat() if hasattr(doc.get("configured_at", ""), "isoformat") else str(doc.get("configured_at", "")),
    }
    return masked


@router.post("/mailing/settings", summary="Save mail provider config (encrypted)")
async def save_mail_settings(payload: MailSettingsSave, user: dict = Depends(verify_session)):
    """Encrypts and saves mail provider config to MongoDB."""
    require_admin_level(user, "member")

    if payload.provider not in ("smtp", "ses", "gmail", "direct"):
        raise HTTPException(status_code=400, detail="Provider debe ser 'smtp', 'ses', 'gmail' o 'direct'")

    # Auto-fill for known providers
    config = payload.dict(exclude_none=False)
    if payload.provider == "gmail":
        config["host"] = "smtp.gmail.com"
        config["port"] = 587
        config["tls"] = True
        config["ssl"] = False
    elif payload.provider == "ses":
        region = payload.ses_region or "us-east-1"
        config["host"] = f"email-smtp.{region}.amazonaws.com"
        config["port"] = 587
        config["tls"] = True
        config["ssl"] = False
        config["user"] = payload.ses_access_key
        config["password"] = payload.ses_secret_key

    mnemonic = _get_mnemonic()
    encrypted = encrypt_sync_config(config, mnemonic)

    wallet = user.get("wallet") or user.get("id")
    now = datetime.now(timezone.utc)

    SETTINGS_COLL.update_one(
        {"_id": "mail_config"},
        {"$set": {
            "provider": payload.provider,
            "from_email": payload.from_email,
            "from_name": payload.from_name,
            "encrypted_blob": encrypted,
            "configured_at": now,
            "configured_by": wallet,
        }},
        upsert=True,
    )

    logger.info(f"[mail_settings] ✅ Config saved: provider={payload.provider} from={payload.from_email} by {wallet}")
    return {"success": True, "provider": payload.provider}


@router.post("/mailing/settings/test", summary="Send test email with current config")
async def test_mail_settings(payload: MailSettingsTest, user: dict = Depends(verify_session)):
    """Decrypts credentials and sends a test email."""
    require_admin_level(user, "member")

    doc = SETTINGS_COLL.find_one({"_id": "mail_config"})
    if not doc or not doc.get("encrypted_blob"):
        raise HTTPException(status_code=400, detail="No hay configuración de email guardada")

    mnemonic = _get_mnemonic()
    try:
        config = decrypt_sync_config(doc["encrypted_blob"], mnemonic)
    except Exception:
        raise HTTPException(status_code=500, detail="Error descifrando configuración")

    # Send test email using decrypted config
    from utils.mail_sender import send_email_with_config

    result = await send_email_with_config(
        config=config,
        to=payload.to,
        subject="✅ Test — La Piccola Italia Mail",
        html="<div style='font-family:sans-serif;padding:20px;'><h2>🍕 ¡Funciona!</h2><p>La configuración de email está correcta.</p><p style='color:#999;font-size:12px;'>Enviado desde el admin panel de La Piccola Italia</p></div>",
    )

    if result.get("success"):
        logger.info(f"[mail_settings] ✅ Test email sent to {payload.to}")
        return {"success": True, "message": f"Email de prueba enviado a {payload.to}"}
    else:
        logger.error(f"[mail_settings] ❌ Test failed: {result.get('error')}")
        raise HTTPException(status_code=500, detail=f"Error enviando: {result.get('error')}")


@router.delete("/mailing/settings", summary="Remove mail config (fallback to env vars)")
async def delete_mail_settings(user: dict = Depends(verify_session)):
    """Remove stored mail config — system will fallback to SMTP_* env vars."""
    require_admin_level(user, "member")

    SETTINGS_COLL.delete_one({"_id": "mail_config"})
    logger.info(f"[mail_settings] Config removed by {user.get('wallet')}")
    return {"success": True, "message": "Configuración eliminada. Se usarán las variables de entorno."}
