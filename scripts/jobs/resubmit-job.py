#!/usr/bin/env python3
"""
Resubmit a failed job by creating a new job with the same submission data.
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
from botocore.exceptions import ClientError
from typing import Callable

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    convert_decimals,
    get_dynamodb_resource,
    get_stepfunctions_client,
    get_table_name,
    get_aws_region,
    get_step_functions_arn,
    print_section,
)

def _get_ulid_factory() -> Callable[[], str]:
    """
    Return a ULID generator compatible with common ulid packages.
    Supports:
      - ulid.new() (ulid-py)
      - ulid.ULID() (python-ulid)
    """
    try:
        from ulid import new as _new_ulid  # type: ignore
        return lambda: str(_new_ulid())
    except Exception:
        try:
            from ulid import ULID as _ULID  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "ULID dependency is missing. Install 'ulid-py' or 'ulid'."
            ) from exc
        return lambda: str(_ULID())


_new_ulid = _get_ulid_factory()


def resubmit_job(job_id: str, tenant_id: str):
    """Resubmit a job by creating a new job with the same submission data."""
    dynamodb = get_dynamodb_resource()
    jobs_table = dynamodb.Table(get_table_name("jobs"))
    submissions_table = dynamodb.Table(get_table_name("submissions"))
    
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
    new_submission_id = f"sub_{_new_ulid()}"
    print(f"Creating new submission {new_submission_id}...")
    
    workflow_id = submission.get("workflow_id") or original_job.get("workflow_id")
    if not workflow_id:
        print("✗ Submission and original job both missing workflow_id")
        return None

    new_submission = {
        "submission_id": new_submission_id,
        "tenant_id": submission["tenant_id"],
        "form_id": submission["form_id"],
        "workflow_id": workflow_id,
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
    new_job_id = f"job_{_new_ulid()}"
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
    sfn = get_stepfunctions_client()
    
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
    parser = argparse.ArgumentParser(
        description="Resubmit a failed job by creating a new job with the same submission data"
    )
    parser.add_argument("job_id", help="Original job ID to resubmit")
    parser.add_argument("tenant_id", help="Tenant ID")
    parser.add_argument(
        "--region",
        help="AWS region (default: from environment or us-east-1)",
        default=None,
    )
    args = parser.parse_args()
    
    if args.region:
        import os
        os.environ["AWS_REGION"] = args.region
    
    print_section("Job Resubmission Tool")
    print(f"Original Job ID: {args.job_id}")
    print(f"Tenant ID: {args.tenant_id}")
    print(f"Region: {get_aws_region()}")
    print_section("")
    
    new_job_id = resubmit_job(args.job_id, args.tenant_id)
    
    if new_job_id:
        print_section("✓ Job resubmitted successfully!")
        print(f"New Job ID: {new_job_id}")
        print_section("")
    else:
        print_section("✗ Failed to resubmit job")
        sys.exit(1)


if __name__ == "__main__":
    main()
