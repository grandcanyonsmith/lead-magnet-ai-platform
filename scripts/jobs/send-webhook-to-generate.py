#!/usr/bin/env python3
"""Send webhook to /api/clients/generate endpoint."""

import json
import sys
import requests
from pathlib import Path

# Add scripts directory to path
scripts_path = Path(__file__).parent.parent
sys.path.insert(0, str(scripts_path))

# Add backend/worker to path
backend_worker_path = Path(__file__).parent.parent.parent / "backend" / "worker"
sys.path.insert(0, str(backend_worker_path))

from lib.common import convert_decimals, print_section
from db_service import DynamoDBService
from s3_service import S3Service
from services.context_builder import ContextBuilder


def build_step_outputs_from_execution_steps(execution_steps, steps):
    """Build step_outputs list from execution_steps."""
    from utils.step_utils import normalize_step_order
    
    step_outputs = []
    sorted_execution_steps = sorted(
        [s for s in execution_steps if s.get('step_type') == 'ai_generation'],
        key=normalize_step_order
    )
    
    for exec_step in sorted_execution_steps:
        step_outputs.append({
            'step_name': exec_step.get('step_name', 'Unknown'),
            'output': exec_step.get('output', ''),
            'artifact_id': exec_step.get('artifact_id'),
            'image_urls': exec_step.get('image_urls', [])
        })
    
    return step_outputs


def build_webhook_payload(job_id, job, submission, step_outputs, sorted_steps, step_index, data_selection, db_service):
    """Build webhook payload with proper context."""
    payload = {}
    
    # Build context
    submission_data = submission.get('submission_data', {})
    initial_context_lines = []
    for key, value in submission_data.items():
        initial_context_lines.append(f"{key}: {value}")
    initial_context = "\n".join(initial_context_lines) if initial_context_lines else ""
    
    context = ContextBuilder.build_previous_context_from_step_outputs(
        initial_context=initial_context,
        step_outputs=step_outputs,
        sorted_steps=sorted_steps
    )
    
    # Add context at root level (for direct format)
    payload['context'] = context
    
    # Include submission data
    include_submission = data_selection.get('include_submission', True)
    if include_submission:
        submission_data_copy = dict(submission_data)
        submission_data_copy['icp'] = context
        payload['submission_data'] = submission_data_copy
    
    # Include step outputs
    exclude_step_indices = set(data_selection.get('exclude_step_indices', []))
    step_outputs_dict = {}
    
    for i, step_output in enumerate(step_outputs):
        if i not in exclude_step_indices and i < step_index:
            step_name = sorted_steps[i].get('step_name', f'Step {i}') if i < len(sorted_steps) else f'Step {i}'
            step_outputs_dict[f'step_{i}'] = {
                'step_name': step_name,
                'step_index': i,
                'output': step_output.get('output', ''),
                'artifact_id': step_output.get('artifact_id'),
                'image_urls': step_output.get('image_urls', [])
            }
    
    if step_outputs_dict:
        payload['step_outputs'] = step_outputs_dict
    
    # Include job info
    include_job_info = data_selection.get('include_job_info', True)
    if include_job_info:
        payload['job_info'] = {
            'job_id': job_id,
            'workflow_id': job.get('workflow_id'),
            'status': job.get('status'),
            'created_at': job.get('created_at'),
            'updated_at': job.get('updated_at')
        }
    
    # Query artifacts
    try:
        all_artifacts = db_service.query_artifacts_by_job_id(job_id)
        artifacts_list = []
        images_list = []
        html_files_list = []
        markdown_files_list = []
        
        for artifact in all_artifacts:
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
            
            artifacts_list.append(artifact_metadata)
            artifact_type = artifact.get('artifact_type', '').lower()
            artifact_name = (artifact_metadata['artifact_name'] or '').lower()
            
            if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                images_list.append(artifact_metadata)
            elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
                html_files_list.append(artifact_metadata)
            elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
                markdown_files_list.append(artifact_metadata)
        
        if artifacts_list:
            payload['artifacts'] = artifacts_list
            payload['images'] = images_list
            payload['html_files'] = html_files_list
            payload['markdown_files'] = markdown_files_list
    except Exception as e:
        print(f"⚠ Warning: Could not query artifacts: {e}")
    
    return payload


def main():
    job_id = "job_01KB0DP9YB6HDJHXCGDDEM6RGY"
    step_index = 15
    tenant_id = "cust_84c8e438"
    webhook_url = "https://template-docs-grandcanyonsmit.replit.app/api/clients/generate"
    
    print_section("Send Webhook to /api/clients/generate")
    print(f"Job ID: {job_id}")
    print(f"Step Index: {step_index}")
    print(f"Webhook URL: {webhook_url}")
    print_section("")
    
    # Get job data
    print("Fetching job data...")
    db_service = DynamoDBService()
    s3_service = S3Service()
    
    job = db_service.get_job(job_id, s3_service=s3_service)
    if not job:
        print(f"✗ Job {job_id} not found")
        sys.exit(1)
    
    workflow_id = job.get("workflow_id")
    workflow = db_service.get_workflow(workflow_id) if workflow_id else None
    
    submission_id = job.get("submission_id")
    submission = db_service.get_submission(submission_id) if submission_id else None
    
    if not workflow or not submission:
        print("✗ Could not load workflow or submission")
        sys.exit(1)
    
    print(f"✓ Job: {job.get('status')}")
    print(f"✓ Workflow: {workflow.get('workflow_name')}")
    
    # Get steps
    steps = workflow.get('steps', [])
    step = steps[step_index] if step_index < len(steps) else None
    if not step:
        print(f"✗ Step {step_index} not found")
        sys.exit(1)
    
    # Build step_outputs
    execution_steps = job.get('execution_steps', [])
    sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
    step_outputs = build_step_outputs_from_execution_steps(execution_steps, sorted_steps)
    print(f"✓ Step outputs: {len(step_outputs)} previous steps")
    
    # Get data selection config
    data_selection = step.get('webhook_data_selection', {})
    webhook_headers = step.get('webhook_headers', {})
    
    # Build payload
    print("\nBuilding webhook payload...")
    payload = build_webhook_payload(
        job_id=job_id,
        job=job,
        submission=submission,
        step_outputs=step_outputs,
        sorted_steps=sorted_steps,
        step_index=step_index,
        data_selection=data_selection,
        db_service=db_service
    )
    
    print(f"✓ Payload built")
    print(f"  - Has context: {'context' in payload}")
    print(f"  - Has submission_data: {'submission_data' in payload}")
    print(f"  - Has icp in submission_data: {'icp' in payload.get('submission_data', {})}")
    
    # Send webhook
    print(f"\nSending webhook request to {webhook_url}...")
    headers = {
        'Content-Type': 'application/json',
        **webhook_headers
    }
    
    try:
        payload_serializable = convert_decimals(payload)
        response = requests.post(
            webhook_url,
            json=payload_serializable,
            headers=headers,
            timeout=120  # Increased timeout for processing
        )
        
        print(f"✓ Response Status: {response.status_code}")
        
        try:
            response_body = response.text
            if len(response_body) > 2000:
                print(f"✓ Response Body (first 2000 chars):\n{response_body[:2000]}...")
            else:
                print(f"✓ Response Body:\n{response_body}")
        except Exception as e:
            print(f"⚠ Could not read response body: {e}")
        
        response.raise_for_status()
        print("\n✓ Webhook sent successfully!")
        
    except requests.exceptions.RequestException as e:
        print(f"\n✗ Webhook request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Status Code: {e.response.status_code}")
            try:
                print(f"  Response Body: {e.response.text[:1000]}")
            except:
                pass
        raise


if __name__ == "__main__":
    main()
