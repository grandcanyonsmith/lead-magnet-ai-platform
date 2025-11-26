#!/usr/bin/env python3
"""Quick script to get job info and find webhook steps."""

import json
import sys
from pathlib import Path

# Add scripts directory to path
scripts_path = Path(__file__).parent.parent
sys.path.insert(0, str(scripts_path))

# Add backend/worker to path
backend_worker_path = Path(__file__).parent.parent.parent / "backend" / "worker"
sys.path.insert(0, str(backend_worker_path))

from lib.common import get_table_name
from db_service import DynamoDBService
from s3_service import S3Service

job_id = sys.argv[1] if len(sys.argv) > 1 else None
if not job_id:
    print("Usage: python3 get-job-info.py JOB_ID")
    sys.exit(1)

db_service = DynamoDBService()
s3_service = S3Service()

job = db_service.get_job(job_id, s3_service=s3_service)
if not job:
    print(f"Job {job_id} not found")
    sys.exit(1)

workflow_id = job.get("workflow_id")
workflow = db_service.get_workflow(workflow_id) if workflow_id else None

print(f"Job ID: {job_id}")
print(f"Tenant ID: {job.get('tenant_id')}")
print(f"Status: {job.get('status')}")
print(f"Workflow ID: {workflow_id}")
print(f"\nWorkflow Steps:")
if workflow:
    steps = workflow.get('steps', [])
    for i, step in enumerate(steps):
        step_type = step.get('step_type', 'unknown')
        step_name = step.get('step_name', f'Step {i+1}')
        webhook_url = step.get('webhook_url', '')
        print(f"  [{i}] {step_name} (type: {step_type})")
        if webhook_url:
            print(f"      Webhook URL: {webhook_url}")

execution_steps = job.get('execution_steps', [])
print(f"\nExecution Steps ({len(execution_steps)}):")
for i, exec_step in enumerate(execution_steps):
    print(f"  [{i}] {exec_step.get('step_name', 'Unknown')} - {exec_step.get('step_type', 'unknown')}")
