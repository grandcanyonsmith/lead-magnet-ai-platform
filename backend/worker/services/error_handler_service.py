"""
Error Handler Service
Provides centralized error handling for job processing and OpenAI API errors.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from db_service import DynamoDBService

logger = logging.getLogger(__name__)


class ErrorHandlerService:
    """Service for handling errors consistently across the application."""
    
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
                'updated_at': datetime.utcnow().isoformat()
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
    
    @staticmethod
    def classify_error(error_message: str) -> str:
        """
        Classify error message into error category.
        
        Args:
            error_message: Error message string
            
        Returns:
            Error category string
        """
        error_lower = error_message.lower()
        if "API key" in error_message or "authentication" in error_lower:
            return "authentication"
        elif "rate limit" in error_lower or "quota" in error_lower:
            return "rate_limit"
        elif "tool_choice" in error_lower and "required" in error_lower and "tools" in error_lower:
            return "tool_choice_config"
        elif "model" in error_lower and "not found" in error_lower:
            return "model_not_found"
        elif "timeout" in error_lower:
            return "timeout"
        elif "connection" in error_lower:
            return "connection"
        elif ("image data" in error_lower and "does not represent a valid image" in error_lower) or \
             ("invalid_value" in error_lower and "image" in error_lower) or \
             ("image" in error_lower and "format" in error_lower and "not supported" in error_lower):
            return "image_validation"
        else:
            return "unknown"
    
    @staticmethod
    def create_error_exception(
        error_category: str,
        error_type: str,
        error_message: str,
        model: str,
        tools: List[Dict],
        tool_choice: str
    ) -> Exception:
        """
        Create standardized exception based on error category.
        
        Args:
            error_category: Category of error
            error_type: Type name of the exception
            error_message: Original error message
            model: Model name used
            tools: Tools used
            tool_choice: Tool choice used
            
        Returns:
            Exception object with appropriate message
        """
        if error_category == "authentication":
            logger.error(f"[ErrorHandlerService] Authentication error - check API key configuration")
            return Exception(f"OpenAI API authentication failed. Please check your API key configuration: {error_message}")
        elif error_category == "rate_limit":
            logger.warning(f"[ErrorHandlerService] Rate limit exceeded - request should be retried")
            return Exception(f"OpenAI API rate limit exceeded. Please try again later: {error_message}")
        elif error_category == "tool_choice_config":
            logger.error(f"[ErrorHandlerService] Invalid tool_choice configuration - tool_choice='required' but tools empty", extra={
                'error_message': error_message,
                'error_type': error_type,
                'tool_choice': tool_choice,
                'tools_count': len(tools) if tools else 0,
                'tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else []
            })
            return Exception(f"OpenAI API error: Invalid workflow configuration. Tool choice 'required' was specified but no tools are available. This has been automatically fixed - please try again. Original error: {error_message}")
        elif error_category == "model_not_found":
            logger.error(f"[ErrorHandlerService] Invalid model specified: {model}")
            return Exception(f"Invalid AI model specified. Please check your workflow configuration: {error_message}")
        elif error_category == "timeout":
            logger.warning(f"[ErrorHandlerService] Request timeout - request took too long")
            return Exception(f"OpenAI API request timed out. The request took too long to complete: {error_message}")
        elif error_category == "connection":
            logger.error(f"[ErrorHandlerService] Connection error - network issue")
            return Exception(f"Unable to connect to OpenAI API. Please check your network connection: {error_message}")
        elif error_category == "image_validation":
            logger.error(f"[ErrorHandlerService] Image validation error - invalid image data provided", extra={
                'error_message': error_message,
                'error_type': error_type,
                'model': model,
                'tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else []
            })
            return Exception(f"OpenAI API error: Invalid image data provided. The image data does not represent a valid image format. Supported formats: JPEG, PNG, GIF, WebP. This may occur if base64 image data is corrupted or if an invalid image URL is provided. Please check your workflow configuration and ensure all image URLs are valid HTTP/HTTPS URLs. Original error: {error_message}")
        else:
            logger.error(f"[ErrorHandlerService] Unexpected API error: {error_type}")
            return Exception(f"OpenAI API error ({error_type}): {error_message}")

