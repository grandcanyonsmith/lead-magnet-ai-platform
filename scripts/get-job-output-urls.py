#!/usr/bin/env python3
"""
Fetch output URLs for specific job IDs from DynamoDB.
"""

import os
import boto3
from botocore.exceptions import ClientError

TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"
TABLE_NAME = "leadmagnet-jobs"
REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_job_info(job_id: str):
    """Retrieve job from DynamoDB and extract output URL."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    try:
        print(f"\n{'=' * 80}")
        print(f"Fetching job: {job_id}")
        print(f"{'=' * 80}")
        
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            print(f"❌ Error: Job {job_id} not found in DynamoDB")
            return None
        
        job = response["Item"]
        
        # Verify tenant_id matches
        if job.get("tenant_id") != TENANT_ID:
            print(f"⚠️  Warning: Tenant ID mismatch. Expected {TENANT_ID}, got {job.get('tenant_id')}")
        
        print(f"Job ID: {job.get('job_id')}")
        print(f"Status: {job.get('status', 'unknown')}")
        print(f"Created: {job.get('created_at', 'unknown')}")
        print(f"Updated: {job.get('updated_at', 'unknown')}")
        
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
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch output URLs for specific job IDs from DynamoDB")
    parser.add_argument("job_ids", nargs="+", help="Job ID(s) to fetch")
    args = parser.parse_args()
    
    print("=" * 80)
    print("Job Output URL Fetcher")
    print("=" * 80)
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Table: {TABLE_NAME}")
    print(f"Region: {REGION}")
    print(f"Jobs to fetch: {len(args.job_ids)}")
    
    results = []
    
    for job_id in args.job_ids:
        result = get_job_info(job_id)
        if result:
            results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    for result in results:
        print(f"\nJob: {result['job_id']}")
        print(f"  Status: {result['status']}")
        if result['output_url']:
            print(f"  ✅ Output URL: {result['output_url']}")
        else:
            print(f"  ⚠️  No output URL")
            if result['error_message']:
                print(f"  Error: {result['error_message']}")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()

