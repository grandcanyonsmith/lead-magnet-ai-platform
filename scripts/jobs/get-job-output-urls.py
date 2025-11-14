#!/usr/bin/env python3
"""
Fetch output URLs for specific job IDs from DynamoDB.
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


def get_job_info(job_id: str, tenant_id: str = None):
    """Retrieve job from DynamoDB and extract output URL."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    
    try:
        print_section(f"Fetching job: {job_id}")
        
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            print(f"❌ Error: Job {job_id} not found in DynamoDB")
            return None
        
        job = convert_decimals(response["Item"])
        
        # Verify tenant_id matches if provided
        if tenant_id and job.get("tenant_id") != tenant_id:
            print(f"⚠️  Warning: Tenant ID mismatch. Expected {tenant_id}, got {job.get('tenant_id')}")
        
        print(f"Job ID: {job.get('job_id')}")
        print(f"Status: {job.get('status', 'unknown')}")
        print(f"Created: {format_timestamp(job.get('created_at', 'unknown'))}")
        print(f"Updated: {format_timestamp(job.get('updated_at', 'unknown'))}")
        
        # Get output URL
        output_url = job.get('output_url')
        if output_url:
            print(f"\n✅ Output URL: {output_url}")
        else:
            print(f"\n⚠️  No output URL found")
            if job.get('status') == 'failed':
                print(f"Error: {job.get('error_message', 'No error message')}")
            elif job.get('artifacts'):
                print(f"Artifacts available: {len(job.get('artifacts', []))} artifact(s)")
                print(f"Artifact IDs: {job.get('artifacts', [])}")
        
        # Show artifacts if available
        artifacts = job.get('artifacts', [])
        if artifacts:
            print(f"\nArtifacts ({len(artifacts)}):")
            for i, artifact_id in enumerate(artifacts, 1):
                print(f"  {i}. {artifact_id}")
        
        return {
            'job_id': job.get('job_id'),
            'status': job.get('status'),
            'output_url': output_url,
            'artifacts': artifacts,
            'error_message': job.get('error_message'),
            'created_at': job.get('created_at'),
            'updated_at': job.get('updated_at'),
        }
        
    except ClientError as e:
        print(f"❌ Error accessing DynamoDB: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Fetch output URLs for specific job IDs from DynamoDB")
    parser.add_argument("job_ids", nargs="+", help="Job ID(s) to fetch")
    parser.add_argument(
        "--tenant-id",
        help="Optional tenant ID to verify against",
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
    
    print_section("Job Output URL Fetcher")
    print(f"Table: {get_table_name('jobs')}")
    print(f"Region: {get_aws_region()}")
    if args.tenant_id:
        print(f"Tenant ID: {args.tenant_id}")
    print(f"Jobs to fetch: {len(args.job_ids)}")
    print()
    
    results = []
    
    for job_id in args.job_ids:
        result = get_job_info(job_id, args.tenant_id)
        if result:
            results.append(result)
    
    # Summary
    print_section("SUMMARY")
    
    for result in results:
        print(f"\nJob: {result['job_id']}")
        print(f"  Status: {result['status']}")
        if result['output_url']:
            print(f"  ✅ Output URL: {result['output_url']}")
        else:
            print(f"  ⚠️  No output URL")
            if result['error_message']:
                print(f"  Error: {result['error_message']}")
    
    print()


if __name__ == "__main__":
    main()

