from typing import Dict, Any
from .base_trigger import BaseTrigger

class CommunityAnnouncementTrigger(BaseTrigger):
    id = "community_announcement"
    label = "Anuncio de Comunidad (@all)"
    emoji = "📢"
    segment = "employees"
    
    available_variables = [
        {"name": "title_default", "desc": "Título del anuncio (ej: Anuncio en General)"},
        {"name": "body_default", "desc": "Cuerpo del anuncio (remitente y mensaje)"},
        {"name": "sender_name", "desc": "Nombre de quien envía el mensaje"},
        {"name": "channel_name", "desc": "Canal donde se envió el anuncio"},
        {"name": "message", "desc": "Texto del mensaje"}
    ]
    
    mock_payload = {
        "title_default": "Anuncio en General",
        "body_default": "Lucciano: ¡Chicos, recuerden que hoy lanzamos el nuevo menú!",
        "sender_name": "Lucciano",
        "channel_name": "General",
        "message": "¡Chicos, recuerden que hoy lanzamos el nuevo menú!"
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Triggers when a message is sent to a community channel with @all tag.
        
        The payload will contain:
        - message: str
        - channel_name: str
        - sender_name: str
        """
        # Ensure that variables needed for templates are available.
        payload["title_default"] = f"Anuncio en {payload.get('channel_name', 'Comunidad')}"
        
        # We limit the message to 150 chars for the push notification body
        msg_text = payload.get("message", "")
        if len(msg_text) > 150:
            msg_text = msg_text[:147] + "..."
            
        payload["body_default"] = f"{payload.get('sender_name', 'Admin')}: {msg_text}"
        
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
