import logging
from typing import Dict, Type, Optional
from services.steps.base import AbstractStepHandler

logger = logging.getLogger(__name__)

class StepRegistry:
    """
    Registry for workflow step handlers.
    Maps step_type strings to their corresponding handler classes.
    """
    
    def __init__(self):
        self._handlers: Dict[str, Type[AbstractStepHandler]] = {}
        
    def register(self, step_type: str, handler_class: Type[AbstractStepHandler]):
        """Register a handler class for a specific step type."""
        logger.debug(f"Registering handler for step type: {step_type}")
        self._handlers[step_type] = handler_class
        
    def get_handler(self, step_type: str) -> Optional[Type[AbstractStepHandler]]:
        """Get the handler class for a step type."""
        return self._handlers.get(step_type)
        
    def get_all_types(self) -> List[str]:
        """Get all registered step types."""
        return list(self._handlers.keys())
