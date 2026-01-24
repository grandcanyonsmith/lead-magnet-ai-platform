"""HTML generation utilities."""
import logging
import json
from typing import Dict, Optional, Tuple

from utils.decimal_utils import convert_decimals_to_float
from services.prompt_overrides import resolve_prompt_override
from services.html_sanitizer import strip_template_placeholders
from core.prompts import PROMPT_CONFIGS, STYLED_HTML_INSTRUCTIONS, STYLED_HTML_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)


class HTMLGenerator:
    """Generates HTML content using OpenAI."""
    
    def __init__(self, openai_client):
        """Initialize HTML generator with OpenAI client."""
        self.openai_client = openai_client
    
    def generate_html(self, content: str, instructions: str = "") -> str:
        """
        Generate HTML from content.
        
        Args:
            content: Content to convert to HTML
            instructions: Optional instructions
            
        Returns:
            Generated HTML
        """
        return content
    
    def generate_html_from_submission(
        self,
        submission_data: dict,
        template_html: str,
        template_style: str = '',
        model: str = 'gpt-5.2',
        prompt_overrides: Optional[Dict] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate final deliverable HTML from submission data using the template as a style reference.
        """
        serializable_submission = convert_decimals_to_float(submission_data or {})
        content = json.dumps(serializable_submission, ensure_ascii=False, indent=2)
        return self._generate_styled_html(
            content_label="SUBMISSION_DATA_JSON",
            content=content,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            model=model,
            prompt_overrides=prompt_overrides,
        )
    
    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: Dict = None,
        model: str = 'gpt-5.2',
        prompt_overrides: Optional[Dict] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate styled HTML deliverable from accumulated workflow content using a template as a style reference.
        """
        return self._generate_styled_html(
            content_label="CONTENT",
            content=research_content or "",
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            model=model,
            prompt_overrides=prompt_overrides,
        )
    
    def rewrite_html(self, html_content: str, model: str = 'gpt-5.2') -> str:
        """Rewrite/enhance HTML content."""
        return html_content

    def _generate_styled_html(
        self,
        content_label: str,
        content: str,
        template_html: str,
        template_style: str = '',
        submission_data: Optional[Dict] = None,
        model: str = 'gpt-5.2',
        prompt_overrides: Optional[Dict] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Internal helper that calls OpenAI Responses API to create a complete HTML deliverable
        using `template_html` as a style reference.
        """
        if not template_html or not isinstance(template_html, str) or template_html.strip() == "":
            raise ValueError("template_html is required to generate styled HTML")

        serializable_submission = convert_decimals_to_float(submission_data or {})
        submission_json = json.dumps(serializable_submission, ensure_ascii=False, indent=2)
        style_hint = template_style.strip() if isinstance(template_style, str) else ""

        sanitized_template_html = strip_template_placeholders(template_html)
        
        # Use template from config
        input_text = STYLED_HTML_PROMPT_TEMPLATE.format(
            template_html=sanitized_template_html,
            template_style=style_hint if style_hint else '(none)',
            content_label=content_label,
            content=content,
            submission_data_json=submission_json
        )

        defaults = PROMPT_CONFIGS["styled_html_generation"].copy()
        defaults.update({
            "instructions": STYLED_HTML_INSTRUCTIONS,
            "prompt": input_text,
            "model": model or defaults.get("model", "gpt-5.2")
        })

        resolved = resolve_prompt_override(
            key="styled_html_generation",
            defaults=defaults,
            overrides=prompt_overrides,
            variables={
                "content_label": content_label,
                "content": content,
                "template_html": sanitized_template_html,
                "template_style": style_hint,
                "submission_data_json": submission_json,
                "input_text": input_text,
            },
        )
        instructions = resolved.get("instructions")
        input_text = resolved.get("prompt")
        resolved_model = resolved.get("model")
        service_tier = resolved.get("service_tier")
        reasoning_effort = resolved.get("reasoning_effort")

        # Build params for Responses API. No tools are needed for this.
        params = self.openai_client.build_api_params(
            model=resolved_model,
            instructions=instructions,
            input_text=input_text,
            tools=[],
            tool_choice="none",
            has_computer_use=False,
            reasoning_level=None,
            service_tier=service_tier,
            reasoning_effort=reasoning_effort,
        )

        logger.info("[HTMLGenerator] Calling OpenAI for template-based HTML deliverable", extra={
            "model": resolved_model,
            "content_length": len(content or ""),
            "template_html_length": len(template_html),
            "has_style_hint": bool(style_hint),
            "has_submission_data": bool(submission_data),
        })

        response = self.openai_client.make_api_call(params)

        output_text, usage_info, request_details, response_details = self.openai_client.process_api_response(
            response=response,
            model=resolved_model,
            instructions=instructions,
            input_text=input_text,
            previous_context="",
            context=input_text,
            tools=[],
            tool_choice="none",
            params=params,
            image_handler=None,
            tenant_id=None,
            job_id=None,
            step_name="HTML Generation",
            step_instructions=instructions,
        )

        cleaned_output = strip_template_placeholders(output_text)
        if isinstance(response_details, dict):
            response_details["output_text"] = cleaned_output

        return cleaned_output, usage_info, request_details, response_details
