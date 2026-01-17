#!/usr/bin/env python3
"""
Script to fetch OpenAI audit logs and generate an HTML report.
Uploads to S3 bucket cc360-pages in us-west-2.
"""
import os
import sys
import json
import boto3
import requests
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
from urllib.parse import urlencode

def get_openai_api_key() -> str:
    """Get OpenAI API key from environment or AWS Secrets Manager."""
    # Try environment variables first
    api_key = (
        os.getenv("OPENAI_ADMIN_KEY") or
        os.getenv("OPENAI_API_KEY") or
        os.getenv("OPENAI_KEY")
    )
    
    if api_key:
        return api_key.strip()
    
    # Try AWS Secrets Manager
    try:
        import boto3
        secrets_client = boto3.client("secretsmanager", region_name="us-east-1")
        secret_name = os.getenv("OPENAI_SECRET_NAME", "leadmagnet/openai-api-key")
        
        response = secrets_client.get_secret_value(SecretId=secret_name)
        secret_string = response.get("SecretString", "")
        
        # Try parsing as JSON
        try:
            secret_dict = json.loads(secret_string)
            api_key = (
                secret_dict.get("OPENAI_ADMIN_KEY") or
                secret_dict.get("OPENAI_API_KEY") or
                secret_dict.get("api_key") or
                secret_dict.get("openai_api_key")
            )
        except json.JSONDecodeError:
            api_key = secret_string
        
        if api_key:
            return api_key.strip()
    except Exception as e:
        print(f"Warning: Could not get key from Secrets Manager: {e}")
    
    raise ValueError(
        "OpenAI API key not found. Set OPENAI_ADMIN_KEY, OPENAI_API_KEY, or OPENAI_KEY environment variable."
    )

def fetch_audit_logs(
    api_key: str,
    limit: int = 100,
    after: Optional[str] = None,
    before: Optional[str] = None,
    event_types: Optional[List[str]] = None,
    actor_emails: Optional[List[str]] = None,
    actor_ids: Optional[List[str]] = None,
    project_ids: Optional[List[str]] = None,
    resource_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Fetch audit logs from OpenAI API."""
    url = "https://api.openai.com/v1/organization/audit_logs"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    params = {"limit": limit}
    if after:
        params["after"] = after
    if before:
        params["before"] = before
    if event_types:
        params["event_types[]"] = event_types
    if actor_emails:
        params["actor_emails[]"] = actor_emails
    if actor_ids:
        params["actor_ids[]"] = actor_ids
    if project_ids:
        params["project_ids[]"] = project_ids
    if resource_ids:
        params["resource_ids[]"] = resource_ids
    
    print(f"Fetching audit logs from OpenAI API...")
    print(f"URL: {url}")
    print(f"Params: {params}")
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            error_body = e.response.json() if e.response.text else {}
            error_msg = error_body.get("error", {}).get("message", str(e))
            raise ValueError(
                f"Authentication failed: {error_msg}\n\n"
                "To access audit logs, you need:\n"
                "1. An OpenAI API key with admin/organization owner permissions\n"
                "2. The 'api.audit_logs.read' scope enabled\n"
                "3. Audit logging must be activated in your organization's Data Controls Settings\n\n"
                "Please use an admin API key with the correct permissions."
            )
        raise
    except requests.exceptions.RequestException as e:
        print(f"Error fetching audit logs: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        raise

def fetch_all_audit_logs(api_key: str, max_pages: int = 10) -> List[Dict[str, Any]]:
    """Fetch all audit logs with pagination."""
    all_logs = []
    after = None
    page = 0
    
    while page < max_pages:
        print(f"\nFetching page {page + 1}...")
        result = fetch_audit_logs(api_key, limit=100, after=after)
        
        logs = result.get("data", [])
        if not logs:
            print("No more logs to fetch.")
            break
        
        all_logs.extend(logs)
        print(f"Fetched {len(logs)} logs (total: {len(all_logs)})")
        
        # Check if there are more pages
        has_more = result.get("has_more", False)
        if not has_more:
            print("No more pages available.")
            break
        
        # Get the last ID for pagination
        last_id = result.get("last_id")
        if last_id:
            after = last_id
        else:
            # Fallback: use the last log's ID
            if logs:
                after = logs[-1].get("id")
        
        page += 1
    
    return all_logs

def format_timestamp(ts: int) -> str:
    """Format Unix timestamp to readable string."""
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")

def format_actor(actor: Dict[str, Any]) -> str:
    """Format actor information."""
    actor_type = actor.get("type", "unknown")
    
    if actor_type == "api_key":
        api_key_info = actor.get("api_key", {})
        key_type = api_key_info.get("type", "unknown")
        if key_type == "user":
            user = api_key_info.get("user", {})
            return f"API Key (User: {user.get('email', 'N/A')})"
        return f"API Key ({key_type})"
    
    elif actor_type == "session":
        session = actor.get("session", {})
        user = session.get("user", {})
        ip = session.get("ip_address", "N/A")
        return f"Session (User: {user.get('email', 'N/A')}, IP: {ip})"
    
    elif actor_type == "service_account":
        sa = actor.get("service_account", {})
        return f"Service Account ({sa.get('id', 'N/A')})"
    
    return f"{actor_type}"

def format_event_details(log: Dict[str, Any]) -> str:
    """Format event-specific details."""
    event_type = log.get("type", "")
    details_key = event_type.replace(".", "_")
    details = log.get(event_type, {})
    
    if not details:
        return "No additional details"
    
    # Format common fields
    formatted = []
    if "id" in details:
        formatted.append(f"ID: {details['id']}")
    if "data" in details:
        data = details["data"]
        if isinstance(data, dict):
            for key, value in data.items():
                formatted.append(f"{key}: {json.dumps(value)}")
        else:
            formatted.append(f"Data: {json.dumps(data)}")
    
    return "<br>".join(formatted) if formatted else "No additional details"

def generate_html_report(logs: List[Dict[str, Any]]) -> str:
    """Generate HTML report from audit logs."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    # Count events by type
    event_counts = {}
    for log in logs:
        event_type = log.get("type", "unknown")
        event_counts[event_type] = event_counts.get(event_type, 0) + 1
    
    # Get unique actors
    actors = set()
    for log in logs:
        actor = log.get("actor", {})
        actor_str = format_actor(actor)
        actors.add(actor_str)
    
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenAI Organization Audit Log Report</title>
  <style>
    * {{
      box-sizing: border-box;
    }}
    body {{
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }}
    .container {{
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
    }}
    h1 {{
      margin: 0 0 10px 0;
      color: #1f2937;
      font-size: 36px;
      border-bottom: 3px solid #667eea;
      padding-bottom: 20px;
    }}
    .subtitle {{
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 30px;
    }}
    .summary {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }}
    .summary-card {{
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }}
    .summary-card h3 {{
      margin: 0 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
    }}
    .summary-card .value {{
      font-size: 32px;
      font-weight: 700;
      margin: 0;
    }}
    .event-types {{
      margin-bottom: 40px;
    }}
    .event-types h2 {{
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 20px;
    }}
    .event-type-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
    }}
    .event-type-item {{
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }}
    .event-type-item .type {{
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 5px;
    }}
    .event-type-item .count {{
      color: #667eea;
      font-size: 24px;
      font-weight: 700;
    }}
    .logs-section {{
      margin-top: 40px;
    }}
    .logs-section h2 {{
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 20px;
    }}
    .log-table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }}
    .log-table th {{
      background: #667eea;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      position: sticky;
      top: 0;
    }}
    .log-table td {{
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }}
    .log-table tr:hover {{
      background: #f9fafb;
    }}
    .log-id {{
      font-family: monospace;
      font-size: 12px;
      color: #6b7280;
    }}
    .event-type {{
      font-weight: 600;
      color: #667eea;
    }}
    .actor {{
      color: #1f2937;
    }}
    .timestamp {{
      color: #6b7280;
      font-size: 14px;
    }}
    .details {{
      font-size: 12px;
      color: #6b7280;
      max-width: 400px;
    }}
    .no-logs {{
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }}
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 OpenAI Organization Audit Log Report</h1>
    <div class="subtitle">Generated: {timestamp}</div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Events</h3>
        <p class="value">{len(logs):,}</p>
      </div>
      <div class="summary-card">
        <h3>Event Types</h3>
        <p class="value">{len(event_counts)}</p>
      </div>
      <div class="summary-card">
        <h3>Unique Actors</h3>
        <p class="value">{len(actors)}</p>
      </div>
      <div class="summary-card">
        <h3>Time Range</h3>
        <p class="value" style="font-size: 16px;">
          {format_timestamp(min((log.get("effective_at", 0) for log in logs), default=0)) if logs else "N/A"}<br>
          to<br>
          {format_timestamp(max((log.get("effective_at", 0) for log in logs), default=0)) if logs else "N/A"}
        </p>
      </div>
    </div>
    
    <div class="event-types">
      <h2>📊 Event Types Summary</h2>
      <div class="event-type-grid">
"""
    
    # Sort event types by count
    sorted_types = sorted(event_counts.items(), key=lambda x: x[1], reverse=True)
    for event_type, count in sorted_types:
        html += f"""
        <div class="event-type-item">
          <div class="type">{event_type}</div>
          <div class="count">{count:,}</div>
        </div>
"""
    
    html += """
      </div>
    </div>
    
    <div class="logs-section">
      <h2>📋 Detailed Audit Logs</h2>
"""
    
    if logs:
        html += """
      <table class="log-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Actor</th>
            <th>Timestamp</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
"""
        for log in logs:
            log_id = log.get("id", "N/A")
            event_type = log.get("type", "unknown")
            actor = format_actor(log.get("actor", {}))
            timestamp = format_timestamp(log.get("effective_at", 0))
            details = format_event_details(log)
            
            html += f"""
          <tr>
            <td class="log-id">{log_id}</td>
            <td class="event-type">{event_type}</td>
            <td class="actor">{actor}</td>
            <td class="timestamp">{timestamp}</td>
            <td class="details">{details}</td>
          </tr>
"""
        
        html += """
        </tbody>
      </table>
"""
    else:
        html += """
      <div class="no-logs">
        <p>No audit logs found.</p>
      </div>
"""
    
    html += """
    </div>
  </div>
</body>
</html>
"""
    
    return html

def upload_html(bucket: str, key: str, region: str, html: str) -> str:
    """Upload HTML to S3 and return object URL."""
    s3 = boto3.client("s3", region_name=region)
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=html.encode("utf-8"),
        ContentType="text/html; charset=utf-8",
        CacheControl="no-cache",
    )
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"

def main():
    """Main function."""
    print("=" * 60)
    print("OpenAI Organization Audit Log Report Generator")
    print("=" * 60)
    
    # Get API key
    try:
        api_key = get_openai_api_key()
        print(f"\n✅ API key found (length: {len(api_key)})")
    except ValueError as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
    
    # Fetch audit logs
    try:
        print("\n" + "=" * 60)
        print("Fetching audit logs...")
        print("=" * 60)
        logs = fetch_all_audit_logs(api_key, max_pages=10)
        print(f"\n✅ Fetched {len(logs)} audit log entries")
    except ValueError as e:
        print(f"\n❌ Permission Error:")
        print(str(e))
        print("\n" + "=" * 60)
        print("Generating error report page...")
        print("=" * 60)
        # Generate an error report HTML page
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenAI Audit Log Report - Error</title>
  <style>
    body {{
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      margin: 0;
      padding: 40px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .card {{
      max-width: 800px;
      padding: 40px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }}
    h1 {{
      color: #dc2626;
      margin-top: 0;
    }}
    .error-box {{
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }}
    .instructions {{
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }}
    code {{
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }}
    .timestamp {{
      color: #6b7280;
      font-size: 14px;
      margin-top: 20px;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ OpenAI Audit Log Access Error</h1>
    <div class="timestamp">Generated: {timestamp}</div>
    
    <div class="error-box">
      <h2>Permission Denied</h2>
      <p>The API key used does not have sufficient permissions to access audit logs.</p>
    </div>
    
    <div class="instructions">
      <h2>Required Permissions</h2>
      <p>To generate an audit log report, you need:</p>
      <ol>
        <li><strong>Admin API Key</strong>: An OpenAI API key with organization owner/admin permissions</li>
        <li><strong>Scope</strong>: The <code>api.audit_logs.read</code> scope must be enabled</li>
        <li><strong>Audit Logging Enabled</strong>: Audit logging must be activated in your organization's Data Controls Settings</li>
      </ol>
      
      <h3>How to Fix:</h3>
      <ol>
        <li>Log into your OpenAI organization dashboard</li>
        <li>Go to <strong>Data Controls Settings</strong></li>
        <li>Activate audit logging (once activated, it cannot be deactivated)</li>
        <li>Create an API key with admin permissions and the <code>api.audit_logs.read</code> scope</li>
        <li>Set the key as <code>OPENAI_ADMIN_KEY</code> environment variable and run this script again</li>
      </ol>
      
      <h3>API Endpoint:</h3>
      <p><code>GET https://api.openai.com/v1/organization/audit_logs</code></p>
      
      <h3>Error Details:</h3>
      <pre style="background: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto;">{str(e)}</pre>
    </div>
  </div>
</body>
</html>
"""
        # Upload error report
        bucket = "cc360-pages"
        region = "us-west-2"
        timestamp_file = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        key = f"openai-organization-audit-log-error-report-{timestamp_file}.html"
        
        print(f"\nUploading error report to S3...")
        url = upload_html(bucket, key, region, html)
        print(f"\n✅ Error report uploaded: {url}")
        
        # Output JSON result
        result = {
            "status": "error",
            "url": url,
            "bucket": bucket,
            "key": key,
            "region": region,
            "error": str(e),
            "message": "Permission denied - admin API key with api.audit_logs.read scope required"
        }
        print("\n" + "=" * 60)
        print("RESULT (JSON):")
        print("=" * 60)
        print(json.dumps(result, indent=2))
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error fetching audit logs: {e}")
        sys.exit(1)
    
    # Generate HTML report
    print("\n" + "=" * 60)
    print("Generating HTML report...")
    print("=" * 60)
    html = generate_html_report(logs)
    
    # Upload to S3
    bucket = "cc360-pages"
    region = "us-west-2"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"openai-organization-audit-log-comprehensive-report-{timestamp}.html"
    
    print(f"\n" + "=" * 60)
    print(f"Uploading to S3...")
    print(f"Bucket: {bucket}")
    print(f"Key: {key}")
    print(f"Region: {region}")
    print("=" * 60)
    
    try:
        url = upload_html(bucket, key, region, html)
        print(f"\n✅ Success! Report uploaded.")
        print(f"\n📄 Report URL:")
        print(url)
        
        result = {
            "status": "success",
            "url": url,
            "bucket": bucket,
            "key": key,
            "region": region,
            "timestamp": timestamp,
            "total_logs": len(logs),
            "event_types": len(set(log.get("type") for log in logs)),
            "event_type_counts": {event_type: sum(1 for log in logs if log.get("type") == event_type) 
                                 for event_type in set(log.get("type") for log in logs)}
        }
        print(f"\n📊 Summary:")
        print(json.dumps(result, indent=2))
        
        # Output JSON result for easy parsing
        print("\n" + "=" * 60)
        print("RESULT (JSON):")
        print("=" * 60)
        print(json.dumps(result, indent=2))
        
        return url
    except Exception as e:
        print(f"\n❌ Error uploading to S3: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
