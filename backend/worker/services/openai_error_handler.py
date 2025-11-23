"""OpenAI error handling service."""
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class OpenAIErrorHandler:
    """Handles OpenAI API errors."""
    
    def handle_openai_error(
        self,
        error: Exception,
        model: str,
        tools: list,
        tool_choice: str,
        instructions: str,
        context: str,
        full_context: str,
        previous_context: str,
        image_handler
    ):
        """
        Handle OpenAI API errors with retry logic.
        
        Args:
            error: The exception that occurred
            model: Model name
            tools: List of tools
            tool_choice: Tool choice setting
            instructions: System instructions
            context: Current context
            full_context: Full context string
            previous_context: Previous context
            image_handler: Image handler instance
            
        Raises:
            Exception: Re-raises the error with additional context
        """
        logger.error(f"OpenAI API error: {error}", exc_info=True)
        raise Exception(f"OpenAI API error ({type(error).__name__}): {str(error)}")

