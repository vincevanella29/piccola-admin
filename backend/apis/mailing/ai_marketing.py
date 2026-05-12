"""
apis/mailing/ai_marketing.py
=============================
AI assistant for marketing/mailing configuration using Grok.
Helps create templates, automations, and campaigns via natural language.

Supports multi-action flows: create template + automation in one shot.
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
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

# ── Grok config ──────────────────────────────────────────────────────────────
TEXT_MODEL   = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY  = os.getenv("XAI_API_KEY")
ENDPOINT_CHAT = os.getenv("XAI_CHAT_URL", "https://api.x.ai/v1/chat/completions")

TEMPLATES_COLL = db.mail_templates
AUTOMATIONS_COLL = db.mail_automations
MENUS_COLL = db.menus
DELIVERY_COLL = db.delivery_orders

SYSTEM_PROMPT = """\
Eres el asistente de marketing PRO para un restaurante de delivery (La Piccola Italia).
Tu trabajo es crear templates de email COMPLETOS, configurar automaciones, y armar flujos end-to-end.

═══════════════════════════════════════════════════
SISTEMA DE BLOQUES (para construir templates)
═══════════════════════════════════════════════════

Los templates se construyen con un array de BLOQUES. Cada bloque tiene: {id, type, data}.
El "id" se genera automáticamente, no lo incluyas.

TIPOS DE BLOQUES DISPONIBLES:
- header: {title: "texto", subtitle: "texto"}  → Encabezado principal
- text: {html: "<p>contenido HTML</p>"}  → Texto con formato
- image: {src: "url", alt: "desc", link: "url"}  → Imagen (usa URLs de productos reales)
- product_card: {name: "Nombre", price: 9990, image: "url"}  → Card de producto individual
- product_grid: {products: [{name, price, image}, ...]}  → Grid de productos (2-4 max)
- button: {text: "Texto del botón", url: "url", color: "#22c55e"}  → CTA button
- review_button: {text: "⭐ Dejanos tu opinión", url: "{{review_url}}", color: "#f59e0b"}  → Botón de review con estrellas
- divider: {}  → Línea separadora
- spacer: {height: 24}  → Espacio vertical
- variable: {variable: "nombre_variable"}  → Variable dinámica

VARIABLES DISPONIBLES en templates:
- {{customer_name}} → Nombre del cliente
- {{order_number}} → Número de pedido (ej: PI-ABC123)
- {{order_total}} → Total formateado (ej: $15.990)
- {{status}} → Estado actual del pedido
- {{restaurant_name}} → "La Piccola Italia"
- {{order_items_html}} → Tabla HTML con productos del pedido (auto-generada)
- {{suggested_products_html}} → Grid HTML con productos sugeridos (auto-generada)
- {{review_url}} → Link a la página de review del pedido
- {{reorder_url}} → Link para repetir el pedido
- {{tracking_url}} → Link de tracking del repartidor

═══════════════════════════════════════════════════
AUTOMACIONES
═══════════════════════════════════════════════════

Las automaciones se disparan por cambios de estado de pedido.
Estados: pending, confirmed, preparing, ready, dispatched, delivered, cancelled.
El delay se especifica en minutos: 0=inmediato, 60=1h, 120=2h, 1440=1día, 10080=1semana.

Flags de contenido automático:
- include_order_items: true → agrega tabla con los productos del pedido
- include_reorder: true → agrega botón "Volver a pedir"
- include_suggestions: true → agrega grid de productos sugeridos

═══════════════════════════════════════════════════
ACCIONES (JSON que debes generar)
═══════════════════════════════════════════════════

1. CREAR TEMPLATE:
```json
{
  "action": "create_template",
  "template": {
    "name": "Nombre",
    "subject": "Asunto con {{variables}}",
    "type": "automation",
    "description": "Descripción corta",
    "blocks": [
      {"type": "header", "data": {"title": "🍕 La Piccola Italia"}},
      {"type": "text", "data": {"html": "<p>Hola {{customer_name}}!</p>"}},
      {"type": "button", "data": {"text": "Ver pedido", "url": "{{tracking_url}}", "color": "#22c55e"}}
    ]
  },
  "message": "Explicación"
}
```

2. CREAR AUTOMACIÓN (usa template existente):
```json
{
  "action": "create_automation",
  "automation": {
    "name": "Review post-entrega",
    "trigger": "order_status_change",
    "condition": {"status": "delivered"},
    "template_name": "nombre del template existente",
    "delay_minutes": 120,
    "include_order_items": true,
    "include_reorder": false,
    "include_suggestions": true
  },
  "message": "Explicación"
}
```

3. FLUJO COMPLETO (template + automación juntos):
```json
{
  "action": "create_full_flow",
  "template": {
    "name": "Review Post-Entrega",
    "subject": "{{customer_name}}, ¿qué tal tu pedido? ⭐",
    "type": "automation",
    "description": "Email de review post-entrega",
    "blocks": [...]
  },
  "automation": {
    "name": "Review 2h post-entrega",
    "trigger": "order_status_change",
    "condition": {"status": "delivered"},
    "delay_minutes": 120,
    "include_order_items": true,
    "include_suggestions": true
  },
  "message": "Creé el template y la automación. El email se enviará 2 horas después de cada entrega."
}
```

4. GENERAR IMAGEN para un template:
```json
{
  "action": "generate_image",
  "image": {
    "prompt": "Descripción de la imagen",
    "style": "product_hero|banner|social"
  },
  "message": "Generando imagen..."
}
```

═══════════════════════════════════════════════════
PRESETS DE AUTOMACIÓN SUGERIDOS
═══════════════════════════════════════════════════

Cuando el usuario pida "armar todas las automaciones" o algo similar, sugiere este flujo:

1. Pedido Confirmado (confirmed, 0min) → "Tu pedido está confirmado 🎉" + items + tracking
2. En Preparación (preparing, 0min) → "Estamos preparando tu pedido 👨‍🍳"
3. En Camino (dispatched, 0min) → "Tu pedido va en camino 🚀" + tracking
4. Entregado (delivered, 0min) → "¡Buen provecho! 🍕" + reorder
5. Review (delivered, 120min) → "¿Qué tal tu experiencia? ⭐" + review_button + suggestions
6. Promo Recompra (delivered, 4320min/3días) → "Te extrañamos 💚" + product_grid bestsellers

REGLAS:
- Siempre genera bloques COMPLETOS y profesionales con buen diseño.
- Usa los colores del restaurante: verde (#22c55e), ámbar para reviews (#f59e0b).
- Para product_grid, usa los productos reales del contexto (bestsellers).
- Sé conciso, amigable, habla en español chileno casual.
- Si el usuario pide algo vago, genera un template completo sin preguntar.
- SIEMPRE responde con JSON action cuando el usuario pide crear algo.
"""


class ChatMessage(BaseModel):
    role: str
    content: str

class MarketingAIChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: Optional[dict] = None

class MarketingAIChatResponse(BaseModel):
    reply: str
    action: Optional[dict] = None


def _get_bestsellers_context(limit=8) -> str:
    """Get top selling products for AI context."""
    from datetime import timedelta
    cutoff = datetime.now() - timedelta(days=30)
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "status": "delivered"}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.codigo",
            "total_sold": {"$sum": "$items.quantity"},
            "nombre": {"$first": "$items.nombre"},
        }},
        {"$sort": {"total_sold": -1}},
        {"$limit": limit},
    ]
    top_items = list(DELIVERY_COLL.aggregate(pipeline))
    if not top_items:
        return ""

    # Enrich with images
    codigos = [i["_id"] for i in top_items if i["_id"]]
    menu_docs = {d["codigo"]: d for d in MENUS_COLL.find(
        {"codigo": {"$in": codigos}},
        {"codigo": 1, "nombre": 1, "precio": 1, "media_r2": 1}
    )}

    lines = []
    for item in top_items:
        menu = menu_docs.get(item["_id"], {})
        name = menu.get("nombre", item.get("nombre", item["_id"]))
        price = menu.get("precio", 0)
        image = menu.get("media_r2", "")
        sold = item["total_sold"]
        lines.append(f"  - {name} | ${price:,} | vendidos={sold} | img={image}")

    return "\n\nPRODUCTOS BESTSELLERS (últimos 30 días):\n" + "\n".join(lines)


@router.post("/mailing/ai/chat", response_model=MarketingAIChatResponse)
async def marketing_ai_chat(
    req: MarketingAIChatRequest,
    user: dict = Depends(verify_session),
):
    """Chat with Grok to configure marketing/mailing."""
    require_admin_level(user, "marketing")

    if not XAI_API_KEY:
        raise HTTPException(status_code=503, detail="XAI_API_KEY no configurada")

    # Build rich context
    context_str = ""

    # Existing templates
    if req.context:
        templates = req.context.get("templates", [])
        if templates:
            tpl_info = [f"- {t.get('name', '?')} (type={t.get('type')}, id={t.get('_id', '?')}, subject={t.get('subject', '')})" for t in templates[:20]]
            context_str += f"\n\nTEMPLATES EXISTENTES:\n" + "\n".join(tpl_info)

        automations = req.context.get("automations", [])
        if automations:
            auto_info = [f"- {a.get('name', '?')} (status={a.get('condition',{}).get('status')}, delay={a.get('delay_minutes',0)}min, active={a.get('active')})" for a in automations[:20]]
            context_str += f"\n\nAUTOMACIONES EXISTENTES:\n" + "\n".join(auto_info)

        # Order statuses (if provided)
        statuses = req.context.get("order_statuses", [])
        if statuses:
            status_info = [f"- {s.get('key')} → {s.get('label')}" for s in statuses]
            context_str += f"\n\nESTADOS DE PEDIDO CONFIGURADOS:\n" + "\n".join(status_info)

    # Add bestsellers
    try:
        context_str += _get_bestsellers_context()
    except Exception as e:
        logger.warning(f"[marketing_ai] Could not load bestsellers: {e}")

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
    except httpx.HTTPStatusError as e:
        logger.error(f"[marketing_ai] Grok error {e.response.status_code}: {e.response.text[:500]}")
        raise HTTPException(status_code=502, detail=f"Grok error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"[marketing_ai] Grok error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    reply = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip()
    logger.info(f"[marketing_ai] Reply: {reply[:200]}")

    # Parse JSON action from response
    action = _extract_action(reply)

    return MarketingAIChatResponse(reply=reply, action=action)


def _extract_action(reply: str) -> Optional[dict]:
    """Extract JSON action block from AI reply. Tries multiple parsing strategies."""
    if "```json" not in reply and "```" not in reply:
        # Try to find raw JSON object
        import re
        json_match = re.search(r'\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}', reply, re.DOTALL)
        if not json_match:
            # Try nested JSON with blocks
            json_match = re.search(r'\{[\s\S]*?"action"\s*:\s*"[^"]+?"[\s\S]*\}', reply, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except Exception:
                pass
        return None

    # Standard ```json ... ``` extraction
    try:
        if "```json" in reply:
            json_str = reply.split("```json")[1].split("```")[0].strip()
        else:
            # Try generic code block
            parts = reply.split("```")
            for i in range(1, len(parts), 2):
                candidate = parts[i].strip()
                if candidate.startswith("{"):
                    json_str = candidate
                    break
            else:
                return None
        return json.loads(json_str)
    except Exception as e:
        logger.warning(f"[marketing_ai] JSON parse failed: {e}")
        return None
