"""
Lambda Router Service
Handles routing logic for Lambda handler events.
"""

import logging
from typing import Dict, Any

from processor import JobProcessor
from core.db_service import DynamoDBService
from core.s3_service import S3Service

logger = logging.getLogger(__name__)


class LambdaRouter:
    """Service for routing Lambda events to appropriate processors."""
    
    def __init__(self, processor: JobProcessor):
        """
        Initialize lambda router.
        
        Args:
            processor: Job processor instance
        """
        self.processor = processor
    
    def route(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route event to appropriate processing method.
        
        Args:
            event: Lambda event dictionary containing:
                - job_id: Required - The job ID to process
                - action: Optional - 'resolve_dependencies' to resolve dependencies
                - step_index: Optional - Index of step to process (for per-step mode)
                - step_type: Optional - Type of step ('workflow_step' or 'html_generation')
                
        Returns:
            Dictionary with success status and result
        """
        job_id = event.get('job_id')
        if not job_id:
            logger.error("[LambdaRouter] job_id not provided in event", extra={'event_keys': list(event.keys())})
            return {
                'success': False,
                'error': 'job_id not provided in event',
                'error_type': 'ValueError'
            }
        
        action = event.get('action')
        step_index = event.get('step_index')
        step_type = event.get('step_type', 'workflow_step')
        
        # Route to appropriate handler
        if action == 'resolve_dependencies':
            return self._handle_dependency_resolution(event, job_id)
        elif step_index is not None or step_type == 'html_generation':
            return self._handle_step_processing(job_id, step_index, step_type)
        else:
            return self._handle_full_job_processing(job_id)
    
    def _handle_dependency_resolution(self, event: Dict[str, Any], job_id: str) -> Dict[str, Any]:
        """
        Handle dependency resolution action.
        
        Args:
            event: Lambda event
            job_id: Job ID
            
        Returns:
            Dictionary with execution plan
        """
        workflow_id = event.get('workflow_id')
        if not workflow_id:
            raise ValueError('workflow_id is required for dependency resolution')
        
        logger.info(f"Resolving dependencies for workflow {workflow_id}")
        
        db_service = DynamoDBService()
        workflow = db_service.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        steps = workflow.get('steps', [])
        if not steps:
            raise ValueError(f"Workflow {workflow_id} has no steps")
        
        execution_plan = self.processor.resolve_step_dependencies(steps)
        
        # Store execution plan in job
        from datetime import datetime
        s3_service = S3Service()
        db_service.update_job(job_id, {
            'execution_plan': execution_plan,
            'updated_at': datetime.utcnow().isoformat()
        }, s3_service=s3_service)
        
        logger.info(f"Dependencies resolved for workflow {workflow_id}", extra={
            'execution_groups': len(execution_plan.get('executionGroups', [])),
            'total_steps': execution_plan.get('totalSteps', 0)
        })
        
        return {
            'success': True,
            'execution_plan': execution_plan
        }
    
    def _handle_step_processing(self, job_id: str, step_index: int, step_type: str) -> Dict[str, Any]:
        """
        Handle per-step processing.
        
        Args:
            job_id: Job ID
            step_index: Step index (may be None for HTML generation)
            step_type: Step type
            
        Returns:
            Dictionary with step processing result
        """
        if step_type == 'html_generation':
            logger.info(f"Processing HTML generation step for job {job_id}")
            result = self.processor.process_single_step(job_id, -1, step_type)
        else:
            logger.info(f"Processing single step {step_index} for job {job_id}")
            result = self.processor.process_single_step(job_id, step_index, step_type)
        
        return result
    
    def _handle_full_job_processing(self, job_id: str) -> Dict[str, Any]:
        """
        Handle full job processing (legacy mode).
        
        Args:
            job_id: Job ID
            
        Returns:
            Dictionary with job processing result
        """
        logger.info(f"Processing full job {job_id} (legacy mode)")
        return self.processor.process_job(job_id)

