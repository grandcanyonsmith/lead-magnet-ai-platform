from typing import Dict, Tuple
from core.logger import get_logger
from cost_service import calculate_openai_cost
from services.ai.report_context import ReportContext
from services.cua_loop_service import CUALoopService
from services.openai_client import OpenAIClient
from services.tool_secrets import redact_tool_secrets_text
from utils.decimal_utils import convert_decimals_to_float

logger = get_logger(__name__)

class CUALoopStrategy:
    def __init__(self, openai_client: OpenAIClient, cua_loop_service: CUALoopService):
        self.openai_client = openai_client
        self.cua_loop_service = cua_loop_service

    def can_handle(self, ctx: ReportContext) -> bool:
        return ctx.has_computer_use and (
            ctx.model == "computer-use-preview" or "computer-use" in ctx.model.lower()
        )

    def execute(self, ctx: ReportContext) -> Tuple[str, Dict, Dict, Dict]:
        logger.info("[ReportGenerator] Using CUA loop for computer-use-preview", extra={
            "model": ctx.model,
            "has_computer_use": ctx.has_computer_use,
        })
        logger.info(
            "[ReportGenerator] CUA runtime: max_iterations=100, max_duration_seconds=900",
            extra={"job_id": ctx.job_id, "tenant_id": ctx.tenant_id, "step_index": ctx.step_index},
        )

        params = self.openai_client.build_api_params(
            model=ctx.model,
            instructions=ctx.effective_instructions,
            input_text=ctx.input_text,
            tools=ctx.validated_tools,
            tool_choice=ctx.normalized_tool_choice,
            has_computer_use=ctx.has_computer_use,
            reasoning_level=None,
            previous_image_urls=ctx.previous_image_urls if ctx.has_image_generation else None,
            job_id=ctx.job_id,
            tenant_id=ctx.tenant_id,
            reasoning_effort=ctx.reasoning_effort,
            service_tier=ctx.service_tier,
            text_verbosity=ctx.text_verbosity,
            max_output_tokens=ctx.max_output_tokens,
            output_format=ctx.output_format,
        )

        final_report, screenshot_urls, cua_usage_info = self.cua_loop_service.run_cua_loop(
            openai_client=self.openai_client,
            model=ctx.model,
            instructions=ctx.effective_instructions,
            input_text=ctx.input_text,
            tools=ctx.validated_tools,
            tool_choice=ctx.normalized_tool_choice,
            params=params,
            max_iterations=100,
            max_duration_seconds=900,
            tenant_id=ctx.tenant_id,
            job_id=ctx.job_id,
        )

        cost_data = calculate_openai_cost(
            ctx.model,
            cua_usage_info.get("input_tokens", 0),
            cua_usage_info.get("output_tokens", 0),
        )

        usage_info = {
            "model": ctx.model,
            "input_tokens": cua_usage_info.get("input_tokens", 0),
            "output_tokens": cua_usage_info.get("output_tokens", 0),
            "total_tokens": cua_usage_info.get("total_tokens", 0),
            "cost_usd": cost_data["cost_usd"],
            "service_type": "openai_worker_report",
        }
        usage_info = convert_decimals_to_float(usage_info)

        request_details = {
            "model": ctx.model,
            "instructions": redact_tool_secrets_text(ctx.effective_instructions),
            "input": redact_tool_secrets_text(ctx.input_text),
            "previous_context": ctx.previous_context,
            "context": ctx.context,
            "tools": ctx.validated_tools,
            "tool_choice": ctx.normalized_tool_choice,
            "truncation": params.get("truncation"),
            "used_cua_loop": True,
        }

        response_details = {
            "output_text": final_report,
            "image_urls": screenshot_urls,
            "usage": {
                "input_tokens": usage_info["input_tokens"],
                "output_tokens": usage_info["output_tokens"],
                "total_tokens": usage_info["total_tokens"],
            },
            "model": ctx.model,
        }

        logger.info("[ReportGenerator] CUA loop completed", extra={
            "model": ctx.model,
            "total_tokens": usage_info["total_tokens"],
            "screenshots_captured": len(screenshot_urls),
            "cost_usd": usage_info["cost_usd"],
        })

        return final_report, usage_info, request_details, response_details
