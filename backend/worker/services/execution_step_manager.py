"""
Execution Step Manager Service
Handles creation and management of execution steps for workflow processing.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from utils.decimal_utils import convert_floats_to_decimal

logger = logging.getLogger(__name__)


class ExecutionStepManager:
    """Manages execution step creation and storage."""
    
    @staticmethod
    def create_form_submission_step(submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create execution step for form submission.
        
        Args:
            submission_data: Form submission data
            
        Returns:
            Execution step dictionary
        """
        return {
            'step_name': 'Form Submission',
            'step_order': 0,
            'step_type': 'form_submission',
            'input': submission_data,
            'output': submission_data,
            'timestamp': datetime.utcnow().isoformat(),
            'duration_ms': 0,
        }
    
    @staticmethod
    def create_ai_generation_step(
        step_name: str,
        step_order: int,
        step_model: str,
        request_details: Dict[str, Any],
        response_details: Dict[str, Any],
        usage_info: Dict[str, Any],
        step_start_time: datetime,
        step_duration: float,
        artifact_id: str
    ) -> Dict[str, Any]:
        """
        Create execution step for AI generation.
        
        Args:
            step_name: Name of the step
            step_order: Order of the step (1-indexed)
            step_model: Model used
            request_details: Request details dictionary
            response_details: Response details dictionary
            usage_info: Usage information dictionary
            step_start_time: Start time of the step
            step_duration: Duration in milliseconds
            artifact_id: Artifact ID for the step output
            
        Returns:
            Execution step dictionary
        """
        image_urls = response_details.get('image_urls', [])
        
        # Store response_details for debugging (but limit size to avoid S3 issues)
        # Include key fields that help debug image extraction
        debug_response_details = {
            'image_urls': image_urls,
            'image_urls_count': len(image_urls),
            'output_text_length': len(response_details.get('output_text', '')),
            'has_output_text': bool(response_details.get('output_text')),
            # Store a summary of what was in response_details for debugging
            'response_keys': list(response_details.keys()) if isinstance(response_details, dict) else [],
        }
        
        return {
            'step_name': step_name,
            'step_order': step_order,
            'step_type': 'ai_generation',
            'success': True,
            'model': step_model,
            'input': request_details,
            'output': response_details.get('output_text', ''),
            'image_urls': image_urls,
            'response_details': debug_response_details,  # Add for debugging
            'usage_info': convert_floats_to_decimal(usage_info),
            'timestamp': step_start_time.isoformat(),
            'duration_ms': int(step_duration),
            'artifact_id': artifact_id,
        }
    
    @staticmethod
    def create_failed_ai_generation_step(
        step_name: str,
        step_order: int,
        step_model: str,
        error_message: str,
        step_start_time: datetime,
        duration_ms: float
    ) -> Dict[str, Any]:
        """
        Create execution step for failed AI generation while keeping the workflow progressing.
        """
        return {
            'step_name': step_name,
            'step_order': step_order,
            'step_type': 'ai_generation',
            'success': False,
            'model': step_model,
            'input': {},
            'output': error_message,
            'image_urls': [],
            'response_details': {'error': error_message},
            'usage_info': {},
            'timestamp': step_start_time.isoformat(),
            'duration_ms': int(duration_ms),
            'artifact_id': None,
        }
    
    @staticmethod
    def create_html_generation_step(
        model: str,
        html_request_details: Dict[str, Any],
        html_response_details: Dict[str, Any],
        html_usage_info: Dict[str, Any],
        html_start_time: datetime,
        html_duration: float,
        step_order: int
    ) -> Dict[str, Any]:
        """
        Create execution step for HTML generation.
        
        Note: Execution steps are ALWAYS stored in S3 (never in DynamoDB) to ensure
        complete data storage without size limitations. The full HTML output is stored
        without truncation. The db_service.update_job() method automatically stores
        all execution steps in S3.
        
        Args:
            model: Model used for HTML generation
            html_request_details: Request details dictionary
            html_response_details: Response details dictionary (contains full HTML output)
            html_usage_info: Usage information dictionary
            html_start_time: Start time of HTML generation
            html_duration: Duration in milliseconds
            step_order: Order of the step
            
        Returns:
            Execution step dictionary with full HTML output (no truncation)
        """
        return {
            'step_name': 'HTML Generation',
            'step_order': step_order,
            'step_type': 'html_generation',
            'model': model,
            'input': html_request_details,
            'output': html_response_details.get('output_text', ''),  # Full output - always stored in S3
            'usage_info': convert_floats_to_decimal(html_usage_info),
            'timestamp': html_start_time.isoformat(),
            'duration_ms': int(html_duration),
        }
    
    @staticmethod
    def create_final_output_step(
        final_artifact_type: str,
        final_filename: str,
        final_artifact_id: str,
        public_url: str,
        step_order: int
    ) -> Dict[str, Any]:
        """
        Create execution step for final output.
        
        Args:
            final_artifact_type: Type of final artifact
            final_filename: Filename of final artifact
            final_artifact_id: Artifact ID
            public_url: Public URL of artifact
            step_order: Order of the step
            
        Returns:
            Execution step dictionary
        """
        return {
            'step_name': 'Final Output',
            'step_order': step_order,
            'step_type': 'final_output',
            'input': {'artifact_type': final_artifact_type, 'filename': final_filename},
            'output': {'artifact_id': final_artifact_id, 'public_url': public_url},
            'timestamp': datetime.utcnow().isoformat(),
            'duration_ms': 0,
            'artifact_id': final_artifact_id,
        }
    
    @staticmethod
    def create_webhook_step(
        step_name: str,
        step_order: int,
        request: Dict[str, Any],
        response_status: Optional[int],
        response_body: Optional[str],
        success: bool,
        error: Optional[str],
        step_start_time: datetime,
        duration_ms: int
    ) -> Dict[str, Any]:
        """
        Create execution step for webhook step.
        
        Args:
            step_name: Name of the step
            step_order: Order of the step (1-indexed)
            request: Request details that were sent (may include payload or body)
            response_status: HTTP response status code
            response_body: Response body (may be truncated)
            success: Whether the webhook call succeeded
            error: Error message if failed
            step_start_time: Start time of the step
            duration_ms: Duration in milliseconds
            
        Returns:
            Execution step dictionary
        """
        return {
            'step_name': step_name,
            'step_order': step_order,
            'step_type': 'webhook',
            'input': request,
            'output': {
                'response_status': response_status,
                'response_body': response_body,
                'success': success,
                'error': error
            },
            'timestamp': step_start_time.isoformat(),
            'duration_ms': duration_ms,
        }

