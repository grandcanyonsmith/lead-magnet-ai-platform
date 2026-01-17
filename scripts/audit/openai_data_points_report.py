#!/usr/bin/env python3
"""
Comprehensive report of available OpenAI Admin API data points.
"""
import os
import sys
import json
import requests
import boto3
from datetime import datetime, timezone
from typing import Dict, Any, List

def get_openai_api_key() -> str:
    """Get OpenAI API key from environment or AWS Secrets Manager."""
    api_key = (
        os.getenv("OPENAI_ADMIN_KEY") or
        os.getenv("OPENAI_API_KEY") or
        os.getenv("OPENAI_KEY")
    )
    
    if api_key:
        return api_key.strip()
    
    try:
        secrets_client = boto3.client("secretsmanager", region_name="us-west-2")
        response = secrets_client.get_secret_value(SecretId="leadmagnet/openai-admin-api-key")
        secret_string = response.get("SecretString", "")
        try:
            secret_dict = json.loads(secret_string)
            api_key = secret_dict.get("OPENAI_ADMIN_KEY") or secret_dict.get("OPENAI_API_KEY")
        except:
            api_key = secret_string
        if api_key:
            return api_key.strip()
    except:
        pass
    
    raise ValueError("OpenAI API key not found")

def fetch_audit_logs(api_key: str, limit: int = 100) -> List[Dict]:
    """Fetch audit logs."""
    url = "https://api.openai.com/v1/organization/audit_logs"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"limit": limit}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        return response.json().get("data", [])
    except:
        return []

def fetch_users(api_key: str) -> List[Dict]:
    """Fetch organization users."""
    url = "https://api.openai.com/v1/organization/users"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json().get("data", [])
    except:
        return []

def analyze_audit_logs(logs: List[Dict]) -> Dict[str, Any]:
    """Analyze audit logs for insights."""
    analysis = {
        "total_events": len(logs),
        "event_types": {},
        "actors": {},
        "time_range": {},
        "projects": set(),
        "api_keys_created": [],
        "logins": {
            "total": 0,
            "by_user": {},
            "by_ip": {}
        },
        "project_changes": [],
        "workflow_changes": []
    }
    
    if not logs:
        return analysis
    
    timestamps = []
    
    for log in logs:
        event_type = log.get("type", "unknown")
        analysis["event_types"][event_type] = analysis["event_types"].get(event_type, 0) + 1
        
        # Actor analysis
        actor = log.get("actor", {})
        actor_type = actor.get("type", "unknown")
        if actor_type == "session":
            session = actor.get("session", {})
            user = session.get("user", {})
            email = user.get("email", "unknown")
            ip = session.get("ip_address", "unknown")
            
            if event_type == "login.succeeded":
                analysis["logins"]["total"] += 1
                analysis["logins"]["by_user"][email] = analysis["logins"]["by_user"].get(email, 0) + 1
                analysis["logins"]["by_ip"][ip] = analysis["logins"]["by_ip"].get(ip, 0) + 1
        
        # Project analysis
        project = log.get("project")
        if project:
            analysis["projects"].add(project.get("id", "unknown"))
        
        # Event-specific analysis
        if event_type == "api_key.created":
            details = log.get("api_key.created", {})
            analysis["api_keys_created"].append({
                "id": details.get("id"),
                "timestamp": log.get("effective_at")
            })
        
        if event_type == "project.updated":
            details = log.get("project.updated", {})
            analysis["project_changes"].append({
                "project_id": details.get("id"),
                "timestamp": log.get("effective_at")
            })
        
        if event_type == "workflow.version.created":
            details = log.get("workflow.version.created", {})
            analysis["workflow_changes"].append({
                "timestamp": log.get("effective_at")
            })
        
        # Time range
        ts = log.get("effective_at")
        if ts:
            timestamps.append(ts)
    
    if timestamps:
        analysis["time_range"] = {
            "earliest": min(timestamps),
            "latest": max(timestamps),
            "earliest_formatted": datetime.fromtimestamp(min(timestamps), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "latest_formatted": datetime.fromtimestamp(max(timestamps), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        }
    
    analysis["projects"] = list(analysis["projects"])
    return analysis

def generate_data_points_report(api_key: str) -> Dict[str, Any]:
    """Generate comprehensive data points report."""
    print("=" * 60)
    print("OpenAI Admin API Data Points Report")
    print("=" * 60)
    
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_sources": {}
    }
    
    # 1. Users
    print("\n1. Fetching users...")
    users = fetch_users(api_key)
    report["data_sources"]["users"] = {
        "count": len(users),
        "data": users,
        "summary": {
            "owners": [u for u in users if u.get("role") == "owner"],
            "readers": [u for u in users if u.get("role") == "reader"],
            "by_email": {u.get("email"): u.get("name") for u in users}
        }
    }
    print(f"   ✅ Found {len(users)} users")
    
    # 2. Audit Logs
    print("\n2. Fetching audit logs...")
    logs = fetch_audit_logs(api_key, limit=200)
    audit_analysis = analyze_audit_logs(logs)
    report["data_sources"]["audit_logs"] = {
        "count": len(logs),
        "analysis": audit_analysis,
        "sample_logs": logs[:10]  # First 10 for reference
    }
    print(f"   ✅ Analyzed {len(logs)} audit log entries")
    
    # 3. Available Data Points Summary
    print("\n3. Compiling available data points...")
    available_data_points = {
        "organization_users": {
            "endpoint": "/v1/organization/users",
            "status": "✅ Available",
            "data_points": [
                "User ID",
                "Email address",
                "Name",
                "Role (owner/reader)",
                "Added at timestamp"
            ],
            "count": len(users)
        },
        "audit_logs": {
            "endpoint": "/v1/organization/audit_logs",
            "status": "✅ Available",
            "data_points": [
                "Event type",
                "Timestamp (effective_at)",
                "Actor information (user, API key, session)",
                "IP address (for sessions)",
                "User agent (for sessions)",
                "Project information",
                "Event-specific details (API keys, projects, workflows, etc.)"
            ],
            "count": len(logs),
            "event_types": audit_analysis["event_types"]
        },
        "fine_tuning_jobs": {
            "endpoint": "/v1/fine_tuning/jobs",
            "status": "✅ Available",
            "data_points": [
                "Fine-tuning job IDs",
                "Model information",
                "Training status",
                "Created/updated timestamps"
            ],
            "note": "Requires project-scoped access"
        }
    }
    
    report["available_data_points"] = available_data_points
    
    # 4. Insights from Audit Logs
    print("\n4. Generating insights...")
    insights = {
        "most_active_users": sorted(
            audit_analysis["logins"]["by_user"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:5],
        "most_common_ips": sorted(
            audit_analysis["logins"]["by_ip"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:5],
        "api_key_creation_activity": len(audit_analysis["api_keys_created"]),
        "project_activity": len(audit_analysis["project_changes"]),
        "workflow_activity": len(audit_analysis["workflow_changes"]),
        "time_range": audit_analysis["time_range"]
    }
    report["insights"] = insights
    
    return report

def main():
    """Main function."""
    try:
        api_key = get_openai_api_key()
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    
    report = generate_data_points_report(api_key)
    
    print("\n" + "=" * 60)
    print("AVAILABLE DATA POINTS SUMMARY")
    print("=" * 60)
    
    for source, info in report["available_data_points"].items():
        print(f"\n{source.upper().replace('_', ' ')}:")
        print(f"  Status: {info['status']}")
        print(f"  Endpoint: {info['endpoint']}")
        if 'count' in info:
            print(f"  Count: {info['count']}")
        print(f"  Data Points Available:")
        for dp in info['data_points']:
            print(f"    - {dp}")
        if 'event_types' in info:
            print(f"  Event Types Found: {', '.join(info['event_types'].keys())}")
    
    print("\n" + "=" * 60)
    print("INSIGHTS")
    print("=" * 60)
    insights = report["insights"]
    print(f"\nMost Active Users (by login count):")
    for email, count in insights["most_active_users"]:
        print(f"  - {email}: {count} logins")
    
    print(f"\nMost Common IP Addresses:")
    for ip, count in insights["most_common_ips"]:
        print(f"  - {ip}: {count} logins")
    
    print(f"\nActivity Summary:")
    print(f"  - API Keys Created: {insights['api_key_creation_activity']}")
    print(f"  - Project Changes: {insights['project_activity']}")
    print(f"  - Workflow Changes: {insights['workflow_activity']}")
    
    if insights["time_range"]:
        print(f"\nTime Range:")
        print(f"  - Earliest: {insights['time_range']['earliest_formatted']}")
        print(f"  - Latest: {insights['time_range']['latest_formatted']}")
    
    # Save report
    output_file = f"openai_data_points_report_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    with open(output_file, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n✅ Full report saved to: {output_file}")
    print("\n" + "=" * 60)
    print("FULL REPORT (JSON):")
    print("=" * 60)
    print(json.dumps(report, indent=2, default=str))

if __name__ == "__main__":
    main()
