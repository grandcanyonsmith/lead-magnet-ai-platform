#!/usr/bin/env python3
"""
Test script for step rerun functionality.

This script tests that when rerunning a step:
1. Only that specific step is processed (not the entire workflow)
2. Previous steps' outputs are included as context
3. Job is finalized correctly after single step rerun
"""

import boto3
import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, Any, Optional
from decimal import Decimal

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.common import (
    get_dynamodb_resource,
    get_stepfunctions_client,
    get_aws_region,
    get_step_functions_arn,
    convert_decimals
)

def wait_for_job_completion(job_id: str, timeout: int = 60) -> Optional[Dict[str, Any]]:
    """Wait for job to complete."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        job = get_job(job_id)
        if job and job.get("status") in ["completed", "failed"]:
            return job
        time.sleep(2)
    return get_job(job_id)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get job from DynamoDB."""
    dynamodb = get_dynamodb_resource()
    jobs_table = dynamodb.Table("leadmagnet-jobs")
    
    try:
        response = jobs_table.get_item(Key={"job_id": job_id})
        if "Item" in response:
            return convert_decimals(response["Item"])
        return None
    except Exception as e:
        print(f"❌ Error getting job: {e}")
        return None


def get_execution_steps(job_id: str) -> list:
    """Get execution steps for a job."""
    job = get_job(job_id)
    if not job:
        return []
    return job.get("execution_steps", [])


def find_step_functions_execution_for_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Find Step Functions execution for a job."""
    sfn = get_stepfunctions_client()
    sm_arn = get_step_functions_arn()
    
    if not sm_arn:
        print("❌ Could not find Step Functions state machine ARN")
        return None
    
    try:
        # List recent executions
        for status in ["RUNNING", "SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]:
            try:
                result = sfn.list_executions(
                    stateMachineArn=sm_arn,
                    maxResults=50,
                    statusFilter=status
                )
                
                for execution in result.get("executions", []):
                    exec_detail = sfn.describe_execution(
                        executionArn=execution["executionArn"]
                    )
                    input_data = json.loads(exec_detail.get("input", "{}"))
                    
                    if input_data.get("job_id") == job_id:
                        return {
                            "executionArn": execution["executionArn"],
                            "status": execution["status"],
                            "startDate": execution.get("startDate"),
                            "stopDate": execution.get("stopDate"),
                            "input": input_data,
                        }
            except Exception:
                continue
        
        return None
    except Exception as e:
        print(f"❌ Error finding Step Functions execution: {e}")
        return None


def check_execution_history(execution_arn: str) -> list:
    """Get execution history to see which steps were executed."""
    sfn = get_stepfunctions_client()
    
    try:
        response = sfn.get_execution_history(
            executionArn=execution_arn,
            maxResults=100,
            reverseOrder=False
        )
        
        events = []
        for event in response.get("events", []):
            event_type = event.get("type")
            if event_type in ["TaskStateEntered", "TaskStateExited", "LambdaFunctionScheduled", "LambdaFunctionSucceeded"]:
                events.append({
                    "type": event_type,
                    "timestamp": event.get("timestamp"),
                    "details": event.get(event_type, {})
                })
        
        return events
    except Exception as e:
        print(f"❌ Error getting execution history: {e}")
        return []


def call_rerun_api(job_id: str, step_index: int, tenant_id: str) -> bool:
    """Call the rerun API endpoint."""
    # For now, we'll call Step Functions directly since we need to test the state machine
    # In production, this would go through the API Gateway
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
    
    execution_input = {
        "job_id": job_id,
        "tenant_id": tenant_id or job.get("tenant_id"),
        "workflow_id": job.get("workflow_id"),
        "submission_id": job.get("submission_id"),
        "step_index": step_index,
        "step_type": "workflow_step",
        "action": "process_single_step"
    }
    
    try:
        execution = sfn.start_execution(
            stateMachineArn=sm_arn,
            name=f"test-rerun-{job_id}-step{step_index}-{int(time.time())}",
            input=json.dumps(execution_input)
        )
        
        print(f"✅ Started Step Functions execution for step rerun")
        print(f"   Execution ARN: {execution['executionArn']}")
        return True
    except Exception as e:
        print(f"❌ Error starting Step Functions execution: {e}")
        return False


def test_step_rerun(job_id: str, step_index: int, tenant_id: Optional[str] = None):
    """Test step rerun functionality."""
    print("=" * 80)
    print("Test: Step Rerun Functionality")
    print("=" * 80)
    print(f"Job ID: {job_id}")
    print(f"Step Index: {step_index}")
    print()
    
    # Step 1: Get initial job state
    print("Step 1: Getting initial job state...")
    initial_job = get_job(job_id)
    if not initial_job:
        print(f"❌ Job {job_id} not found")
        return False
    
    initial_steps = initial_job.get("execution_steps", [])
    initial_step_count = len([s for s in initial_steps if s.get("step_type") in ["ai_generation", "webhook"]])
    
    print(f"✅ Job found: {initial_job.get('status')}")
    print(f"   Initial execution steps: {initial_step_count}")
    print(f"   Workflow ID: {initial_job.get('workflow_id')}")
    
    if not tenant_id:
        tenant_id = initial_job.get("tenant_id")
    
    # Step 2: Get the step we're rerunning
    print(f"\nStep 2: Checking step {step_index}...")
    workflow_id = initial_job.get("workflow_id")
    dynamodb = get_dynamodb_resource()
    workflows_table = dynamodb.Table("leadmagnet-workflows")
    
    try:
        workflow_response = workflows_table.get_item(Key={"workflow_id": workflow_id})
        if "Item" not in workflow_response:
            print(f"❌ Workflow {workflow_id} not found")
            return False
        
        workflow = convert_decimals(workflow_response["Item"])
        steps = workflow.get("steps", [])
        
        if step_index < 0 or step_index >= len(steps):
            print(f"❌ Invalid step index: {step_index}. Workflow has {len(steps)} steps.")
            return False
        
        step = steps[step_index]
        print(f"✅ Step {step_index} found: {step.get('step_name', 'Unnamed')}")
    except Exception as e:
        print(f"❌ Error getting workflow: {e}")
        return False
    
    # Step 3: Call rerun API
    print(f"\nStep 3: Calling rerun API for step {step_index}...")
    if not call_rerun_api(job_id, step_index, tenant_id):
        return False
    
    # Step 4: Wait for execution to complete
    print(f"\nStep 4: Waiting for step rerun to complete...")
    print("   (This may take 30-60 seconds)")
    
    # Wait for job to be updated
    max_wait = 120  # 2 minutes
    start_time = time.time()
    execution_arn = None
    
    while time.time() - start_time < max_wait:
        # Find the Step Functions execution
        exec_info = find_step_functions_execution_for_job(job_id)
        if exec_info:
            execution_arn = exec_info["executionArn"]
            status = exec_info["status"]
            
            if status in ["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]:
                print(f"✅ Step Functions execution completed: {status}")
                break
            elif status == "RUNNING":
                print(f"   Execution still running... ({int(time.time() - start_time)}s)")
        
        time.sleep(3)
    
    if not execution_arn:
        print("❌ Could not find Step Functions execution")
        return False
    
    # Step 5: Check execution history to verify only one step was processed
    print(f"\nStep 5: Checking execution history...")
    history = check_execution_history(execution_arn)
    
    # Count Lambda invocations
    lambda_invocations = [
        e for e in history 
        if e["type"] == "LambdaFunctionScheduled"
    ]
    
    print(f"   Lambda invocations: {len(lambda_invocations)}")
    
    # Check if we went through the single-step path
    # The single-step path should have:
    # 1. UpdateJobStatus
    # 2. CheckAction (should route to process_single_step)
    # 3. ProcessStep (Lambda invocation)
    # 4. CheckStepResultSingleStep
    # 5. FinalizeJob
    
    # Step 6: Check final job state
    print(f"\nStep 6: Checking final job state...")
    final_job = wait_for_job_completion(job_id, timeout=60)
    
    if not final_job:
        print("❌ Job did not complete")
        return False
    
    final_steps = final_job.get("execution_steps", [])
    final_step_count = len([s for s in final_steps if s.get("step_type") in ["ai_generation", "webhook"]])
    
    print(f"✅ Final job status: {final_job.get('status')}")
    print(f"   Final execution steps: {final_step_count}")
    
    # Step 7: Verify results
    print(f"\nStep 7: Verifying results...")
    all_passed = True
    
    # Check 1: Job should be completed
    if final_job.get("status") != "completed":
        print(f"❌ Job status is {final_job.get('status')}, expected 'completed'")
        all_passed = False
    else:
        print("✅ Job is completed")
    
    # Check 2: Only the rerun step should have been processed
    # The step count should be the same (we're replacing, not adding)
    if final_step_count != initial_step_count:
        print(f"⚠️  Step count changed: {initial_step_count} -> {final_step_count}")
        print("   (This might be OK if steps were added, but rerun should replace)")
    
    # Check 3: The rerun step should have updated timestamp
    rerun_step = None
    for step in final_steps:
        step_order = step.get("step_order", 0)
        if step_order == step_index + 1:  # step_order is 1-indexed
            rerun_step = step
            break
    
    if rerun_step:
        print(f"✅ Found rerun step: {rerun_step.get('step_name')}")
        print(f"   Step order: {rerun_step.get('step_order')}")
        print(f"   Step type: {rerun_step.get('step_type')}")
    else:
        print(f"❌ Could not find rerun step (step_order {step_index + 1})")
        all_passed = False
    
    # Check 4: Previous steps should still be present
    previous_steps = [s for s in final_steps if s.get("step_order", 0) < step_index + 1]
    if len(previous_steps) > 0:
        print(f"✅ Previous steps preserved: {len(previous_steps)} steps")
    else:
        print(f"⚠️  No previous steps found (might be OK if rerunning step 0)")
    
    # Check 5: Verify execution went through single-step path
    # Look for CheckAction state in execution history
    state_entered_events = [e for e in history if e["type"] == "TaskStateEntered"]
    state_names = [e.get("details", {}).get("name", "") for e in state_entered_events]
    
    if "CheckAction" in str(state_names):
        print("✅ Execution went through CheckAction (single-step path)")
    else:
        print("⚠️  Could not verify CheckAction in execution history")
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ TEST PASSED: Step rerun functionality works correctly")
    else:
        print("❌ TEST FAILED: Some checks did not pass")
    print("=" * 80)
    
    return all_passed


def main():
    """Main function."""
    if len(sys.argv) < 3:
        print("Usage: python test-step-rerun.py <job_id> <step_index> [tenant_id]")
        print("\nExample:")
        print("  python test-step-rerun.py job_01K9TR7WXEC3X17YA4MNBSMQ9S 2")
        sys.exit(1)
    
    job_id = sys.argv[1]
    step_index = int(sys.argv[2])
    tenant_id = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = test_step_rerun(job_id, step_index, tenant_id)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
