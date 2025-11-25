#!/usr/bin/env python3
"""
Update workflow with missing ai_model, research_enabled, and html_enabled fields
based on workflow steps.
"""

import boto3
import sys
from datetime import datetime

# Configuration
REGION = "us-east-1"
WORKFLOWS_TABLE = "leadmagnet-workflows"


def update_workflow_fields(workflow_id: str):
    """Update workflow with missing fields based on steps."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    
    try:
        # Get workflow
        print(f"Fetching workflow {workflow_id}...")
        response = workflows_table.get_item(Key={"workflow_id": workflow_id})
        
        if "Item" not in response:
            print(f"Error: Workflow {workflow_id} not found")
            return False
        
        workflow = response["Item"]
        steps = workflow.get("steps", [])
        
        if not steps:
            print("Error: Workflow has no steps")
            return False
        
        # Determine fields from steps
        research_enabled = False
        html_enabled = False
        ai_model = None
        rewrite_model = None
        
        # Check for research (any step with web_search tool)
        for step in steps:
            tools = step.get("tools", [])
            if isinstance(tools, list):
                if "web_search" in tools:
                    research_enabled = True
                    # Use the model from the first research step
                    if not ai_model:
                        ai_model = step.get("model", "gpt-5")
        
        # Check for HTML generation (last step with tool_choice: "none" and no tools)
        if steps:
            last_step = steps[-1]
            if last_step.get("tool_choice") == "none" and not last_step.get("tools"):
                # Check if step description mentions HTML
                step_desc = last_step.get("step_description", "").lower()
                step_name = last_step.get("step_name", "").lower()
                instructions = last_step.get("instructions", "").lower()
                if "html" in step_desc or "html" in step_name or "html" in instructions:
                    html_enabled = True
                    rewrite_model = last_step.get("model", "gpt-5")
        
        # If no research found, use first step's model
        if not ai_model and steps:
            ai_model = steps[0].get("model", "gpt-5")
        
        # Default to gpt-5 if still no model
        if not ai_model:
            ai_model = "gpt-5"
        
        # Default rewrite_model if HTML enabled but not set
        if html_enabled and not rewrite_model:
            rewrite_model = "gpt-5"
        
        print(f"\nDetected fields:")
        print(f"  research_enabled: {research_enabled}")
        print(f"  html_enabled: {html_enabled}")
        print(f"  ai_model: {ai_model}")
        if rewrite_model:
            print(f"  rewrite_model: {rewrite_model}")
        
        # Update workflow
        update_expression_parts = []
        expression_attribute_values = {}
        
        if "ai_model" not in workflow or workflow.get("ai_model") != ai_model:
            update_expression_parts.append("ai_model = :ai_model")
            expression_attribute_values[":ai_model"] = ai_model
        
        if "research_enabled" not in workflow or workflow.get("research_enabled") != research_enabled:
            update_expression_parts.append("research_enabled = :research_enabled")
            expression_attribute_values[":research_enabled"] = research_enabled
        
        if "html_enabled" not in workflow or workflow.get("html_enabled") != html_enabled:
            update_expression_parts.append("html_enabled = :html_enabled")
            expression_attribute_values[":html_enabled"] = html_enabled
        
        if rewrite_model and ("rewrite_model" not in workflow or workflow.get("rewrite_model") != rewrite_model):
            update_expression_parts.append("rewrite_model = :rewrite_model")
            expression_attribute_values[":rewrite_model"] = rewrite_model
        
        if update_expression_parts:
            update_expression_parts.append("updated_at = :updated_at")
            expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat()
            
            update_expression = "SET " + ", ".join(update_expression_parts)
            
            print(f"\nUpdating workflow...")
            workflows_table.update_item(
                Key={"workflow_id": workflow_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_attribute_values
            )
            print(f"✓ Successfully updated workflow!")
        else:
            print(f"\n✓ All fields already set correctly")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 update-workflow-fields.py <workflow_id>")
        sys.exit(1)
    
    workflow_id = sys.argv[1]
    success = update_workflow_fields(workflow_id)
    sys.exit(0 if success else 1)

