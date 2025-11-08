#!/usr/bin/env python3
"""
Fetch CloudWatch logs for a specific job.
Retrieves logs from:
- Step Functions execution logs
- Lambda function logs (job processor)
"""

import json
import os
import sys
import boto3
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
JOBS_TABLE = "leadmagnet-jobs"

# Log groups
STEP_FUNCTIONS_LOG_GROUP = "/aws/stepfunctions/leadmagnet-job-processor"
LAMBDA_LOG_GROUP = "/aws/lambda/leadmagnet-job-processor"

def find_step_functions_execution(job_id: str):
    """Find Step Functions execution for a job."""
    sfn = boto3.client("stepfunctions", region_name=REGION)
    
    try:
        # List state machines
        state_machines = sfn.list_state_machines()
        
        # Find the job processor state machine
        job_processor_sm = None
        for sm in state_machines.get("stateMachines", []):
            if "job" in sm["name"].lower() or "processor" in sm["name"].lower():
                job_processor_sm = sm
                break
        
        if not job_processor_sm:
            print("⚠ Could not find job processor state machine")
            return None
        
        sm_arn = job_processor_sm["stateMachineArn"]
        print(f"Found state machine: {sm_arn}")
        
        # List recent executions
        executions = []
        for status in ["RUNNING", "FAILED", "SUCCEEDED", "TIMED_OUT", "ABORTED"]:
            result = sfn.list_executions(
                stateMachineArn=sm_arn,
                maxResults=100,
                statusFilter=status
            )
            executions.extend(result.get("executions", []))
        
        # Find execution with matching input
        for execution in executions:
            try:
                exec_details = sfn.describe_execution(executionArn=execution["executionArn"])
                input_data = json.loads(exec_details.get("input", "{}"))
                
                if input_data.get("job_id") == job_id:
                    return exec_details
            except Exception as e:
                continue
        
        print("⚠ Could not find Step Functions execution for this job")
        return None
        
    except ClientError as e:
        print(f"✗ Error accessing Step Functions: {e}")
        return None

def get_job_timestamps(job_id: str):
    """Get job timestamps from DynamoDB to narrow log search window."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(JOBS_TABLE)
    
    try:
        response = table.get_item(Key={"job_id": job_id})
        if "Item" not in response:
            return None
        
        job = response["Item"]
        created_at = job.get("created_at")
        updated_at = job.get("updated_at")
        
        # Parse timestamps
        start_time = None
        end_time = None
        
        if created_at:
            try:
                start_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except:
                pass
        
        if updated_at:
            try:
                end_time = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            except:
                pass
        
        # Add buffer: 5 minutes before start, 10 minutes after end
        if start_time:
            start_time = start_time - timedelta(minutes=5)
        if end_time:
            end_time = end_time + timedelta(minutes=10)
        else:
            end_time = datetime.utcnow() + timedelta(minutes=10)
        
        return {
            "start_time": int(start_time.timestamp() * 1000) if start_time else None,
            "end_time": int(end_time.timestamp() * 1000) if end_time else None,
        }
    except Exception as e:
        print(f"⚠ Could not get job timestamps: {e}")
        return None

def get_cloudwatch_logs(log_group: str, job_id: str, start_time_ms: int = None, end_time_ms: int = None):
    """Get CloudWatch logs for a log group, filtered by job_id."""
    logs_client = boto3.client("logs", region_name=REGION)
    
    try:
        # Check if log group exists
        try:
            logs_client.describe_log_groups(logGroupNamePrefix=log_group)
        except ClientError:
            print(f"⚠ Log group {log_group} not found")
            return []
        
        # Build filter pattern to search for job_id
        filter_pattern = f'"{job_id}"'
        
        # Set time range (default: last 24 hours if not provided)
        if not start_time_ms:
            start_time_ms = int((datetime.utcnow() - timedelta(hours=24)).timestamp() * 1000)
        if not end_time_ms:
            end_time_ms = int(datetime.utcnow().timestamp() * 1000)
        
        # Ensure integers
        start_time_ms = int(start_time_ms)
        end_time_ms = int(end_time_ms)
        
        print(f"  Searching logs from {datetime.fromtimestamp(start_time_ms/1000)} to {datetime.fromtimestamp(end_time_ms/1000)}")
        
        # Get log streams
        log_streams = logs_client.describe_log_streams(
            logGroupName=log_group,
            orderBy="LastEventTime",
            descending=True,
            limit=50
        )
        
        all_logs = []
        
        # Filter log streams by time range
        for stream in log_streams.get("logStreams", []):
            stream_start = stream.get("firstEventTimestamp", 0)
            stream_end = stream.get("lastEventTimestamp", 0)
            
            # Check if stream overlaps with our time range
            if stream_end < start_time_ms or stream_start > end_time_ms:
                continue
            
            # Get events from this stream
            try:
                events = logs_client.filter_log_events(
                    logGroupName=log_group,
                    logStreamNames=[stream["logStreamName"]],
                    startTime=start_time_ms,
                    endTime=end_time_ms,
                    filterPattern=filter_pattern,
                    limit=1000
                )
                
                for event in events.get("events", []):
                    all_logs.append({
                        "timestamp": event["timestamp"],
                        "message": event["message"],
                        "logStream": stream["logStreamName"],
                    })
            except Exception as e:
                print(f"    ⚠ Error reading stream {stream['logStreamName']}: {e}")
                continue
        
        # Also try direct filter_log_events (more comprehensive but slower)
        try:
            direct_events = logs_client.filter_log_events(
                logGroupName=log_group,
                startTime=start_time_ms,
                endTime=end_time_ms,
                filterPattern=filter_pattern,
                limit=1000
            )
            
            for event in direct_events.get("events", []):
                # Avoid duplicates
                if not any(log["timestamp"] == event["timestamp"] and log["message"] == event["message"] 
                          for log in all_logs):
                    all_logs.append({
                        "timestamp": event["timestamp"],
                        "message": event["message"],
                        "logStream": event.get("logStreamName", "unknown"),
                    })
        except Exception as e:
            print(f"    ⚠ Error with direct filter: {e}")
        
        # Sort by timestamp
        all_logs.sort(key=lambda x: x["timestamp"])
        return all_logs
        
    except ClientError as e:
        print(f"✗ Error accessing CloudWatch logs: {e}")
        return []

def get_step_functions_execution_logs(execution_arn: str):
    """Get logs for a specific Step Functions execution."""
    logs_client = boto3.client("logs", region_name=REGION)
    
    # Extract execution name from ARN
    # ARN format: arn:aws:states:region:account:execution:stateMachineName:executionName
    execution_name = execution_arn.split(":")[-1]
    
    # Step Functions logs include execution name in the log stream
    filter_pattern = f'"{execution_name}"'
    
    # Get execution details to get timestamps
    sfn = boto3.client("stepfunctions", region_name=REGION)
    try:
        exec_details = sfn.describe_execution(executionArn=execution_arn)
        start_date = exec_details.get("startDate")
        stop_date = exec_details.get("stopDate")
        
        start_time_ms = int(start_date.timestamp() * 1000) if start_date else None
        end_time_ms = int(stop_date.timestamp() * 1000) if stop_date else int(datetime.utcnow().timestamp() * 1000)
        
        # Add buffer
        if start_time_ms:
            start_time_ms = int(start_time_ms - timedelta(minutes=5).total_seconds() * 1000)
        if end_time_ms:
            end_time_ms = int(end_time_ms + timedelta(minutes=10).total_seconds() * 1000)
        
    except Exception as e:
        print(f"⚠ Could not get execution timestamps: {e}")
        start_time_ms = None
        end_time_ms = None
    
    return get_cloudwatch_logs(STEP_FUNCTIONS_LOG_GROUP, execution_name, start_time_ms, end_time_ms)

def print_logs(logs: list, title: str):
    """Print logs in a formatted way."""
    if not logs:
        print(f"\n  No logs found in {title}")
        return
    
    print(f"\n  Found {len(logs)} log entries in {title}")
    print("  " + "-" * 76)
    
    for log in logs:
        timestamp = datetime.fromtimestamp(log["timestamp"] / 1000)
        message = log["message"].strip()
        stream = log.get("logStream", "unknown")
        
        print(f"  [{timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {stream}")
        print(f"      {message}")
        print()

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 get-job-logs.py <job_id>")
        sys.exit(1)
    
    job_id = sys.argv[1]
    
    print("=" * 80)
    print("Job Logs Fetcher")
    print("=" * 80)
    print(f"Job ID: {job_id}")
    print(f"Region: {REGION}")
    print("=" * 80)
    
    # Get job timestamps
    timestamps = get_job_timestamps(job_id)
    start_time_ms = timestamps["start_time"] if timestamps else None
    end_time_ms = timestamps["end_time"] if timestamps else None
    
    # Find Step Functions execution
    print("\n" + "=" * 80)
    print("Step Functions Execution")
    print("=" * 80)
    
    execution = find_step_functions_execution(job_id)
    execution_arn = None
    if execution:
        execution_arn = execution["executionArn"]
        print(f"Execution ARN: {execution_arn}")
        print(f"Status: {execution.get('status', 'unknown')}")
        print(f"Start Date: {execution.get('startDate', 'unknown')}")
        if execution.get('stopDate'):
            print(f"Stop Date: {execution.get('stopDate')}")
    else:
        print("⚠ No Step Functions execution found")
    
    # Get Step Functions logs
    print("\n" + "=" * 80)
    print("Step Functions Logs")
    print("=" * 80)
    if execution_arn:
        sf_logs = get_step_functions_execution_logs(execution_arn)
    else:
        sf_logs = get_cloudwatch_logs(STEP_FUNCTIONS_LOG_GROUP, job_id, start_time_ms, end_time_ms)
    print_logs(sf_logs, "Step Functions")
    
    # Get Lambda logs
    print("\n" + "=" * 80)
    print("Lambda Function Logs")
    print("=" * 80)
    lambda_logs = get_cloudwatch_logs(LAMBDA_LOG_GROUP, job_id, start_time_ms, end_time_ms)
    print_logs(lambda_logs, "Lambda Function")
    
    print("=" * 80)
    print("Done!")
    print("=" * 80)

if __name__ == "__main__":
    main()

