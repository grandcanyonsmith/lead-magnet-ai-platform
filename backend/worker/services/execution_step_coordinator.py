"""
Execution Step Coordinator Service
Handles coordination of execution step creation and management.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from core.db_service import DynamoDBService
from core.s3_service import S3Service
from services.execution_step_manager import ExecutionStepManager
from utils.step_utils import normalize_step_order

logger = logging.getLogger(__name__)


class ExecutionStepCoordinator:
    """Service for coordinating execution step management."""
    
    def __init__(
        self,
        db_service: DynamoDBService,
        s3_service: S3Service
    ):
        """
        Initialize execution step coordinator.
        
        Args:
            db_service: DynamoDB service instance
            s3_service: S3 service instance
        """
        self.db = db_service
        self.s3 = s3_service
    
    def create_and_add_step(
        self,
        step_name: str,
        step_index: int,
        step_model: str,
        request_details: Dict[str, Any],
        response_details: Dict[str, Any],
        usage_info: Dict[str, Any],
        step_start_time: datetime,
        step_duration: float,
        step_artifact_id: Optional[str],
        execution_steps: List[Dict[str, Any]],
        step_type: str = 'ai_generation'
    ) -> None:
        """
        Create execution step and update execution_steps list with rerun support.
        
        Args:
            step_name: Name of the step
            step_index: Step index (0-based)
            step_model: Model used for the step
            request_details: Request details dictionary
            response_details: Response details dictionary
            usage_info: Usage information dictionary
            step_start_time: Start time of the step
            step_duration: Duration of the step in milliseconds
            step_artifact_id: Artifact ID (if any)
            execution_steps: List of execution steps (modified in place)
            step_type: Type of step ('ai_generation' or 'webhook')
        """
        step_data = ExecutionStepManager.create_ai_generation_step(
            step_name=step_name,
            step_order=step_index + 1,
            step_model=step_model,
            request_details=request_details,
            response_details=response_details,
            usage_info=usage_info,
            step_start_time=step_start_time,
            step_duration=step_duration,
            artifact_id=step_artifact_id
        )
        
        self.update_execution_steps(
            execution_steps=execution_steps,
            step_data=step_data,
            step_order=step_index + 1,
            step_type=step_type
        )
    
    def update_execution_steps(
        self,
        execution_steps: List[Dict[str, Any]],
        step_data: Dict[str, Any],
        step_order: int,
        step_type: str
    ) -> None:
        """
        Update execution_steps list, replacing existing step if present (for reruns).
        
        Args:
            execution_steps: List of execution steps (modified in place)
            step_data: New step data to add or replace
            step_order: Step order number
            step_type: Type of step ('webhook' or 'ai_generation')
        """
        existing_step_index = None
        for i, existing_step in enumerate(execution_steps):
            if existing_step.get('step_order') == step_order and existing_step.get('step_type') == step_type:
                existing_step_index = i
                break
        
        if existing_step_index is not None:
            logger.info(f"[ExecutionStepCoordinator] Replacing existing {step_type} execution step for step_order {step_order} (rerun)")
            execution_steps[existing_step_index] = step_data
        else:
            execution_steps.append(step_data)
    
    def reload_execution_steps(
        self,
        job_id: str,
        execution_steps: List[Dict[str, Any]],
        step_index: int
    ) -> List[Dict[str, Any]]:
        """
        Reload execution_steps from database/S3 to ensure we have the latest data.
        This is important when steps are processed in separate Lambda invocations.
        
        Args:
            job_id: Job ID
            execution_steps: Current execution steps list
            step_index: Step index for logging
            
        Returns:
            Updated execution_steps list (from DB if available, otherwise original)
        """
        try:
            job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
            if job_with_steps and job_with_steps.get('execution_steps'):
                execution_steps = job_with_steps['execution_steps']
                logger.debug(f"[ExecutionStepCoordinator] Reloaded execution_steps from database", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'execution_steps_count': len(execution_steps)
                })
        except Exception as e:
            logger.warning(f"[ExecutionStepCoordinator] Failed to reload execution_steps, using provided list", extra={
                'job_id': job_id,
                'step_index': step_index,
                'error': str(e)
            })
        return execution_steps
    
    def build_step_outputs(
        self,
        execution_steps: List[Dict[str, Any]],
        steps: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Build step_outputs list from execution_steps for single mode processing.
        
        Args:
            execution_steps: List of execution steps
            steps: List of all workflow steps
            
        Returns:
            List of step output dictionaries
        """
        step_outputs = []
        sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
        for i, exec_step in enumerate(execution_steps):
            if exec_step.get('step_type') == 'ai_generation' and exec_step.get('step_order', 0) > 0:
                step_outputs.append({
                    'step_name': exec_step.get('step_name', f'Step {i}'),
                    'output': exec_step.get('output', ''),
                    'artifact_id': exec_step.get('artifact_id'),
                    'image_urls': exec_step.get('image_urls', [])
                })
        return step_outputs

