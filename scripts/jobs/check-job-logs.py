#!/usr/bin/env python3
"""
Check logs for a specific job to see what happened during processing.
Can check both local logs (if worker runs locally) and CloudWatch logs (if Lambda).
"""

import sys
import os
import json
import boto3
from datetime import datetime, timedelta
from pathlib import Path

# Add backend/worker to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

def get_cloudwatch_logs(job_id, function_name=None, hours_back=1):
    """Get CloudWatch logs for a job."""
    print_section("CloudWatch Logs")
    
    try:
        logs_client = boto3.client('logs', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        
        # Try to find log group
        log_groups = [
            '/aws/lambda/leadmagnet-worker',
            '/aws/lambda/leadmagnet-job-processor',
            f'/aws/lambda/{function_name}' if function_name else None
        ]
        
        log_group = None
        for group in log_groups:
            if not group:
                continue
            try:
                logs_client.describe_log_groups(logGroupNamePrefix=group)
                log_group = group
                break
            except:
                continue
        
        if not log_group:
            print("⚠️  Could not find Lambda log group")
            print("   Tried:", [g for g in log_groups if g])
            return
        
        print(f"✅ Found log group: {log_group}")
        
        # Search for logs containing job_id
        start_time = int((datetime.utcnow() - timedelta(hours=hours_back)).timestamp() * 1000)
        end_time = int(datetime.utcnow().timestamp() * 1000)
        
        print(f"   Searching logs from {hours_back} hour(s) ago...")
        print(f"   Looking for job_id: {job_id}")
        
        filter_pattern = f'"{job_id}"'
        
        response = logs_client.filter_log_events(
            logGroupName=log_group,
            filterPattern=filter_pattern,
            startTime=start_time,
            endTime=end_time,
            limit=100
        )
        
        events = response.get('events', [])
        print(f"\n   Found {len(events)} log events")
        
        if events:
            print("\n   Relevant log entries:")
            for event in events[:50]:  # Show first 50
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message']
                print(f"\n   [{timestamp}] {message}")
        else:
            print("   ⚠️  No log events found for this job_id")
            print("   This might mean:")
            print("     - Job was processed locally (check backend API console)")
            print("     - Logs are older than search window")
            print("     - Job was processed in a different region")
            
    except Exception as e:
        print(f"❌ Error fetching CloudWatch logs: {e}")
        import traceback
        traceback.print_exc()

def check_local_worker_logs(job_id):
    """Check if worker runs locally and show where logs would be."""
    print_section("Local Worker Logs")
    
    print("If running locally, worker logs should appear in:")
    print("  1. Backend API server console output")
    print("  2. The terminal where you ran: npm run dev (or similar)")
    print("\n  Look for log messages containing:")
    print(f"    - job_id: {job_id}")
    print("    - '[OpenAI Client]'")
    print("    - '[StepProcessor]'")
    print("    - '[ImageArtifactService]'")
    print("\n  Key log messages to look for:")
    print("    - ⚡ MAKING OPENAI RESPONSES API CALL NOW ⚡")
    print("    - ✅ RECEIVED RESPONSES API RESPONSE ✅")
    print("    - Response output items breakdown")
    print("    - Found ImageGenerationCall class")
    print("    - Processing base64 image data")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/check-job-logs.py <job_id>")
        print("\nExample:")
        print("  python3 scripts/check-job-logs.py job_01K9Z8156YFX510ASVG36P1N09")
        return 1
    
    job_id = sys.argv[1]
    
    print_section(f"Checking Logs for Job: {job_id}")
    
    # Check CloudWatch logs (if running in Lambda)
    get_cloudwatch_logs(job_id)
    
    # Show where local logs would be
    check_local_worker_logs(job_id)
    
    print_section("Summary")
    print("To see detailed logs:")
    print("  1. Check the backend API server console (if running locally)")
    print("  2. Check CloudWatch Logs (if running in Lambda)")
    print("  3. Look for the log messages listed above")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

