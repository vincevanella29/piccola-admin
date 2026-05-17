from typing import Dict, Any
from .base_trigger import BaseTrigger

class EmployeeRegisteredTrigger(BaseTrigger):
    id = "employee_registered"
    label = "Nuevo Empleado (Registro)"
    emoji = "🤝"
    segment = "employees"
    
    available_variables = [
        {"name": "employee_name", "desc": "Nombre del empleado"},
        {"name": "role", "desc": "Rol o cargo del empleado"}
    ]
    
    mock_payload = {
        "employee_name": "Lucciano Vanella",
        "role": "Garzón",
        "employee": {"name": "Lucciano Vanella", "role": "Garzón"}
    }

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Usually triggers when a new employee signs up in the system.
        """
        return True
