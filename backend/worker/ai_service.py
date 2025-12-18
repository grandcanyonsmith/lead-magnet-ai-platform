"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

import logging
import json
from typing import Optional, Dict, Tuple, List, Any

from s3_service import S3Service
from services.tool_validator import ToolValidator
from services.image_handler import ImageHandler
from services.html_generator import HTMLGenerator
from services.openai_client import OpenAIClient
from services.cua_loop_service import CUALoopService
from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered content generation."""
    
    def __init__(self):
        """Initialize services."""
        self.s3_service = S3Service()
        self.openai_client = OpenAIClient()
        self.image_handler = ImageHandler(self.s3_service)
        self.html_generator = HTMLGenerator(self.openai_client)
        self.cua_loop_service = CUALoopService(self.image_handler)
    
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
        
        logger.debug(f"[AI Service] After tool validation", extra={
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
                logger.error("[AI Service] CRITICAL: tool_choice='required' but validated_tools is empty!", extra={
                    'original_tool_choice': tool_choice,
                    'has_image_generation': has_image_generation,
                    'validated_tools_count': 0
                })
                raise ValueError("Invalid workflow configuration: tool_choice='required' but no valid tools available after validation. Please check your workflow step configuration and ensure at least one valid tool is included.")
        
        # Check if computer_use_preview is in tools (requires truncation="auto")
        has_computer_use = ToolValidator.has_computer_use(validated_tools)
        
        logger.info(f"[AI Service] Generating report", extra={
            'model': model,
            'tools_count': len(validated_tools) if validated_tools else 0,
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'tool_choice': normalized_tool_choice,
            'has_computer_use': has_computer_use,
            'has_image_generation': has_image_generation,
            'reasoning_effort': reasoning_effort,
            'instructions_length': len(instructions),
            'context_length': len(context),
            'previous_context_length': len(previous_context),
            'previous_image_urls_count': len(previous_image_urls) if previous_image_urls else 0
        })
        
        # Build input text
        input_text = OpenAIClient.build_input_text(context, previous_context)
        full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}" if previous_context else context

        # If image_generation is requested, and the configured image model is a gpt-image* model,
        # generate images via the Images API (not via the Responses API image_generation tool).
        #
        # The Responses API tool pathway does not support all image models.
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
                return self._generate_images_via_images_api(
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
                    step_name=getattr(self, "_current_step_name", None),
                    step_instructions=getattr(self, "_current_step_instructions", None) or instructions,
                )
        
        # Check if we need to use CUA loop (computer-use-preview model with computer_use_preview tool)
        use_cua_loop = (
            has_computer_use and 
            (model == 'computer-use-preview' or 'computer-use' in model.lower())
        )
        
        if use_cua_loop:
            logger.info(f"[AI Service] Using CUA loop for computer-use-preview", extra={
                'model': model,
                'has_computer_use': has_computer_use
            })
            
            try:
                # Build API parameters for CUA loop
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
                )
                
                # Run CUA loop
                final_report, screenshot_urls, cua_usage_info = self.cua_loop_service.run_cua_loop(
                    openai_client=self.openai_client,
                    model=model,
                    instructions=instructions,
                    input_text=input_text,
                    tools=validated_tools,
                    tool_choice=normalized_tool_choice,
                    params=params,
                    max_iterations=50,
                    max_duration_seconds=300,
                    tenant_id=tenant_id,
                    job_id=job_id
                )
                
                # Build usage info from CUA loop
                from cost_service import calculate_openai_cost
                
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
                    'instructions': instructions,
                    'input': input_text,
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
                
                logger.info(f"[AI Service] CUA loop completed", extra={
                    'model': model,
                    'total_tokens': usage_info['total_tokens'],
                    'screenshots_captured': len(screenshot_urls),
                    'cost_usd': usage_info['cost_usd']
                })
                
                return final_report, usage_info, request_details, response_details
                
            except Exception as e:
                logger.error(f"[AI Service] Error in CUA loop: {e}", exc_info=True)
                # Fall through to regular error handling
                raise
        
        # Regular API call flow (non-CUA)
        try:
            # Build API parameters
            # NOTE: reasoning_level is deprecated; OpenAIClient applies supported reasoning/service_tier controls internally.
            logger.debug(f"[AI Service] About to build API params", extra={
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
            )
            
            logger.debug(f"[AI Service] API params built successfully", extra={
                'params_keys': list(params.keys()),
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice_value': params.get('tool_choice')
            })
            
            # Make API call
            logger.info(f"[AI Service] Making OpenAI API call", extra={
                'model': model,
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice': params.get('tool_choice')
            })
            
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
                step_name=getattr(self, '_current_step_name', None),
                step_instructions=getattr(self, '_current_step_instructions', None) or instructions
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

    def _generate_images_via_images_api(
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
        logger.info("[AI Service] Using Images API for image_generation", extra={
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

        logger.info("[AI Service] Images API generation completed", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_urls_count': len(image_urls),
        })

        return output_text, usage_info, request_details, response_details
    
    def generate_html_from_submission(
        self,
        submission_data: dict,
        template_html: str,
        template_style: str = '',
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate HTML document directly from submission data and template.
        
        Takes submission data and generates HTML styled to match the template.
        
        Args:
            submission_data: Form submission data
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        return self.html_generator.generate_html_from_submission(
            submission_data=submission_data,
            template_html=template_html,
            template_style=template_style,
            model=model
        )

    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: dict = None,
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate styled HTML document from research content and template.
        
        Takes the research from Step 1 and uses it as context to generate
        a properly styled HTML document that matches the template's design.
        
        Args:
            research_content: The markdown report content from Step 1 (research)
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            submission_data: Additional submission data to include (name, email, etc.)
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        return self.html_generator.generate_styled_html(
            research_content=research_content,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            model=model
        )

    def rewrite_html(
        self,
        html_content: str,
        model: str = 'gpt-5',
    ) -> str:
        """
        Rewrite/enhance HTML content using AI.
        
        Args:
            html_content: Original HTML content
            model: OpenAI model to use
            
        Returns:
            Enhanced HTML content
        """
        return self.html_generator.rewrite_html(html_content, model)
