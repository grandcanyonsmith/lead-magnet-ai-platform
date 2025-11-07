#!/usr/bin/env python3
"""
Fix workflow steps that have tool_choice='required' but empty tools array.
"""

import boto3
from botocore.exceptions import ClientError
from decimal import Decimal

WORKFLOW_ID = "wf_0019a5cb319b8hhht5p5h6a"
TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"
REGION = "us-east-1"
WORKFLOWS_TABLE = "leadmagnet-workflows"


def convert_decimals(obj):
    """Convert Decimal types to native Python types."""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


def fix_workflow_steps(workflow_id: str, tenant_id: str):
    """Fix workflow steps with invalid tool_choice/tools combinations."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    
    try:
        # Get workflow
        print(f"Fetching workflow {workflow_id}...")
        response = workflows_table.get_item(Key={"workflow_id": workflow_id})
        
        if "Item" not in response:
            print(f"Error: Workflow {workflow_id} not found")
            return False
        
        workflow = convert_decimals(response["Item"])
        
        if workflow.get("tenant_id") != tenant_id:
            print(f"Error: Tenant ID mismatch")
            return False
        
        steps = workflow.get("steps", [])
        if not steps:
            print("No steps found in workflow")
            return False
        
        print(f"\nFound {len(steps)} steps. Checking for issues...")
        
        fixed_steps = []
        issues_found = False
        
        for idx, step in enumerate(steps):
            step_name = step.get("step_name", f"Step {idx + 1}")
            tool_choice = step.get("tool_choice", "auto")
            tools = step.get("tools", [])
            
            # Check if tool_choice is 'required' but tools is empty
            if tool_choice == "required" and (not tools or len(tools) == 0):
                print(f"\n⚠ Issue found in step {idx + 1} ({step_name}):")
                print(f"   tool_choice='required' but tools array is empty")
                print(f"   Fixing: Setting tool_choice to 'auto'")
                
                step["tool_choice"] = "auto"
                # Also ensure tools has a default if empty
                if not tools:
                    step["tools"] = ["web_search_preview"]
                    print(f"   Added default tool: web_search_preview")
                
                issues_found = True
            
            # Also check if tool_choice is 'none' but tools is not empty
            elif tool_choice == "none" and tools and len(tools) > 0:
                print(f"\n⚠ Issue found in step {idx + 1} ({step_name}):")
                print(f"   tool_choice='none' but tools array is not empty")
                print(f"   Fixing: Clearing tools array")
                
                step["tools"] = []
                issues_found = True
            
            fixed_steps.append(step)
        
        if not issues_found:
            print("\n✓ No issues found. All steps are valid.")
            return True
        
        # Update workflow with fixed steps
        print(f"\n{'=' * 60}")
        print("Updating workflow with fixed steps...")
        print(f"{'=' * 60}")
        
        workflows_table.update_item(
            Key={"workflow_id": workflow_id},
            UpdateExpression="SET #steps = :steps, updated_at = :updated_at",
            ExpressionAttributeNames={
                "#steps": "steps"
            },
            ExpressionAttributeValues={
                ":steps": fixed_steps,
                ":updated_at": workflow.get("updated_at", "")
            }
        )
        
        print(f"\n✓ Successfully fixed workflow!")
        print(f"Workflow ID: {workflow_id}")
        print(f"Fixed {len([s for s in fixed_steps if s.get('tool_choice') == 'required' and s.get('tools')])} steps")
        print("=" * 60)
        
        return True
        
    except ClientError as e:
        print(f"\n✗ Error accessing DynamoDB: {e}")
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    
    success = fix_workflow_steps(WORKFLOW_ID, TENANT_ID)
    sys.exit(0 if success else 1)

