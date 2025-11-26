#!/usr/bin/env python3
"""Send all artifact content to webhook with specified profile data."""

import sys
import json
import requests
import gzip
from datetime import datetime
from pathlib import Path

# Read the artifact content from the file
def read_artifacts_file():
    """Read the artifacts file."""
    artifacts_file = Path(__file__).parent.parent / "artifacts_job_01KAYWC2PSSPBE6PAMQAH5P62Z_20251125_185637.txt"
    
    if not artifacts_file.exists():
        # Try to find any artifacts file for this job
        artifacts_files = list(Path(__file__).parent.parent.glob("artifacts_job_01KAYWC2PSSPBE6PAMQAH5P62Z_*.txt"))
        if artifacts_files:
            artifacts_file = artifacts_files[0]
        else:
            raise FileNotFoundError("Artifacts file not found")
    
    with open(artifacts_file, 'r', encoding='utf-8') as f:
        return f.read()

def build_webhook_payload(artifacts_content: str):
    """Build webhook payload with profile data and artifacts."""
    
    # Profile data as specified by user
    profile = {
        "name": "Dennis Smith",
        "first_name": "dennis",
        "last_name": "smith",
        "phone": "8016237631",  # Using phone from artifacts
        "email": "canyonfsmith@gmail.com",
        "contact": {
            "phone": "8016237631",
            "email": "canyonfsmith@gmail.com"
        },
        "website": "https://www.cherenkovcodeconsulting.com",
        "social": {
            "twitter": None,
            "instagram": None,
            "facebook": [None, None]
        }
    }
    
    # Build payload with FULL artifact content
    # Server expects artifacts to be an array
    payload = {
        "event": "profile.submit",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "form_submission",
        "profile": profile,
        "context": artifacts_content,  # ALL artifact content as context - send it all or don't send at all
        "artifacts": [  # Must be an array for server
            {
                "artifact_id": "all_content",
                "artifact_type": "full_context",
                "content": artifacts_content,
                "job_id": "job_01KAYWC2PSSPBE6PAMQAH5P62Z",
                "workflow_id": "wf_01KAHH0134PC5EB380Z36VW4QJ",
                "submission_id": "sub_01KAYWC2NGH5E1KQFWX0G5AAMW",
                "total_artifacts": 17
            }
        ]
    }
    
    return payload

def send_alternative_format(webhook_url: str, artifacts_content: str):
    """Send with minimal payload - profile + summary."""
    print("Sending minimal format with profile and summary...")
    
    # Extract key sections from artifacts
    lines = artifacts_content.split('\n')
    summary_lines = []
    current_section = None
    
    for line in lines[:500]:  # First 500 lines should cover key sections
        if 'ARTIFACT' in line and '/' in line:
            summary_lines.append(line)
        elif 'Name:' in line or 'Type:' in line:
            summary_lines.append(line)
        elif line.startswith('CONTENT:'):
            summary_lines.append(line)
            # Include first few lines of content
            idx = lines.index(line)
            summary_lines.extend(lines[idx+1:idx+20])
    
    summary = '\n'.join(summary_lines[:200])  # Limit to 200 lines
    
    profile = {
        "name": "Dennis Smith",
        "first_name": "dennis",
        "last_name": "smith",
        "phone": "8016237631",
        "email": "canyonfsmith@gmail.com",
        "contact": {
            "phone": "8016237631",
            "email": "canyonfsmith@gmail.com"
        },
        "website": "https://www.cherenkovcodeconsulting.com",
    }
    
    # Minimal payload
    payload = {
        "event": "profile.submit",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "form_submission",
        "profile": profile,
        "artifacts_summary": {
            "job_id": "job_01KAYWC2PSSPBE6PAMQAH5P62Z",
            "workflow_id": "wf_01KAHH0134PC5EB380Z36VW4QJ",
            "submission_id": "sub_01KAYWC2NGH5E1KQFWX0G5AAMW",
            "total_artifacts": 17,
            "summary": summary,
            "full_content_size": len(artifacts_content),
            "note": f"Full content ({len(artifacts_content)} chars) available - see artifacts file"
        }
    }
    
    print(f"Minimal payload size: {len(json.dumps(payload))} bytes")
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=300
        )
        response.raise_for_status()
        print(f"✅ Minimal format sent successfully!")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return True
    except Exception as e:
        print(f"❌ Minimal format failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Status: {e.response.status_code}")
            print(f"Response: {e.response.text[:500]}")
        return False

def main():
    webhook_url = "https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"
    
    print("=" * 80)
    print("Sending Full Artifacts to Webhook")
    print("=" * 80)
    print()
    
    # Read artifacts content
    print("Reading artifacts file...")
    try:
        artifacts_content = read_artifacts_file()
        print(f"✅ Read {len(artifacts_content)} characters from artifacts file")
    except Exception as e:
        print(f"❌ Error reading artifacts file: {e}")
        return False
    
    # Build payload
    print("Building webhook payload...")
    payload = build_webhook_payload(artifacts_content)
    
    print(f"Profile:")
    print(f"  Name: {payload['profile']['name']}")
    print(f"  Email: {payload['profile']['email']}")
    print(f"  Phone: {payload['profile']['phone']}")
    print()
    payload_json = json.dumps(payload)
    payload_size_mb = len(payload_json) / (1024 * 1024)
    print(f"Payload size: {len(payload_json):,} bytes ({payload_size_mb:.2f} MB)")
    print(f"Artifacts content: {len(artifacts_content):,} characters")
    print()
    
    # Send webhook (server now accepts up to 50MB)
    print(f"Sending POST to: {webhook_url}")
    print(f"Server accepts up to 50MB - sending full content...")
    print()
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={
                'Content-Type': 'application/json',
            },
            timeout=600  # 10 minute timeout for large payload
        )
        
        # Check status before raising
        if response.status_code >= 400:
            print(f"❌ Server returned error status: {response.status_code}")
            print(f"Response body:")
            print(response.text[:3000])
            return False
        
        # Success
        print(f"✅ Webhook sent successfully!")
        print(f"Status: {response.status_code}")
        print(f"Response length: {len(response.text):,} characters")
        print()
        print("Response preview:")
        print(response.text[:1000])
        if len(response.text) > 1000:
            print(f"... (truncated, total {len(response.text):,} chars)")
        
        return True
        
        response.raise_for_status()
        
        response.raise_for_status()
        print(f"✅ Webhook sent successfully!")
        print(f"Status: {response.status_code}")
        print(f"Response length: {len(response.text)} characters")
        print()
        print("Response preview:")
        print(response.text[:1000])
        if len(response.text) > 1000:
            print(f"... (truncated, total {len(response.text)} chars)")
        
        return True
        
    except requests.exceptions.Timeout:
        print(f"⚠️  Request timed out after 5 minutes")
        print(f"   The server may be processing the large payload")
        print(f"   Payload was prepared and sent, but no response received")
        return False
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Status: {e.response.status_code}")
            print(f"Response headers: {dict(e.response.headers)}")
            try:
                error_body = e.response.text
                print(f"Response body ({len(error_body)} chars):")
                print(error_body[:2000])  # Show first 2000 chars
            except:
                print("Could not read response body")
        return False
    except Exception as e:
        print(f"❌ Error sending webhook: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Status: {e.response.status_code}")
            print(f"Response: {e.response.text[:1000]}")
        import traceback
        traceback.print_exc()
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

