from typing import Dict, Any
from .base_trigger import BaseTrigger

class DeliveryChatMessageTrigger(BaseTrigger):
    id = "delivery_chat_message"
    label = "Nuevo Mensaje en Chat"
    emoji = "💬"
    segment = "customers"
    
    available_variables = [
        {"name": "title_default", "desc": "Título predeterminado (ej: Nuevo mensaje de La Piccola Italia)"},
        {"name": "body_default", "desc": "Cuerpo predeterminado (el texto del mensaje)"},
        {"name": "order_number", "desc": "Número de orden del cliente"},
        {"name": "sender_name", "desc": "Nombre del remitente"},
        {"name": "message", "desc": "Texto exacto del mensaje (WhatsApp style)"}
    ]
    
    mock_payload = {
        "title_default": "Nuevo mensaje de La Piccola Italia",
        "body_default": "¡Hola! Tu pedido PI-12345 acaba de salir de nuestra cocina y va en camino 🚀",
        "order_number": "PI-12345",
        "sender_name": "La Piccola Italia",
        "message": "¡Hola! Tu pedido PI-12345 acaba de salir de nuestra cocina y va en camino 🚀",
        "customer": {"name": "Lucciano", "email": "lucciano@vanellix.com"}
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Triggers when a delivery chat message is sent to the customer by an Admin or Bot.
        
        The payload will contain:
        - order_number: str
        - sender_name: str
        - message: str
        - email/wallet/privy_id: customer identifiers
        """
        sender_name = payload.get("sender_name", "")
        if not sender_name or str(sender_name).strip() == "" or sender_name == "Local":
            sender_name = "La Piccola Italia"
            
        payload["sender_name"] = sender_name
        payload["title_default"] = f"Nuevo mensaje de {sender_name}"
        
        msg_text = payload.get("message", "")
        if len(msg_text) > 100:
            msg_text = msg_text[:97] + "..."
            
        payload["body_default"] = msg_text
        
        return True

    @classmethod
    def get_default_payload(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Override to provide dynamic text instead of the static mock_payload."""
        return {
            "title_default": payload.get("title_default", cls.mock_payload["title_default"]),
            "body_default": payload.get("body_default", cls.mock_payload["body_default"]),
            "icon_url": cls.mock_payload.get("icon_url", ""),
            "image_url": cls.mock_payload.get("image_url", ""),
        }
