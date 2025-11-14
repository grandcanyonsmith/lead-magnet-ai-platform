#!/usr/bin/env python3
"""
Check job status and Step Functions execution details.
"""

import sys
import argparse
from pathlib import Path
from botocore.exceptions import ClientError

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    convert_decimals,
    get_dynamodb_resource,
    get_stepfunctions_client,
    get_table_name,
    get_aws_region,
    find_step_functions_execution,
    print_section,
    print_subsection,
    format_timestamp,
)

def get_job_details(job_id: str):
    """Get job details from DynamoDB."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    
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

def get_execution_history(execution_arn: str):
    """Get Step Functions execution history."""
    sfn = get_stepfunctions_client()
    
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
    parser = argparse.ArgumentParser(
        description="Check job status and Step Functions execution details"
    )
    parser.add_argument("job_id", help="Job ID to check")
    parser.add_argument(
        "--region",
        help="AWS region (default: from environment or us-east-1)",
        default=None,
    )
    args = parser.parse_args()
    
    if args.region:
        import os
        os.environ["AWS_REGION"] = args.region
    
    job_id = args.job_id
    
    print_section("Job Status Checker")
    print(f"Job ID: {job_id}")
    print(f"Region: {get_aws_region()}")
    print_section("")
    
    # Get job details
    job = get_job_details(job_id)
    if not job:
        sys.exit(1)
    
    print_section("Job Details")
    print(f"Status: {job.get('status', 'unknown')}")
    print(f"Workflow ID: {job.get('workflow_id', 'unknown')}")
    print(f"Submission ID: {job.get('submission_id', 'unknown')}")
    print(f"Tenant ID: {job.get('tenant_id', 'unknown')}")
    print(f"Created: {format_timestamp(job.get('created_at', 'unknown'))}")
    print(f"Updated: {format_timestamp(job.get('updated_at', 'unknown'))}")
    
    if job.get('error_message'):
        print(f"\n✗ Error: {job.get('error_message')}")
    
    if job.get('execution_steps_s3_key'):
        print(f"\nExecution steps stored in S3: {job.get('execution_steps_s3_key')}")
    
    if job.get('execution_steps'):
        print(f"\nExecution steps count: {len(job.get('execution_steps', []))}")
    
    # Find Step Functions execution
    print_section("Step Functions Execution")
    
    execution = find_step_functions_execution(job_id)
    if execution:
        exec_arn = execution["executionArn"]
        print(f"Execution ARN: {exec_arn}")
        print(f"Status: {execution.get('status', 'unknown')}")
        print(f"Start Date: {format_timestamp(execution.get('startDate', 'unknown'))}")
        
        if execution.get('stopDate'):
            print(f"Stop Date: {format_timestamp(execution.get('stopDate'))}")
        
        # Get execution history
        print_subsection("Recent Execution Events (last 20)")
        
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
            
            print(f"  [{event_id}] {event_type} at {format_timestamp(timestamp)}")
    else:
        print("⚠ No Step Functions execution found")
    
    print_section("")

if __name__ == "__main__":
    main()

