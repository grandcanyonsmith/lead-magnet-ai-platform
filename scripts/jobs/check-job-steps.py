#!/usr/bin/env python3
"""
Check job execution steps to see what happened.
"""

import json
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
)


def get_job_execution_steps(job_id: str):
    """Retrieve job execution steps."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    
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
            s3_client = get_s3_client()
            bucket_name = get_artifacts_bucket()
            
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
    parser = argparse.ArgumentParser(
        description="Check job execution steps to see what happened"
    )
    parser.add_argument("job_ids", nargs="+", help="Job ID(s) to check")
    parser.add_argument(
        "--region",
        help="AWS region (default: from environment or us-east-1)",
        default=None,
    )
    args = parser.parse_args()
    
    if args.region:
        import os
        os.environ["AWS_REGION"] = args.region
    
    print_section("Job Execution Steps Analysis")
    
    for job_id in args.job_ids:
        print_section(f"Job: {job_id}")
        
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
    
    print_section("")


if __name__ == "__main__":
    main()
