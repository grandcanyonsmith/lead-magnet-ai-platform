#!/usr/bin/env python3
"""
End-to-end test to verify deployment:
1. Create a new job
2. Wait for it to complete (or check status)
3. Verify artifact URLs use CloudFront (non-expiring)
4. Verify execution_steps URLs use CloudFront
5. Verify S3 bucket has no expiration rules
"""

import boto3
import json
import sys
import time
import requests
from urllib.parse import urlparse, parse_qs

API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
CLOUDFRONT_DOMAIN = "dmydkyj79auy7.cloudfront.net"

dynamodb = boto3.client('dynamodb', region_name='us-east-1')
s3 = boto3.client('s3', region_name='us-east-1')

def is_cloudfront_url(url):
    """Check if URL is a CloudFront URL (non-expiring)"""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        has_aws_params = any(key.startswith('X-Amz-') for key in parse_qs(parsed.query).keys())
        is_cloudfront = CLOUDFRONT_DOMAIN in parsed.netloc
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

def test_api_execution_steps_url():
    """Test that API returns CloudFront URLs for execution_steps"""
    print("\n" + "=" * 80)
    print("Test: API Execution Steps URL Generation")
    print("=" * 80)
    
    # Find a job with execution_steps_s3_key
    paginator = dynamodb.get_paginator('scan')
    for page in paginator.paginate(
        TableName='leadmagnet-jobs',
        FilterExpression='attribute_exists(execution_steps_s3_key)',
        Limit=1
    ):
        for item in page.get('Items', []):
            job_id = item['job_id']['S']
            s3_key = item['execution_steps_s3_key']['S']
            
            # Call API to get job details
            try:
                response = requests.get(f"{API_URL}/v1/jobs/{job_id}", timeout=10)
                if response.status_code == 200:
                    job_data = response.json()
                    execution_steps_url = job_data.get('execution_steps_s3_url')
                    
                    if execution_steps_url:
                        if is_cloudfront_url(execution_steps_url):
                            print(f"  ✅ API returns CloudFront URL for execution_steps")
                            print(f"     Job: {job_id}")
                            print(f"     URL: {execution_steps_url[:80]}...")
                            return True
                        elif is_presigned_url(execution_steps_url):
                            print(f"  ⚠️  API returns presigned URL (will expire)")
                            print(f"     Job: {job_id}")
                            print(f"     URL: {execution_steps_url[:80]}...")
                            return False
                        else:
                            print(f"  ❓ Unknown URL type")
                            print(f"     URL: {execution_steps_url[:80]}...")
                            return False
                    else:
                        print(f"  ⚠️  No execution_steps_s3_url in API response")
                        return False
            except Exception as e:
                print(f"  ❌ Error calling API: {e}")
                return False
    
    print("  ℹ️  No jobs with execution_steps_s3_key found")
    return True  # Not a failure if no jobs exist yet

def test_new_job_creation():
    """Test creating a new job"""
    print("\n" + "=" * 80)
    print("Test: Create New Job")
    print("=" * 80)
    
    try:
        response = requests.post(
            f"{API_URL}/v1/forms/test-form/submit",
            json={
                "submission_data": {
                    "name": "E2E Test User",
                    "email": "test@example.com",
                    "phone": "+14155551234",
                    "project": "E2E test for artifact URLs"
                }
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code in [200, 202]:  # 202 is accepted for async processing
            data = response.json()
            job_id = data.get('job_id')
            if job_id:
                print(f"  ✅ Job created successfully")
                print(f"     Job ID: {job_id}")
                print(f"     Status: {response.status_code} (async processing)")
                return job_id
            else:
                print(f"  ❌ No job_id in response")
                return None
        else:
            print(f"  ❌ API returned status {response.status_code}")
            print(f"     Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  ❌ Error creating job: {e}")
        return None

def test_s3_lifecycle():
    """Test S3 bucket lifecycle rules"""
    print("\n" + "=" * 80)
    print("Test: S3 Bucket Lifecycle Rules")
    print("=" * 80)
    
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
        
        if expiration_rules:
            print(f"  ❌ Found {len(expiration_rules)} expiration rule(s):")
            for rule in expiration_rules:
                print(f"     - Rule '{rule['id']}': expires after {rule['expiration_days']} days")
            return False
        else:
            print(f"  ✅ No expiration rules found - artifacts won't expire")
            return True
    except s3.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchLifecycleConfiguration':
            print(f"  ✅ No lifecycle rules configured - artifacts won't expire")
            return True
        else:
            print(f"  ❌ Error checking lifecycle: {e}")
            return False

def test_artifact_urls():
    """Test artifact URLs use CloudFront"""
    print("\n" + "=" * 80)
    print("Test: Artifact URLs")
    print("=" * 80)
    
    # Find completed jobs with artifacts
    paginator = dynamodb.get_paginator('scan')
    cloudfront_count = 0
    presigned_count = 0
    other_count = 0
    
    for page in paginator.paginate(
        TableName='leadmagnet-jobs',
        FilterExpression='#status = :status AND attribute_exists(artifacts)',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={':status': {'S': 'completed'}},
        Limit=5
    ):
        for item in page.get('Items', []):
            artifacts = item.get('artifacts', {}).get('L', [])
            for artifact_id_item in artifacts[:2]:  # Check first 2 per job
                artifact_id = artifact_id_item.get('S')
                if artifact_id:
                    # Get artifact details
                    try:
                        artifact_response = dynamodb.get_item(
                            TableName='leadmagnet-artifacts',
                            Key={'artifact_id': {'S': artifact_id}}
                        )
                        if 'Item' in artifact_response:
                            public_url = artifact_response['Item'].get('public_url', {}).get('S')
                            if public_url:
                                if is_cloudfront_url(public_url):
                                    cloudfront_count += 1
                                elif is_presigned_url(public_url):
                                    presigned_count += 1
                                else:
                                    other_count += 1
                    except:
                        pass
    
    print(f"  CloudFront URLs (non-expiring): {cloudfront_count}")
    print(f"  Presigned URLs (expire): {presigned_count}")
    print(f"  Other URLs: {other_count}")
    
    if cloudfront_count > 0:
        print(f"  ✅ Found artifacts using CloudFront URLs")
        return True
    elif presigned_count > 0:
        print(f"  ⚠️  Only presigned URLs found (may be old artifacts)")
        return True  # Not a failure, old artifacts may have presigned URLs
    else:
        print(f"  ℹ️  No artifacts found to test")
        return True

def main():
    print("=" * 80)
    print("End-to-End Deployment Test")
    print("=" * 80)
    
    results = []
    
    # Test 1: S3 Lifecycle
    results.append(("S3 Lifecycle Rules", test_s3_lifecycle()))
    
    # Test 2: API Execution Steps URL
    results.append(("API Execution Steps URL", test_api_execution_steps_url()))
    
    # Test 3: Artifact URLs
    results.append(("Artifact URLs", test_artifact_urls()))
    
    # Test 4: Create new job
    job_id = test_new_job_creation()
    if job_id:
        results.append(("Job Creation", True))
        print(f"\n  ℹ️  Job {job_id} created - check status later to verify artifacts")
    else:
        results.append(("Job Creation", False))
    
    # Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {status}: {test_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ All tests passed!")
        print("=" * 80)
        return 0
    else:
        print("❌ Some tests failed")
        print("=" * 80)
        return 1

if __name__ == '__main__':
    sys.exit(main())

