#!/usr/bin/env python3
"""
Run the worker manually for a specific job to see logs in real-time.
This helps debug image extraction issues.
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/run-worker-manually.py <job_id>")
        print("\nExample:")
        print("  python3 scripts/run-worker-manually.py job_01K9Z8156YFX510ASVG36P1N09")
        print("\nThis will run the worker for the specified job and show all logs in real-time.")
        return 1
    
    job_id = sys.argv[1]
    
    # Set environment variables
    os.environ['JOB_ID'] = job_id
    
    # Set required environment variables if not set
    defaults = {
        'ARTIFACTS_BUCKET': 'leadmagnet-artifacts-471112574622',
        'AWS_REGION': 'us-east-1',
        'WORKFLOWS_TABLE': 'leadmagnet-workflows',
        'FORMS_TABLE': 'leadmagnet-forms',
        'SUBMISSIONS_TABLE': 'leadmagnet-submissions',
        'JOBS_TABLE': 'leadmagnet-jobs',
        'ARTIFACTS_TABLE': 'leadmagnet-artifacts',
        'TEMPLATES_TABLE': 'leadmagnet-templates',
    }
    
    for key, value in defaults.items():
        if not os.environ.get(key):
            os.environ[key] = value
            print(f"⚠️  Set {key}={value} (default)")
    
    print("=" * 80)
    print(f"Running Worker Manually for Job: {job_id}")
    print("=" * 80)
    print(f"ARTIFACTS_BUCKET: {os.environ.get('ARTIFACTS_BUCKET')}")
    print(f"AWS_REGION: {os.environ.get('AWS_REGION')}")
    print("=" * 80)
    print("\nWatch for these log messages:")
    print("  ⚡ MAKING OPENAI RESPONSES API CALL NOW ⚡")
    print("  ✅ RECEIVED RESPONSES API RESPONSE ✅")
    print("  Response output items breakdown")
    print("  Found ImageGenerationCall class")
    print("  Processing base64 image data")
    print("  Successfully converted base64 image")
    print("\n" + "=" * 80 + "\n")
    
    # Import and run worker
    try:
        from worker import main as worker_main
        worker_main()
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else 0
    except Exception as e:
        print(f"\n❌ Error running worker: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())

