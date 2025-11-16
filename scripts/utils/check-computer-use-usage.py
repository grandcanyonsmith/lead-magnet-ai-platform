#!/usr/bin/env python3
"""
Check how many workflows are using computer_use_preview tool.

This script scans the workflows table to identify:
1. Total workflows
2. Workflows using computer_use_preview tool
3. Breakdown by tenant
4. Details about computer_use_preview configuration
"""

import sys
import json
import argparse
from pathlib import Path
from collections import defaultdict
from botocore.exceptions import ClientError

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    convert_decimals,
    get_dynamodb_resource,
    get_table_name,
    get_aws_region,
    print_section,
)


def check_computer_use_usage():
    """Check how many workflows are using computer_use_preview tool."""
    dynamodb = get_dynamodb_resource()
    workflows_table = dynamodb.Table(get_table_name("workflows"))
    
    try:
        print_section("Computer Use Preview Usage Check")
        print(f"Table: {get_table_name('workflows')}")
        print(f"Region: {get_aws_region()}")
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
        
        print(f"Found {len(workflows)} total workflow(s)")
        print()
        
        # Filter for active workflows (not deleted)
        active_workflows = [w for w in workflows if not w.get('deleted_at')]
        print(f"Active workflows: {len(active_workflows)}")
        print()
        
        # Analyze computer_use_preview usage
        computer_use_workflows = []
        tenant_stats = defaultdict(lambda: {'total': 0, 'computer_use': 0, 'steps': 0})
        
        for workflow in active_workflows:
            workflow = convert_decimals(workflow)
            tenant_id = workflow.get('tenant_id', 'unknown')
            workflow_id = workflow.get('workflow_id', 'unknown')
            workflow_name = workflow.get('workflow_name', 'Unnamed')
            steps = workflow.get('steps', [])
            
            tenant_stats[tenant_id]['total'] += 1
            tenant_stats[tenant_id]['steps'] += len(steps) if steps else 0
            
            # Check if any step uses computer_use_preview
            has_computer_use = False
            computer_use_steps = []
            
            if steps:
                for idx, step in enumerate(steps):
                    tools = step.get('tools', [])
                    for tool in tools:
                        tool_type = tool.get('type') if isinstance(tool, dict) else tool
                        if tool_type == 'computer_use_preview':
                            has_computer_use = True
                            computer_use_steps.append({
                                'step_index': idx,
                                'step_name': step.get('step_name', f'Step {idx}'),
                                'model': step.get('model', 'unknown'),
                                'tool_config': tool if isinstance(tool, dict) else {'type': tool_type}
                            })
                            break
            
            if has_computer_use:
                tenant_stats[tenant_id]['computer_use'] += 1
                computer_use_workflows.append({
                    'workflow_id': workflow_id,
                    'workflow_name': workflow_name,
                    'tenant_id': tenant_id,
                    'steps_count': len(steps),
                    'computer_use_steps': computer_use_steps
                })
        
        # Print summary
        print_section("SUMMARY")
        print(f"  - Total Active Workflows: {len(active_workflows)}")
        print(f"  - Using Computer Use Preview: {len(computer_use_workflows)} ({len(computer_use_workflows)/len(active_workflows)*100:.1f}%)")
        print()
        
        # Print per-tenant breakdown
        if tenant_stats:
            print_section("PER-TENANT BREAKDOWN")
            for tenant_id, stats in sorted(tenant_stats.items()):
                computer_use_pct = (stats['computer_use'] / stats['total'] * 100) if stats['total'] > 0 else 0
                print(f"  Tenant: {tenant_id[:8]}...")
                print(f"    Total: {stats['total']}")
                print(f"    Computer Use: {stats['computer_use']} ({computer_use_pct:.1f}%)")
                print(f"    Total Steps: {stats['steps']}")
                print()
        
        # Print computer_use workflow details
        if computer_use_workflows:
            print_section(f"COMPUTER USE WORKFLOWS ({len(computer_use_workflows)})")
            for wf in computer_use_workflows[:20]:  # Show first 20
                print(f"  Workflow: {wf['workflow_name']} ({wf['workflow_id']})")
                print(f"    Tenant: {wf['tenant_id'][:8]}...")
                print(f"    Steps: {wf['steps_count']}")
                print(f"    Computer Use Steps:")
                for step_info in wf['computer_use_steps']:
                    config = step_info['tool_config']
                    print(f"      - Step {step_info['step_index']}: {step_info['step_name']}")
                    print(f"        Model: {step_info['model']}")
                    print(f"        Config: width={config.get('display_width', 'default')}, height={config.get('display_height', 'default')}, env={config.get('environment', 'default')}")
                print()
            
            if len(computer_use_workflows) > 20:
                print(f"  ... and {len(computer_use_workflows) - 20} more computer use workflows")
                print()
        else:
            print_section("COMPUTER USE WORKFLOWS")
            print("✅ No workflows found using computer_use_preview tool.")
            print()
        
        # Return results for JSON output
        return {
            'total': len(active_workflows),
            'computer_use': len(computer_use_workflows),
            'computer_use_workflows': computer_use_workflows,
            'tenant_stats': {
                tenant_id: {
                    'total': stats['total'],
                    'computer_use': stats['computer_use'],
                    'steps': stats['steps']
                }
                for tenant_id, stats in tenant_stats.items()
            }
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


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Check how many workflows are using the computer_use_preview tool"
    )
    parser.add_argument(
        '--output',
        help="Output file for JSON report (default: computer-use-usage-report.json)",
        default="computer-use-usage-report.json",
    )
    
    args = parser.parse_args()
    
    result = check_computer_use_usage()
    
    if result:
        # Write JSON report
        output_file = args.output
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2, default=str)
        print(f"✅ Report saved to: {output_file}")


