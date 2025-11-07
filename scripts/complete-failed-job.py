#!/usr/bin/env python3
"""
Complete a failed job by extracting the last step's output and storing it as final HTML artifact.
This is useful when ProcessHTMLStep timed out but the last workflow step completed successfully.
"""

import os
import sys
import json
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError
from ulid import new as ulid

# Set environment variables if not already set
REGION = os.environ.get('AWS_REGION', 'us-east-1')
JOBS_TABLE = os.environ.get('JOBS_TABLE', 'leadmagnet-jobs')
WORKFLOWS_TABLE = os.environ.get('WORKFLOWS_TABLE', 'leadmagnet-workflows')
ARTIFACTS_TABLE = os.environ.get('ARTIFACTS_TABLE', 'leadmagnet-artifacts')
TEMPLATES_TABLE = os.environ.get('TEMPLATES_TABLE', 'leadmagnet-templates')

# Get artifacts bucket name
try:
    sts = boto3.client('sts', region_name=REGION)
    account_id = sts.get_caller_identity()['Account']
    ARTIFACTS_BUCKET = os.environ.get('ARTIFACTS_BUCKET', f'leadmagnet-artifacts-{account_id}')
except Exception as e:
    print(f"Warning: Could not determine artifacts bucket: {e}")
    ARTIFACTS_BUCKET = os.environ.get('ARTIFACTS_BUCKET')
    if not ARTIFACTS_BUCKET:
        print("Please set ARTIFACTS_BUCKET environment variable")
        sys.exit(1)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=REGION)
s3_client = boto3.client('s3', region_name=REGION)
cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN', '').strip()


def convert_decimals(obj):
    """Convert Decimal types to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


def get_content_type(filename: str) -> str:
    """Get MIME type from filename."""
    ext = filename.split('.')[-1].lower()
    types = {
        'html': 'text/html',
        'md': 'text/markdown',
        'txt': 'text/plain',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
    }
    return types.get(ext, 'application/octet-stream')


def load_execution_steps_from_s3(s3_key: str) -> list:
    """Load execution_steps from S3."""
    try:
        response = s3_client.get_object(Bucket=ARTIFACTS_BUCKET, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        print(f"Error loading execution_steps from S3: {e}")
        return []


def upload_artifact_to_s3(tenant_id: str, job_id: str, filename: str, content: str) -> tuple:
    """Upload artifact to S3 and return S3 URL and public URL."""
    s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
    content_type = get_content_type(filename)
    
    # Upload to S3 (without ACL - bucket policy handles public access)
    s3_client.put_object(
        Bucket=ARTIFACTS_BUCKET,
        Key=s3_key,
        Body=content.encode('utf-8'),
        ContentType=content_type
    )
    
    s3_url = f"s3://{ARTIFACTS_BUCKET}/{s3_key}"
    
    # Generate public URL (CloudFront or presigned S3 URL)
    if cloudfront_domain:
        public_url = f"https://{cloudfront_domain}/{s3_key}"
    else:
        # Generate presigned URL as fallback (valid for 1 year)
        public_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': ARTIFACTS_BUCKET, 'Key': s3_key},
            ExpiresIn=31536000  # 1 year
        )
    
    return s3_url, public_url


def store_artifact(tenant_id: str, job_id: str, artifact_type: str, content: str, filename: str) -> tuple:
    """Store artifact in S3 and DynamoDB, return artifact_id and public_url."""
    artifact_id = f"art_{ulid()}"
    
    # Upload to S3
    s3_url, public_url = upload_artifact_to_s3(tenant_id, job_id, filename, content)
    
    # Create artifact record
    artifact = {
        'artifact_id': artifact_id,
        'tenant_id': tenant_id,
        'job_id': job_id,
        'artifact_type': artifact_type,
        'artifact_name': filename,
        's3_key': f"{tenant_id}/jobs/{job_id}/{filename}",
        's3_url': s3_url,
        'public_url': public_url,
        'is_public': True,
        'file_size_bytes': len(content.encode('utf-8')),
        'mime_type': get_content_type(filename),
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Store in DynamoDB
    artifacts_table = dynamodb.Table(ARTIFACTS_TABLE)
    artifacts_table.put_item(Item=artifact)
    
    return artifact_id, public_url


def complete_failed_job(job_id: str):
    """Complete a failed job by extracting last step output."""
    print(f"=" * 60)
    print(f"Completing Failed Job")
    print(f"=" * 60)
    print(f"Job ID: {job_id}")
    print(f"=" * 60)
    
    jobs_table = dynamodb.Table(JOBS_TABLE)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    
    # Get job
    print(f"\n1. Fetching job {job_id}...")
    try:
        response = jobs_table.get_item(Key={'job_id': job_id})
        if 'Item' not in response:
            print(f"✗ Error: Job {job_id} not found")
            return False
        job = response['Item']
    except Exception as e:
        print(f"✗ Error fetching job: {e}")
        return False
    
    print(f"✓ Job found")
    print(f"  Status: {job.get('status')}")
    print(f"  Tenant ID: {job.get('tenant_id')}")
    print(f"  Workflow ID: {job.get('workflow_id')}")
    
    if job.get('status') == 'completed':
        print(f"\n✓ Job is already completed!")
        if job.get('output_url'):
            print(f"  Output URL: {job.get('output_url')}")
        return True
    
    # Get workflow
    workflow_id = job.get('workflow_id')
    if not workflow_id:
        print(f"✗ Error: Job has no workflow_id")
        return False
    
    print(f"\n2. Fetching workflow {workflow_id}...")
    try:
        response = workflows_table.get_item(Key={'workflow_id': workflow_id})
        if 'Item' not in response:
            print(f"✗ Error: Workflow {workflow_id} not found")
            return False
        workflow = response['Item']
    except Exception as e:
        print(f"✗ Error fetching workflow: {e}")
        return False
    
    print(f"✓ Workflow found")
    template_id = workflow.get('template_id')
    if template_id:
        print(f"  Template ID: {template_id}")
    else:
        print(f"  ⚠ No template ID found - job may not have HTML output")
    
    # Get execution steps
    execution_steps = job.get('execution_steps', [])
    
    # If execution_steps is stored in S3, load it
    if job.get('execution_steps_s3_key') and not execution_steps:
        print(f"\n  Loading execution_steps from S3...")
        execution_steps = load_execution_steps_from_s3(job['execution_steps_s3_key'])
    
    if not execution_steps:
        print(f"\n✗ Error: Job has no execution_steps")
        return False
    
    print(f"\n3. Analyzing execution steps...")
    print(f"  Total steps: {len(execution_steps)}")
    
    # Find the last successfully completed step (check all step types, prioritize HTML output)
    last_step = None
    last_step_index = -1
    
    # First pass: look for steps with HTML output
    for i, step in enumerate(execution_steps):
        step_output = step.get('output', '')
        if isinstance(step_output, str) and step_output and ('<html' in step_output.lower() or '<!doctype' in step_output.lower()):
            last_step = step
            last_step_index = i
            print(f"  Step {i+1}: {step.get('step_name', 'Unknown')} (HTML output found)")
    
    # If no HTML step found, get the last AI generation step
    if not last_step:
        for i, step in enumerate(execution_steps):
            if step.get('step_type') == 'ai_generation':
                if step.get('step_name'):
                    last_step = step
                    last_step_index = i
                    print(f"  Step {i+1}: {step.get('step_name')} (completed)")
    
    # If still no step found, get the last step with output
    if not last_step:
        for i, step in enumerate(execution_steps):
            if step.get('output'):
                last_step = step
                last_step_index = i
                print(f"  Step {i+1}: {step.get('step_name', 'Unknown')} (has output)")
    
    if not last_step:
        print(f"\n✗ Error: No completed steps with output found")
        return False
    
    print(f"\n✓ Found last completed step:")
    print(f"  Step Name: {last_step.get('step_name')}")
    print(f"  Step Order: {last_step.get('step_order')}")
    print(f"  Model: {last_step.get('model')}")
    
    # Get step output
    step_output = last_step.get('output', '')
    
    # Handle case where output might be a dict
    if isinstance(step_output, dict):
        step_output = step_output.get('output_text', '') or step_output.get('text', '') or str(step_output)
    
    if not step_output or not isinstance(step_output, str):
        print(f"\n✗ Error: Last step has no valid output (got {type(step_output)})")
        return False
    
    print(f"\n4. Step output found:")
    print(f"  Length: {len(step_output)} characters")
    print(f"  Starts with: {step_output[:100]}...")
    
    # Check if output looks like HTML
    is_html = step_output.strip().startswith('<') or '<html' in step_output.lower() or '<!doctype' in step_output.lower()
    print(f"  Looks like HTML: {is_html}")
    
    if not is_html:
        print(f"\n⚠ Warning: Step output doesn't look like HTML")
        print(f"  Proceeding anyway...")
    
    # Check if template exists
    if not template_id:
        print(f"\n⚠ Warning: No template_id in workflow")
        print(f"  Will store as markdown artifact instead")
        artifact_type = 'markdown_final'
        filename = 'final.md'
    else:
        # Verify template exists and is published
        try:
            templates_table = dynamodb.Table(TEMPLATES_TABLE)
            response = templates_table.get_item(Key={'template_id': template_id})
            if 'Item' in response:
                template = response['Item']
                if template.get('is_published', False):
                    print(f"\n✓ Template found and published")
                    artifact_type = 'html_final'
                    filename = 'final.html'
                else:
                    print(f"\n⚠ Warning: Template not published")
                    print(f"  Will store as markdown artifact instead")
                    artifact_type = 'markdown_final'
                    filename = 'final.md'
            else:
                print(f"\n⚠ Warning: Template not found")
                print(f"  Will store as HTML artifact anyway")
                artifact_type = 'html_final'
                filename = 'final.html'
        except Exception as e:
            print(f"\n⚠ Warning: Could not verify template: {e}")
            print(f"  Will store as HTML artifact anyway")
            artifact_type = 'html_final'
            filename = 'final.html'
    
    # Store final artifact
    print(f"\n5. Storing final artifact...")
    print(f"  Type: {artifact_type}")
    print(f"  Filename: {filename}")
    
    try:
        final_artifact_id, public_url = store_artifact(
            tenant_id=job['tenant_id'],
            job_id=job_id,
            artifact_type=artifact_type,
            content=step_output,
            filename=filename
        )
        
        print(f"✓ Artifact stored: {final_artifact_id}")
        print(f"✓ Public URL: {public_url}")
        
    except Exception as e:
        print(f"\n✗ Error storing artifact: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Update job status
    print(f"\n6. Updating job status...")
    
    artifacts_list = job.get('artifacts', [])
    if isinstance(artifacts_list, list):
        if final_artifact_id not in artifacts_list:
            artifacts_list.append(final_artifact_id)
    else:
        artifacts_list = [final_artifact_id]
    
    try:
        jobs_table.update_item(
            Key={'job_id': job_id},
            UpdateExpression='SET #status = :status, output_url = :output_url, artifacts = :artifacts, completed_at = :completed_at, updated_at = :updated_at',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': 'completed',
                ':output_url': public_url,
                ':artifacts': artifacts_list,
                ':completed_at': datetime.utcnow().isoformat(),
                ':updated_at': datetime.utcnow().isoformat()
            }
        )
        
        print(f"✓ Job status updated to 'completed'")
        print(f"✓ Output URL: {public_url}")
        
    except Exception as e:
        print(f"\n✗ Error updating job: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print(f"\n" + "=" * 60)
    print(f"✓ Job completed successfully!")
    print(f"=" * 60)
    print(f"Job ID: {job_id}")
    print(f"Output URL: {public_url}")
    print(f"Artifact ID: {final_artifact_id}")
    print(f"=" * 60)
    
    return True


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Complete a failed job by extracting last step output")
    parser.add_argument("job_id", help="Job ID to complete")
    args = parser.parse_args()
    
    success = complete_failed_job(args.job_id)
    
    if not success:
        print("\n✗ Failed to complete job")
        sys.exit(1)
    
    print("\n✓ Done!")


if __name__ == "__main__":
    main()
