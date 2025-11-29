#!/usr/bin/env python3
"""Download all artifact content and write to a local file."""

import sys
import boto3
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    get_dynamodb_resource,
    get_table_name,
    convert_decimals,
    get_aws_region,
)

def download_s3_file(bucket: str, key: str) -> str:
    """Download file from S3 and return content as string."""
    s3 = boto3.client('s3', region_name=get_aws_region())
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read()
        # Try to decode as text
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            # If binary, return as base64 or indicate binary
            return f"[BINARY FILE - {len(content)} bytes]"
    except Exception as e:
        return f"[ERROR DOWNLOADING: {e}]"

def get_s3_bucket_from_url(url: str) -> tuple:
    """Extract bucket and key from S3 URL."""
    # Handle different S3 URL formats
    if 's3://' in url:
        parts = url.replace('s3://', '').split('/', 1)
        return parts[0], parts[1] if len(parts) > 1 else ''
    elif '.s3.' in url or 's3.amazonaws.com' in url:
        # Parse https://bucket.s3.region.amazonaws.com/key or https://s3.region.amazonaws.com/bucket/key
        import re
        match = re.search(r'/([^/]+)/(.+)$', url)
        if match:
            return match.group(1), match.group(2)
    return None, None

def main():
    job_id = "job_01KAYWC2PSSPBE6PAMQAH5P62Z"
    
    print(f"Job ID: {job_id}")
    print(f"Region: {get_aws_region()}")
    print()
    
    dynamodb = get_dynamodb_resource()
    
    # Get artifacts
    artifacts_table = dynamodb.Table(get_table_name("artifacts"))
    response = artifacts_table.query(
        IndexName='gsi_job_id',
        KeyConditionExpression='job_id = :job_id',
        ExpressionAttributeValues={':job_id': job_id}
    )
    
    artifacts = [convert_decimals(item) for item in response.get('Items', [])]
    print(f"✅ Found {len(artifacts)} artifacts")
    
    # Sort artifacts by created_at
    artifacts.sort(key=lambda x: x.get('created_at', ''))
    
    # Build output content
    output_lines = []
    output_lines.append("=" * 80)
    output_lines.append(f"ARTIFACTS FOR JOB: {job_id}")
    output_lines.append(f"Generated: {datetime.now().isoformat()}")
    output_lines.append(f"Total Artifacts: {len(artifacts)}")
    output_lines.append("=" * 80)
    output_lines.append("")
    
    for i, artifact in enumerate(artifacts, 1):
        artifact_id = artifact.get('artifact_id')
        artifact_name = artifact.get('artifact_name') or artifact.get('file_name', 'Unknown')
        artifact_type = artifact.get('artifact_type', 'unknown')
        s3_key = artifact.get('s3_key')
        s3_url = artifact.get('s3_url')
        public_url = artifact.get('public_url')
        created_at = artifact.get('created_at', '')
        
        output_lines.append("")
        output_lines.append("-" * 80)
        output_lines.append(f"ARTIFACT {i}/{len(artifacts)}")
        output_lines.append("-" * 80)
        output_lines.append(f"ID: {artifact_id}")
        output_lines.append(f"Name: {artifact_name}")
        output_lines.append(f"Type: {artifact_type}")
        output_lines.append(f"Created: {created_at}")
        if s3_key:
            output_lines.append(f"S3 Key: {s3_key}")
        if s3_url:
            output_lines.append(f"S3 URL: {s3_url}")
        if public_url:
            output_lines.append(f"Public URL: {public_url}")
        output_lines.append("")
        output_lines.append("CONTENT:")
        output_lines.append("-" * 80)
        
        # Try to download content
        content = None
        
        # Try S3 key first
        if s3_key:
            # Extract bucket name (usually from environment or URL)
            # Try to get bucket from S3 URL or use default pattern
            bucket = None
            if s3_url:
                bucket, key = get_s3_bucket_from_url(s3_url)
                if bucket and key:
                    print(f"Downloading {artifact_name} from s3://{bucket}/{key}...")
                    content = download_s3_file(bucket, key)
            else:
                # Try to infer bucket from s3_key pattern
                # Common pattern: cust_xxx/jobs/job_xxx/filename
                # Bucket is usually leadmagnet-artifacts-{account_id}
                import os
                account_id = os.environ.get('AWS_ACCOUNT_ID', '471112574622')
                bucket = f"leadmagnet-artifacts-{account_id}"
                print(f"Downloading {artifact_name} from s3://{bucket}/{s3_key}...")
                try:
                    content = download_s3_file(bucket, s3_key)
                except Exception as e:
                    print(f"  Failed: {e}")
        
        # Try public URL if S3 failed
        if not content and public_url:
            print(f"Trying to download {artifact_name} from {public_url}...")
            try:
                import requests
                response = requests.get(public_url, timeout=30)
                if response.status_code == 200:
                    try:
                        content = response.text
                    except:
                        content = f"[BINARY CONTENT - {len(response.content)} bytes]"
            except Exception as e:
                print(f"  Failed: {e}")
        
        if content:
            output_lines.append(content)
            print(f"  ✅ Downloaded {len(content)} characters")
        else:
            output_lines.append("[CONTENT NOT AVAILABLE - Could not download from S3 or public URL]")
            print(f"  ⚠️  Could not download content")
        
        output_lines.append("")
    
    # Write to file
    output_file = Path(__file__).parent.parent / f"artifacts_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    print()
    print(f"Writing to file: {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))
    
    print(f"✅ File written: {output_file}")
    print(f"   Size: {output_file.stat().st_size} bytes")
    print(f"   Lines: {len(output_lines)}")
    
    # Try to open the file
    import os
    if sys.platform == 'darwin':  # macOS
        os.system(f'open "{output_file}"')
    elif sys.platform == 'linux':
        os.system(f'xdg-open "{output_file}"')
    elif sys.platform == 'win32':
        os.system(f'start "" "{output_file}"')
    
    print(f"✅ File opened in default editor")
    
    return str(output_file)

if __name__ == '__main__':
    try:
        output_file = main()
        print(f"\n✅ Done! Output file: {output_file}")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)




