"""
Error Handler Service
Provides centralized error handling for job processing.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional

from db_service import DynamoDBService

logger = logging.getLogger(__name__)


class JobErrorHandler:
    """Handles job-level error reporting and persistence."""
    
    def __init__(self, db_service: DynamoDBService):
        """
        Initialize error handler service.
        
        Args:
            db_service: DynamoDB service instance
        """
        self.db = db_service
    
    def handle_job_error(
        self,
        job_id: str,
        error: Exception,
        step_index: Optional[int] = None,
        step_type: str = 'workflow_step'
    ) -> Dict[str, Any]:
        """
        Handle job processing error consistently.
        
        Args:
            job_id: Job ID that failed
            error: Exception that occurred
            step_index: Optional step index if error occurred during step processing
            step_type: Type of step ('workflow_step' or 'html_generation')
            
        Returns:
            Dictionary with error details for response
        """
        # Create step description for logging
        if step_type == 'html_generation':
            step_description = 'HTML generation'
        elif step_index is not None:
            step_description = f'step {step_index}'
        else:
            step_description = 'all'
        
        logger.exception(f"Fatal error processing job {job_id}, {step_description}")
        
        # Create descriptive error message
        error_type = type(error).__name__
        error_message = str(error)
        
        if not error_message or error_message == error_type:
            error_message = f"{error_type}: {error_message}" if error_message else error_type
        
        descriptive_error = f"Fatal error during job processing: {error_message}"
        
        # Try to update job status to failed
        try:
            self.db.update_job(job_id, {
                'status': 'failed',
                'error_message': descriptive_error,
                'error_type': error_type,
                'updated_at': datetime.utcnow().isoformat(),
                'live_step': None,
            })
        except Exception as update_error:
            logger.error(f"Failed to update job status: {update_error}")
        
        result = {
            'success': False,
            'error': descriptive_error,
            'error_type': error_type
        }
        
        if step_index is not None:
            result['step_index'] = step_index
        
        if step_type != 'workflow_step':
            result['step_type'] = step_type
        
        return result
