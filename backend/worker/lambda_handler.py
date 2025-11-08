"""
Lambda Handler for Lead Magnet AI Worker
Processes jobs by generating AI reports and rendering HTML templates.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any

from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service

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
    handler_start_time = datetime.utcnow()
    
    # Extract job_id from event
    job_id = event.get('job_id')
    if not job_id:
        logger.error("[LambdaHandler] job_id not provided in event", extra={'event_keys': list(event.keys())})
        return {
            'success': False,
            'error': 'job_id not provided in event',
            'error_type': 'ValueError'
        }
    
    # Extract step_index if present (per-step mode)
    step_index = event.get('step_index')
    step_type = event.get('step_type', 'workflow_step')  # 'workflow_step' or 'html_generation'
    
    logger.info(f"[LambdaHandler] Starting Lambda handler", extra={
        'job_id': job_id,
        'step_index': step_index,
        'step_type': step_type,
        'request_id': getattr(context, 'aws_request_id', None) if context else None,
        'function_name': getattr(context, 'function_name', None) if context else None,
        'start_time': handler_start_time.isoformat()
    })
    
    try:
        # Initialize services
        logger.debug(f"[LambdaHandler] Initializing services", extra={'job_id': job_id})
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        # Route to appropriate processing method
        action = event.get('action')
        if action == 'resolve_dependencies':
            # Dependency resolution mode
            workflow_id = event.get('workflow_id')
            if not workflow_id:
                raise ValueError('workflow_id is required for dependency resolution')
            
            logger.info(f"Resolving dependencies for workflow {workflow_id}")
            workflow = db_service.get_workflow(workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            steps = workflow.get('steps', [])
            if not steps:
                raise ValueError(f"Workflow {workflow_id} has no steps")
            
            execution_plan = processor.resolve_step_dependencies(steps)
            
            # Store execution plan in job
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
        elif step_index is not None:
            # Per-step processing mode
            logger.info(f"Processing single step {step_index} for job {job_id}")
            result = processor.process_single_step(job_id, step_index, step_type)
        else:
            # Legacy full job processing mode (backward compatibility)
            logger.info(f"Processing full job {job_id} (legacy mode)")
            result = processor.process_job(job_id)
        
        if result['success']:
            logger.info(f"Job {job_id} step {step_index if step_index is not None else 'all'} completed successfully")
            return result
        else:
            logger.error(f"Job {job_id} step {step_index if step_index is not None else 'all'} failed: {result.get('error')}")
            return result
            
    except Exception as e:
        logger.exception(f"Fatal error processing job {job_id}, step {step_index if step_index is not None else 'all'}")
        
        # Create descriptive error message
        error_type = type(e).__name__
        error_message = str(e)
        
        if not error_message or error_message == error_type:
            error_message = f"{error_type}: {error_message}" if error_message else error_type
        
        descriptive_error = f"Fatal error during job processing: {error_message}"
        
        # Try to update job status to failed
        try:
            db_service = DynamoDBService()
            db_service.update_job(job_id, {
                'status': 'failed',
                'error_message': descriptive_error,
                'error_type': error_type,
                'updated_at': datetime.utcnow().isoformat()
            })
        except Exception as update_error:
            logger.error(f"Failed to update job status: {update_error}")
        
        return {
            'success': False,
            'error': descriptive_error,
            'error_type': error_type,
            'step_index': step_index
        }

