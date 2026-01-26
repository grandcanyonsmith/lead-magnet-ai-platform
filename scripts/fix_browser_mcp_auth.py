#!/usr/bin/env python3
"""
Script to add authorization field to browser MCP tools in workflows.

This script finds all workflows with browser MCP tools missing authorization
and adds a placeholder authorization field with instructions.

Usage:
    python scripts/fix_browser_mcp_auth.py [--workflow-id WORKFLOW_ID] [--dry-run]
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any

# Add parent directory to path to import backend modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'api', 'src'))

try:
    from utils.db import db
    from utils.env import env
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure you're running this from the project root and have installed dependencies.")
    sys.exit(1)


def find_browser_mcp_tools_without_auth(step: Dict[str, Any]) -> List[int]:
    """Find indices of browser MCP tools missing authorization in a step."""
    tools = step.get("tools", [])
    if not isinstance(tools, list):
        return []
    
    missing_auth_indices = []
    for idx, tool in enumerate(tools):
        if not isinstance(tool, dict):
            continue
        
        if tool.get("type") != "mcp":
            continue
        
        server_label = tool.get("server_label", "").lower()
        server_url = tool.get("server_url", "").lower()
        authorization = tool.get("authorization")
        
        # Check if it's a browser MCP tool
        is_browser = (
            server_label == "browser" or 
            "browser" in server_url
        )
        
        # Check if authorization is missing
        has_auth = authorization and isinstance(authorization, str) and authorization.strip()
        
        if is_browser and not has_auth:
            missing_auth_indices.append(idx)
    
    return missing_auth_indices


def fix_workflow_steps(workflow: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
    """Fix browser MCP tools in workflow steps by adding authorization placeholder."""
    steps = workflow.get("steps", [])
    if not isinstance(steps, list):
        return workflow
    
    updated_steps = []
    changes_made = False
    
    for step_idx, step in enumerate(steps):
        missing_auth_indices = find_browser_mcp_tools_without_auth(step)
        
        if not missing_auth_indices:
            updated_steps.append(step)
            continue
        
        # Make a copy of the step to modify
        updated_step = step.copy()
        updated_tools = list(step.get("tools", []))
        
        for tool_idx in missing_auth_indices:
            tool = updated_tools[tool_idx].copy()
            # Add a placeholder authorization with instructions
            tool["authorization"] = "Bearer <YOUR_TOKEN_HERE>"
            updated_tools[tool_idx] = tool
            
            step_name = step.get("step_name", f"Step {step_idx + 1}")
            print(f"  - Step '{step_name}' (index {step_idx}): Adding authorization placeholder to browser MCP tool at index {tool_idx}")
            changes_made = True
        
        updated_step["tools"] = updated_tools
        updated_steps.append(updated_step)
    
    if changes_made and not dry_run:
        workflow["steps"] = updated_steps
    
    return workflow, changes_made


def main():
    parser = argparse.ArgumentParser(description="Fix browser MCP tools missing authorization")
    parser.add_argument("--workflow-id", help="Specific workflow ID to fix (optional)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    args = parser.parse_args()
    
    workflows_table = os.environ.get("WORKFLOWS_TABLE")
    if not workflows_table:
        print("ERROR: WORKFLOWS_TABLE environment variable not set")
        sys.exit(1)
    
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made\n")
    
    try:
        if args.workflow_id:
            # Fix specific workflow
            print(f"Checking workflow: {args.workflow_id}")
            workflow = db.get(workflows_table, {"workflow_id": args.workflow_id})
            
            if not workflow:
                print(f"ERROR: Workflow {args.workflow_id} not found")
                sys.exit(1)
            
            print(f"Workflow: {workflow.get('workflow_name', 'Unnamed')}")
            updated_workflow, has_changes = fix_workflow_steps(workflow, args.dry_run)
            
            if has_changes:
                if not args.dry_run:
                    # Update workflow in database
                    from datetime import datetime
                    updated_workflow["updated_at"] = datetime.utcnow().isoformat()
                    db.update(workflows_table, {"workflow_id": args.workflow_id}, updated_workflow)
                    print(f"\n✅ Updated workflow {args.workflow_id}")
                else:
                    print(f"\n✅ Would update workflow {args.workflow_id}")
            else:
                print("No browser MCP tools missing authorization found")
        else:
            print("ERROR: Please specify --workflow-id or implement batch scanning")
            print("For now, use --workflow-id to fix a specific workflow")
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
