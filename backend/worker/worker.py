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
        logger.error("JOB_ID environment variable not set")
        sys.exit(1)
    
    logger.info(f"Starting worker for job: {job_id}")
    
    try:
        # Initialize services
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
        
        # Try to update job status to failed
        try:
            db_service = DynamoDBService()
            db_service.update_job(job_id, {
                'status': 'failed',
                'error_message': str(e),
                'updated_at': datetime.utcnow().isoformat()
            })
        except Exception as update_error:
            logger.error(f"Failed to update job status: {update_error}")
        
        sys.exit(1)


if __name__ == '__main__':
    main()

