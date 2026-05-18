from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging
import uuid
import json
from datetime import datetime, timedelta
from utils.time_utils import get_chile_time, to_chile_time
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db, w3
from eth_account.messages import encode_defunct
from firebase_admin import credentials, initialize_app, messaging
import firebase_admin
import os

# Drop any unique index on user_notification_tokens that might prevent multiple devices
try:
    from pymongo.errors import OperationFailure
    indexes = db.user_notification_tokens.index_information()
    for name, info in indexes.items():
        if info.get("unique"):
            keys = dict(info.get("key", []))
            if "wallet" in keys or "privy_id" in keys:
                db.user_notification_tokens.drop_index(name)
                logger.info(f"[notifications] Dropped unique index {name} to allow multiple devices per user")
except Exception as e:
    logger.debug(f"[notifications] Could not check/drop indexes on user_notification_tokens: {e}")

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Lazy Firebase Init (from MongoDB or fallback to file) ─────────────────
def _ensure_firebase():
    """Initialize Firebase Admin SDK lazily from MongoDB config or fallback JSON file."""
    config = db.notification_api_configs.find_one({"service": "firebase", "service_account_json": {"$exists": True, "$ne": None}})
    expected_project_id = None
    sa_data = None
    
    if config and config.get("service_account_json"):
        sa_data = config["service_account_json"]
        if isinstance(sa_data, str):
            sa_data = json.loads(sa_data)
        expected_project_id = sa_data.get("project_id", config.get("project_id", ""))

    if firebase_admin._apps:
        app = firebase_admin.get_app()
        current_project_id = app.project_id
        if expected_project_id and current_project_id != expected_project_id:
            logger.warning(f"[firebase] Project ID changed ({current_project_id} -> {expected_project_id}). Reinitializing...")
            firebase_admin.delete_app(app)
        else:
            return True
            
    # Try from MongoDB (service_account_json stored via API)
    if expected_project_id and sa_data:
        try:
            cred = credentials.Certificate(sa_data)
            initialize_app(cred, {"storageBucket": f"{expected_project_id}.firebasestorage.app"})
            logger.info(f"[firebase] Initialized from MongoDB config (project: {expected_project_id})")
            return True
        except Exception as e:
            logger.error(f"[firebase] Error initializing from MongoDB: {e}")

    logger.warning("[firebase] No Firebase credentials found in MongoDB. Upload via Admin Panel settings.")
    return False

# Modelos Pydantic
class NotificationTypeCreate(BaseModel):
    event_name: str
    title_template: str
    body_template: str
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    target_type: str  # "user", "topic", "all"
    target_value: str
    api_config_id: str
    trigger_event: Optional[str] = None

class NotificationTypeResponse(BaseModel):
    id: str
    event_name: str
    title_template: str
    body_template: str
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    target_type: str
    target_value: str
    api_config_id: str
    trigger_event: Optional[str] = None
    created_at: str
    updated_at: str
    created_by: str

class NotificationApiConfigCreate(BaseModel):
    service: str
    api_key: str
    project_id: str
    vapid_key: Optional[str] = None
    web_config: Optional[Dict] = None
    prompt_config: Optional[Dict] = None

class NotificationApiConfigResponse(BaseModel):
    id: str
    service: str
    project_id: str
    vapid_key: Optional[str] = None
    web_config: Optional[Dict] = None
    prompt_config: Optional[Dict] = None
    has_service_account: bool = False
    firebase_initialized: bool = False
    created_at: str
    updated_at: str
    created_by: str

class NotificationTokenCreate(BaseModel):
    token: str
    device_type: str = "web"
    permissions_granted: bool = False

class SignatureRequest(BaseModel):
    message: str
    signature: str

class SendNotificationRequest(BaseModel):
    notification_type_id: str
    data: Dict  # Datos para reemplazar en plantillas
    schedule_time: Optional[str] = None  # ISODate para programar
    target_token: Optional[str] = None # Override target with specific token

# Reemplazar variables en plantillas
import re

def render_template(template: str, data: Dict) -> str:
    if not template:
        return ""
    result = template
    for key, value in data.items():
        result = result.replace(f"{{{key}}}", str(value)).replace(f"#{key}", str(value)).replace(f"[{key}]", str(value))
    
    # Remove leftover placeholders
    result = re.sub(r'\{[\w_]+\}', '', result)
    result = re.sub(r'\[[\w_]+\]', '', result)
    result = re.sub(r'#\{?[\w_]+\}?', '', result)
    
    # Clean up extra spaces
    result = re.sub(r'\s+', ' ', result).strip()
    return result

# Enviar notificación con FCM
async def send_fcm_notification(api_config: Dict, title: str, body: str, icon_url: Optional[str] = None, image_url: Optional[str] = None, link_url: Optional[str] = None, target_type: str = "user", target_value: str = "", campaign_id: str = None):
    if not _ensure_firebase():
        raise HTTPException(status_code=500, detail="Firebase no configurado. Sube el Service Account JSON en Settings.")
    
    app = firebase_admin.get_app()
    print("\n========== FIREBASE DIAGNOSTICS ==========", flush=True)
    print(f"1. Backend Active Project ID: {app.project_id}", flush=True)
    print(f"2. DB api_config Project ID: {api_config.get('project_id')}", flush=True)
    print(f"3. Target FCM Token: {target_value[:15]}...{target_value[-10:] if len(target_value) > 25 else ''}", flush=True)
    print("==========================================\n", flush=True)

    try:
        # Añadir data payload para tracking de clicks y ruteo en Service Worker
        msg_data = {}
        if campaign_id:
            msg_data["campaign_id"] = campaign_id
        if link_url:
            msg_data["url"] = link_url
        if icon_url:
            msg_data["icon_url"] = icon_url

        # Configuración webpush para navegadores
        webpush_config = messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                icon=icon_url or "/favicon-piccola.png",
                image=image_url
            )
        )

        # Configuración android nativa
        android_config = messaging.AndroidConfig(
            notification=messaging.AndroidNotification(
                icon="ic_notification", # Usará el recurso nativo si existe, sino fallback al default
                color="#00ff00", # Vanellix / Matrix Green
                image=image_url
            )
        )

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url
            ),
            data=msg_data,
            webpush=webpush_config,
            android=android_config,
            topic=target_value if target_type == "topic" else None,
            token=target_value if target_type == "user" else None
        )
        response = messaging.send(message)
        logger.info(f"\n[FCM BACKEND LOG] 🚀 Mensaje enviado con éxito a Firebase!")
        logger.info(f"[FCM BACKEND LOG] 📦 Message ID retornado: {response}")
        return response
    except Exception as e:
        logger.error(f"Error enviando notificación FCM: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error enviando notificación: {str(e)}")

class TrackClickRequest(BaseModel):
    campaign_id: str

@router.post("/notifications/track-click")
async def track_notification_click(data: TrackClickRequest):
    """Endpoint llamado por el Service Worker cuando el usuario abre la notificación"""
    try:
        result = db.notification_logs.update_one(
            {"id": data.campaign_id},
            {"$inc": {"opened_count": 1}}
        )
        return {"success": True, "updated": result.modified_count > 0}
    except Exception as e:
        logger.error(f"Error tracking click for campaign {data.campaign_id}: {str(e)}")
        return {"success": False, "error": str(e)}


# CRUD Tipos de Notificaciones
@router.post("/notifications/types", response_model=NotificationTypeResponse)
async def create_notification_type(data: NotificationTypeCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    api_config = db.notification_api_configs.find_one({"id": data.api_config_id})
    if not api_config:
        raise HTTPException(status_code=400, detail="Invalid api_config_id")
    
    notification_type = {
        "id": str(uuid.uuid4()),
        "event_name": data.event_name,
        "title_template": data.title_template,
        "body_template": data.body_template,
        "icon_url": data.icon_url,
        "image_url": data.image_url,
        "link_url": data.link_url,
        "target_type": data.target_type,
        "target_value": data.target_value,
        "api_config_id": data.api_config_id,
        "trigger_event": data.trigger_event,
        "created_at": get_chile_time(),
        "updated_at": get_chile_time(),
        "created_by": user["wallet"]
    }
    db.notification_types.insert_one(notification_type)
    notification_type["created_at"] = notification_type["created_at"].isoformat()
    notification_type["updated_at"] = notification_type["updated_at"].isoformat()
    return notification_type

@router.get("/notifications/types", response_model=List[NotificationTypeResponse])
async def get_notification_types(user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    types = list(db.notification_types.find({}))
    for t in types:
        t["id"] = t.get("id") or str(t.get("_id", ""))
        
        if "created_at" in t and hasattr(t["created_at"], "isoformat"):
            t["created_at"] = t["created_at"].isoformat()
        else:
            t["created_at"] = str(t.get("created_at", ""))
            
        if "updated_at" in t and hasattr(t["updated_at"], "isoformat"):
            t["updated_at"] = t["updated_at"].isoformat()
        else:
            t["updated_at"] = str(t.get("updated_at", ""))
            
        t.pop("_id", None)
    return types

@router.put("/notifications/types/{type_id}", response_model=NotificationTypeResponse)
async def update_notification_type(type_id: str, data: NotificationTypeCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    existing = db.notification_types.find_one({"id": type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Notification type not found")
    update_data = {
        "event_name": data.event_name,
        "title_template": data.title_template,
        "body_template": data.body_template,
        "icon_url": data.icon_url,
        "image_url": data.image_url,
        "link_url": data.link_url,
        "target_type": data.target_type,
        "target_value": data.target_value,
        "api_config_id": data.api_config_id,
        "trigger_event": data.trigger_event,
        "updated_at": get_chile_time()
    }
    db.notification_types.update_one({"id": type_id}, {"$set": update_data})
    updated = db.notification_types.find_one({"id": type_id})
    updated["created_at"] = updated["created_at"].isoformat()
    updated["updated_at"] = updated["updated_at"].isoformat()
    updated.pop("_id", None)
    return updated

@router.delete("/notifications/types/{type_id}")
async def delete_notification_type(type_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    result = db.notification_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification type not found")
    return {"success": True, "message": "Notification type deleted"}

# CRUD Configuraciones de API
@router.post("/notifications/api-configs", response_model=NotificationApiConfigResponse)
async def create_api_config(data: NotificationApiConfigCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    # Upsert: if a config for this service exists, update it
    existing = db.notification_api_configs.find_one({"service": data.service})
    
    config_data = {
        "service": data.service,
        "api_key": data.api_key,
        "project_id": data.project_id,
        "vapid_key": data.vapid_key,
        "web_config": data.web_config,
        "prompt_config": data.prompt_config,
        "updated_at": get_chile_time(),
        "created_by": user["wallet"]
    }
    
    if existing:
        db.notification_api_configs.update_one({"_id": existing["_id"]}, {"$set": config_data})
        api_config = {**existing, **config_data}
    else:
        api_config = {"id": str(uuid.uuid4()), **config_data, "created_at": get_chile_time()}
        db.notification_api_configs.insert_one(api_config)
    
    api_config["created_at"] = api_config.get("created_at", get_chile_time())
    if hasattr(api_config["created_at"], 'isoformat'):
        api_config["created_at"] = api_config["created_at"].isoformat()
    api_config["updated_at"] = api_config["updated_at"].isoformat()
    api_config.pop("_id", None)
    api_config["has_service_account"] = "service_account_json" in api_config and api_config["service_account_json"] is not None
    api_config.pop("service_account_json", None)
    return api_config

# Upload Firebase Service Account JSON (stored in MongoDB, not filesystem)
@router.post("/notifications/upload-service-account")
async def upload_service_account(file: UploadFile = File(...), user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    try:
        content = await file.read()
        sa_json = json.loads(content)
        
        # Validate it has required fields
        required = ["type", "project_id", "private_key", "client_email"]
        missing = [k for k in required if k not in sa_json]
        if missing:
            raise HTTPException(status_code=400, detail=f"JSON inválido. Faltan campos: {', '.join(missing)}")
        
        project_id = sa_json.get("project_id", "")
        
        # Store in the existing api config or create one
        existing = db.notification_api_configs.find_one({"service": "firebase"})
        update_data = {
            "service_account_json": sa_json,
            "project_id": project_id,
            "updated_at": get_chile_time(),
            "created_by": user["wallet"],
        }
        
        if existing:
            db.notification_api_configs.update_one({"_id": existing["_id"]}, {"$set": update_data})
        else:
            db.notification_api_configs.insert_one({
                "id": str(uuid.uuid4()),
                "service": "firebase",
                **update_data,
                "created_at": get_chile_time(),
            })
        
        # Reset Firebase app so it re-initializes with new creds
        if firebase_admin._apps:
            import asyncio
            try:
                # Run in a thread because delete_app might invoke asyncio.run() internally for cleanup
                await asyncio.to_thread(firebase_admin.delete_app, firebase_admin.get_app())
            except Exception as e:
                logger.warning(f"Failed to delete Firebase app: {e}")
        
        logger.info(f"[firebase] Service account uploaded for project: {project_id}")
        return {"success": True, "project_id": project_id, "message": f"Service Account para {project_id} guardado en MongoDB"}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="El archivo no es un JSON válido")
    except Exception as e:
        logger.error(f"Error uploading service account: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notifications/api-configs", response_model=List[NotificationApiConfigResponse])
async def get_api_configs(user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    configs = list(db.notification_api_configs.find({}))
    for c in configs:
        c["id"] = c.get("id") or str(c.get("_id", ""))
        c["has_service_account"] = "service_account_json" in c and c["service_account_json"] is not None
        
        # Verificar estado real de Firebase
        _ensure_firebase()
        try:
            app = firebase_admin.get_app()
            c["firebase_initialized"] = (app.project_id == c.get("project_id"))
        except ValueError:
            c["firebase_initialized"] = False
            
        if "created_at" in c and hasattr(c["created_at"], "isoformat"):
            c["created_at"] = c["created_at"].isoformat()
        else:
            c["created_at"] = str(c.get("created_at", ""))
            
        if "updated_at" in c and hasattr(c["updated_at"], "isoformat"):
            c["updated_at"] = c["updated_at"].isoformat()
        else:
            c["updated_at"] = str(c.get("updated_at", ""))
            
        c.pop("_id", None)
        c.pop("api_key", None)  # No exponer la clave
        c.pop("service_account_json", None)
    return configs

# Endpoint público para que el frontend obtenga la configuración (sin auth)
@router.get("/notifications/public-config")
async def get_public_config():
    config = db.notification_api_configs.find_one({"service": "firebase"})
    if not config:
        return {}
    return {
        "firebaseConfig": config.get("web_config"),
        "vapidKey": config.get("vapid_key")
    }

# Guardar Token de Notificación
@router.post("/notifications/tokens")
async def save_notification_token(data: NotificationTokenCreate, user: dict = Depends(verify_session)):
    privy_id = user.get("sub")
    token_data = {
        "privy_id": privy_id,
        "wallet": user.get("wallet"),
        "token": data.token,
        "device_type": data.device_type,
        "permissions_granted": data.permissions_granted,
        "updated_at": get_chile_time()
    }
    
    # El token de FCM es la llave primaria de dispositivo, puede sobreescribir al usuario anterior si cambió de cuenta
    db.user_notification_tokens.update_one(
        {"token": data.token},
        {"$set": token_data, "$setOnInsert": {"created_at": get_chile_time()}},
        upsert=True
    )
    return {"success": True, "message": "Token guardado"}

def _log_campaign(campaign_id: str, title: str, body: str, target_type: str, target_value: str, success_count: int, error_count: int, errors: list, sender_wallet: str):
    db.notification_logs.insert_one({
        "id": campaign_id,
        "title": title,
        "body": body,
        "target_type": target_type,
        "target_value": target_value,
        "success_count": success_count,
        "error_count": error_count,
        "opened_count": 0,
        "errors": errors,
        "created_at": get_chile_time(),
        "created_by": sender_wallet
    })

# Enviar Notificación
@router.get("/notifications/audience")
async def get_audience(user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    tokens = list(db.user_notification_tokens.find({"permissions_granted": True}))
    
    wallets = [t.get("wallet") for t in tokens if t.get("wallet")]
    privy_ids = [t.get("privy_id") for t in tokens if t.get("privy_id")]
    emails = [t.get("email") for t in tokens if t.get("email")]
    fcm_tokens = [t.get("token") for t in tokens if t.get("token")]
    
    users_cursor = db.users.find({
        "$or": [
            {"wallet": {"$in": wallets}},
            {"privy_id": {"$in": privy_ids}}
        ]
    }) if wallets or privy_ids else []
    
    users_map = {}
    for u in users_cursor:
        if u.get("wallet"): users_map[u["wallet"]] = u
        if u.get("privy_id"): users_map[u["privy_id"]] = u
    
    customers_cursor = db.customers.find({
        "$or": [
            {"fcm_token": {"$in": fcm_tokens}},
            {"wallet": {"$in": wallets}},
            {"privy_id": {"$in": privy_ids}},
            {"email": {"$in": emails}}
        ]
    }) if fcm_tokens or wallets or privy_ids or emails else []
    
    customers_map_by_token = {}
    customers_map_by_wallet = {}
    customers_map_by_privy = {}
    customers_map_by_email = {}
    for c in customers_cursor:
        if c.get("fcm_token"): customers_map_by_token[c["fcm_token"]] = c
        if c.get("wallet"): customers_map_by_wallet[c["wallet"]] = c
        if c.get("privy_id"): customers_map_by_privy[c["privy_id"]] = c
        if c.get("email"): customers_map_by_email[c["email"]] = c
        
    audience = []
    for t in tokens:
        wallet = t.get("wallet")
        privy_id = t.get("privy_id")
        email = t.get("email")
        fcm = t.get("token")
        
        member = {
            "token": fcm,
            "wallet": wallet,
            "privy_id": privy_id,
            "device_type": t.get("device_type", "unknown"),
            "source": t.get("source", "unknown"),
            "segment": "anonymous",
            "name": None,
            "email": email,
            "phone": None,
            "created_at": str(t.get("created_at", "")),
            "updated_at": str(t.get("updated_at", ""))
        }
        
        u = None
        if privy_id and privy_id in users_map: u = users_map[privy_id]
        elif wallet and wallet in users_map: u = users_map[wallet]
        
        c = None
        if fcm and fcm in customers_map_by_token: c = customers_map_by_token[fcm]
        elif privy_id and privy_id in customers_map_by_privy: c = customers_map_by_privy[privy_id]
        elif wallet and wallet in customers_map_by_wallet: c = customers_map_by_wallet[wallet]
        elif email and email in customers_map_by_email: c = customers_map_by_email[email]
        
        if u and u.get("status") == "active" and u.get("is_employee"):
            member["segment"] = "employee"
            member["name"] = u.get("name") or "Empleado"
            member["role"] = u.get("role", "staff")
        elif u:
            member["segment"] = "web3_user"
            member["name"] = u.get("name") or "Web3 User"
            
        if c:
            if member["segment"] in ["anonymous", "web3_user"]:
                member["segment"] = f"customer_{c.get('provider_slug', 'delivery')}"
                if c.get("name"): member["name"] = c.get("name")
            if c.get("email"): member["email"] = c.get("email")
            if c.get("phone"): member["phone"] = c.get("phone")
            member["order_count"] = c.get("order_count", 0)
            member["total_spent"] = c.get("total_spent", 0.0)
            
        audience.append(member)
        
    return audience

@router.post("/notifications/audience/{token}/delete")
async def delete_audience_member(token: str, req: SignatureRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    if user.get("level", 0) < 3:
        raise HTTPException(status_code=403, detail="Required level 3 or higher")
        
    try:
        message_encoded = encode_defunct(text=req.message)
        recovered_address = w3.eth.account.recover_message(message_encoded, signature=req.signature)
        if recovered_address.lower() != user.get("wallet", "").lower():
            raise HTTPException(status_code=401, detail="Firma inválida o no coincide con la wallet conectada")
    except Exception as e:
        logger.error(f"Error verifying signature: {e}")
        raise HTTPException(status_code=401, detail="Error validando la firma criptográfica")

    result = db.user_notification_tokens.delete_many({"token": token})
    # Also clean up customer references if any
    db.customers.update_many({"fcm_token": token}, {"$set": {"fcm_token": None}})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
        
    return {"success": True, "message": "Audience member deleted"}

@router.post("/notifications/audience/delete-all")
async def delete_all_audience(req: SignatureRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    if user.get("level", 0) < 3:
        raise HTTPException(status_code=403, detail="Required level 3 or higher")
        
    try:
        message_encoded = encode_defunct(text=req.message)
        recovered_address = w3.eth.account.recover_message(message_encoded, signature=req.signature)
        if recovered_address.lower() != user.get("wallet", "").lower():
            raise HTTPException(status_code=401, detail="Firma inválida o no coincide con la wallet conectada")
    except Exception as e:
        logger.error(f"Error verifying signature: {e}")
        raise HTTPException(status_code=401, detail="Error validando la firma criptográfica")

    result = db.user_notification_tokens.delete_many({})
    # Clean up customer references
    db.customers.update_many({}, {"$set": {"fcm_token": None}})
    
    return {"success": True, "message": f"Todos los tokens ({result.deleted_count}) eliminados correctamente"}

# Preferencias de Notificaciones
@router.get("/notifications/preferences")
async def get_notification_preferences(user: dict = Depends(verify_session)):
    from services.automation_engine import _resolve_user_profile
    # The session user dict contains 'wallet', 'sub', 'email', 'rut', etc.
    profile = _resolve_user_profile(user)
    prefs = profile.get("notification_preferences", {})
    return {"success": True, "preferences": prefs}

@router.post("/notifications/preferences")
async def update_notification_preferences(data: Dict[str, bool], user: dict = Depends(verify_session)):
    from services.automation_engine import _resolve_user_profile
    profile = _resolve_user_profile(user)
    if not profile or "_id" not in profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
        
    target_id = profile["_id"]
    
    # Update the preference object in whichever collection this profile belongs to
    for coll in [db.delivery_customers, db.user_profiles, db.empleados_usuarios]:
        if coll.find_one({"_id": target_id}):
            coll.update_one({"_id": target_id}, {"$set": {"notification_preferences": data}})
            break
            
    return {"success": True, "preferences": data}

@router.post("/notifications/send")
async def send_notification(data: SendNotificationRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    notification_type = db.notification_types.find_one({"id": data.notification_type_id})
    if not notification_type:
        raise HTTPException(status_code=400, detail="Invalid notification_type_id")
    
    api_config = db.notification_api_configs.find_one({"id": notification_type["api_config_id"]})
    if not api_config:
        raise HTTPException(status_code=400, detail="Invalid api_config_id")

    if data.schedule_time:
        # Programar notificación
        schedule = {
            "notification_type_id": data.notification_type_id,
            "schedule_time": datetime.fromisoformat(data.schedule_time),
            "data": data.data,
            "status": "pending",
            "target_token": data.target_token,
            "created_at": get_chile_time(),
            "updated_at": get_chile_time()
        }
        db.notification_schedules.insert_one(schedule)
        return {"success": True, "message": "Notificación programada"}
    
    # Enviar ahora
    title = render_template(notification_type["title_template"], data.data)
    body = render_template(notification_type["body_template"], data.data)
    icon_url = data.data.get("icon_url", notification_type.get("icon_url"))
    image_url = data.data.get("image_url", notification_type.get("image_url"))
    link_url = data.data.get("link_url", notification_type.get("link_url"))
    target_type = notification_type["target_type"]
    target_value = notification_type["target_value"]
    
    if data.target_token:
        target_type = "user"
        target_value = data.target_token

    campaign_id = str(uuid.uuid4())

    logger.info(f"[notifications] Sending: target_type={target_type}, target_value={target_value}, campaign_id={campaign_id}")

    if target_type == "all":
        # Send to all users with tokens
        all_tokens = list(db.user_notification_tokens.find({"permissions_granted": True}))
        logger.info(f"[notifications] Broadcasting to {len(all_tokens)} devices")
        results = []
        success_count = 0
        error_count = 0
        error_msgs = []
        for t in all_tokens:
            try:
                r = await send_fcm_notification(api_config, title, body, icon_url, image_url, link_url, "user", t["token"], campaign_id)
                results.append({"wallet": t["wallet"], "status": "sent", "response": r})
                success_count += 1
            except Exception as e:
                results.append({"wallet": t["wallet"], "status": "error", "error": str(e)})
                error_count += 1
                error_msgs.append(str(e))
        _log_campaign(campaign_id, title, body, target_type, "all", success_count, error_count, error_msgs, user.get("wallet", "system"))
        return {"success": True, "message": f"Enviado a {len(results)} dispositivos", "results": results}

    elif target_type == "user":
        # Look up FCM token by wallet and privy_id, newest first
        target_user = db.users.find_one({"wallet": {"$regex": f"^{target_value}$", "$options": "i"}})
        query_conditions = [{"wallet": {"$regex": f"^{target_value}$", "$options": "i"}}]
        if target_user and target_user.get("privy_id"):
            query_conditions.append({"privy_id": target_user.get("privy_id")})
            
        tokens = list(db.user_notification_tokens.find({"$or": query_conditions, "permissions_granted": True}).sort("_id", -1))
        
        if not tokens:
            # Try to find ANY token as fallback for testing
            all_tokens = list(db.user_notification_tokens.find({"permissions_granted": True}).sort("_id", -1))
            if not all_tokens:
                raise HTTPException(status_code=400, detail=f"Usuario sin token válido. No hay dispositivos registrados en general.")
            tokens = [all_tokens[0]]
            logger.info(f"[notifications] Fallback: using newest token from wallet {tokens[0]['wallet']}")
        
        last_error = None
        success_count = 0
        error_count = 0
        error_msgs = []
        
        for t_doc in tokens:
            fcm_token = t_doc["token"]
            try:
                response = await send_fcm_notification(api_config, title, body, icon_url, image_url, link_url, "user", fcm_token, campaign_id)
                success_count += 1
            except Exception as e:
                err_str = str(e).lower()
                last_error = e
                error_count += 1
                error_msgs.append(str(e))
                # Delete invalid tokens (SenderId mismatch usually means old project, NotRegistered means user uninstalled/cleared browser data)
                if "senderid mismatch" in err_str or "notregistered" in err_str or "unregistered" in err_str or "invalid registration" in err_str:
                    logger.warning(f"[notifications] Invalid token detected ({err_str}). Deleting from DB.")
                    db.user_notification_tokens.delete_one({"_id": t_doc["_id"]})
                    
        _log_campaign(campaign_id, title, body, target_type, target_value, success_count, error_count, error_msgs, user.get("wallet", "system"))
        
        if success_count > 0:
            return {"success": True, "message": f"Notificación enviada a {success_count} dispositivos"}
        else:
            raise HTTPException(status_code=500, detail=f"Error enviando notificación a dispositivos: {str(last_error)}")

    elif target_type == "topic":
        try:
            response = await send_fcm_notification(api_config, title, body, icon_url, image_url, link_url, "topic", target_value, campaign_id)
            _log_campaign(campaign_id, title, body, target_type, target_value, 1, 0, [], user.get("wallet", "system"))
            return {"success": True, "message": "Notificación enviada al topic", "response": response}
        except Exception as e:
            _log_campaign(campaign_id, title, body, target_type, target_value, 0, 1, [str(e)], user.get("wallet", "system"))
            raise HTTPException(status_code=500, detail=str(e))

    else:
        raise HTTPException(status_code=400, detail=f"target_type '{target_type}' no soportado")

# Listar usuarios con tokens de notificación
@router.get("/notifications/users-with-tokens", response_model=List[Dict])
async def get_users_with_tokens(user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    users = list(db.user_notification_tokens.find({"permissions_granted": True}, {"_id": 0, "wallet": 1, "device_type": 1}))
    return users

# Analíticas de Notificaciones
@router.get("/notifications/analytics")
async def get_notification_analytics(user: dict = Depends(verify_session)):
    require_admin_level(user, "marketing")
    
    thirty_days_ago = get_chile_time() - timedelta(days=30)
    
    # KPIs globales (todos los tiempos)
    pipeline_kpis = [
        {"$group": {
            "_id": None,
            "total_campaigns": {"$sum": 1},
            "total_success": {"$sum": "$success_count"},
            "total_errors": {"$sum": "$error_count"},
            "total_opened": {"$sum": "$opened_count"}
        }}
    ]
    kpis_result = list(db.notification_logs.aggregate(pipeline_kpis))
    kpis = kpis_result[0] if kpis_result else {"total_campaigns": 0, "total_success": 0, "total_errors": 0, "total_opened": 0}
    
    total_attempts = kpis["total_success"] + kpis["total_errors"]
    success_rate = round((kpis["total_success"] / total_attempts * 100) if total_attempts > 0 else 0, 1)
    error_rate = round((kpis["total_errors"] / total_attempts * 100) if total_attempts > 0 else 0, 1)
    
    # Timeseries (Últimos 30 días)
    pipeline_timeseries = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$project": {
            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "success_count": 1,
            "error_count": 1
        }},
        {"$group": {
            "_id": "$date",
            "success": {"$sum": "$success_count"},
            "error": {"$sum": "$error_count"}
        }},
        {"$sort": {"_id": 1}}
    ]
    timeseries_raw = list(db.notification_logs.aggregate(pipeline_timeseries))
    timeseries = [{"date": ts["_id"], "success": ts["success"], "error": ts["error"]} for ts in timeseries_raw]
    
    # Historial de Campañas (últimos 50)
    campaigns_raw = list(db.notification_logs.find().sort("created_at", -1).limit(50))
    campaigns = []
    for c in campaigns_raw:
        c["id"] = c.get("id", str(c["_id"]))
        
        val = c.get("created_at")
        try:
            if hasattr(val, "isoformat"):
                dt = val
            elif val:
                # Si era un string antiguo guardado sin timezone
                dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
            else:
                dt = get_chile_time()
                
            c["created_at"] = to_chile_time(dt).isoformat()
        except Exception:
            c["created_at"] = str(val)
            
        c.pop("_id", None)
        campaigns.append(c)
        
    return {
        "kpis": {
            "total_campaigns": kpis.get("total_campaigns", 0),
            "total_success": kpis.get("total_success", 0),
            "total_errors": kpis.get("total_errors", 0),
            "total_opened": kpis.get("total_opened", 0),
            "success_rate": success_rate,
            "error_rate": error_rate
        },
        "timeseries": timeseries,
        "campaigns": campaigns
    }