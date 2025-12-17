"""HTML generation utilities."""
import logging
import json
from typing import Dict, Optional, Tuple

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
        model: str = 'gpt-5'
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate final deliverable HTML from submission data using the template as a style reference.
        """
        content = json.dumps(submission_data or {}, ensure_ascii=False, indent=2)
        return self._generate_styled_html(
            content_label="SUBMISSION_DATA_JSON",
            content=content,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            model=model,
        )
    
    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: Dict = None,
        model: str = 'gpt-5'
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
        )
    
    def rewrite_html(self, html_content: str, model: str = 'gpt-5') -> str:
        """Rewrite/enhance HTML content."""
        return html_content

    def _generate_styled_html(
        self,
        content_label: str,
        content: str,
        template_html: str,
        template_style: str = '',
        submission_data: Optional[Dict] = None,
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Internal helper that calls OpenAI Responses API to create a complete HTML deliverable
        using `template_html` as a style reference.
        """
        if not template_html or not isinstance(template_html, str) or template_html.strip() == "":
            raise ValueError("template_html is required to generate styled HTML")

        submission_json = json.dumps(submission_data or {}, ensure_ascii=False, indent=2)
        style_hint = template_style.strip() if isinstance(template_style, str) else ""

        instructions = (
            "You are an expert HTML/CSS designer.\n"
            "You must generate the FINAL lead magnet deliverable as a complete, standalone HTML5 document.\n"
            "You will be given TEMPLATE_HTML as a style reference and CONTENT to present.\n\n"
            "Hard requirements:\n"
            "- Output ONLY the final HTML (no markdown fences, no commentary).\n"
            "- Output MUST be a complete HTML document (<html>...</html>) and should include a <head> with styles.\n"
            "- Use the TEMPLATE_HTML's design language (layout, typography, colors, spacing, components).\n"
            "- Do NOT output a landing page or lead capture form unless the provided content explicitly requires it.\n"
            "- Preserve the meaning and details from CONTENT; rewrite for readability.\n"
            "- Keep it responsive and mobile-friendly.\n"
        )

        input_text = (
            f"TEMPLATE_HTML (style reference):\n<<<\n{template_html}\n>>>\n\n"
            f"TEMPLATE_STYLE_GUIDANCE:\n{style_hint if style_hint else '(none)'}\n\n"
            f"{content_label}:\n<<<\n{content}\n>>>\n\n"
            f"SUBMISSION_DATA_JSON (optional personalization context):\n<<<\n{submission_json}\n>>>\n"
        )

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

        return output_text, usage_info, request_details, response_details
