import logging
import json
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Tuple

from services.openai_client import OpenAIClient
from services.image_handler import ImageHandler
from services.prompt_overrides import resolve_prompt_override
from core.prompts import PROMPT_CONFIGS, IMAGE_PROMPT_PLANNER_INSTRUCTIONS, IMAGE_PROMPT_PLANNER_INPUT_TEMPLATE

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImagePlanItem:
    label: str
    prompt: str


@dataclass(frozen=True)
class ImagePlanResult:
    images: List[ImagePlanItem]
    planner_usage: Dict[str, Any]
    planner_request_details: Dict[str, Any]
    planner_response_details: Dict[str, Any]


@dataclass(frozen=True)
class ImageGenerationConfig:
    size: str
    quality: str
    background: Optional[str]
    output_format: Optional[str]
    output_compression: Optional[Any]


class ImagePromptPlanner:
    def __init__(self, openai_client: OpenAIClient, image_handler: ImageHandler):
        self.openai_client = openai_client
        self.image_handler = image_handler

    def plan(
        self,
        *,
        model: str,
        context: str,
        previous_context: str,
        full_context: str,
        validated_tools: List[Dict[str, Any]],
        tool_choice: str,
        tenant_id: Optional[str],
        job_id: Optional[str],
        step_name: Optional[str],
        step_instructions: str,
        prompt_overrides: Optional[Dict[str, Any]] = None,
    ) -> ImagePlanResult:
        planner_tools = [
            t
            for t in validated_tools
            if not (
                isinstance(t, dict)
                and t.get("type") in ("image_generation", "computer_use_preview", "computer_use")
            )
        ]
        planner_tool_choice = tool_choice
        if planner_tool_choice == "required" and (not planner_tools or len(planner_tools) == 0):
            planner_tool_choice = "none"

        planner_instructions = IMAGE_PROMPT_PLANNER_INSTRUCTIONS
        planner_input = IMAGE_PROMPT_PLANNER_INPUT_TEMPLATE.format(
            step_name=step_name or "N/A",
            step_instructions=step_instructions,
            full_context=full_context,
        )

        defaults = PROMPT_CONFIGS["image_prompt_planner"].copy()
        defaults.update({
            "instructions": planner_instructions,
            "prompt": planner_input,
            "model": model or defaults.get("model", "gpt-5.2"),
        })

        resolved = resolve_prompt_override(
            key="image_prompt_planner",
            defaults=defaults,
            overrides=prompt_overrides,
            variables={
                "step_name": step_name,
                "step_instructions": step_instructions,
                "full_context": full_context,
                "context": context,
                "previous_context": previous_context,
                "planner_input": planner_input,
            },
        )
        planner_instructions = resolved.get("instructions")
        planner_input = resolved.get("prompt")
        resolved_model = resolved.get("model")
        service_tier = resolved.get("service_tier")
        reasoning_effort = resolved.get("reasoning_effort")

        planner_params = self.openai_client.build_api_params(
            model=resolved_model,
            instructions=planner_instructions,
            input_text=planner_input,
            tools=planner_tools,
            tool_choice=planner_tool_choice,
            has_computer_use=False,
            reasoning_level=None,
            previous_image_urls=None,
            job_id=job_id,
            tenant_id=tenant_id,
            reasoning_effort=reasoning_effort,
            service_tier=service_tier,
        )

        planner_response = self.openai_client.make_api_call(planner_params)
        planner_text, planner_usage, planner_request_details, planner_response_details = (
            self.openai_client.process_api_response(
                response=planner_response,
                model=model,
                instructions=planner_instructions,
                input_text=planner_input,
                previous_context=previous_context,
                context=context,
                tools=planner_tools,
                tool_choice=planner_tool_choice,
                params=planner_params,
                image_handler=self.image_handler,
                tenant_id=tenant_id,
                job_id=job_id,
                step_name=step_name,
                step_instructions=step_instructions,
            )
        )

        images_plan = self._parse_plan(
            planner_text=planner_text,
            step_name=step_name,
            step_instructions=step_instructions,
            full_context=full_context,
            job_id=job_id,
            tenant_id=tenant_id,
        )

        return ImagePlanResult(
            images=images_plan,
            planner_usage=dict(planner_usage or {}),
            planner_request_details=planner_request_details,
            planner_response_details=planner_response_details,
        )

    @classmethod
    def _parse_plan(
        cls,
        *,
        planner_text: str,
        step_name: Optional[str],
        step_instructions: str,
        full_context: str,
        job_id: Optional[str],
        tenant_id: Optional[str],
    ) -> List[ImagePlanItem]:
        plan_obj = cls._parse_json_object(planner_text)
        raw_images_plan = plan_obj.get("images") if isinstance(plan_obj, dict) else None
        normalized_plan = cls._normalize_plan(raw_images_plan)

        if not normalized_plan:
            fallback_prompt = f"{step_instructions}\n\n{full_context}".strip()
            if not fallback_prompt:
                fallback_prompt = "Generate an image that matches the requested subject."
            logger.warning(
                "[ImageGenerator] Planner returned no valid prompts; using fallback prompt",
                extra={
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "step_name": step_name,
                },
            )
            normalized_plan = [
                ImagePlanItem(label=step_name or "image", prompt=fallback_prompt)
            ]

        return normalized_plan

    @staticmethod
    def _normalize_plan(raw_images_plan: Any) -> List[ImagePlanItem]:
        normalized_plan: List[ImagePlanItem] = []
        if isinstance(raw_images_plan, list):
            for item in raw_images_plan:
                if not isinstance(item, dict):
                    continue
                prompt = item.get("prompt")
                if not isinstance(prompt, str) or not prompt.strip():
                    continue
                label = item.get("label")
                if not isinstance(label, str) or not label.strip():
                    label = f"image_{len(normalized_plan) + 1}"
                normalized_plan.append(
                    ImagePlanItem(label=label.strip(), prompt=prompt.strip())
                )
        return normalized_plan

    @staticmethod
    def _parse_json_object(text: str) -> Dict[str, Any]:
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        decoder = json.JSONDecoder()
        for idx, ch in enumerate(text or ""):
            if ch != "{":
                continue
            try:
                parsed, _ = decoder.raw_decode(text[idx:])
            except Exception:
                continue
            if isinstance(parsed, dict):
                return parsed
        return {}


class ImagesApiRunner:
    def __init__(self, openai_client: OpenAIClient, image_handler: ImageHandler):
        self.openai_client = openai_client
        self.image_handler = image_handler

    def generate_images(
        self,
        *,
        image_model: str,
        plan: List[ImagePlanItem],
        config: ImageGenerationConfig,
        tenant_id: Optional[str],
        job_id: Optional[str],
        full_context: str,
        step_name: Optional[str],
        step_instructions: str,
    ) -> Tuple[List[str], List[Dict[str, Any]]]:
        image_urls: List[str] = []
        images_output: List[Dict[str, Any]] = []

        for plan_item in plan:
            prompt = plan_item.prompt
            if not isinstance(prompt, str) or not prompt.strip():
                continue
            label = plan_item.label

            img_resp = self.openai_client.generate_images(
                model=image_model,
                prompt=prompt,
                n=1,
                size=config.size,
                quality=config.quality,
                background=config.background,
                output_format=config.output_format,
                output_compression=config.output_compression,
                response_format="b64_json",
            )

            data_items = getattr(img_resp, "data", None) or []
            for data_item in data_items:
                b64 = None
                if isinstance(data_item, dict):
                    b64 = data_item.get("b64_json")
                else:
                    b64 = getattr(data_item, "b64_json", None)

                url = None
                if b64 and tenant_id and job_id:
                    url = self.image_handler.upload_base64_image_to_s3(
                        image_b64=b64,
                        content_type="image/png",
                        tenant_id=tenant_id,
                        job_id=job_id,
                        filename=None,
                        context=full_context,
                        step_name=step_name,
                        step_instructions=step_instructions,
                        image_index=len(image_urls),
                    )
                else:
                    if isinstance(data_item, dict):
                        url = data_item.get("url")
                    else:
                        url = getattr(data_item, "url", None)

                if url:
                    image_urls.append(url)
                    images_output.append(
                        {
                            "label": label,
                            "prompt": prompt,
                            "url": url,
                        }
                    )

        return image_urls, images_output

class ImageGenerator:
    """
    Handles image generation using the OpenAI Images API.
    """
    def __init__(self, openai_client: OpenAIClient, image_handler: ImageHandler):
        self.openai_client = openai_client
        self.image_handler = image_handler
        self.prompt_planner = ImagePromptPlanner(openai_client, image_handler)
        self.images_runner = ImagesApiRunner(openai_client, image_handler)

    def generate_images_via_api(
        self,
        *,
        model: str,
        image_model: str,
        instructions: str,
        context: str,
        previous_context: str,
        input_text: str,
        full_context: str,
        validated_tools: List[Dict[str, Any]],
        tool_choice: str,
        has_computer_use: bool,
        tenant_id: Optional[str],
        job_id: Optional[str],
        reasoning_effort: Optional[str],
        image_tool: Dict[str, Any],
        step_name: Optional[str],
        step_instructions: str,
        prompt_overrides: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Image-generation path using the Images API.

        We first ask the step's main model to produce a JSON "image plan" (prompts + labels),
        optionally using non-image tools like web_search. Then we call Images API for each prompt
        using the configured gpt-image* model, upload results to S3, and return image URLs.
        """
        logger.info("[ImageGenerator] Using Images API for image_generation", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'planner_model': model,
            'image_model': image_model,
            'tool_choice': tool_choice,
        })

        plan_result = self.prompt_planner.plan(
            model=model,
            context=context,
            previous_context=previous_context,
            full_context=full_context,
            validated_tools=validated_tools,
            tool_choice=tool_choice,
            tenant_id=tenant_id,
            job_id=job_id,
            step_name=step_name,
            step_instructions=step_instructions,
            prompt_overrides=prompt_overrides,
        )

        generation_config = ImageGenerationConfig(
            size=image_tool.get("size", "auto"),
            quality=image_tool.get("quality", "auto"),
            background=image_tool.get("background"),
            output_format=image_tool.get("format"),
            output_compression=image_tool.get("compression"),
        )

        image_urls, images_output = self.images_runner.generate_images(
            image_model=image_model,
            plan=plan_result.images,
            config=generation_config,
            tenant_id=tenant_id,
            job_id=job_id,
            full_context=full_context,
            step_name=step_name,
            step_instructions=step_instructions,
        )

        output_obj = {
            "image_model": image_model,
            "image_config": {
                "size": generation_config.size,
                "quality": generation_config.quality,
                "background": generation_config.background,
                "format": generation_config.output_format,
                "compression": generation_config.output_compression,
            },
            "images": images_output,
        }
        output_text = json.dumps(output_obj, indent=2)

        # Build a step-shaped usage object (planner usage + image count metadata)
        usage_info = dict(plan_result.planner_usage or {})
        usage_info["image_model"] = image_model
        usage_info["images_generated"] = len(image_urls)
        usage_info["service_type"] = "openai_worker_image_generation"

        request_details = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
            "previous_context": previous_context,
            "context": context,
            "tools": validated_tools,
            "tool_choice": tool_choice,
            "planner_request": plan_result.planner_request_details,
        }

        response_details = {
            "output_text": output_text,
            "image_urls": image_urls,
            "model": model,
            "planner_response": plan_result.planner_response_details,
        }

        logger.info("[ImageGenerator] Images API generation completed", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_urls_count': len(image_urls),
        })

        return output_text, usage_info, request_details, response_details

