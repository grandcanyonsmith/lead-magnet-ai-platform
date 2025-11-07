#!/usr/bin/env python3
"""
Retrieve workflow generation job output from DynamoDB and save it to files.
"""

import json
import os
import sys
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

# Job details
JOB_ID = "wfgen_01K9EACW059X5PSDE826KF8BFC"
TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"
TABLE_NAME = "leadmagnet-jobs"
REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_job_output(job_id: str, tenant_id: str):
    """Retrieve job from DynamoDB and extract output."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    try:
        print(f"Fetching job {job_id} from DynamoDB...")
        response = table.get_item(Key={"job_id": job_id})
        
        if "Item" not in response:
            print(f"Error: Job {job_id} not found in DynamoDB")
            return None
        
        job = response["Item"]
        
        # Verify tenant_id matches
        if job.get("tenant_id") != tenant_id:
            print(f"Warning: Tenant ID mismatch. Expected {tenant_id}, got {job.get('tenant_id')}")
        
        print(f"Job Status: {job.get('status', 'unknown')}")
        print(f"Created: {job.get('created_at', 'unknown')}")
        print(f"Updated: {job.get('updated_at', 'unknown')}")
        
        # Check if job has result
        if "result" not in job:
            print(f"Warning: Job does not have a 'result' field. Status: {job.get('status')}")
            if job.get("status") == "failed":
                print(f"Error message: {job.get('error_message', 'No error message')}")
            return job
        
        result = job["result"]
        print("\n✓ Job result found!")
        
        return {
            "job": {
                "job_id": job.get("job_id"),
                "tenant_id": job.get("tenant_id"),
                "status": job.get("status"),
                "created_at": job.get("created_at"),
                "updated_at": job.get("updated_at"),
            },
            "result": result,
        }
        
    except ClientError as e:
        print(f"Error accessing DynamoDB: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None


def convert_decimals(obj):
    """Convert Decimal types to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        # Convert to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


def get_aws_account_id():
    """Get AWS account ID."""
    try:
        sts = boto3.client("sts", region_name=REGION)
        account_id = sts.get_caller_identity()["Account"]
        return account_id
    except Exception as e:
        print(f"Warning: Could not get AWS account ID: {e}")
        return None


def get_content_type(filename: str) -> str:
    """Get MIME type from filename."""
    ext = filename.split(".")[-1].lower()
    types = {
        "html": "text/html",
        "md": "text/markdown",
        "txt": "text/plain",
        "json": "application/json",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }
    return types.get(ext, "application/octet-stream")


def upload_to_s3(job_id: str, tenant_id: str, local_files: dict):
    """Upload files to S3."""
    try:
        # Get AWS account ID to construct bucket name
        account_id = get_aws_account_id()
        if not account_id:
            print("✗ Cannot upload to S3: Could not determine AWS account ID")
            return False
        
        bucket_name = f"leadmagnet-artifacts-{account_id}"
        s3_client = boto3.client("s3", region_name=REGION)
        
        print(f"\n{'=' * 60}")
        print("Uploading files to S3...")
        print(f"Bucket: {bucket_name}")
        print(f"{'=' * 60}")
        
        uploaded_files = []
        
        for file_type, filepath in local_files.items():
            if not os.path.exists(filepath):
                print(f"⚠ Skipping {file_type}: File not found: {filepath}")
                continue
            
            # Extract filename from path
            filename = os.path.basename(filepath)
            # Construct S3 key: tenant_id/jobs/job_id/filename
            s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
            
            # Read file content
            with open(filepath, "rb") as f:
                content = f.read()
            
            # Determine content type
            content_type = get_content_type(filename)
            
            # Upload to S3
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=content,
                ContentType=content_type,
            )
            
            s3_url = f"s3://{bucket_name}/{s3_key}"
            print(f"✓ Uploaded {file_type}: {s3_url}")
            uploaded_files.append({
                "type": file_type,
                "filename": filename,
                "s3_key": s3_key,
                "s3_url": s3_url,
            })
        
        print(f"\n✓ Successfully uploaded {len(uploaded_files)} file(s) to S3")
        return True
        
    except ClientError as e:
        print(f"✗ Error uploading to S3: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error uploading to S3: {e}")
        return False


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Retrieve and optionally upload workflow generation job output")
    parser.add_argument("--upload", action="store_true", help="Upload files to S3 after retrieval")
    args = parser.parse_args()
    
    print("=" * 60)
    print("Workflow Generation Job Output Retriever")
    print("=" * 60)
    print(f"Job ID: {JOB_ID}")
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Table: {TABLE_NAME}")
    print(f"Region: {REGION}")
    print("=" * 60)
    
    # Get job output
    data = get_job_output(JOB_ID, TENANT_ID)
    
    if not data:
        print("\n✗ Failed to retrieve job output")
        sys.exit(1)
    
    # Save output to files
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = "job_outputs"
    os.makedirs(output_dir, exist_ok=True)
    data = convert_decimals(data)
    
    # Save files and track their paths
    local_files = {}
    
    # Save full job data
    json_filename = f"{output_dir}/{JOB_ID}_{timestamp}.json"
    with open(json_filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Saved full job data to: {json_filename}")
    local_files["full_job"] = json_filename
    
    # Extract and save individual components
    result = data.get("result", {})
    
    # Save workflow data
    if "workflow" in result:
        workflow_filename = f"{output_dir}/{JOB_ID}_workflow_{timestamp}.json"
        with open(workflow_filename, "w", encoding="utf-8") as f:
            json.dump(result["workflow"], f, indent=2, ensure_ascii=False)
        print(f"✓ Saved workflow data to: {workflow_filename}")
        local_files["workflow"] = workflow_filename
    
    # Save template HTML
    if "template" in result and "html_content" in result["template"]:
        html_filename = f"{output_dir}/{JOB_ID}_template_{timestamp}.html"
        with open(html_filename, "w", encoding="utf-8") as f:
            f.write(result["template"]["html_content"])
        print(f"✓ Saved template HTML to: {html_filename}")
        local_files["template_html"] = html_filename
        
        # Also save template metadata
        template_meta_filename = f"{output_dir}/{JOB_ID}_template_meta_{timestamp}.json"
        template_meta = {
            "template_name": result["template"].get("template_name"),
            "template_description": result["template"].get("template_description"),
            "placeholder_tags": result["template"].get("placeholder_tags", []),
        }
        with open(template_meta_filename, "w", encoding="utf-8") as f:
            json.dump(template_meta, f, indent=2, ensure_ascii=False)
        print(f"✓ Saved template metadata to: {template_meta_filename}")
        local_files["template_meta"] = template_meta_filename
    
    # Save form data
    if "form" in result:
        form_filename = f"{output_dir}/{JOB_ID}_form_{timestamp}.json"
        with open(form_filename, "w", encoding="utf-8") as f:
            json.dump(result["form"], f, indent=2, ensure_ascii=False)
        print(f"✓ Saved form data to: {form_filename}")
        local_files["form"] = form_filename
    
    # Upload to S3 if requested
    if args.upload:
        upload_to_s3(JOB_ID, TENANT_ID, local_files)
    
    print("\n" + "=" * 60)
    print("✓ Successfully retrieved and saved job output!")
    print(f"Main output file: {json_filename}")
    if args.upload:
        print("✓ Files uploaded to S3")
    print("=" * 60)


if __name__ == "__main__":
    main()

