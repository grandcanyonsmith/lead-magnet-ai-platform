"""
Report Generator
Handles the core logic for generating AI reports, including tool validation,
CUA loops, Shell loops, and standard OpenAI API interactions.
"""

import time
import os
from datetime import datetime
from typing import Optional, Dict, Tuple, List, Any

from core.logger import get_logger
from services.tools import ToolBuilder, ToolValidator
from services.openai_client import OpenAIClient
from services.cua_loop_service import CUALoopService
from services.tools.execution import ShellLoopService
from services.ai.image_generator import ImageGenerator
from services.image_handler import ImageHandler
from services.prompt_overrides import get_prompt_overrides
from services.tool_secrets import (
    append_tool_secrets,
    get_tool_secrets,
    redact_tool_secrets_text,
)
from utils.decimal_utils import convert_decimals_to_float
from cost_service import calculate_openai_cost

logger = get_logger(__name__)


class ReportGenerator:
    """Service for generating reports using OpenAI with tool support."""

    def __init__(
        self,
        openai_client: OpenAIClient,
        cua_loop_service: CUALoopService,
        shell_loop_service: ShellLoopService,
        image_generator: ImageGenerator,
        image_handler: ImageHandler,
        db_service: Optional[Any] = None,
    ):
        self.openai_client = openai_client
        self.cua_loop_service = cua_loop_service
        self.shell_loop_service = shell_loop_service
        self.image_generator = image_generator
        self.image_handler = image_handler
        self.db_service = db_service
        
        # State for streaming updates
        self._current_step_name: Optional[str] = None
        self._current_step_instructions: Optional[str] = None

    def set_step_context(self, step_name: Optional[str], step_instructions: Optional[str]):
        """Set context for current step being processed."""
        self._current_step_name = step_name
        self._current_step_instructions = step_instructions

    @staticmethod
    def _coerce_positive_int(value: Any) -> Optional[int]:
        try:
            parsed = int(value)
        except Exception:
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _read_positive_int_env(name: str, default: int) -> int:
        value = (os.environ.get(name) or "").strip()
        if not value:
            return default
        try:
            parsed = int(value)
        except Exception:
            return default
        return parsed if parsed > 0 else default

    @staticmethod
    def _read_optional_positive_int_env(name: str) -> Optional[int]:
        value = (os.environ.get(name) or "").strip()
        if not value:
            return None
        try:
            parsed = int(value)
        except Exception:
            return None
        return parsed if parsed > 0 else None

    def generate_report(
        self,
        model: str,
        instructions: str,
        context: str,
        previous_context: str = "",
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        output_format: Optional[Dict[str, Any]] = None,
        step_index: Optional[int] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        shell_settings: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate a report using OpenAI with configurable tools.
        
        Args:
            model: OpenAI model to use (e.g., 'gpt-5')
            instructions: System instructions for the AI
            context: User context/data to generate report from
            previous_context: Optional context from previous steps (accumulated)
            tools: List of tool dictionaries (e.g., [{"type": "web_search"}])
            tool_choice: How model should use tools - "auto", "required", or "none"
            tenant_id: Optional tenant ID for image storage context
            job_id: Optional job ID for image storage context
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            
        Returns:
            Tuple of (generated report content, usage info dict, request details dict, response details dict)
        """
        # Validate and filter tools (including model compatibility check)
        validated_tools, normalized_tool_choice = ToolValidator.validate_and_filter_tools(tools, tool_choice, model=model)
        
        # Normalize DynamoDB Decimal values to prevent JSON serialization errors
        if validated_tools:
            validated_tools = convert_decimals_to_float(validated_tools)
        
        logger.debug(f"[ReportGenerator] After tool validation", extra={
            'validated_tools_count': len(validated_tools) if validated_tools else 0,
            'validated_tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'normalized_tool_choice': normalized_tool_choice,
            'original_tool_choice': tool_choice
        })
        
        # Detect image_generation tool
        has_image_generation = ToolValidator.has_image_generation(validated_tools)
        
        # CRITICAL VALIDATION: Ensure tool_choice='required' never exists with empty tools
        if normalized_tool_choice == "required":
            if not validated_tools or len(validated_tools) == 0:
                logger.error("[ReportGenerator] CRITICAL: tool_choice='required' but validated_tools is empty!", extra={
                    'original_tool_choice': tool_choice,
                    'has_image_generation': has_image_generation,
                    'validated_tools_count': 0
                })
                raise ValueError("Invalid workflow configuration: tool_choice='required' but no valid tools available after validation. Please check your workflow step configuration and ensure at least one valid tool is included.")
        
        # Check if computer_use_preview is in tools (requires truncation="auto")
        has_computer_use = ToolValidator.has_computer_use(validated_tools)
        has_shell = any(
            isinstance(t, dict) and t.get("type") == "shell"
            for t in (validated_tools or [])
        )

        tool_secrets = get_tool_secrets(self.db_service, tenant_id)
        should_inject_tool_secrets = bool(tool_secrets) and (has_shell or has_computer_use)
        effective_instructions = (
            append_tool_secrets(instructions, tool_secrets)
            if should_inject_tool_secrets
            else instructions
        )

        requested_code_interpreter = any(
            (isinstance(t, dict) and t.get("type") == "code_interpreter")
            or t == "code_interpreter"
            for t in (validated_tools or [])
        )
        if requested_code_interpreter and has_computer_use:
            openai_container_label = (
                "OpenAI container: not used (code_interpreter incompatible with computer_use_preview)"
            )
        elif requested_code_interpreter:
            openai_container_label = (
                f"OpenAI container: code_interpreter ({ToolBuilder.DEFAULT_CODE_INTERPRETER_MEMORY_LIMIT} enforced)"
            )
        else:
            openai_container_label = "OpenAI container: not used"
        
        logger.info(f"[ReportGenerator] Generating report", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'step_index': step_index,
            'model': model,
            'tools_count': len(validated_tools) if validated_tools else 0,
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'tool_choice': normalized_tool_choice,
            'has_computer_use': has_computer_use,
            'has_image_generation': has_image_generation,
            'reasoning_effort': reasoning_effort,
            'service_tier': service_tier,
            'output_format_type': (output_format or {}).get('type') if isinstance(output_format, dict) else None,
            'instructions_length': len(instructions),
            'context_length': len(context),
            'previous_context_length': len(previous_context),
            'previous_image_urls_count': len(previous_image_urls) if previous_image_urls else 0
        })

        logger.info(f"[ReportGenerator] Runtime context: {openai_container_label}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'step_index': step_index,
            'has_computer_use': has_computer_use,
            'has_code_interpreter': requested_code_interpreter,
        })
        
        # Build input text
        input_text = OpenAIClient.build_input_text(context, previous_context)
        full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}" if previous_context else context

        # If image_generation is requested, and the configured image model is a gpt-image* model,
        # generate images via the Images API (not via the Responses API image_generation tool).
        if has_image_generation:
            image_tool = next(
                (
                    t
                    for t in (validated_tools or [])
                    if isinstance(t, dict) and t.get("type") == "image_generation"
                ),
                None,
            )
            image_model = (image_tool or {}).get("model") or "gpt-image-1.5"
            if isinstance(image_model, str) and image_model.startswith("gpt-image"):
                prompt_overrides = get_prompt_overrides(self.db_service, tenant_id)
                return self.image_generator.generate_images_via_api(
                    model=model,
                    image_model=image_model,
                    instructions=instructions,
                    context=context,
                    previous_context=previous_context,
                    input_text=input_text,
                    full_context=full_context,
                    validated_tools=validated_tools or [],
                    tool_choice=normalized_tool_choice,
                    has_computer_use=has_computer_use,
                    tenant_id=tenant_id,
                    job_id=job_id,
                    reasoning_effort=reasoning_effort,
                    image_tool=image_tool or {},
                    step_name=self._current_step_name,
                    step_instructions=self._current_step_instructions or instructions,
                    prompt_overrides=prompt_overrides,
                )
        
        # Check if we need to use CUA loop (computer-use-preview model with computer_use_preview tool)
        use_cua_loop = (
            has_computer_use and 
            (model == 'computer-use-preview' or 'computer-use' in model.lower())
        )
        
        if use_cua_loop:
            logger.info(f"[ReportGenerator] Using CUA loop for computer-use-preview", extra={
                'model': model,
                'has_computer_use': has_computer_use
            })
            logger.info(
                "[ReportGenerator] CUA runtime: max_iterations=100, max_duration_seconds=900",
                extra={'job_id': job_id, 'tenant_id': tenant_id, 'step_index': step_index},
            )
            
            try:
                # Build API parameters for CUA loop
                params = self.openai_client.build_api_params(
                    model=model,
                    instructions=effective_instructions,
                    input_text=input_text,
                    tools=validated_tools,
                    tool_choice=normalized_tool_choice,
                    has_computer_use=has_computer_use,
                    reasoning_level=None,
                    previous_image_urls=previous_image_urls if has_image_generation else None,
                    job_id=job_id,
                    tenant_id=tenant_id,
                    reasoning_effort=reasoning_effort,
                    service_tier=service_tier,
                    text_verbosity=text_verbosity,
                    max_output_tokens=max_output_tokens,
                    output_format=output_format,
                )
                
                # Run CUA loop
                final_report, screenshot_urls, cua_usage_info = self.cua_loop_service.run_cua_loop(
                    openai_client=self.openai_client,
                    model=model,
                    instructions=effective_instructions,
                    input_text=input_text,
                    tools=validated_tools,
                    tool_choice=normalized_tool_choice,
                    params=params,
                    max_iterations=100,
                    max_duration_seconds=900,
                    tenant_id=tenant_id,
                    job_id=job_id
                )
                
                cost_data = calculate_openai_cost(
                    model,
                    cua_usage_info.get('input_tokens', 0),
                    cua_usage_info.get('output_tokens', 0)
                )
                
                usage_info = {
                    'model': model,
                    'input_tokens': cua_usage_info.get('input_tokens', 0),
                    'output_tokens': cua_usage_info.get('output_tokens', 0),
                    'total_tokens': cua_usage_info.get('total_tokens', 0),
                    'cost_usd': cost_data['cost_usd'],
                    'service_type': 'openai_worker_report',
                }
                usage_info = convert_decimals_to_float(usage_info)
                
                # Build request details
                request_details = {
                    'model': model,
                    'instructions': redact_tool_secrets_text(effective_instructions),
                    'input': redact_tool_secrets_text(input_text),
                    'previous_context': previous_context,
                    'context': context,
                    'tools': validated_tools,
                    'tool_choice': normalized_tool_choice,
                    'truncation': params.get('truncation'),
                    'used_cua_loop': True,
                }
                
                # Build response details
                response_details = {
                    'output_text': final_report,
                    'image_urls': screenshot_urls,  # Screenshot URLs from CUA loop
                    'usage': {
                        'input_tokens': usage_info['input_tokens'],
                        'output_tokens': usage_info['output_tokens'],
                        'total_tokens': usage_info['total_tokens'],
                    },
                    'model': model,
                }
                
                logger.info(f"[ReportGenerator] CUA loop completed", extra={
                    'model': model,
                    'total_tokens': usage_info['total_tokens'],
                    'screenshots_captured': len(screenshot_urls),
                    'cost_usd': usage_info['cost_usd']
                })
                
                return final_report, usage_info, request_details, response_details
                
            except Exception as e:
                logger.error(f"[ReportGenerator] Error in CUA loop: {e}", exc_info=True)
                raise

        # Shell tool loop (developer-executed tool; OpenAI will return shell_call items until we respond)
        if has_shell:
            logger.info("[ReportGenerator] Using shell tool loop", extra={
                "model": model,
                "tool_choice": normalized_tool_choice,
            })

            try:
                shell_settings = shell_settings if isinstance(shell_settings, dict) else {}
                max_iterations = (
                    self._coerce_positive_int(shell_settings.get("max_iterations"))
                    or self._read_positive_int_env("SHELL_LOOP_MAX_ITERATIONS", 25)
                )
                max_duration_seconds = (
                    self._coerce_positive_int(shell_settings.get("max_duration_seconds"))
                    or self._read_positive_int_env("SHELL_LOOP_MAX_DURATION_SECONDS", 14 * 60)
                )
                default_command_timeout_ms = (
                    self._coerce_positive_int(shell_settings.get("command_timeout_ms"))
                    or self._read_optional_positive_int_env("SHELL_EXECUTOR_DEFAULT_TIMEOUT_MS")
                )
                default_command_max_output_length = (
                    self._coerce_positive_int(shell_settings.get("command_max_output_length"))
                    or self._read_positive_int_env("SHELL_EXECUTOR_DEFAULT_MAX_OUTPUT_LENGTH", 4096)
                )

                timeout_label = (
                    f"{default_command_timeout_ms}ms"
                    if default_command_timeout_ms
                    else "executor default"
                )
                max_output_label = (
                    str(default_command_max_output_length)
                    if default_command_max_output_length
                    else "4096"
                )
                logger.info(
                    "[ReportGenerator] Shell runtime: "
                    f"max_iterations={max_iterations}, "
                    f"max_duration_seconds={max_duration_seconds}, "
                    f"command_timeout_ms={timeout_label}, "
                    f"max_output_length={max_output_label}",
                    extra={
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "step_index": step_index,
                    "max_iterations": max_iterations,
                    "max_duration_seconds": max_duration_seconds,
                    "default_command_timeout_ms": default_command_timeout_ms,
                    "default_command_max_output_length": default_command_max_output_length,
                    "shell_settings_provided": bool(shell_settings),
                    },
                )

                step_order = (step_index + 1) if isinstance(step_index, int) else None
                live_step_enabled = (
                    self.db_service is not None
                    and isinstance(job_id, str)
                    and job_id.strip() != ""
                    and isinstance(step_order, int)
                    and step_order > 0
                )

                def live_step_callback(payload: Dict[str, Any]) -> None:
                    if not live_step_enabled:
                        return
                    try:
                        live_step: Dict[str, Any] = {
                            "step_order": step_order,
                            "output_text": payload.get("output_text", "") or "",
                            "updated_at": datetime.utcnow().isoformat(),
                            "status": payload.get("status", "streaming"),
                        }
                        if payload.get("truncated"):
                            live_step["truncated"] = True
                        if payload.get("error"):
                            live_step["error"] = payload.get("error")
                        self.db_service.update_job(job_id, {"live_step": live_step})
                    except Exception:
                        logger.debug("[ReportGenerator] Failed to persist shell live_step", exc_info=True)

                # Build initial API params (first request)
                params = self.openai_client.build_api_params(
                    model=model,
                    instructions=effective_instructions,
                    input_text=input_text,
                    tools=validated_tools,
                    tool_choice=normalized_tool_choice,
                    has_computer_use=False,
                    reasoning_level=None,
                    previous_image_urls=previous_image_urls if has_image_generation else None,
                    job_id=job_id,
                    tenant_id=tenant_id,
                    reasoning_effort=reasoning_effort,
                    text_verbosity=text_verbosity,
                    max_output_tokens=max_output_tokens,
                    service_tier=service_tier,
                    output_format=output_format,
                )

                shell_executor_logs: List[Dict[str, Any]] = []
                final_response = self.shell_loop_service.run_shell_loop(
                    openai_client=self.openai_client,
                    model=model,
                    instructions=effective_instructions,
                    input_text=input_text,
                    tools=validated_tools or [],
                    tool_choice=normalized_tool_choice,
                    params=params,
                    reasoning_effort=reasoning_effort,
                    text_verbosity=text_verbosity,
                    max_output_tokens=max_output_tokens,
                    service_tier=service_tier,
                    output_format=output_format,
                    max_iterations=max_iterations,
                    max_duration_seconds=max_duration_seconds,
                    default_command_timeout_ms=default_command_timeout_ms,
                    default_command_max_output_length=default_command_max_output_length,
                    tool_secrets_env=tool_secrets if should_inject_tool_secrets else None,
                    tenant_id=tenant_id,
                    job_id=job_id,
                    step_index=step_index,
                    shell_log_collector=shell_executor_logs,
                    live_step_callback=live_step_callback if live_step_enabled else None,
                )

                # Process final response
                content, usage_info, request_details, response_details = self.openai_client.process_api_response(
                    response=final_response,
                    model=model,
                    instructions=effective_instructions,
                    input_text=input_text,
                    previous_context=previous_context,
                    context=context,
                    tools=validated_tools or [],
                    tool_choice=normalized_tool_choice,
                    params=params,
                    image_handler=self.image_handler,
                    tenant_id=tenant_id,
                    job_id=job_id,
                    step_name=self._current_step_name,
                    step_instructions=self._current_step_instructions or instructions,
                )
                if shell_executor_logs:
                    response_details["shell_executor_logs"] = shell_executor_logs
                return content, usage_info, request_details, response_details

            except Exception as e:
                logger.error(f"[ReportGenerator] Error in shell loop: {e}", exc_info=True)
                raise
        
        # Regular API call flow (non-CUA)
        try:
            logger.debug(f"[ReportGenerator] About to build API params", extra={
                'model': model,
                'normalized_tool_choice': normalized_tool_choice,
                'validated_tools_count': len(validated_tools) if validated_tools else 0
            })
            
            params = self.openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                has_computer_use=has_computer_use,
                reasoning_level=None,
                previous_image_urls=previous_image_urls if has_image_generation else None,
                job_id=job_id,
                tenant_id=tenant_id,
                reasoning_effort=reasoning_effort,
                text_verbosity=text_verbosity,
                max_output_tokens=max_output_tokens,
                service_tier=service_tier,
                output_format=output_format,
            )
            
            logger.info(f"[ReportGenerator] Making OpenAI API call", extra={
                'model': model,
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice': params.get('tool_choice')
            })

            step_order = (step_index + 1) if isinstance(step_index, int) else None
            should_stream_live = (
                self.db_service is not None
                and isinstance(job_id, str)
                and job_id.strip() != ""
                and isinstance(step_order, int)
                and step_order > 0
                and not has_computer_use
                and not has_shell
                and self.openai_client.supports_responses()
            )

            if should_stream_live:
                logger.info("[ReportGenerator] Using streamed Responses API call", extra={
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "step_order": step_order,
                })
                response = self._make_streamed_call(job_id, step_order, params)
            else:
                response = self.openai_client.make_api_call(params)
            
            # Process response
            return self.openai_client.process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                params=params,
                image_handler=self.image_handler,
                tenant_id=tenant_id,
                job_id=job_id,
                step_name=self._current_step_name,
                step_instructions=self._current_step_instructions or instructions
            )
            
        except Exception as e:
            # Handle errors with retry logic
            return self.openai_client.handle_openai_error(
                error=e,
                model=model,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                instructions=instructions,
                context=context,
                full_context=full_context,
                previous_context=previous_context,
                image_handler=self.image_handler
            )

    def _make_streamed_call(self, job_id: str, step_order: int, params: Dict[str, Any]) -> Any:
        """
        Make a streamed API call and persist updates to DB.
        Returns the final accumulated response object.
        """
        logger.info("[ReportGenerator] Streaming Responses API output_text deltas", extra={
            "job_id": job_id,
            "step_order": step_order,
        })

        if not self.openai_client.supports_responses():
            logger.warning("[ReportGenerator] Responses API unavailable; falling back to non-streaming call", extra={
                "job_id": job_id,
                "step_order": step_order,
            })
            response = self.openai_client.make_api_call(params)
            output_text = getattr(response, "output_text", "") or ""
            if not output_text and hasattr(response, "choices") and response.choices:
                output_text = response.choices[0].message.content or ""
            if self.db_service:
                try:
                    self.db_service.update_job(job_id, {"live_step": {
                        "step_order": step_order,
                        "output_text": output_text,
                        "updated_at": datetime.utcnow().isoformat(),
                        "status": "final",
                    }})
                except Exception as persist_err:
                    logger.debug("[ReportGenerator] Failed to persist live_step (fallback)", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "error_type": type(persist_err).__name__,
                        "error_message": str(persist_err),
                    })
            return response
        # Persist a live preview of the current step output to DynamoDB for the frontend to poll.
        # This is best-effort and intentionally throttled to avoid excessive writes.
        max_chars = 100_000
        output_so_far = ""
        tool_log_so_far = ""
        last_persist_ts = 0.0
        last_persist_len = 0
        has_code_interpreter = False
        code_log_started = False
        code_delta_buffer = ""
        code_delta_flush_at = 0.0
        code_delta_flush_interval = 0.2

        def _truncate(text: str) -> Tuple[str, bool]:
            if len(text) <= max_chars:
                return text, False
            return text[-max_chars:], True

        def _compose_preview() -> str:
            if tool_log_so_far:
                if output_so_far:
                    return f"{output_so_far}\n\n[Tool output]\n{tool_log_so_far}"
                return tool_log_so_far
            return output_so_far

        def _get_attr(obj: Any, key: str) -> Any:
            if isinstance(obj, dict):
                return obj.get(key)
            return getattr(obj, key, None)

        def _persist(status: str = "streaming", error: Optional[str] = None, force: bool = False) -> None:
            nonlocal last_persist_ts, last_persist_len
            if not self.db_service:
                return
            preview_text = _compose_preview()
            now = time.time()
            if not force:
                if (now - last_persist_ts) < 0.5 and (len(preview_text) - last_persist_len) < 1024:
                    return
            last_persist_ts = now
            last_persist_len = len(preview_text)

            truncated_text, truncated = _truncate(preview_text)
            live_step: Dict[str, Any] = {
                "step_order": step_order,
                "output_text": truncated_text,
                "updated_at": datetime.utcnow().isoformat(),
                "status": status,
            }
            if truncated:
                live_step["truncated"] = True
            if error:
                live_step["error"] = error
            try:
                self.db_service.update_job(job_id, {"live_step": live_step})
            except Exception as persist_err:
                logger.debug("[ReportGenerator] Failed to persist live_step", extra={
                    "job_id": job_id,
                    "step_order": step_order,
                    "error_type": type(persist_err).__name__,
                    "error_message": str(persist_err),
                })

        _persist(status="streaming", force=True)

        def _is_incomplete_openai_stream_error(err: Exception) -> bool:
            try:
                msg = str(err) or ""
            except Exception:
                msg = ""
            lower = msg.lower()
            if "response.completed" in lower and ("didn't receive" in lower or "did not receive" in lower):
                return True
            if type(err).__name__ in ("APIConnectionError", "APITimeoutError", "ReadTimeout", "ConnectTimeout"):
                return True
            return False

        api_params = (
            self.openai_client._sanitize_api_params(params)
            if hasattr(self.openai_client, "_sanitize_api_params")
            else dict(params)
        )

        tools_param = api_params.get("tools")
        if isinstance(tools_param, list):
            for tool in tools_param:
                if isinstance(tool, dict) and tool.get("type") == "code_interpreter":
                    has_code_interpreter = True
                    break

        max_stream_attempts = 2
        for attempt in range(1, max_stream_attempts + 1):
            if attempt > 1:
                # Restart accumulation on retry to avoid duplicated output in the live preview.
                output_so_far = ""
                tool_log_so_far = ""
                code_log_started = False
                code_delta_buffer = ""
                code_delta_flush_at = 0.0
                _persist(status="retrying", error="Retrying OpenAI stream…", force=True)

            try:
                try:
                    responses_client = self.openai_client.client.responses
                    stream_fn = getattr(responses_client, "stream", None)
                    if not callable(stream_fn):
                        raise AttributeError("Responses API stream unavailable")
                except AttributeError as stream_err:
                    logger.warning("[ReportGenerator] Responses API unavailable during stream; falling back", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "error_message": str(stream_err),
                    })
                    response = self.openai_client.make_api_call(params)
                    output_so_far = getattr(response, "output_text", "") or output_so_far
                    _persist(status="final", force=True)
                    return response

                with stream_fn(**api_params) as stream:
                    for ev in stream:
                        ev_type = getattr(ev, "type", "") or ""
                        if ev_type == "response.output_text.delta":
                            delta = getattr(ev, "delta", "") or ""
                            if not delta:
                                continue
                            output_so_far += delta
                            _persist(status="streaming", force=False)
                            continue

                        if not has_code_interpreter:
                            continue

                        if ev_type == "response.code_interpreter_call_code.delta":
                            delta = getattr(ev, "delta", "") or ""
                            if not delta:
                                continue
                            if not code_log_started:
                                code_log_started = True
                                tool_log_so_far += "[Code interpreter]\n"
                            code_delta_buffer += delta
                            now = time.time()
                            should_flush = (
                                "\n" in code_delta_buffer
                                or len(code_delta_buffer) >= 160
                                or (now - code_delta_flush_at) >= code_delta_flush_interval
                            )
                            if should_flush:
                                tool_log_so_far += code_delta_buffer
                                code_delta_buffer = ""
                                code_delta_flush_at = now
                                _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call_code.done":
                            if code_delta_buffer:
                                tool_log_so_far += code_delta_buffer
                                code_delta_buffer = ""
                            tool_log_so_far += "\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call.in_progress":
                            tool_log_so_far += "\n[Code interpreter] preparing...\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call.interpreting":
                            tool_log_so_far += "\n[Code interpreter] running...\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call.completed":
                            tool_log_so_far += "\n[Code interpreter] completed.\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.output_item.added":
                            item = _get_attr(ev, "item")
                            item_type = _get_attr(item, "type")
                            if item_type == "code_interpreter_call":
                                tool_log_so_far += "\n[Code interpreter] call started.\n"
                                _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.output_item.done":
                            item = _get_attr(ev, "item")
                            item_type = _get_attr(item, "type")
                            if item_type != "code_interpreter_call":
                                continue
                            outputs = _get_attr(item, "outputs") or []
                            if isinstance(outputs, list):
                                for output in outputs:
                                    output_type = _get_attr(output, "type")
                                    if output_type == "logs":
                                        logs = _get_attr(output, "logs") or ""
                                        if logs:
                                            tool_log_so_far += "\n[Code interpreter logs]\n"
                                            tool_log_so_far += str(logs)
                                            if not str(logs).endswith("\n"):
                                                tool_log_so_far += "\n"
                                    elif output_type == "error":
                                        error_message = _get_attr(output, "error") or ""
                                        if error_message:
                                            tool_log_so_far += "\n[Code interpreter error]\n"
                                            tool_log_so_far += str(error_message)
                                            if not str(error_message).endswith("\n"):
                                                tool_log_so_far += "\n"
                            _persist(status="streaming", force=False)
                            continue
                    if code_delta_buffer:
                        tool_log_so_far += code_delta_buffer
                        code_delta_buffer = ""
                    response = stream.get_final_response()

                _persist(status="final", force=True)
                logger.info("[ReportGenerator] Stream complete", extra={
                    "job_id": job_id,
                    "step_order": step_order,
                    "output_chars": len(output_so_far),
                })
                return response

            except Exception as stream_err:
                if _is_incomplete_openai_stream_error(stream_err) and attempt < max_stream_attempts:
                    logger.warning("[ReportGenerator] Stream ended early; retrying", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "attempt": attempt,
                        "max_attempts": max_stream_attempts,
                        "error_type": type(stream_err).__name__,
                        "error_message": str(stream_err),
                    })
                    _persist(status="retrying", error=str(stream_err), force=True)
                    time.sleep(0.75 * attempt)
                    continue

                if _is_incomplete_openai_stream_error(stream_err):
                    # Last attempt: fall back to a non-streaming call to avoid failing the whole step.
                    logger.warning("[ReportGenerator] Stream ended early; falling back to non-streaming call", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "attempt": attempt,
                        "max_attempts": max_stream_attempts,
                        "error_type": type(stream_err).__name__,
                        "error_message": str(stream_err),
                    })
                    response = self.openai_client.client.responses.create(**api_params)
                    # Best-effort: persist the full output_text so the UI still shows the final result.
                    output_so_far = getattr(response, "output_text", "") or output_so_far
                    _persist(status="final", force=True)
                    return response

                _persist(status="error", error=str(stream_err), force=True)
                raise
