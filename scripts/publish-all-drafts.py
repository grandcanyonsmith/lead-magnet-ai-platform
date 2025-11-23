#!/usr/bin/env python3
"""
Script to publish all draft workflows to active status
"""

import sys
import json
import requests
from typing import List, Dict

API_URL = "http://localhost:3001"
TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"

def get_all_workflows() -> List[Dict]:
    """Get all workflows from the API"""
    try:
        response = requests.get(f"{API_URL}/admin/workflows")
        response.raise_for_status()
        data = response.json()
        return data.get('workflows', [])
    except Exception as e:
        print(f"Error fetching workflows: {e}")
        sys.exit(1)

def update_workflow_status(workflow_id: str, status: str) -> bool:
    """Update a workflow's status"""
    try:
        response = requests.put(
            f"{API_URL}/admin/workflows/{workflow_id}",
            json={"status": status},
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error updating workflow {workflow_id}: {e}")
        return False

def main():
    print("Fetching all workflows...")
    workflows = get_all_workflows()
    
    draft_workflows = [w for w in workflows if w.get('status') == 'draft']
    
    print(f"\nFound {len(draft_workflows)} draft workflows out of {len(workflows)} total workflows")
    
    if len(draft_workflows) == 0:
        print("No draft workflows to publish.")
        return
    
    print(f"\nPublishing {len(draft_workflows)} draft workflows to active status...\n")
    
    success_count = 0
    failed_count = 0
    
    for i, workflow in enumerate(draft_workflows, 1):
        workflow_id = workflow['workflow_id']
        workflow_name = workflow.get('workflow_name', workflow_id)
        print(f"[{i}/{len(draft_workflows)}] Publishing: {workflow_name} ({workflow_id})...")
        
        if update_workflow_status(workflow_id, 'active'):
            print(f"  ✓ Published successfully")
            success_count += 1
        else:
            print(f"  ✗ Failed to publish")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Successfully published: {success_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(draft_workflows)}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()

