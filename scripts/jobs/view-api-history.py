#!/usr/bin/env python3
"""
View full OpenAI API request/response history for a job.

This script retrieves execution steps from S3 and displays the full raw
OpenAI API request and response for each step.

Usage:
    python scripts/jobs/view-api-history.py <job_id> [--step <step_order>] [--format json|pretty]
"""

import json
import sys
import argparse
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from lib.common import (
    get_dynamodb_resource,
    get_s3_client,
    get_table_name,
    get_artifacts_bucket,
    print_section,
)


def get_job_execution_steps(job_id: str):
    """Retrieve job execution steps from S3."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    
    try:
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            return None
        
        job = response["Item"]
        execution_steps_s3_key = job.get('execution_steps_s3_key')
        
        if not execution_steps_s3_key:
            print(f"❌ No execution steps found for job {job_id}")
            return None
        
        # Load from S3
        s3_client = get_s3_client()
        bucket_name = get_artifacts_bucket()
        
        try:
            s3_response = s3_client.get_object(Bucket=bucket_name, Key=execution_steps_s3_key)
            execution_steps = json.loads(s3_response['Body'].read().decode('utf-8'))
            return execution_steps
        except Exception as e:
            print(f"❌ Error loading execution_steps from S3: {e}")
            return None
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def print_step_api_history(step: dict, step_order: int = None, format_type: str = "pretty"):
    """Print the full API request/response for a step."""
    step_order = step_order or step.get('step_order', '?')
    step_name = step.get('step_name', 'Unknown')
    step_type = step.get('step_type', 'unknown')
    
    print_section(f"Step {step_order}: {step_name} ({step_type})")
    
    # Get request details
    input_data = step.get('input', {})
    raw_api_request = input_data.get('raw_api_request')
    
    if raw_api_request:
        print("\n📤 FULL RAW OPENAI API REQUEST:")
        print("=" * 80)
        if format_type == "json":
            print(json.dumps(raw_api_request, indent=2, default=str))
        else:
            print(f"Model: {raw_api_request.get('model', 'N/A')}")
            print(f"Instructions: {raw_api_request.get('instructions', 'N/A')[:200]}...")
            print(f"Tool Choice: {raw_api_request.get('tool_choice', 'auto')}")
            if raw_api_request.get('tools'):
                print(f"Tools ({len(raw_api_request['tools'])}):")
                for tool in raw_api_request['tools']:
                    tool_type = tool.get('type') if isinstance(tool, dict) else tool
                    print(f"  - {tool_type}")
            print(f"\nFull Request Body:")
            print(json.dumps(raw_api_request, indent=2, default=str))
    else:
        print("⚠️  No raw_api_request found in step input")
        print("Request details (processed):")
        print(json.dumps(input_data, indent=2, default=str))
    
    # Get response details
    response_details = step.get('response_details', {})
    raw_api_response = response_details.get('raw_api_response')
    
    if raw_api_response:
        print("\n📥 FULL RAW OPENAI API RESPONSE:")
        print("=" * 80)
        if format_type == "json":
            print(json.dumps(raw_api_response, indent=2, default=str))
        else:
            # Print key response fields
            if isinstance(raw_api_response, dict):
                print(f"Response ID: {raw_api_response.get('id', 'N/A')}")
                print(f"Model: {raw_api_response.get('model', 'N/A')}")
                print(f"Created: {raw_api_response.get('created', 'N/A')}")
                
                # Usage info
                usage = raw_api_response.get('usage', {})
                if usage:
                    print(f"\nUsage:")
                    print(f"  Input tokens: {usage.get('input_tokens', 'N/A')}")
                    print(f"  Output tokens: {usage.get('output_tokens', 'N/A')}")
                    print(f"  Total tokens: {usage.get('total_tokens', 'N/A')}")
                
                # Output
                output = raw_api_response.get('output')
                if output:
                    print(f"\nOutput items: {len(output) if isinstance(output, list) else 1}")
                
                # Output text
                output_text = raw_api_response.get('output_text')
                if output_text:
                    print(f"\nOutput Text (first 500 chars):")
                    print(output_text[:500] + ("..." if len(output_text) > 500 else ""))
                
                print(f"\nFull Response Body:")
                print(json.dumps(raw_api_response, indent=2, default=str))
            else:
                print(json.dumps(raw_api_response, indent=2, default=str))
    else:
        print("⚠️  No raw_api_response found in step response_details")
        print("Response details (processed):")
        print(json.dumps(response_details, indent=2, default=str))
    
    print("\n" + "=" * 80 + "\n")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="View full OpenAI API request/response history for a job"
    )
    parser.add_argument("job_id", help="Job ID to view")
    parser.add_argument(
        "--step",
        type=int,
        help="Specific step order to view (0-indexed)",
    )
    parser.add_argument(
        "--format",
        choices=["json", "pretty"],
        default="pretty",
        help="Output format (default: pretty)",
    )
    
    args = parser.parse_args()
    
    print_section(f"OpenAI API History for Job: {args.job_id}")
    
    execution_steps = get_job_execution_steps(args.job_id)
    
    if not execution_steps:
        print(f"❌ Could not retrieve execution steps for job {args.job_id}")
        sys.exit(1)
    
    if not isinstance(execution_steps, list):
        print(f"❌ Invalid execution steps format")
        sys.exit(1)
    
    print(f"Found {len(execution_steps)} execution step(s)\n")
    
    # Filter steps if specific step requested
    if args.step is not None:
        steps_to_show = [s for s in execution_steps if s.get('step_order') == args.step]
        if not steps_to_show:
            print(f"❌ Step {args.step} not found")
            sys.exit(1)
    else:
        steps_to_show = execution_steps
    
    # Print each step
    for step in steps_to_show:
        print_step_api_history(step, format_type=args.format)
    
    print_section("Done")


if __name__ == "__main__":
    main()

