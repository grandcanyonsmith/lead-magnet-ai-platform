#!/usr/bin/env python3
import sys
import json
import asyncio
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.shell.lambda_handler import StreamingShellHandler
from core.config import settings
from core import log_context

async def run_local():
    # Read payload from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"type": "error", "message": "No input data provided"}))
            return
        
        event = json.loads(input_data)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Invalid JSON input: {str(e)}"}))
        return

    # Setup context
    log_context.bind(
        service="worker-shell-local",
        job_id=event.get('job_id'),
        tenant_id=event.get('tenant_id')
    )

    handler = StreamingShellHandler()
    
    # Process stream and print to stdout
    async for chunk in handler.process_stream(event, None):
        sys.stdout.write(chunk)
        sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(run_local())
