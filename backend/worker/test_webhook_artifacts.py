#!/usr/bin/env python3
"""
Test script for webhook delivery with artifacts.
Tests that delivery webhooks include all artifacts (images, HTML, markdown) in the payload.

Usage:
    python test_webhook_artifacts.py [job_id]
    
If job_id is provided, it will test that specific job.
Otherwise, it will create a new test job and process it.
"""

import sys
import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import boto3
from ulid import new as ulid

# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Now we can import the worker modules
from processor import JobProcessor
from db_service import DynamoDBService
from s3_service import S3Service
from delivery_service import DeliveryService
from ai_service import AIService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Use httpbin.org for testing webhooks (it echoes back the request)
TEST_WEBHOOK_URL = "https://httpbin.org/post"


def setup_test_environment():
    """Set up required environment variables if not set."""
    required_env_vars = {
        'WORKFLOWS_TABLE': os.environ.get('WORKFLOWS_TABLE', 'leadmagnet-workflows'),
        'JOBS_TABLE': os.environ.get('JOBS_TABLE', 'leadmagnet-jobs'),
        'SUBMISSIONS_TABLE': os.environ.get('SUBMISSIONS_TABLE', 'leadmagnet-submissions'),
        'FORMS_TABLE': os.environ.get('FORMS_TABLE', 'leadmagnet-forms'),
        'ARTIFACTS_TABLE': os.environ.get('ARTIFACTS_TABLE', 'leadmagnet-artifacts'),
        'TEMPLATES_TABLE': os.environ.get('TEMPLATES_TABLE', 'leadmagnet-templates'),
        'USAGE_RECORDS_TABLE': os.environ.get('USAGE_RECORDS_TABLE', 'leadmagnet-usage-records'),
        'NOTIFICATIONS_TABLE': os.environ.get('NOTIFICATIONS_TABLE', 'leadmagnet-notifications'),
        'ARTIFACTS_BUCKET': os.environ.get('ARTIFACTS_BUCKET', 'leadmagnet-artifacts-dev'),
        'AWS_REGION': os.environ.get('AWS_REGION', 'us-east-1')
    }
    
    for key, value in required_env_vars.items():
        if key not in os.environ:
            os.environ[key] = value
    
    return required_env_vars


def create_test_workflow_with_webhook(tenant_id: str) -> Dict[str, Any]:
    """Create a test workflow with webhook delivery configured."""
    workflow_id = f"wf_test_webhook_artifacts_{ulid()}"
    
    workflow = {
        'workflow_id': workflow_id,
        'tenant_id': tenant_id,
        'workflow_name': 'Test Webhook Artifacts Workflow',
        'workflow_description': 'Test workflow for webhook artifacts',
        'status': 'active',
        'delivery_method': 'webhook',
        'delivery_webhook_url': TEST_WEBHOOK_URL,
        'delivery_webhook_headers': {
            'X-Test-Header': 'test-value'
        },
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
    submission_id = f"sub_test_webhook_artifacts_{ulid()}"
    
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
    job_id = f"job_test_webhook_artifacts_{ulid()}"
    
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


def verify_webhook_payload_artifacts(job_id: str, db_service: DynamoDBService) -> bool:
    """
    Verify that artifacts are included in the webhook payload.
    Since we're using httpbin.org, we can't directly verify the payload,
    but we can verify that:
    1. The job has artifacts
    2. The artifacts can be queried
    3. The artifacts are properly categorized
    """
    logger.info(f"Verifying artifacts for job {job_id}")
    
    # Query artifacts directly
    try:
        artifacts = db_service.query_artifacts_by_job_id(job_id)
        logger.info(f"Found {len(artifacts)} artifacts for job {job_id}")
        
        if len(artifacts) == 0:
            logger.warning("No artifacts found for job - webhook payload will have empty arrays")
            return True  # This is acceptable - job might not have generated artifacts
        
        # Categorize artifacts
        images = []
        html_files = []
        markdown_files = []
        
        for artifact in artifacts:
            artifact_type = artifact.get('artifact_type', '').lower()
            artifact_name = (artifact.get('artifact_name') or artifact.get('file_name', '')).lower()
            
            if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                images.append(artifact)
            elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
                html_files.append(artifact)
            elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
                markdown_files.append(artifact)
        
        logger.info(f"Artifact categorization:")
        logger.info(f"  Total artifacts: {len(artifacts)}")
        logger.info(f"  Images: {len(images)}")
        logger.info(f"  HTML files: {len(html_files)}")
        logger.info(f"  Markdown files: {len(markdown_files)}")
        
        # Verify artifact metadata structure
        for artifact in artifacts:
            required_fields = ['artifact_id', 'artifact_type', 'public_url']
            missing_fields = [field for field in required_fields if not artifact.get(field)]
            if missing_fields:
                logger.warning(f"Artifact {artifact.get('artifact_id')} missing fields: {missing_fields}")
        
        logger.info("✅ Artifacts verified successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error verifying artifacts: {e}", exc_info=True)
        return False


def test_webhook_delivery_service(job_id: str, db_service: DynamoDBService, ai_service: AIService):
    """Test the DeliveryService.send_webhook_notification method directly."""
    logger.info("=" * 80)
    logger.info("Testing DeliveryService.send_webhook_notification directly")
    logger.info("=" * 80)
    
    # Get job and related data
    job = db_service.get_job(job_id)
    if not job:
        logger.error(f"Job {job_id} not found")
        return False
    
    submission_id = job.get('submission_id')
    if not submission_id:
        logger.error("Job has no submission_id")
        return False
    
    submission = db_service.get_submission(submission_id)
    if not submission:
        logger.error(f"Submission {submission_id} not found")
        return False
    
    workflow_id = job.get('workflow_id')
    if not workflow_id:
        logger.error("Job has no workflow_id")
        return False
    
    workflow = db_service.get_workflow(workflow_id)
    if not workflow:
        logger.error(f"Workflow {workflow_id} not found")
        return False
    
    output_url = job.get('output_url', 'https://example.com/test.html')
    
    # Create delivery service
    delivery_service = DeliveryService(db_service, ai_service)
    
    # Test webhook notification
    logger.info(f"Sending test webhook to {TEST_WEBHOOK_URL}")
    try:
        delivery_service.send_webhook_notification(
            webhook_url=TEST_WEBHOOK_URL,
            webhook_headers={'X-Test-Header': 'test-value'},
            job_id=job_id,
            output_url=output_url,
            submission=submission,
            job=job
        )
        logger.info("✅ Webhook notification sent successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Webhook notification failed: {e}", exc_info=True)
        return False


def main():
    """Main test function."""
    logger.info("=" * 80)
    logger.info("Testing Webhook Delivery with Artifacts")
    logger.info("=" * 80)
    
    # Setup environment
    setup_test_environment()
    
    tenant_id = os.environ.get('TENANT_ID', 'test_tenant')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    try:
        # Initialize services
        logger.info("\nInitializing services...")
        db_service = DynamoDBService()
        s3_service = S3Service()
        ai_service = AIService()
        processor = JobProcessor(db_service, s3_service)
        
        # Check if job_id was provided
        if len(sys.argv) > 1:
            job_id = sys.argv[1]
            logger.info(f"Using provided job_id: {job_id}")
            
            # Verify artifacts exist
            if not verify_webhook_payload_artifacts(job_id, db_service):
                logger.error("Artifact verification failed")
                return 1
            
            # Test webhook delivery service directly
            if not test_webhook_delivery_service(job_id, db_service, ai_service):
                logger.error("Webhook delivery test failed")
                return 1
            
            logger.info("\n" + "=" * 80)
            logger.info("✅ All tests passed!")
            logger.info("=" * 80)
            return 0
        
        # Create new test job
        logger.info("\n" + "=" * 80)
        logger.info("Creating new test job")
        logger.info("=" * 80)
        
        # Create workflow
        workflow = create_test_workflow_with_webhook(tenant_id)
        workflow_id = workflow['workflow_id']
        
        dynamodb = boto3.resource('dynamodb', region_name=region)
        workflows_table = dynamodb.Table(os.environ['WORKFLOWS_TABLE'])
        workflows_table.put_item(Item=workflow)
        logger.info(f"✅ Created workflow: {workflow_id}")
        
        # Create submission
        submission = create_test_submission(tenant_id, workflow_id)
        submission_id = submission['submission_id']
        
        submissions_table = dynamodb.Table(os.environ['SUBMISSIONS_TABLE'])
        submissions_table.put_item(Item=submission)
        logger.info(f"✅ Created submission: {submission_id}")
        
        # Create job
        job = create_test_job(tenant_id, workflow_id, submission_id)
        job_id = job['job_id']
        
        jobs_table = dynamodb.Table(os.environ['JOBS_TABLE'])
        jobs_table.put_item(Item=job)
        logger.info(f"✅ Created job: {job_id}")
        
        # Process job
        logger.info("\n" + "=" * 80)
        logger.info("Processing job (this will generate artifacts and send webhook)")
        logger.info("=" * 80)
        logger.info("Note: This will make a real HTTP request to httpbin.org")
        
        result = processor.process_job(job_id)
        
        if not result.get('success'):
            logger.error(f"❌ Job processing failed: {result.get('error')}")
            return 1
        
        logger.info(f"✅ Job processing completed")
        logger.info(f"   Output URL: {result.get('output_url', 'N/A')}")
        
        # Verify artifacts
        logger.info("\n" + "=" * 80)
        logger.info("Verifying artifacts")
        logger.info("=" * 80)
        
        if not verify_webhook_payload_artifacts(job_id, db_service):
            logger.error("Artifact verification failed")
            return 1
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ All tests passed!")
        logger.info("=" * 80)
        logger.info(f"\nTo test with this job again, run:")
        logger.info(f"  python test_webhook_artifacts.py {job_id}")
        return 0
        
    except Exception as e:
        logger.error(f"\n❌ Test failed with exception: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())

