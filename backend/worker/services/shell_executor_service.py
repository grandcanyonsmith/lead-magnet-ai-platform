"""
Shell Executor Service (Worker-side orchestrator)

Runs model-requested shell commands via the Shell Executor Lambda function.
Replaces the legacy ECS Fargate implementation with synchronous Lambda invocations.
"""

import json
import logging
import os
import time
import uuid
import subprocess
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import boto3
from botocore.exceptions import ClientError

from core.config import settings

logger = logging.getLogger(__name__)

CONTRACT_VERSION = "2025-12-29"


class ShellExecutorService:
    """Executes commands via Shell Executor Lambda."""

    def __init__(
        self,
        lambda_client: Optional[Any] = None,
        # Legacy params (unused but kept for DI compatibility if needed)
        ecs_client: Optional[Any] = None,
        s3_client: Optional[Any] = None
    ):
        """
        Initialize the shell executor service.
        
        Args:
            lambda_client: Optional boto3 Lambda client
        """
        self._lambda = lambda_client or boto3.client("lambda", region_name=settings.AWS_REGION)
        # We now look for SHELL_EXECUTOR_FUNCTION_NAME instead of cluster ARNs
        self._function_name = os.environ.get("SHELL_EXECUTOR_FUNCTION_NAME")

    def run_shell_job(
        self,
        commands: List[str],
        timeout_ms: Optional[int] = None,
        max_output_length: Optional[int] = None,
        workspace_id: Optional[str] = None,
        reset_workspace: Optional[bool] = None,
        max_wait_seconds: int = 600, # Unused in sync lambda mode
    ) -> Dict[str, Any]:
        """
        Run a shell job synchronously.
        """

        if not commands or not isinstance(commands, list):
            raise ValueError("commands must be a non-empty list of strings")

        # ------------------------------------------------------------------
        # Local dev mode: execute commands on the local machine.
        # ------------------------------------------------------------------
        if (os.environ.get("IS_LOCAL") or "").strip().lower() == "true":
            return self._run_shell_job_local(
                commands=commands,
                timeout_ms=timeout_ms,
                max_output_length=max_output_length,
                workspace_id=workspace_id,
                reset_workspace=reset_workspace,
            )

        if not self._function_name:
            # Fallback check for settings if env var not directly set (though usually settings loads env vars)
            # Or raise error.
            raise RuntimeError("SHELL_EXECUTOR_FUNCTION_NAME is not set")

        job_id = uuid.uuid4().hex
        
        payload = {
            "commands": commands,
            "workspace_id": workspace_id,
            "timeout_ms": timeout_ms,
            "max_output_length": max_output_length,
            "env": {
                "JOB_ID": job_id
            }
        }
        
        logger.info("[ShellExecutorService] Invoking Lambda executor", extra={
            "job_id": job_id,
            "function_name": self._function_name,
            "commands_count": len(commands),
            "workspace_id": workspace_id
        })
        
        start_time = time.time()
        
        try:
            resp = self._lambda.invoke(
                FunctionName=self._function_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(payload)
            )
        except Exception as e:
            logger.error(f"[ShellExecutorService] Failed to invoke lambda: {e}", exc_info=True)
            raise

        if 'Payload' not in resp:
            raise RuntimeError("Empty response from Shell Executor Lambda")
            
        try:
            response_payload = resp['Payload'].read()
            response_data = json.loads(response_payload)
        except Exception as e:
             logger.error(f"[ShellExecutorService] Failed to parse lambda response: {e}")
             raise RuntimeError(f"Invalid response from shell executor: {e}")

        # Check for function error (handled exception in Lambda runtime)
        if 'FunctionError' in resp:
            error_msg = response_data.get('errorMessage', 'Unknown Lambda error')
            logger.error(f"[ShellExecutorService] Lambda execution failed: {error_msg}")
            raise RuntimeError(f"Shell Executor Lambda failed: {error_msg}")

        # Check for handler returned error (statusCode != 200)
        if response_data.get('statusCode') != 200:
             error_msg = response_data.get('error') or response_data.get('body') or 'Unknown error'
             logger.error(f"[ShellExecutorService] Execution failed: {error_msg}")
             raise RuntimeError(f"Shell Executor failed: {error_msg}")
             
        # Map to legacy contract format
        output_items = []
        for res in response_data.get('results', []):
            outcome = {}
            if res.get('status') == 'timeout':
                outcome = {'type': 'timeout'}
            else:
                # Local runner sets exit_code, make sure we match type
                outcome = {'type': 'exit', 'exit_code': int(res.get('exit_code', 0))}
            
            output_items.append({
                "stdout": res.get("stdout", ""),
                "stderr": res.get("stderr", ""),
                "outcome": outcome
            })
            
        duration_ms = int((time.time() - start_time) * 1000)
            
        return {
            "version": CONTRACT_VERSION,
            "job_id": job_id,
            "commands": commands,
            "output": output_items,
            "meta": {
                "runner": "shell-executor-lambda",
                "duration_ms": duration_ms
            }
        }

    def _run_shell_job_local(
        self,
        *,
        commands: List[str],
        timeout_ms: Optional[int],
        max_output_length: Optional[int],
        workspace_id: Optional[str],
        reset_workspace: Optional[bool],
    ) -> Dict[str, Any]:
        """
        Local fallback for running shell commands without ECS/Lambda.
        """
        started_at = time.time()
        job_id = uuid.uuid4().hex

        root = Path(os.environ.get("SHELL_EXECUTOR_LOCAL_ROOT") or "/tmp/leadmagnet-shell-executor")
        session_dir = root / "sessions" / (str(workspace_id).strip() if workspace_id and str(workspace_id).strip() else job_id)

        if reset_workspace:
            try:
                shutil.rmtree(session_dir, ignore_errors=True)
            except Exception:
                pass

        session_dir.mkdir(parents=True, exist_ok=True)

        # Local dev convenience shim setup
        shim_dir: Optional[Path] = None
        try:
            shim_dir = session_dir / ".lm-bin"
            shim_dir.mkdir(parents=True, exist_ok=True)

            if shutil.which("python") is None and shutil.which("python3") is not None:
                python_shim = shim_dir / "python"
                python_shim.write_text('#!/bin/bash\nexec python3 "$@"\n', encoding="utf-8")
                python_shim.chmod(0o755)

            if shutil.which("pip") is None and shutil.which("pip3") is not None:
                pip_shim = shim_dir / "pip"
                pip_shim.write_text('#!/bin/bash\nexec pip3 "$@"\n', encoding="utf-8")
                pip_shim.chmod(0o755)
        except Exception:
            shim_dir = None

        per_cmd_timeout_s: Optional[float] = None
        if timeout_ms and int(timeout_ms) > 0:
            per_cmd_timeout_s = float(int(timeout_ms)) / 1000.0

        max_len = int(max_output_length) if max_output_length and int(max_output_length) > 0 else None

        logger.info("[ShellExecutorService] Local mode: executing commands", extra={
            "job_id": job_id,
            "workspace_id": str(workspace_id) if workspace_id else None,
            "commands_count": len(commands),
            "cwd": str(session_dir),
        })

        output_items: List[Dict[str, Any]] = []
        for cmd in commands:
            cmd_str = str(cmd)
            cmd_to_run = cmd_str
            if shim_dir is not None:
                cmd_to_run = f'export PATH="{str(shim_dir)}:$PATH"\n{cmd_str}'
            try:
                completed = subprocess.run(
                    ["bash", "-lc", cmd_to_run],
                    cwd=str(session_dir),
                    capture_output=True,
                    text=False, # Capture bytes to handle decoding safely
                    timeout=per_cmd_timeout_s,
                )
                stdout_bytes = completed.stdout or b""
                stderr_bytes = completed.stderr or b""

                stdout = stdout_bytes.decode("utf-8", errors="replace")
                stderr = stderr_bytes.decode("utf-8", errors="replace")

                if max_len is not None:
                    stdout = stdout[:max_len]
                    stderr = stderr[:max_len]

                output_items.append({
                    "stdout": stdout,
                    "stderr": stderr,
                    "outcome": {"type": "exit", "exit_code": int(completed.returncode)},
                })
            except subprocess.TimeoutExpired as te:
                stdout_bytes = te.stdout or b""
                stderr_bytes = te.stderr or b""
                
                stdout = stdout_bytes.decode("utf-8", errors="replace")
                stderr = stderr_bytes.decode("utf-8", errors="replace")
                
                if max_len is not None:
                    stdout = stdout[:max_len]
                    stderr = stderr[:max_len]
                output_items.append({
                    "stdout": stdout,
                    "stderr": stderr,
                    "outcome": {"type": "timeout"},
                })

        finished_at = time.time()
        return {
            "version": CONTRACT_VERSION,
            "job_id": job_id,
            "commands": [str(c) for c in commands],
            **({"max_output_length": max_len} if max_len is not None else {}),
            "output": output_items,
            "meta": {
                "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started_at)),
                "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(finished_at)),
                "duration_ms": int((finished_at - started_at) * 1000),
                "runner": "local-subprocess",
            },
        }
