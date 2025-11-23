"""OpenAI API client wrapper."""
import logging
from typing import Dict, List, Optional

from services.openai_input_builder import OpenAIInputBuilder
from services.openai_image_handler import OpenAIImageHandler
from services.openai_api_client import OpenAIAPIClient
from services.openai_response_processor import OpenAIResponseProcessor
from services.openai_error_handler import OpenAIErrorHandler

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper for OpenAI API calls - facade coordinating specialized services."""
    
    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        # Initialize specialized services
        self.image_handler = OpenAIImageHandler()
        self.input_builder = OpenAIInputBuilder()
        self.api_client = OpenAIAPIClient(image_handler=self.image_handler)
        self.response_processor = OpenAIResponseProcessor()
        self.error_handler = OpenAIErrorHandler()
        # Expose client for backward compatibility (used by tests)
        self.client = self.api_client.client
    
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
        return OpenAIInputBuilder.build_input_text(context, previous_context)
    
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
        tenant_id: Optional[str] = None
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
            
        Returns:
            API parameters dictionary for Responses API
        """
        return self.input_builder.build_api_params(
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
            image_handler=self.image_handler
        )
    
    def create_response(self, **params):
        """
        Create a response using OpenAI Responses API.
        Supports code_interpreter and other modern tools natively.
        
        Handles image download timeouts by:
        1. Attempting to download problematic URLs locally and convert to base64
        2. If that fails, skipping the problematic image and retrying
        
        Args:
            **params: Parameters to pass to OpenAI Responses API
            
        Returns:
            OpenAI API response
        """
        return self.api_client.create_response(**params)
    
    def create_chat_completion(self, **params):
        """Legacy method for backwards compatibility - now uses Responses API."""
        return self.api_client.create_chat_completion(**params)
    
    def make_api_call(self, params: Dict):
        """Make API call to OpenAI Responses API."""
        return self.api_client.make_api_call(params)
    
    def process_api_response(
        self,
        response,
        model: str,
        instructions: str,
        input_text: str,
        previous_context: str,
        context: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None
    ):
        """Process Responses API response and return formatted results."""
        return self.response_processor.process_api_response(
            response=response,
            model=model,
            instructions=instructions,
            input_text=input_text,
            previous_context=previous_context,
            context=context,
            tools=tools,
            tool_choice=tool_choice,
            params=params,
            image_handler=image_handler,
            tenant_id=tenant_id,
            job_id=job_id
        )
    
    def handle_openai_error(
        self,
        error: Exception,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        full_context: str,
        previous_context: str,
        image_handler
    ):
        """Handle OpenAI API errors with retry logic."""
        return self.error_handler.handle_openai_error(
            error=error,
            model=model,
            tools=tools,
            tool_choice=tool_choice,
            instructions=instructions,
            context=context,
            full_context=full_context,
            previous_context=previous_context,
            image_handler=image_handler
        )
