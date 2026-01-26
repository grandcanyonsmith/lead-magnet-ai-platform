import os
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

from core.logger import get_logger
from services.ai.report_context import ReportContext
from services.image_handler import ImageHandler
from services.openai_client import OpenAIClient
from services.tools.execution import ShellLoopService

logger = get_logger(__name__)

@dataclass(frozen=True)
class ShellLoopRuntimeConfig:
    max_iterations: int
    max_duration_seconds: int
    default_command_timeout_ms: Optional[int]
    default_command_max_output_length: Optional[int]


class ShellLoopStrategy:
    def __init__(
        self,
        openai_client: OpenAIClient,
        shell_loop_service: ShellLoopService,
        image_handler: ImageHandler,
        db_service: Optional[Any],
    ):
        self.openai_client = openai_client
        self.shell_loop_service = shell_loop_service
        self.image_handler = image_handler
        self.db_service = db_service

    def can_handle(self, ctx: ReportContext) -> bool:
        return ctx.has_shell

    def execute(self, ctx: ReportContext) -> Tuple[str, Dict, Dict, Dict]:
        logger.info("[ReportGenerator] Using shell tool loop", extra={
            "model": ctx.model,
            "tool_choice": ctx.normalized_tool_choice,
        })

        shell_settings = ctx.shell_settings if isinstance(ctx.shell_settings, dict) else {}
        runtime_config = self._resolve_runtime_config(shell_settings)
        self._log_shell_runtime(ctx, runtime_config, shell_settings)

        step_order = (ctx.step_index + 1) if isinstance(ctx.step_index, int) else None
        live_step_enabled = (
            self.db_service is not None
            and isinstance(ctx.job_id, str)
            and ctx.job_id.strip() != ""
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
                self.db_service.update_job(ctx.job_id, {"live_step": live_step})
            except Exception:
                logger.debug("[ReportGenerator] Failed to persist shell live_step", exc_info=True)

        params = self.openai_client.build_api_params(
            model=ctx.model,
            instructions=ctx.effective_instructions,
            input_text=ctx.input_text,
            tools=ctx.validated_tools,
            tool_choice=ctx.normalized_tool_choice,
            has_computer_use=False,
            reasoning_level=None,
            previous_image_urls=ctx.previous_image_urls if ctx.has_image_generation else None,
            job_id=ctx.job_id,
            tenant_id=ctx.tenant_id,
            reasoning_effort=ctx.reasoning_effort,
            text_verbosity=ctx.text_verbosity,
            max_output_tokens=ctx.max_output_tokens,
            service_tier=ctx.service_tier,
            output_format=ctx.output_format,
        )

        shell_executor_logs: List[Dict[str, Any]] = []
        final_response = self.shell_loop_service.run_shell_loop(
            openai_client=self.openai_client,
            model=ctx.model,
            instructions=ctx.effective_instructions,
            input_text=ctx.input_text,
            tools=ctx.validated_tools or [],
            tool_choice=ctx.normalized_tool_choice,
            params=params,
            reasoning_effort=ctx.reasoning_effort,
            text_verbosity=ctx.text_verbosity,
            max_output_tokens=ctx.max_output_tokens,
            service_tier=ctx.service_tier,
            output_format=ctx.output_format,
            max_iterations=runtime_config.max_iterations,
            max_duration_seconds=runtime_config.max_duration_seconds,
            default_command_timeout_ms=runtime_config.default_command_timeout_ms,
            default_command_max_output_length=runtime_config.default_command_max_output_length,
            tool_secrets_env=ctx.tool_secrets if ctx.should_inject_tool_secrets else None,
            tenant_id=ctx.tenant_id,
            job_id=ctx.job_id,
            step_index=ctx.step_index,
            shell_log_collector=shell_executor_logs,
            live_step_callback=live_step_callback if live_step_enabled else None,
        )

        content, usage_info, request_details, response_details = self.openai_client.process_api_response(
            response=final_response,
            model=ctx.model,
            instructions=ctx.effective_instructions,
            input_text=ctx.input_text,
            previous_context=ctx.previous_context,
            context=ctx.context,
            tools=ctx.validated_tools or [],
            tool_choice=ctx.normalized_tool_choice,
            params=params,
            image_handler=self.image_handler,
            tenant_id=ctx.tenant_id,
            job_id=ctx.job_id,
            step_name=ctx.step_name,
            step_instructions=ctx.step_instructions,
        )
        if shell_executor_logs:
            response_details["shell_executor_logs"] = shell_executor_logs
        return content, usage_info, request_details, response_details

    @classmethod
    def _resolve_runtime_config(cls, shell_settings: Dict[str, Any]) -> ShellLoopRuntimeConfig:
        max_iterations = (
            cls._coerce_positive_int(shell_settings.get("max_iterations"))
            or cls._read_positive_int_env("SHELL_LOOP_MAX_ITERATIONS", 25)
        )
        max_duration_seconds = (
            cls._coerce_positive_int(shell_settings.get("max_duration_seconds"))
            or cls._read_positive_int_env("SHELL_LOOP_MAX_DURATION_SECONDS", 14 * 60)
        )
        default_command_timeout_ms = (
            cls._coerce_positive_int(shell_settings.get("command_timeout_ms"))
            or cls._read_optional_positive_int_env("SHELL_EXECUTOR_DEFAULT_TIMEOUT_MS")
        )
        default_command_max_output_length = (
            cls._coerce_positive_int(shell_settings.get("command_max_output_length"))
            or cls._read_positive_int_env("SHELL_EXECUTOR_DEFAULT_MAX_OUTPUT_LENGTH", 4096)
        )
        return ShellLoopRuntimeConfig(
            max_iterations=max_iterations,
            max_duration_seconds=max_duration_seconds,
            default_command_timeout_ms=default_command_timeout_ms,
            default_command_max_output_length=default_command_max_output_length,
        )

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

    @staticmethod
    def _log_shell_runtime(
        ctx: ReportContext,
        runtime_config: ShellLoopRuntimeConfig,
        shell_settings: Dict[str, Any],
    ) -> None:
        timeout_label = (
            f"{runtime_config.default_command_timeout_ms}ms"
            if runtime_config.default_command_timeout_ms
            else "executor default"
        )
        max_output_label = (
            str(runtime_config.default_command_max_output_length)
            if runtime_config.default_command_max_output_length
            else "4096"
        )
        logger.info(
            "[ReportGenerator] Shell runtime: "
            f"max_iterations={runtime_config.max_iterations}, "
            f"max_duration_seconds={runtime_config.max_duration_seconds}, "
            f"command_timeout_ms={timeout_label}, "
            f"max_output_length={max_output_label}",
            extra={
                "job_id": ctx.job_id,
                "tenant_id": ctx.tenant_id,
                "step_index": ctx.step_index,
                "max_iterations": runtime_config.max_iterations,
                "max_duration_seconds": runtime_config.max_duration_seconds,
                "default_command_timeout_ms": runtime_config.default_command_timeout_ms,
                "default_command_max_output_length": runtime_config.default_command_max_output_length,
                "shell_settings_provided": bool(shell_settings),
            },
        )
