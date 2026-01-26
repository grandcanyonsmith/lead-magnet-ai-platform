"""
AI Step Processor Service
Handles processing of AI generation workflow steps.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

from ai_service import AIService
from artifact_service import ArtifactService
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.image_artifact_service import ImageArtifactService
from utils.content_detector import detect_content_type
from core.prompts import PROMPT_CONFIGS

logger = logging.getLogger(__name__)


class AIStepProcessor:
    """Service for processing AI generation workflow steps."""
    
    def __init__(
        self,
        ai_service: AIService,
        artifact_service: ArtifactService,
        usage_service: UsageService,
        image_artifact_service: ImageArtifactService
    ):
        """
        Initialize AI step processor.
        
        Args:
            ai_service: AI service instance
            artifact_service: Artifact service instance
            usage_service: Usage service instance
            image_artifact_service: Image artifact service instance
        """
        self.ai_service = ai_service
        self.artifact_service = artifact_service
        self.usage_service = usage_service
        self.image_artifact_service = image_artifact_service
    
    def process_ai_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        initial_context: str,
        previous_context: str,
        current_step_context: str,
        step_tools: List[Dict[str, Any]],
        step_tool_choice: str,
        previous_image_urls: Optional[List[str]] = None
    ) -> Tuple[str, Dict[str, Any], Dict[str, Any], Dict[str, Any], List[str], str]:
        """
        Process an AI generation step.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            tenant_id: Tenant ID
            initial_context: Initial formatted submission context
            previous_context: Dependency steps context
            current_step_context: Current step context
            step_tools: List of tools for this step
            step_tool_choice: Tool choice setting
            previous_image_urls: Optional list of previous image URLs
            
        Returns:
            Tuple of (step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id)
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        defaults = PROMPT_CONFIGS["ai_generation"]
        step_model = step.get('model', defaults["model"])
        step_instructions = step.get('instructions', '')
        # Extract reasoning effort from step config, default to 'high' for GPT-5 family
        step_reasoning_effort = step.get('reasoning_effort')
        if step_reasoning_effort is None and isinstance(step_model, str) and step_model.startswith('gpt-5'):
            step_reasoning_effort = 'high'
        # Extract service tier and structured output options (optional)
        step_service_tier = step.get('service_tier')
        if step_service_tier is not None and step_service_tier not in ['auto', 'default', 'flex', 'scale', 'priority']:
            step_service_tier = None

        step_output_format = step.get('output_format')
        if not isinstance(step_output_format, dict):
            step_output_format = None
        else:
            fmt_type = step_output_format.get('type')
            if fmt_type not in ['text', 'json_object', 'json_schema']:
                step_output_format = None
            elif fmt_type == 'json_schema':
                if not isinstance(step_output_format.get('name'), str) or not isinstance(step_output_format.get('schema'), dict):
                    step_output_format = None
        # Extract text verbosity and max_output_tokens from step config
        step_text_verbosity = step.get('text_verbosity')
        step_max_output_tokens = step.get('max_output_tokens')
        step_shell_settings = step.get("shell_settings")
        if not isinstance(step_shell_settings, dict):
            step_shell_settings = None
        
        logger.info(f"[AIStepProcessor] Processing AI step {step_index + 1}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_model': step_model,
            'tools_count': len(step_tools),
            'tool_choice': step_tool_choice,
            'has_previous_image_urls': previous_image_urls is not None and len(previous_image_urls) > 0
        })
        
        step_start_time = datetime.utcnow()
        
        # Set step context for AI naming
        self.ai_service.set_step_context(step_name, step_instructions)
        
        try:
            # Generate step output
            step_output, usage_info, request_details, response_details = self.ai_service.generate_report(
                model=step_model,
                instructions=step_instructions,
                context=current_step_context,
                previous_context=previous_context,
                tools=step_tools,
                tool_choice=step_tool_choice,
                tenant_id=tenant_id,
                job_id=job_id,
                previous_image_urls=previous_image_urls,
                reasoning_effort=step_reasoning_effort,
                service_tier=step_service_tier,
                output_format=step_output_format,
                step_index=step_index,
                text_verbosity=step_text_verbosity,
                max_output_tokens=step_max_output_tokens,
                shell_settings=step_shell_settings,
            )
        finally:
            # Clean up step context
            self.ai_service.set_step_context(None, None)
        
        step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
        
        logger.info(f"[AIStepProcessor] Step completed successfully", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_model': step_model,
            'duration_ms': step_duration,
            'output_length': len(step_output),
            'input_tokens': usage_info.get('input_tokens', 0),
            'output_tokens': usage_info.get('output_tokens', 0),
            'total_tokens': usage_info.get('total_tokens', 0),
            'cost_usd': usage_info.get('cost_usd', 0),
            'images_generated': len(response_details.get('image_urls', []))
        })
        
        # Store usage record
        self.usage_service.store_usage_record(tenant_id, job_id, usage_info)
        
        safe_step_name = step_name.lower().replace(" ", "_")
        
        # Append logs to step_output for visibility in frontend
        log_text_parts = []
        
        shell_executor_logs = response_details.get("shell_executor_logs")
        if shell_executor_logs:
            log_text_parts.append("\n\n[Tool output]")
            for log_entry in shell_executor_logs:
                commands = log_entry.get("commands", [])
                outputs = log_entry.get("output", [])
                for cmd in commands:
                    log_text_parts.append(f"$ {cmd}")
                for out in outputs:
                    if out.get("stdout"):
                        stdout = out['stdout'].strip()
                        if stdout:
                            log_text_parts.append(f"📤 {stdout}")
                    if out.get("stderr"):
                        stderr = out['stderr'].strip()
                        if stderr:
                            log_text_parts.append(f"⚠️ {stderr}")

        code_executor_logs = response_details.get("code_executor_logs")
        if code_executor_logs:
            for log_entry in code_executor_logs:
                status = log_entry.get("status")
                outputs = log_entry.get("outputs", [])
                
                if status:
                    log_text_parts.append(f"\n[Code interpreter] {status}")
                else:
                    log_text_parts.append(f"\n[Code interpreter]")

                for out in outputs:
                    logs = out.get("logs")
                    error = out.get("error")
                    if logs:
                        log_text_parts.append("\n[Code interpreter logs]")
                        log_text_parts.append(logs.strip())
                    if error:
                        log_text_parts.append("\n[Code interpreter error]")
                        log_text_parts.append(error.strip())

        if log_text_parts:
             step_output += "\n".join(log_text_parts)

        if shell_executor_logs:
            try:
                log_payload = {
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "step_index": step_index,
                    "step_order": step_index + 1,
                    "step_name": step_name,
                    "model": step_model,
                    "logs": shell_executor_logs,
                }
                log_content = json.dumps(log_payload, indent=2)
                log_artifact_id = self.artifact_service.store_artifact(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    artifact_type="shell_executor_logs",
                    content=log_content,
                    filename=f"step_{step_index + 1}_{safe_step_name}_shell_executor_logs.json",
                )
                response_details["shell_logs_artifact_id"] = log_artifact_id
            except Exception as log_error:
                logger.warning(
                    "[AIStepProcessor] Failed to store shell executor logs artifact",
                    extra={
                        "job_id": job_id,
                        "step_index": step_index,
                        "error": str(log_error),
                    },
                    exc_info=True,
                )
        
        code_executor_logs = response_details.get("code_executor_logs")
        if code_executor_logs:
            try:
                log_payload = {
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "step_index": step_index,
                    "step_order": step_index + 1,
                    "step_name": step_name,
                    "model": step_model,
                    "logs": code_executor_logs,
                }
                log_content = json.dumps(log_payload, indent=2)
                log_artifact_id = self.artifact_service.store_artifact(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    artifact_type="code_executor_logs",
                    content=log_content,
                    filename=f"step_{step_index + 1}_{safe_step_name}_code_executor_logs.json",
                )
                response_details["code_executor_logs_artifact_id"] = log_artifact_id
            except Exception as log_error:
                logger.warning(
                    "[AIStepProcessor] Failed to store code executor logs artifact",
                    extra={
                        "job_id": job_id,
                        "step_index": step_index,
                        "error": str(log_error),
                    },
                    exc_info=True,
                )

        # Determine file extension based on content and step name
        file_ext = detect_content_type(step_output, step_name)
        
        # Store step output as artifact
        step_artifact_id = self.artifact_service.store_artifact(
            tenant_id=tenant_id,
            job_id=job_id,
            artifact_type='step_output',
            content=step_output,
            filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}{file_ext}'
        )
        
        # Extract and store image URLs
        image_urls = response_details.get('image_urls', [])
        logger.info("[AIStepProcessor] Extracting image URLs from response_details", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count_before': len(image_urls),
            'image_urls': image_urls,
            'image_urls_type': type(image_urls).__name__
        })
        
        image_artifact_ids = self.image_artifact_service.store_image_artifacts(
            image_urls=image_urls,
            tenant_id=tenant_id,
            job_id=job_id,
            step_index=step_index,
            step_name=step_name,
            step_instructions=step_instructions,
            context=current_step_context
        )
        
        logger.info("[AIStepProcessor] Image artifacts stored", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count': len(image_urls),
            'image_artifact_ids_count': len(image_artifact_ids),
            'image_artifact_ids': image_artifact_ids
        })
        
        # Store artifact ID in response_details for easy access
        response_details['artifact_id'] = step_artifact_id
        
        return step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id

