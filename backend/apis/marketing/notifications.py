from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging
import uuid
from datetime import datetime
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db
from firebase_admin import credentials, initialize_app, messaging
import firebase_admin
import os

router = APIRouter()
logger = logging.getLogger(__name__)

# Inicializar Firebase (solo una vez)
if not firebase_admin._apps:
    # Usa las credenciales de tu Firebase Admin SDK (descarga el JSON desde Firebase Console)
    cred_path = os.path.join(os.path.dirname(__file__), '..', '..', 'keys', 'vanellix-adcf0-firebase-adminsdk-fbsvc-2435355993.json')
    cred_path = os.path.abspath(cred_path)
    cred = credentials.Certificate(cred_path)
    initialize_app(cred, {"storageBucket": "vanellix-adcf0.firebasestorage.app"})

# Modelos Pydantic
class NotificationTypeCreate(BaseModel):
    event_name: str
    title_template: str
    body_template: str
    image_url: Optional[str] = None
    target_type: str  # "user", "topic", "all"
    target_value: str
    api_config_id: str

class NotificationTypeResponse(BaseModel):
    id: str
    event_name: str
    title_template: str
    body_template: str
    image_url: Optional[str]
    target_type: str
    target_value: str
    api_config_id: str
    created_at: str
    updated_at: str
    created_by: str

class NotificationApiConfigCreate(BaseModel):
    service: str
    api_key: str
    project_id: str

class NotificationApiConfigResponse(BaseModel):
    id: str
    service: str
    project_id: str
    created_at: str
    updated_at: str
    created_by: str

class NotificationTokenCreate(BaseModel):
    token: str
    device_type: str
    permissions_granted: bool

class SendNotificationRequest(BaseModel):
    notification_type_id: str
    data: Dict  # Datos para reemplazar en plantillas
    schedule_time: Optional[str] = None  # ISODate para programar

# Reemplazar variables en plantillas
def render_template(template: str, data: Dict) -> str:
    result = template
    for key, value in data.items():
        result = result.replace(f"{{{key}}}", str(value)).replace(f"#{key}", str(value))
    return result

# Enviar notificación con FCM
async def send_fcm_notification(api_config: Dict, title: str, body: str, image_url: Optional[str], target_type: str, target_value: str):
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url
            ),
            topic=target_value if target_type == "topic" else None,
            token=target_value if target_type == "user" else None
        )
        response = messaging.send(message)
        return response
    except Exception as e:
        logger.error(f"Error enviando notificación FCM: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error enviando notificación: {str(e)}")

# CRUD Tipos de Notificaciones
@router.post("/notifications/types", response_model=NotificationTypeResponse)
async def create_notification_type(data: NotificationTypeCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    api_config = db.notification_api_configs.find_one({"id": data.api_config_id})
    if not api_config:
        raise HTTPException(status_code=400, detail="Invalid api_config_id")
    
    notification_type = {
        "id": str(uuid.uuid4()),
        "event_name": data.event_name,
        "title_template": data.title_template,
        "body_template": data.body_template,
        "image_url": data.image_url,
        "target_type": data.target_type,
        "target_value": data.target_value,
        "api_config_id": data.api_config_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": user["wallet"]
    }
    db.notification_types.insert_one(notification_type)
    notification_type["created_at"] = notification_type["created_at"].isoformat()
    notification_type["updated_at"] = notification_type["updated_at"].isoformat()
    return notification_type

@router.get("/notifications/types", response_model=List[NotificationTypeResponse])
async def get_notification_types(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    types = list(db.notification_types.find({}))
    for t in types:
        t["id"] = t["id"]
        t["created_at"] = t["created_at"].isoformat()
        t["updated_at"] = t["updated_at"].isoformat()
        t.pop("_id", None)
    return types

# CRUD Configuraciones de API
@router.post("/notifications/api-configs", response_model=NotificationApiConfigResponse)
async def create_api_config(data: NotificationApiConfigCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    api_config = {
        "id": str(uuid.uuid4()),
        "service": data.service,
        "api_key": data.api_key,
        "project_id": data.project_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": user["wallet"]
    }
    db.notification_api_configs.insert_one(api_config)
    api_config["created_at"] = api_config["created_at"].isoformat()
    api_config["updated_at"] = api_config["updated_at"].isoformat()
    api_config.pop("_id", None)
    return api_config

@router.get("/notifications/api-configs", response_model=List[NotificationApiConfigResponse])
async def get_api_configs(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    configs = list(db.notification_api_configs.find({}))
    for c in configs:
        c["id"] = c["id"]
        c["created_at"] = c["created_at"].isoformat()
        c["updated_at"] = c["updated_at"].isoformat()
        c.pop("_id", None)
        c.pop("api_key", None)  # No exponer la clave
    return configs

# Guardar Token de Notificación
@router.post("/notifications/tokens")
async def save_notification_token(data: NotificationTokenCreate, user: dict = Depends(verify_session)):
    token_data = {
        "wallet": user["wallet"],
        "token": data.token,
        "device_type": data.device_type,
        "permissions_granted": data.permissions_granted,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    db.user_notification_tokens.update_one(
        {"wallet": user["wallet"], "token": data.token},
        {"$set": token_data},
        upsert=True
    )
    return {"success": True, "message": "Token guardado"}

# Enviar Notificación
@router.post("/notifications/send")
async def send_notification(data: SendNotificationRequest, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
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
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        db.notification_schedules.insert_one(schedule)
        return {"success": True, "message": "Notificación programada"}
    
    # Enviar ahora
    title = render_template(notification_type["title_template"], data.data)
    body = render_template(notification_type["body_template"], data.data)
    image_url = notification_type.get("image_url")
    
    if notification_type["target_type"] == "user":
        token = db.user_notification_tokens.find_one({"wallet": notification_type["target_value"], "permissions_granted": True})
        if not token:
            raise HTTPException(status_code=400, detail="Usuario sin token válido")
        notification_type["target_value"] = token["token"]

    response = await send_fcm_notification(
        api_config, title, body, image_url,
        notification_type["target_type"], notification_type["target_value"]
    )
    return {"success": True, "message": "Notificación enviada", "response": response}

# Listar usuarios con tokens de notificación
@router.get("/notifications/users-with-tokens", response_model=List[Dict])
async def get_users_with_tokens(user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    users = list(db.user_notification_tokens.find({"permissions_granted": True}, {"_id": 0, "wallet": 1, "device_type": 1}))
    return users