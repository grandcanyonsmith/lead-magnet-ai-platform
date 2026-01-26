from typing import Optional, Dict, Any, Tuple
from services.ai.image_generator import ImageGenerator
from services.ai.report_context import ReportContext
from services.prompt_overrides import get_prompt_overrides

class ImageGenerationStrategy:
    def __init__(self, image_generator: ImageGenerator, db_service: Optional[Any]):
        self.image_generator = image_generator
        self.db_service = db_service

    def can_handle(self, ctx: ReportContext) -> bool:
        if not ctx.has_image_generation:
            return False
        _, image_model = self._resolve_image_tool(ctx)
        return isinstance(image_model, str) and image_model.startswith("gpt-image")

    def execute(self, ctx: ReportContext) -> Tuple[str, Dict, Dict, Dict]:
        image_tool, image_model = self._resolve_image_tool(ctx)
        prompt_overrides = get_prompt_overrides(self.db_service, ctx.tenant_id)
        return self.image_generator.generate_images_via_api(
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
        )

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
