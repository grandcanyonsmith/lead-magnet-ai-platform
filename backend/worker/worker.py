#!/usr/bin/env python3
"""
Lead Magnet AI Worker
Processes jobs by generating AI reports and rendering HTML templates.
"""

import os
import sys
import logging
import signal
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

# Global flag to track if we're shutting down
_shutting_down = False
_processor_instance = None


def signal_handler(signum, frame):
    """Handle termination signals gracefully."""
    global _shutting_down
    signal_name = signal.Signals(signum).name
    logger.warning(f"[Worker] Received signal {signal_name} ({signum}), initiating graceful shutdown...")
    print(f"ERROR: Worker received signal {signal_name}, shutting down gracefully...", file=sys.stderr)
    sys.stderr.flush()
    _shutting_down = True
    # Exit with error code to indicate abnormal termination
    sys.exit(130 if signum == signal.SIGINT else 143)


def main():
    """Main entry point for the worker."""
    global _processor_instance
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
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
    
    # Check if this is a single step rerun
    step_index_str = os.environ.get('STEP_INDEX')
    step_index = int(step_index_str) if step_index_str is not None and step_index_str.isdigit() else None
    continue_after = os.environ.get('CONTINUE_AFTER', 'false').lower() == 'true'
    
    logger.info(f"[Worker] Starting worker", extra={
        'job_id': job_id,
        'step_index': step_index,
        'continue_after': continue_after,
        'python_version': sys.version,
        'aws_region': os.environ.get('AWS_REGION', 'not set')
    })
    if step_index is not None:
        print(f"[Worker] Starting worker for job {job_id}, rerunning step {step_index}", file=sys.stdout)
    else:
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
        _processor_instance = processor  # Store for signal handler
        
        print(f"[Worker] Services initialized, processing job...", file=sys.stdout)
        sys.stdout.flush()
        
        # Check if we're shutting down before processing
        if _shutting_down:
            logger.warning(f"[Worker] Shutdown requested before job processing started")
            print(f"ERROR: Shutdown requested before job processing", file=sys.stderr)
            sys.stderr.flush()
            sys.exit(130)
        
        # Process the job or single step
        if step_index is not None:
            logger.info(f"[Worker] Processing single step {step_index} for job {job_id}", extra={
                'job_id': job_id,
                'step_index': step_index,
                'continue_after': continue_after
            })
            print(f"[Worker] Processing single step {step_index}...", file=sys.stdout)
            sys.stdout.flush()
            result = processor.process_single_step(job_id, step_index, 'workflow_step')
            
            # Note: continue_after functionality for local mode would require processing remaining steps
            # For now, we only support single step rerun in local mode
            # In production, Step Functions handles continue_after by triggering subsequent step executions
            if continue_after:
                logger.warning(f"[Worker] continue_after=true is not fully supported in local mode - only single step will be processed", extra={
                    'job_id': job_id,
                    'step_index': step_index
                })
        else:
            result = processor.process_job(job_id)
        
        # Flush stdout after processing
        sys.stdout.flush()
        
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
        sys.stderr.flush()
        sys.exit(130)  # Standard exit code for SIGINT
    except SystemExit:
        # Re-raise SystemExit to allow proper exit
        raise
    except Exception as e:
        # Log full exception with traceback
        import traceback
        error_traceback = traceback.format_exc()
        logger.exception(f"Fatal error processing job {job_id}: {e}")
        
        # Print to stderr so it's captured by the calling process
        print(f"ERROR: Fatal error processing job {job_id}: {str(e)}", file=sys.stderr)
        print(f"TRACEBACK:\n{error_traceback}", file=sys.stderr)
        sys.stderr.flush()
        sys.stdout.flush()  # Also flush stdout to ensure all logs are captured
        
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
