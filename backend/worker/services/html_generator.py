"""HTML generation utilities."""
import logging
import json
from typing import Dict, Optional, Tuple

from utils.decimal_utils import convert_decimals_to_float
from services.prompt_overrides import resolve_prompt_override
from services.html_sanitizer import strip_template_placeholders

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

        instructions = (
            "You are a Senior Frontend Engineer and Design System Expert.\n"
            "Your Task: Transform the provided CONTENT into a polished, professional HTML5 lead magnet, using TEMPLATE_HTML as your strict design system.\n\n"
            "## Core Directives\n"
            "1. **Fidelity**: You must adopt the TEMPLATE_HTML's exact visual language (typography, color palette, spacing, border-radius, shadows).\n"
            "2. **Structure**: Return a valid, standalone HTML5 document (<!DOCTYPE html>...</html>).\n"
            "3. **Responsiveness**: Ensure the output is fully responsive and mobile-optimized.\n"
            "4. **Content Integrity**: Present the CONTENT accurately. Do not summarize unless asked. Use appropriate HTML tags (h1-h6, p, ul, table, blockquote) to structure the data.\n"
            "5. **No Template Placeholders**: Do not include {{...}} placeholder tokens. If TEMPLATE_HTML contains placeholders, replace them with real text derived from CONTENT.\n"
            "6. **No Hallucinations**: Do not invent new content. Only format what is provided.\n\n"
            "## Output Format\n"
            "Return ONLY the raw HTML code. Do not wrap it in Markdown code blocks. Do not add conversational text."
        )

        sanitized_template_html = strip_template_placeholders(template_html)
        input_text = (
            f"TEMPLATE_HTML (style reference):\n<<<\n{sanitized_template_html}\n>>>\n\n"
            f"TEMPLATE_STYLE_GUIDANCE:\n{style_hint if style_hint else '(none)'}\n\n"
            f"{content_label}:\n<<<\n{content}\n>>>\n\n"
            f"SUBMISSION_DATA_JSON (optional personalization context):\n<<<\n{submission_json}\n>>>\n"
        )
        resolved = resolve_prompt_override(
            key="styled_html_generation",
            defaults={
                "instructions": instructions,
                "prompt": input_text,
            },
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
        instructions = resolved.get("instructions") or instructions
        input_text = resolved.get("prompt") or input_text

        # Build params for Responses API. No tools are needed for this.
        params = self.openai_client.build_api_params(
            model=model,
            instructions=instructions,
            input_text=input_text,
            tools=[],
            tool_choice="none",
            has_computer_use=False,
            reasoning_level=None,
        )

        logger.info("[HTMLGenerator] Calling OpenAI for template-based HTML deliverable", extra={
            "model": model,
            "content_length": len(content or ""),
            "template_html_length": len(template_html),
            "has_style_hint": bool(style_hint),
            "has_submission_data": bool(submission_data),
        })

        response = self.openai_client.make_api_call(params)

        output_text, usage_info, request_details, response_details = self.openai_client.process_api_response(
            response=response,
            model=model,
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
