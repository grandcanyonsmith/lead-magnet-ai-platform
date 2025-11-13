#!/usr/bin/env python3
"""
Check how many workflows are using the legacy format (no steps array).

This script scans the workflows table to identify:
1. Total workflows
2. Workflows using legacy format (no steps or empty steps)
3. Workflows using steps format
4. Breakdown by tenant
"""

import boto3
import json
from decimal import Decimal
from collections import defaultdict
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


def check_legacy_workflow_usage():
    """Check how many workflows are using legacy format."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    
    try:
        print("=" * 80)
        print("Legacy Workflow Usage Check")
        print("=" * 80)
        print(f"Table: {WORKFLOWS_TABLE}")
        print(f"Region: {REGION}")
        print()
        
        # Scan all workflows (or use pagination for large tables)
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
        
        print(f"Found {len(workflows)} total workflow(s)")
        print()
        
        # Filter out soft-deleted workflows
        active_workflows = [w for w in workflows if not w.get('deleted_at')]
        deleted_workflows = len(workflows) - len(active_workflows)
        
        print(f"Active workflows: {len(active_workflows)}")
        if deleted_workflows > 0:
            print(f"Deleted workflows: {deleted_workflows}")
        print()
        
        # Categorize workflows
        legacy_workflows = []
        steps_workflows = []
        tenant_stats = defaultdict(lambda: {'total': 0, 'legacy': 0, 'steps': 0})
        
        for workflow in active_workflows:
            workflow = convert_decimals(workflow)
            tenant_id = workflow.get('tenant_id', 'unknown')
            workflow_id = workflow.get('workflow_id', 'unknown')
            workflow_name = workflow.get('workflow_name', 'Unnamed')
            
            steps = workflow.get('steps', [])
            has_steps = steps and len(steps) > 0
            
            tenant_stats[tenant_id]['total'] += 1
            
            if has_steps:
                steps_workflows.append({
                    'workflow_id': workflow_id,
                    'workflow_name': workflow_name,
                    'tenant_id': tenant_id,
                    'steps_count': len(steps),
                    'status': workflow.get('status', 'unknown')
                })
                tenant_stats[tenant_id]['steps'] += 1
            else:
                # Legacy workflow
                legacy_workflows.append({
                    'workflow_id': workflow_id,
                    'workflow_name': workflow_name,
                    'tenant_id': tenant_id,
                    'research_enabled': workflow.get('research_enabled'),
                    'html_enabled': workflow.get('html_enabled'),
                    'has_ai_instructions': bool(workflow.get('ai_instructions')),
                    'status': workflow.get('status', 'unknown'),
                    'created_at': workflow.get('created_at', 'unknown')
                })
                tenant_stats[tenant_id]['legacy'] += 1
        
        # Print summary
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total active workflows: {len(active_workflows)}")
        print(f"  - Using Steps Format: {len(steps_workflows)} ({len(steps_workflows)/len(active_workflows)*100:.1f}%)")
        print(f"  - Using Legacy Format: {len(legacy_workflows)} ({len(legacy_workflows)/len(active_workflows)*100:.1f}%)")
        print()
        
        # Print tenant breakdown
        if len(tenant_stats) > 0:
            print("=" * 80)
            print("BREAKDOWN BY TENANT")
            print("=" * 80)
            for tenant_id, stats in sorted(tenant_stats.items(), key=lambda x: x[1]['total'], reverse=True):
                legacy_pct = (stats['legacy'] / stats['total'] * 100) if stats['total'] > 0 else 0
                print(f"Tenant: {tenant_id[:8]}...")
                print(f"  Total: {stats['total']}")
                print(f"  Steps Format: {stats['steps']}")
                print(f"  Legacy Format: {stats['legacy']} ({legacy_pct:.1f}%)")
                print()
        
        # Print legacy workflow details
        if legacy_workflows:
            print("=" * 80)
            print(f"LEGACY WORKFLOWS ({len(legacy_workflows)})")
            print("=" * 80)
            for wf in legacy_workflows[:20]:  # Show first 20
                print(f"  - {wf['workflow_name']} ({wf['workflow_id']})")
                print(f"    Tenant: {wf['tenant_id'][:8]}...")
                print(f"    Status: {wf['status']}")
                print(f"    Research: {wf['research_enabled']}, HTML: {wf['html_enabled']}, Instructions: {wf['has_ai_instructions']}")
                print(f"    Created: {wf['created_at']}")
                print()
            
            if len(legacy_workflows) > 20:
                print(f"  ... and {len(legacy_workflows) - 20} more legacy workflows")
                print()
        else:
            print("=" * 80)
            print("LEGACY WORKFLOWS")
            print("=" * 80)
            print("✅ No legacy workflows found! All workflows are using the Steps Format.")
            print()
        
        # Recommendations
        print("=" * 80)
        print("RECOMMENDATIONS")
        print("=" * 80)
        if len(legacy_workflows) > 0:
            print(f"⚠️  Found {len(legacy_workflows)} legacy workflow(s) that should be migrated.")
            print("   These workflows will trigger deprecation warnings when:")
            print("   - Created or updated via API")
            print("   - Processed by the worker")
            print()
            print("   To migrate a workflow, update it via the API with steps format.")
            print("   See docs/WORKFLOW_FORMATS.md for migration guide.")
        else:
            print("✅ All workflows are using the Steps Format!")
            print("   The LegacyWorkflowProcessor is not currently being used.")
            print("   You can safely remove it in a future version.")
        print()
        
        return {
            'total': len(active_workflows),
            'legacy': len(legacy_workflows),
            'steps': len(steps_workflows),
            'legacy_workflows': legacy_workflows,
            'tenant_stats': dict(tenant_stats)
        }
        
    except ClientError as e:
        print(f"❌ Error accessing DynamoDB: {e}")
        print(f"   Error Code: {e.response['Error']['Code']}")
        print(f"   Error Message: {e.response['Error']['Message']}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    result = check_legacy_workflow_usage()
    if result:
        # Save results to JSON file
        output_file = "legacy-workflow-usage-report.json"
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2, default=str)
        print(f"📄 Detailed report saved to: {output_file}")

