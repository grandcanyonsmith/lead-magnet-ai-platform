#!/usr/bin/env python3
"""
Migrate all legacy workflows to the steps format.

This script:
1. Finds all workflows using legacy format (no steps array)
2. Migrates them to steps format using the same logic as the API
3. Updates them in the database
"""

import boto3
import json
from decimal import Decimal
from datetime import datetime
from botocore.exceptions import ClientError

# Configuration
REGION = "us-east-1"
WORKFLOWS_TABLE = "leadmagnet-workflows"


def convert_decimals(obj):
    """Convert Decimal types to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


def migrate_legacy_workflow_to_steps(workflow):
    """
    Migrate a legacy workflow to steps format.
    Uses the same logic as backend/api/src/utils/workflowMigration.ts
    """
    steps = []
    
    research_enabled = workflow.get('research_enabled', True)
    html_enabled = workflow.get('html_enabled', True)
    ai_instructions = workflow.get('ai_instructions', '')
    ai_model = workflow.get('ai_model', 'gpt-5')
    rewrite_model = workflow.get('rewrite_model', 'gpt-5')
    
    # Step 1: Research step (if research_enabled and ai_instructions exist)
    if research_enabled and ai_instructions:
        steps.append({
            'step_name': 'Deep Research',
            'step_description': 'Generate comprehensive research report',
            'step_order': 0,
            'model': ai_model,
            'instructions': ai_instructions,
            'tools': ['web_search'],
            'tool_choice': 'auto',
            'depends_on': []
        })
    
    # Step 2: HTML generation step (if html_enabled)
    if html_enabled:
        steps.append({
            'step_name': 'HTML Rewrite',
            'step_description': 'Rewrite content into styled HTML matching template',
            'step_order': len(steps),
            'model': rewrite_model,
            'instructions': 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
            'tools': [],
            'tool_choice': 'none',
            'depends_on': list(range(len(steps))) if len(steps) > 0 else []
        })
    
    # If no steps were created but ai_instructions exists, create at least one step
    if not steps and ai_instructions:
        steps.append({
            'step_name': 'AI Generation',
            'step_description': 'Generate content based on instructions',
            'step_order': 0,
            'model': ai_model,
            'instructions': ai_instructions,
            'tools': [],
            'tool_choice': 'auto',
            'depends_on': []
        })
    
    return steps


def migrate_all_legacy_workflows(dry_run=True):
    """
    Migrate all legacy workflows to steps format.
    
    Args:
        dry_run: If True, only show what would be migrated without making changes
    """
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    
    try:
        print("=" * 80)
        print("Legacy Workflow Migration")
        print("=" * 80)
        print(f"Table: {WORKFLOWS_TABLE}")
        print(f"Region: {REGION}")
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE MIGRATION'}")
        print()
        
        # Scan all workflows
        print("Scanning workflows table...")
        workflows = []
        last_evaluated_key = None
        
        while True:
            scan_kwargs = {}
            if last_evaluated_key:
                scan_kwargs['ExclusiveStartKey'] = last_evaluated_key
            
            response = workflows_table.scan(**scan_kwargs)
            workflows.extend(response.get('Items', []))
            
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break
        
        # Filter for active legacy workflows
        legacy_workflows = []
        for workflow in workflows:
            workflow = convert_decimals(workflow)
            # Skip deleted workflows
            if workflow.get('deleted_at'):
                continue
            
            steps = workflow.get('steps', [])
            has_steps = steps and len(steps) > 0
            
            if not has_steps:
                legacy_workflows.append(workflow)
        
        print(f"Found {len(legacy_workflows)} legacy workflow(s) to migrate")
        print()
        
        if len(legacy_workflows) == 0:
            print("✅ No legacy workflows found. All workflows are already using Steps Format!")
            return
        
        # Migrate each workflow
        migrated_count = 0
        failed_count = 0
        
        for workflow in legacy_workflows:
            workflow_id = workflow.get('workflow_id')
            workflow_name = workflow.get('workflow_name', 'Unnamed')
            tenant_id = workflow.get('tenant_id', 'unknown')
            
            print(f"\n{'=' * 80}")
            print(f"Workflow: {workflow_name} ({workflow_id})")
            print(f"Tenant: {tenant_id[:8]}...")
            print(f"{'=' * 80}")
            
            # Generate steps
            steps = migrate_legacy_workflow_to_steps(workflow)
            
            if not steps:
                print("⚠️  Warning: Could not generate steps for this workflow")
                print(f"   Research enabled: {workflow.get('research_enabled')}")
                print(f"   HTML enabled: {workflow.get('html_enabled')}")
                print(f"   Has AI instructions: {bool(workflow.get('ai_instructions'))}")
                failed_count += 1
                continue
            
            print(f"✅ Generated {len(steps)} step(s):")
            for i, step in enumerate(steps):
                print(f"   {i+1}. {step['step_name']} (order: {step['step_order']}, model: {step['model']})")
            
            if dry_run:
                print("   [DRY RUN] Would update workflow with these steps")
            else:
                # Update workflow in database
                try:
                    update_expression_parts = [
                        "SET steps = :steps",
                        "updated_at = :updated_at"
                    ]
                    expression_attribute_values = {
                        ":steps": steps,
                        ":updated_at": datetime.utcnow().isoformat()
                    }
                    
                    update_expression = ", ".join(update_expression_parts)
                    
                    workflows_table.update_item(
                        Key={"workflow_id": workflow_id},
                        UpdateExpression=update_expression,
                        ExpressionAttributeValues=expression_attribute_values
                    )
                    
                    print(f"✅ Successfully migrated workflow {workflow_id}")
                    migrated_count += 1
                except Exception as e:
                    print(f"❌ Failed to migrate workflow {workflow_id}: {e}")
                    failed_count += 1
        
        # Summary
        print("\n" + "=" * 80)
        print("MIGRATION SUMMARY")
        print("=" * 80)
        if dry_run:
            print(f"Would migrate: {len(legacy_workflows)} workflow(s)")
            print(f"Would fail: {failed_count} workflow(s)")
            print("\n⚠️  This was a DRY RUN. No changes were made.")
            print("   Run with --live to perform the actual migration.")
        else:
            print(f"Successfully migrated: {migrated_count} workflow(s)")
            print(f"Failed: {failed_count} workflow(s)")
            print(f"Total processed: {len(legacy_workflows)} workflow(s)")
        
        print()
        
    except ClientError as e:
        print(f"❌ Error accessing DynamoDB: {e}")
        print(f"   Error Code: {e.response['Error']['Code']}")
        print(f"   Error Message: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import sys
    
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        dry_run = False
        print("⚠️  WARNING: This will modify workflows in the database!")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != "yes":
            print("Migration cancelled.")
            sys.exit(0)
    
    migrate_all_legacy_workflows(dry_run=dry_run)

