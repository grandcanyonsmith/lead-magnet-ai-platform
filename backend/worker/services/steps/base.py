from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple

class AbstractStepHandler(ABC):
    """
    Abstract base class for all workflow step handlers.
    Each step type (ai_generation, browser_automation, etc.) should implement this interface.
    """
    
    def __init__(self, services: Dict[str, Any]):
        """
        Initialize the handler with required services.
        
        Args:
            services: Dictionary containing injected services (ai_service, db_service, etc.)
        """
        self.services = services

    @abstractmethod
    def execute(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        context: str,
        step_outputs: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Execute the step logic.
        
        Args:
            step: The step configuration dictionary
            step_index: Index of the current step
            job_id: The job ID
            tenant_id: The tenant ID
            context: Accumulated context string
            step_outputs: List of outputs from previous steps
            execution_steps: List of execution step records (for updating status)
            
        Returns:
            Tuple containing:
            - step_output_dict: Result dictionary (output, step_name, etc.)
            - image_artifact_ids: List of generated image artifact IDs
        """
        pass
