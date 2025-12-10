#!/usr/bin/env python3
"""Simple script to send webhook with artifacts for a specific job."""

import sys
import json
import requests
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    get_dynamodb_resource,
    get_table_name,
    convert_decimals,
)

def main():
    job_id = "job_01KAYWC2PSSPBE6PAMQAH5P62Z"
    webhook_url = "https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"
    
    print(f"Job ID: {job_id}")
    print(f"Webhook URL: {webhook_url}")
    print()
    
    dynamodb = get_dynamodb_resource()
    
    # Get job
    jobs_table = dynamodb.Table(get_table_name("jobs"))
    job_response = jobs_table.get_item(Key={'job_id': job_id})
    if 'Item' not in job_response:
        print(f"❌ Job {job_id} not found!")
        return False
    
    job = convert_decimals(job_response['Item'])
    workflow_id = job.get('workflow_id')
    submission_id = job.get('submission_id')
    
    print(f"✅ Found job")
    print(f"   Workflow ID: {workflow_id}")
    print(f"   Submission ID: {submission_id}")
    
    # Get submission
    submissions_table = dynamodb.Table(get_table_name("submissions"))
    sub_response = submissions_table.get_item(Key={'submission_id': submission_id})
    if 'Item' not in sub_response:
        print(f"❌ Submission {submission_id} not found!")
        return False
    
    submission = convert_decimals(sub_response['Item'])
    submission_data = submission.get('submission_data', {})
    
    # Get artifacts
    artifacts_table = dynamodb.Table(get_table_name("artifacts"))
    response = artifacts_table.query(
        IndexName='gsi_job_id',
        KeyConditionExpression='job_id = :job_id',
        ExpressionAttributeValues={':job_id': job_id}
    )
    
    artifacts = [convert_decimals(item) for item in response.get('Items', [])]
    print(f"✅ Found {len(artifacts)} artifacts")
    
    # Build artifact lists
    artifacts_list = []
    images_list = []
    html_files_list = []
    markdown_files_list = []
    
    for artifact in artifacts:
        public_url = artifact.get('public_url') or artifact.get('s3_url') or ''
        artifact_meta = {
            'artifact_id': artifact.get('artifact_id'),
            'artifact_type': artifact.get('artifact_type'),
            'artifact_name': artifact.get('artifact_name') or artifact.get('file_name') or '',
            'public_url': public_url,
            'object_url': public_url,
            's3_key': artifact.get('s3_key'),
            's3_url': artifact.get('s3_url'),
            'file_size_bytes': artifact.get('file_size_bytes'),
            'mime_type': artifact.get('mime_type'),
            'created_at': artifact.get('created_at')
        }
        artifacts_list.append(artifact_meta)
        
        artifact_type = artifact.get('artifact_type', '').lower()
        artifact_name = (artifact_meta['artifact_name'] or '').lower()
        
        if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            images_list.append(artifact_meta)
        elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
            html_files_list.append(artifact_meta)
        elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
            markdown_files_list.append(artifact_meta)
    
    # Build payload
    from datetime import datetime
    payload = {
        'event': 'profile.submit',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'source': 'form_submission',
        'profile': submission_data,
        'artifacts': artifacts_list,
        'images': images_list,
        'html_files': html_files_list,
        'markdown_files': markdown_files_list,
    }
    
    print(f"\nSending webhook...")
    print(f"Payload size: {len(json.dumps(payload))} bytes")
    print(f"Artifacts: {len(artifacts_list)}")
    print(f"Images: {len(images_list)}")
    print(f"HTML files: {len(html_files_list)}")
    print(f"Markdown files: {len(markdown_files_list)}")
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=180
        )
        response.raise_for_status()
        print(f"\n✅ Webhook sent successfully!")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return True
    except requests.exceptions.Timeout:
        print(f"\n⚠️  Request timed out (server may be slow)")
        print(f"   Payload was prepared and ready to send")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Status: {e.response.status_code}")
            print(f"Response: {e.response.text[:500]}")
        return False

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)













