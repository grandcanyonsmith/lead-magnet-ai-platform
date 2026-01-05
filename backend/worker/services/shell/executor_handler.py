import os
import subprocess
import logging
import json
import time
from typing import Dict, Any, List, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Default configuration
MOUNT_POINT = os.environ.get("EFS_MOUNT_POINT", "/mnt/shell-executor")
# Lambda max timeout is 15 min (900s), but we default to 5 min per command
DEFAULT_TIMEOUT_MS = 300000 
DEFAULT_MAX_OUTPUT_LENGTH = 100000  # 100KB

def truncate(text: Optional[str], max_len: int) -> str:
    """Truncate text to max_len characters."""
    if text is None:
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len] + "\n... [truncated]"

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for executing shell commands in a persistent environment.
    
    Args:
        event: Dict containing:
            - commands: List[str] of commands to execute
            - workspace_id: Optional str, ID for the persistent session (folder name)
            - timeout_ms: Optional int, max execution time per command
            - max_output_length: Optional int, max characters for stdout/stderr
            - env: Optional Dict[str, str], environment variables to set
            
    Returns:
        Dict containing execution results
    """
    # Log event keys for debugging (avoid logging potentially sensitive command content globally)
    logger.info(f"Received shell execution request", extra={"event_keys": list(event.keys())})
    
    commands = event.get("commands", [])
    workspace_id = event.get("workspace_id", "default")
    timeout_ms = event.get("timeout_ms", DEFAULT_TIMEOUT_MS)
    max_output_length = event.get("max_output_length", DEFAULT_MAX_OUTPUT_LENGTH)
    env_vars = event.get("env", {})
    
    if not commands:
        return {
            "statusCode": 400,
            "error": "No commands provided"
        }
        
    # Setup workspace
    # Ensure workspace_id is safe (alphanumeric + dashes/underscores)
    safe_workspace_id = "".join(c for c in workspace_id if c.isalnum() or c in "-_")
    if not safe_workspace_id:
        safe_workspace_id = "default"
        
    workspace_path = os.path.join(MOUNT_POINT, "sessions", safe_workspace_id)
    
    try:
        os.makedirs(workspace_path, exist_ok=True)
    except Exception as e:
        logger.error(f"Failed to create workspace directory at {workspace_path}: {e}")
        return {
            "statusCode": 500,
            "error": f"Failed to create workspace: {str(e)}"
        }
        
    # Prepare environment
    # Inherit current env but allow overrides
    cmd_env = os.environ.copy()
    cmd_env.update(env_vars)
    cmd_env["HOME"] = workspace_path
    cmd_env["PWD"] = workspace_path
    
    results = []
    
    for cmd in commands:
        start_time = time.time()
        try:
            logger.info(f"Executing command in {workspace_path}: {cmd[:50]}...")
            
            # Use subprocess.run for simplicity and better control
            process = subprocess.run(
                cmd,
                shell=True,
                cwd=workspace_path,
                env=cmd_env,
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000.0
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            stdout = truncate(process.stdout, max_output_length)
            stderr = truncate(process.stderr, max_output_length)
            
            results.append({
                "command": cmd,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": process.returncode,
                "duration_ms": duration_ms,
                "status": "success" if process.returncode == 0 else "failed"
            })
            
        except subprocess.TimeoutExpired as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning(f"Command timed out: {cmd}")
            
            stdout = truncate(e.stdout.decode('utf-8') if e.stdout else "", max_output_length)
            stderr = truncate(e.stderr.decode('utf-8') if e.stderr else "", max_output_length)
            
            results.append({
                "command": cmd,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": 124, # Standard timeout exit code
                "duration_ms": duration_ms,
                "status": "timeout"
            })
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Command execution error: {e}")
            results.append({
                "command": cmd,
                "stdout": "",
                "stderr": str(e),
                "exit_code": 1,
                "duration_ms": duration_ms,
                "status": "error"
            })

    return {
        "statusCode": 200,
        "results": results,
        "workspace_path": workspace_path
    }
