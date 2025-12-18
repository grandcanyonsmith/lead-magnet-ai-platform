"""
Shell Executor Service (Worker-side orchestrator)

Runs model-requested shell commands inside the ECS Fargate shell executor task,
then polls S3 for the uploaded result JSON.

This mirrors the Node orchestrator logic implemented in backend/api, but is used
from the Python worker so workflow steps can use the `shell` tool.
"""

import base64
import json
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

CONTRACT_VERSION = "2025-12-18"


def _parse_subnet_ids(raw: str) -> List[str]:
    return [s.strip() for s in (raw or "").split(",") if s and s.strip()]


def _is_no_such_key(err: Exception) -> bool:
    if not isinstance(err, ClientError):
        return False
    code = (err.response or {}).get("Error", {}).get("Code") or ""
    return code in ("NoSuchKey", "NotFound", "404")


class ShellExecutorService:
    """Executes commands via ECS Fargate shell executor task."""

    def __init__(self):
        self._ecs = boto3.client("ecs")
        self._s3 = boto3.client("s3")

    def run_shell_job(
        self,
        commands: List[str],
        timeout_ms: Optional[int] = None,
        max_output_length: Optional[int] = None,
        max_wait_seconds: int = 600,
    ) -> Dict[str, Any]:
        """
        Run a one-shot executor job and return the parsed result JSON.

        Environment variables required:
        - SHELL_EXECUTOR_RESULTS_BUCKET
        - SHELL_EXECUTOR_CLUSTER_ARN
        - SHELL_EXECUTOR_TASK_DEFINITION_ARN
        - SHELL_EXECUTOR_SECURITY_GROUP_ID
        - SHELL_EXECUTOR_SUBNET_IDS (comma-separated)
        """

        if not commands or not isinstance(commands, list):
            raise ValueError("commands must be a non-empty list of strings")

        bucket = (os.environ.get("SHELL_EXECUTOR_RESULTS_BUCKET") or "").strip()
        cluster_arn = (os.environ.get("SHELL_EXECUTOR_CLUSTER_ARN") or "").strip()
        task_def_arn = (os.environ.get("SHELL_EXECUTOR_TASK_DEFINITION_ARN") or "").strip()
        security_group_id = (os.environ.get("SHELL_EXECUTOR_SECURITY_GROUP_ID") or "").strip()
        subnet_ids = _parse_subnet_ids(os.environ.get("SHELL_EXECUTOR_SUBNET_IDS") or "")

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
        key = f"shell-results/{job_id}.json"

        put_url = self._s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": "application/json"},
            ExpiresIn=300,
        )

        job_request: Dict[str, Any] = {
            "version": CONTRACT_VERSION,
            "job_id": job_id,
            "commands": [str(c) for c in commands],
            "result_put_url": put_url,
            "result_content_type": "application/json",
        }
        if timeout_ms and int(timeout_ms) > 0:
            job_request["timeout_ms"] = int(timeout_ms)
        if max_output_length and int(max_output_length) > 0:
            job_request["max_output_length"] = int(max_output_length)

        job_b64 = base64.b64encode(json.dumps(job_request).encode("utf-8")).decode("ascii")

        logger.info("[ShellExecutorService] Starting ECS task", extra={
            "job_id": job_id,
            "commands_count": len(commands),
            "cluster_arn": cluster_arn,
        })

        run_resp = self._ecs.run_task(
            cluster=cluster_arn,
            taskDefinition=task_def_arn,
            launchType="FARGATE",
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
                            {"name": "SHELL_EXECUTOR_JOB_B64", "value": job_b64},
                        ],
                    }
                ]
            },
            startedBy="leadmagnet-worker",
        )

        failures = run_resp.get("failures") or []
        if failures:
            raise RuntimeError(f"ECS RunTask failures: {failures}")

        task_arn = None
        tasks = run_resp.get("tasks") or []
        if tasks and isinstance(tasks, list):
            task_arn = (tasks[0] or {}).get("taskArn")

        # Poll S3 for the executor result JSON
        start = time.time()
        while (time.time() - start) < max_wait_seconds:
            try:
                obj = self._s3.get_object(Bucket=bucket, Key=key)
                body = obj["Body"].read().decode("utf-8")
                parsed = json.loads(body)

                # Best-effort cleanup; bucket has lifecycle rule too.
                try:
                    self._s3.delete_object(Bucket=bucket, Key=key)
                except Exception:
                    pass

                logger.info("[ShellExecutorService] Result received", extra={
                    "job_id": job_id,
                    "task_arn": task_arn,
                })
                return parsed
            except ClientError as e:
                if _is_no_such_key(e):
                    time.sleep(0.5)
                    continue
                raise

        raise TimeoutError(f"Timed out waiting for shell executor result (job_id={job_id}, task_arn={task_arn})")


