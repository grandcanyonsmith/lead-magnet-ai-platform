import logging
import json
from typing import Dict, Any, List, Optional, Tuple

from services.openai_client import OpenAIClient
from services.image_handler import ImageHandler

logger = logging.getLogger(__name__)

class ImageGenerator:
    """
    Handles image generation using the OpenAI Images API.
    """
    def __init__(self, openai_client: OpenAIClient, image_handler: ImageHandler):
        self.openai_client = openai_client
        self.image_handler = image_handler

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

        # Remove the image_generation tool from the planner call (Images API handles generation).
        planner_tools = [
            t for t in validated_tools
            if not (isinstance(t, dict) and t.get("type") == "image_generation")
        ]
        planner_tool_choice = tool_choice
        if planner_tool_choice == "required" and (not planner_tools or len(planner_tools) == 0):
            planner_tool_choice = "none"

        planner_instructions = (
            "You are generating prompts for an image model.\n"
            "Return STRICT JSON only (no markdown, no commentary) with this schema:\n"
            "{\n"
            "  \"images\": [\n"
            "    {\n"
            "      \"label\": \"short human label\",\n"
            "      \"prompt\": \"the full image prompt\"\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "Rules:\n"
            "- Output 1 to 12 images depending on what is requested.\n"
            "- Each prompt must be self-contained and include brand palette/style cues from the context.\n"
            "- If the step instructions describe multiple distinct images (e.g., logos, module thumbnails), create one prompt per image.\n"
        )

        planner_input = (
            f"Step Name: {step_name or 'N/A'}\n\n"
            f"Step Instructions:\n{step_instructions}\n\n"
            f"Context:\n{full_context}\n"
        )

        # Build planner params (Responses API) WITHOUT the image_generation tool.
        planner_params = self.openai_client.build_api_params(
            model=model,
            instructions=planner_instructions,
            input_text=planner_input,
            tools=planner_tools,
            tool_choice=planner_tool_choice,
            has_computer_use=has_computer_use,
            reasoning_level=None,
            previous_image_urls=None,
            job_id=job_id,
            tenant_id=tenant_id,
            reasoning_effort=reasoning_effort,
        )

        planner_response = self.openai_client.make_api_call(planner_params)
        planner_text, planner_usage, planner_request_details, planner_response_details = self.openai_client.process_api_response(
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

        # Parse the planner JSON (defensive substring extraction).
        plan_obj: Dict[str, Any] = {}
        try:
            plan_obj = json.loads(planner_text)
        except Exception:
            try:
                start = planner_text.find("{")
                end = planner_text.rfind("}")
                if start != -1 and end != -1 and end > start:
                    plan_obj = json.loads(planner_text[start : end + 1])
            except Exception:
                plan_obj = {}

        images_plan = plan_obj.get("images") if isinstance(plan_obj, dict) else None
        if not isinstance(images_plan, list) or len(images_plan) == 0:
            images_plan = [
                {
                    "label": step_name or "image",
                    "prompt": f"{step_instructions}\n\n{full_context}",
                }
            ]

        # Extract image-generation config
        img_size = image_tool.get("size", "auto")
        img_quality = image_tool.get("quality", "auto")
        img_background = image_tool.get("background")
        img_output_format = image_tool.get("format")
        img_output_compression = image_tool.get("compression")

        image_urls: List[str] = []
        images_output: List[Dict[str, Any]] = []

        for idx, item in enumerate(images_plan):
            if not isinstance(item, dict):
                continue
            prompt = item.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                continue
            label = item.get("label") if isinstance(item.get("label"), str) else f"image_{idx + 1}"

            img_resp = self.openai_client.generate_images(
                model=image_model,
                prompt=prompt,
                n=1,
                size=img_size,
                quality=img_quality,
                background=img_background,
                output_format=img_output_format,
                output_compression=img_output_compression,
                response_format="b64_json",
            )

            # Convert returned images to S3 URLs
            data_items = getattr(img_resp, "data", None) or []
            for data_idx, data_item in enumerate(data_items):
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
                    # Fallback: some responses may return a URL
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

        output_obj = {
            "image_model": image_model,
            "image_config": {
                "size": img_size,
                "quality": img_quality,
                "background": img_background,
                "format": img_output_format,
                "compression": img_output_compression,
            },
            "images": images_output,
        }
        output_text = json.dumps(output_obj, indent=2)

        # Build a step-shaped usage object (planner usage + image count metadata)
        usage_info = dict(planner_usage or {})
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
            "planner_request": planner_request_details,
        }

        response_details = {
            "output_text": output_text,
            "image_urls": image_urls,
            "model": model,
            "planner_response": planner_response_details,
        }

        logger.info("[ImageGenerator] Images API generation completed", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_urls_count': len(image_urls),
        })

        return output_text, usage_info, request_details, response_details

