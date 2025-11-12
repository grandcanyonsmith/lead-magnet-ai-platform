#!/usr/bin/env python3
"""
Local Job Processor Test Script
Run this directly to test job processing locally with full debug output
"""

import os
import sys
import json
import logging
from datetime import datetime

# Setup detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Import worker modules
from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service


def test_job_processing(job_id: str):
    """
    Test processing a job locally with full debug output.
    
    Args:
        job_id: The job ID to process
    """
    print("="*80)
    print(f"LOCAL JOB PROCESSOR TEST")
    print(f"Job ID: {job_id}")
    print(f"Started: {datetime.utcnow().isoformat()}")
    print("="*80)
    print()
    
    try:
        # Initialize services
        logger.info("Initializing services...")
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        # Get job details first
        logger.info(f"Fetching job details for {job_id}")
        job = db_service.get_job(job_id, s3_service=s3_service)
        if not job:
            print(f"ERROR: Job {job_id} not found!")
            return
        
        print(f"\nJob Status: {job.get('status')}")
        print(f"Workflow ID: {job.get('workflow_id')}")
        print(f"Submission ID: {job.get('submission_id')}")
        
        # Get workflow details
        workflow_id = job.get('workflow_id')
        if workflow_id:
            workflow = db_service.get_workflow(workflow_id)
            if workflow:
                steps = workflow.get('steps', [])
                print(f"\nWorkflow: {workflow.get('workflow_name')}")
                print(f"Total Steps Defined: {len(steps)}")
                print("\nWorkflow Steps:")
                for i, step in enumerate(steps):
                    print(f"  {i+1}. {step.get('step_name')} (model: {step.get('model', 'gpt-5')})")
                print()
        
        # Process the job
        logger.info(f"Starting job processing for {job_id}")
        print("\n" + "="*80)
        print("STARTING JOB PROCESSING")
        print("="*80 + "\n")
        
        result = processor.process_job(job_id)
        
        print("\n" + "="*80)
        print("JOB PROCESSING COMPLETED")
        print("="*80)
        print(f"\nSuccess: {result.get('success')}")
        
        if result.get('success'):
            print("\n✅ Job completed successfully!")
            
            # Get updated job details
            updated_job = db_service.get_job(job_id, s3_service=s3_service)
            execution_steps = updated_job.get('execution_steps', [])
            
            print(f"\nTotal Execution Steps: {len(execution_steps)}")
            print("\nExecution Steps:")
            for step in execution_steps:
                step_name = step.get('step_name', 'Unknown')
                step_order = step.get('step_order', '?')
                step_type = step.get('step_type', 'unknown')
                print(f"  Step {step_order}: {step_name} ({step_type})")
                
                if 'usage_info' in step:
                    usage = step['usage_info']
                    print(f"    - Tokens: {usage.get('total_tokens', 0)} | Cost: ${usage.get('cost_usd', 0):.4f}")
                if 'duration_ms' in step:
                    print(f"    - Duration: {step['duration_ms']:.0f}ms")
        else:
            print("\n❌ Job failed!")
            print(f"Error: {result.get('error')}")
            print(f"Error Type: {result.get('error_type')}")
        
        print("\n" + "="*80)
        print(f"Test completed at: {datetime.utcnow().isoformat()}")
        print("="*80)
        
        return result
        
    except Exception as e:
        logger.exception("Fatal error during local job processing test")
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_local.py <job_id>")
        print("\nExample:")
        print("  python test_local.py job_01K9TR7WXEC3X17YA4MNBSMQ9S")
        sys.exit(1)
    
    job_id = sys.argv[1]
    test_job_processing(job_id)
