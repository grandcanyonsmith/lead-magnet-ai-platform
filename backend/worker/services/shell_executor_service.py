"""
Shell Executor Service (Worker-side orchestrator)

Runs model-requested shell commands inside the ECS Fargate shell executor task,
then polls S3 for the uploaded result JSON.

This mirrors the Node orchestrator logic implemented in backend/api, but is used
from the Python worker so workflow steps can use the `shell` tool.
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


def _parse_subnet_ids(raw: Optional[str]) -> List[str]:
    """Parse comma-separated subnet IDs."""
    if not raw:
        return []
    return [s.strip() for s in raw.split(",") if s and s.strip()]


def _is_no_such_key(err: Exception) -> bool:
    """Check if the error is a NoSuchKey/NotFound error from S3."""
    if not isinstance(err, ClientError):
        return False
    code = (err.response or {}).get("Error", {}).get("Code") or ""
    return code in ("NoSuchKey", "NotFound", "404")


class ShellExecutorService:
    """Executes commands via ECS Fargate shell executor task."""

    def __init__(
        self,
        ecs_client: Optional[Any] = None,
        s3_client: Optional[Any] = None
    ):
        """
        Initialize the shell executor service.
        
        Args:
            ecs_client: Optional boto3 ECS client (for testing/DI)
            s3_client: Optional boto3 S3 client (for testing/DI)
        """
        self._ecs = ecs_client or boto3.client("ecs", region_name=settings.AWS_REGION)
        self._s3 = s3_client or boto3.client("s3", region_name=settings.AWS_REGION)

    def run_shell_job(
        self,
        commands: List[str],
        timeout_ms: Optional[int] = None,
        max_output_length: Optional[int] = None,
        workspace_id: Optional[str] = None,
        reset_workspace: Optional[bool] = None,
        max_wait_seconds: int = 600,
    ) -> Dict[str, Any]:
        """
        Run a one-shot executor job and return the parsed result JSON.

        Uses configuration from core.config.settings.
        """

        if not commands or not isinstance(commands, list):
            raise ValueError("commands must be a non-empty list of strings")

        # ------------------------------------------------------------------
        # Local dev mode: execute commands on the local machine (no ECS/EFS).
        # This is ONLY enabled when IS_LOCAL=true to avoid accidental use in prod.
        # ------------------------------------------------------------------
        if (os.environ.get("IS_LOCAL") or "").strip().lower() == "true":
            return self._run_shell_job_local(
                commands=commands,
                timeout_ms=timeout_ms,
                max_output_length=max_output_length,
                workspace_id=workspace_id,
                reset_workspace=reset_workspace,
            )

        # Load configuration
        bucket = settings.SHELL_EXECUTOR_RESULTS_BUCKET or os.environ.get("SHELL_EXECUTOR_RESULTS_BUCKET")
        cluster_arn = settings.SHELL_EXECUTOR_CLUSTER_ARN or os.environ.get("SHELL_EXECUTOR_CLUSTER_ARN")
        task_def_arn = settings.SHELL_EXECUTOR_TASK_DEFINITION_ARN or os.environ.get("SHELL_EXECUTOR_TASK_DEFINITION_ARN")
        security_group_id = settings.SHELL_EXECUTOR_SECURITY_GROUP_ID or os.environ.get("SHELL_EXECUTOR_SECURITY_GROUP_ID")
        subnet_ids_raw = settings.SHELL_EXECUTOR_SUBNET_IDS or os.environ.get("SHELL_EXECUTOR_SUBNET_IDS")
        subnet_ids = _parse_subnet_ids(subnet_ids_raw)

        # Validate configuration
        if not bucket:
            raise RuntimeError("SHELL_EXECUTOR_RESULTS_BUCKET is not set")
        if not cluster_arn:
            raise RuntimeError("SHELL_EXECUTOR_CLUSTER_ARN is not set")
        if not task_def_arn:
            raise RuntimeError("SHELL_EXECUTOR_TASK_DEFINITION_ARN is not set")
        if not security_group_id:
            raise RuntimeError("SHELL_EXECUTOR_SECURITY_GROUP_ID is not set")
        if not subnet_ids:
            raise RuntimeError("SHELL_EXECUTOR_SUBNET_IDS is not set")

        job_id = uuid.uuid4().hex
        result_key = f"shell-results/{job_id}.json"
        job_request_key = f"shell-jobs/{job_id}.json"

        # Generate presigned PUT URL for result
        # Expiration must be longer than max task duration (20 min per command) + buffer
        # Set to 30 minutes (1800 seconds) to ensure URL doesn't expire before task completes
        put_url = self._s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": bucket, "Key": result_key, "ContentType": "application/json"},
            ExpiresIn=1800,  # 30 minutes
        )

        # Build job request
        job_request: Dict[str, Any] = {
            "version": CONTRACT_VERSION,
            "job_id": job_id,
            "commands": [str(c) for c in commands],
            "result_put_url": put_url,
            "result_content_type": "application/json",
        }
        if workspace_id and isinstance(workspace_id, str) and workspace_id.strip():
            job_request["workspace_id"] = str(workspace_id).strip()
            if reset_workspace is not None:
                job_request["reset_workspace"] = bool(reset_workspace)
        if timeout_ms and int(timeout_ms) > 0:
            job_request["timeout_ms"] = int(timeout_ms)
        if max_output_length and int(max_output_length) > 0:
            job_request["max_output_length"] = int(max_output_length)

        # Upload job request to S3 and generate presigned GET URL
        # This avoids the 8192 character limit for container overrides
        job_request_json = json.dumps(job_request)
        job_request_size = len(job_request_json.encode("utf-8"))
        
        logger.info("[ShellExecutorService] Uploading job request to S3", extra={
            "job_id": job_id,
            "job_request_size_bytes": job_request_size,
            "commands_count": len(commands),
        })

        # Upload job request JSON to S3
        self._s3.put_object(
            Bucket=bucket,
            Key=job_request_key,
            Body=job_request_json.encode("utf-8"),
            ContentType="application/json",
        )

        # Generate presigned GET URL for job request (valid for 15 minutes)
        job_request_get_url = self._s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": job_request_key},
            ExpiresIn=900,  # 15 minutes
        )

        # Check if the GET URL would exceed container override limits
        # ECS container overrides have a limit of 8192 characters total
        # A presigned URL is typically 500-800 characters, well under the limit
        get_url_size = len(job_request_get_url)
        if get_url_size > 8000:
            # Clean up uploaded job request
            self._cleanup_s3_objects(bucket, [job_request_key])
            raise RuntimeError(
                f"Job request GET URL too large ({get_url_size} chars). "
                f"Consider splitting commands into multiple jobs."
            )

        logger.info("[ShellExecutorService] Starting ECS task", extra={
            "job_id": job_id,
            "commands_count": len(commands),
            "cluster_arn": cluster_arn,
            "job_request_get_url_size": get_url_size,
        })

        try:
            run_resp = self._ecs.run_task(
                cluster=cluster_arn,
                taskDefinition=task_def_arn,
                capacityProviderStrategy=[
                    {
                        "capacityProvider": "FARGATE_SPOT",
                        "weight": 1,
                    }
                ],
                platformVersion="LATEST",
                networkConfiguration={
                    "awsvpcConfiguration": {
                        "assignPublicIp": "DISABLED",
                        "subnets": subnet_ids,
                        "securityGroups": [security_group_id],
                    }
                },
                overrides={
                    "containerOverrides": [
                        {
                            "name": "runner",
                            "environment": [
                                {"name": "SHELL_EXECUTOR_JOB_GET_URL", "value": job_request_get_url},
                            ],
                        }
                    ]
                },
                startedBy="leadmagnet-worker",
            )
        except Exception as e:
            # Clean up if run_task fails
            self._cleanup_s3_objects(bucket, [job_request_key])
            raise RuntimeError(f"Failed to run ECS task: {e}") from e

        failures = run_resp.get("failures") or []
        if failures:
            self._cleanup_s3_objects(bucket, [job_request_key])
            raise RuntimeError(f"ECS RunTask failures: {failures}")

        task_arn = None
        tasks = run_resp.get("tasks") or []
        if tasks and isinstance(tasks, list):
            task_arn = (tasks[0] or {}).get("taskArn")

        return self._poll_for_result(
            bucket=bucket,
            result_key=result_key,
            job_request_key=job_request_key,
            cluster_arn=cluster_arn,
            task_arn=task_arn,
            job_id=job_id,
            max_wait_seconds=max_wait_seconds
        )

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
        Local fallback for running shell commands without ECS.

        Returns a result compatible with OpenAI `shell_call_output.output[]`.
        """
        started_at = time.time()
        job_id = uuid.uuid4().hex

        root = Path(os.environ.get("SHELL_EXECUTOR_LOCAL_ROOT") or "/tmp/leadmagnet-shell-executor")
        session_dir = root / "sessions" / (workspace_id.strip() if isinstance(workspace_id, str) and workspace_id.strip() else job_id)

        if reset_workspace:
            try:
                shutil.rmtree(session_dir, ignore_errors=True)
            except Exception:
                pass

        session_dir.mkdir(parents=True, exist_ok=True)

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
            try:
                completed = subprocess.run(
                    ["bash", "-lc", cmd_str],
                    cwd=str(session_dir),
                    capture_output=True,
                    text=True,
                    timeout=per_cmd_timeout_s,
                )
                stdout = completed.stdout or ""
                stderr = completed.stderr or ""

                if max_len is not None:
                    stdout = stdout[:max_len]
                    stderr = stderr[:max_len]

                output_items.append({
                    "stdout": stdout,
                    "stderr": stderr,
                    "outcome": {"type": "exit", "exit_code": int(completed.returncode)},
                })
            except subprocess.TimeoutExpired as te:
                stdout = te.stdout or ""
                stderr = te.stderr or ""
                if not isinstance(stdout, str):
                    try:
                        stdout = stdout.decode("utf-8", errors="replace")
                    except Exception:
                        stdout = ""
                if not isinstance(stderr, str):
                    try:
                        stderr = stderr.decode("utf-8", errors="replace")
                    except Exception:
                        stderr = ""
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

    def _cleanup_s3_objects(self, bucket: str, keys: List[str]) -> None:
        """Best-effort cleanup of S3 objects."""
        for key in keys:
            try:
                self._s3.delete_object(Bucket=bucket, Key=key)
            except Exception:
                pass

    def _poll_for_result(
        self,
        bucket: str,
        result_key: str,
        job_request_key: str,
        cluster_arn: str,
        task_arn: Optional[str],
        job_id: str,
        max_wait_seconds: int
    ) -> Dict[str, Any]:
        """Poll S3 for the result file."""
        start = time.time()
        last_task_check = 0.0
        task_check_interval_s = 5.0

        while (time.time() - start) < max_wait_seconds:
            try:
                obj = self._s3.get_object(Bucket=bucket, Key=result_key)
                body = obj["Body"].read().decode("utf-8")
                parsed = json.loads(body)

                # Cleanup
                self._cleanup_s3_objects(bucket, [result_key, job_request_key])

                logger.info("[ShellExecutorService] Result received", extra={
                    "job_id": job_id,
                    "task_arn": task_arn,
                })
                return parsed

            except ClientError as e:
                if not _is_no_such_key(e):
                    raise

                # Check if task failed/stopped
                now = time.time()
                if task_arn and (now - last_task_check) >= task_check_interval_s:
                    last_task_check = now
                    if self._check_task_stopped(cluster_arn, task_arn, job_id):
                        # Task stopped but no result -> it failed
                        raise RuntimeError(
                            f"Shell executor task stopped without result (job_id={job_id})"
                        )
                
                time.sleep(0.5)
                continue

        # Timeout
        self._cleanup_s3_objects(bucket, [job_request_key])
        raise TimeoutError(f"Timed out waiting for shell executor result (job_id={job_id}, task_arn={task_arn})")

    def _check_task_stopped(self, cluster_arn: str, task_arn: str, job_id: str) -> bool:
        """
        Check if the ECS task has stopped.
        Returns True if stopped, False if running/unknown.
        Raises RuntimeError if task stopped with error.
        """
        try:
            desc = self._ecs.describe_tasks(cluster=cluster_arn, tasks=[task_arn])
            task = (desc.get("tasks") or [{}])[0] or {}
            
            if task.get("lastStatus") == "STOPPED":
                containers = task.get("containers") or []
                runner = next((c for c in containers if c.get("name") == "runner"), None) or (containers[0] if containers else {})
                exit_code = runner.get("exitCode")
                reason = runner.get("reason") or task.get("stoppedReason") or "unknown"
                
                # If we get here, it means the task stopped but we didn't find the result in S3 yet.
                # This is likely a failure.
                raise RuntimeError(
                    f"Shell executor task stopped before uploading result "
                    f"(job_id={job_id}, task_arn={task_arn}, exit_code={exit_code}): {reason}"
                )
                
            return False
        except RuntimeError:
            raise
        except Exception as check_err:
            logger.warning("[ShellExecutorService] Failed to check ECS task status", extra={
                "job_id": job_id,
                "task_arn": task_arn,
                "error": str(check_err),
            })
            return False
