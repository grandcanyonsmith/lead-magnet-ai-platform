#!/usr/bin/env python3
"""
Shared utilities for Lead Magnet AI scripts.

This module provides common functionality used across multiple scripts:
- AWS client initialization and configuration
- DynamoDB Decimal conversion
- Step Functions execution lookup
- Table name resolution
- Output formatting
"""

import os
import json
import boto3
from decimal import Decimal
from typing import Dict, Optional, Any, List
from botocore.exceptions import ClientError
from functools import lru_cache


# Cache AWS clients to avoid reinitializing
_clients_cache: Dict[str, Any] = {}


def convert_decimals(obj: Any) -> Any:
    """
    Convert Decimal types to float/int for JSON serialization.
    
    DynamoDB returns Decimal types which aren't JSON serializable.
    This function recursively converts all Decimals in a nested structure.
    
    Args:
        obj: Object that may contain Decimal values
        
    Returns:
        Object with Decimals converted to int or float
    """
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


@lru_cache(maxsize=1)
def get_aws_region() -> str:
    """
    Get AWS region from environment or default.
    
    Returns:
        AWS region string (default: us-east-1)
    """
    return os.environ.get("AWS_REGION", "us-east-1")


@lru_cache(maxsize=1)
def get_aws_account_id() -> str:
    """
    Get AWS account ID.
    
    Returns:
        AWS account ID string
        
    Raises:
        ClientError: If unable to get account ID
    """
    try:
        sts = boto3.client("sts", region_name=get_aws_region())
        return sts.get_caller_identity()["Account"]
    except ClientError as e:
        raise RuntimeError(f"Failed to get AWS account ID: {e}") from e


def get_dynamodb_client():
    """Get or create cached DynamoDB client."""
    region = get_aws_region()
    cache_key = f"dynamodb_{region}"
    if cache_key not in _clients_cache:
        _clients_cache[cache_key] = boto3.client("dynamodb", region_name=region)
    return _clients_cache[cache_key]


def get_dynamodb_resource():
    """Get or create cached DynamoDB resource."""
    region = get_aws_region()
    cache_key = f"dynamodb_resource_{region}"
    if cache_key not in _clients_cache:
        _clients_cache[cache_key] = boto3.resource("dynamodb", region_name=region)
    return _clients_cache[cache_key]


def get_s3_client():
    """Get or create cached S3 client."""
    region = get_aws_region()
    cache_key = f"s3_{region}"
    if cache_key not in _clients_cache:
        _clients_cache[cache_key] = boto3.client("s3", region_name=region)
    return _clients_cache[cache_key]


def get_stepfunctions_client():
    """Get or create cached Step Functions client."""
    region = get_aws_region()
    cache_key = f"stepfunctions_{region}"
    if cache_key not in _clients_cache:
        _clients_cache[cache_key] = boto3.client("stepfunctions", region_name=region)
    return _clients_cache[cache_key]


def get_logs_client():
    """Get or create cached CloudWatch Logs client."""
    region = get_aws_region()
    cache_key = f"logs_{region}"
    if cache_key not in _clients_cache:
        _clients_cache[cache_key] = boto3.client("logs", region_name=region)
    return _clients_cache[cache_key]


def get_table_name(table_type: str) -> str:
    """
    Get DynamoDB table name for a given table type.
    
    Args:
        table_type: One of 'jobs', 'workflows', 'forms', 'submissions', 
                   'artifacts', 'templates'
                   
    Returns:
        Table name string
        
    Raises:
        ValueError: If table_type is invalid
    """
    table_names = {
        "jobs": "leadmagnet-jobs",
        "workflows": "leadmagnet-workflows",
        "forms": "leadmagnet-forms",
        "submissions": "leadmagnet-submissions",
        "artifacts": "leadmagnet-artifacts",
        "templates": "leadmagnet-templates",
    }
    
    if table_type not in table_names:
        raise ValueError(
            f"Invalid table_type: {table_type}. "
            f"Must be one of: {', '.join(table_names.keys())}"
        )
    
    # Allow override via environment variable
    env_key = f"{table_type.upper()}_TABLE"
    return os.environ.get(env_key, table_names[table_type])


def get_artifacts_bucket() -> str:
    """
    Get artifacts S3 bucket name.
    
    Returns:
        Bucket name string
    """
    bucket = os.environ.get("ARTIFACTS_BUCKET")
    if bucket:
        return bucket
    
    account_id = get_aws_account_id()
    return f"leadmagnet-artifacts-{account_id}"


def find_step_functions_execution(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Find Step Functions execution for a given job_id.
    
    Searches through Step Functions executions to find one that matches
    the given job_id in its input.
    
    Args:
        job_id: Job ID to search for
        
    Returns:
        Execution details dict if found, None otherwise
    """
    sfn = get_stepfunctions_client()
    
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
            return None
        
        sm_arn = job_processor_sm["stateMachineArn"]
        
        # List recent executions - check RUNNING first, then others
        executions = []
        for status in ["RUNNING", "FAILED", "SUCCEEDED", "TIMED_OUT", "ABORTED"]:
            try:
                result = sfn.list_executions(
                    stateMachineArn=sm_arn,
                    maxResults=100,
                    statusFilter=status
                )
                executions.extend(result.get("executions", []))
            except ClientError:
                continue
        
        # Find execution with matching input
        for execution in executions:
            try:
                exec_details = sfn.describe_execution(
                    executionArn=execution["executionArn"]
                )
                input_data = json.loads(exec_details.get("input", "{}"))
                
                if input_data.get("job_id") == job_id:
                    return exec_details
            except Exception:
                continue
        
        return None
        
    except ClientError:
        return None


def get_step_functions_arn() -> Optional[str]:
    """
    Get Step Functions state machine ARN from CloudFormation or by listing.
    
    Returns:
        State machine ARN if found, None otherwise
    """
    region = get_aws_region()
    
    # Try CloudFormation first
    try:
        cf = boto3.client("cloudformation", region_name=region)
        stacks = cf.describe_stacks()
        
        for stack in stacks.get("Stacks", []):
            if "compute" in stack["StackName"].lower():
                outputs = {
                    o["OutputKey"]: o["OutputValue"]
                    for o in stack.get("Outputs", [])
                }
                if "StateMachineArn" in outputs:
                    return outputs["StateMachineArn"]
    except Exception:
        pass
    
    # Fallback: list state machines
    try:
        sfn = get_stepfunctions_client()
        machines = sfn.list_state_machines()
        for machine in machines.get("stateMachines", []):
            if "job" in machine["name"].lower() or "processor" in machine["name"].lower():
                return machine["stateMachineArn"]
    except Exception:
        pass
    
    return None


def format_timestamp(timestamp: Any) -> str:
    """
    Format timestamp for display.
    
    Args:
        timestamp: ISO timestamp string or datetime object
        
    Returns:
        Formatted timestamp string
    """
    from datetime import datetime
    
    if isinstance(timestamp, str):
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return str(timestamp)
    elif hasattr(timestamp, "isoformat"):
        return timestamp.strftime("%Y-%m-%d %H:%M:%S")
    else:
        return str(timestamp)


def print_section(title: str, width: int = 80):
    """
    Print a formatted section header.
    
    Args:
        title: Section title
        width: Width of the section divider
    """
    print("=" * width)
    print(title)
    print("=" * width)


def print_subsection(title: str, width: int = 80):
    """
    Print a formatted subsection header.
    
    Args:
        title: Subsection title
        width: Width of the subsection divider
    """
    print("-" * width)
    print(title)
    print("-" * width)

