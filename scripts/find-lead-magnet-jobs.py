#!/usr/bin/env python3
"""
Find actual lead magnet generation jobs (not workflow generation jobs).
"""

import boto3
import json
from decimal import Decimal
from botocore.exceptions import ClientError

TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"
TABLE_NAME = "leadmagnet-jobs"
REGION = "us-east-1"


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


def find_lead_magnet_jobs(tenant_id: str, workflow_id: str = None):
    """Find actual lead magnet generation jobs (not workflow generation)."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    try:
        print(f"Searching for lead magnet jobs...")
        print(f"Tenant ID: {tenant_id}")
        if workflow_id:
            print(f"Workflow ID: {workflow_id}")
        print("=" * 60)
        
        # Query by tenant_id using GSI
        if workflow_id:
            # Query by workflow_id and status
            response = table.query(
                IndexName="gsi_workflow_status",
                KeyConditionExpression="workflow_id = :wf_id",
                ExpressionAttributeValues={":wf_id": workflow_id},
                ScanIndexForward=False,  # Most recent first
                Limit=50
            )
        else:
            # Query by tenant_id
            response = table.query(
                IndexName="gsi_tenant_created",
                KeyConditionExpression="tenant_id = :tid",
                ExpressionAttributeValues={":tid": tenant_id},
                ScanIndexForward=False,  # Most recent first
                Limit=50
            )
        
        jobs = response.get("Items", [])
        
        # Filter out workflow generation jobs (wfgen_*)
        lead_magnet_jobs = [
            job for job in jobs 
            if not job.get("job_id", "").startswith("wfgen_")
        ]
        
        print(f"\nFound {len(lead_magnet_jobs)} lead magnet generation job(s):\n")
        
        # Convert Decimal objects to native Python types for all jobs
        lead_magnet_jobs = [convert_decimals(job) for job in lead_magnet_jobs]
        
        for job in lead_magnet_jobs:
            print(f"Job ID: {job.get('job_id')}")
            print(f"  Status: {job.get('status')}")
            print(f"  Workflow ID: {job.get('workflow_id', 'N/A')}")
            print(f"  Created: {job.get('created_at', 'N/A')}")
            print(f"  Updated: {job.get('updated_at', 'N/A')}")
            if job.get('output_url'):
                print(f"  Output URL: {job.get('output_url')[:80]}...")
            if job.get('artifacts'):
                print(f"  Artifacts: {len(job.get('artifacts', []))} artifact(s)")
            print()
        
        return lead_magnet_jobs
        
    except ClientError as e:
        print(f"Error querying DynamoDB: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        return []


if __name__ == "__main__":
    import sys
    
    workflow_id = sys.argv[1] if len(sys.argv) > 1 else None
    jobs = find_lead_magnet_jobs(TENANT_ID, workflow_id)
    
    if not jobs:
        print("No lead magnet generation jobs found.")
        print("\nNote: Workflow generation jobs (wfgen_*) create workflows/templates.")
        print("Actual lead magnets are generated when users submit forms.")

