#!/usr/bin/env python3
"""
Check job status and Step Functions execution details.
"""

import json
import os
import sys
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
JOBS_TABLE = "leadmagnet-jobs"

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

def get_job_details(job_id: str):
    """Get job details from DynamoDB."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(JOBS_TABLE)
    
    try:
        print(f"Fetching job {job_id} from DynamoDB...")
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            print(f"✗ Job {job_id} not found in DynamoDB")
            return None
        
        job = convert_decimals(response["Item"])
        return job
    except ClientError as e:
        print(f"✗ Error accessing DynamoDB: {e}")
        return None

def find_step_functions_execution(job_id: str):
    """Find Step Functions execution for a job."""
    sfn = boto3.client("stepfunctions", region_name=REGION)
    
    # Get state machine ARN from environment or find it
    # Try to find executions that contain the job_id
    try:
        # List state machines
        state_machines = sfn.list_state_machines()
        
        # Find the job processor state machine
        job_processor_sm = None
        for sm in state_machines.get("stateMachines", []):
            if "job" in sm["name"].lower() or "processor" in sm["name"].lower():
                job_processor_sm = sm
                break
        
        if not job_processor_sm:
            print("⚠ Could not find job processor state machine")
            return None
        
        sm_arn = job_processor_sm["stateMachineArn"]
        print(f"Found state machine: {sm_arn}")
        
        # List executions (this might be slow if there are many)
        # Instead, try to find execution by name pattern
        # Step Functions execution names often include the job_id
        
        # List recent executions - check RUNNING first, then others
        executions = []
        for status in ["RUNNING", "FAILED", "SUCCEEDED", "TIMED_OUT", "ABORTED"]:
            result = sfn.list_executions(
                stateMachineArn=sm_arn,
                maxResults=50,
                statusFilter=status
            )
            executions.extend(result.get("executions", []))
        
        # Find execution with matching input
        for execution in executions:
            try:
                exec_details = sfn.describe_execution(executionArn=execution["executionArn"])
                input_data = json.loads(exec_details.get("input", "{}"))
                
                if input_data.get("job_id") == job_id:
                    return exec_details
            except Exception as e:
                continue
        
        print("⚠ Could not find Step Functions execution for this job")
        return None
        
    except ClientError as e:
        print(f"✗ Error accessing Step Functions: {e}")
        return None

def get_execution_history(execution_arn: str):
    """Get Step Functions execution history."""
    sfn = boto3.client("stepfunctions", region_name=REGION)
    
    try:
        history = sfn.get_execution_history(
            executionArn=execution_arn,
            maxResults=100,
            reverseOrder=True  # Most recent first
        )
        return history.get("events", [])
    except ClientError as e:
        print(f"✗ Error getting execution history: {e}")
        return []

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 check-job-status.py <job_id>")
        sys.exit(1)
    
    job_id = sys.argv[1]
    
    print("=" * 80)
    print("Job Status Checker")
    print("=" * 80)
    print(f"Job ID: {job_id}")
    print(f"Region: {REGION}")
    print("=" * 80)
    
    # Get job details
    job = get_job_details(job_id)
    if not job:
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("Job Details")
    print("=" * 80)
    print(f"Status: {job.get('status', 'unknown')}")
    print(f"Workflow ID: {job.get('workflow_id', 'unknown')}")
    print(f"Submission ID: {job.get('submission_id', 'unknown')}")
    print(f"Tenant ID: {job.get('tenant_id', 'unknown')}")
    print(f"Created: {job.get('created_at', 'unknown')}")
    print(f"Updated: {job.get('updated_at', 'unknown')}")
    
    if job.get('error_message'):
        print(f"\n✗ Error: {job.get('error_message')}")
    
    if job.get('execution_steps_s3_key'):
        print(f"\nExecution steps stored in S3: {job.get('execution_steps_s3_key')}")
    
    if job.get('execution_steps'):
        print(f"\nExecution steps count: {len(job.get('execution_steps', []))}")
    
    # Find Step Functions execution
    print("\n" + "=" * 80)
    print("Step Functions Execution")
    print("=" * 80)
    
    execution = find_step_functions_execution(job_id)
    if execution:
        exec_arn = execution["executionArn"]
        print(f"Execution ARN: {exec_arn}")
        print(f"Status: {execution.get('status', 'unknown')}")
        print(f"Start Date: {execution.get('startDate', 'unknown')}")
        
        if execution.get('stopDate'):
            print(f"Stop Date: {execution.get('stopDate')}")
        
        # Get execution history
        print("\n" + "-" * 80)
        print("Recent Execution Events (last 20)")
        print("-" * 80)
        
        events = get_execution_history(exec_arn)
        for event in events[:20]:
            event_type = event.get("type", "unknown")
            timestamp = event.get("timestamp", "unknown")
            event_id = event.get("id", "unknown")
            
            # Extract useful info
            details = {}
            if "lambdaFunctionScheduledEventDetails" in event:
                details = event["lambdaFunctionScheduledEventDetails"]
            elif "lambdaFunctionFailedEventDetails" in event:
                details = event["lambdaFunctionFailedEventDetails"]
                print(f"  ✗ [{event_id}] {event_type}: {details.get('error', 'Unknown error')}")
                if details.get('cause'):
                    print(f"      Cause: {details.get('cause')[:200]}")
                continue
            elif "lambdaFunctionSucceededEventDetails" in event:
                details = event["lambdaFunctionSucceededEventDetails"]
            elif "taskFailedEventDetails" in event:
                details = event["taskFailedEventDetails"]
                print(f"  ✗ [{event_id}] {event_type}: {details.get('error', 'Unknown error')}")
                if details.get('cause'):
                    print(f"      Cause: {details.get('cause')[:200]}")
                continue
            elif "executionFailedEventDetails" in event:
                details = event["executionFailedEventDetails"]
                print(f"  ✗ [{event_id}] {event_type}: {details.get('error', 'Unknown error')}")
                if details.get('cause'):
                    print(f"      Cause: {details.get('cause')[:200]}")
                continue
            
            print(f"  [{event_id}] {event_type} at {timestamp}")
    else:
        print("⚠ No Step Functions execution found")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()

