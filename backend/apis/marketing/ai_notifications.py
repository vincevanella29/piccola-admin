"""
apis/marketing/ai_notifications.py
=============================
AI assistant for Push Notifications configuration using Grok.
Helps create push templates, automations, and flows via natural language.
"""

import os
import json
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from services.automations.triggers import TRIGGERS

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

TEXT_MODEL   = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY  = os.getenv("XAI_API_KEY")
ENDPOINT_CHAT = os.getenv("XAI_CHAT_URL", "https://api.x.ai/v1/chat/completions")

SYSTEM_PROMPT = """\
Eres el asistente de marketing PRO para un restaurante de delivery (La Piccola Italia), especializado en Notificaciones Push (FCM).
Tu trabajo es crear templates de notificaciones push, configurar automaciones de push, y armar flujos end-to-end.

═══════════════════════════════════════════════════
TEMPLATES DE NOTIFICACIONES PUSH
═══════════════════════════════════════════════════

Un template push es simple. Tiene:
- event_name: Un nombre interno para el evento (ej: "review_post_entrega").
- target_type: A quién va dirigido. Opciones: "customers", "all", "anonymous", "employees". Generalmente usarás "customers" para la mayoría de eventos.
- title_template: El título de la notificación. Puedes usar variables.
- body_template: El mensaje de la notificación. Corto, directo y que enganche. Puedes usar variables.

VARIABLES DISPONIBLES:
- {user_name} → Nombre del cliente
- {order_id} → ID corto del pedido
- {status} → Estado del pedido (pending, confirmed, preparing, ready, dispatched, delivered)
- {total} → Total formateado
- {delivery_time} → Tiempo estimado de entrega

═══════════════════════════════════════════════════
AUTOMACIONES DE PUSH
═══════════════════════════════════════════════════

Las automaciones de push se disparan por eventos, principalmente cambios de estado del pedido.
Estados comunes: pending, confirmed, preparing, dispatched, delivered.
El delay se especifica en minutos: 0=inmediato, 60=1h, 1440=1día.

═══════════════════════════════════════════════════
ACCIONES (JSON que debes generar)
═══════════════════════════════════════════════════

1. CREAR TEMPLATE PUSH:
```json
{
  "action": "create_notification_template",
  "template": {
    "event_name": "review_post_entrega",
    "target_type": "customers",
    "title_template": "Hola {user_name}, ¡esperamos que lo hayas disfrutado! 🍕",
    "body_template": "Tu pedido #{order_id} ya fue entregado. ¡Déjanos tu opinión!"
  },
  "message": "Explicación"
}
```

2. CREAR AUTOMACIÓN (usa notification_type_id existente):
```json
{
  "action": "create_automation",
  "automation": {
    "name": "Review post-entrega",
    "trigger_event": "order_status_change",
    "segment": "customers",
    "action_type": "push",
    "condition": {"status": "delivered"},
    "notification_type_id": "ID del template que te proveen",
    "delay_minutes": 120
  },
  "message": "Explicación"
}
```

3. FLUJO COMPLETO (template push + automación):
```json
{
  "action": "create_full_flow",
  "template": {
    "event_name": "recompra_3_dias",
    "target_type": "customers",
    "title_template": "¡Te extrañamos {user_name}! 🍝",
    "body_template": "Hace unos días que no te vemos. ¡Aprovecha pedir hoy con despacho rápido!"
  },
  "automation": {
    "name": "Recompra 3 días post-entrega",
    "trigger_event": "order_status_change",
    "segment": "customers",
    "action_type": "push",
    "condition": {"status": "delivered"},
    "delay_minutes": 4320
  },
  "message": "Creé el template de recompra y la automación de 3 días."
}
```

═══════════════════════════════════════════════════
REGLAS Y FASES DE INTELIGENCIA
═══════════════════════════════════════════════════
- FASE 1: Revisa la sección "TEMPLATES PUSH EXISTENTES" del contexto. Si ya existe un template para lo que el usuario pide, USA ese ID directamente con `create_automation` vinculando a `notification_type_id`. No crees duplicados.
- FASE 2: Si necesitas un template nuevo, usa `create_full_flow` para crear la regla de automatización y el template al mismo tiempo.
- Mantén los títulos muy llamativos (usa emojis) y los bodies directos. ¡Es un celular!
- SIEMPRE responde con JSON action cuando determines que es momento de actuar.
"""

class ChatMessage(BaseModel):
    role: str
    content: str

class NotificationsAIChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: Optional[dict] = None

class NotificationsAIChatResponse(BaseModel):
    reply: str
    action: Optional[dict] = None

@router.post("/notifications/ai/chat", response_model=NotificationsAIChatResponse)
async def notifications_ai_chat(
    req: NotificationsAIChatRequest,
    user: dict = Depends(verify_session),
):
    """Chat with Grok to configure push notifications and automations."""
    require_admin_level(user, "marketing")

    if not XAI_API_KEY:
        raise HTTPException(status_code=503, detail="XAI_API_KEY no configurada")

    context_str = ""
    if req.context:
        templates = req.context.get("templates", [])
        if templates:
            tpl_info = [f"- {t.get('event_name', '?')} (target={t.get('target_type')}, id={t.get('id', '?')})" for t in templates]
            context_str += f"\n\nTEMPLATES PUSH EXISTENTES:\n" + "\n".join(tpl_info)

        automations = req.context.get("automations", [])
        if automations:
            auto_info = [f"- {a.get('name', '?')} (status={a.get('condition',{}).get('status')}, delay={a.get('delay_minutes',0)}min, active={a.get('active')})" for a in automations]
            context_str += f"\n\nAUTOMACIONES PUSH EXISTENTES:\n" + "\n".join(auto_info)

    triggers_info = []
    for t_id, t_class in TRIGGERS.items():
        triggers_info.append(f"- {t_id} (Segment: {t_class.segment}, Label: {t_class.label})")
    context_str += "\n\nTRIGGERS DE AUTOMATIZACION DISPONIBLES:\n" + "\n".join(triggers_info)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + context_str},
    ]
    for h in req.history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": TEXT_MODEL,
        "messages": messages,
        "temperature": 0.6,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r = await client.post(ENDPOINT_CHAT, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.error(f"[notifications_ai] Grok error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    reply = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip()
    action = _extract_action(reply)
    return NotificationsAIChatResponse(reply=reply, action=action)

def _extract_action(reply: str) -> Optional[dict]:
    import re
    if "```json" not in reply and "```" not in reply:
        json_match = re.search(r'\{[\s\S]*?"action"\s*:\s*"[^"]+?"[\s\S]*\}', reply, re.DOTALL)
        if json_match:
            try: return json.loads(json_match.group())
            except: pass
        return None
    try:
        if "```json" in reply:
            json_str = reply.split("```json")[1].split("```")[0].strip()
        else:
            parts = reply.split("```")
            for i in range(1, len(parts), 2):
                if parts[i].strip().startswith("{"):
                    json_str = parts[i].strip()
                    break
            else: return None
        return json.loads(json_str)
    except:
        return None
