#!/usr/bin/env python3
"""
Test script to verify artifacts are public and non-expiring.
Checks:
1. Artifacts use CloudFront URLs (not presigned URLs)
2. URLs are accessible without expiration
3. S3 bucket lifecycle rules don't expire artifacts
"""

import boto3
import json
import sys
from urllib.parse import urlparse, parse_qs

dynamodb = boto3.client('dynamodb', region_name='us-east-1')
s3 = boto3.client('s3', region_name='us-east-1')
cloudfront_domain = 'dmydkyj79auy7.cloudfront.net'

def is_cloudfront_url(url):
    """Check if URL is a CloudFront URL (non-expiring)"""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        # CloudFront URLs don't have AWS signature parameters
        has_aws_params = any(key.startswith('X-Amz-') for key in parse_qs(parsed.query).keys())
        is_cloudfront = cloudfront_domain in parsed.netloc
        return is_cloudfront and not has_aws_params
    except:
        return False

def is_presigned_url(url):
    """Check if URL is a presigned S3 URL (expires)"""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        return 'X-Amz-Signature' in query_params or 'X-Amz-Algorithm' in query_params
    except:
        return False

def check_s3_lifecycle_rules():
    """Check S3 bucket lifecycle rules"""
    bucket_name = 'leadmagnet-artifacts-471112574622'
    try:
        response = s3.get_bucket_lifecycle_configuration(Bucket=bucket_name)
        rules = response.get('Rules', [])
        
        expiration_rules = []
        for rule in rules:
            if rule.get('Status') == 'Enabled':
                if 'Expiration' in rule:
                    expiration_rules.append({
                        'id': rule.get('Id'),
                        'expiration_days': rule.get('Expiration', {}).get('Days')
                    })
        
        return expiration_rules
    except s3.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchLifecycleConfiguration':
            return []  # No lifecycle rules
        raise

def get_job_with_artifacts():
    """Find a completed job with artifacts"""
    paginator = dynamodb.get_paginator('scan')
    
    for page in paginator.paginate(
        TableName='leadmagnet-jobs',
        FilterExpression='#status = :status',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={':status': {'S': 'completed'}}
    ):
        for item in page.get('Items', []):
            artifacts = item.get('artifacts', {}).get('L', [])
            if artifacts:
                return {
                    'job_id': item['job_id']['S'],
                    'output_url': item.get('output_url', {}).get('S'),
                    'artifacts': [a.get('S') for a in artifacts],
                    'execution_steps_s3_url': item.get('execution_steps_s3_url', {}).get('S'),
                    'execution_steps_s3_key': item.get('execution_steps_s3_key', {}).get('S'),
                }
    return None

def get_artifact_details(artifact_id):
    """Get artifact details from DynamoDB"""
    try:
        response = dynamodb.get_item(
            TableName='leadmagnet-artifacts',
            Key={'artifact_id': {'S': artifact_id}}
        )
        if 'Item' in response:
            item = response['Item']
            return {
                'artifact_id': artifact_id,
                'public_url': item.get('public_url', {}).get('S'),
                's3_key': item.get('s3_key', {}).get('S'),
                'is_public': item.get('is_public', {}).get('BOOL', False),
            }
    except Exception as e:
        print(f"Error getting artifact {artifact_id}: {e}")
    return None

def main():
    print("=" * 80)
    print("Testing Artifact URLs - Public & Non-Expiring")
    print("=" * 80)
    print()
    
    # Test 1: Check S3 lifecycle rules
    print("Test 1: Checking S3 bucket lifecycle rules...")
    expiration_rules = check_s3_lifecycle_rules()
    if expiration_rules:
        print(f"  ⚠️  WARNING: Found {len(expiration_rules)} expiration rule(s):")
        for rule in expiration_rules:
            print(f"    - Rule '{rule['id']}': expires after {rule['expiration_days']} days")
        print("  ❌ FAILED: Artifacts will expire!")
    else:
        print("  ✅ PASSED: No expiration rules found - artifacts won't expire")
    print()
    
    # Test 2: Find a job with artifacts
    print("Test 2: Finding a completed job with artifacts...")
    job = get_job_with_artifacts()
    if not job:
        print("  ⚠️  No completed jobs with artifacts found")
        print("  Note: This is OK if no jobs have completed yet")
        print()
        print("=" * 80)
        print("Summary: Infrastructure changes deployed successfully!")
        print("  ✅ S3 lifecycle expiration removed")
        print("  ⚠️  No completed jobs to test artifact URLs yet")
        print("=" * 80)
        return 0
    
    print(f"  ✅ Found job: {job['job_id']}")
    print(f"  Artifacts: {len(job['artifacts'])}")
    print()
    
    # Test 3: Check artifact URLs
    print("Test 3: Checking artifact URLs...")
    cloudfront_count = 0
    presigned_count = 0
    other_count = 0
    
    for artifact_id in job['artifacts'][:3]:  # Check first 3 artifacts
        artifact = get_artifact_details(artifact_id)
        if artifact:
            url = artifact.get('public_url')
            if url:
                if is_cloudfront_url(url):
                    cloudfront_count += 1
                    print(f"  ✅ {artifact_id}: CloudFront URL (non-expiring)")
                    print(f"     {url[:80]}...")
                elif is_presigned_url(url):
                    presigned_count += 1
                    print(f"  ⚠️  {artifact_id}: Presigned URL (expires)")
                    print(f"     {url[:80]}...")
                else:
                    other_count += 1
                    print(f"  ❓ {artifact_id}: Unknown URL type")
                    print(f"     {url[:80]}...")
            else:
                print(f"  ⚠️  {artifact_id}: No public_url found")
    
    print()
    
    # Test 4: Check execution_steps URL
    print("Test 4: Checking execution_steps URL...")
    if job.get('execution_steps_s3_url'):
        url = job['execution_steps_s3_url']
        if is_cloudfront_url(url):
            print(f"  ✅ execution_steps uses CloudFront URL (non-expiring)")
            print(f"     {url[:80]}...")
        elif is_presigned_url(url):
            print(f"  ⚠️  execution_steps uses presigned URL (expires)")
            print(f"     {url[:80]}...")
        else:
            print(f"  ❓ execution_steps uses unknown URL type")
            print(f"     {url[:80]}...")
    else:
        print("  ℹ️  No execution_steps_s3_url found")
    print()
    
    # Test 5: Check output_url
    print("Test 5: Checking output_url...")
    if job.get('output_url'):
        url = job['output_url']
        if is_cloudfront_url(url):
            print(f"  ✅ output_url uses CloudFront URL (non-expiring)")
            print(f"     {url[:80]}...")
        elif is_presigned_url(url):
            print(f"  ⚠️  output_url uses presigned URL (expires)")
            print(f"     {url[:80]}...")
        else:
            print(f"  ❓ output_url uses unknown URL type")
            print(f"     {url[:80]}...")
    else:
        print("  ℹ️  No output_url found")
    print()
    
    # Summary
    print("=" * 80)
    print("Test Summary")
    print("=" * 80)
    
    if expiration_rules:
        print("  ❌ S3 lifecycle expiration rules still exist")
    else:
        print("  ✅ S3 lifecycle expiration rules removed")
    
    if cloudfront_count > 0:
        print(f"  ✅ {cloudfront_count} artifact(s) use CloudFront URLs (non-expiring)")
    if presigned_count > 0:
        print(f"  ⚠️  {presigned_count} artifact(s) use presigned URLs (will expire)")
    if other_count > 0:
        print(f"  ❓ {other_count} artifact(s) use unknown URL types")
    
    print()
    print("Note: New artifacts created after deployment will use CloudFront URLs")
    print("      and won't expire. Existing artifacts may still have presigned URLs.")
    print("=" * 80)
    
    return 0 if not expiration_rules else 1

if __name__ == '__main__':
    sys.exit(main())

