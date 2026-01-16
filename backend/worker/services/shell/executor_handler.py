import os
import subprocess
import logging
import time
import errno
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Default configuration
MOUNT_POINT = os.environ.get("EFS_MOUNT_POINT", "/mnt/shell-executor")
# Fallback if EFS is not writable (e.g., permissions/mount issues)
FALLBACK_ROOT = os.environ.get("SHELL_EXECUTOR_FALLBACK_ROOT", "/tmp/leadmagnet-shell-executor")
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

def _prepare_workspace_path(workspace_id: str) -> Tuple[str, bool]:
    """
    Create a workspace directory, falling back to /tmp if EFS is not writable.
    Returns (workspace_path, used_fallback).
    """
    safe_workspace_id = "".join(c for c in workspace_id if c.isalnum() or c in "-_") or "default"
    primary_base = os.path.join(MOUNT_POINT, "sessions")
    primary_path = os.path.join(primary_base, safe_workspace_id)

    try:
        os.makedirs(primary_path, exist_ok=True)
        return primary_path, False
    except OSError as e:
        if e.errno not in (errno.EACCES, errno.EPERM, errno.EROFS):
            raise
        logger.error(
            "EFS workspace not writable; falling back to /tmp",
            extra={"mount_point": MOUNT_POINT, "error": str(e)},
        )

    fallback_base = os.path.join(FALLBACK_ROOT, "sessions")
    fallback_path = os.path.join(fallback_base, safe_workspace_id)
    os.makedirs(fallback_path, exist_ok=True)
    return fallback_path, True

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
    logger.info("Received shell execution request", extra={"event_keys": list(event.keys())})
    
    commands = event.get("commands", [])
    workspace_id = event.get("workspace_id", "default")
    timeout_ms = event.get("timeout_ms", DEFAULT_TIMEOUT_MS)
    max_output_length = event.get("max_output_length", DEFAULT_MAX_OUTPUT_LENGTH)
    try:
        timeout_ms = int(timeout_ms)
    except Exception:
        timeout_ms = DEFAULT_TIMEOUT_MS
    if timeout_ms <= 0:
        timeout_ms = DEFAULT_TIMEOUT_MS
    try:
        max_output_length = int(max_output_length)
    except Exception:
        max_output_length = DEFAULT_MAX_OUTPUT_LENGTH
    if max_output_length <= 0:
        max_output_length = DEFAULT_MAX_OUTPUT_LENGTH
    env_vars = event.get("env", {})
    
    if not commands:
        return {
            "statusCode": 400,
            "error": "No commands provided"
        }
        
    # Setup workspace (EFS preferred; /tmp fallback if EFS not writable)
    try:
        workspace_path, used_fallback = _prepare_workspace_path(workspace_id)
    except Exception as e:
        logger.error(f"Failed to create workspace directory: {e}")
        return {
            "statusCode": 500,
            "error": f"Failed to create workspace: {str(e)}"
        }
    if used_fallback:
        logger.warning("Shell executor using /tmp fallback workspace", extra={"workspace_path": workspace_path})
        
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
