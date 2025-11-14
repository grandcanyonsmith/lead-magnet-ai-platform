#!/usr/bin/env python3
"""
Find actual lead magnet generation jobs (not workflow generation jobs).
"""

import sys
import argparse
from pathlib import Path
from botocore.exceptions import ClientError

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    convert_decimals,
    get_dynamodb_resource,
    get_table_name,
    get_aws_region,
    print_section,
    format_timestamp,
)


def find_lead_magnet_jobs(tenant_id: str, workflow_id: str = None):
    """Find actual lead magnet generation jobs (not workflow generation)."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    
    try:
        print_section("Lead Magnet Jobs Search")
        print(f"Tenant ID: {tenant_id}")
        if workflow_id:
            print(f"Workflow ID: {workflow_id}")
        print(f"Region: {get_aws_region()}")
        print()
        
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
            print(f"  Created: {format_timestamp(job.get('created_at', 'N/A'))}")
            print(f"  Updated: {format_timestamp(job.get('updated_at', 'N/A'))}")
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


def main():
    parser = argparse.ArgumentParser(
        description="Find actual lead magnet generation jobs (not workflow generation jobs)"
    )
    parser.add_argument("tenant_id", help="Tenant ID to search for")
    parser.add_argument(
        "--workflow-id",
        help="Optional workflow ID to filter by",
        default=None,
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
    
    jobs = find_lead_magnet_jobs(args.tenant_id, args.workflow_id)
    
    if not jobs:
        print("No lead magnet generation jobs found.")
        print("\nNote: Workflow generation jobs (wfgen_*) create workflows/templates.")
        print("Actual lead magnets are generated when users submit forms.")


if __name__ == "__main__":
    main()

