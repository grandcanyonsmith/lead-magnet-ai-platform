import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List
from services.ai.image_generator import ImageGenerator
from services.ai.report_context import ReportContext
from services.prompt_overrides import get_prompt_overrides

logger = logging.getLogger(__name__)

class ImageGenerationStrategy:
    def __init__(self, image_generator: ImageGenerator, db_service: Optional[Any]):
        self.image_generator = image_generator
        self.db_service = db_service

    def can_handle(self, ctx: ReportContext) -> bool:
        if not ctx.has_image_generation:
            return False
        _, image_model = self._resolve_image_tool(ctx)
        return isinstance(image_model, str) and image_model.startswith("gpt-image")

    def _persist_live_step(
        self,
        *,
        job_id: Optional[str],
        step_order: Optional[int],
        output_text: str,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        if not self.db_service or not job_id or not isinstance(step_order, int):
            return

        live_step: Dict[str, Any] = {
            "step_order": step_order,
            "output_text": output_text,
            "updated_at": datetime.utcnow().isoformat(),
            "status": status,
        }
        if error:
            live_step["error"] = error

        try:
            self.db_service.update_job(job_id, {"live_step": live_step})
        except Exception:
            logger.debug(
                "[ImageGenerationStrategy] Failed to persist live_step",
                exc_info=True,
            )

    def execute(self, ctx: ReportContext) -> Tuple[str, Dict, Dict, Dict]:
        image_tool, image_model = self._resolve_image_tool(ctx)
        prompt_overrides = get_prompt_overrides(self.db_service, ctx.tenant_id)

        step_order = (ctx.step_index + 1) if isinstance(ctx.step_index, int) else None
        live_progress: List[str] = []

        def record_progress(message: str, status: str = "streaming") -> None:
            if not message:
                return
            live_progress.append(message)
            self._persist_live_step(
                job_id=ctx.job_id,
                step_order=step_order,
                output_text="\n".join(live_progress),
                status=status,
            )

        try:
            output_text, usage_info, request_details, response_details = (
                self.image_generator.generate_images_via_api(
                    model=ctx.model,
                    image_model=image_model,
                    instructions=ctx.instructions,
                    context=ctx.context,
                    previous_context=ctx.previous_context,
                    input_text=ctx.input_text,
                    full_context=ctx.full_context,
                    validated_tools=ctx.validated_tools or [],
                    tool_choice=ctx.normalized_tool_choice,
                    has_computer_use=ctx.has_computer_use,
                    tenant_id=ctx.tenant_id,
                    job_id=ctx.job_id,
                    reasoning_effort=ctx.reasoning_effort,
                    image_tool=image_tool or {},
                    step_name=ctx.step_name,
                    step_instructions=ctx.step_instructions,
                    prompt_overrides=prompt_overrides,
                    progress_callback=record_progress,
                )
            )
            self._persist_live_step(
                job_id=ctx.job_id,
                step_order=step_order,
                output_text=output_text,
                status="final",
            )
            return output_text, usage_info, request_details, response_details
        except Exception as error:
            self._persist_live_step(
                job_id=ctx.job_id,
                step_order=step_order,
                output_text="\n".join(live_progress) or f"Image generation failed: {error}",
                status="error",
                error=str(error),
            )
            raise

    @staticmethod
    def _resolve_image_tool(ctx: ReportContext) -> Tuple[Optional[Dict[str, Any]], str]:
        image_tool = next(
            (
                t
                for t in (ctx.validated_tools or [])
                if isinstance(t, dict) and t.get("type") == "image_generation"
            ),
            None,
        )
        image_model = (image_tool or {}).get("model") or "gpt-image-1.5"
        return image_tool, image_model
