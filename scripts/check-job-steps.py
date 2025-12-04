#!/usr/bin/env python3
"""
Check job execution steps to see what happened.
"""

import os
import json
import boto3

TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"
JOBS_TABLE = "leadmagnet-jobs"
REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_job_execution_steps(job_id: str):
    """Retrieve job execution steps."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(JOBS_TABLE)
    
    try:
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            return None
        
        job = response["Item"]
        
        # Check if execution_steps are in S3
        execution_steps = job.get('execution_steps', [])
        execution_steps_s3_key = job.get('execution_steps_s3_key')
        
        if execution_steps_s3_key and not execution_steps:
            # Load from S3
            s3_client = boto3.client("s3", region_name=REGION)
            account_id = boto3.client("sts", region_name=REGION).get_caller_identity()["Account"]
            bucket_name = f"leadmagnet-artifacts-{account_id}"
            
            try:
                s3_response = s3_client.get_object(Bucket=bucket_name, Key=execution_steps_s3_key)
                execution_steps = json.loads(s3_response['Body'].read().decode('utf-8'))
            except Exception as e:
                print(f"Error loading execution_steps from S3: {e}")
        
        return {
            'job_id': job_id,
            'status': job.get('status'),
            'workflow_id': job.get('workflow_id'),
            'execution_steps': execution_steps,
            'execution_steps_s3_key': execution_steps_s3_key,
            'error_message': job.get('error_message'),
        }
        
    except Exception as e:
        print(f"Error: {e}")
        return None


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Check job execution steps to see what happened")
    parser.add_argument("job_ids", nargs="+", help="Job ID(s) to check")
    args = parser.parse_args()
    
    print("=" * 80)
    print("Job Execution Steps Analysis")
    print("=" * 80)
    
    for job_id in args.job_ids:
        print(f"\n{'=' * 80}")
        print(f"Job: {job_id}")
        print(f"{'=' * 80}")
        
        data = get_job_execution_steps(job_id)
        
        if not data:
            print("❌ Could not retrieve job data")
            continue
        
        print(f"Status: {data['status']}")
        print(f"Workflow ID: {data['workflow_id']}")
        
        if data['error_message']:
            print(f"Error: {data['error_message']}")
        
        execution_steps = data['execution_steps']
        
        if execution_steps:
            print(f"\n📋 Execution Steps ({len(execution_steps)}):")
            for i, step in enumerate(execution_steps, 1):
                step_type = step.get('step_type', 'unknown')
                step_name = step.get('step_name', f'Step {i}')
                step_order = step.get('step_order', i)
                
                print(f"\n  {i}. {step_name} (Order: {step_order}, Type: {step_type})")
                
                if step_type == 'ai_generation':
                    model = step.get('model') or step.get('step_model', 'unknown')
                    print(f"     Model: {model}")
                    if step.get('usage_info'):
                        usage = step['usage_info']
                        tokens = usage.get('total_tokens', 0)
                        cost = usage.get('cost_usd', 0)
                        print(f"     Tokens: {tokens}, Cost: ${cost}")
                
                if step_type == 'html_generation':
                    print(f"     ✅ HTML Generation Step")
                    if step.get('artifact_id'):
                        print(f"     Artifact ID: {step['artifact_id']}")
                    if step.get('output_url'):
                        print(f"     Output URL: {step['output_url']}")
                
                if step.get('artifact_id'):
                    print(f"     Artifact ID: {step['artifact_id']}")
        else:
            print("\n⚠️  No execution steps found")
            if data['execution_steps_s3_key']:
                print(f"   (Execution steps stored in S3: {data['execution_steps_s3_key']})")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()

