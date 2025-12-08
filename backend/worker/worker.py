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
    
    # Suppress Pydantic warnings at the very start
    import warnings
    warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
    warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')
    
    # Get job_id from environment variable (passed by Step Functions)
    job_id = os.environ.get('JOB_ID')
    if not job_id:
        logger.error("[Worker] JOB_ID environment variable not set", extra={
            'available_env_vars': [k for k in os.environ.keys() if 'JOB' in k.upper()]
        })
        print(f"ERROR: JOB_ID environment variable not set", file=sys.stderr)
        sys.exit(1)
    
    logger.info(f"[Worker] Starting worker", extra={
        'job_id': job_id,
        'python_version': sys.version,
        'aws_region': os.environ.get('AWS_REGION', 'not set')
    })
    print(f"[Worker] Starting worker for job {job_id}", file=sys.stdout)
    sys.stdout.flush()
    
    # Initialize db_service to None to ensure it's always defined
    db_service = None
    
    try:
        # Initialize services
        logger.debug(f"[Worker] Initializing services", extra={'job_id': job_id})
        print(f"[Worker] Initializing services...", file=sys.stdout)
        sys.stdout.flush()
        
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        print(f"[Worker] Services initialized, processing job...", file=sys.stdout)
        sys.stdout.flush()
        
        # Process the job
        result = processor.process_job(job_id)
        
        if result['success']:
            logger.info(f"Job {job_id} completed successfully")
            print(f"[Worker] Job {job_id} completed successfully", file=sys.stdout)
            sys.stdout.flush()
            sys.exit(0)
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.error(f"Job {job_id} failed: {error_msg}")
            print(f"ERROR: Job {job_id} failed: {error_msg}", file=sys.stderr)
            sys.stderr.flush()
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.warning(f"Job {job_id} interrupted by user")
        print(f"ERROR: Job {job_id} interrupted", file=sys.stderr)
        sys.exit(130)  # Standard exit code for SIGINT
    except Exception as e:
        # Log full exception with traceback
        import traceback
        error_traceback = traceback.format_exc()
        logger.exception(f"Fatal error processing job {job_id}: {e}")
        
        # Print to stderr so it's captured by the calling process
        print(f"ERROR: Fatal error processing job {job_id}: {str(e)}", file=sys.stderr)
        print(f"TRACEBACK:\n{error_traceback}", file=sys.stderr)
        sys.stderr.flush()
        
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
