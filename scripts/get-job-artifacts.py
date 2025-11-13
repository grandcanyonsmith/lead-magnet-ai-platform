#!/usr/bin/env python3
"""
Fetch job details including artifacts and their URLs.
"""

import sys
import argparse
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    get_dynamodb_resource,
    get_s3_client,
    get_table_name,
    get_artifacts_bucket,
    print_section,
    format_timestamp,
)


def get_presigned_url(bucket: str, key: str, expiration: int = 3600 * 24 * 7) -> str:
    """Generate a presigned URL for S3 object."""
    s3_client = get_s3_client()
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return None


def get_artifact_url(artifact_id: str):
    """Get artifact details and generate URL."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("artifacts"))
    
    try:
        response = table.get_item(Key={"artifact_id": artifact_id})
        
        if "Item" not in response:
            return None
        
        artifact = response["Item"]
        
        # Check if it has a public_url
        if artifact.get('public_url'):
            return artifact.get('public_url')
        
        # Generate presigned URL from S3 key
        s3_key = artifact.get('s3_key')
        if s3_key:
            bucket_name = get_artifacts_bucket()
            return get_presigned_url(bucket_name, s3_key)
        
        return None
        
    except Exception as e:
        print(f"Error getting artifact {artifact_id}: {e}")
        return None


def get_job_details(job_id: str):
    """Retrieve job from DynamoDB and get artifact URLs."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    
    try:
        print_section(f"Job: {job_id}")
        
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            print(f"❌ Job not found")
            return None
        
        job = response["Item"]
        
        print(f"Status: {job.get('status', 'unknown')}")
        print(f"Created: {format_timestamp(job.get('created_at', 'unknown'))}")
        print(f"Updated: {format_timestamp(job.get('updated_at', 'unknown'))}")
        
        output_url = job.get('output_url')
        if output_url:
            print(f"\n✅ Output URL: {output_url}")
        else:
            print(f"\n⚠️  No output URL in job record")
        
        # Check artifacts
        artifacts = job.get('artifacts', [])
        if artifacts:
            print(f"\n📦 Found {len(artifacts)} artifact(s):")
            
            bucket_name = get_artifacts_bucket()
            
            for i, artifact_id in enumerate(artifacts, 1):
                print(f"\n  Artifact {i}: {artifact_id}")
                
                # Get artifact details
                artifact_table = dynamodb.Table(get_table_name("artifacts"))
                try:
                    artifact_response = artifact_table.get_item(Key={"artifact_id": artifact_id})
                    if "Item" in artifact_response:
                        artifact = artifact_response["Item"]
                        artifact_type = artifact.get('artifact_type', 'unknown')
                        filename = artifact.get('file_name') or artifact.get('artifact_name', 'unknown')
                        s3_key = artifact.get('s3_key')
                        
                        print(f"    Type: {artifact_type}")
                        print(f"    Filename: {filename}")
                        
                        # Try to get URL
                        if artifact.get('public_url'):
                            print(f"    ✅ Public URL: {artifact.get('public_url')}")
                        elif s3_key:
                            presigned_url = get_presigned_url(bucket_name, s3_key)
                            if presigned_url:
                                print(f"    ✅ Presigned URL: {presigned_url}")
                            else:
                                print(f"    ⚠️  Could not generate URL for S3 key: {s3_key}")
                        else:
                            print(f"    ⚠️  No S3 key or public URL")
                    else:
                        print(f"    ⚠️  Artifact not found in artifacts table")
                except Exception as e:
                    print(f"    ❌ Error fetching artifact: {e}")
        else:
            print(f"\n⚠️  No artifacts found")
        
        # Check execution steps
        execution_steps = job.get('execution_steps', [])
        if execution_steps:
            print(f"\n📋 Execution Steps: {len(execution_steps)} step(s)")
            for i, step in enumerate(execution_steps, 1):
                step_type = step.get('step_type', 'unknown')
                step_name = step.get('step_name', f'Step {i}')
                print(f"  {i}. {step_name} ({step_type})")
        
        return {
            'job_id': job_id,
            'status': job.get('status'),
            'output_url': output_url,
            'artifacts': artifacts,
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Fetch job details including artifacts and their URLs"
    )
    parser.add_argument("job_ids", nargs="+", help="Job ID(s) to fetch")
    parser.add_argument(
        "--region",
        help="AWS region (default: from environment or us-east-1)",
        default=None,
    )
    args = parser.parse_args()
    
    if args.region:
        import os
        os.environ["AWS_REGION"] = args.region
    
    print_section("Job Details and Artifact URLs")
    
    results = []
    
    for job_id in args.job_ids:
        result = get_job_details(job_id)
        if result:
            results.append(result)
    
    # Summary
    print_section("SUMMARY")
    
    for result in results:
        print(f"\nJob: {result['job_id']}")
        print(f"  Status: {result['status']}")
        if result['output_url']:
            print(f"  ✅ Output URL: {result['output_url']}")
        elif result['artifacts']:
            print(f"  ⚠️  No output URL, but {len(result['artifacts'])} artifact(s) found")
        else:
            print(f"  ❌ No output URL and no artifacts")
    
    print_section("")


if __name__ == "__main__":
    main()
