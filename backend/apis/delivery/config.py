"""
delivery/config.py
==================
Delivery configuration — internal statuses, schedule, zones, payment methods.
Stored as a single document in MongoDB `delivery_config` collection.

Transbank creds are encrypted with Fernet (derived from shared mnemonic)
and pushed to delivery providers on save.
"""

import asyncio
from utils.time_utils import get_chile_time
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.vanellix_crypto import encrypt_sync_config as encrypt_config
from apis.admin.ecosystem_providers import verify_satellite_webhook

router = APIRouter()
logger = logging.getLogger(__name__)

CONFIG_COLL = db["delivery_config"]
CARRIERS_COLL = db["delivery_carriers"]
PROVIDERS_COLL = db.ecosystem_providers

# ── Default internal statuses ─────────────────────────────────────────────────
DEFAULT_STATUSES = [
    {"key": "pending",    "label": "Pendiente",          "color": "#f59e0b", "icon": "⏳", "order": 0, "kds_controllable": True},
    {"key": "confirmed",  "label": "Confirmado",         "color": "#3b82f6", "icon": "✅", "order": 1, "kds_controllable": True},
    {"key": "preparing",  "label": "Preparando",         "color": "#8b5cf6", "icon": "👨‍🍳", "order": 2, "kds_controllable": True},
    {"key": "ready",      "label": "Listo para despacho", "color": "#10b981", "icon": "📦", "order": 3, "kds_controllable": True},
    {"key": "dispatched", "label": "En reparto",         "color": "#06b6d4", "icon": "🛵", "order": 4, "kds_controllable": False},
    {"key": "delivered",  "label": "Entregado",          "color": "#22c55e", "icon": "✅", "order": 5, "kds_controllable": False},
    {"key": "cancelled",  "label": "Cancelado",          "color": "#ef4444", "icon": "❌", "order": 6, "kds_controllable": False},
]

DEFAULT_PICKUP_STATUSES = [
    {"key": "pending",    "label": "Pendiente",           "color": "#f59e0b", "icon": "⏳", "order": 0, "kds_controllable": True},
    {"key": "confirmed",  "label": "Confirmado",          "color": "#3b82f6", "icon": "✅", "order": 1, "kds_controllable": True},
    {"key": "preparing",  "label": "Preparando",          "color": "#8b5cf6", "icon": "👨‍🍳", "order": 2, "kds_controllable": True},
    {"key": "ready",      "label": "Listo para retiro",   "color": "#10b981", "icon": "🏪", "order": 3, "kds_controllable": True},
    {"key": "delivered",  "label": "Entregado",           "color": "#22c55e", "icon": "✅", "order": 4, "kds_controllable": False},
    {"key": "cancelled",  "label": "Cancelado",           "color": "#ef4444", "icon": "❌", "order": 5, "kds_controllable": False},
]

DEFAULT_SCHEDULE = {
    "1": {"open": "12:00", "close": "22:00"},
    "2": {"open": "12:00", "close": "22:00"},
    "3": {"open": "12:00", "close": "22:00"},
    "4": {"open": "12:00", "close": "22:00"},
    "5": {"open": "12:00", "close": "23:00"},
    "6": {"open": "12:00", "close": "23:00"},
    "7": {"open": "12:00", "close": "22:00"},
}

DEFAULT_FEE_CONFIG = {
    "type": "percentage",       # "percentage" | "fixed" | "none"
    "value": 0,                # 10 = 10% or $1000 depending on type
    "min_fee": 0,              # minimum fee charged (0 = no minimum)
    "max_fee": 0,              # maximum fee cap (0 = no cap)
    "free_above": 0,           # free delivery if order > X (0 = never free)
    "location_overrides": {},  # per-location overrides
}

DEFAULT_SCHEDULING_CONFIG = {
    "scheduling_enabled": True,    # Allow scheduled orders
    "allow_asap": True,            # Allow "Lo antes posible" orders
    "advance_days": 1,             # How many days ahead (0=same day, 1=today+tomorrow)
    "slot_interval_minutes": 30,   # Duration per time slot
    "min_lead_time_minutes": 30,   # Min time from now to first slot
    "max_slots_per_day": 20,       # Cap slots per day to avoid UI bloat
}

DEFAULT_CONFIG = {
    "_id": "delivery_config",
    "internal_statuses": DEFAULT_STATUSES,
    "pickup_statuses": DEFAULT_PICKUP_STATUSES,
    "schedule": DEFAULT_SCHEDULE,
    "zones": [],
    "payment_methods": ["cash", "card", "transfer"],
    "delivery_fee_config": DEFAULT_FEE_CONFIG,
    "scheduling_config": DEFAULT_SCHEDULING_CONFIG,
    "chat_allowed_cargos": [],
    "chat_allowed_secciones": [],
    "kds_allowed_cargos": [],
    "kds_allowed_secciones": [],
}


def _get_config() -> dict:
    """Get or create the delivery config document. Backfills missing fields."""
    doc = CONFIG_COLL.find_one({"_id": "delivery_config"})
    if not doc:
        CONFIG_COLL.insert_one({**DEFAULT_CONFIG})
        doc = CONFIG_COLL.find_one({"_id": "delivery_config"})

    # Backfill pickup_statuses for configs created before the dual-pipeline feature
    if "pickup_statuses" not in doc or not doc["pickup_statuses"]:
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$set": {"pickup_statuses": DEFAULT_PICKUP_STATUSES}},
        )
        doc["pickup_statuses"] = DEFAULT_PICKUP_STATUSES

    # Backfill scheduling_config
    if "scheduling_config" not in doc or not doc["scheduling_config"]:
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$set": {"scheduling_config": DEFAULT_SCHEDULING_CONFIG}},
        )
        doc["scheduling_config"] = DEFAULT_SCHEDULING_CONFIG

    return doc


# =====================================================================
# GET config
# =====================================================================

@router.get("/delivery/config", summary="Get delivery configuration")
async def get_delivery_config(user: dict = Depends(verify_session)):
    """Return the full delivery config document."""
    require_admin_level(user, "delivery")
    config = _get_config()
    config["_id"] = str(config["_id"])
    return {"success": True, "config": config}


@router.get("/delivery/statuses", summary="Get order status pipelines from MongoDB")
async def get_delivery_statuses(user: dict = Depends(verify_session)):
    """
    Returns both delivery and pickup status pipelines.
    Used by Kanban, KDS, Dispatch, Stats — zero hardcoding in the frontend.
    Accessible by any authenticated user (kds level 7 included).
    """
    config = _get_config()
    statuses = config.get("internal_statuses", DEFAULT_STATUSES)
    pickup_statuses = config.get("pickup_statuses", DEFAULT_PICKUP_STATUSES)
    # Ensure sorted by order field
    statuses = sorted(statuses, key=lambda s: s.get("order", 0))
    pickup_statuses = sorted(pickup_statuses, key=lambda s: s.get("order", 0))
    return {"success": True, "statuses": statuses, "pickup_statuses": pickup_statuses}


# =====================================================================
# PUT statuses
# =====================================================================

class StatusItem(BaseModel):
    key: str
    label: str
    color: str = "#666"
    icon: str = "📋"
    order: int = 0
    kds_controllable: bool = True  # False = carrier-managed, KDS cannot advance to this status

class UpdateStatusesRequest(BaseModel):
    pipeline_type: str = "delivery"  # "delivery" | "pickup"
    statuses: List[StatusItem]

@router.put("/delivery/config/statuses", summary="Update delivery or pickup statuses")
async def update_statuses(
    payload: UpdateStatusesRequest,
    user: dict = Depends(verify_session)
):
    """Update either the delivery or pickup status pipeline."""
    require_admin_level(user, "admin")

    if payload.pipeline_type not in ("delivery", "pickup"):
        raise HTTPException(status_code=400, detail="pipeline_type must be 'delivery' or 'pickup'")

    now = get_chile_time()
    statuses_data = [s.dict() for s in payload.statuses]
    field = "internal_statuses" if payload.pipeline_type == "delivery" else "pickup_statuses"

    _get_config()  # ensure doc exists
    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            field: statuses_data,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[delivery/config] {payload.pipeline_type} statuses updated: {len(statuses_data)} statuses")
    return {"success": True, "message": f"{len(statuses_data)} estados actualizados ({payload.pipeline_type})"}


# =====================================================================
# PUT schedule
# =====================================================================

class UpdateScheduleRequest(BaseModel):
    schedule: dict

@router.put("/delivery/config/schedule", summary="Update delivery schedule")
async def update_schedule(
    payload: UpdateScheduleRequest,
    user: dict = Depends(verify_session)
):
    """Update delivery hours by weekday."""
    require_admin_level(user, "admin")

    now = get_chile_time()
    _get_config()
    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            "schedule": payload.schedule,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[delivery/config] Schedule updated")
    return {"success": True, "message": "Horario de delivery actualizado"}


# =====================================================================
# PUT payment methods
# =====================================================================

class UpdatePaymentsRequest(BaseModel):
    payment_methods: List[str]

@router.put("/delivery/config/payments", summary="Update payment methods")
async def update_payments(
    payload: UpdatePaymentsRequest,
    user: dict = Depends(verify_session)
):
    """Update allowed payment methods for delivery."""
    require_admin_level(user, "admin")

    now = get_chile_time()
    _get_config()
    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            "payment_methods": payload.payment_methods,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[delivery/config] Payment methods updated: {payload.payment_methods}")
    return {"success": True, "message": "Métodos de pago actualizados"}


# =====================================================================
# PUT chat access
# =====================================================================

class UpdateChatAccessRequest(BaseModel):
    chat_allowed_cargos: List[str]
    chat_allowed_secciones: List[str] = []
    kds_allowed_cargos: List[str] = []
    kds_allowed_secciones: List[str] = []

@router.put("/delivery/config/chat-access", summary="Update allowed cargos for delivery chat and KDS")
async def update_chat_access(
    payload: UpdateChatAccessRequest,
    user: dict = Depends(verify_session)
):
    """Update allowed cargos for delivery chat access."""
    require_admin_level(user, "admin")

    now = get_chile_time()
    _get_config()
    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            "chat_allowed_cargos": payload.chat_allowed_cargos,
            "chat_allowed_secciones": payload.chat_allowed_secciones,
            "kds_allowed_cargos": payload.kds_allowed_cargos,
            "kds_allowed_secciones": payload.kds_allowed_secciones,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[delivery/config] Access updated: Chat(cargos:{len(payload.chat_allowed_cargos)}, sec:{len(payload.chat_allowed_secciones)}) | KDS(cargos:{len(payload.kds_allowed_cargos)}, sec:{len(payload.kds_allowed_secciones)})")
    return {"success": True, "message": "Permisos de staff actualizados"}


# =====================================================================
# GET / PUT delivery fee config (platform markup)
# =====================================================================

class FeeOverride(BaseModel):
    type: str = Field("percentage", description="percentage | fixed | none")
    value: float = Field(0)
    min_fee: float = Field(0)
    max_fee: float = Field(0)
    free_above: float = Field(0)

class UpdateDeliveryFeeRequest(BaseModel):
    type: str = Field("percentage", description="percentage | fixed | none")
    value: float = Field(0, description="Markup value (% or CLP)")
    min_fee: float = Field(0, description="Minimum delivery fee")
    max_fee: float = Field(0, description="Maximum fee cap (0=no cap)")
    free_above: float = Field(0, description="Free delivery above this order total (0=never)")
    location_overrides: dict[str, FeeOverride] = Field(default_factory=dict, description="Per-location overrides")


@router.get("/delivery/config/delivery-fee", summary="Get platform delivery fee config")
async def get_delivery_fee(user: dict = Depends(verify_session)):
    """Return the current delivery fee markup configuration."""
    require_admin_level(user, "delivery")
    config = _get_config()
    return {
        "success": True,
        "delivery_fee_config": config.get("delivery_fee_config", DEFAULT_FEE_CONFIG),
    }


@router.put("/delivery/config/delivery-fee", summary="Update platform delivery fee config")
async def update_delivery_fee(
    payload: UpdateDeliveryFeeRequest,
    user: dict = Depends(verify_session)
):
    """Update the platform fee markup applied on top of carrier delivery costs."""
    require_admin_level(user, "admin")

    if payload.type not in ("percentage", "fixed", "none"):
        raise HTTPException(status_code=400, detail="type debe ser: percentage, fixed, o none")

    now = get_chile_time()
    fee_data = payload.dict()

    _get_config()
    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            "delivery_fee_config": fee_data,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[delivery/config] Delivery fee updated: {fee_data}")
    return {"success": True, "message": "Configuración de tarifa de envío actualizada", "delivery_fee_config": fee_data}


# =====================================================================
# GET / PUT scheduling config (slot generation parameters)
# =====================================================================

class UpdateSchedulingConfigRequest(BaseModel):
    scheduling_enabled: bool = True
    allow_asap: bool = True
    advance_days: int = Field(1, ge=0, le=10)
    slot_interval_minutes: int = Field(30, ge=15, le=120)
    min_lead_time_minutes: int = Field(30, ge=0, le=180)
    max_slots_per_day: int = Field(20, ge=1, le=150)


@router.get("/delivery/config/scheduling", summary="Get scheduling config")
async def get_scheduling_config(user: dict = Depends(verify_session)):
    """Return the current scheduling configuration."""
    require_admin_level(user, "delivery")
    config = _get_config()
    return {
        "success": True,
        "scheduling_config": config.get("scheduling_config", DEFAULT_SCHEDULING_CONFIG),
    }


@router.put("/delivery/config/scheduling", summary="Update scheduling config")
async def update_scheduling_config(
    payload: UpdateSchedulingConfigRequest,
    user: dict = Depends(verify_session),
):
    """Update scheduling parameters (advance days, slot interval, etc.)."""
    require_admin_level(user, "admin")

    now = get_chile_time()
    sched_data = payload.dict()

    _get_config()
    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            "scheduling_config": sched_data,
            "updated_at": now,
            "updated_by": user.get("wallet") or user.get("id"),
        }}
    )

    logger.info(f"[delivery/config] Scheduling config updated: {sched_data}")
    return {"success": True, "message": "Configuración de programación actualizada", "scheduling_config": sched_data}


# =====================================================================
# PUT carrier status mapping (updates the carrier doc directly)
# =====================================================================

class UpdateCarrierMappingRequest(BaseModel):
    carrier_id: str
    status_mapping: dict

@router.put("/delivery/config/carrier-mapping", summary="Update carrier status mapping")
async def update_carrier_mapping(
    payload: UpdateCarrierMappingRequest,
    user: dict = Depends(verify_session)
):
    """Update a carrier's status → internal status mapping."""
    require_admin_level(user, "admin")

    from bson import ObjectId
    if not ObjectId.is_valid(payload.carrier_id):
        raise HTTPException(status_code=400, detail="ID de carrier inválido")

    carrier = CARRIERS_COLL.find_one({"_id": ObjectId(payload.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier no encontrado")

    now = get_chile_time()
    CARRIERS_COLL.update_one(
        {"_id": ObjectId(payload.carrier_id)},
        {"$set": {
            "status_mapping": payload.status_mapping,
            "updated_at": now,
        }}
    )

    logger.info(f"[delivery/config] Status mapping updated for carrier {carrier['name']}: {len(payload.status_mapping)} mappings")
    return {"success": True, "message": f"Mapping de {carrier['name']} actualizado ({len(payload.status_mapping)} estados)"}


# =====================================================================
# GET/PUT Transbank OneClick config
# =====================================================================

@router.get("/delivery/config/transbank", summary="Get Transbank OneClick config")
async def get_transbank_config(user: dict = Depends(verify_session)):
    """Return Transbank OneClick configuration (keys masked)."""
    require_admin_level(user, "admin")
    config = _get_config()
    tb = config.get("transbank", {})

    # Mask secrets for frontend display
    masked = {
        "environment": tb.get("environment", "test"),
        "test": {
            "commerce_code": tb.get("test", {}).get("commerce_code", ""),
            "api_key": _mask_key(tb.get("test", {}).get("api_key", "")),
            "has_key": bool(tb.get("test", {}).get("api_key")),
        },
        "production": {
            "commerce_code": tb.get("production", {}).get("commerce_code", ""),
            "api_key": _mask_key(tb.get("production", {}).get("api_key", "")),
            "has_key": bool(tb.get("production", {}).get("api_key")),
        },
        "updated_at": tb.get("updated_at"),
    }
    return {"success": True, "transbank": masked}


def _mask_key(key: str) -> str:
    """Mask API key for display: show first 6 and last 4 chars."""
    if not key or len(key) < 12:
        return "•" * len(key) if key else ""
    return key[:6] + "•" * (len(key) - 10) + key[-4:]


class TransbankConfigRequest(BaseModel):
    environment: str = "test"  # "test" or "production"
    commerce_code: str = ""
    api_key: str = ""
    target: str = "test"  # which env to update: "test" or "production"


@router.put("/delivery/config/transbank", summary="Update Transbank OneClick config")
async def update_transbank_config(
    payload: TransbankConfigRequest,
    user: dict = Depends(verify_session),
):
    """Update Transbank OneClick credentials for test or production."""
    require_admin_level(user, "admin")

    if payload.target not in ("test", "production"):
        raise HTTPException(status_code=400, detail="Target debe ser 'test' o 'production'")

    now = get_chile_time()
    _get_config()

    update_fields = {
        f"transbank.{payload.target}.commerce_code": payload.commerce_code,
        "transbank.environment": payload.environment,
        "transbank.updated_at": now,
        "transbank.updated_by": user.get("wallet") or user.get("id"),
    }

    # Only update API key if provided (not empty / masked)
    if payload.api_key and "•" not in payload.api_key:
        update_fields[f"transbank.{payload.target}.api_key"] = payload.api_key

    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": update_fields},
    )

    logger.info(f"[delivery/config] Transbank {payload.target} updated by {user.get('wallet')}")

    # Push encrypted config to all active delivery providers (fire-and-forget)
    asyncio.create_task(_push_config_to_providers())

    return {"success": True, "message": f"Transbank {payload.target} actualizado"}


class TransbankEnvRequest(BaseModel):
    environment: str  # "test" or "production"


@router.put("/delivery/config/transbank/environment", summary="Switch Transbank environment")
async def switch_transbank_environment(
    payload: TransbankEnvRequest,
    user: dict = Depends(verify_session),
):
    """Switch between Transbank test and production environment."""
    require_admin_level(user, "admin")

    if payload.environment not in ("test", "production"):
        raise HTTPException(status_code=400, detail="Environment debe ser 'test' o 'production'")

    now = get_chile_time()
    _get_config()

    CONFIG_COLL.update_one(
        {"_id": "delivery_config"},
        {"$set": {
            "transbank.environment": payload.environment,
            "transbank.env_updated_at": now,
            "transbank.env_updated_by": user.get("wallet") or user.get("id"),
        }},
    )

    logger.info(f"[delivery/config] Transbank env switched to {payload.environment}")

    # Push env change to delivery providers
    asyncio.create_task(_push_config_to_providers())

    return {"success": True, "message": f"Ambiente cambiado a {payload.environment}"}

# =====================================================================
# Manual push — frontend "Sync Config" button
# =====================================================================

@router.post("/delivery/config/push-to-providers", summary="Push config to all delivery providers")
async def push_config_to_providers(user: dict = Depends(verify_session)):
    """
    Manually push all delivery config (schedule, payments, transbank creds)
    encrypted to all active delivery providers. Called from the Sync button.
    """
    require_admin_level(user, "admin")

    # Run synchronously so we can report results
    import httpx

    providers = list(PROVIDERS_COLL.find(
        {"ecosystem_type": "delivery", "status": "active", "$or": [{"domain": {"$exists": True, "$ne": ""}}, {"sync_url": {"$exists": True, "$ne": ""}}]},
        {"slug": 1, "domain": 1, "sync_url": 1, "dilithium_mnemonic_enc": 1, "api_key_id": 1},
    ))

    if not providers:
        return {"success": True, "message": "No hay proveedores activos", "pushed": 0}

    results = []
    for prov in providers:
        slug = prov.get("slug", "?")
        domain = prov.get("domain", "")
        sync_url = prov.get("sync_url", "")
        mnemonic_enc = prov.get("dilithium_mnemonic_enc", "")
        if mnemonic_enc:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
        else:
            mnemonic = ""

        if (not domain and not sync_url) or not mnemonic:
            results.append({"slug": slug, "ok": False, "reason": "Missing domain/sync_url or mnemonic"})
            continue

        # Prefer domain-based URL construction
        if domain:
            from apis.admin.ecosystem_providers import build_provider_url
            config_url = build_provider_url(domain, "config_sync", "delivery")
        else:
            base_url = sync_url.rsplit("/catalog/sync", 1)[0] if "/catalog/sync" in sync_url else sync_url.rsplit("/", 1)[0]
            config_url = f"{base_url}/admin/config/sync"

        try:
            payload = _build_sync_payload(mnemonic, provider_slug=slug)
            
            # Extract Dilithium fields to headers to match strict Delivery backend validation
            sig_hex = payload.pop("dilithium_signature", None)
            pk_hex = payload.pop("dilithium_pk", None)
            algo = payload.pop("signature_algorithm", None)

            headers = {"Content-Type": "application/json"}
            if sig_hex and pk_hex:
                headers["X-Dilithium-Signature"] = sig_hex
                headers["X-Dilithium-PK"] = pk_hex
                headers["X-Dilithium-Algorithm"] = algo
                headers["X-Dilithium-Timestamp"] = str(payload.get("timestamp", ""))

            import json as _json
            payload_bytes = _json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(config_url, content=payload_bytes, headers=headers)

            if resp.status_code == 200:
                results.append({"slug": slug, "ok": True})
                logger.info(f"[config-push] ✅ '{slug}' synced")
            else:
                results.append({"slug": slug, "ok": False, "reason": f"HTTP {resp.status_code}"})
                logger.warning(f"[config-push] ⚠️ '{slug}' → {resp.status_code}")

        except Exception as e:
            results.append({"slug": slug, "ok": False, "reason": str(e)})
            logger.warning(f"[config-push] ❌ '{slug}': {e}")

    ok_count = sum(1 for r in results if r["ok"])
    return {
        "success": True,
        "message": f"{ok_count}/{len(results)} proveedores sincronizados",
        "pushed": ok_count,
        "total": len(results),
        "details": results,
    }


# =====================================================================
# Push encrypted config to delivery providers (fire-and-forget)
# =====================================================================

def _build_sync_payload(mnemonic: str, provider_slug: str = None) -> dict:
    """
    Build the encrypted + signed config payload for delivery sync.
    Includes: transbank creds (encrypted), schedule, payment_methods, statuses.

    Security layers:
      1. Fernet encryption (AES-128-CBC + HMAC-SHA256) for confidentiality
      2. Dilithium2 signature for post-quantum authenticity verification
    """
    from utils.vanellix_crypto import keypair_from_mnemonic, sign_dilithium as sign_message
    import json as _json

    config = _get_config()
    tb = config.get("transbank", {})
    env = tb.get("environment", "test")
    env_creds = tb.get(env, {})

    # Only encrypt if creds exist
    transbank_blob = None
    if env_creds.get("api_key") and env_creds.get("commerce_code"):
        creds_to_encrypt = {
            "environment": env,
            "commerce_code": env_creds["commerce_code"],
            "api_key": env_creds["api_key"],
            # Include both env configs for flexibility
            "test": {
                "commerce_code": tb.get("test", {}).get("commerce_code", ""),
                "api_key": tb.get("test", {}).get("api_key", ""),
            },
            "production": {
                "commerce_code": tb.get("production", {}).get("commerce_code", ""),
                "api_key": tb.get("production", {}).get("api_key", ""),
            },
        }
        transbank_blob = encrypt_config(creds_to_encrypt, mnemonic)

    # Include locations for delivery coverage checks
    locations_coll = db.locations
    raw_locations = list(locations_coll.find(
        {"status": True},
        {"nombre": 1, "direccion": 1, "city": 1, "lat": 1, "lng": 1,
         "permalink_slug": 1, "opening_hours": 1, "telephone": 1, "prioridad": 1,
         "special_dates": 1}
    ).sort("prioridad", 1))
    
    # Derive the global schedule from the primary location to enforce a single source of truth without fallbacks
    derived_schedule = config.get("schedule", {})
    if raw_locations and raw_locations[0].get("opening_hours"):
        primary_hours = raw_locations[0]["opening_hours"]
        derived_schedule = primary_hours.get("delivery") or primary_hours.get("pickup") or derived_schedule
        # Persist the alignment back to the admin configuration
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$set": {"schedule": derived_schedule}}
        )

    locations_list = []
    for loc in raw_locations:
        loc["_id"] = str(loc["_id"])
        locations_list.append(loc)

    payload = {
        "transbank_blob": transbank_blob,
        "transbank_environment": env,
        "transbank_configured": transbank_blob is not None,
        "schedule": derived_schedule,
        "payment_methods": config.get("payment_methods", []),
        "internal_statuses": config.get("internal_statuses", []),
        "pickup_statuses": config.get("pickup_statuses", []),
        "locations": locations_list,
        "delivery_fee_config": config.get("delivery_fee_config", DEFAULT_FEE_CONFIG),
        "scheduling_config": config.get("scheduling_config", DEFAULT_SCHEDULING_CONFIG),
    }

    try:
        from utils.conversion_tracker.sync import get_conversion_trackers_for_provider
        payload["trackers"] = get_conversion_trackers_for_provider(provider_slug) if provider_slug else []
    except Exception as e:
        logger.warning(f"[config-push] ⚠️ Failed to fetch conversion trackers (non-fatal): {e}")
        payload["trackers"] = []
        
    try:
        firebase_config = db.notification_api_configs.find_one({"service": "firebase"})
        if firebase_config:
            payload["notifications"] = {
                "vapidKey": firebase_config.get("vapid_key"),
                "projectId": firebase_config.get("project_id"),
                "firebaseConfig": firebase_config.get("web_config", {}),
                "prompt_config": firebase_config.get("prompt_config", {})
            }
    except Exception as e:
        logger.warning(f"[config-push] ⚠️ Failed to fetch notification config (non-fatal): {e}")

    # ── Dilithium2 Post-Quantum Signature ─────────────────────────
    # Sign the serialized payload so delivery can verify it came from
    # this admin and wasn't tampered with. Even if AES is broken by
    # quantum computers, the Dilithium signature remains valid.
    #
    # Anti-replay: timestamp + nonce included in signed data.
    # Algorithm versioning: explicit algorithm field for future rotation.
    try:
        import uuid as _uuid
        import time as _time

        # Add anti-replay fields BEFORE signing (they're part of what's signed)
        payload["timestamp"] = _time.time()
        payload["nonce"] = _uuid.uuid4().hex

        kp = keypair_from_mnemonic(mnemonic)
        payload_bytes = _json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        signature = sign_message(kp["sk"], payload_bytes)
        payload["dilithium_signature"] = signature
        payload["dilithium_pk"] = kp["pk_hex"]
        payload["signature_algorithm"] = "dilithium2"
        logger.info(f"[config-push] ✅ Payload signed with Dilithium2 (sig={signature[:24]}...)")
    except Exception as e:
        logger.warning(f"[config-push] ⚠️ Dilithium signing failed (non-fatal): {e}")

    return payload


async def _push_config_to_providers():
    """
    Push encrypted config to all active delivery providers.
    Same fire-and-forget pattern as _sync_delivery_providers() in menus/sync.py.
    """
    import httpx

    try:
        providers = list(PROVIDERS_COLL.find(
            {"ecosystem_type": "delivery", "status": "active", "$or": [{"domain": {"$exists": True, "$ne": ""}}, {"sync_url": {"$exists": True, "$ne": ""}}]},
            {"slug": 1, "domain": 1, "sync_url": 1, "dilithium_mnemonic_enc": 1, "api_key_id": 1},
        ))
    except Exception as e:
        logger.error(f"[config-push] Error reading providers: {e}")
        return

    if not providers:
        logger.info("[config-push] No active providers to push config to")
        return

    for prov in providers:
        slug = prov.get("slug", "?")
        domain = prov.get("domain", "")
        sync_url = prov.get("sync_url", "")
        if not domain and not sync_url:
            continue

        # Prefer domain-based URL construction
        if domain:
            from apis.admin.ecosystem_providers import build_provider_url
            config_url = build_provider_url(domain, "config_sync", "delivery")
        else:
            base_url = sync_url.rsplit("/catalog/sync", 1)[0] if "/catalog/sync" in sync_url else sync_url.rsplit("/", 1)[0]
            config_url = f"{base_url}/admin/config/sync"

        # Mnemonic is stored on the provider doc (set during auto-link)
        mnemonic_enc = prov.get("dilithium_mnemonic_enc", "")
        if mnemonic_enc:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
        else:
            mnemonic = ""
        if not mnemonic:
            logger.warning(f"[config-push] Provider '{slug}' has no mnemonic — skipping (re-link to fix)")
            continue

        try:
            payload = _build_sync_payload(mnemonic, provider_slug=slug)

            # Extract Dilithium fields to headers
            sig_hex = payload.pop("dilithium_signature", None)
            pk_hex = payload.pop("dilithium_pk", None)
            algo = payload.pop("signature_algorithm", None)

            headers = {"Content-Type": "application/json"}
            if sig_hex and pk_hex:
                headers["X-Dilithium-Signature"] = sig_hex
                headers["X-Dilithium-PK"] = pk_hex
                headers["X-Dilithium-Algorithm"] = algo
                headers["X-Dilithium-Timestamp"] = str(payload.get("timestamp", ""))

            import json as _json
            payload_bytes = _json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")

            print(f"[config-push] Pushing to '{slug}' at {config_url}")

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(config_url, content=payload_bytes, headers=headers)

            if resp.status_code == 200:
                logger.info(f"[config-push] ✅ Config pushed to '{slug}' at {config_url}")
            else:
                print(f"[config-push] ⚠️ '{slug}' → {resp.status_code}: {resp.text[:500]}")

        except Exception as e:
            logger.warning(f"[config-push] ❌ Failed to push to '{slug}': {e}")


# =====================================================================
# GET sync-payload — for delivery worker to pull during catalog sync
# =====================================================================

@router.get("/delivery/config/sync-payload", summary="Get encrypted config for delivery sync")
async def get_sync_payload(request: Request, provider: dict = Depends(verify_satellite_webhook)):
    """
    Returns encrypted Transbank config + plain schedule/payments for delivery worker.
    Auth: verify_satellite_webhook (Dilithium)
    """
    provider_slug = provider.get("slug", "")
    # 'provider' dict already comes verified from verify_satellite_webhook

    mnemonic = ""
    if provider:
        mnemonic_enc = provider.get("dilithium_mnemonic_enc", "")
        if mnemonic_enc:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
        else:
            mnemonic = ""

    if not mnemonic:
        # Return config without encrypted transbank (no mnemonic = can't encrypt)
        config = _get_config()
        return {
            "success": True,
            "transbank_blob": None,
            "transbank_configured": False,
            "schedule": config.get("schedule", {}),
            "payment_methods": config.get("payment_methods", []),
            "internal_statuses": config.get("internal_statuses", []),
            "pickup_statuses": config.get("pickup_statuses", []),
            "scheduling_config": config.get("scheduling_config", DEFAULT_SCHEDULING_CONFIG),
        }

    payload = _build_sync_payload(mnemonic)
    return {"success": True, **payload}
