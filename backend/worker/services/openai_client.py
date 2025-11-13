"""OpenAI API client wrapper."""
import logging
import openai
from typing import Dict, List, Optional

from services.api_key_manager import APIKeyManager

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper for OpenAI API calls."""
    
    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        self.openai_api_key = APIKeyManager.get_openai_key()
        self.client = openai.OpenAI(api_key=self.openai_api_key)
    
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
        reasoning_level: Optional[str] = None
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
            
        Returns:
            API parameters dictionary for Responses API
        """
        params = {
            "model": model,
            "instructions": instructions,
            "input": input_text
        }
        
        if tools and len(tools) > 0:
            # Clean tools before sending to OpenAI API
            # - Keep container parameter (required by API for code_interpreter and computer_use_preview)
            # - Recursively convert all Decimal values to int (for display_width, display_height, etc.)
            cleaned_tools = []
            from utils.decimal_utils import convert_decimals_to_int
            from services.tool_validator import ToolValidator
            
            for idx, tool in enumerate(tools):
                if isinstance(tool, dict):
                    cleaned_tool = tool.copy()
                    
                    # Defensive check: Ensure container parameter is present for tools that require it
                    # This is a fallback in case validation was missed earlier
                    tool_type = cleaned_tool.get("type")
                    if tool_type and ToolValidator.requires_container(tool_type):
                        if "container" not in cleaned_tool:
                            logger.warning(
                                f"Missing container parameter for tool[{idx}] ({tool_type}), "
                                "adding it defensively. This should have been caught by validation."
                            )
                            cleaned_tool["container"] = {"type": "auto"}
                        elif not isinstance(cleaned_tool.get("container"), dict) or "type" not in cleaned_tool.get("container", {}):
                            logger.warning(
                                f"Invalid container structure for tool[{idx}] ({tool_type}), "
                                "fixing it defensively."
                            )
                            cleaned_tool["container"] = {"type": "auto"}
                    
                    # Recursively convert ALL Decimal values to int throughout the tool dictionary
                    # This ensures display_width, display_height, and any other Decimal values are converted
                    # OpenAI API requires integers, not Decimal types
                    cleaned_tool = convert_decimals_to_int(cleaned_tool)
                    
                    # Final verification: Double-check container is still present after conversion
                    if tool_type and ToolValidator.requires_container(tool_type):
                        if "container" not in cleaned_tool:
                            logger.error(
                                f"Container parameter lost during conversion for tool[{idx}] ({tool_type}), "
                                "re-adding it."
                            )
                            cleaned_tool["container"] = {"type": "auto"}
                    
                    cleaned_tools.append(cleaned_tool)
                else:
                    cleaned_tools.append(tool)
            params["tools"] = cleaned_tools
            if tool_choice != "none":
                params["tool_choice"] = tool_choice
        
        return params
    
    def create_response(self, **params):
        """
        Create a response using OpenAI Responses API.
        Supports code_interpreter and other modern tools natively.
        
        Args:
            **params: Parameters to pass to OpenAI Responses API
            
        Returns:
            OpenAI API response
        """
        try:
            response = self.client.responses.create(**params)
            return response
        except Exception as e:
            logger.error(f"Error calling OpenAI Responses API: {e}", exc_info=True)
            raise
    
    def create_chat_completion(self, **params):
        """Legacy method for backwards compatibility - now uses Responses API."""
        return self.create_response(**params)
    
    def make_api_call(self, params: Dict):
        """Make API call to OpenAI Responses API."""
        return self.create_response(**params)
    
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
        """Process Responses API response and return formatted results."""
        from cost_service import calculate_openai_cost
        
        # Responses API uses output_text instead of choices[0].message.content
        content = getattr(response, "output_text", "")
        if not content and hasattr(response, "choices"):
            # Fallback for backwards compatibility
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content or ""
        
        usage = response.usage if hasattr(response, "usage") and response.usage else None
        input_tokens = getattr(usage, "input_tokens", 0) if usage else getattr(usage, "prompt_tokens", 0) if usage else 0
        output_tokens = getattr(usage, "output_tokens", 0) if usage else getattr(usage, "completion_tokens", 0) if usage else 0
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
        
        # Extract image URLs from response when image_generation tool is used
        image_urls = []
        try:
            # Check if response has output items (Responses API structure)
            if hasattr(response, 'output') and response.output:
                for item in response.output:
                    # Check for image items from image_generation tool
                    # Image items typically have type='image' and contain image_url or url
                    if hasattr(item, 'type'):
                        item_type = item.type
                        if item_type == 'image':
                            # Extract image URL from image item
                            image_url = None
                            if hasattr(item, 'image_url'):
                                image_url = item.image_url
                            elif hasattr(item, 'url'):
                                image_url = item.url
                            elif hasattr(item, 'image'):
                                # If image is an object, try to get URL from it
                                image_obj = item.image
                                if isinstance(image_obj, dict):
                                    image_url = image_obj.get('url') or image_obj.get('image_url')
                                elif hasattr(image_obj, 'url'):
                                    image_url = image_obj.url
                                elif hasattr(image_obj, 'image_url'):
                                    image_url = image_obj.image_url
                            
                            if image_url:
                                image_urls.append(image_url)
                                logger.debug(f"[OpenAI Client] Extracted image URL from response: {image_url[:80]}...")
                        
                        # Also check for tool_call items that might contain image results
                        elif item_type == 'tool_call' or item_type == 'tool_calls':
                            # Check if this is an image_generation tool call
                            tool_name = None
                            if hasattr(item, 'name'):
                                tool_name = item.name
                            elif hasattr(item, 'tool_name'):
                                tool_name = item.tool_name
                            
                            if tool_name == 'image_generation':
                                # Extract image URLs from tool call result
                                result = None
                                if hasattr(item, 'result'):
                                    result = item.result
                                elif hasattr(item, 'output'):
                                    result = item.output
                                
                                if result:
                                    # Result might be a list of images or a single image
                                    if isinstance(result, list):
                                        for img in result:
                                            img_url = None
                                            if isinstance(img, dict):
                                                img_url = img.get('url') or img.get('image_url')
                                            elif hasattr(img, 'url'):
                                                img_url = img.url
                                            elif hasattr(img, 'image_url'):
                                                img_url = img.image_url
                                            
                                            if img_url:
                                                image_urls.append(img_url)
                                                logger.debug(f"[OpenAI Client] Extracted image URL from tool_call result: {img_url[:80]}...")
                                    else:
                                        # Single image result
                                        img_url = None
                                        if isinstance(result, dict):
                                            img_url = result.get('url') or result.get('image_url')
                                        elif hasattr(result, 'url'):
                                            img_url = result.url
                                        elif hasattr(result, 'image_url'):
                                            img_url = result.image_url
                                        
                                        if img_url:
                                            image_urls.append(img_url)
                                            logger.debug(f"[OpenAI Client] Extracted image URL from tool_call result: {img_url[:80]}...")
            
            # Also check response.tool_calls if it exists (alternative response structure)
            if hasattr(response, 'tool_calls') and response.tool_calls:
                for tool_call in response.tool_calls:
                    if hasattr(tool_call, 'type') and tool_call.type == 'image_generation':
                        # Extract image URLs from tool call
                        if hasattr(tool_call, 'output'):
                            output = tool_call.output
                            if isinstance(output, list):
                                for img in output:
                                    img_url = None
                                    if isinstance(img, dict):
                                        img_url = img.get('url') or img.get('image_url')
                                    elif hasattr(img, 'url'):
                                        img_url = img.url
                                    
                                    if img_url:
                                        image_urls.append(img_url)
                                        logger.debug(f"[OpenAI Client] Extracted image URL from tool_calls: {img_url[:80]}...")
            
            if image_urls:
                logger.info(f"[OpenAI Client] Extracted {len(image_urls)} image URL(s) from response", extra={
                    'image_count': len(image_urls),
                    'has_image_generation_tool': any(
                        isinstance(t, dict) and t.get('type') == 'image_generation' 
                        for t in tools
                    ) if tools else False
                })
        except Exception as e:
            logger.warning(f"[OpenAI Client] Error extracting image URLs from response: {e}", exc_info=True)
            # Don't fail the request if image extraction fails, just log it
        
        response_details = {
            "output_text": content,
            "image_urls": image_urls,
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
        full_context: str,
        previous_context: str,
        image_handler
    ):
        """Handle OpenAI API errors with retry logic."""
        logger.error(f"OpenAI API error: {error}", exc_info=True)
        raise Exception(f"OpenAI API error ({type(error).__name__}): {str(error)}")
