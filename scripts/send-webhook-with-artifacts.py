#!/usr/bin/env python3
"""
Send webhook POST request with artifacts for a completed job.
"""

import sys
import json
import requests
from pathlib import Path
from typing import List, Dict, Any

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    get_dynamodb_resource,
    get_table_name,
    get_aws_region,
    print_section,
    convert_decimals,
)

def get_job_by_artifact_ids(artifact_ids: List[str]) -> Dict[str, Any]:
    """Find the job ID associated with these artifacts."""
    dynamodb = get_dynamodb_resource()
    artifacts_table = dynamodb.Table(get_table_name("artifacts"))
    
    print("Finding job ID from artifacts...")
    
    # Get first artifact to find job_id
    if not artifact_ids:
        raise ValueError("No artifact IDs provided")
    
    first_artifact_id = artifact_ids[0]
    response = artifacts_table.get_item(Key={'artifact_id': first_artifact_id})
    
    if 'Item' not in response:
        raise ValueError(f"Artifact {first_artifact_id} not found")
    
    artifact = convert_decimals(response['Item'])
    job_id = artifact.get('job_id')
    
    if not job_id:
        raise ValueError(f"Artifact {first_artifact_id} has no job_id")
    
    print(f"✅ Found job_id: {job_id}")
    
    # Get the job
    jobs_table = dynamodb.Table(get_table_name("jobs"))
    job_response = jobs_table.get_item(Key={'job_id': job_id})
    
    if 'Item' not in job_response:
        raise ValueError(f"Job {job_id} not found")
    
    job = convert_decimals(job_response['Item'])
    return job

def get_all_artifacts_for_job(job_id: str) -> List[Dict[str, Any]]:
    """Get all artifacts for a job."""
    dynamodb = get_dynamodb_resource()
    artifacts_table = dynamodb.Table(get_table_name("artifacts"))
    
    print(f"Querying artifacts for job {job_id}...")
    
    # Query artifacts by job_id using GSI
    response = artifacts_table.query(
        IndexName='gsi_job_id',
        KeyConditionExpression='job_id = :job_id',
        ExpressionAttributeValues={':job_id': job_id}
    )
    
    artifacts = [convert_decimals(item) for item in response.get('Items', [])]
    print(f"✅ Found {len(artifacts)} artifacts")
    
    return artifacts

def get_workflow(workflow_id: str) -> Dict[str, Any]:
    """Get workflow configuration."""
    dynamodb = get_dynamodb_resource()
    workflows_table = dynamodb.Table(get_table_name("workflows"))
    
    response = workflows_table.get_item(Key={'workflow_id': workflow_id})
    
    if 'Item' not in response:
        raise ValueError(f"Workflow {workflow_id} not found")
    
    return convert_decimals(response['Item'])

def get_submission(submission_id: str) -> Dict[str, Any]:
    """Get submission data."""
    dynamodb = get_dynamodb_resource()
    submissions_table = dynamodb.Table(get_table_name("submissions"))
    
    response = submissions_table.get_item(Key={'submission_id': submission_id})
    
    if 'Item' not in response:
        raise ValueError(f"Submission {submission_id} not found")
    
    return convert_decimals(response['Item'])

def build_webhook_payload(
    job: Dict[str, Any],
    submission: Dict[str, Any],
    artifacts: List[Dict[str, Any]],
    output_url: str,
    use_profile_format: bool = False
) -> Dict[str, Any]:
    """Build webhook payload with artifacts."""
    from datetime import datetime
    
    # Categorize artifacts
    artifacts_list = []
    images_list = []
    html_files_list = []
    markdown_files_list = []
    
    for artifact in artifacts:
        # Build artifact metadata
        public_url = artifact.get('public_url') or artifact.get('s3_url') or ''
        artifact_metadata = {
            'artifact_id': artifact.get('artifact_id'),
            'artifact_type': artifact.get('artifact_type'),
            'artifact_name': artifact.get('artifact_name') or artifact.get('file_name') or '',
            'public_url': public_url,
            'object_url': public_url,
            's3_key': artifact.get('s3_key'),
            's3_url': artifact.get('s3_url'),
            'file_size_bytes': artifact.get('file_size_bytes'),
            'mime_type': artifact.get('mime_type'),
            'created_at': artifact.get('created_at')
        }
        
        # Add to all artifacts
        artifacts_list.append(artifact_metadata)
        
        # Categorize by type
        artifact_type = artifact.get('artifact_type', '').lower()
        artifact_name = (artifact_metadata['artifact_name'] or '').lower()
        
        if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            images_list.append(artifact_metadata)
        elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
            html_files_list.append(artifact_metadata)
        elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
            markdown_files_list.append(artifact_metadata)
    
    # Build payload with dynamic values from submission data
    submission_data = submission.get('submission_data', {})
    
    if use_profile_format:
        # Use profile submission format with artifacts added
        # Build profile structure from submission_data
        profile_data = submission_data.copy() if submission_data else {}
        
        payload = {
            'event': 'profile.submit',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'source': 'form_submission',
            'profile': profile_data,
            'artifacts': artifacts_list,  # Add artifacts to payload
            'images': images_list,
            'html_files': html_files_list,
            'markdown_files': markdown_files_list,
        }
    else:
        # Standard webhook format
        payload = {
            'job_id': job.get('job_id'),
            'status': 'completed',
            'output_url': output_url,
            'submission_data': submission_data,
            'lead_name': submission_data.get('name'),
            'lead_email': submission_data.get('email'),
            'lead_phone': submission_data.get('phone'),
            'completed_at': datetime.utcnow().isoformat(),
            'workflow_id': job.get('workflow_id'),
            'artifacts': artifacts_list,
            'images': images_list,
            'html_files': html_files_list,
            'markdown_files': markdown_files_list,
        }
        
        # Merge with any additional dynamic values from submission
        for key, value in submission_data.items():
            if key not in payload:
                payload[f'submission_{key}'] = value
    
    return payload

def send_webhook(
    webhook_url: str,
    webhook_headers: Dict[str, str],
    payload: Dict[str, Any]
) -> bool:
    """Send webhook POST request."""
    headers = {
        'Content-Type': 'application/json',
        **webhook_headers
    }
    
    print(f"\nSending webhook POST to: {webhook_url}")
    print(f"Payload size: {len(json.dumps(payload))} bytes")
    print(f"Artifacts count: {len(payload.get('artifacts', []))}")
    print(f"Images count: {len(payload.get('images', []))}")
    print(f"HTML files count: {len(payload.get('html_files', []))}")
    print(f"Markdown files count: {len(payload.get('markdown_files', []))}")
    
    # Try with retries
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"Attempt {attempt + 1}/{max_retries}...")
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=180  # Increased timeout for large payloads
            )
            response.raise_for_status()
            print(f"✅ Webhook sent successfully! Status: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return True
        except requests.exceptions.Timeout as e:
            if attempt < max_retries - 1:
                print(f"⚠️  Timeout on attempt {attempt + 1}, retrying...")
                continue
            else:
                print(f"❌ Failed to send webhook after {max_retries} attempts: {e}")
                print(f"   The server may be slow or unresponsive.")
                print(f"   Payload size: {len(json.dumps(payload))} bytes")
                return False
        except Exception as e:
            print(f"❌ Failed to send webhook: {e}")
            if hasattr(e, 'response') and e.response:
                print(f"Response status: {e.response.status_code}")
                print(f"Response body: {e.response.text[:500]}")
            return False
    
    return False

def main():
    """Main function."""
    import sys
    
    print_section("Send Webhook with Artifacts")
    print(f"Region: {get_aws_region()}")
    print()
    
    # Artifact IDs from user - can be overridden by command line
    artifact_ids = [
        "art_01KAYWE7EBM6D12C1F0GZWPBSF",
        "art_01KAYWF0C21V72TWTGQQF21JK2",
        "art_01KAYWFZFSVAWDZ1JYE44QDBRT",
        "art_01KAYWGR7FC13CEWTVJG3PXYY6",
        "art_01KAYWH3E4H0SHMW4RDXWCZS7B",
        "art_01KAYWHA1DH5RZW1EZB3X41M41",
        "art_01KAYWKD34WB0F2DG5HGD1X4Q5",
        "art_01KAYWM3N7YJPPRQY0F15T1N92",
        "art_01KAYWSSKSEG82QCPH0GRR2WE6",
        "art_01KAYWW1EQST6QAVX87R00P2PG",
        "art_01KAYWXB84MJACZ6ZRYE36N4FR",
        "art_01KAYWXT54VFZ07R26XXMBNZ28",
        "art_01KAYX1NSB58X6SFD446DC0Z64",
        "art_01KAYX4X82R8HPY4KYXC7VJT2S",
        "art_01KAYX4XCCHP7SN8N1M7M1ZZN6",
        "art_01KAYX7TS61S9E9BY1S659P6VK",
        "art_01KAYX7WB97JXAW9TVACS2YEJA",
    ]
    
    # Allow job_id override from command line (3rd arg)
    if len(sys.argv) > 3:
        # If job_id provided, get job directly
        job_id_override = sys.argv[3]
        print(f"Using job_id from command line: {job_id_override}")
        dynamodb = get_dynamodb_resource()
        jobs_table = dynamodb.Table(get_table_name("jobs"))
        job_response = jobs_table.get_item(Key={'job_id': job_id_override})
        if 'Item' not in job_response:
            raise ValueError(f"Job {job_id_override} not found")
        job = convert_decimals(job_response['Item'])
        job_id = job.get('job_id')
        workflow_id = job.get('workflow_id')
        submission_id = job.get('submission_id')
    else:
        print(f"Artifact IDs provided: {len(artifact_ids)}")
        # Get job
        job = get_job_by_artifact_ids(artifact_ids)
        job_id = job.get('job_id')
        workflow_id = job.get('workflow_id')
        submission_id = job.get('submission_id')
    
    print(f"Job ID: {job_id}")
    print(f"Workflow ID: {workflow_id}")
    print(f"Submission ID: {submission_id}")
    print()
    
    # Get workflow
    workflow = get_workflow(workflow_id)
    webhook_url = workflow.get('delivery_webhook_url')
    webhook_headers = workflow.get('delivery_webhook_headers', {})
    
    # Check for webhook step (check both step_type and webhook_url field)
    if not webhook_url:
        steps = workflow.get('steps', [])
        for step in steps:
            step_webhook_url = step.get('webhook_url')
            if step_webhook_url:
                webhook_url = step_webhook_url
                webhook_headers = step.get('webhook_headers', {})
                print(f"✅ Found webhook step: {step.get('step_name')}")
                print(f"   Step type: {step.get('step_type', 'ai_generation')}")
                break
    
    # Allow webhook URL from command line argument
    if len(sys.argv) > 1:
        webhook_url = sys.argv[1]
        print(f"✅ Using webhook URL from command line: {webhook_url}")
    
    if not webhook_url:
        print("❌ No webhook URL configured for this workflow!")
        print(f"   Workflow: {workflow.get('workflow_name')}")
        print(f"   Usage: python send-webhook-with-artifacts.py <webhook_url>")
        return False
    
    print(f"✅ Webhook URL: {webhook_url}")
    print()
    
    # Get submission
    submission = get_submission(submission_id)
    
    # Get all artifacts for job (if not already retrieved)
    if 'all_artifacts' not in locals():
        all_artifacts = get_all_artifacts_for_job(job_id)
    
    # Find output URL (prefer HTML final, then markdown final)
    output_url = ""
    for artifact in all_artifacts:
        artifact_type = artifact.get('artifact_type', '').lower()
        if artifact_type == 'html_final':
            output_url = artifact.get('public_url') or artifact.get('s3_url') or ''
            break
    
    if not output_url:
        for artifact in all_artifacts:
            artifact_type = artifact.get('artifact_type', '').lower()
            if artifact_type == 'markdown_final':
                output_url = artifact.get('public_url') or artifact.get('s3_url') or ''
                break
    
    if not output_url and all_artifacts:
        # Use first artifact URL
        output_url = all_artifacts[0].get('public_url') or all_artifacts[0].get('s3_url') or ''
    
    print(f"Output URL: {output_url}")
    print()
    
    # Build payload - use profile format for this specific endpoint
    use_profile_format = 'generate-from-webhook' in webhook_url.lower() or len(sys.argv) > 2 and sys.argv[2] == '--profile'
    payload = build_webhook_payload(job, submission, all_artifacts, output_url, use_profile_format)
    
    # Send webhook
    success = send_webhook(webhook_url, webhook_headers, payload)
    
    return success

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

