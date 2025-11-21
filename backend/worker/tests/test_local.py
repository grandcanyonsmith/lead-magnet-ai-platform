#!/usr/bin/env python3
"""
Local Job Execution Script for Debugging
Run jobs locally with full debug output to troubleshoot issues.

Usage:
    python test_local.py <job_id>
    
Example:
    python test_local.py 01ARZ3NDEKTSV4RRFFQ69G5FAV
"""

import sys
import os
import json
import logging
from pathlib import Path

# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Now we can import the worker modules
from processor import JobProcessor
from core.db_service import DynamoDBService
from core.s3_service import S3Service

# Setup detailed logging for debugging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def main():
    """Main entry point for local job execution."""
    if len(sys.argv) < 2:
        print("Usage: python test_local.py <job_id>")
        print("\nExample:")
        print("  python test_local.py 01ARZ3NDEKTSV4RRFFQ69G5FAV")
        sys.exit(1)
    
    job_id = sys.argv[1]
    logger.info(f"Starting local job execution for job_id: {job_id}")
    
    try:
        # Initialize services
        logger.info("Initializing services...")
        db_service = DynamoDBService()
        s3_service = S3Service()
        
        # Create processor
        logger.info("Creating job processor...")
        processor = JobProcessor(db_service, s3_service)
        
        # Process the job
        logger.info(f"Processing job {job_id}...")
        result = processor.process_job(job_id)
        
        # Print results
        print("\n" + "="*80)
        print("JOB EXECUTION COMPLETE")
        print("="*80)
        print(json.dumps(result, indent=2, default=str))
        print("="*80)
        
        if result.get('success'):
            logger.info("Job completed successfully!")
            sys.exit(0)
        else:
            logger.error(f"Job failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Fatal error during job execution: {e}", exc_info=True)
        print(f"\nERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
