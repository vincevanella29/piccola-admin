from typing import Dict, Any
from .base_trigger import BaseTrigger

class OrderCancelledTrigger(BaseTrigger):
    id = "order_cancelled"
    label = "Pedido Cancelado"
    emoji = "❌"
    segment = "customers"
    
    available_variables = [
        {"name": "order_number", "desc": "Número de orden del cliente"},
        {"name": "customer_name", "desc": "Nombre del cliente"}
    ]
    
    mock_payload = {
        "order_number": "PI-77777",
        "customer_name": "Lucciano",
        "customer": {"name": "Lucciano", "email": "lucciano@vanellix.com"},
        "title_default": "Pedido Cancelado 😔",
        "body_default": "Hola {customer_name}, lamentamos informarte que tu pedido #{order_number} ha sido cancelado. Si tienes dudas, contáctanos en el chat.",
        "icon_url": "https://img.icons8.com/color/48/cancel--v1.png"
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Usually an explicit trigger dispatched when delivery or system cancels the order.
        """
        return True
