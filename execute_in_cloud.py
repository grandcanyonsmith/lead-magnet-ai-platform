#!/usr/bin/env python3
"""
Execute OpenAI Responses API shell commands in AWS ECS Fargate (cloud)
instead of locally.
"""
import boto3
import json
import time
import uuid
from datetime import datetime
from botocore.signers import RequestSigner
from urllib.parse import urlparse

# Configuration
ECS_REGION = 'us-east-1'
TASK_DEF_ARN = 'arn:aws:ecs:us-east-1:471112574622:task-definition/leadmagnet-shell-executor:6'
CLUSTER_ARN = 'arn:aws:ecs:us-east-1:471112574622:cluster/ComputeStack-AppCluster99B78AC1-NHfvY53MCVV0'
SUBNET_IDS = ['subnet-0d911c97f2620aa5e', 'subnet-0a671de10b0c0a0c8']
SG_ID = 'sg-0c9e17cde5a85ee86'
BUCKET_NAME = 'leadmagnet-artifacts-471112574622'  # Use existing artifacts bucket

ecs_client = boto3.client('ecs', region_name=ECS_REGION)
s3_client = boto3.client('s3', region_name=ECS_REGION)

CONTRACT_VERSION = "2025-12-29"

def generate_presigned_put_url(bucket: str, key: str, expires_in: int = 1800) -> str:
    """Generate presigned PUT URL for result upload"""
    return s3_client.generate_presigned_url(
        'put_object',
        Params={'Bucket': bucket, 'Key': key, 'ContentType': 'application/json'},
        ExpiresIn=expires_in
    )

def generate_presigned_get_url(bucket: str, key: str, expires_in: int = 900) -> str:
    """Generate presigned GET URL for job request"""
    return s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=expires_in
    )

def execute_commands_in_cloud(commands: list[str], timeout_ms: int = 120000, max_output_length: int = 4096) -> dict:
    """Execute shell commands in ECS Fargate and return results"""
    job_id = str(uuid.uuid4())
    result_key = f'shell-results/{job_id}.json'
    job_request_key = f'shell-jobs/{job_id}.json'
    
    # Generate presigned URLs
    result_put_url = generate_presigned_put_url(BUCKET_NAME, result_key)
    
    # Create job request
    job_request = {
        "version": CONTRACT_VERSION,
        "job_id": job_id,
        "commands": commands,
        "timeout_ms": timeout_ms,
        "max_output_length": max_output_length,
        "result_put_url": result_put_url,
        "result_content_type": "application/json"
    }
    
    # Upload job request to S3
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=job_request_key,
        Body=json.dumps(job_request),
        ContentType='application/json'
    )
    
    job_request_get_url = generate_presigned_get_url(BUCKET_NAME, job_request_key)
    
    # Launch ECS task
    print(f"🚀 Launching ECS Fargate task for job {job_id}...")
    run_resp = ecs_client.run_task(
        cluster=CLUSTER_ARN,
        taskDefinition=TASK_DEF_ARN,
        launchType='FARGATE',  # Use launchType instead of capacityProviderStrategy
        platformVersion='LATEST',
        networkConfiguration={
            'awsvpcConfiguration': {
                'assignPublicIp': 'DISABLED',
                'subnets': SUBNET_IDS,
                'securityGroups': [SG_ID]
            }
        },
        overrides={
            'containerOverrides': [{
                'name': 'runner',
                'environment': [
                    {'name': 'SHELL_EXECUTOR_JOB_GET_URL', 'value': job_request_get_url}
                ]
            }]
        },
        startedBy='execute-in-cloud-script'
    )
    
    if run_resp.get('failures'):
        raise Exception(f"ECS RunTask failed: {run_resp['failures']}")
    
    task_arn = run_resp['tasks'][0]['taskArn']
    print(f"✅ Task started: {task_arn}")
    
    # Poll for result
    print("⏳ Waiting for result...")
    max_wait = timeout_ms * len(commands) / 1000 + 30
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        try:
            obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=result_key)
            result = json.loads(obj['Body'].read().decode('utf-8'))
            
            # Cleanup
            s3_client.delete_object(Bucket=BUCKET_NAME, Key=result_key)
            s3_client.delete_object(Bucket=BUCKET_NAME, Key=job_request_key)
            
            print(f"✅ Result received!")
            return result
        except s3_client.exceptions.NoSuchKey:
            time.sleep(0.5)
            continue
        except Exception as e:
            print(f"❌ Error: {e}")
            raise
    
    raise TimeoutError(f"Timed out waiting for result after {max_wait}s")

if __name__ == '__main__':
    # Test with simple commands
    commands = ['pwd', 'ls -la']
    print("Testing cloud execution...")
    result = execute_commands_in_cloud(commands)
    print("\nResult:")
    print(json.dumps(result, indent=2))
