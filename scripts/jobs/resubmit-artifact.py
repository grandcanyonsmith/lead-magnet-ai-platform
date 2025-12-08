#!/usr/bin/env python3
"""
Resubmit a specific artifact by finding its step index and calling the rerun API.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Optional, Dict, Any

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    convert_decimals,
    get_dynamodb_resource,
    get_table_name,
    print_section,
)

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get job from DynamoDB."""
    dynamodb = get_dynamodb_resource()
    jobs_table = dynamodb.Table(get_table_name("jobs"))
    
    try:
        response = jobs_table.get_item(Key={"job_id": job_id})
        if "Item" not in response:
            return None
        return convert_decimals(response["Item"])
    except Exception as e:
        print(f"❌ Error fetching job: {e}")
        return None

def find_step_by_artifact_id(job: Dict[str, Any], artifact_id: str) -> Optional[int]:
    """Find the step index that produced the given artifact ID."""
    execution_steps = job.get("execution_steps", [])
    
    if not execution_steps:
        # Try to load from S3 if execution_steps_s3_key exists
        execution_steps_s3_key = job.get("execution_steps_s3_key")
        if execution_steps_s3_key:
            print(f"⚠️  Execution steps stored in S3: {execution_steps_s3_key}")
            print(f"   You may need to check the S3 file to find the step index")
            return None
    
    # Search through execution steps for the artifact ID
    for i, step in enumerate(execution_steps):
        step_artifact_id = step.get("artifact_id")
        if step_artifact_id == artifact_id:
            # Get step_order (1-indexed) or step_index (0-indexed)
            step_order = step.get("step_order")
            step_index = step.get("step_index")
            step_name = step.get("step_name", f"Step {i}")
            
            print(f"✅ Found artifact in step:")
            print(f"   Step Name: {step_name}")
            print(f"   Step Order: {step_order}")
            print(f"   Step Index: {step_index}")
            print(f"   Artifact ID: {step_artifact_id}")
            
            # Return step_index if available, otherwise calculate from step_order
            # step_order is 1-indexed, step_index is 0-indexed
            # step_order 1 = form submission (step_index -1, but we skip it)
            # step_order 2 = first workflow step (step_index 0)
            if step_index is not None:
                return step_index
            elif step_order is not None:
                # step_order 1 is form submission, step_order 2+ are workflow steps
                # So step_order 2 = step_index 0, step_order 3 = step_index 1, etc.
                if step_order >= 2:
                    return step_order - 2
                else:
                    print(f"⚠️  Step order {step_order} is form submission, not a workflow step")
                    return None
            else:
                # Fallback: use position in execution_steps array
                # Skip form submission (usually first)
                if i == 0 and step.get("step_type") == "form_submission":
                    print(f"⚠️  First step is form submission, checking next steps...")
                    continue
                # Return index relative to workflow steps (skip form submission)
                form_submission_count = sum(1 for s in execution_steps[:i] if s.get("step_type") == "form_submission")
                return i - form_submission_count
    
    print(f"❌ Artifact {artifact_id} not found in execution steps")
    print(f"   Available artifact IDs:")
    for i, step in enumerate(execution_steps):
        if step.get("artifact_id"):
            print(f"   - Step {i}: {step.get('step_name', 'Unknown')} -> {step.get('artifact_id')}")
    return None

def call_rerun_api(job_id: str, step_index: int, tenant_id: str, continue_after: bool = False):
    """Call the rerun API endpoint via Step Functions."""
    from lib.common import get_stepfunctions_client, get_step_functions_arn
    import boto3
    from botocore.exceptions import ClientError
    
    sfn = get_stepfunctions_client()
    sm_arn = get_step_functions_arn()
    
    if not sm_arn:
        print("❌ Could not find Step Functions state machine ARN")
        return False
    
    # Get job to get required fields
    job = get_job(job_id)
    if not job:
        print(f"❌ Job {job_id} not found")
        return False
    
    action = "process_single_step_and_continue" if continue_after else "process_single_step"
    
    execution_input = {
        "job_id": job_id,
        "tenant_id": tenant_id or job.get("tenant_id"),
        "workflow_id": job.get("workflow_id"),
        "submission_id": job.get("submission_id"),
        "step_index": step_index,
        "step_type": "workflow_step",
        "action": action,
        "continue_after": continue_after,
    }
    
    try:
        import time
        execution = sfn.start_execution(
            stateMachineArn=sm_arn,
            name=f"rerun-{job_id}-step{step_index}-{int(time.time())}",
            input=json.dumps(execution_input)
        )
        
        print(f"✅ Started Step Functions execution for step rerun")
        print(f"   Execution ARN: {execution['executionArn']}")
        print(f"   Action: {action}")
        print(f"   Continue After: {continue_after}")
        return True
    except Exception as e:
        print(f"❌ Error starting Step Functions execution: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Resubmit a specific artifact by finding its step and rerunning it"
    )
    parser.add_argument("job_id", help="Job ID")
    parser.add_argument("artifact_id", help="Artifact ID to resubmit")
    parser.add_argument("--tenant-id", help="Tenant ID (optional, will use job's tenant_id if not provided)")
    parser.add_argument("--continue-after", action="store_true", help="Continue processing remaining steps after rerun")
    parser.add_argument("--step-index", type=int, help="Step index to rerun (if known, skips artifact lookup)")
    
    args = parser.parse_args()
    
    print_section("Resubmitting Artifact")
    print(f"Job ID: {args.job_id}")
    print(f"Artifact ID: {args.artifact_id}")
    
    # Get job
    job = get_job(args.job_id)
    if not job:
        print(f"❌ Job {args.job_id} not found")
        sys.exit(1)
    
    tenant_id = args.tenant_id or job.get("tenant_id")
    if not tenant_id:
        print("❌ Tenant ID not found. Please provide --tenant-id")
        sys.exit(1)
    
    # Find step index
    if args.step_index is not None:
        step_index = args.step_index
        print(f"✅ Using provided step index: {step_index}")
    else:
        print(f"\n🔍 Finding step for artifact {args.artifact_id}...")
        step_index = find_step_by_artifact_id(job, args.artifact_id)
        
        if step_index is None:
            print(f"\n❌ Could not determine step index for artifact {args.artifact_id}")
            print(f"\n💡 You can manually specify the step index using --step-index")
            print(f"   Step indices are 0-indexed (0 = first workflow step, 1 = second, etc.)")
            sys.exit(1)
    
    # Call rerun API
    print(f"\n🚀 Rerunning step {step_index}...")
    success = call_rerun_api(args.job_id, step_index, tenant_id, args.continue_after)
    
    if success:
        print_section("✅ Step rerun initiated successfully!")
        print(f"   Job ID: {args.job_id}")
        print(f"   Step Index: {step_index}")
        print(f"   Continue After: {args.continue_after}")
    else:
        print_section("❌ Failed to initiate step rerun")
        sys.exit(1)

if __name__ == "__main__":
    main()
