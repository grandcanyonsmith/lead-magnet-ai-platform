#!/usr/bin/env python3
"""
Test Step 5 (Automated Screenshot Capture) with shell executor fixes.
This creates a minimal test job that exercises Step 5 directly.
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'worker'))

def test_step5_shell_executor():
    """Test Step 5 with a simple shell command to verify fixes work."""
    
    # Set required environment variables
    defaults = {
        'ARTIFACTS_BUCKET': 'leadmagnet-artifacts-471112574622',
        'AWS_REGION': 'us-east-1',
        'WORKFLOWS_TABLE': 'leadmagnet-workflows',
        'FORMS_TABLE': 'leadmagnet-forms',
        'SUBMISSIONS_TABLE': 'leadmagnet-submissions',
        'JOBS_TABLE': 'leadmagnet-jobs',
        'ARTIFACTS_TABLE': 'leadmagnet-artifacts',
        'TEMPLATES_TABLE': 'leadmagnet-templates',
        'SHELL_EXECUTOR_RESULTS_BUCKET': 'leadmagnet-artifacts-shell-results-471112574622',
        'SHELL_EXECUTOR_TASK_DEFINITION_ARN': 'leadmagnet-shell-executor',
        'SHELL_EXECUTOR_CLUSTER_ARN': 'arn:aws:ecs:us-east-1:471112574622:cluster/leadmagnet-shell-executor',
        'SHELL_EXECUTOR_SECURITY_GROUP_ID': 'sg-01b137df0bd0d797c',
        'SHELL_EXECUTOR_SUBNET_IDS': 'subnet-0ecf31413d0908e66,subnet-04e3bee51e6d630ac',
    }
    
    for key, value in defaults.items():
        if not os.environ.get(key):
            os.environ[key] = value
    
    print("=" * 80)
    print("Testing Shell Executor Service with S3-based Job Requests")
    print("=" * 80)
    
    from services.shell_executor_service import ShellExecutorService
    
    service = ShellExecutorService()
    
    # Test with a simple command that should complete quickly
    test_commands = [
        "echo 'Shell executor test - $(date)'",
        "echo 'Testing presigned URL expiration fix'",
    ]
    
    print(f"\nTesting with {len(test_commands)} command(s)...")
    print(f"Commands: {test_commands}")
    print("\nThis will:")
    print("  1. Upload job request to S3")
    print("  2. Generate presigned GET URL")
    print("  3. Launch ECS task with GET URL")
    print("  4. Wait for result (with fail-fast checking)")
    print("  5. Verify result upload succeeds (with 30min presigned URL)")
    print("\n" + "=" * 80 + "\n")
    
    try:
        result = service.run_shell_job(
            commands=test_commands,
            timeout_ms=60000,  # 1 minute per command
            max_wait_seconds=300,  # 5 minutes max wait
        )
        
        print("\n" + "=" * 80)
        print("✅ Shell Executor Test PASSED!")
        print("=" * 80)
        print(f"Job ID: {result.get('job_id', 'unknown')}")
        print(f"Commands executed: {len(result.get('output', []))}")
        print(f"Results:")
        for i, output in enumerate(result.get('output', []), 1):
            print(f"\n  Command {i}:")
            print(f"    Exit code: {output.get('outcome', {}).get('exit_code', 'unknown')}")
            print(f"    Stdout: {output.get('stdout', '')[:200]}")
            if output.get('stderr'):
                print(f"    Stderr: {output.get('stderr', '')[:200]}")
        
        return 0
        
    except Exception as e:
        print("\n" + "=" * 80)
        print("❌ Shell Executor Test FAILED!")
        print("=" * 80)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(test_step5_shell_executor())
