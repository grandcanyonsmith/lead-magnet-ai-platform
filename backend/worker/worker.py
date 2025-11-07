#!/usr/bin/env python3
"""
Lead Magnet AI Worker
Processes jobs by generating AI reports and rendering HTML templates.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service

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
        
        sys.exit(1)


if __name__ == '__main__':
    main()

