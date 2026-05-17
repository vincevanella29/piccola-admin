from typing import Dict, Any
from .base_trigger import BaseTrigger

class OrderStatusChangeTrigger(BaseTrigger):
    id = "order_status_change"
    label = "Cambio de Estado de Pedido"
    emoji = "📦"
    segment = "customers"
    
    available_variables = [
        {"name": "order_number", "desc": "Número de orden del cliente"},
        {"name": "status", "desc": "El nuevo estado del pedido (ej: dispatched)"},
        {"name": "customer_name", "desc": "Nombre del cliente"}
    ]
    
    mock_payload = {
        "order_number": "PI-54321",
        "status": "dispatched",
        "customer_name": "Lucciano",
        "customer": {"name": "Lucciano", "email": "lucciano@vanellix.com"},
        "title_default": "Actualización de tu pedido 🚚",
        "body_default": "Hola {customer_name}, tu pedido #{order_number} cambió de estado a '{status}'. Sigue su progreso en la app.",
        "icon_url": "https://img.icons8.com/color/48/in-transit--v1.png"
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        For order status changes, we must check if the status configured in the rule
        matches the actual status in the payload.
        """
        condition = rule.get("condition")
        if condition:
            req_status = condition.get("status")
            # If the rule has a specific status requirement, it must match
            if req_status and payload.get("status") != req_status:
                return False
        return True

    @classmethod
    def get_default_payload(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        status = payload.get("status", "")
        order_type = payload.get("order_type", "delivery")
        order_number = payload.get("order_number", "")
        
        icon = "https://img.icons8.com/color/48/in-transit--v1.png"
        if status == "confirmed":
            title = "Pedido Confirmado ✅"
            body = "Hola {customer_name}, hemos recibido y confirmado tu pedido #{order_number}."
            icon = "https://img.icons8.com/color/48/ok--v1.png"
        elif status == "preparing":
            title = "En Preparación 👨‍🍳"
            body = "¡Manos a la masa! Tu pedido #{order_number} se está preparando."
            icon = "https://img.icons8.com/color/48/cook-male--v1.png"
        elif status == "ready":
            if order_type == "pickup":
                title = "¡Listo para retirar! 🛍️"
                body = "Tu pedido #{order_number} ya está listo. ¡Te esperamos en el local!"
                icon = "https://img.icons8.com/color/48/shopping-bag--v1.png"
            else:
                title = "¡Listo para despacho! 🛵"
                body = "Tu pedido #{order_number} está listo y esperando a su repartidor."
                icon = "https://img.icons8.com/color/48/motorcycle--v1.png"
        elif status == "dispatched":
            title = "¡Pedido en camino! 🚚"
            body = "Tu pedido #{order_number} ya va en camino hacia tu dirección."
            icon = "https://img.icons8.com/color/48/in-transit--v1.png"
        else:
            title = "Actualización de pedido 📦"
            body = "El estado de tu pedido #{order_number} es: " + status
            
        return {
            "title_default": title,
            "body_default": body,
            "icon_url": icon,
            "image_url": ""
        }
