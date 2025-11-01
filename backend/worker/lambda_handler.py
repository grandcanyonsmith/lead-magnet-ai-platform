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
    
    Args:
        event: Step Functions event containing 'job_id'
        context: Lambda context object
        
    Returns:
        Dictionary with success status and optional error
    """
    # Extract job_id from event
    job_id = event.get('job_id')
    if not job_id:
        logger.error("job_id not provided in event")
        return {
            'success': False,
            'error': 'job_id not provided in event',
            'error_type': 'ValueError'
        }
    
    logger.info(f"Starting Lambda handler for job: {job_id}")
    
    try:
        # Initialize services
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        # Process the job
        result = processor.process_job(job_id)
        
        if result['success']:
            logger.info(f"Job {job_id} completed successfully")
            return result
        else:
            logger.error(f"Job {job_id} failed: {result.get('error')}")
            return result
            
    except Exception as e:
        logger.exception(f"Fatal error processing job {job_id}")
        
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
            'error_type': error_type
        }

