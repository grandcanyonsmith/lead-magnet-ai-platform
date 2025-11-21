"""
Webhook Step Service
Handles execution of webhook steps in workflows.
"""

import logging
import json
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


class WebhookStepService:
    """Service for executing webhook steps."""
    
    def __init__(self):
        """Initialize webhook step service."""
        pass
    
    def execute_webhook_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        job: Dict[str, Any],
        submission: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Execute a webhook step by sending POST request with selected data.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            job: Job dictionary
            submission: Submission dictionary
            step_outputs: List of previous step outputs
            sorted_steps: List of all steps sorted by order
            
        Returns:
            Tuple of (result_dict, success)
            result_dict contains:
                - webhook_url: URL called
                - payload: Payload sent
                - response_status: HTTP status code
                - response_body: Response body (truncated if too long)
                - success: Whether request succeeded
                - error: Error message if failed
        """
        webhook_url = step.get('webhook_url')
        if not webhook_url:
            error_msg = f"Webhook step {step_index} has no webhook_url configured"
            logger.error(f"[WebhookStepService] {error_msg}")
            return {
                'webhook_url': None,
                'payload': None,
                'response_status': None,
                'response_body': None,
                'success': False,
                'error': error_msg
            }, False
        
        webhook_headers = step.get('webhook_headers', {})
        data_selection = step.get('webhook_data_selection', {})
        custom_payload = step.get('webhook_custom_payload')
        
        # Use custom payload if provided, otherwise build payload based on data selection
        if custom_payload:
            payload = custom_payload
        else:
            payload = self._build_webhook_payload(
                job_id=job_id,
                job=job,
                submission=submission,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                step_index=step_index,
                data_selection=data_selection
            )
        
        # Prepare headers
        headers = {
            'Content-Type': 'application/json',
            **webhook_headers
        }
        
        logger.info(f"[WebhookStepService] Executing webhook step {step_index}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'webhook_url': webhook_url,
            'payload_keys': list(payload.keys()) if payload else [],
            'headers_count': len(headers)
        })
        
        step_start_time = datetime.utcnow()
        
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
            
            # Get response body (truncate if too long)
            response_body = None
            try:
                response_body = response.text
                if len(response_body) > 10000:  # Truncate if too long
                    response_body = response_body[:10000] + "... (truncated)"
            except Exception:
                pass
            
            response.raise_for_status()
            
            logger.info(f"[WebhookStepService] Webhook step executed successfully", extra={
                'job_id': job_id,
                'step_index': step_index,
                'webhook_url': webhook_url,
                'status_code': response.status_code,
                'duration_ms': step_duration
            })
            
            return {
                'webhook_url': webhook_url,
                'payload': payload,
                'response_status': response.status_code,
                'response_body': response_body,
                'success': True,
                'error': None,
                'duration_ms': int(step_duration)
            }, True
            
        except requests.exceptions.RequestException as e:
            step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
            error_msg = str(e)
            
            # Try to get response status if available
            response_status = None
            response_body = None
            if hasattr(e, 'response') and e.response is not None:
                response_status = e.response.status_code
                try:
                    response_body = e.response.text
                    if len(response_body) > 10000:
                        response_body = response_body[:10000] + "... (truncated)"
                except Exception:
                    pass
            
            logger.error(f"[WebhookStepService] Webhook step failed", extra={
                'job_id': job_id,
                'step_index': step_index,
                'webhook_url': webhook_url,
                'error_type': type(e).__name__,
                'error_message': error_msg,
                'response_status': response_status,
                'duration_ms': step_duration
            }, exc_info=True)
            
            return {
                'webhook_url': webhook_url,
                'payload': payload,
                'response_status': response_status,
                'response_body': response_body,
                'success': False,
                'error': error_msg,
                'duration_ms': int(step_duration)
            }, False
    
    def _build_webhook_payload(
        self,
        job_id: str,
        job: Dict[str, Any],
        submission: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        step_index: int,
        data_selection: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build webhook payload from selected data.
        
        Args:
            job_id: Job ID
            job: Job dictionary
            submission: Submission dictionary
            step_outputs: List of previous step outputs
            sorted_steps: List of all steps sorted by order
            step_index: Current step index
            data_selection: Data selection configuration
            
        Returns:
            Payload dictionary with nested structure
        """
        payload = {}
        
        # Include submission data if selected (default: true)
        include_submission = data_selection.get('include_submission', True)
        if include_submission:
            submission_data = submission.get('submission_data', {})
            payload['submission_data'] = submission_data
        
        # Include step outputs (all by default, exclude specified indices)
        exclude_step_indices = set(data_selection.get('exclude_step_indices', []))
        step_outputs_dict = {}
        
        for i, step_output in enumerate(step_outputs):
            if i not in exclude_step_indices and i < step_index:  # Only include previous steps
                step_name = sorted_steps[i].get('step_name', f'Step {i}') if i < len(sorted_steps) else f'Step {i}'
                step_outputs_dict[f'step_{i}'] = {
                    'step_name': step_name,
                    'step_index': i,
                    'output': step_output.get('output', ''),
                    'artifact_id': step_output.get('artifact_id'),
                    'image_urls': step_output.get('image_urls', [])
                }
        
        if step_outputs_dict:
            payload['step_outputs'] = step_outputs_dict
        
        # Include job info if selected (default: true)
        include_job_info = data_selection.get('include_job_info', True)
        if include_job_info:
            payload['job_info'] = {
                'job_id': job_id,
                'workflow_id': job.get('workflow_id'),
                'status': job.get('status'),
                'created_at': job.get('created_at'),
                'updated_at': job.get('updated_at')
            }
        
        return payload

