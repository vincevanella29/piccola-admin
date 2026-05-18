"""
marketing/whatsapp.py
=====================
WhatsApp Business Cloud API integration.
- Config management (access_token, phone_number_id, waba_id)
- Send messages (text, template, bulk)
- Template CRUD via Meta Graph API
- Audience CRM
- Webhook for inbound messages
- Quick replies
- Conversation history
"""

import logging
import json
import uuid
import httpx
from datetime import datetime
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from utils.web3mongo import db, w3
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.time_utils import get_chile_time
from eth_account.messages import encode_defunct

router = APIRouter()
logger = logging.getLogger(__name__)

# Collections
WA_CONFIG = db.whatsapp_config
WA_MESSAGES = db.whatsapp_messages

WA_CONVERSATIONS = db.whatsapp_conversations

# Indexes
try:
    WA_MESSAGES.create_index([("phone", 1), ("created_at", -1)])
    WA_CONVERSATIONS.create_index("phone", unique=True)

except Exception as e:
    logger.warning(f"[whatsapp] Index creation warning: {e}")

GRAPH_API_VERSION = "v20.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# ─── Pydantic Models ───────────────────────────────────────────

class WAConfigSave(BaseModel):
    access_token: str
    phone_number_id: str
    waba_id: str
    webhook_verify_token: Optional[str] = None
    auto_reply: bool = False

class WASendMessage(BaseModel):
    phone: str
    type: str = "template"  # "text" or "template"
    text: Optional[str] = None
    template_name: Optional[str] = None
    template_language: str = "en_US"
    template_components: Optional[List[Dict]] = None

class WABulkSend(BaseModel):
    phones: List[str]
    template_name: str
    template_language: str = "en_US"
    template_components: Optional[List[Dict]] = None

class WATemplateCreate(BaseModel):
    name: str
    category: str = "MARKETING"
    language: str = "es"
    components: List[Dict]



class WAQuickReplySave(BaseModel):
    quick_replies: List[Dict]  # [{trigger, response, active}]

class SignatureRequest(BaseModel):
    message: str
    signature: str

# ─── Helpers ───────────────────────────────────────────────────

def _get_config():
    return WA_CONFIG.find_one({"_id": "whatsapp_main"}) or {}

def _mask_token(token: str) -> str:
    if len(token) <= 20:
        return "***"
    return f"{token[:8]}...{token[-8:]}"

async def _call_meta(method: str, url: str, config: dict, json_data: dict = None):
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient(timeout=30) as client:
        if method == "GET":
            resp = await client.get(url, headers=headers)
        elif method == "POST":
            resp = await client.post(url, headers=headers, json=json_data)
        elif method == "DELETE":
            resp = await client.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
    return resp.json(), resp.status_code

# ─── Config ────────────────────────────────────────────────────

@router.get("/whatsapp/config")
async def get_whatsapp_config(user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    if not config:
        return {"configured": False}
    return {
        "configured": True,
        "phone_number_id": config.get("phone_number_id", ""),
        "waba_id": config.get("waba_id", ""),
        "access_token_masked": _mask_token(config.get("access_token", "")),
        "webhook_verify_token": config.get("webhook_verify_token", ""),
        "auto_reply": config.get("auto_reply", False),
        "quick_replies": config.get("quick_replies", []),
        "updated_at": config.get("updated_at", ""),
        "updated_by": config.get("updated_by", ""),
    }

@router.post("/whatsapp/config")
async def save_whatsapp_config(payload: WAConfigSave, user=Depends(verify_session)):
    require_admin_level(user, 3)
    now = get_chile_time()
    wallet = user.get("wallet", "unknown")
    
    update_data = {
        "access_token": payload.access_token,
        "phone_number_id": payload.phone_number_id,
        "waba_id": payload.waba_id,
        "auto_reply": payload.auto_reply,
        "updated_at": now.isoformat(),
        "updated_by": wallet,
    }
    if payload.webhook_verify_token:
        update_data["webhook_verify_token"] = payload.webhook_verify_token
    
    WA_CONFIG.update_one(
        {"_id": "whatsapp_main"},
        {"$set": update_data},
        upsert=True
    )
    logger.info(f"[whatsapp] Config saved by {wallet}")
    return {"success": True}

# ─── Send ──────────────────────────────────────────────────────

@router.post("/whatsapp/send")
async def send_whatsapp_message(payload: WASendMessage, user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    if not config.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp no configurado. Ve a Settings.")
    
    url = f"{GRAPH_API_BASE}/{config['phone_number_id']}/messages"
    
    if payload.type == "text":
        body = {
            "messaging_product": "whatsapp",
            "to": payload.phone.replace("+", ""),
            "type": "text",
            "text": {"body": payload.text}
        }
    else:
        template_data = {
            "name": payload.template_name,
            "language": {"code": payload.template_language}
        }
        if payload.template_components:
            template_data["components"] = payload.template_components
        body = {
            "messaging_product": "whatsapp",
            "to": payload.phone.replace("+", ""),
            "type": "template",
            "template": template_data
        }
    
    result, status = await _call_meta("POST", url, config, body)
    
    now = get_chile_time()
    WA_MESSAGES.insert_one({
        "phone": payload.phone.replace("+", ""),
        "direction": "outbound",
        "type": payload.type,
        "content": payload.text or payload.template_name,
        "template_name": payload.template_name,
        "status": "accepted" if status == 200 else "failed",
        "wa_msg_id": result.get("messages", [{}])[0].get("id") if status == 200 else None,
        "meta_response": result,
        "created_at": now,
        "sent_by": user.get("wallet", "unknown"),
    })
    
    # Upsert conversation
    WA_CONVERSATIONS.update_one(
        {"phone": payload.phone.replace("+", "")},
        {"$set": {"last_message_at": now, "last_direction": "outbound"}, "$setOnInsert": {"status": "active", "unread": 0, "scope": "whatsapp"}},
        upsert=True
    )
    
    if status != 200:
        err_status = 400 if status in (400, 401, 403) else status
        raise HTTPException(status_code=err_status, detail=f"Meta Error: {result}")
    return {"success": True, "result": result}

@router.post("/whatsapp/send-bulk")
async def send_bulk_whatsapp(payload: WABulkSend, user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    if not config.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp no configurado.")
    
    results = []
    for phone in payload.phones:
        try:
            msg = WASendMessage(
                phone=phone,
                type="template",
                template_name=payload.template_name,
                template_language=payload.template_language,
                template_components=payload.template_components
            )
            r = await send_whatsapp_message(msg, user)
            results.append({"phone": phone, "status": "sent"})
        except Exception as e:
            results.append({"phone": phone, "status": "failed", "error": str(e)})
    
    return {"total": len(payload.phones), "results": results}

# ─── Templates ─────────────────────────────────────────────────

@router.get("/whatsapp/templates")
async def list_templates(user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    if not config.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp no configurado.")
    
    url = f"{GRAPH_API_BASE}/{config['waba_id']}/message_templates"
    result, status = await _call_meta("GET", url, config)
    if status != 200:
        # If Meta returns 401, return 400 to the frontend to avoid confusing it with a session 401
        err_status = 400 if status == 401 else status
        raise HTTPException(status_code=err_status, detail=f"Meta Error: {result}")
    return {"templates": result.get("data", [])}

@router.post("/whatsapp/templates")
async def create_template(payload: WATemplateCreate, user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    if not config.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp no configurado.")
    
    url = f"{GRAPH_API_BASE}/{config['waba_id']}/message_templates"
    body = {
        "name": payload.name,
        "category": payload.category,
        "language": payload.language,
        "components": payload.components,
    }
    result, status = await _call_meta("POST", url, config, body)
    if status not in (200, 201):
        raise HTTPException(status_code=status, detail=result)
    logger.info(f"[whatsapp] Template '{payload.name}' created by {user.get('wallet')}")
    return {"success": True, "result": result}

@router.delete("/whatsapp/templates/{template_name}")
async def delete_template(template_name: str, user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    if not config.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp no configurado.")
    
    url = f"{GRAPH_API_BASE}/{config['waba_id']}/message_templates?name={template_name}"
    result, status = await _call_meta("DELETE", url, config)
    if status != 200:
        raise HTTPException(status_code=status, detail=result)
    return {"success": True}



# ─── Quick Replies ─────────────────────────────────────────────

@router.get("/whatsapp/quick-replies")
async def get_quick_replies(user=Depends(verify_session)):
    require_admin_level(user, 3)
    config = _get_config()
    return {"quick_replies": config.get("quick_replies", [])}

@router.post("/whatsapp/quick-replies")
async def save_quick_replies(payload: WAQuickReplySave, user=Depends(verify_session)):
    require_admin_level(user, 3)
    WA_CONFIG.update_one(
        {"_id": "whatsapp_main"},
        {"$set": {"quick_replies": [dict(qr) for qr in payload.quick_replies]}},
        upsert=True
    )
    return {"success": True}

# ─── Conversations ─────────────────────────────────────────────

@router.get("/whatsapp/conversations")
async def get_conversations(user=Depends(verify_session)):
    require_admin_level(user, 3)
    docs = list(WA_CONVERSATIONS.find({}, {"_id": 0}).sort("last_message_at", -1).limit(100))
    return {"conversations": docs}

@router.get("/whatsapp/conversations/{phone}/messages")
async def get_conversation_messages(phone: str, user=Depends(verify_session)):
    require_admin_level(user, 3)
    clean_phone = phone.replace("+", "")
    msgs = list(WA_MESSAGES.find({"phone": clean_phone}, {"_id": 0, "meta_response": 0}).sort("created_at", 1).limit(200))
    # Serialize datetime
    for m in msgs:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return {"messages": msgs, "phone": clean_phone}

# ─── Webhook (Public — no auth) ───────────────────────────────

@router.get("/whatsapp/webhook")
async def webhook_verify(request: Request):
    """Meta webhook verification (challenge-response)."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    config = _get_config()
    verify_token = config.get("webhook_verify_token", "vanellix_whatsapp_verify")
    
    if mode == "subscribe" and token == verify_token:
        logger.info("[whatsapp] Webhook verified successfully")
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=challenge)
    
    raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/whatsapp/webhook")
async def webhook_receive(request: Request):
    """Receive inbound messages from Meta."""
    data = await request.json()
    
    try:
        entries = data.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])
                statuses = value.get("statuses", [])
                
                # Handle status updates (delivered, read, etc.)
                for status_update in statuses:
                    wa_msg_id = status_update.get("id")
                    new_status = status_update.get("status")  # sent, delivered, read, failed
                    if wa_msg_id and new_status:
                        WA_MESSAGES.update_one(
                            {"wa_msg_id": wa_msg_id},
                            {"$set": {"status": new_status, "status_updated_at": get_chile_time()}}
                        )
                
                # Handle inbound messages
                for i, msg in enumerate(messages):
                    phone = msg.get("from", "")
                    msg_type = msg.get("type", "text")
                    content = ""
                    
                    if msg_type == "text":
                        content = msg.get("text", {}).get("body", "")
                    elif msg_type == "image":
                        content = "[imagen]"
                    elif msg_type == "audio":
                        content = "[audio]"
                    elif msg_type == "document":
                        content = "[documento]"
                    elif msg_type == "interactive":
                        interactive = msg.get("interactive", {})
                        if interactive.get("type") == "button_reply":
                            content = interactive.get("button_reply", {}).get("title", "")
                        elif interactive.get("type") == "list_reply":
                            content = interactive.get("list_reply", {}).get("title", "")
                    else:
                        content = f"[{msg_type}]"
                    
                    contact_name = ""
                    if i < len(contacts):
                        profile = contacts[i].get("profile", {})
                        contact_name = profile.get("name", "")
                    
                    now = get_chile_time()
                    
                    # Save message
                    WA_MESSAGES.insert_one({
                        "phone": phone,
                        "direction": "inbound",
                        "type": msg_type,
                        "content": content,
                        "wa_msg_id": msg.get("id"),
                        "created_at": now,
                    })
                    
                    # Upsert conversation
                    WA_CONVERSATIONS.update_one(
                        {"phone": phone},
                        {
                            "$set": {
                                "name": contact_name or phone,
                                "last_message_at": now,
                                "last_message": content[:100],
                                "last_direction": "inbound",
                                "status": "active",
                                "scope": "whatsapp",
                            },
                            "$inc": {"unread": 1},
                            "$setOnInsert": {"created_at": now}
                        },
                        upsert=True
                    )
                    
                    # Auto-reply with quick replies
                    config = _get_config()
                    quick_replies = config.get("quick_replies", [])
                    matched_reply = None
                    for qr in quick_replies:
                        if not qr.get("active", True):
                            continue
                        trigger = qr.get("trigger", "").lower()
                        if trigger and trigger in content.lower():
                            matched_reply = qr.get("response", "")
                            break
                    
                    if matched_reply:
                        try:
                            url = f"{GRAPH_API_BASE}/{config['phone_number_id']}/messages"
                            body = {
                                "messaging_product": "whatsapp",
                                "to": phone,
                                "type": "text",
                                "text": {"body": matched_reply}
                            }
                            await _call_meta("POST", url, config, body)
                            WA_MESSAGES.insert_one({
                                "phone": phone,
                                "direction": "outbound",
                                "type": "text",
                                "content": matched_reply,
                                "status": "sent",
                                "created_at": get_chile_time(),
                                "sent_by": "quick_reply",
                            })
                        except Exception as e:
                            logger.error(f"[whatsapp] Quick reply send failed: {e}")
                    
                    logger.info(f"[whatsapp] Inbound from {phone}: {content[:50]}")
    
    except Exception as e:
        logger.error(f"[whatsapp] Webhook processing error: {e}")
    
    return {"status": "ok"}
