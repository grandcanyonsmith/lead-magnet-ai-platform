#!/usr/bin/env python3
"""
Manually resend a webhook step with the correct context.
This script fetches job details, builds the proper context, and sends the webhook request.
"""

import json
import sys
import argparse
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add scripts directory to path
scripts_path = Path(__file__).parent.parent
sys.path.insert(0, str(scripts_path))

# Add backend/worker to path for imports
backend_worker_path = Path(__file__).parent.parent.parent / "backend" / "worker"
sys.path.insert(0, str(backend_worker_path))

from lib.common import (
    convert_decimals,
    get_table_name,
    get_aws_region,
    print_section,
)
from db_service import DynamoDBService
from s3_service import S3Service
from services.context_builder import ContextBuilder


def get_job_data(job_id: str, tenant_id: str) -> Dict[str, Any]:
    """Get all job-related data."""
    db_service = DynamoDBService()
    s3_service = S3Service()
    
    # Get job (with execution_steps from S3)
    job = db_service.get_job(job_id, s3_service=s3_service)
    if not job:
        raise ValueError(f"Job {job_id} not found")
    
    if job.get("tenant_id") != tenant_id:
        raise ValueError(f"Tenant ID mismatch. Expected {tenant_id}, got {job.get('tenant_id')}")
    
    # Get workflow
    workflow_id = job.get("workflow_id")
    if not workflow_id:
        raise ValueError(f"Job {job_id} has no workflow_id")
    
    workflow = db_service.get_workflow(workflow_id)
    if not workflow:
        raise ValueError(f"Workflow {workflow_id} not found")
    
    # Get submission
    submission_id = job.get("submission_id")
    if not submission_id:
        raise ValueError(f"Job {job_id} has no submission_id")
    
    submission = db_service.get_submission(submission_id)
    if not submission:
        raise ValueError(f"Submission {submission_id} not found")
    
    # Get form (optional)
    form_id = submission.get("form_id")
    form = None
    if form_id:
        form = db_service.get_form(form_id)
    
    return {
        "job": job,
        "workflow": workflow,
        "submission": submission,
        "form": form,
    }


def build_step_outputs_from_execution_steps(
    execution_steps: List[Dict[str, Any]], 
    steps: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Build step_outputs list from execution_steps."""
    from utils.step_utils import normalize_step_order
    
    step_outputs = []
    
    # Sort execution steps by order
    sorted_execution_steps = sorted(
        [s for s in execution_steps if s.get('step_type') == 'ai_generation'],
        key=normalize_step_order
    )
    
    # Map execution steps to step_outputs format
    for exec_step in sorted_execution_steps:
        step_outputs.append({
            'step_name': exec_step.get('step_name', 'Unknown'),
            'output': exec_step.get('output', ''),
            'artifact_id': exec_step.get('artifact_id'),
            'image_urls': exec_step.get('image_urls', [])
        })
    
    return step_outputs


def build_webhook_payload(
    job_id: str,
    job: Dict[str, Any],
    submission: Dict[str, Any],
    step_outputs: List[Dict[str, Any]],
    sorted_steps: List[Dict[str, Any]],
    step_index: int,
    data_selection: Dict[str, Any],
    db_service: DynamoDBService
) -> Dict[str, Any]:
    """Build webhook payload with proper context."""
    payload = {}
    
    # Build context from submission data and previous step outputs
    submission_data = submission.get('submission_data', {})
    initial_context_lines = []
    for key, value in submission_data.items():
        initial_context_lines.append(f"{key}: {value}")
    initial_context = "\n".join(initial_context_lines) if initial_context_lines else ""
    
    # Build full context including previous step outputs
    context = ContextBuilder.build_previous_context_from_step_outputs(
        initial_context=initial_context,
        step_outputs=step_outputs,
        sorted_steps=sorted_steps
    )
    
    print(f"✓ Built context ({len(context)} characters)")
    print(f"  - Initial context: {len(initial_context)} characters")
    print(f"  - Previous steps: {len(step_outputs)} steps")
    
    # Add context at root level (for direct format)
    payload['context'] = context
    
    # Include submission data if selected (default: true)
    include_submission = data_selection.get('include_submission', True)
    if include_submission:
        # Create a copy of submission_data to avoid modifying the original
        submission_data_copy = dict(submission_data)
        # Add 'icp' field to submission_data (for webhook format)
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
    
    # Include job info if selected (default: true)
    include_job_info = data_selection.get('include_job_info', True)
    if include_job_info:
        payload['job_info'] = {
            'job_id': job_id,
            'workflow_id': job.get('workflow_id'),
            'status': job.get('status'),
            'created_at': job.get('created_at'),
            'updated_at': job.get('updated_at')
        }
    
    # Query and include artifacts if db_service is available
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


def resend_webhook(job_id: str, step_index: int, tenant_id: str, dry_run: bool = False):
    """Resend a webhook step with proper context."""
    print_section("Manual Webhook Resend")
    print(f"Job ID: {job_id}")
    print(f"Step Index: {step_index}")
    print(f"Tenant ID: {tenant_id}")
    print(f"Dry Run: {dry_run}")
    print_section("")
    
    # Get job data
    print("Fetching job data...")
    data = get_job_data(job_id, tenant_id)
    job = data["job"]
    workflow = data["workflow"]
    submission = data["submission"]
    form = data["form"]
    
    print(f"✓ Job: {job.get('status')}")
    print(f"✓ Workflow: {workflow.get('workflow_name')}")
    print(f"✓ Submission: {submission.get('submission_id')}")
    
    # Get steps
    steps = workflow.get('steps', [])
    if step_index < 0 or step_index >= len(steps):
        raise ValueError(f"Invalid step index: {step_index}. Workflow has {len(steps)} steps.")
    
    step = steps[step_index]
    step_type = step.get('step_type')
    
    if step_type != 'webhook':
        raise ValueError(f"Step {step_index} is not a webhook step (type: {step_type})")
    
    webhook_url = step.get('webhook_url')
    if not webhook_url:
        raise ValueError(f"Step {step_index} has no webhook_url configured")
    
    print(f"✓ Webhook URL: {webhook_url}")
    
    # Get execution steps
    execution_steps = job.get('execution_steps', [])
    print(f"✓ Execution steps: {len(execution_steps)} steps")
    
    # Build step_outputs from execution_steps
    sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
    step_outputs = build_step_outputs_from_execution_steps(execution_steps, sorted_steps)
    print(f"✓ Step outputs: {len(step_outputs)} previous steps")
    
    # Get data selection config
    data_selection = step.get('webhook_data_selection', {})
    webhook_headers = step.get('webhook_headers', {})
    
    # Build payload
    print("\nBuilding webhook payload...")
    db_service = DynamoDBService()
    
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
    
    # Verify context is present
    if 'context' not in payload:
        raise ValueError("Payload missing 'context' field")
    
    if 'submission_data' in payload and 'icp' not in payload['submission_data']:
        raise ValueError("Payload submission_data missing 'icp' field")
    
    print(f"\n✓ Payload built successfully")
    print(f"  - Has context: {'context' in payload}")
    print(f"  - Has submission_data: {'submission_data' in payload}")
    print(f"  - Has icp in submission_data: {'icp' in payload.get('submission_data', {})}")
    print(f"  - Has step_outputs: {'step_outputs' in payload}")
    print(f"  - Has job_info: {'job_info' in payload}")
    
    if dry_run:
        print("\n" + "="*80)
        print("DRY RUN - Payload (first 2000 chars):")
        print("="*80)
        payload_str = json.dumps(payload, indent=2)
        print(payload_str[:2000])
        if len(payload_str) > 2000:
            print(f"\n... (truncated, total length: {len(payload_str)} chars)")
        return
    
    # Send webhook
    print(f"\nSending webhook request to {webhook_url}...")
    headers = {
        'Content-Type': 'application/json',
        **webhook_headers
    }
    
    try:
        # Convert Decimals to float/int for JSON serialization
        payload_serializable = convert_decimals(payload)
        
        response = requests.post(
            webhook_url,
            json=payload_serializable,
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Response Status: {response.status_code}")
        print(f"✓ Response Headers: {dict(response.headers)}")
        
        try:
            response_body = response.text
            if len(response_body) > 1000:
                print(f"✓ Response Body (first 1000 chars):\n{response_body[:1000]}...")
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
                print(f"  Response Body: {e.response.text[:500]}")
            except:
                pass
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Manually resend a webhook step with proper context"
    )
    parser.add_argument("job_id", help="Job ID")
    parser.add_argument("step_index", type=int, help="Step index (0-based)")
    parser.add_argument("tenant_id", help="Tenant ID")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build payload but don't send the request"
    )
    parser.add_argument(
        "--region",
        help="AWS region (default: from environment or us-east-1)",
        default=None,
    )
    args = parser.parse_args()
    
    if args.region:
        import os
        os.environ["AWS_REGION"] = args.region
    
    try:
        resend_webhook(
            job_id=args.job_id,
            step_index=args.step_index,
            tenant_id=args.tenant_id,
            dry_run=args.dry_run
        )
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
