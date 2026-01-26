"""
OpenAI Request Builder Service
Handles construction of API parameters for OpenAI Responses API calls.
"""
import logging
from typing import Dict, List, Optional, Any
from services.openai.request_builder.input_builder import build_input_text, build_multimodal_input
from services.openai.request_builder.params_builder import build_api_params, NO_CONFIRMATION_PREFIX

logger = logging.getLogger(__name__)


class OpenAIRequestBuilder:
    """Builder for OpenAI API request parameters."""

    # Global guardrail: workflows run autonomously with no user interaction between steps.
    # This prevents the model from asking for confirmation or follow-up questions mid-run.
    _NO_CONFIRMATION_PREFIX = NO_CONFIRMATION_PREFIX

    @staticmethod
    def _model_supports_reasoning(model: str) -> bool:
        """Return True if the model supports the reasoning parameter."""
        if not isinstance(model, str):
            return False
        normalized = model.strip().lower()
        if normalized.startswith("gpt-5"):
            return True
        return normalized.startswith(("o1", "o3", "o4", "o5"))
    
    @staticmethod
    def build_input_text(context: str, previous_context: str = "") -> str:
        """
        Build input text for API call.
        
        Args:
            context: Current context
            previous_context: Previous step context
            
        Returns:
            Combined input text
        """
        return build_input_text(context, previous_context)
    
    @staticmethod
    def build_api_params(
        model: str,
        instructions: str,
        input_text: str,
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        has_computer_use: bool = False,
        reasoning_level: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        output_format: Optional[Dict[str, Any]] = None,
    ) -> Dict:
        """
        Build parameters for OpenAI Responses API call.
        
        Args:
            model: Model name
            instructions: System instructions
            input_text: User input
            tools: List of tools
            tool_choice: Tool choice setting
            has_computer_use: Whether computer_use_preview is in tools
            reasoning_level: Reasoning level (deprecated, kept for compatibility)
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            reasoning_effort: Reasoning effort for supported models ('none'|'low'|'medium'|'high'|'xhigh')
            service_tier: Service tier / speed preference (e.g., 'default' for fast)
            text_verbosity: Output verbosity ('low'|'medium'|'high')
            max_output_tokens: Maximum number of output tokens
            output_format: Optional structured output format (Responses API: text.format)
            
        Returns:
            API parameters dictionary for Responses API
        """
        return build_api_params(
            model=model,
            instructions=instructions,
            input_text=input_text,
            tools=tools,
            tool_choice=tool_choice,
            has_computer_use=has_computer_use,
            reasoning_level=reasoning_level,
            previous_image_urls=previous_image_urls,
            job_id=job_id,
            tenant_id=tenant_id,
            reasoning_effort=reasoning_effort,
            service_tier=service_tier,
            text_verbosity=text_verbosity,
            max_output_tokens=max_output_tokens,
            output_format=output_format,
        )

    @staticmethod
    def _build_multimodal_input(
        input_text: str,
        previous_image_urls: List[str],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Build multimodal input with text and images.
        Handles image deduplication and base64 conversion for problematic URLs.
        """
        return build_multimodal_input(
            input_text=input_text,
            previous_image_urls=previous_image_urls,
            job_id=job_id,
            tenant_id=tenant_id
        )
