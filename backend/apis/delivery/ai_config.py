"""
delivery/ai_config.py
=====================
AI assistant for delivery configuration using Grok.
Understands natural language commands about schedules, statuses, and carrier settings.
Responds with structured JSON actions that the frontend can apply directly.
"""

import os
import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger("delivery_ai")

# ── Grok config ──────────────────────────────────────────────────────────────
TEXT_MODEL   = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY  = os.getenv("XAI_API_KEY")
ENDPOINT_CHAT = os.getenv("XAI_CHAT_URL", "https://api.x.ai/v1/chat/completions")

SYSTEM_PROMPT = """\
Eres el asistente de configuración de delivery para un restaurante. Tu trabajo es ayudar \
a configurar horarios de delivery, retiro en tienda, zonas de cobertura, métodos de pago, \
y gestionar fechas especiales (feriados, cierres, horarios especiales).

CONTEXTO:
- El restaurante tiene sucursales. Cada sucursal tiene horarios y zona de delivery independientes.
- Los días se representan con ISO weekday: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo.
- Los horarios tienen formato "HH:MM" (24h).
- Las fechas especiales (special_dates) se almacenan por sucursal en formato YYYY-MM-DD.

CUANDO el usuario pida cambiar horarios, responde con este JSON:
```json
{
  "action": "update_schedule",
  "location_id": "<id o null para todas>",
  "service": "delivery|pickup|both",
  "schedule": {
    "1": {"open": "12:00", "close": "22:00"},
    "2": {"open": "12:00", "close": "22:00"}
  },
  "message": "Explicación amigable de qué se hizo"
}
```

CUANDO el usuario pida configurar zona de delivery:
```json
{
  "action": "update_zone",
  "location_id": "<id o null para todas>",
  "delivery_zone": {
    "type": "circular",
    "radius_km": 5,
    "min_order": 10000,
    "delivery_fee": 2000
  },
  "message": "Explicación amigable"
}
```
- type puede ser "circular" (radio en km) o "square" (cuadrado en km)
- radius_km: radio o lado del cuadrado
- min_order: monto mínimo en pesos (CLP)
- delivery_fee: costo de delivery en pesos (CLP)

CUANDO el usuario pida configurar la programación (intervalos, bloques máximos, adelanto):
```json
{
  "action": "update_scheduling_config",
  "scheduling_config": {
    "scheduling_enabled": true,
    "allow_asap": true,
    "advance_days": 1,
    "slot_interval_minutes": 30,
    "min_lead_time_minutes": 30,
    "max_slots_per_day": 100
  },
  "message": "Explicación amigable"
}
```

CUANDO el usuario pida agregar feriados, cierres, o fechas especiales:
```json
{
  "action": "set_special_dates",
  "location_ids": "all",
  "special_dates": [
    {"date": "2026-01-01", "label": "Año Nuevo", "closed": true},
    {"date": "2026-05-01", "label": "Día del Trabajo", "closed": true},
    {"date": "2026-09-18", "label": "Fiestas Patrias", "closed": true},
    {"date": "2026-09-19", "label": "Día de las Glorias del Ejército", "closed": true},
    {"date": "2026-12-25", "label": "Navidad", "closed": true}
  ],
  "mode": "append",
  "message": "Explicación amigable"
}
```
- location_ids: "all" para todas las sucursales, o un array de IDs ["id1", "id2"]
- mode: "append" agrega sin borrar las existentes, "replace" reemplaza todas las fechas especiales
- closed: true = cerrado todo el día, false = abierto con horario especial (incluir open/close)
- Si el usuario pide horario especial en vez de cierre: {"date": "2026-12-24", "label": "Víspera de Navidad", "closed": false, "open": "10:00", "close": "15:00"}

CUANDO el usuario pida eliminar feriados:
```json
{
  "action": "remove_special_dates",
  "location_ids": "all",
  "dates_to_remove": ["2026-12-25", "2026-01-01"],
  "message": "Explicación amigable"
}
```

REGLAS DE FERIADOS:
- Si dice "feriados chile 2026", genera TODOS los feriados nacionales de Chile para 2026.
- Si dice "feriados chile mayo", genera solo los de mayo del año actual.
- Si dice "cierra 18 y 19 de septiembre", genera solo esas fechas con closed: true.
- Si dice "horario especial navidad de 10 a 15", genera con closed: false y las horas.
- Si dice "elimina feriados de diciembre", usa la acción remove_special_dates.
- Feriados de Chile incluyen: Año Nuevo (1 ene), Viernes Santo, Sábado Santo, Día del Trabajo (1 may), Día de las Glorias Navales (21 may), Día Nacional de los Pueblos Indígenas (variable jun), San Pedro y San Pablo (29 jun), Día de la Virgen del Carmen (16 jul), Asunción de la Virgen (15 ago), Fiestas Patrias (18 sep), Día de las Glorias del Ejército (19 sep), Día del Encuentro de Dos Mundos (12 oct), Día de las Iglesias Evangélicas (31 oct), Día de Todos los Santos (1 nov), Inmaculada Concepción (8 dic), Navidad (25 dic).

REGLAS GENERALES:
- Si el usuario dice "de lunes a viernes", incluye días 1-5.
- Si dice "fines de semana", incluye días 6-7.
- Si dice "todos los días", incluye 1-7.
- Si dice "cerrar" un día, NO incluyas ese día en el schedule.
- Si el usuario pide que sea "23 horas" o "24 horas", usa open: "00:00" y close: "23:59". Además, si hacen falta más bloques para cubrir 24 horas con el intervalo dado, envía una acción de update_scheduling_config para aumentar max_slots_per_day a 150.
- Si dice "5 km" para zona, usa radius_km=5.
- Siempre confirma qué vas a hacer antes de aplicar.
- Sé conciso y amigable. Habla en español chileno casual.
- Si no entiendes algo, pregunta para aclarar.
"""


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str

class DeliveryAIChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: Optional[dict] = None  # current config state

class DeliveryAIChatResponse(BaseModel):
    reply: str
    action: Optional[dict] = None  # parsed action if any


@router.post("/delivery/ai/chat", response_model=DeliveryAIChatResponse)
async def delivery_ai_chat(
    req: DeliveryAIChatRequest,
    user: dict = Depends(verify_session),
):
    """Chat with Grok to configure delivery settings."""
    require_admin_level(user, "admin")

    if not XAI_API_KEY:
        raise HTTPException(status_code=503, detail="XAI_API_KEY no configurada")

    # Build context from current state
    context_str = ""
    if req.context:
        locations = req.context.get("locations", [])
        if locations:
            loc_info = []
            for loc in locations:
                oh = loc.get("opening_hours", {})
                loc_info.append(f"- {loc.get('nombre', 'Sin nombre')} (ID: {loc.get('_id', '?')}): "
                                f"delivery={json.dumps(oh.get('delivery', {}), ensure_ascii=False)}, "
                                f"pickup={json.dumps(oh.get('pickup', {}), ensure_ascii=False)}")
            context_str = f"\n\nSUCURSALES ACTUALES:\n" + "\n".join(loc_info)

        statuses = req.context.get("statuses", [])
        if statuses:
            status_info = ", ".join([f"{s['icon']} {s['label']} ({s['key']})" for s in statuses])
            context_str += f"\n\nESTADOS INTERNOS: {status_info}"

    # Build messages
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + context_str},
    ]

    # Add history
    for h in req.history[-10:]:  # last 10 messages
        messages.append({"role": h.role, "content": h.content})

    # Add current message
    messages.append({"role": "user", "content": req.message})

    # Call Grok
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
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(ENDPOINT_CHAT, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"[delivery_ai] Grok error {e.response.status_code}: {e.response.text[:500]}")
        raise HTTPException(status_code=502, detail=f"Grok error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"[delivery_ai] Grok error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    reply = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip()
    logger.info(f"[delivery_ai] Reply: {reply[:200]}")

    # Try to parse JSON action from reply
    action = None
    if "```json" in reply:
        try:
            json_str = reply.split("```json")[1].split("```")[0].strip()
            action = json.loads(json_str)
        except Exception:
            pass

    return DeliveryAIChatResponse(reply=reply, action=action)
