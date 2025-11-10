"""OpenAI API client wrapper."""
import logging
import openai
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper for OpenAI API calls."""
    
    def __init__(self):
        """Initialize OpenAI client."""
        pass
    
    @staticmethod
    def is_o3_model(model: str) -> bool:
        """Check if model is an o3 model."""
        return model.startswith("o3") or "o3-" in model.lower()
    
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
    
    def build_api_params(
        self,
        model: str,
        instructions: str,
        input_text: str,
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        has_computer_use: bool = False,
        is_o3_model: bool = False,
        reasoning_level: Optional[str] = None
    ) -> Dict:
        """
        Build parameters for OpenAI API call.
        
        Args:
            model: Model name
            instructions: System instructions
            input_text: User input
            tools: List of tools
            tool_choice: Tool choice setting
            has_computer_use: Whether computer_use_preview is in tools
            is_o3_model: Whether model is o3
            reasoning_level: Reasoning level for o3 models
            
        Returns:
            API parameters dictionary
        """
        params = {
            "model": model,
            "messages": [
                {"role": "system", "content": instructions},
                {"role": "user", "content": input_text}
            ]
        }
        
        if tools and len(tools) > 0:
            params["tools"] = tools
            if tool_choice != "none":
                params["tool_choice"] = tool_choice
        
        if has_computer_use:
            params["truncation"] = "auto"
        
        return params
    
    def create_chat_completion(self, **params):
        """
        Create a chat completion using OpenAI API.
        
        Args:
            **params: Parameters to pass to OpenAI API
            
        Returns:
            OpenAI API response
        """
        try:
            client = openai.OpenAI()
            response = client.chat.completions.create(**params)
            return response
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}", exc_info=True)
            raise
    
    def make_api_call(self, params: Dict):
        """Make API call to OpenAI."""
        return self.create_chat_completion(**params)
    
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
        image_handler
    ):
        """Process API response and return formatted results."""
        from cost_service import calculate_openai_cost
        
        content = ""
        if response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content or ""
        
        usage = response.usage if response.usage else None
        input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
        output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
        total_tokens = getattr(usage, "total_tokens", 0) if usage else 0
        
        cost_data = calculate_openai_cost(model, input_tokens, output_tokens)
        
        usage_info = {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost_data["cost_usd"],
            "service_type": "openai_worker_report"
        }
        
        request_details = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
            "previous_context": previous_context,
            "context": context,
            "tools": tools,
            "tool_choice": tool_choice
        }
        
        response_details = {
            "output_text": content,
            "image_urls": [],
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens
            },
            "model": model
        }
        
        return content, usage_info, request_details, response_details
    
    def handle_openai_error(
        self,
        error: Exception,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        is_o3_model: bool,
        full_context: str,
        previous_context: str,
        image_handler
    ):
        """Handle OpenAI API errors with retry logic."""
        logger.error(f"OpenAI API error: {error}", exc_info=True)
        raise Exception(f"OpenAI API error ({type(error).__name__}): {str(error)}")
