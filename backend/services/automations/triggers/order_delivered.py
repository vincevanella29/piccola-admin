from typing import Dict, Any
from .base_trigger import BaseTrigger

class OrderDeliveredTrigger(BaseTrigger):
    id = "order_delivered"
    label = "Pedido Entregado"
    emoji = "✅"
    segment = "customers"
    
    available_variables = [
        {"name": "order_number", "desc": "Número de orden del cliente"},
        {"name": "customer_name", "desc": "Nombre del cliente"}
    ]
    
    mock_payload = {
        "order_number": "PI-89012",
        "customer_name": "Lucciano",
        "customer": {"name": "Lucciano", "email": "lucciano@vanellix.com"},
        "title_default": "¡Tu pedido ha llegado! 🎉",
        "body_default": "Hola {customer_name}, tu pedido #{order_number} acaba de ser entregado. ¡Que lo disfrutes mucho! Déjanos tu reseña en la app.",
        "icon_url": "https://img.icons8.com/color/48/checked--v1.png"
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Usually an explicit trigger dispatched when delivery confirms delivery.
        """
        return True
