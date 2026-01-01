import logging
from typing import Dict, Any, List, Tuple
from datetime import datetime
from services.steps.base import AbstractStepHandler
from services.execution_step_manager import ExecutionStepManager
from services.webhook_step_service import WebhookStepService
from core import log_context

logger = logging.getLogger(__name__)

class WebhookStepHandler(AbstractStepHandler):
    """Handler for Webhook steps."""
    
    def __init__(self, services: Dict[str, Any]):
        super().__init__(services)
        self.webhook_step_service = WebhookStepService(
            db_service=services['db_service'],
            s3_service=services['s3_service']
        )

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
        
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_start_time = datetime.utcnow()
        
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type='webhook',
            webhook_url=step.get('webhook_url')
        ):
            # Get job and submission data
            job = self.services['db_service'].get_job(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
                
            submission_id = job.get('submission_id')
            submission = None
            if submission_id:
                submission = self.services['db_service'].get_submission(submission_id)
            if not submission:
                submission = {'submission_data': {}}

            # Execute webhook
            # Need to get sorted_steps from services or context if available, otherwise reconstruct
            # For simplicity assuming passed context implies we can proceed.
            # In new architecture, we might need to pass full workflow steps. 
            # For now, we will use an empty list for sorted_steps as it's primarily used for context building in webhook service
            # which might be acceptable if we pass the fully resolved context.
            
            # TODO: Improve sorted_steps availability. For now using empty list as fallback.
            sorted_steps = [] 
            
            webhook_result, success = self.webhook_step_service.execute_webhook_step(
                step=step,
                step_index=step_index,
                job_id=job_id,
                job=job,
                submission=submission,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps 
            )
            
            # Create execution step record
            request_details = self.webhook_step_service.build_request_details(
                step=step,
                job_id=job_id,
                job=job,
                submission=submission,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                step_index=step_index,
            )
            
            step_data = ExecutionStepManager.create_webhook_step(
                step_name=step_name,
                step_order=step_index + 1,
                request=request_details,
                response_status=webhook_result.get('response_status'),
                response_body=webhook_result.get('response_body'),
                success=success,
                error=webhook_result.get('error'),
                step_start_time=step_start_time,
                duration_ms=webhook_result.get('duration_ms', 0)
            )
            
            execution_steps.append(step_data)
            self.services['db_service'].update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.services['s3_service'])
            
            result = {
                'step_name': step_name,
                'step_index': step_index,
                'output': f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
                'artifact_id': None,
                'image_urls': [],
                'image_artifact_ids': [], # Webhooks don't produce image artifacts
                'webhook_result': webhook_result,
                'duration_ms': webhook_result.get('duration_ms', 0),
                'success': success
            }
            
            return result, []
