#!/usr/bin/env python3
"""
Script to explore and fetch various data points from OpenAI Admin API.
"""
import os
import sys
import json
import requests
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

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
        secrets_client = boto3.client("secretsmanager", region_name="us-west-2")
        secret_name = "leadmagnet/openai-admin-api-key"
        
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
    
    raise ValueError("OpenAI API key not found")

def make_api_request(api_key: str, endpoint: str, method: str = "GET", params: Optional[Dict] = None) -> Dict[str, Any]:
    """Make API request to OpenAI."""
    base_url = "https://api.openai.com/v1"
    url = f"{base_url}{endpoint}"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=params, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return {"error": "Endpoint not found", "status_code": 404}
        elif e.response.status_code == 403:
            return {"error": "Permission denied", "status_code": 403}
        elif e.response.status_code == 401:
            return {"error": "Unauthorized", "status_code": 401}
        else:
            try:
                error_data = e.response.json()
                return {"error": error_data, "status_code": e.response.status_code}
            except:
                return {"error": str(e), "status_code": e.response.status_code}
    except Exception as e:
        return {"error": str(e), "status_code": None}

def explore_endpoints(api_key: str) -> Dict[str, Any]:
    """Explore various OpenAI API endpoints."""
    results = {}
    
    print("=" * 60)
    print("Exploring OpenAI Admin API Endpoints")
    print("=" * 60)
    
    # 1. Organization Info
    print("\n1. Fetching organization information...")
    org_info = make_api_request(api_key, "/organization")
    results["organization"] = org_info
    if "error" not in org_info:
        print(f"   ✅ Organization: {org_info.get('name', 'N/A')} (ID: {org_info.get('id', 'N/A')})")
    else:
        print(f"   ❌ {org_info.get('error', 'Unknown error')}")
    
    # 2. Users
    print("\n2. Fetching users...")
    users = make_api_request(api_key, "/organization/users")
    results["users"] = users
    if "error" not in users:
        user_count = len(users.get("data", []))
        print(f"   ✅ Found {user_count} users")
    else:
        print(f"   ❌ {users.get('error', 'Unknown error')}")
    
    # 3. Projects
    print("\n3. Fetching projects...")
    projects = make_api_request(api_key, "/projects")
    results["projects"] = projects
    if "error" not in projects:
        project_count = len(projects.get("data", []))
        print(f"   ✅ Found {project_count} projects")
    else:
        print(f"   ❌ {projects.get('error', 'Unknown error')}")
    
    # 4. API Keys
    print("\n4. Fetching API keys...")
    api_keys = make_api_request(api_key, "/organization/api_keys")
    results["api_keys"] = api_keys
    if "error" not in api_keys:
        key_count = len(api_keys.get("data", []))
        print(f"   ✅ Found {key_count} API keys")
    else:
        print(f"   ❌ {api_keys.get('error', 'Unknown error')}")
    
    # 5. Usage/Billing
    print("\n5. Fetching usage/billing information...")
    usage = make_api_request(api_key, "/usage")
    results["usage"] = usage
    if "error" not in usage:
        print(f"   ✅ Usage data retrieved")
    else:
        print(f"   ❌ {usage.get('error', 'Unknown error')}")
    
    # 6. Billing Info
    print("\n6. Fetching billing information...")
    billing = make_api_request(api_key, "/organization/billing")
    results["billing"] = billing
    if "error" not in billing:
        print(f"   ✅ Billing data retrieved")
    else:
        print(f"   ❌ {billing.get('error', 'Unknown error')}")
    
    # 7. Rate Limits
    print("\n7. Fetching rate limits...")
    rate_limits = make_api_request(api_key, "/organization/rate_limits")
    results["rate_limits"] = rate_limits
    if "error" not in rate_limits:
        print(f"   ✅ Rate limits retrieved")
    else:
        print(f"   ❌ {rate_limits.get('error', 'Unknown error')}")
    
    # 8. Models
    print("\n8. Fetching available models...")
    models = make_api_request(api_key, "/models")
    results["models"] = models
    if "error" not in models:
        model_count = len(models.get("data", []))
        print(f"   ✅ Found {model_count} models")
    else:
        print(f"   ❌ {models.get('error', 'Unknown error')}")
    
    # 9. Fine-tuning Jobs
    print("\n9. Fetching fine-tuning jobs...")
    fine_tuning = make_api_request(api_key, "/fine_tuning/jobs", params={"limit": 10})
    results["fine_tuning_jobs"] = fine_tuning
    if "error" not in fine_tuning:
        job_count = len(fine_tuning.get("data", []))
        print(f"   ✅ Found {job_count} fine-tuning jobs")
    else:
        print(f"   ❌ {fine_tuning.get('error', 'Unknown error')}")
    
    # 10. Files
    print("\n10. Fetching files...")
    files = make_api_request(api_key, "/files")
    results["files"] = files
    if "error" not in files:
        file_count = len(files.get("data", []))
        print(f"   ✅ Found {file_count} files")
    else:
        print(f"   ❌ {files.get('error', 'Unknown error')}")
    
    # 11. Assistants
    print("\n11. Fetching assistants...")
    assistants = make_api_request(api_key, "/assistants", params={"limit": 10})
    results["assistants"] = assistants
    if "error" not in assistants:
        assistant_count = len(assistants.get("data", []))
        print(f"   ✅ Found {assistant_count} assistants")
    else:
        print(f"   ❌ {assistants.get('error', 'Unknown error')}")
    
    # 12. Threads (if accessible)
    print("\n12. Fetching threads...")
    threads = make_api_request(api_key, "/threads", params={"limit": 10})
    results["threads"] = threads
    if "error" not in threads:
        thread_count = len(threads.get("data", []))
        print(f"   ✅ Found {thread_count} threads")
    else:
        print(f"   ❌ {threads.get('error', 'Unknown error')}")
    
    # 13. Check for dashboard/analytics endpoints
    print("\n13. Checking dashboard/analytics endpoints...")
    dashboard = make_api_request(api_key, "/organization/dashboard")
    results["dashboard"] = dashboard
    if "error" not in dashboard:
        print(f"   ✅ Dashboard data retrieved")
    else:
        print(f"   ❌ {dashboard.get('error', 'Unknown error')}")
    
    # 14. Check for activity/events endpoints
    print("\n14. Checking activity endpoints...")
    activity = make_api_request(api_key, "/organization/activity")
    results["activity"] = activity
    if "error" not in activity:
        print(f"   ✅ Activity data retrieved")
    else:
        print(f"   ❌ {activity.get('error', 'Unknown error')}")
    
    # 15. Check for settings/configuration
    print("\n15. Checking organization settings...")
    settings = make_api_request(api_key, "/organization/settings")
    results["settings"] = settings
    if "error" not in settings:
        print(f"   ✅ Settings retrieved")
    else:
        print(f"   ❌ {settings.get('error', 'Unknown error')}")
    
    return results

def format_results_summary(results: Dict[str, Any]) -> str:
    """Format results summary."""
    summary = []
    summary.append("=" * 60)
    summary.append("API EXPLORATION SUMMARY")
    summary.append("=" * 60)
    
    for endpoint, data in results.items():
        summary.append(f"\n{endpoint.upper().replace('_', ' ')}:")
        if "error" in data:
            summary.append(f"  Status: ❌ Error")
            if isinstance(data["error"], dict):
                summary.append(f"  Details: {json.dumps(data['error'], indent=4)}")
            else:
                summary.append(f"  Details: {data['error']}")
        else:
            summary.append(f"  Status: ✅ Success")
            if isinstance(data, dict):
                if "data" in data:
                    summary.append(f"  Items: {len(data['data'])}")
                if "object" in data:
                    summary.append(f"  Object Type: {data['object']}")
                # Show sample keys
                keys = [k for k in data.keys() if k not in ["data", "object"]]
                if keys:
                    summary.append(f"  Additional Fields: {', '.join(keys[:5])}")
            elif isinstance(data, list):
                summary.append(f"  Items: {len(data)}")
    
    return "\n".join(summary)

def main():
    """Main function."""
    try:
        api_key = get_openai_api_key()
        print(f"✅ API key found (length: {len(api_key)})")
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    
    results = explore_endpoints(api_key)
    
    print("\n" + "=" * 60)
    print("DETAILED RESULTS")
    print("=" * 60)
    print(json.dumps(results, indent=2, default=str))
    
    print("\n" + format_results_summary(results))
    
    # Save to file
    output_file = f"openai_admin_api_exploration_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n✅ Results saved to: {output_file}")

if __name__ == "__main__":
    main()
