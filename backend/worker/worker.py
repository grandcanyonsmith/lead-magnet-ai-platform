#!/usr/bin/env python3
"""
Lead Magnet AI Worker
Processes jobs by generating AI reports and rendering HTML templates.
"""

import os
import sys
import logging
from typing import Dict, Any

from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service
from services.job_error_handler import JobErrorHandler

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


def main():
    """Main entry point for the worker."""
    
    # Get job_id from environment variable (passed by Step Functions)
    job_id = os.environ.get('JOB_ID')
    if not job_id:
        logger.error("[Worker] JOB_ID environment variable not set", extra={
            'available_env_vars': [k for k in os.environ.keys() if 'JOB' in k.upper()]
        })
        sys.exit(1)
    
    logger.info(f"[Worker] Starting worker", extra={
        'job_id': job_id,
        'python_version': sys.version,
        'aws_region': os.environ.get('AWS_REGION', 'not set')
    })
    
    # Initialize db_service to None to ensure it's always defined
    db_service = None
    
    try:
        # Initialize services
        logger.debug(f"[Worker] Initializing services", extra={'job_id': job_id})
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        # Process the job
        result = processor.process_job(job_id)
        
        if result['success']:
            logger.info(f"Job {job_id} completed successfully")
            sys.exit(0)
        else:
            logger.error(f"Job {job_id} failed: {result.get('error')}")
            sys.exit(1)
            
    except Exception as e:
        # Use error handler service for consistent error handling
        # Only use error handler if db_service was successfully initialized
        if db_service is not None:
            try:
                error_handler = JobErrorHandler(db_service)
                error_result = error_handler.handle_job_error(
                    job_id=job_id,
                    error=e,
                    step_index=None,
                    step_type='workflow_step'
                )
                logger.error(f"Job {job_id} failed: {error_result.get('error')}")
            except Exception as handler_error:
                logger.exception(f"Error handler failed: {handler_error}")
                logger.error(f"Job {job_id} failed: {str(e)}")
        else:
            # If db_service wasn't initialized, log error directly
            logger.exception(f"Fatal error processing job {job_id} (db_service not initialized): {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
