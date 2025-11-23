"""OpenAI input parameter building service."""
import logging
from typing import Dict, List, Optional

from services.tool_builder import ToolBuilder

logger = logging.getLogger(__name__)


class OpenAIInputBuilder:
    """Handles building input parameters for OpenAI API calls."""
    
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
        if previous_context:
            return f"{previous_context}\n\n--- Current Step Context ---\n{context}"
        return context
    
    @staticmethod
    def _check_image_generation_tool(tools: Optional[List[Dict]]) -> bool:
        """
        Check if image_generation tool is present in tools list.
        
        Args:
            tools: List of tools
            
        Returns:
            True if image_generation tool is present
        """
        if not tools:
            return False
        for tool in tools:
            if isinstance(tool, dict) and tool.get('type') == 'image_generation':
                return True
        return False
    
    @staticmethod
    def _build_input_text_only(
        input_text: str,
        has_image_generation: bool,
        previous_image_urls: Optional[List[str]]
    ) -> str:
        """
        Build simple text input (backward compatible format).
        
        Args:
            input_text: Text input
            has_image_generation: Whether image generation tool is present
            previous_image_urls: Previous image URLs (for logging)
            
        Returns:
            Simple text input string
        """
        if has_image_generation and previous_image_urls:
            logger.debug("[OpenAI Input Builder] Image generation tool present but no previous image URLs to include")
        return input_text
    
    def build_api_params(
        self,
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
        image_handler=None
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
            reasoning_level: Reasoning level (deprecated - not supported in Responses API, will be removed in next major version)
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            image_handler: OpenAIImageHandler instance for building image inputs
            
        Returns:
            API parameters dictionary for Responses API
        """
        # Check if image_generation tool is present
        has_image_generation = self._check_image_generation_tool(tools)
        
        # Build input: if image_generation tool is present and we have previous image URLs,
        # use list format with text and images; otherwise use string format (backward compatible)
        if has_image_generation and previous_image_urls and len(previous_image_urls) > 0:
            if image_handler is None:
                raise ValueError("image_handler is required when previous_image_urls are provided")
            
            api_input = image_handler.build_input_with_images(
                input_text=input_text,
                previous_image_urls=previous_image_urls,
                job_id=job_id,
                tenant_id=tenant_id
            )
        else:
            # Use string format (backward compatible)
            api_input = self._build_input_text_only(
                input_text=input_text,
                has_image_generation=has_image_generation,
                previous_image_urls=previous_image_urls
            )
        
        params = {
            "model": model,
            "instructions": instructions,
            "input": api_input
        }
        
        if tools and len(tools) > 0:
            # Clean tools before sending to OpenAI API
            cleaned_tools = ToolBuilder.clean_tools(tools)
            params["tools"] = cleaned_tools
            if tool_choice != "none":
                params["tool_choice"] = tool_choice
        
        return params

