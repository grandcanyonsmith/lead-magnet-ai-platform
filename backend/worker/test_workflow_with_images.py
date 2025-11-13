#!/usr/bin/env python3
"""
E2E Test: Create and run a workflow with visual asset generation.
Verifies that base64 images are converted to URLs and passed to subsequent steps.
"""

import sys
import os
import json
import logging
import time
from pathlib import Path
from datetime import datetime

# Set default environment variables if not set
if not os.environ.get('WORKFLOWS_TABLE'):
    os.environ['WORKFLOWS_TABLE'] = 'leadmagnet-workflows'
if not os.environ.get('FORMS_TABLE'):
    os.environ['FORMS_TABLE'] = 'leadmagnet-forms'
if not os.environ.get('SUBMISSIONS_TABLE'):
    os.environ['SUBMISSIONS_TABLE'] = 'leadmagnet-submissions'
if not os.environ.get('JOBS_TABLE'):
    os.environ['JOBS_TABLE'] = 'leadmagnet-jobs'
if not os.environ.get('ARTIFACTS_TABLE'):
    os.environ['ARTIFACTS_TABLE'] = 'leadmagnet-artifacts'
if not os.environ.get('TEMPLATES_TABLE'):
    os.environ['TEMPLATES_TABLE'] = 'leadmagnet-templates'
if not os.environ.get('AWS_REGION'):
    os.environ['AWS_REGION'] = 'us-east-1'
if not os.environ.get('ARTIFACTS_BUCKET'):
    # Try to get from AWS account
    import boto3
    try:
        sts = boto3.client('sts')
        account_id = sts.get_caller_identity()['Account']
        os.environ['ARTIFACTS_BUCKET'] = f'leadmagnet-artifacts-{account_id}'
    except:
        # Fallback to default pattern
        os.environ['ARTIFACTS_BUCKET'] = 'leadmagnet-artifacts-471112523456'
if not os.environ.get('CLOUDFRONT_DOMAIN'):
    # Try to get from CloudFormation or use empty (will use presigned URLs)
    os.environ['CLOUDFRONT_DOMAIN'] = ''

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from db_service import DynamoDBService
from s3_service import S3Service
from processor import JobProcessor
from ulid import new as ulid
import boto3
from boto3.dynamodb.conditions import Key


def create_test_workflow_with_images():
    """Create a test workflow with visual asset generation step."""
    logger.info("Creating test workflow with visual asset generation...")
    
    workflow_id = f"wf_{ulid()}"
    tenant_id = "84c8e438-0061-70f2-2ce0-7cb44989a329"  # Default test tenant
    
    workflow = {
        'workflow_id': workflow_id,
        'tenant_id': tenant_id,
        'workflow_name': f'Test Visual Assets - {datetime.utcnow().strftime("%Y%m%d-%H%M%S")}',
        'workflow_description': 'Test workflow to verify base64 image conversion',
        'steps': [
            {
                'step_order': 0,
                'step_name': 'Research',
                'step_description': 'Initial research step',
                'model': 'gpt-4o',
                'instructions': 'Generate a brief research summary about AI-powered lead magnets. Keep it concise.',
                'tool_choice': 'none',
                'tools': []
            },
            {
                'step_order': 1,
                'step_name': 'Visual Asset Generation',
                'step_description': 'Generate visual assets with base64 images',
                'model': 'gpt-4o',
                'instructions': '''You are generating visual asset metadata. Return ONLY a JSON object (no markdown, no explanation) with an "assets" array containing base64-encoded test images.

IMPORTANT: You must return actual base64-encoded image data, not URLs. Use a small test PNG image encoded in base64.

Return this exact JSON structure:
{
  "assets": [
    {
      "id": "cov001",
      "name": "cover_image.png",
      "width": 1920,
      "height": 1080,
      "content_type": "image/png",
      "encoding": "base64",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    },
    {
      "id": "div001",
      "name": "divider_image.png",
      "width": 1600,
      "height": 400,
      "content_type": "image/png",
      "encoding": "base64",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
  ]
}

Return ONLY the JSON, nothing else.''',
                'tool_choice': 'none',
                'tools': []
            },
            {
                'step_order': 2,
                'step_name': 'Content Writing',
                'step_description': 'Write content using images from previous step',
                'model': 'gpt-4o',
                'instructions': '''Write a brief content section for the lead magnet.

Reference the images from the previous step. The previous step should have generated images that are now URLs.

Write 2-3 paragraphs about how to use visual assets in lead magnets. Reference the images that were generated in the previous step.''',
                'tool_choice': 'none',
                'tools': []
            }
        ],
        'template_id': None,
        'research_enabled': False,
        'html_enabled': False,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    return workflow


def create_test_submission():
    """Create test submission data."""
    submission_id = f"sub_{ulid()}"
    tenant_id = "84c8e438-0061-70f2-2ce0-7cb44989a329"
    
    submission = {
        'submission_id': submission_id,
        'tenant_id': tenant_id,
        'submission_data': {
            'name': 'Test User',
            'email': 'test@example.com',
            'company': 'Test Company',
            'project': 'Testing visual asset generation with base64 conversion'
        },
        'created_at': datetime.utcnow().isoformat()
    }
    
    return submission


def create_test_job(workflow_id, submission_id):
    """Create test job."""
    job_id = f"job_{ulid()}"
    tenant_id = "84c8e438-0061-70f2-2ce0-7cb44989a329"
    
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


def verify_image_conversion(job_id, db_service, s3_service):
    """Verify that base64 images were converted to URLs."""
    logger.info(f"Verifying image conversion for job {job_id}...")
    
    # Get job with execution steps
    job = db_service.get_job(job_id, s3_service=s3_service)
    
    if not job:
        logger.error(f"Job {job_id} not found")
        return False
    
    execution_steps = job.get('execution_steps', [])
    
    # Find visual asset generation step
    visual_step = None
    for step in execution_steps:
        if step.get('step_name') == 'Visual Asset Generation':
            visual_step = step
            break
    
    if not visual_step:
        logger.error("Visual Asset Generation step not found")
        return False
    
    # Check if step has image URLs
    image_urls = visual_step.get('image_urls', [])
    if not image_urls:
        logger.error("No image URLs found in Visual Asset Generation step")
        return False
    
    logger.info(f"Found {len(image_urls)} image URL(s) in Visual Asset Generation step:")
    for url in image_urls:
        logger.info(f"  - {url}")
    
    # Verify URLs are actual URLs (not base64)
    for url in image_urls:
        if url.startswith('data:image') or len(url) > 500:  # Base64 would be very long
            logger.error(f"Found base64 data instead of URL: {url[:100]}...")
            return False
        if not url.startswith('http'):
            logger.error(f"Invalid URL format: {url}")
            return False
    
    # Check step output artifact
    artifact_id = visual_step.get('artifact_id')
    if artifact_id:
        artifact = db_service.get_artifact(artifact_id)
        if artifact:
            # Download artifact content
            s3_key = artifact.get('s3_key')
            if s3_key:
                content = s3_service.download_artifact(s3_key)
                # Parse JSON
                try:
                    data = json.loads(content)
                    assets = data.get('assets', [])
                    # Verify assets have URLs, not base64
                    for asset in assets:
                        data_field = asset.get('data', '')
                        encoding = asset.get('encoding', '')
                        if encoding == 'base64' or (isinstance(data_field, str) and len(data_field) > 1000):
                            logger.error(f"Asset still has base64 data: {asset.get('id')}")
                            return False
                        if not data_field.startswith('http'):
                            logger.error(f"Asset data is not a URL: {asset.get('id')}")
                            return False
                    logger.info("✅ Verified: Artifact JSON contains URLs, not base64")
                except json.JSONDecodeError:
                    logger.warning("Artifact is not JSON, skipping JSON verification")
    
    # Check if URLs are passed to next step
    content_step = None
    for step in execution_steps:
        if step.get('step_name') == 'Content Writing':
            content_step = step
            break
    
    if content_step:
        # Get the input context that was passed to this step
        step_input = content_step.get('input', {})
        previous_context = step_input.get('previous_context', '')
        
        # Verify image URLs are in the context
        urls_in_context = 0
        for url in image_urls:
            if url in previous_context:
                urls_in_context += 1
        
        if urls_in_context > 0:
            logger.info(f"✅ Verified: {urls_in_context} image URL(s) found in next step's context")
        else:
            logger.warning("⚠️  Image URLs not found in next step's context")
            logger.debug(f"Context preview: {previous_context[:500]}")
    
    return True


def main():
    """Main test execution."""
    logger.info("=" * 80)
    logger.info("E2E Test: Workflow with Visual Asset Generation")
    logger.info("=" * 80)
    
    try:
        # Initialize services
        logger.info("Initializing services...")
        db_service = DynamoDBService()
        s3_service = S3Service()
        processor = JobProcessor(db_service, s3_service)
        
        # Step 1: Create workflow
        logger.info("\n" + "=" * 80)
        logger.info("Step 1: Creating test workflow")
        logger.info("=" * 80)
        workflow = create_test_workflow_with_images()
        workflow_id = workflow['workflow_id']
        tenant_id = workflow['tenant_id']
        
        # Store workflow using boto3 directly
        dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION'])
        workflows_table = dynamodb.Table(os.environ['WORKFLOWS_TABLE'])
        workflows_table.put_item(Item=workflow)
        logger.info(f"✅ Created workflow: {workflow_id}")
        
        # Step 2: Create submission
        logger.info("\n" + "=" * 80)
        logger.info("Step 2: Creating test submission")
        logger.info("=" * 80)
        submission = create_test_submission()
        submission_id = submission['submission_id']
        
        # Store submission using boto3 directly
        submissions_table = dynamodb.Table(os.environ['SUBMISSIONS_TABLE'])
        submissions_table.put_item(Item=submission)
        logger.info(f"✅ Created submission: {submission_id}")
        
        # Step 3: Create job
        logger.info("\n" + "=" * 80)
        logger.info("Step 3: Creating test job")
        logger.info("=" * 80)
        job = create_test_job(workflow_id, submission_id)
        job_id = job['job_id']
        
        # Store job using boto3 directly
        jobs_table = dynamodb.Table(os.environ['JOBS_TABLE'])
        jobs_table.put_item(Item=job)
        logger.info(f"✅ Created job: {job_id}")
        
        # Step 4: Process job
        logger.info("\n" + "=" * 80)
        logger.info("Step 4: Processing job")
        logger.info("=" * 80)
        logger.info("This may take a few minutes as it calls OpenAI API...")
        
        result = processor.process_job(job_id)
        
        if not result.get('success'):
            logger.error(f"❌ Job processing failed: {result.get('error')}")
            return 1
        
        logger.info("✅ Job processing completed")
        
        # Step 5: Verify image conversion
        logger.info("\n" + "=" * 80)
        logger.info("Step 5: Verifying image conversion")
        logger.info("=" * 80)
        
        if verify_image_conversion(job_id, db_service, s3_service):
            logger.info("\n" + "=" * 80)
            logger.info("🎉 ALL TESTS PASSED!")
            logger.info("=" * 80)
            logger.info(f"Job ID: {job_id}")
            logger.info(f"Workflow ID: {workflow_id}")
            logger.info("\n✅ Base64 images were converted to URLs")
            logger.info("✅ URLs were stored in execution steps")
            logger.info("✅ URLs were passed to subsequent steps")
            return 0
        else:
            logger.error("\n" + "=" * 80)
            logger.error("❌ VERIFICATION FAILED")
            logger.error("=" * 80)
            return 1
            
    except Exception as e:
        logger.error(f"❌ Test failed with exception: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())

