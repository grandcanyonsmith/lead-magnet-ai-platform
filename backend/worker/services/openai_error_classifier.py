<<<<<<< Current (Your changes)
=======
"""
Error Handler Service
Handles OpenAI API error classification and exception creation.
"""

import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


class OpenAIErrorClassifier:
    """Classifies OpenAI API errors and builds standardized exceptions."""
    
    @staticmethod
    def classify_error(error_message: str) -> str:
        """
        Classify error message into error category.
        
        Args:
            error_message: Error message string
            
        Returns:
            Error category string
        """
        error_lower = error_message.lower()
        if "API key" in error_message or "authentication" in error_lower:
            return "authentication"
        elif "rate limit" in error_lower or "quota" in error_lower:
            return "rate_limit"
        elif "tool_choice" in error_lower and "required" in error_lower and "tools" in error_lower:
            return "tool_choice_config"
        elif "model" in error_lower and "not found" in error_lower:
            return "model_not_found"
        elif "timeout" in error_lower:
            return "timeout"
        elif "connection" in error_lower:
            return "connection"
        else:
            return "unknown"
    
    @staticmethod
    def create_error_exception(
        error_category: str,
        error_type: str,
        error_message: str,
        model: str,
        tools: List[Dict],
        tool_choice: str
    ) -> Exception:
        """
        Create standardized exception based on error category.
        
        Args:
            error_category: Category of error
            error_type: Type name of the exception
            error_message: Original error message
            model: Model name used
            tools: Tools used
            tool_choice: Tool choice used
            
        Returns:
            Exception object with appropriate message
        """
        if error_category == "authentication":
            logger.error("[OpenAIErrorClassifier] Authentication error - check API key configuration")
            return Exception(f"OpenAI API authentication failed. Please check your API key configuration: {error_message}")
        elif error_category == "rate_limit":
            logger.warning("[OpenAIErrorClassifier] Rate limit exceeded - request should be retried")
            return Exception(f"OpenAI API rate limit exceeded. Please try again later: {error_message}")
        elif error_category == "tool_choice_config":
            logger.error("[OpenAIErrorClassifier] Invalid tool_choice configuration - tool_choice='required' but tools empty", extra={
                'error_message': error_message,
                'error_type': error_type,
                'tool_choice': tool_choice,
                'tools_count': len(tools) if tools else 0,
                'tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else []
            })
            return Exception(f"OpenAI API error: Invalid workflow configuration. Tool choice 'required' was specified but no tools are available. This has been automatically fixed - please try again. Original error: {error_message}")
        elif error_category == "model_not_found":
            logger.error(f"[OpenAIErrorClassifier] Invalid model specified: {model}")
            return Exception(f"Invalid AI model specified. Please check your workflow configuration: {error_message}")
        elif error_category == "timeout":
            logger.warning("[OpenAIErrorClassifier] Request timeout - request took too long")
            return Exception(f"OpenAI API request timed out. The request took too long to complete: {error_message}")
        elif error_category == "connection":
            logger.error("[OpenAIErrorClassifier] Connection error - network issue")
            return Exception(f"Unable to connect to OpenAI API. Please check your network connection: {error_message}")
        else:
            logger.error(f"[OpenAIErrorClassifier] Unexpected API error: {error_type}")
            return Exception(f"OpenAI API error ({error_type}): {error_message}")

>>>>>>> Incoming (Background Agent changes)
