import os
import importlib
import inspect
from typing import Dict, Type
from .base_trigger import BaseTrigger

# Automatically discover and register all triggers in this directory
TRIGGERS: Dict[str, Type[BaseTrigger]] = {}

def get_trigger(trigger_id: str) -> Type[BaseTrigger]:
    """Retrieve a trigger plugin class by its ID."""
    return TRIGGERS.get(trigger_id)

def _discover_plugins():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    for filename in os.listdir(current_dir):
        if filename.endswith(".py") and filename not in ("__init__.py", "base_trigger.py"):
            module_name = f"services.automations.triggers.{filename[:-3]}"
            try:
                module = importlib.import_module(module_name)
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    # Check if it is a subclass of BaseTrigger and not BaseTrigger itself
                    if issubclass(obj, BaseTrigger) and obj is not BaseTrigger:
                        TRIGGERS[obj.id] = obj
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to load trigger plugin {filename}: {e}")

# Initialize registry on import
_discover_plugins()
