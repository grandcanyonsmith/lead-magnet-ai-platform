#!/usr/bin/env python3
"""
Diagnose shell executor configuration and check for issues.
"""

import sys
import os
import boto3
from datetime import datetime, timedelta
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    get_aws_region,
    print_section,
    print_subsection,
    format_timestamp,
)

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

def print_subsection(title):
    """Print a formatted subsection header."""
    print("\n" + "-" * 80)
    print(title)
    print("-" * 80)

def check_lambda_env_vars():
    """Check Lambda function environment variables."""
    print_section("1. Lambda Environment Variables")
    
    lambda_client = boto3.client('lambda', region_name=get_aws_region())
    
    # Try to find the job processor Lambda
    function_names = [
        'leadmagnet-job-processor',
        'leadmagnet-worker',
    ]
    
    for func_name in function_names:
        try:
            response = lambda_client.get_function(FunctionName=func_name)
            config = response['Configuration']
            env_vars = config.get('Environment', {}).get('Variables', {})
            
            print(f"\n✅ Found Lambda function: {func_name}")
            print(f"   Runtime: {config.get('Runtime', 'unknown')}")
            print(f"   Timeout: {config.get('Timeout', 'unknown')}s")
            print(f"   Memory: {config.get('MemorySize', 'unknown')}MB")
            
            print_subsection("Shell Executor Environment Variables")
            
            required_vars = [
                'SHELL_EXECUTOR_RESULTS_BUCKET',
                'SHELL_EXECUTOR_CLUSTER_ARN',
                'SHELL_EXECUTOR_TASK_DEFINITION_ARN',
                'SHELL_EXECUTOR_SECURITY_GROUP_ID',
                'SHELL_EXECUTOR_SUBNET_IDS',
            ]
            
            all_set = True
            for var in required_vars:
                value = env_vars.get(var, '')
                if value:
                    # Mask sensitive parts
                    if 'ARN' in var:
                        masked = value[:50] + '...' if len(value) > 50 else value
                    elif 'SUBNET' in var:
                        masked = value[:30] + '...' if len(value) > 30 else value
                    else:
                        masked = value
                    print(f"   ✅ {var}: {masked}")
                else:
                    print(f"   ❌ {var}: NOT SET")
                    all_set = False
            
            if all_set:
                print("\n✅ All required environment variables are set")
            else:
                print("\n❌ Some environment variables are missing!")
            
            return env_vars
            
        except lambda_client.exceptions.ResourceNotFoundException:
            continue
        except Exception as e:
            print(f"   ⚠️  Error checking {func_name}: {e}")
            continue
    
    print("\n❌ Could not find Lambda function")
    return None

def check_ecs_infrastructure():
    """Check ECS cluster and task definition."""
    print_section("2. ECS Infrastructure")
    
    ecs_client = boto3.client('ecs', region_name=get_aws_region())
    
    # Check cluster
    cluster_name = 'leadmagnet-shell-executor'
    try:
        response = ecs_client.describe_clusters(clusters=[cluster_name])
        clusters = response.get('clusters', [])
        
        if clusters:
            cluster = clusters[0]
            print(f"\n✅ ECS Cluster: {cluster_name}")
            print(f"   Status: {cluster.get('status', 'unknown')}")
            print(f"   ARN: {cluster.get('clusterArn', 'unknown')}")
            cluster_arn = cluster.get('clusterArn')
        else:
            print(f"\n❌ ECS Cluster '{cluster_name}' not found")
            return None, None
    except Exception as e:
        print(f"\n❌ Error checking cluster: {e}")
        return None, None
    
    # Check task definition
    task_family = 'leadmagnet-shell-executor'
    try:
        response = ecs_client.describe_task_definition(taskDefinition=task_family)
        task_def = response['taskDefinition']
        
        print(f"\n✅ Task Definition: {task_family}")
        print(f"   Status: {task_def.get('status', 'unknown')}")
        print(f"   Revision: {task_def.get('revision', 'unknown')}")
        print(f"   ARN: {task_def.get('taskDefinitionArn', 'unknown')}")
        print(f"   CPU: {task_def.get('cpu', 'unknown')}")
        print(f"   Memory: {task_def.get('memory', 'unknown')}")
        
        # Check container definition
        containers = task_def.get('containerDefinitions', [])
        if containers:
            container = containers[0]
            print(f"\n   Container: {container.get('name', 'unknown')}")
            print(f"   Image: {container.get('image', 'unknown')}")
        
        task_def_arn = task_def.get('taskDefinitionArn')
        return cluster_arn, task_def_arn
        
    except Exception as e:
        print(f"\n❌ Error checking task definition: {e}")
        return cluster_arn, None

def check_ecs_task_logs(cluster_arn, start_time=None, end_time=None):
    """Check ECS task logs around the job execution time."""
    print_section("3. ECS Task Logs")
    
    if not cluster_arn:
        print("\n⚠️  Cannot check task logs without cluster ARN")
        return
    
    ecs_client = boto3.client('ecs', region_name=get_aws_region())
    logs_client = boto3.client('logs', region_name=get_aws_region())
    
    # Default to last hour if not specified
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(hours=1)
    
    print(f"\n   Checking tasks from {format_timestamp(start_time.isoformat())} to {format_timestamp(end_time.isoformat())}")
    
    try:
        # List tasks in the cluster
        response = ecs_client.list_tasks(
            cluster=cluster_arn,
            startedBy='leadmagnet-worker',
        )
        
        task_arns = response.get('taskArns', [])
        
        if not task_arns:
            print("\n⚠️  No tasks found with startedBy='leadmagnet-worker'")
            print("   Trying to find any recent tasks...")
            
            # Try to find any recent tasks
            response = ecs_client.list_tasks(cluster=cluster_arn)
            task_arns = response.get('taskArns', [])[:10]  # Limit to 10 most recent
        
        if not task_arns:
            print("\n⚠️  No tasks found in cluster")
            return
        
        print(f"\n   Found {len(task_arns)} task(s)")
        
        # Describe tasks to get details
        tasks_response = ecs_client.describe_tasks(
            cluster=cluster_arn,
            tasks=task_arns[:10]  # Limit to 10
        )
        
        tasks = tasks_response.get('tasks', [])
        
        for task in tasks:
            task_arn = task.get('taskArn', '')
            task_id = task_arn.split('/')[-1] if '/' in task_arn else task_arn
            created_at = task.get('createdAt')
            started_at = task.get('startedAt')
            stopped_at = task.get('stoppedAt')
            last_status = task.get('lastStatus', 'unknown')
            desired_status = task.get('desiredStatus', 'unknown')
            
            print(f"\n   Task: {task_id}")
            print(f"      Status: {last_status} (desired: {desired_status})")
            if created_at:
                print(f"      Created: {format_timestamp(created_at.isoformat())}")
            if started_at:
                print(f"      Started: {format_timestamp(started_at.isoformat())}")
            if stopped_at:
                print(f"      Stopped: {format_timestamp(stopped_at.isoformat())}")
            
            # Check for stopped reason
            stopped_reason = task.get('stoppedReason', '')
            if stopped_reason:
                print(f"      Stopped Reason: {stopped_reason}")
            
            # Check container status
            containers = task.get('containers', [])
            for container in containers:
                container_name = container.get('name', 'unknown')
                container_status = container.get('lastStatus', 'unknown')
                exit_code = container.get('exitCode')
                reason = container.get('reason', '')
                
                print(f"      Container '{container_name}': {container_status}")
                if exit_code is not None:
                    print(f"         Exit Code: {exit_code}")
                if reason:
                    print(f"         Reason: {reason}")
        
        # Try to get CloudWatch logs
        print_subsection("CloudWatch Logs for Tasks")
        
        log_group = '/ecs/leadmagnet-shell-executor'
        try:
            # Check if log group exists
            logs_client.describe_log_groups(logGroupNamePrefix=log_group)
            
            # Try to get logs for recent tasks
            for task in tasks[:3]:  # Limit to 3 tasks
                task_id = task.get('taskArn', '').split('/')[-1] if '/' in task.get('taskArn', '') else ''
                if not task_id:
                    continue
                
                log_stream = f"ecs/runner/{task_id}"
                
                try:
                    start_ms = int(start_time.timestamp() * 1000)
                    end_ms = int(end_time.timestamp() * 1000)
                    
                    events_response = logs_client.get_log_events(
                        logGroupName=log_group,
                        logStreamName=log_stream,
                        startTime=start_ms,
                        endTime=end_ms,
                        limit=50
                    )
                    
                    events = events_response.get('events', [])
                    if events:
                        print(f"\n   Logs for task {task_id[:20]}... ({len(events)} events):")
                        for event in events[-10:]:  # Show last 10
                            timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                            message = event['message']
                            print(f"      [{format_timestamp(timestamp.isoformat())}] {message[:200]}")
                    else:
                        print(f"\n   No logs found for task {task_id[:20]}...")
                        
                except logs_client.exceptions.ResourceNotFoundException:
                    print(f"\n   Log stream not found: {log_stream}")
                except Exception as e:
                    print(f"\n   Error getting logs for task {task_id[:20]}...: {e}")
                    
        except logs_client.exceptions.ResourceNotFoundException:
            print(f"\n⚠️  Log group '{log_group}' not found")
        except Exception as e:
            print(f"\n⚠️  Error checking logs: {e}")
            
    except Exception as e:
        print(f"\n❌ Error checking tasks: {e}")
        import traceback
        traceback.print_exc()

def check_lambda_logs(job_id, start_time=None, end_time=None):
    """Check Lambda function logs."""
    print_section("4. Lambda Function Logs")
    
    logs_client = boto3.client('logs', region_name=get_aws_region())
    
    log_groups = [
        '/aws/lambda/leadmagnet-job-processor',
        '/aws/lambda/leadmagnet-worker',
    ]
    
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(hours=2)
    
    start_ms = int(start_time.timestamp() * 1000)
    end_ms = int(end_time.timestamp() * 1000)
    
    print(f"\n   Checking logs from {format_timestamp(start_time.isoformat())} to {format_timestamp(end_time.isoformat())}")
    print(f"   Looking for job_id: {job_id}")
    
    for log_group in log_groups:
        try:
            # Check if log group exists
            logs_client.describe_log_groups(logGroupNamePrefix=log_group)
            
            print(f"\n✅ Checking log group: {log_group}")
            
            # Search for job_id
            filter_pattern = f'"{job_id}"'
            
            try:
                response = logs_client.filter_log_events(
                    logGroupName=log_group,
                    filterPattern=filter_pattern,
                    startTime=start_ms,
                    endTime=end_ms,
                    limit=100
                )
                
                events = response.get('events', [])
                print(f"   Found {len(events)} log events")
                
                if events:
                    print("\n   Recent log entries:")
                    for event in events[-20:]:  # Show last 20
                        timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                        message = event['message']
                        # Truncate long messages
                        if len(message) > 500:
                            message = message[:500] + "..."
                        print(f"      [{format_timestamp(timestamp.isoformat())}] {message}")
                else:
                    print("   ⚠️  No log events found for this job_id")
                    
            except logs_client.exceptions.ResourceNotFoundException:
                print(f"   ⚠️  Log group '{log_group}' not found")
            except Exception as e:
                print(f"   ⚠️  Error filtering logs: {e}")
                
        except Exception as e:
            print(f"   ⚠️  Error checking {log_group}: {e}")

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Diagnose shell executor configuration and check for issues"
    )
    parser.add_argument(
        "--job-id",
        help="Job ID to check logs for",
        default=None,
    )
    parser.add_argument(
        "--start-time",
        help="Start time for log search (ISO format, e.g., 2025-12-29T12:00:00)",
        default=None,
    )
    parser.add_argument(
        "--end-time",
        help="End time for log search (ISO format)",
        default=None,
    )
    parser.add_argument(
        "--region",
        help="AWS region (default: from environment or us-east-1)",
        default=None,
    )
    
    args = parser.parse_args()
    
    if args.region:
        os.environ["AWS_REGION"] = args.region
    
    print_section("Shell Executor Diagnostic Tool")
    print(f"Region: {get_aws_region()}")
    
    # Parse times
    start_time = None
    end_time = None
    if args.start_time:
        start_time = datetime.fromisoformat(args.start_time.replace('Z', '+00:00'))
    if args.end_time:
        end_time = datetime.fromisoformat(args.end_time.replace('Z', '+00:00'))
    
    # 1. Check Lambda environment variables
    env_vars = check_lambda_env_vars()
    
    # 2. Check ECS infrastructure
    cluster_arn, task_def_arn = check_ecs_infrastructure()
    
    # 3. Check ECS task logs
    check_ecs_task_logs(cluster_arn, start_time, end_time)
    
    # 4. Check Lambda logs
    if args.job_id:
        check_lambda_logs(args.job_id, start_time, end_time)
    
    # Summary
    print_section("Summary")
    
    if env_vars:
        missing = [v for v in [
            'SHELL_EXECUTOR_RESULTS_BUCKET',
            'SHELL_EXECUTOR_CLUSTER_ARN',
            'SHELL_EXECUTOR_TASK_DEFINITION_ARN',
            'SHELL_EXECUTOR_SECURITY_GROUP_ID',
            'SHELL_EXECUTOR_SUBNET_IDS',
        ] if not env_vars.get(v)]
        
        if missing:
            print(f"\n❌ Missing environment variables: {', '.join(missing)}")
        else:
            print("\n✅ All environment variables are configured")
    
    if cluster_arn and task_def_arn:
        print("\n✅ ECS infrastructure exists")
    else:
        print("\n❌ ECS infrastructure issues detected")
    
    print_section("")

if __name__ == "__main__":
    main()
