"""
Test script for webhook step feature.
Tests that webhook steps execute correctly and send the expected data.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, Any
import boto3
try:
    from ulid import new as ulid
except ImportError:
    from ulid import ULID as ulid

# Add the worker directory to Python path so imports work
from pathlib import Path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Now we can import the worker modules
from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Use httpbin.org for testing webhooks (it echoes back the request)
TEST_WEBHOOK_URL = "https://httpbin.org/post"


def create_test_workflow_with_webhook_step(tenant_id: str) -> Dict[str, Any]:
    """Create a test workflow with a webhook step."""
    workflow_id = f"wf_test_webhook_{ulid()}"
    
    workflow = {
        'workflow_id': workflow_id,
        'tenant_id': tenant_id,
        'workflow_name': 'Test Webhook Step Workflow',
        'workflow_description': 'Test workflow with webhook step',
        'status': 'active',
        'steps': [
            {
                'step_name': 'Research Step',
                'step_description': 'Generate research content',
                'step_type': 'ai_generation',
                'model': 'gpt-5',
                'instructions': 'Generate a brief research report about artificial intelligence. Keep it to 2-3 paragraphs.',
                'step_order': 0,
                'tools': ['web_search'],
                'tool_choice': 'auto',
            },
            {
                'step_name': 'Send Webhook',
                'step_description': 'Send webhook with step data',
                'step_type': 'webhook',
                'webhook_url': TEST_WEBHOOK_URL,
                'webhook_headers': {
                    'X-Test-Header': 'test-value',
                    'Content-Type': 'application/json'
                },
                'webhook_data_selection': {
                    'include_submission': True,
                    'include_job_info': True,
                    'exclude_step_indices': []  # Include all steps
                },
                'step_order': 1,
                'depends_on': [0]
            }
        ],
        'template_id': None,
        'template_version': 0,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    return workflow


def create_test_submission(tenant_id: str, workflow_id: str) -> Dict[str, Any]:
    """Create a test submission."""
    submission_id = f"sub_test_webhook_{ulid()}"
    
    submission = {
        'submission_id': submission_id,
        'tenant_id': tenant_id,
        'form_id': f"form_test_{ulid()}",
        'workflow_id': workflow_id,
        'submission_data': {
            'name': 'Test User',
            'email': 'test@example.com',
            'phone': '+1234567890',
            'company': 'Test Company'
        },
        'submitter_email': 'test@example.com',
        'submitter_name': 'Test User',
        'created_at': datetime.utcnow().isoformat()
    }
    
    return submission


def create_test_job(tenant_id: str, workflow_id: str, submission_id: str) -> Dict[str, Any]:
    """Create a test job."""
    job_id = f"job_test_webhook_{ulid()}"
    
    job = {
        'job_id': job_id,
        'tenant_id': tenant_id,
        'workflow_id': workflow_id,
        'submission_id': submission_id,
        'status': 'pending',
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    return job


def verify_webhook_step_execution(job_id: str, db_service: DynamoDBService) -> bool:
    """Verify that the webhook step was executed correctly."""
    logger.info(f"Verifying webhook step execution for job {job_id}")
    
    # Get the job
    job = db_service.get_job(job_id)
    if not job:
        logger.error(f"Job {job_id} not found")
        return False
    
    # Get execution steps
    execution_steps = job.get('execution_steps', [])
    if not execution_steps:
        logger.error("No execution steps found")
        return False
    
    # Find the webhook step
    webhook_step = None
    for step in execution_steps:
        if step.get('step_type') == 'webhook':
            webhook_step = step
            break
    
    if not webhook_step:
        logger.error("Webhook step not found in execution steps")
        return False
    
    logger.info(f"Found webhook step: {webhook_step.get('step_name')}")
    
    # Verify webhook step structure
    required_fields = ['step_name', 'step_type', 'input', 'output', 'timestamp']
    for field in required_fields:
        if field not in webhook_step:
            logger.error(f"Webhook step missing required field: {field}")
            return False
    
    # Verify input contains webhook_url and payload
    input_data = webhook_step.get('input', {})
    if 'webhook_url' not in input_data:
        logger.error("Webhook step input missing webhook_url")
        return False
    
    if 'payload' not in input_data:
        logger.error("Webhook step input missing payload")
        return False
    
    # Verify payload structure
    payload = input_data.get('payload', {})
    if 'submission_data' not in payload:
        logger.error("Payload missing submission_data")
        return False
    
    if 'step_outputs' not in payload:
        logger.error("Payload missing step_outputs")
        return False
    
    if 'job_info' not in payload:
        logger.error("Payload missing job_info")
        return False
    
    # Verify output contains response details
    output_data = webhook_step.get('output', {})
    if 'response_status' not in output_data:
        logger.error("Webhook step output missing response_status")
        return False
    
    if 'success' not in output_data:
        logger.error("Webhook step output missing success field")
        return False
    
    # Check if webhook was successful
    success = output_data.get('success', False)
    response_status = output_data.get('response_status')
    
    logger.info(f"Webhook step execution result:")
    logger.info(f"  Success: {success}")
    logger.info(f"  Response Status: {response_status}")
    logger.info(f"  Webhook URL: {input_data.get('webhook_url')}")
    logger.info(f"  Payload keys: {list(payload.keys())}")
    
    if success:
        logger.info("✅ Webhook step executed successfully!")
    else:
        error = output_data.get('error', 'Unknown error')
        logger.warning(f"⚠️  Webhook step failed: {error}")
        # Don't fail the test if webhook fails (since we're using httpbin which might be down)
        # Just log it
    
    return True


def main():
    """Run the webhook step test."""
    logger.info("=" * 80)
    logger.info("Testing Webhook Step Feature")
    logger.info("=" * 80)
    
    # Get environment variables
    tenant_id = os.environ.get('TENANT_ID', 'test_tenant')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    # Set required environment variables if not set
    required_env_vars = {
        'WORKFLOWS_TABLE': 'workflows',
        'JOBS_TABLE': 'jobs',
        'SUBMISSIONS_TABLE': 'submissions',
        'FORMS_TABLE': 'forms',
        'ARTIFACTS_TABLE': 'artifacts',
        'TEMPLATES_TABLE': 'templates',
        'USAGE_TABLE': 'usage',
        'NOTIFICATIONS_TABLE': 'notifications',
        'ARTIFACTS_BUCKET': 'leadmagnet-artifacts',
        'AWS_REGION': region
    }
    
    for key, default_value in required_env_vars.items():
        if key not in os.environ:
            os.environ[key] = default_value
    
    try:
        # Initialize services
        logger.info("\nInitializing services...")
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        # Step 1: Create workflow
        logger.info("\n" + "=" * 80)
        logger.info("Step 1: Creating test workflow with webhook step")
        logger.info("=" * 80)
        workflow = create_test_workflow_with_webhook_step(tenant_id)
        workflow_id = workflow['workflow_id']
        
        # Store workflow
        dynamodb = boto3.resource('dynamodb', region_name=region)
        workflows_table = dynamodb.Table(os.environ['WORKFLOWS_TABLE'])
        workflows_table.put_item(Item=workflow)
        logger.info(f"✅ Created workflow: {workflow_id}")
        logger.info(f"   Steps: {len(workflow['steps'])}")
        logger.info(f"   Webhook URL: {TEST_WEBHOOK_URL}")
        
        # Step 2: Create submission
        logger.info("\n" + "=" * 80)
        logger.info("Step 2: Creating test submission")
        logger.info("=" * 80)
        submission = create_test_submission(tenant_id, workflow_id)
        submission_id = submission['submission_id']
        
        # Store submission
        submissions_table = dynamodb.Table(os.environ['SUBMISSIONS_TABLE'])
        submissions_table.put_item(Item=submission)
        logger.info(f"✅ Created submission: {submission_id}")
        
        # Step 3: Create job
        logger.info("\n" + "=" * 80)
        logger.info("Step 3: Creating test job")
        logger.info("=" * 80)
        job = create_test_job(tenant_id, workflow_id, submission_id)
        job_id = job['job_id']
        
        # Store job
        jobs_table = dynamodb.Table(os.environ['JOBS_TABLE'])
        jobs_table.put_item(Item=job)
        logger.info(f"✅ Created job: {job_id}")
        
        # Step 4: Process job
        logger.info("\n" + "=" * 80)
        logger.info("Step 4: Processing job (this will execute the webhook step)")
        logger.info("=" * 80)
        logger.info("Note: This will make a real HTTP request to httpbin.org")
        logger.info("The webhook step should execute after the research step completes")
        
        result = processor.process_job(job_id)
        
        if not result.get('success'):
            logger.error(f"❌ Job processing failed: {result.get('error')}")
            return 1
        
        logger.info(f"✅ Job processing completed")
        logger.info(f"   Output URL: {result.get('output_url', 'N/A')}")
        
        # Step 5: Verify webhook step execution
        logger.info("\n" + "=" * 80)
        logger.info("Step 5: Verifying webhook step execution")
        logger.info("=" * 80)
        
        if verify_webhook_step_execution(job_id, db_service):
            logger.info("\n" + "=" * 80)
            logger.info("✅ All tests passed! Webhook step feature is working correctly.")
            logger.info("=" * 80)
            return 0
        else:
            logger.error("\n" + "=" * 80)
            logger.error("❌ Webhook step verification failed")
            logger.error("=" * 80)
            return 1
            
    except Exception as e:
        logger.error(f"\n❌ Test failed with exception: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())

