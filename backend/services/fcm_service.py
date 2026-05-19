import logging
import uuid
import json
from typing import Dict, Optional, List, Union
from firebase_admin import credentials, initialize_app, messaging
import firebase_admin

from utils.time_utils import get_chile_time
from utils.web3mongo import db

logger = logging.getLogger(__name__)

def ensure_firebase() -> bool:
    """Initialize Firebase Admin SDK lazily from MongoDB config."""
    config = db.notification_api_configs.find_one({"service": "firebase", "service_account_json": {"$exists": True, "$ne": None}})
    expected_project_id = None
    sa_data = None
    
    if config and config.get("service_account_json"):
        sa_data = config["service_account_json"]
        if isinstance(sa_data, str):
            try:
                sa_data = json.loads(sa_data)
            except Exception:
                pass
        if isinstance(sa_data, dict):
            expected_project_id = sa_data.get("project_id", config.get("project_id", ""))

    if firebase_admin._apps:
        app = firebase_admin.get_app()
        current_project_id = app.project_id
        if expected_project_id and current_project_id != expected_project_id:
            logger.warning(f"[fcm_service] Project ID changed ({current_project_id} -> {expected_project_id}). Reinitializing...")
            firebase_admin.delete_app(app)
        else:
            return True
            
    if expected_project_id and sa_data:
        try:
            cred = credentials.Certificate(sa_data)
            initialize_app(cred, {"storageBucket": f"{expected_project_id}.firebasestorage.app"})
            logger.info(f"[fcm_service] Initialized Firebase from MongoDB config (project: {expected_project_id})")
            return True
        except Exception as e:
            logger.error(f"[fcm_service] Error initializing Firebase from MongoDB: {e}")

    logger.warning("[fcm_service] No Firebase credentials found in MongoDB. Push notifications are disabled.")
    return False

def log_campaign(campaign_id: str, title: str, body: str, target_type: str, target_value: str, success_count: int, error_count: int, errors: list, sender_wallet: str):
    """Guarda la métrica de un envío Push en la base de datos de analíticas."""
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

async def send_fcm_message(
    title: str, 
    body: str, 
    target_type: str = "user", 
    target_value: str = "", 
    icon_url: Optional[str] = None, 
    image_url: Optional[str] = None, 
    link_url: Optional[str] = None, 
    campaign_id: Optional[str] = None
) -> str:
    """
    Envía un mensaje usando Firebase Admin. Retorna el message ID o arroja excepción.
    """
    if not ensure_firebase():
        raise Exception("Firebase no está configurado.")
        
    msg_data = {}
    if campaign_id:
        msg_data["campaign_id"] = campaign_id
    if link_url:
        msg_data["url"] = link_url
    if icon_url:
        msg_data["icon_url"] = icon_url

    webpush_config = messaging.WebpushConfig(
        notification=messaging.WebpushNotification(
            icon=icon_url or "/favicon-piccola.png",
            image=image_url
        )
    )

    android_config = messaging.AndroidConfig(
        notification=messaging.AndroidNotification(
            icon="ic_notification",
            color="#00ff00",
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
    
    return messaging.send(message)


async def send_and_log_single(
    title: str, 
    body: str, 
    target_type: str = "user", 
    target_value: str = "", 
    icon_url: Optional[str] = None, 
    image_url: Optional[str] = None, 
    link_url: Optional[str] = None, 
    sender_wallet: str = "system",
    force_campaign_id: Optional[str] = None
) -> Dict:
    """Envía un Push y lo registra inmediatamente. Ideal para transaccionales/topics."""
    campaign_id = force_campaign_id or str(uuid.uuid4())
    success_count = 0
    error_count = 0
    errors = []
    response = None
    
    try:
        response = await send_fcm_message(title, body, target_type, target_value, icon_url, image_url, link_url, campaign_id)
        logger.info(f"[fcm_service] 🚀 Push a {target_type} ({target_value}). ID: {response}")
        success_count = 1
    except Exception as e:
        err_str = str(e)
        logger.error(f"[fcm_service] ❌ Error enviando Push a {target_value}: {err_str}")
        error_count = 1
        errors.append(err_str)
        _handle_invalid_token(err_str, target_type, target_value)

    log_campaign(campaign_id, title, body, target_type, target_value, success_count, error_count, errors, sender_wallet)
    return {"success": success_count > 0, "campaign_id": campaign_id, "response": response, "errors": errors}


async def broadcast_and_log_fcm(
    tokens: List[str],
    title: str, 
    body: str, 
    logical_target_type: str = "all", 
    logical_target_value: str = "multiple",
    icon_url: Optional[str] = None, 
    image_url: Optional[str] = None, 
    link_url: Optional[str] = None, 
    sender_wallet: str = "system",
    force_campaign_id: Optional[str] = None
) -> Dict:
    """
    Envía a una lista de tokens pero genera SOLO UN LOG agregado de campaña.
    Ideal para marketing segmentado.
    """
    campaign_id = force_campaign_id or str(uuid.uuid4())
    success_count = 0
    error_count = 0
    errors = []
    
    for token in tokens:
        try:
            await send_fcm_message(title, body, "user", token, icon_url, image_url, link_url, campaign_id)
            success_count += 1
        except Exception as e:
            err_str = str(e)
            error_count += 1
            errors.append(err_str)
            _handle_invalid_token(err_str, "user", token)
            
    log_campaign(campaign_id, title, body, logical_target_type, logical_target_value, success_count, error_count, errors, sender_wallet)
    return {"success": success_count > 0, "success_count": success_count, "error_count": error_count, "campaign_id": campaign_id, "errors": errors}

def _handle_invalid_token(err_str: str, target_type: str, target_value: str):
    err_lower = err_str.lower()
    if "senderid mismatch" in err_lower or "notregistered" in err_lower or "unregistered" in err_lower or "invalid registration" in err_lower:
        if target_type == "user":
            db.user_notification_tokens.delete_many({"token": target_value})
            logger.warning(f"[fcm_service] 🗑 Token inválido eliminado: {target_value[:15]}...")
