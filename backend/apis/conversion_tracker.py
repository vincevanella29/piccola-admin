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

from main import verify_session
from apis.roles import get_company_role_level
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
    credentials: ProviderCredentials

class ProviderUpdate(BaseModel):
    service: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None
    credentials: Optional[ProviderCredentials] = None

class ProviderResponse(BaseModel):
    id: str
    company_id: int
    service: str
    name: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str
    created_by: str

class PublicProviderConfig(BaseModel):
    id: str
    service: str
    name: Optional[str]
    is_active: bool
    public_config: Dict[str, Any] = Field(default_factory=dict)

class ConversionTrackerConfigResponse(BaseModel):
    providers: List[PublicProviderConfig]

# Admin-facing response including credentials
class AdminProviderResponse(BaseModel):
    id: str
    company_id: int
    service: str
    name: Optional[str]
    is_active: bool
    credentials: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str
    created_by: str

# ---------------
# Helpers
# ---------------
def check_role(wallet: Optional[str], required_levels: List[int]):
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet address in session")
    role_level = get_company_role_level(wallet)
    if role_level not in required_levels:
        raise HTTPException(status_code=403, detail="Insufficient role level")


def sanitize_provider(provider: Dict[str, Any]) -> Dict[str, Any]:
    # Remove Mongo internals and format dates
    out = {k: v for k, v in provider.items() if k != "_id"}
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    if isinstance(out.get("updated_at"), datetime):
        out["updated_at"] = out["updated_at"].isoformat()
    return out


def rules_path_for(service: str) -> str:
    base = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'trackers')
    return os.path.join(base, f"{service}.json")


def load_tracker_rules(service: str) -> Dict[str, Any]:
    """Load optional rules for a tracker service from backend/config/trackers/{service}.json.
    Expected structure example:
    {
      "required": ["service_account.type", "service_account.private_key", "projectId"],
      "default_public_keys": ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "vapidKey"]
    }
    """
    try:
        path = rules_path_for(service)
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f) or {}
    except Exception:
        # On rules load failure, work without rules
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
            "file_keys": [],
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
    """Apply validation and augmentation based on service rules.
    Returns (possibly modified credentials, list_of_errors).
    """
    rules = load_tracker_rules(service)
    errors: List[str] = []
    # Validate required keys
    for key in rules.get('required', []) or []:
        if get_nested(credentials, key) in (None, ""):
            errors.append(f"Missing required credential: {key}")
    # Set default public keys if not provided
    if 'public_keys' not in credentials and rules.get('default_public_keys'):
        credentials['public_keys'] = list(rules['default_public_keys'])
    return credentials, errors


def deep_merge(dst: Dict[str, Any], src: Dict[str, Any]) -> Dict[str, Any]:
    """Deep-merge src into dst and return dst. Dicts are merged, other values overwritten."""
    for k, v in (src or {}).items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst

def public_provider(provider: Dict[str, Any]) -> PublicProviderConfig:
    creds = provider.get("credentials", {}) or {}
    # If credentials specify which keys are public, expose those only
    public_keys = set()
    pk = creds.get("public_keys")
    if isinstance(pk, list):
        public_keys = set([str(k) for k in pk])
    public_cfg = {k: v for k, v in creds.items() if k in public_keys}

    # Normalize Firebase public config without leaking secrets
    if provider.get("service") == "firebase":
        # derive projectId if missing from service_account.project_id
        project_id = public_cfg.get("projectId") or creds.get("projectId")
        if not project_id:
            sa = creds.get("service_account") or {}
            project_id = sa.get("project_id")
        # cast to string
        if project_id is not None:
            try:
                project_id = str(project_id)
            except Exception:
                pass
        # apply derived values but only keep those allowed by public_keys
        if project_id:
            public_cfg["projectId"] = project_id

        # Ensure required web SDK keys are exposed even if public_keys was incomplete
        required_keys = [
            "apiKey", "authDomain", "projectId", "storageBucket",
            "messagingSenderId", "appId", "vapidKey"
        ]
        # Map common aliases from stored credentials
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

        # authDomain default if still missing
        if not public_cfg.get("authDomain") and project_id:
            public_cfg["authDomain"] = f"{project_id}.firebaseapp.com"
        # storageBucket default if still missing
        if not public_cfg.get("storageBucket") and project_id:
            public_cfg["storageBucket"] = f"{project_id}.appspot.com"
        # messagingSenderId fallback to numeric projectId if applicable
        if not public_cfg.get("messagingSenderId") and project_id and str(project_id).isdigit():
            public_cfg["messagingSenderId"] = str(project_id)
        # ensure values are strings where expected
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
        public_config=public_cfg,
    )


# No event persistence helpers (removed)

# -----------------------
# Providers CRUD
# -----------------------
@router.post("/conversion-tracker/providers", response_model=ProviderResponse)
async def create_provider(data: ProviderCreate, user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])

    creds = (
        data.credentials.to_dict() if isinstance(data.credentials, ProviderCredentials)
        else (data.credentials.model_dump() if hasattr(data.credentials, "model_dump") else dict(data.credentials or {}))
    )
    # Apply rules/validation for this service
    creds, errors = apply_rules(data.service, creds)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    provider = {
        "id": str(uuid.uuid4()),
        "company_id": COMPANY_ID,
        "service": data.service,
        "name": data.name,
        "is_active": data.is_active,
        "credentials": creds,
        "created_at": get_chile_time(),
        "updated_at": get_chile_time(),
        "created_by": user["wallet"],
    }
    db.conversion_tracker_providers.insert_one(provider)
    sanitized = sanitize_provider(provider)
    sanitized.pop("credentials", None)  # do not expose secrets in this endpoint
    return ProviderResponse(**sanitized)  # type: ignore


@router.get("/conversion-tracker/providers", response_model=List[ProviderResponse])
async def list_providers(user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])
    providers = list(db.conversion_tracker_providers.find({"company_id": COMPANY_ID}))
    out: List[ProviderResponse] = []
    for p in providers:
        p = sanitize_provider(p)
        p.pop("credentials", None)  # do not expose secrets
        out.append(ProviderResponse(**p))  # type: ignore
    return out


@router.patch("/conversion-tracker/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(provider_id: str = Path(...), data: ProviderUpdate = None, user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])
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
        if data.credentials is not None:
            incoming = (
                data.credentials.to_dict() if isinstance(data.credentials, ProviderCredentials)
                else (data.credentials.model_dump() if hasattr(data.credentials, "model_dump") else dict(data.credentials))
            )
            # Merge with existing credentials to preserve service_account and others when not provided
            merged = dict(existing.get('credentials', {}) or {})
            deep_merge(merged, incoming)
            # If caller only sends a path hint and not the actual JSON, keep existing service_account content
            if 'service_account_path' in incoming and 'service_account' not in incoming and 'service_account' in merged:
                pass  # nothing to change for service_account
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
@router.post("/admin/conversion-tracker/providers", response_model=AdminProviderResponse)
async def admin_create_provider(data: ProviderCreate, user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])

    creds = (
        data.credentials.to_dict() if isinstance(data.credentials, ProviderCredentials)
        else (data.credentials.model_dump() if hasattr(data.credentials, "model_dump") else dict(data.credentials or {}))
    )
    creds, errors = apply_rules(data.service, creds)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    provider = {
        "id": str(uuid.uuid4()),
        "company_id": COMPANY_ID,
        "service": data.service,
        "name": data.name,
        "is_active": data.is_active,
        "credentials": creds,
        "created_at": get_chile_time(),
        "updated_at": get_chile_time(),
        "created_by": user["wallet"],
    }
    db.conversion_tracker_providers.insert_one(provider)
    sanitized = sanitize_provider(provider)
    return AdminProviderResponse(**sanitized)  # type: ignore


@router.get("/admin/conversion-tracker/providers", response_model=List[AdminProviderResponse])
async def admin_list_providers(user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])
    providers = list(db.conversion_tracker_providers.find({"company_id": COMPANY_ID}))
    out: List[AdminProviderResponse] = []
    for p in providers:
        p = sanitize_provider(p)
        out.append(AdminProviderResponse(**p))  # type: ignore
    return out


@router.patch("/admin/conversion-tracker/providers/{provider_id}", response_model=AdminProviderResponse)
async def admin_update_provider(provider_id: str = Path(...), data: ProviderUpdate = None, user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])
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
        if data.credentials is not None:
            incoming = (
                data.credentials.to_dict() if isinstance(data.credentials, ProviderCredentials)
                else (data.credentials.model_dump() if hasattr(data.credentials, "model_dump") else dict(data.credentials))
            )
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
@router.get("/conversion-tracker/services", response_model=List[Dict[str, Any]])
async def list_services_for_forms(user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])
    services = [
        "firebase",
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


@router.get("/conversion-tracker/services/{service}/rules", response_model=Dict[str, Any])
async def get_service_rules(service: str, user: dict = Depends(verify_session)):
    check_role(user.get("wallet"), [3, 4])
    return load_tracker_rules(service)


# -----------------------
# Admin: upload JSON credentials into provider credentials
# -----------------------
@router.post("/admin/conversion-tracker/providers/{provider_id}/credentials-json", response_model=AdminProviderResponse)
async def admin_upload_credentials_json(
    provider_id: str = Path(...),
    key: str = Form("service_account"),
    file: UploadFile = File(...),
    user: dict = Depends(verify_session),
):
    """Upload a JSON file and store its contents at credentials[key].
    Default key is 'service_account' (for Firebase admin JSON).
    Applies tracker rules after merge.
    """
    check_role(user.get("wallet"), [3, 4])
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
    # Persist file to disk for reference and future edits
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'credentials')
    os.makedirs(base_dir, exist_ok=True)
    file_path = os.path.join(base_dir, f"{provider_id}_{key}.json")
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.exception("Failed to write credentials file")
        raise HTTPException(status_code=500, detail=f"Failed to persist credentials file: {e}")

    # Store under given key and keep a path hint
    creds[key] = data
    creds[f"{key}_path"] = file_path

    # Apply rules and save
    svc = existing.get('service')
    creds, errors = apply_rules(svc, creds)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    db.conversion_tracker_providers.update_one({"id": provider_id}, {"$set": {"credentials": creds, "updated_at": get_chile_time()}})
    refreshed = db.conversion_tracker_providers.find_one({"id": provider_id})
    refreshed = sanitize_provider(refreshed)
    return AdminProviderResponse(**refreshed)  # type: ignore

"""
Events persistence was intentionally removed. If dispatching to providers is needed,
we can add a stateless endpoint later (e.g., POST /conversion-tracker/dispatch) that
validates input and forwards to active providers without storing anything.
"""

# -----------------------
# Frontend config
# -----------------------
@router.get("/conversion-tracker/config", response_model=ConversionTrackerConfigResponse)
async def get_conversion_tracker_config(user: dict = Depends(verify_session)):
    # FE only needs to know which providers are active and public config for SDKs
    providers = list(db.conversion_tracker_providers.find({
        "company_id": COMPANY_ID,
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }))

    public_providers: List[PublicProviderConfig] = []
    for p in providers:
        public_providers.append(public_provider(p))

    return ConversionTrackerConfigResponse(providers=public_providers)
