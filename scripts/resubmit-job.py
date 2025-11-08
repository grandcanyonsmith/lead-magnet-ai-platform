#!/usr/bin/env python3
"""
Resubmit a failed job by creating a new job with the same submission data.
"""

import json
import os
import sys
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError
import ulid

REGION = os.environ.get("AWS_REGION", "us-east-1")
JOBS_TABLE = "leadmagnet-jobs"
SUBMISSIONS_TABLE = "leadmagnet-submissions"

def get_step_functions_arn():
    """Get Step Functions ARN from CloudFormation stack."""
    try:
        cf = boto3.client("cloudformation", region_name=REGION)
        stacks = cf.describe_stacks()
        
        for stack in stacks.get("Stacks", []):
            if "compute" in stack["StackName"].lower():
                outputs = {o["OutputKey"]: o["OutputValue"] for o in stack.get("Outputs", [])}
                if "StateMachineArn" in outputs:
                    return outputs["StateMachineArn"]
        
        # Try to find it by listing state machines
        sfn = boto3.client("stepfunctions", region_name=REGION)
        machines = sfn.list_state_machines()
        for machine in machines.get("stateMachines", []):
            if "job" in machine["name"].lower() or "processor" in machine["name"].lower():
                return machine["stateMachineArn"]
        
        return None
    except Exception as e:
        print(f"Warning: Could not get Step Functions ARN: {e}")
        return None

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

def resubmit_job(job_id: str, tenant_id: str):
    """Resubmit a job by creating a new job with the same submission data."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    jobs_table = dynamodb.Table(JOBS_TABLE)
    submissions_table = dynamodb.Table(SUBMISSIONS_TABLE)
    
    # Get the original job
    print(f"Fetching original job {job_id}...")
    try:
        response = jobs_table.get_item(Key={"job_id": job_id})
        if "Item" not in response:
            print(f"✗ Job {job_id} not found")
            return None
        
        original_job = convert_decimals(response["Item"])
    except ClientError as e:
        print(f"✗ Error fetching job: {e}")
        return None
    
    # Verify tenant_id matches
    if original_job.get("tenant_id") != tenant_id:
        print(f"✗ Tenant ID mismatch. Expected {tenant_id}, got {original_job.get('tenant_id')}")
        return None
    
    # Get the submission data
    submission_id = original_job.get("submission_id")
    if not submission_id:
        print(f"✗ Original job has no submission_id")
        return None
    
    print(f"Fetching submission {submission_id}...")
    try:
        response = submissions_table.get_item(Key={"submission_id": submission_id})
        if "Item" not in response:
            print(f"✗ Submission {submission_id} not found")
            return None
        
        submission = convert_decimals(response["Item"])
    except ClientError as e:
        print(f"✗ Error fetching submission: {e}")
        return None
    
    # Create a new submission record (copy of the original)
    new_submission_id = f"sub_{ulid.new()}"
    print(f"Creating new submission {new_submission_id}...")
    
    new_submission = {
        "submission_id": new_submission_id,
        "tenant_id": submission["tenant_id"],
        "form_id": submission["form_id"],
        "workflow_id": submission["workflow_id"],
        "submission_data": submission["submission_data"],
        "submitter_ip": submission.get("submitter_ip"),
        "submitter_email": submission.get("submitter_email"),
        "submitter_phone": submission.get("submitter_phone"),
        "submitter_name": submission.get("submitter_name"),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "ttl": int(datetime.utcnow().timestamp()) + (90 * 24 * 60 * 60),  # 90 days
    }
    
    try:
        submissions_table.put_item(Item=new_submission)
        print(f"✓ Created new submission")
    except ClientError as e:
        print(f"✗ Error creating submission: {e}")
        return None
    
    # Create new job record
    new_job_id = f"job_{ulid.new()}"
    print(f"Creating new job {new_job_id}...")
    
    new_job = {
        "job_id": new_job_id,
        "tenant_id": original_job["tenant_id"],
        "workflow_id": original_job["workflow_id"],
        "submission_id": new_submission_id,
        "status": "processing",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    
    try:
        jobs_table.put_item(Item=new_job)
        print(f"✓ Created new job")
    except ClientError as e:
        print(f"✗ Error creating job: {e}")
        return None
    
    # Update submission with job_id
    try:
        submissions_table.update_item(
            Key={"submission_id": new_submission_id},
            UpdateExpression="SET job_id = :job_id",
            ExpressionAttributeValues={":job_id": new_job_id}
        )
        print(f"✓ Updated submission with job_id")
    except ClientError as e:
        print(f"⚠ Warning: Could not update submission: {e}")
    
    # Start Step Functions execution
    sfn_arn = get_step_functions_arn()
    if not sfn_arn:
        print("⚠ Warning: Could not find Step Functions ARN. Job created but execution not started.")
        return new_job_id
    
    print(f"Starting Step Functions execution...")
    sfn = boto3.client("stepfunctions", region_name=REGION)
    
    try:
        sfn.start_execution(
            stateMachineArn=sfn_arn,
            input=json.dumps({
                "job_id": new_job_id,
                "tenant_id": original_job["tenant_id"],
                "workflow_id": original_job["workflow_id"],
                "submission_id": new_submission_id,
            })
        )
        print(f"✓ Started Step Functions execution")
    except ClientError as e:
        print(f"✗ Error starting Step Functions execution: {e}")
        return new_job_id
    
    return new_job_id

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 resubmit-job.py <job_id> <tenant_id>")
        sys.exit(1)
    
    job_id = sys.argv[1]
    tenant_id = sys.argv[2]
    
    print("=" * 80)
    print("Job Resubmission Tool")
    print("=" * 80)
    print(f"Original Job ID: {job_id}")
    print(f"Tenant ID: {tenant_id}")
    print(f"Region: {REGION}")
    print("=" * 80)
    
    new_job_id = resubmit_job(job_id, tenant_id)
    
    if new_job_id:
        print("\n" + "=" * 80)
        print("✓ Job resubmitted successfully!")
        print(f"New Job ID: {new_job_id}")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("✗ Failed to resubmit job")
        print("=" * 80)
        sys.exit(1)

if __name__ == "__main__":
    main()

