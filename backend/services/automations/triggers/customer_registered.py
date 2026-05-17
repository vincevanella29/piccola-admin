from typing import Dict, Any
from .base_trigger import BaseTrigger

class CustomerRegisteredTrigger(BaseTrigger):
    id = "customer_registered"
    label = "Nuevo Cliente (Registro)"
    emoji = "👋"
    segment = "customers"
    
    available_variables = [
        {"name": "customer_name", "desc": "Nombre del nuevo cliente"},
        {"name": "customer_email", "desc": "Email del nuevo cliente"}
    ]
    
    mock_payload = {
        "customer_name": "Lucciano Vanella",
        "customer_email": "lucciano@vanellix.com",
        "customer": {"name": "Lucciano Vanella", "email": "lucciano@vanellix.com"}
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Usually triggers immediately upon registration without conditions.
        """
        return True
