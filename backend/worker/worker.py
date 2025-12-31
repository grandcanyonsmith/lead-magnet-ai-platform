#!/usr/bin/env python3
"""
Lead Magnet AI Worker
Processes jobs by generating AI reports and rendering HTML templates.
"""

import os
import sys
import logging
import signal
import time
from typing import Dict, Any

# Add the current directory to sys.path to ensure modules are found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.config import settings
from core.logger import setup_logging, get_logger
from core import log_context
from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service
from services.job_error_handler import JobErrorHandler

# Setup logging
setup_logging(level=settings.LOG_LEVEL)
logger = get_logger(__name__)

# Track shutdown signals to stop work gracefully
_shutting_down = False


def signal_handler(signum, frame):
    """Handle termination signals gracefully so logs flush before exit."""
    global _shutting_down
    signal_name = signal.Signals(signum).name
    _shutting_down = True
    logger.warning(f"[Worker] Received signal {signal_name} ({signum}), initiating graceful shutdown...")
    # 130 for SIGINT, 143 for SIGTERM to match common conventions
    sys.exit(130 if signum == signal.SIGINT else 143)


def main():
    """Main entry point for the worker."""

    # #region agent log
    import json; import time; 
    try:
        with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f: f.write(json.dumps({"location": "worker.py:main", "message": "Worker process started", "data": {"job_id": os.environ.get("JOB_ID"), "step_index": os.environ.get("STEP_INDEX")}, "timestamp": int(time.time() * 1000), "sessionId": "debug-session", "hypothesisId": "worker-start"}) + "\n")
    except Exception as e: pass
    # #endregion

    process_start_time = time.monotonic()

    # Suppress Pydantic warnings at the very start
    import warnings
    warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
    warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')

    # Handle termination signals
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Get job_id from configuration
    job_id = settings.JOB_ID
    if not job_id:
        logger.error("[Worker] JOB_ID environment variable not set", extra={
            'available_env_vars': [k for k in os.environ.keys() if 'JOB' in k.upper()]
        })
        sys.exit(1)

    # Optional single-step rerun support
    step_index = settings.STEP_INDEX
    continue_after = settings.CONTINUE_AFTER

    # Bind global context for this execution
    log_context.bind(
        service="worker-local",
        job_id=job_id,
        step_index=step_index,
        continue_after=continue_after,
        python_version=sys.version.split()[0],
        aws_region=settings.AWS_REGION,
        environment=settings.ENVIRONMENT
    )

    logger.info("[Worker] Starting worker")

    # Initialize db_service to None to ensure it's always defined
    db_service = None
    exit_code = 1  # default to failure unless set otherwise

    try:
        # Initialize services
        logger.debug("[Worker] Initializing services")
        
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)

        logger.info("[Worker] Services initialized, processing job...")

        if _shutting_down:
            logger.warning("[Worker] Shutdown requested before processing started")
            sys.exit(130)

        # Process the job or a single step
        if step_index is not None:
            logger.info("[Worker] Processing single step")
            result = processor.process_single_step(job_id, step_index, 'workflow_step')
            if continue_after:
                logger.warning("[Worker] continue_after=true is not fully supported in local mode - only single step will be processed")
        else:
            result = processor.process_job(job_id)

        if result['success']:
            logger.info("Job completed successfully", extra={
                'duration_seconds': round(time.monotonic() - process_start_time, 2)
            })
            exit_code = 0
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.error("Job failed", extra={
                'error': error_msg
            })
            exit_code = 1

    except KeyboardInterrupt:
        logger.warning("Job interrupted by user")
        exit_code = 130  # Standard exit code for SIGINT
    except SystemExit as e:
        # Preserve SystemExit codes triggered by signal handler
        exit_code = e.code if isinstance(e.code, int) else 1
        raise
    except Exception as e:
        # Log full exception with traceback
        logger.exception(f"Fatal error processing job {job_id}: {e}")

        # Use error handler service for consistent error handling
        if db_service is not None:
            try:
                error_handler = JobErrorHandler(db_service)
                error_result = error_handler.handle_job_error(
                    job_id=job_id,
                    error=e,
                    step_index=step_index,
                    step_type='workflow_step'
                )
                logger.error(f"Job {job_id} failed: {error_result.get('error')}")
            except Exception as handler_error:
                logger.exception(f"Error handler failed: {handler_error}")
                logger.error(f"Job {job_id} failed: {str(e)}")
        else:
            logger.exception(f"Fatal error processing job {job_id} (db_service not initialized): {e}")
        exit_code = 1
    finally:
        # Log exit code and duration for visibility in caller
        logger.info("[Worker] Exiting", extra={
            'exit_code': exit_code,
            'duration_seconds': round(time.monotonic() - process_start_time, 2)
        })
        sys.exit(exit_code)


if __name__ == '__main__':
    main()
