#!/usr/bin/env python3
"""
Recover and save a workflow that failed validation.
"""

import sys
import json
import boto3
from botocore.exceptions import ClientError
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    get_dynamodb_resource,
    get_table_name,
    get_aws_region,
    print_section,
    convert_decimals,
)

def validate_dependencies(steps):
    """Validate workflow step dependencies."""
    errors = []
    
    if not steps or len(steps) == 0:
        return True, []
    
    # Check each step's dependencies
    for i, step in enumerate(steps):
        depends_on = step.get('depends_on', [])
        if not isinstance(depends_on, list):
            depends_on = []
        
        for dep_index in depends_on:
            if not isinstance(dep_index, int):
                errors.append(f"Step {i} has invalid dependency type: {dep_index}")
            elif dep_index < 0 or dep_index >= len(steps):
                errors.append(f"Step {i} depends on invalid step index: {dep_index}")
            elif dep_index == i:
                errors.append(f"Step {i} depends on itself")
    
    # Check for circular dependencies
    visited = set()
    rec_stack = set()
    
    def has_cycle(node):
        if node in rec_stack:
            return True
        if node in visited:
            return False
        
        visited.add(node)
        rec_stack.add(node)
        
        depends_on = steps[node].get('depends_on', [])
        for dep in depends_on:
            if isinstance(dep, int) and has_cycle(dep):
                return True
        
        rec_stack.remove(node)
        return False
    
    for i in range(len(steps)):
        if i not in visited:
            if has_cycle(i):
                errors.append(f"Circular dependency detected involving step {i}")
    
    return len(errors) == 0, errors

def normalize_steps(steps):
    """Normalize workflow steps to fix common issues."""
    if not steps or len(steps) == 0:
        return steps
    
    normalized = []
    for index, step in enumerate(steps):
        # Ensure step_order is set
        step_order = step.get('step_order', index)
        
        # Clean up depends_on array
        depends_on = step.get('depends_on', [])
        if not isinstance(depends_on, list):
            depends_on = []
        
        # Filter out invalid dependencies
        cleaned_depends_on = []
        for dep_index in depends_on:
            if isinstance(dep_index, int) and 0 <= dep_index < len(steps) and dep_index != index:
                cleaned_depends_on.append(dep_index)
        
        normalized_step = {
            **step,
            'step_order': step_order,
            'depends_on': cleaned_depends_on,
        }
        
        # Ensure required fields have defaults
        if 'model' not in normalized_step:
            normalized_step['model'] = 'gpt-5'
        if 'tool_choice' not in normalized_step:
            normalized_step['tool_choice'] = 'auto'
        if 'tools' not in normalized_step:
            normalized_step['tools'] = []
        if 'instructions' not in normalized_step:
            normalized_step['instructions'] = ''
        if 'step_description' not in normalized_step:
            normalized_step['step_description'] = normalized_step.get('step_name', '')
        
        normalized.append(normalized_step)
    
    return normalized

def recover_workflow(workflow_id):
    """Recover a workflow from DynamoDB, fix validation issues, and save it."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("workflows"))
    
    print_section("Recovering Workflow")
    print(f"Workflow ID: {workflow_id}")
    print(f"Region: {get_aws_region()}")
    print()
    
    try:
        # Get the workflow
        response = table.get_item(Key={'workflow_id': workflow_id})
        
        if 'Item' not in response:
            print(f"❌ Workflow {workflow_id} not found!")
            return False
        
        workflow = convert_decimals(response['Item'])
        
        print(f"✅ Found workflow: {workflow.get('workflow_name', 'Unnamed')}")
        print(f"   Tenant ID: {workflow.get('tenant_id')}")
        print(f"   Status: {workflow.get('status', 'unknown')}")
        print(f"   Steps count: {len(workflow.get('steps', []))}")
        print()
        
        # Check and fix steps
        steps = workflow.get('steps', [])
        if not steps or len(steps) == 0:
            print("❌ Workflow has no steps! Cannot recover.")
            return False
        
        print("Checking step validation...")
        is_valid, errors = validate_dependencies(steps)
        
        if not is_valid:
            print(f"⚠️  Found {len(errors)} validation errors:")
            for error in errors:
                print(f"   - {error}")
            print()
            print("Attempting to fix...")
        else:
            print("✅ Dependencies are valid")
            print()
        
        # Normalize steps
        normalized_steps = normalize_steps(steps)
        
        # Validate again after normalization
        is_valid_after, errors_after = validate_dependencies(normalized_steps)
        
        if not is_valid_after:
            print(f"❌ Still has {len(errors_after)} errors after normalization:")
            for error in errors_after:
                print(f"   - {error}")
            print()
            print("Attempting to remove problematic dependencies...")
            
            # Remove all dependencies if circular
            for step in normalized_steps:
                step['depends_on'] = []
            
            is_valid_final, errors_final = validate_dependencies(normalized_steps)
            if not is_valid_final:
                print(f"❌ Still invalid after removing dependencies. Errors: {errors_final}")
                return False
            else:
                print("✅ Fixed by removing all dependencies")
        else:
            print("✅ Steps are valid after normalization")
        
        # Update workflow with normalized steps
        workflow['steps'] = normalized_steps
        workflow['updated_at'] = workflow.get('updated_at', workflow.get('created_at'))
        
        # Save the workflow
        print()
        print("Saving workflow...")
        
        # Convert back to DynamoDB format (handle sets, etc.)
        update_expression = "SET #steps = :steps, updated_at = :updated_at"
        expression_attribute_names = {"#steps": "steps"}
        expression_attribute_values = {
            ":steps": normalized_steps,
            ":updated_at": workflow['updated_at'],
        }
        
        table.update_item(
            Key={'workflow_id': workflow_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
        )
        
        print("✅ Workflow saved successfully!")
        print()
        print(f"Workflow: {workflow.get('workflow_name')}")
        print(f"Steps: {len(normalized_steps)}")
        print()
        print("Step summary:")
        for i, step in enumerate(normalized_steps):
            step_name = step.get('step_name', f'Step {i}')
            model = step.get('model', 'unknown')
            tools = step.get('tools', [])
            depends_on = step.get('depends_on', [])
            print(f"  {i}. {step_name} ({model})")
            if tools:
                print(f"     Tools: {', '.join(tools)}")
            if depends_on:
                print(f"     Depends on: {depends_on}")
        
        return True
        
    except ClientError as e:
        print(f"❌ AWS Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python recover-workflow.py <workflow_id>")
        print("Example: python recover-workflow.py wf_01KAHH0134PC5EB380Z36VW4QJ")
        sys.exit(1)
    
    workflow_id = sys.argv[1]
    success = recover_workflow(workflow_id)
    sys.exit(0 if success else 1)





