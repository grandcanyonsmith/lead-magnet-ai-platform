"""
Step Processor Service
Handles processing of individual workflow steps.
"""

import logging
from datetime import datetime
import os
import re
from typing import Dict, Any, List, Optional, Tuple

import boto3

from ai_service import AIService
try:
    from model_types import Step, StepOutput, ExecutionStep, WebhookResult
except ImportError:
    # Fallback if model_types module not available
    Step = Dict[str, Any]
    StepOutput = Dict[str, Any]
    ExecutionStep = Dict[str, Any]
    WebhookResult = Dict[str, Any]
from artifact_service import ArtifactService
from db_service import DynamoDBService
from s3_service import S3Service
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.image_artifact_service import ImageArtifactService
from services.webhook_step_service import WebhookStepService
from services.ai_step_processor import AIStepProcessor
from utils.step_utils import normalize_step_order, normalize_dependency_list
from dependency_resolver import get_ready_steps, get_step_status
from core import log_context

logger = logging.getLogger(__name__)


class StepProcessor:
    """Service for processing workflow steps."""
    
    def __init__(
        self,
        ai_service: AIService,
        artifact_service: ArtifactService,
        db_service: DynamoDBService,
        s3_service: S3Service,
        usage_service: UsageService,
        image_artifact_service: ImageArtifactService
    ):
        """
        Initialize step processor.
        
        Args:
            ai_service: AI service instance
            artifact_service: Artifact service instance
            db_service: DynamoDB service instance
            s3_service: S3 service instance
            usage_service: Usage service instance
            image_artifact_service: Image artifact service instance
        """
        self.ai_service = ai_service
        self.artifact_service = artifact_service
        self.db = db_service
        self.s3 = s3_service
        self.usage_service = usage_service
        self.image_artifact_service = image_artifact_service
        self.webhook_step_service = WebhookStepService(db_service=db_service, s3_service=s3_service)
        self.ai_step_processor = AIStepProcessor(
            ai_service=ai_service,
            artifact_service=artifact_service,
            usage_service=usage_service,
            image_artifact_service=image_artifact_service
        )
    
    def _prepare_step_tools(
        self,
        step: Dict[str, Any]
    ) -> Tuple[str, List[Dict[str, Any]], str]:
        """
        Prepare and normalize tools for a step.
        
        Args:
            step: Step configuration dictionary
            
        Returns:
            Tuple of (step_model, step_tools, step_tool_choice)
        """
        step_model = step.get('model', 'gpt-5.2')
        # Force GPT family steps onto gpt-5.2 for highest quality/consistency.
        if isinstance(step_model, str) and step_model.startswith('gpt-') and step_model != 'gpt-5.2':
            step_model = 'gpt-5.2'
        
        # Do NOT auto-add web_search for o4-mini-deep-research model
        default_tools = [] if step_model == 'o4-mini-deep-research' else ['web_search']
        step_tools_raw = step.get('tools', default_tools)
        
        # Convert string tools to objects, with special handling for image_generation
        step_tools = []
        for tool in step_tools_raw:
            if isinstance(tool, str):
                if tool == 'image_generation':
                    # Convert image_generation string to object with defaults
                    step_tools.append({
                        "type": "image_generation",
                        "model": "gpt-image-1.5",
                        "size": "auto",
                        "quality": "auto",
                        "background": "auto"
                    })
                else:
                    step_tools.append({"type": tool})
            else:
                step_tools.append(tool)
        
        step_tool_choice = step.get('tool_choice', 'auto')
        
        return step_model, step_tools, step_tool_choice

    def _parse_s3_upload_target_from_instructions(
        self,
        instructions: Any,
    ) -> Optional[Dict[str, str]]:
        """
        Best-effort parse of an S3 upload request from a step's instructions.

        Expected user phrasing examples:
        - "upload this file to aws s3 bucket cc360-pages in us west 2"
        - "upload to s3://cc360-pages in us-west-2"
        """
        if not isinstance(instructions, str):
            return None
        lower = instructions.lower()
        if "upload" not in lower or "s3" not in lower:
            return None

        bucket = None

        # Prefer explicit s3://bucket form
        m = re.search(r"s3://([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])", lower)
        if m:
            bucket = m.group(1)
        else:
            # Fallback: "bucket <name>"
            m2 = re.search(r"\bbucket\s+([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\b", lower)
            if m2:
                bucket = m2.group(1)

        if not bucket:
            return None

        region = None
        # Prefer canonical region format
        m3 = re.search(r"\b([a-z]{2}-[a-z0-9-]+-\d)\b", lower)
        if m3:
            region = m3.group(1)
        else:
            # Common US region phrases (e.g. "us west 2")
            m4 = re.search(r"\b(us)\s+(east|west)\s+(\d)\b", lower)
            if m4:
                region = f"{m4.group(1)}-{m4.group(2)}-{m4.group(3)}"

        if not region:
            region = os.environ.get("AWS_REGION", "us-east-1")

        return {"bucket": bucket, "region": region}

    def _get_allowed_s3_upload_buckets(self) -> List[str]:
        raw = (os.environ.get("SHELL_S3_UPLOAD_ALLOWED_BUCKETS") or "cc360-pages").strip()
        return [b.strip() for b in raw.split(",") if b and b.strip()]

    def _get_s3_upload_key_prefix(self, *, tenant_id: str, job_id: str) -> str:
        # Default prefix keeps uploads scoped and traceable.
        prefix = (os.environ.get("SHELL_S3_UPLOAD_KEY_PREFIX") or f"leadmagnet/{tenant_id}/{job_id}/").strip()
        prefix = prefix.lstrip("/")  # avoid accidental absolute-like keys
        if ".." in prefix:
            raise ValueError("Invalid SHELL_S3_UPLOAD_KEY_PREFIX (must not contain '..')")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        return prefix

    def _sanitize_s3_key_filename(self, filename: str) -> str:
        # Keep it simple/safe for S3 keys and shell usage.
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.strip())
        return safe or "artifact.bin"

    def _find_last_artifact_id(self, step_outputs: List[Dict[str, Any]]) -> Optional[str]:
        for prev in reversed(step_outputs or []):
            aid = prev.get("artifact_id") if isinstance(prev, dict) else None
            if isinstance(aid, str) and aid.strip():
                return aid.strip()
        return None

    def _maybe_inject_s3_upload_context(
        self,
        *,
        step: Dict[str, Any],
        step_index: int,
        tenant_id: str,
        job_id: str,
        current_step_context: str,
        step_outputs: List[Dict[str, Any]],
        step_tools: List[Dict[str, Any]],
    ) -> str:
        """
        If the step instructions ask to upload a previous-step artifact to an allowed S3 bucket,
        inject a structured context block containing SOURCE_ARTIFACT_URL + DEST_PUT_URL + DEST_OBJECT_URL.
        """
        has_shell = any(
            isinstance(t, dict) and t.get("type") == "shell" for t in (step_tools or [])
        )
        if not has_shell:
            return current_step_context

        instructions = step.get("instructions", "")
        target = self._parse_s3_upload_target_from_instructions(instructions)
        if not target:
            return current_step_context

        bucket = target["bucket"]
        region = target["region"]

        allowed = set(self._get_allowed_s3_upload_buckets())
        if bucket not in allowed:
            raise ValueError(
                f"S3 upload bucket '{bucket}' is not allowed. "
                f"Set SHELL_S3_UPLOAD_ALLOWED_BUCKETS to include it."
            )

        source_artifact_id = self._find_last_artifact_id(step_outputs)
        if not source_artifact_id:
            raise ValueError("S3 upload requested but no previous step artifact_id was found")

        artifact = self.db.get_artifact(source_artifact_id)  # raises on DB issues
        if not artifact:
            raise ValueError(f"Artifact {source_artifact_id} not found")

        source_url = artifact.get("public_url") or self.artifact_service.get_artifact_public_url(source_artifact_id)
        if not isinstance(source_url, str) or not source_url.strip():
            raise ValueError(f"Artifact {source_artifact_id} has no public_url")

        filename = artifact.get("artifact_name") or f"{source_artifact_id}.bin"
        filename = self._sanitize_s3_key_filename(str(filename))
        content_type = artifact.get("mime_type") or "application/octet-stream"

        prefix = self._get_s3_upload_key_prefix(tenant_id=tenant_id, job_id=job_id)
        # Avoid accidental overwrites if multiple steps/artifacts share the same filename.
        dest_key = f"{prefix}{source_artifact_id}-{filename}"

        expires_in = int(os.environ.get("SHELL_S3_UPLOAD_PUT_EXPIRES_IN", "1800"))
        s3 = boto3.client("s3", region_name=region)
        dest_put_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": bucket, "Key": dest_key, "ContentType": str(content_type)},
            ExpiresIn=max(60, min(7 * 24 * 60 * 60, expires_in)),
        )

        # Public object URL (assumes bucket/object is public via bucket policy/CloudFront).
        dest_object_url = f"https://{bucket}.s3.{region}.amazonaws.com/{dest_key}"

        block = "\n".join([
            "=== S3 Upload (Shell Tool) ===",
            "Upload the SOURCE file to the DEST bucket using the presigned PUT URL.",
            "",
            f"SOURCE_ARTIFACT_ID: {source_artifact_id}",
            f"SOURCE_ARTIFACT_URL: {source_url}",
            "",
            f"DEST_BUCKET: {bucket}",
            f"DEST_REGION: {region}",
            f"DEST_KEY: {dest_key}",
            f"DEST_CONTENT_TYPE: {content_type}",
            f"DEST_PUT_URL: {dest_put_url}",
            f"DEST_OBJECT_URL: {dest_object_url}",
            "",
            "Execute this as shell commands (example — replace the <> placeholders with the values above):",
            "  set -euo pipefail",
            "  LOCAL_FILE=\"source_file\"",
            "  curl -fsSL \"<SOURCE_ARTIFACT_URL>\" -o \"$LOCAL_FILE\"",
            "  curl -fsS -X PUT -H \"Content-Type: <DEST_CONTENT_TYPE>\" --upload-file \"$LOCAL_FILE\" \"<DEST_PUT_URL>\"",
            "",
            "Then respond with EXACTLY ONE LINE of JSON (no extra text):",
            f"{{\"bucket\":\"{bucket}\",\"region\":\"{region}\",\"key\":\"{dest_key}\",\"content_type\":\"{content_type}\",\"s3_uri\":\"s3://{bucket}/{dest_key}\",\"object_url\":\"{dest_object_url}\"}}",
        ])

        logger.info("[StepProcessor] Injected S3 upload context", extra={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "step_index": step_index,
            "dest_bucket": bucket,
            "dest_region": region,
            "source_artifact_id": source_artifact_id,
        })

        if current_step_context and isinstance(current_step_context, str) and current_step_context.strip():
            return f"{current_step_context}\n\n{block}"
        return block

    def _execute_ai_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        initial_context: str,
        previous_context: str,
        current_step_context: str,
        previous_image_urls: Optional[List[str]],
        step_start_time: datetime,
        step_model: str,
        step_tools: List[Dict[str, Any]],
        step_tool_choice: str
    ) -> Tuple[Dict[str, Any], Dict[str, Any], List[str], bool]:
        """
        Execute AI step common logic.
        
        Returns:
            Tuple of (step_output_result, execution_step_data, image_artifact_ids, success)
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        
        try:
            # Process AI step using AI step processor
            step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self.ai_step_processor.process_ai_step(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=tenant_id,
                initial_context=initial_context,
                previous_context=previous_context,
                current_step_context=current_step_context,
                step_tools=step_tools,
                step_tool_choice=step_tool_choice,
                previous_image_urls=previous_image_urls
            )
            
            step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
            
            # Extract image URLs from response
            image_urls = response_details.get('image_urls', [])
            
            # Create step output result
            step_output_result = {
                'step_name': step_name,
                'step_index': step_index,
                'output': step_output,
                'artifact_id': step_artifact_id,
                'image_urls': image_urls,
                'image_artifact_ids': image_artifact_ids,
                'usage_info': usage_info,
                'duration_ms': int(step_duration),
                'success': True
            }
            
            # Create execution step data
            execution_step_data = ExecutionStepManager.create_ai_generation_step(
                step_name=step_name,
                step_order=step_index + 1,
                step_model=step_model,
                request_details=request_details,
                response_details=response_details,
                usage_info=usage_info,
                step_start_time=step_start_time,
                step_duration=step_duration,
                artifact_id=step_artifact_id
            )
            
            return step_output_result, execution_step_data, image_artifact_ids, True
            
        except Exception as step_error:
            step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
            error_message = f"Step {step_index + 1} ({step_name}) failed: {step_error}"
            
            logger.error(f"[StepProcessor] AI step failed but continuing workflow", extra={
                'error_type': type(step_error).__name__,
                'error_message': str(step_error),
                'duration_ms': step_duration
            }, exc_info=True)
            
            execution_step_data = ExecutionStepManager.create_failed_ai_generation_step(
                step_name=step_name,
                step_order=step_index + 1,
                step_model=step_model,
                error_message=error_message,
                step_start_time=step_start_time,
                duration_ms=step_duration
            )
            
            failed_step_output_result = {
                'step_name': step_name,
                'step_index': step_index,
                'output': error_message,
                'artifact_id': None,
                'image_urls': [],
                'image_artifact_ids': [],
                'usage_info': {},
                'error': str(step_error),
                'duration_ms': int(step_duration),
                'success': False
            }
            
            return failed_step_output_result, execution_step_data, [], False

    def process_step_batch_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        initial_context: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
        all_image_artifact_ids: List[str]
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Process a step in batch mode (used by process_job).
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        # Check if this is a webhook step
        if step_type == 'webhook' or step.get('webhook_url'):
            return self._process_webhook_step_batch_mode(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=tenant_id,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                execution_steps=execution_steps,
                all_image_artifact_ids=all_image_artifact_ids
            )
        
        # Regular AI generation step
        # Prepare step tools and model
        step_model, step_tools, step_tool_choice = self._prepare_step_tools(step)

        # Bind step-specific context
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type=step_type,
            step_model=step_model
        ):
            # CRITICAL: Reload execution_steps from S3 to ensure we have all previous steps
            # This prevents overwriting S3 with a stale execution_steps list that might be missing
            # steps saved by previous step processing operations.
            try:
                job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
                if job_with_steps and job_with_steps.get('execution_steps'):
                    execution_steps = job_with_steps['execution_steps']
                    logger.debug(f"[StepProcessor] Reloaded execution_steps from S3 before processing step (batch mode)", extra={
                        'execution_steps_count': len(execution_steps)
                    })
            except Exception as e:
                logger.warning(f"[StepProcessor] Failed to reload execution_steps from S3, using provided list", extra={
                    'error': str(e)
                })
                # Continue with provided execution_steps if reload fails
            
            logger.info(f"[StepProcessor] Processing step {step_index + 1}/{len(sorted_steps)}", extra={
                'total_steps': len(sorted_steps),
                'tools_count': len(step_tools),
                'tool_choice': step_tool_choice
            })
            
            step_start_time = datetime.utcnow()
            
            # Build context with ALL previous step outputs
            all_previous_context = ContextBuilder.build_previous_context_from_step_outputs(
                initial_context=initial_context,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps
            )
            
            logger.info(f"[StepProcessor] Built previous context for step {step_index + 1}", extra={
                'previous_steps_count': len(step_outputs),
                'previous_context_length': len(all_previous_context),
                'previous_step_names': [sorted_steps[i].get('step_name') for i in range(len(step_outputs))],
                'previous_steps_with_images': len([s for s in step_outputs if s.get('image_urls')])
            })
            
            # Current step context (empty for subsequent steps, initial_context for first step)
            current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
            current_step_context = self._maybe_inject_s3_upload_context(
                step=step,
                step_index=step_index,
                tenant_id=tenant_id,
                job_id=job_id,
                current_step_context=current_step_context,
                step_outputs=step_outputs,
                step_tools=step_tools,
            )
            
            # Collect previous image URLs for image generation steps
            previous_image_urls = None
            # Check if this step uses image_generation tool
            has_image_generation = any(
                isinstance(t, dict) and t.get('type') == 'image_generation' 
                for t in step_tools
            ) if step_tools else False
            
            if has_image_generation:
                previous_image_urls = ContextBuilder.collect_previous_image_urls(
                    execution_steps=execution_steps,
                    current_step_order=step_index + 1
                )
                logger.info(f"[StepProcessor] Collected previous image URLs for image generation step (batch mode)", extra={
                    'previous_image_urls_count': len(previous_image_urls),
                    'previous_image_urls': previous_image_urls
                })
            
            # Execute AI step
            step_output_result, execution_step_data, image_artifact_ids, _ = self._execute_ai_step(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=tenant_id,
                initial_context=initial_context,
                previous_context=all_previous_context,
                current_step_context=current_step_context,
                previous_image_urls=previous_image_urls,
                step_start_time=step_start_time,
                step_model=step_model,
                step_tools=step_tools,
                step_tool_choice=step_tool_choice
            )
            
            # Update state
            all_image_artifact_ids.extend(image_artifact_ids)
            execution_steps.append(execution_step_data)
            self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            
            return step_output_result, image_artifact_ids
    
    def _execute_webhook_step_core(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        job: Dict[str, Any],
        submission: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        step_start_time: datetime
    ) -> Tuple[Dict[str, Any], bool, Dict[str, Any]]:
        """
        Core webhook execution logic shared between batch and single modes.
        """
        # Execute webhook step (payload excluded from return to avoid Step Functions size limit)
        webhook_result, success = self.webhook_step_service.execute_webhook_step(
            step=step,
            step_index=step_index,
            job_id=job_id,
            job=job,
            submission=submission,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps
        )
        
        # Build full request details for execution step storage (stored in DynamoDB/S3, not returned to Step Functions)
        request_details = self.webhook_step_service.build_request_details(
            step=step,
            job_id=job_id,
            job=job,
            submission=submission,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            step_index=step_index,
        )
        
        # Create execution step record
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_data = ExecutionStepManager.create_webhook_step(
            step_name=step_name,
            step_order=step_index + 1,
            request=request_details,
            response_status=webhook_result.get('response_status'),
            response_body=webhook_result.get('response_body'),
            success=success,
            error=webhook_result.get('error'),
            step_start_time=step_start_time,
            duration_ms=webhook_result.get('duration_ms', 0)
        )
        
        return webhook_result, success, step_data
    
    def _get_submission_for_webhook(
        self,
        job: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get submission data for webhook processing.
        """
        submission_id = job.get('submission_id')
        submission = None
        if submission_id:
            submission = self.db.get_submission(submission_id)
        if not submission:
            submission = {'submission_data': {}}
        return submission
    
    def _process_webhook_step_batch_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
        all_image_artifact_ids: List[str]
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Process a webhook step in batch mode.
        """
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_start_time = datetime.utcnow()
        
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type='webhook',
            webhook_url=step.get('webhook_url')
        ):
            logger.info(f"[StepProcessor] Processing webhook step {step_index + 1}/{len(sorted_steps)}")
            
            # CRITICAL: Reload execution_steps from S3 to ensure we have all previous steps
            # This prevents overwriting S3 with a stale execution_steps list that might be missing
            # steps saved by previous step processing operations.
            try:
                job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
                if job_with_steps and job_with_steps.get('execution_steps'):
                    execution_steps = job_with_steps['execution_steps']
                    logger.debug(f"[StepProcessor] Reloaded execution_steps from S3 before processing webhook step (batch mode)", extra={
                        'execution_steps_count': len(execution_steps)
                    })
            except Exception as e:
                logger.warning(f"[StepProcessor] Failed to reload execution_steps from S3, using provided list", extra={
                    'error': str(e)
                })
                # Continue with provided execution_steps if reload fails
            
            # Get job and submission data
            job = self.db.get_job(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            submission = self._get_submission_for_webhook(job)
            
            # Execute webhook using shared core logic
            webhook_result, success, step_data = self._execute_webhook_step_core(
                step=step,
                step_index=step_index,
                job_id=job_id,
                job=job,
                submission=submission,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                step_start_time=step_start_time
            )
            
            execution_steps.append(step_data)
            self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            
            # Create step output dict (webhook steps don't produce content artifacts)
            step_output_dict = {
                'step_name': step_name,
                'step_index': step_index,
                'output': f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
                'artifact_id': None,
                'image_urls': [],
                'webhook_result': webhook_result
            }
            
            logger.info(f"[StepProcessor] Webhook step completed", extra={
                'success': success,
                'response_status': webhook_result.get('response_status')
            })
            
            # Webhook failures don't fail the workflow (log error but continue)
            if not success:
                logger.warning(f"[StepProcessor] Webhook step failed but continuing workflow", extra={
                    'error': webhook_result.get('error')
                })
            
            return step_output_dict, []
    
    def _build_step_outputs_from_execution_steps(
        self,
        execution_steps: List[Dict[str, Any]],
        steps: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Build step_outputs list from execution_steps for single mode processing.
        """
        step_outputs = []
        for exec_step in execution_steps:
            if exec_step.get('step_type') != 'ai_generation':
                continue
            step_order = normalize_step_order(exec_step)
            if step_order <= 0:
                continue
            # step_order is 1-indexed for workflow steps -> convert to 0-indexed workflow step index
            workflow_step_index = step_order - 1
            step_outputs.append({
                'step_name': exec_step.get('step_name', f'Step {workflow_step_index + 1}'),
                'step_index': workflow_step_index,
                'output': exec_step.get('output', ''),
                'artifact_id': exec_step.get('artifact_id'),
                'image_urls': exec_step.get('image_urls', [])
            })

        # Keep a stable order for downstream payload building / template insertion
        step_outputs.sort(key=lambda s: s.get('step_index', 0))
        return step_outputs
    
    def _update_execution_steps_with_rerun_support(
        self,
        execution_steps: List[Dict[str, Any]],
        step_data: Dict[str, Any],
        step_order: int,
        step_type: str
    ) -> None:
        """
        Update execution_steps list, replacing existing step if present (for reruns).
        """
        existing_step_index = None
        for i, existing_step in enumerate(execution_steps):
            if existing_step.get('step_order') == step_order and existing_step.get('step_type') == step_type:
                existing_step_index = i
                break
        
        if existing_step_index is not None:
            logger.info(f"Replacing existing {step_type} execution step for step_order {step_order} (rerun)")
            execution_steps[existing_step_index] = step_data
        else:
            execution_steps.append(step_data)
    
    def _process_webhook_step_single_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        steps: List[Dict[str, Any]],
        job_id: str,
        job: Dict[str, Any],
        execution_steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process a webhook step in single mode.
        """
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_start_time = datetime.utcnow()
        
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type='webhook',
            webhook_url=step.get('webhook_url')
        ):
            logger.info(f"[StepProcessor] Processing webhook step {step_index + 1} in single mode")
            
            # Get submission data
            submission = self._get_submission_for_webhook(job)
            
            # CRITICAL: Reload execution_steps from S3 so webhook steps don't operate on a stale list
            # (and accidentally overwrite execution_steps.json with partial data).
            try:
                job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
                if job_with_steps and job_with_steps.get('execution_steps'):
                    execution_steps = job_with_steps['execution_steps']
                    logger.debug(f"[StepProcessor] Reloaded execution_steps from S3 before webhook step (single mode)", extra={
                        'execution_steps_count': len(execution_steps)
                    })
            except Exception as e:
                logger.warning(f"[StepProcessor] Failed to reload execution_steps from S3 before webhook step (single mode), using provided list", extra={
                    'error': str(e)
                })

            # Build step_outputs from execution_steps
            sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
            step_outputs = self._build_step_outputs_from_execution_steps(execution_steps, steps)
            
            # Execute webhook using shared core logic
            webhook_result, success, step_data = self._execute_webhook_step_core(
                step=step,
                step_index=step_index,
                job_id=job_id,
                job=job,
                submission=submission,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                step_start_time=step_start_time
            )
            
            # Update execution steps with rerun support
            self._update_execution_steps_with_rerun_support(
                execution_steps=execution_steps,
                step_data=step_data,
                step_order=step_index + 1,
                step_type='webhook'
            )
            
            # Update job with execution steps
            self.db.update_job(job_id, {
                'execution_steps': execution_steps
            }, s3_service=self.s3)
            
            logger.info(f"Webhook step {step_index + 1} completed successfully in {webhook_result.get('duration_ms', 0):.0f}ms")
            
            # Webhook failures don't fail the workflow (log error but continue)
            if not success:
                logger.warning(f"[StepProcessor] Webhook step failed but continuing workflow", extra={
                    'error': webhook_result.get('error')
                })
            
            return {
                'success': success,
                'step_index': step_index,
                'step_name': step_name,
                'step_output': f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
                'artifact_id': None,
                'image_urls': [],
                'image_artifact_ids': [],
                'webhook_result': webhook_result,
                'duration_ms': webhook_result.get('duration_ms', 0)
            }
    
    def process_single_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        steps: List[Dict[str, Any]],
        job_id: str,
        job: Dict[str, Any],
        initial_context: str,
        execution_steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process a single step (used by process_single_step).
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        # Check if this is a webhook step
        if step_type == 'webhook' or step.get('webhook_url'):
            return self._process_webhook_step_single_mode(
                step=step,
                step_index=step_index,
                steps=steps,
                job_id=job_id,
                job=job,
                execution_steps=execution_steps
            )
        
        # Regular AI generation step
        step_model = step.get('model', 'gpt-5.2')
        # Force GPT family steps onto gpt-5.2 for highest quality/consistency.
        if isinstance(step_model, str) and step_model.startswith('gpt-') and step_model != 'gpt-5.2':
            step_model = 'gpt-5.2'
        step_instructions = step.get('instructions', '')
        
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type=step_type,
            step_model=step_model
        ):
            # Reload execution_steps from database/S3 to ensure we have the latest data
            # This is important when steps are processed in separate Lambda invocations
            try:
                job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
                if job_with_steps and job_with_steps.get('execution_steps'):
                    execution_steps = job_with_steps['execution_steps']
                    logger.debug(f"[StepProcessor] Reloaded execution_steps from database", extra={
                        'execution_steps_count': len(execution_steps)
                    })
            except Exception as e:
                logger.warning(f"[StepProcessor] Failed to reload execution_steps, using provided list", extra={
                    'error': str(e)
                })
                # Continue with provided execution_steps if reload fails
            
            # Check if dependencies are satisfied
            step_deps = step.get('depends_on', [])
            if not step_deps:
                # Auto-detect from step_order
                step_order = step.get('step_order', step_index)
                step_deps = [
                    i for i, s in enumerate(steps)
                    if s.get('step_order', i) < step_order
                ]
            else:
                # Normalize dependency values (handle Decimal types from DynamoDB)
                step_deps = normalize_dependency_list(step_deps)
            
            # Get completed step indices from execution_steps (include both AI and webhook steps)
            completed_step_indices = [
                normalize_step_order(s) - 1  # Convert 1-indexed step_order to 0-indexed
                for s in execution_steps
                if s.get('step_type') in ['ai_generation', 'webhook'] and normalize_step_order(s) > 0
            ]
            
            logger.debug(f"[StepProcessor] Dependency check", extra={
                'step_deps': step_deps,
                'completed_step_indices': completed_step_indices,
                'execution_steps_count': len(execution_steps),
                'execution_steps_types': [s.get('step_type') for s in execution_steps],
                'execution_steps_orders': [normalize_step_order(s) for s in execution_steps]
            })
            
            # Check if all dependencies are completed
            all_deps_completed = len(step_deps) == 0 or all(dep_index in completed_step_indices for dep_index in step_deps)
            
            if not all_deps_completed:
                missing_deps = [dep for dep in step_deps if dep not in completed_step_indices]
                logger.warning(f"[StepProcessor] Step {step_index + 1} ({step_name}) waiting for dependencies", extra={
                    'step_status': 'waiting',
                    'missing_dependencies': missing_deps,
                    'completed_steps': completed_step_indices
                })
                raise ValueError(f"Step {step_index + 1} ({step_name}) cannot execute yet. Missing dependencies: {missing_deps}")
            
            # Get ready steps for logging (only for AI steps)
            if step_type != 'webhook':
                ready_steps = get_ready_steps(completed_step_indices, steps)
                step_status_map = get_step_status(completed_step_indices, [], steps)
                
                logger.info(f"[StepProcessor] Step readiness check", extra={
                    'step_status': 'ready',
                    'dependencies': step_deps,
                    'all_dependencies_completed': all_deps_completed,
                    'ready_steps': ready_steps,
                    'step_status_map': {k: v for k, v in step_status_map.items()}
                })
            
            # Extract tools and tool_choice from step config
            # Prepare step tools and model
            step_model, step_tools, step_tool_choice = self._prepare_step_tools(step)
            
            logger.info(f"Processing step {step_index + 1}/{len(steps)}: {step_name}", extra={
                'step_status': 'ready'
            })
            
            step_start_time = datetime.utcnow()
            image_artifact_ids = []
            current_step_order = step_index + 1
            
            # Build context only from dependency steps
            all_previous_context = ContextBuilder.build_previous_context_from_execution_steps(
                initial_context=initial_context,
                execution_steps=execution_steps,
                current_step_order=step_index + 1,
                dependency_indices=step_deps
            )
            
            logger.info(f"[StepProcessor] Built previous context for step {step_index + 1}", extra={
                'current_step_order': current_step_order,
                'previous_steps_count': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order]),
                'previous_context_length': len(all_previous_context),
                'previous_steps_with_images': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order and s.get('image_urls')])
            })
            
            # Current step context
            current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
            current_step_context = self._maybe_inject_s3_upload_context(
                step=step,
                step_index=step_index,
                tenant_id=tenant_id,
                job_id=job_id,
                current_step_context=current_step_context,
                step_outputs=step_outputs,
                step_tools=step_tools,
            )
            
            # Collect previous image URLs for image generation steps
            previous_image_urls = []
            # Check if this step uses image_generation tool
            has_image_generation = any(
                isinstance(t, dict) and t.get('type') == 'image_generation' 
                for t in step_tools
            ) if step_tools else False
            
            if has_image_generation:
                previous_image_urls = ContextBuilder.collect_previous_image_urls(
                    execution_steps=execution_steps,
                    current_step_order=step_index + 1
                )
                logger.info(f"[StepProcessor] Collected previous image URLs for image generation step", extra={
                    'previous_image_urls_count': len(previous_image_urls),
                    'previous_image_urls': previous_image_urls
                })
            
            logger.info(f"[StepProcessor] Processing step {step_index + 1}", extra={
                'step_tool_choice': step_tool_choice,
                'step_tools_count': len(step_tools) if step_tools else 0,
                'step_tools': [t.get('type') if isinstance(t, dict) else t for t in step_tools] if step_tools else [],
                'current_step_context_length': len(current_step_context),
                'previous_context_length': len(all_previous_context),
                'has_image_generation': has_image_generation,
                'previous_image_urls_count': len(previous_image_urls)
            })
            
            # Execute AI step
            step_output_result, execution_step_data, image_artifact_ids, success = self._execute_ai_step(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=job['tenant_id'],
                initial_context=initial_context,
                previous_context=all_previous_context,
                current_step_context=current_step_context,
                previous_image_urls=previous_image_urls if has_image_generation else None,
                step_start_time=step_start_time,
                step_model=step_model,
                step_tools=step_tools,
                step_tool_choice=step_tool_choice
            )
            
            if not success:
                self._update_execution_steps_with_rerun_support(
                    execution_steps=execution_steps,
                    step_data=execution_step_data,
                    step_order=step_index + 1,
                    step_type='ai_generation'
                )
                
                self.db.update_job(job_id, {
                    'execution_steps': execution_steps
                }, s3_service=self.s3)
                
                return step_output_result
            
            # Update execution steps with rerun support
            self._update_execution_steps_with_rerun_support(
                execution_steps=execution_steps,
                step_data=execution_step_data,
                step_order=step_index + 1,
                step_type='ai_generation'
            )
            
            # Update job with execution steps and add artifacts to job's artifacts list
            step_artifact_id = step_output_result['artifact_id']
            artifacts_list = job.get('artifacts', [])
            if step_artifact_id not in artifacts_list:
                artifacts_list.append(step_artifact_id)
            for image_artifact_id in image_artifact_ids:
                if image_artifact_id not in artifacts_list:
                    artifacts_list.append(image_artifact_id)
            
            self.db.update_job(job_id, {
                'execution_steps': execution_steps,
                'artifacts': artifacts_list
            }, s3_service=self.s3)
            
            logger.info(f"Step {step_index + 1} completed successfully in {step_output_result.get('duration_ms', 0):.0f}ms")
            
            return step_output_result
