import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

import requests

from services.steps.base import AbstractStepHandler
from services.context_builder import ContextBuilder
from utils.decimal_utils import convert_decimals_to_float
from core import log_context

logger = logging.getLogger(__name__)


class HandoffStepHandler(AbstractStepHandler):
    """
    Handler for "lead magnet handoff" steps.

    This step triggers another workflow (lead magnet) by calling the existing webhook trigger
    endpoint, passing the selected data as the destination workflow's submission_data.
    """

    def _get_api_base_url(self, job: Dict[str, Any]) -> str:
        api_url = (job.get("api_url") or os.environ.get("API_URL") or os.environ.get("API_GATEWAY_URL") or "").strip()
        return api_url.rstrip("/")

    def _ensure_webhook_token(self, tenant_id: str) -> str:
        db = self.services["db_service"]
        # Prefer a first-class helper if available
        if hasattr(db, "ensure_webhook_token"):
            return db.ensure_webhook_token(tenant_id)  # type: ignore[attr-defined]

        settings = None
        try:
            settings = db.get_settings(tenant_id)
        except Exception:
            settings = None
        token = settings.get("webhook_token") if isinstance(settings, dict) else None
        if not token:
            raise ValueError("Missing webhook_token in user settings")
        return str(token)

    def _stringify_output(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        # Best-effort stringify for structured outputs
        try:
            import json
            return json.dumps(convert_decimals_to_float(value), ensure_ascii=False)
        except Exception:
            return str(value)

    def execute(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        context: str,
        step_outputs: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
    ) -> Tuple[Dict[str, Any], List[str]]:
        step_name = step.get("step_name", f"Handoff Step {step_index + 1}")
        step_start_time = datetime.utcnow()

        target_workflow_id = (step.get("handoff_workflow_id") or "").strip()
        if not target_workflow_id:
            raise ValueError("handoff_workflow_id is required for workflow_handoff steps")

        payload_mode = (step.get("handoff_payload_mode") or "previous_step_output").strip()
        input_field = (step.get("handoff_input_field") or "input").strip() or "input"

        include_submission_data_raw = step.get("handoff_include_submission_data")
        include_submission_data = True if include_submission_data_raw is None else bool(include_submission_data_raw)

        include_context_raw = step.get("handoff_include_context")
        include_context = False if include_context_raw is None else bool(include_context_raw)

        bypass_required_inputs_raw = step.get("handoff_bypass_required_inputs")
        bypass_required_inputs = True if bypass_required_inputs_raw is None else bool(bypass_required_inputs_raw)

        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type="workflow_handoff",
            target_workflow_id=target_workflow_id,
        ):
            db = self.services["db_service"]
            s3 = self.services.get("s3_service")

            # Load current job + submission
            job = db.get_job(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")

            if str(job.get("workflow_id") or "") == target_workflow_id:
                raise ValueError("Cannot hand off to the same workflow")

            submission: Optional[Dict[str, Any]] = None
            submission_id = job.get("submission_id")
            if submission_id:
                submission = db.get_submission(submission_id)

            submission_data = submission.get("submission_data", {}) if isinstance(submission, dict) else {}

            # Validate target workflow exists and belongs to tenant
            target_workflow = db.get_workflow(target_workflow_id)
            if not target_workflow or target_workflow.get("deleted_at"):
                raise ValueError(f"Target workflow {target_workflow_id} not found")
            if target_workflow.get("tenant_id") != tenant_id:
                raise ValueError("Target workflow is not in the same tenant")

            api_base = self._get_api_base_url(job)
            if not api_base:
                raise ValueError("Missing api_url for current job; cannot trigger handoff via API")

            webhook_token = self._ensure_webhook_token(tenant_id)
            webhook_url = f"{api_base}/v1/webhooks/{webhook_token}"

            # Build payload submission_data for the destination workflow
            outgoing_submission_data: Dict[str, Any] = {}
            if include_submission_data and isinstance(submission_data, dict):
                outgoing_submission_data.update(submission_data)

            sorted_steps = step.get("_sorted_steps", []) or []
            deliverable_context = ContextBuilder.build_deliverable_context_from_step_outputs(
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
            )
            deliverable_steps: Dict[str, Any] = {}
            if deliverable_context:
                target_indices = ContextBuilder._resolve_deliverable_indices(sorted_steps)
                for idx in target_indices:
                    if idx >= len(step_outputs):
                        continue
                    step_output = step_outputs[idx]
                    step_index = step_output.get("step_index", idx)
                    step_name = step_output.get("step_name", f"Step {step_index + 1}")
                    output_text = ContextBuilder._stringify_step_output(step_output.get("output", "")).strip()
                    if not output_text:
                        continue
                    deliverable_steps[f"step_{step_index}"] = {
                        "step_name": step_name,
                        "step_index": step_index,
                        "output": output_text,
                        "artifact_id": step_output.get("artifact_id"),
                        "image_urls": step_output.get("image_urls", []),
                    }

            # Choose the primary value to pass
            primary_value: str = ""
            if payload_mode == "submission_only":
                primary_value = ""
            elif payload_mode == "full_context":
                primary_value = context or ""
            elif payload_mode == "deliverable_output":
                if deliverable_context:
                    primary_value = deliverable_context
                else:
                    last_output = step_outputs[-1].get("output") if step_outputs else ""
                    primary_value = self._stringify_output(last_output)
            else:
                # previous_step_output (default)
                last_output = step_outputs[-1].get("output") if step_outputs else ""
                primary_value = self._stringify_output(last_output)

            outgoing_submission_data[input_field] = primary_value

            if include_context and payload_mode != "full_context":
                outgoing_submission_data["context"] = context or ""
            if deliverable_context:
                outgoing_submission_data["deliverable_context"] = deliverable_context
                if deliverable_steps:
                    outgoing_submission_data["deliverable_steps"] = deliverable_steps

            # Add lightweight metadata for traceability
            outgoing_submission_data["_handoff"] = {
                "source_job_id": job_id,
                "source_workflow_id": job.get("workflow_id"),
                "source_step_index": step_index,
                "source_step_name": step_name,
                "bypass_required_inputs": bypass_required_inputs,
                "timestamp": step_start_time.isoformat(),
            }

            outgoing_submission_data = convert_decimals_to_float(outgoing_submission_data)

            request_body = {
                "workflow_id": target_workflow_id,
                "submission_data": outgoing_submission_data,
            }

            start_ms = datetime.utcnow()
            response_status: Optional[int] = None
            response_body_text: Optional[str] = None
            triggered_job_id: Optional[str] = None
            success = False
            error: Optional[str] = None

            try:
                resp = requests.post(webhook_url, json=request_body, timeout=15)
                response_status = resp.status_code
                response_body_text = resp.text[:10000] if resp.text else ""

                try:
                    resp_json = resp.json()
                except Exception:
                    resp_json = None

                if isinstance(resp_json, dict):
                    triggered_job_id = resp_json.get("job_id") or resp_json.get("jobId")

                success = (
                    response_status is not None
                    and 200 <= response_status < 300
                    and isinstance(triggered_job_id, str)
                    and len(triggered_job_id) > 0
                )

                if not success:
                    error = f"Failed to trigger handoff (status={response_status})"
            except Exception as e:
                error = str(e)
                logger.error("[HandoffStepHandler] Error triggering handoff", extra={
                    "job_id": job_id,
                    "target_workflow_id": target_workflow_id,
                    "error": error,
                }, exc_info=True)

            duration_ms = int((datetime.utcnow() - start_ms).total_seconds() * 1000)

            exec_step = {
                "step_name": step_name,
                "step_order": step_index + 1,
                "step_type": "workflow_handoff",
                "success": success,
                "input": {
                    "webhook_url": webhook_url,
                    "payload": request_body,
                },
                "output": {
                    "response_status": response_status,
                    "response_body": response_body_text,
                    "triggered_job_id": triggered_job_id,
                    "success": success,
                    "error": error,
                },
                "timestamp": step_start_time.isoformat(),
                "duration_ms": duration_ms,
            }

            execution_steps.append(exec_step)
            if s3:
                db.update_job(job_id, {"execution_steps": execution_steps}, s3_service=s3)
            else:
                # In tests/mocks, s3_service may be missing
                db.update_job(job_id, {"execution_steps": execution_steps})

            result = {
                "step_name": step_name,
                "step_index": step_index,
                "output": (
                    f'Triggered lead magnet "{target_workflow.get("workflow_name", target_workflow_id)}" '
                    f"(job_id={triggered_job_id})"
                    if success
                    else f"Failed to trigger lead magnet handoff: {error or 'unknown error'}"
                ),
                "artifact_id": None,
                "image_urls": [],
                "image_artifact_ids": [],
                "handoff_result": {
                    "target_workflow_id": target_workflow_id,
                    "triggered_job_id": triggered_job_id,
                    "success": success,
                    "response_status": response_status,
                },
                "duration_ms": duration_ms,
                "success": success,
            }

            return result, []

