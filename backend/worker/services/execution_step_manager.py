"""Execution step manager for creating step records."""

import logging
from typing import Dict, Any, List, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)


class ExecutionStepManager:
    """Manages creation of execution step records."""
    
    @staticmethod
    def create_form_submission_step(submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a form submission execution step (step 0).
        
        Args:
            submission_data: Form submission data
            
        Returns:
            Execution step dictionary
        """
        return {
            'step_type': 'form_submission',
            'step_order': Decimal('0'),
            'step_name': 'Form Submission',
            'input': submission_data,
            'output': None,
            'status': 'completed'
        }
    
    @staticmethod
    def create_ai_generation_step(
        step_name: str,
        step_order: int,
        step_model: str,
        request_details: Dict[str, Any],
        response_details: Dict[str, Any],
        usage_info: Dict[str, Any],
        step_start_time: Any,
        step_duration: float,
        artifact_id: str
    ) -> Dict[str, Any]:
        """
        Create an AI generation execution step.
        
        Args:
            step_name: Name of the step
            step_order: Order in workflow (1-indexed)
            step_model: AI model used
            request_details: Details of the API request
            response_details: Details of the API response
            usage_info: Token usage and cost information
            step_start_time: When the step started
            step_duration: Duration in milliseconds
            artifact_id: ID of the stored artifact
            
        Returns:
            Execution step dictionary
        """
        step_data = {
            'step_type': 'ai_generation',
            'step_order': Decimal(str(step_order)),
            'step_name': step_name,
            'model': step_model,
            'request_details': request_details,
            'response_details': response_details,
            'usage_info': usage_info,
            'start_time': step_start_time.isoformat() if hasattr(step_start_time, 'isoformat') else str(step_start_time),
            'duration_ms': Decimal(str(step_duration)),
            'artifact_id': artifact_id,
            'status': 'completed'
        }
        
        return step_data
    
    @staticmethod
    def create_html_generation_step(
        model: str,
        html_request_details: Dict[str, Any],
        html_response_details: Dict[str, Any],
        html_usage_info: Dict[str, Any],
        html_start_time: Any,
        html_duration: float,
        step_order: int
    ) -> Dict[str, Any]:
        """
        Create an HTML generation execution step.
        
        Args:
            model: AI model used
            html_request_details: Details of the HTML generation request
            html_response_details: Details of the HTML generation response
            html_usage_info: Token usage and cost information
            html_start_time: When HTML generation started
            html_duration: Duration in milliseconds
            step_order: Order in execution steps
            
        Returns:
            Execution step dictionary
        """
        return {
            'step_type': 'html_generation',
            'step_order': Decimal(str(step_order)),
            'step_name': 'HTML Generation',
            'model': model,
            'request_details': html_request_details,
            'response_details': html_response_details,
            'usage_info': html_usage_info,
            'start_time': html_start_time.isoformat() if hasattr(html_start_time, 'isoformat') else str(html_start_time),
            'duration_ms': Decimal(str(html_duration)),
            'status': 'completed'
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
        Create a final output execution step.
        
        Args:
            final_artifact_type: Type of final artifact
            final_filename: Filename of final artifact
            final_artifact_id: ID of the final artifact
            public_url: Public URL of final artifact
            step_order: Order in execution steps
            
        Returns:
            Execution step dictionary
        """
        return {
            'step_type': 'final_output',
            'step_order': Decimal(str(step_order)),
            'step_name': 'Final Output',
            'artifact_type': final_artifact_type,
            'filename': final_filename,
            'artifact_id': final_artifact_id,
            'url': public_url,
            'status': 'completed'
        }
