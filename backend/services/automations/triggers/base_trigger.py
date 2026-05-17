from typing import Dict, Any

class BaseTrigger:
    """
    Base class for all automation triggers.
    Every trigger plugin must inherit from this class and override
    its metadata and evaluate() method.
    """
    id: str = "base"
    label: str = "Base Trigger"
    emoji: str = "⚙️"
    segment: str = "customers" # "customers" or "employees"
    
    # Metadata for frontend preview
    available_variables: list[dict] = []
    mock_payload: dict = {}

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """
        Determines if the rule should be executed based on the event payload.
        :param rule: The automation rule defined in the admin panel.
        :param payload: The actual event payload emitted by the system.
        :return: True if the action should trigger, False otherwise.
        """
        return True

    @classmethod
    def get_default_payload(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns the default notification data (title, body, icon) for the 'original' template mode.
        Can be overridden by subclasses to provide dynamic content based on payload.
        """
        return {
            "title_default": cls.mock_payload.get("title_default", "Nueva Notificación"),
            "body_default": cls.mock_payload.get("body_default", ""),
            "icon_url": cls.mock_payload.get("icon_url", ""),
            "image_url": cls.mock_payload.get("image_url", ""),
        }
