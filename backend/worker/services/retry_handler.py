"""
Retry Handler Service
Handles retry logic for OpenAI API calls with specific error recovery strategies.
"""

import logging
from typing import Optional, Tuple, List, Dict, Any

from services.tool_validator import ToolValidator

logger = logging.getLogger(__name__)


class RetryHandler:
    """Handles retry logic for OpenAI API calls."""
    
    def __init__(self, openai_client: Any):
        """
        Initialize retry handler.
        
        Args:
            openai_client: OpenAIClient instance for making API calls
        """
        self.openai_client = openai_client
    
    def retry_without_required_tool_choice(
        self,
        model: str,
        tools: List[Dict],
        instructions: str,
        context: str,
        previous_context: str,
        image_handler: Any
    ) -> Optional[Tuple[str, Dict, Dict, Dict]]:
        """
        Retry API call without 'required' tool_choice.
        
        Returns:
            Tuple of (report, usage_info, request_details, response_details) if successful, None if retry fails
        """
        logger.warning("[RetryHandler] Recovering from 'required' without tools by retrying with tool_choice='auto' and a default tool")
        try:
            retry_tools, retry_choice = ToolValidator.ensure_tools_and_choice(tools, "auto")
            input_text = self.openai_client.build_input_text(context, previous_context)
            params_retry = self.openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=retry_tools,
                tool_choice=retry_choice,
                has_computer_use=ToolValidator.has_computer_use(retry_tools),
                reasoning_level=None
            )
            response = self.openai_client.make_api_call(params_retry)
            return self.openai_client.process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=retry_tools,
                tool_choice=retry_choice,
                params=params_retry,
                image_handler=image_handler
            )
        except Exception:
            return None
    
    def retry_without_reasoning_level(
        self,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        previous_context: str,
        image_handler: Any
    ) -> Optional[Tuple[str, Dict, Dict, Dict]]:
        """
        Retry API call without reasoning_level parameter.
        
        Returns:
            Tuple of (report, usage_info, request_details, response_details) if successful, None if retry fails
        """
        logger.warning(f"[RetryHandler] reasoning_level parameter not supported, retrying without it")
        try:
            # Re-validate tools and tool_choice for retry
            retry_tools, retry_tool_choice = ToolValidator.validate_and_filter_tools(tools, tool_choice)
            
            # Check if computer_use_preview is in tools (requires truncation="auto")
            has_computer_use = ToolValidator.has_computer_use(retry_tools)
            
            # Build params without reasoning_level
            input_text = self.openai_client.build_input_text(context, previous_context)
            params_no_reasoning = self.openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=retry_tools,
                tool_choice=retry_tool_choice,
                has_computer_use=has_computer_use,
                reasoning_level=None  # Skip reasoning_level for retry
            )
            
            response = self.openai_client.make_api_call(params_no_reasoning)
            
            # Process response
            report, usage_info, request_details, response_details = self.openai_client.process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=retry_tools,
                tool_choice=retry_tool_choice or "auto",
                params=params_no_reasoning,
                image_handler=image_handler
            )
            
            logger.info(
                f"[RetryHandler] Report generation completed (without reasoning_level). "
                f"Tokens: {usage_info['total_tokens']} "
                f"(input: {usage_info['input_tokens']}, output: {usage_info['output_tokens']})"
                + (f" Images generated: {len(response_details.get('image_urls', []))}" if response_details.get('image_urls') else "")
            )
            
            return report, usage_info, request_details, response_details
        except Exception:
            return None

