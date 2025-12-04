"""
Lambda Handler for Lead Magnet AI Worker
Processes jobs by generating AI reports and rendering HTML templates.
"""

import os
import logging
from typing import Dict, Any

from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service
from services.job_error_handler import JobErrorHandler
from services.lambda_router import LambdaRouter

# Setup logging
logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for processing lead magnet jobs.
    
    Supports three modes:
    1. Dependency resolution: event contains 'action': 'resolve_dependencies' - resolves step dependencies
    2. Per-step processing: event contains 'step_index' - processes single step
    3. Legacy full job processing: event contains only 'job_id' - processes all steps
    
    Args:
        event: Step Functions event containing:
            - job_id: Required - The job ID to process
            - action: Optional - 'resolve_dependencies' to resolve dependencies
            - step_index: Optional - Index of step to process (for per-step mode)
            - step_type: Optional - Type of step ('workflow_step' or 'html_generation')
        context: Lambda context object
        
    Returns:
        Dictionary with success status and optional error
    """
    # Extract job_id from event
    job_id = event.get('job_id')
    if not job_id:
        logger.error("[LambdaHandler] job_id not provided in event", extra={'event_keys': list(event.keys())})
        return {
            'success': False,
            'error': 'job_id not provided in event',
            'error_type': 'ValueError'
        }
    
    step_index = event.get('step_index')
    step_type = event.get('step_type', 'workflow_step')
    
    logger.info(f"[LambdaHandler] Starting Lambda handler", extra={
        'job_id': job_id,
        'step_index': step_index,
        'step_type': step_type,
        'request_id': getattr(context, 'aws_request_id', None) if context else None,
        'function_name': getattr(context, 'function_name', None) if context else None
    })
    
    try:
        # Initialize services
        logger.debug(f"[LambdaHandler] Initializing services", extra={'job_id': job_id})
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        router = LambdaRouter(processor)
        
        # Route event to appropriate handler
        result = router.route(event)
        
        if result['success']:
            step_description = 'HTML generation' if step_type == 'html_generation' else (f'step {step_index}' if step_index is not None else 'all')
            logger.info(f"Job {job_id} {step_description} completed successfully")
        else:
            step_description = 'HTML generation' if step_type == 'html_generation' else (f'step {step_index}' if step_index is not None else 'all')
            logger.error(f"Job {job_id} {step_description} failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        # Use error handler service for consistent error handling
        try:
            db_service = DynamoDBService()
        except Exception:
            # If we can't initialize db_service, create a minimal error response
            logger.exception("Failed to initialize DynamoDB service for error handling")
            return {
                'success': False,
                'error': f"Fatal error: {str(e)}",
                'error_type': type(e).__name__
            }
        
        error_handler = JobErrorHandler(db_service)
        return error_handler.handle_job_error(
            job_id=job_id,
            error=e,
            step_index=step_index,
            step_type=step_type
        )
