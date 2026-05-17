from fastapi import APIRouter, Depends, HTTPException, Path, File, UploadFile, Form
from pydantic import BaseModel, Field
try:
    # Pydantic v2
    from pydantic import RootModel
except ImportError:  # fallback if v1
    RootModel = None
from typing import Optional, List, Dict, Any, Tuple
import logging
import uuid
import json
from datetime import datetime
import os
from utils.time_utils import get_chile_time

from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger(__name__)

# Company scope (optional but useful to multi-tenant)
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# -----------------
# Pydantic Schemas
# -----------------
if RootModel is not None:
    class ProviderCredentials(RootModel[Dict[str, Any]]):  # type: ignore
        # Arbitrary credentials. Include "public_keys" to expose to FE
        # v2 RootModel stores value on .root
        def to_dict(self) -> Dict[str, Any]:
            return dict(self.root or {})
else:
    class ProviderCredentials(BaseModel):  # Pydantic v1 fallback
        __root__: Dict[str, Any]
        def to_dict(self) -> Dict[str, Any]:
            return dict(self.__root__)

class ProviderCreate(BaseModel):
    service: str = Field(..., description="e.g. firebase, google, meta, ditofeed, custom")
    name: Optional[str] = Field(None, description="Friendly name")
    is_active: bool = True
    assigned_providers: List[str] = Field(default_factory=list, description="IDs or Slugs of external providers (Carta, Delivery, etc.) this tracker is injected into")
    analytics_settings: Dict[str, Any] = Field(default_factory=dict, description="Settings for GA4 real-time reporting and backups")
    credentials: Dict[str, Any] = Field(default_factory=dict)

class ProviderUpdate(BaseModel):
    service: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None
    assigned_providers: Optional[List[str]] = None
    analytics_settings: Optional[Dict[str, Any]] = None
    credentials: Optional[Dict[str, Any]] = None

class ProviderResponse(BaseModel):
    id: str
    company_id: int
    service: str
    name: Optional[str]
    is_active: bool
    assigned_providers: List[str]
    analytics_settings: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str
    created_by: str

class PublicProviderConfig(BaseModel):
    id: str
    service: str
    name: Optional[str]
    is_active: bool
    assigned_providers: List[str]
    analytics_settings: Dict[str, Any] = Field(default_factory=dict)
    public_config: Dict[str, Any] = Field(default_factory=dict)

class ConversionTrackerConfigResponse(BaseModel):
    providers: List[PublicProviderConfig]

class AdminProviderResponse(BaseModel):
    id: str
    company_id: int
    service: str
    name: Optional[str]
    is_active: bool
    assigned_providers: List[str]
    analytics_settings: Dict[str, Any] = Field(default_factory=dict)
    credentials: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str
    created_by: str


def sanitize_provider(provider: Dict[str, Any]) -> Dict[str, Any]:
    # Remove Mongo internals and format dates
    out = {k: v for k, v in provider.items() if k != "_id"}
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    if isinstance(out.get("updated_at"), datetime):
        out["updated_at"] = out["updated_at"].isoformat()
    if "assigned_providers" not in out:
        out["assigned_providers"] = []
    if "analytics_settings" not in out:
        out["analytics_settings"] = {}
    return out


def rules_path_for(service: str) -> str:
    # Notice: Moved to backend/apis/conversion_tracker/trackers.py, so config is at backend/config/trackers
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config', 'trackers')
    return os.path.join(base, f"{service}.json")


def load_tracker_rules(service: str) -> Dict[str, Any]:
    """Load optional rules for a tracker service from backend/config/trackers/{service}.json."""
    try:
        path = rules_path_for(service)
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f) or {}
    except Exception:
        pass
    # Built-in defaults when no file exists
    builtin: Dict[str, Dict[str, Any]] = {
        "firebase": {
            "required": [
                "service_account.type",
                "service_account.private_key",
                "service_account.client_email",
                "projectId",
                "service_account.project_id",
                # Public Web SDK fields required by FE to initialize Firebase and FCM
                "apiKey",
                "authDomain",
                "storageBucket",
                "messagingSenderId",
                "appId",
                "vapidKey",
            ],
            "default_public_keys": [
                "apiKey", "authDomain", "projectId", "storageBucket",
                "messagingSenderId", "appId", "vapidKey"
            ],
            "file_keys": ["service_account"],
        },
        "analytics": {
            "required": ["measurementId"],
            "default_public_keys": ["measurementId"],
            "file_keys": ["service_account"],
        },
        "google_ads": {
            "required": [
                "developer_token", "client_id", "client_secret",
                "refresh_token", "login_customer_id"
            ],
            "file_keys": [],
        },
        "meta": {
            "required": ["access_token", "pixel_id"],
            "file_keys": [],
        },
        "dittofeed": {
            "required": ["server_url", "api_key"],
            "default_public_keys": ["server_url"],
            "file_keys": [],
        },
    }
    return builtin.get(service, {})


def get_nested(d: Dict[str, Any], dotted: str):
    cur = d
    for part in dotted.split('.'):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def apply_rules(service: str, credentials: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    rules = load_tracker_rules(service)
    errors: List[str] = []
    for key in rules.get('required', []) or []:
        if get_nested(credentials, key) in (None, ""):
            errors.append(f"Missing required credential: {key}")
    if 'public_keys' not in credentials and rules.get('default_public_keys'):
        credentials['public_keys'] = list(rules['default_public_keys'])
    return credentials, errors


def deep_merge(dst: Dict[str, Any], src: Dict[str, Any]) -> Dict[str, Any]:
    for k, v in (src or {}).items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst

def public_provider(provider: Dict[str, Any]) -> PublicProviderConfig:
    creds = provider.get("credentials", {}) or {}
    public_keys = set()
    pk = creds.get("public_keys")
    if isinstance(pk, list):
        public_keys = set([str(k) for k in pk])
    public_cfg = {k: v for k, v in creds.items() if k in public_keys}

    if provider.get("service") == "firebase":
        project_id = public_cfg.get("projectId") or creds.get("projectId")
        if not project_id:
            sa = creds.get("service_account") or {}
            project_id = sa.get("project_id")
        if project_id is not None:
            try:
                project_id = str(project_id)
            except Exception:
                pass
        if project_id:
            public_cfg["projectId"] = project_id

        required_keys = [
            "apiKey", "authDomain", "projectId", "storageBucket",
            "messagingSenderId", "appId", "vapidKey"
        ]
        alias_map = {
            "apiKey": ["apiKey", "api_key"],
            "authDomain": ["authDomain", "auth_domain"],
            "projectId": ["projectId", "project_id"],
            "storageBucket": ["storageBucket", "storage_bucket"],
            "messagingSenderId": ["messagingSenderId", "messaging_sender_id"],
            "appId": ["appId", "app_id"],
            "vapidKey": ["vapidKey", "vapid_key"],
        }
        for key in required_keys:
            if public_cfg.get(key) in (None, ""):
                for ak in alias_map.get(key, [key]):
                    if creds.get(ak) not in (None, ""):
                        public_cfg[key] = creds.get(ak)
                        break

        if not public_cfg.get("authDomain") and project_id:
            public_cfg["authDomain"] = f"{project_id}.firebaseapp.com"
        if not public_cfg.get("storageBucket") and project_id:
            public_cfg["storageBucket"] = f"{project_id}.appspot.com"
        if not public_cfg.get("messagingSenderId") and project_id and str(project_id).isdigit():
            public_cfg["messagingSenderId"] = str(project_id)
        for key in ("apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "vapidKey"):
            if key in public_cfg and public_cfg[key] is not None:
                try:
                    public_cfg[key] = str(public_cfg[key])
                except Exception:
                    pass
    return PublicProviderConfig(
        id=provider["id"],
        service=provider.get("service"),
        name=provider.get("name"),
        is_active=bool(provider.get("is_active", True)),
        assigned_providers=provider.get("assigned_providers", []),
        analytics_settings=provider.get("analytics_settings", {}),
        public_config=public_cfg,
    )


# -----------------------
# Events Catalog
# -----------------------

EVENTS_CATALOG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'config', 'trackers', 'events_catalog.json'
)

def load_events_catalog() -> Dict[str, Any]:
    """Load the standardized events catalog for the ecosystem."""
    try:
        with open(EVENTS_CATALOG_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load events catalog: {e}")
        return {"version": "1.0", "events": []}


@router.get("/conversion_tracker/events/catalog")
async def get_events_catalog(satellite: str = None):
    """
    Public endpoint — satellites query this to know which events to implement.
    Optional ?satellite=delivery to filter events that apply to that satellite.
    """
    catalog = load_events_catalog()
    if satellite:
        catalog["events"] = [
            e for e in catalog.get("events", [])
            if satellite in e.get("applies_to", [])
        ]
    return catalog


# -----------------------
# Satellite-safe sanitization
# -----------------------

# Keys that are safe to expose to satellite frontends (client-side pixels)
SAFE_CREDENTIAL_KEYS = {
    "pixel_id", "measurementId", "conversion_id", "conversion_label",
    "apiKey", "authDomain", "projectId", "storageBucket",
    "messagingSenderId", "appId", "vapidKey",
}

def sanitize_tracker_for_satellite(tracker: Dict[str, Any]) -> Dict[str, Any]:
    """
    Strip sensitive credentials from a tracker before syncing to satellites.
    Only public keys needed for client-side pixel injection are kept.
    Server-side secrets (access_token, service_account, private_key, etc.) are removed.
    """
    safe = {
        "id": tracker.get("id"),
        "service": tracker.get("service"),
        "name": tracker.get("name"),
        "is_active": tracker.get("is_active", False),
        "assigned_providers": tracker.get("assigned_providers", []),
        "analytics_settings": tracker.get("analytics_settings", {}),
    }

    # Build public_config from the existing public_provider logic
    creds = tracker.get("credentials") or {}
    public_keys_list = creds.get("public_keys", [])
    public_keys_set = set(public_keys_list) | SAFE_CREDENTIAL_KEYS

    safe["public_config"] = {
        k: v for k, v in creds.items()
        if k in public_keys_set and k != "public_keys"
    }

    # Also include GA4 measurement ID from analytics_settings for convenience
    ga4_id = safe["analytics_settings"].get("ga4_property_id")
    if ga4_id and "measurementId" not in safe["public_config"]:
        mid = creds.get("measurementId")
        if mid:
            safe["public_config"]["measurementId"] = mid

    return safe


# -----------------------
# Providers CRUD
# -----------------------
@router.post("/conversion_tracker/providers", response_model=ProviderResponse)
async def create_provider(data: ProviderCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")

    creds = data.credentials or {}
    creds, errors = apply_rules(data.service, creds)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    provider = {
        "id": str(uuid.uuid4()),
        "company_id": COMPANY_ID,
        "service": data.service,
        "name": data.name,
        "is_active": data.is_active,
        "assigned_providers": data.assigned_providers,
        "credentials": creds,
        "created_at": get_chile_time(),
        "updated_at": get_chile_time(),
        "created_by": user["wallet"],
    }
    db.conversion_tracker_providers.insert_one(provider)
    sanitized = sanitize_provider(provider)
    sanitized.pop("credentials", None)
    return ProviderResponse(**sanitized)  # type: ignore


@router.get("/conversion_tracker/providers", response_model=List[ProviderResponse])
async def list_providers(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    providers = list(db.conversion_tracker_providers.find({"company_id": COMPANY_ID}))
    out: List[ProviderResponse] = []
    for p in providers:
        p = sanitize_provider(p)
        p.pop("credentials", None)
        out.append(ProviderResponse(**p))  # type: ignore
    return out


@router.patch("/conversion_tracker/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(provider_id: str = Path(...), data: ProviderUpdate = None, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    existing = db.conversion_tracker_providers.find_one({"id": provider_id, "company_id": COMPANY_ID})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider not found")

    update_doc: Dict[str, Any] = {"updated_at": get_chile_time()}
    if data is not None:
        if data.service is not None:
            update_doc["service"] = data.service
        if data.name is not None:
            update_doc["name"] = data.name
        if data.is_active is not None:
            update_doc["is_active"] = data.is_active
        if data.assigned_providers is not None:
            update_doc["assigned_providers"] = data.assigned_providers
        if data.analytics_settings is not None:
            update_doc["analytics_settings"] = data.analytics_settings
        if data.credentials is not None:
            incoming = data.credentials or {}
            merged = dict(existing.get('credentials', {}) or {})
            deep_merge(merged, incoming)
            if 'service_account_path' in incoming and 'service_account' not in incoming and 'service_account' in merged:
                pass
            svc = data.service or existing.get('service')
            merged, errors = apply_rules(svc, merged)
            if errors:
                raise HTTPException(status_code=400, detail={"errors": errors})
            update_doc["credentials"] = merged
    db.conversion_tracker_providers.update_one({"id": provider_id}, {"$set": update_doc})

    refreshed = db.conversion_tracker_providers.find_one({"id": provider_id})
    refreshed = sanitize_provider(refreshed)
    refreshed.pop("credentials", None)
    return ProviderResponse(**refreshed)  # type: ignore

# -----------------------
# Admin Providers CRUD (includes credentials)
# -----------------------
@router.post("/admin/conversion_tracker/providers", response_model=AdminProviderResponse)
async def admin_create_provider(data: ProviderCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")

    creds = data.credentials or {}
    creds, errors = apply_rules(data.service, creds)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    provider = {
        "id": str(uuid.uuid4()),
        "company_id": COMPANY_ID,
        "service": data.service,
        "name": data.name,
        "is_active": data.is_active,
        "assigned_providers": data.assigned_providers,
        "analytics_settings": data.analytics_settings,
        "credentials": creds,
        "created_at": get_chile_time(),
        "updated_at": get_chile_time(),
        "created_by": user["wallet"],
    }
    db.conversion_tracker_providers.insert_one(provider)
    sanitized = sanitize_provider(provider)
    return AdminProviderResponse(**sanitized)  # type: ignore


@router.get("/admin/conversion_tracker/providers", response_model=List[AdminProviderResponse])
async def admin_list_providers(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    providers = list(db.conversion_tracker_providers.find({"company_id": COMPANY_ID}))
    out: List[AdminProviderResponse] = []
    for p in providers:
        p = sanitize_provider(p)
        out.append(AdminProviderResponse(**p))  # type: ignore
    return out


@router.patch("/admin/conversion_tracker/providers/{provider_id}", response_model=AdminProviderResponse)
async def admin_update_provider(provider_id: str = Path(...), data: ProviderUpdate = None, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    existing = db.conversion_tracker_providers.find_one({"id": provider_id, "company_id": COMPANY_ID})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider not found")

    update_doc: Dict[str, Any] = {"updated_at": get_chile_time()}
    if data is not None:
        if data.service is not None:
            update_doc["service"] = data.service
        if data.name is not None:
            update_doc["name"] = data.name
        if data.is_active is not None:
            update_doc["is_active"] = data.is_active
        if data.assigned_providers is not None:
            update_doc["assigned_providers"] = data.assigned_providers
        if data.analytics_settings is not None:
            update_doc["analytics_settings"] = data.analytics_settings
        if data.credentials is not None:
            incoming = data.credentials or {}
            merged = dict(existing.get('credentials', {}) or {})
            deep_merge(merged, incoming)
            if 'service_account_path' in incoming and 'service_account' not in incoming and 'service_account' in merged:
                pass
            svc = data.service or existing.get('service')
            merged, errors = apply_rules(svc, merged)
            if errors:
                raise HTTPException(status_code=400, detail={"errors": errors})
            update_doc["credentials"] = merged
    db.conversion_tracker_providers.update_one({"id": provider_id}, {"$set": update_doc})

    refreshed = db.conversion_tracker_providers.find_one({"id": provider_id})
    refreshed = sanitize_provider(refreshed)
    return AdminProviderResponse(**refreshed)  # type: ignore


# -----------------------
# Rules discovery for FE forms
# -----------------------
@router.get("/conversion_tracker/services", response_model=List[Dict[str, Any]])
async def list_services_for_forms(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    services = [
        "analytics",
        "google_ads",
        "meta",
        "dittofeed",
    ]
    out: List[Dict[str, Any]] = []
    for s in services:
        rules = load_tracker_rules(s)
        out.append({"service": s, **rules})
    return out


@router.get("/conversion_tracker/services/{service}/rules", response_model=Dict[str, Any])
async def get_service_rules(service: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    return load_tracker_rules(service)


# -----------------------
# Admin: upload JSON credentials into provider credentials
# -----------------------
@router.post("/admin/conversion_tracker/providers/{provider_id}/credentials-json", response_model=AdminProviderResponse)
async def admin_upload_credentials_json(
    provider_id: str = Path(...),
    key: str = Form("service_account"),
    file: UploadFile = File(...),
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "admin")
    existing = db.conversion_tracker_providers.find_one({"id": provider_id, "company_id": COMPANY_ID})
    if not existing:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        if not isinstance(data, dict):
            raise ValueError("Uploaded JSON must be an object")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    creds = existing.get('credentials', {}) or {}
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config', 'credentials')
    os.makedirs(base_dir, exist_ok=True)
    file_path = os.path.join(base_dir, f"{provider_id}_{key}.json")
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.exception("Failed to write credentials file")
        raise HTTPException(status_code=500, detail=f"Failed to persist credentials file: {e}")

    creds[key] = data
    creds[f"{key}_path"] = file_path

    svc = existing.get('service')
    creds, errors = apply_rules(svc, creds)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    db.conversion_tracker_providers.update_one({"id": provider_id}, {"$set": {"credentials": creds, "updated_at": get_chile_time()}})
    refreshed = db.conversion_tracker_providers.find_one({"id": provider_id})
    refreshed = sanitize_provider(refreshed)
    return AdminProviderResponse(**refreshed)  # type: ignore

# -----------------------
# Frontend config
# -----------------------
@router.get("/conversion_tracker/config", response_model=ConversionTrackerConfigResponse)
async def get_conversion_tracker_config(user: dict = Depends(verify_session)):
    providers = list(db.conversion_tracker_providers.find({
        "company_id": COMPANY_ID,
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }))

    public_providers: List[PublicProviderConfig] = []
    for p in providers:
        public_providers.append(public_provider(p))

    return ConversionTrackerConfigResponse(providers=public_providers)
