"""Error handling utilities for job processing."""

import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


def normalize_error_message(error: Exception) -> Tuple[str, str]:
    """
    Normalize error message for consistent error handling.
    
    Args:
        error: The exception to normalize
        
    Returns:
        Tuple of (error_type, error_message)
    """
    error_type = type(error).__name__
    error_message = str(error)
    
    # Clean up common error patterns
    if not error_message:
        error_message = f"{error_type} occurred"
    
    return error_type, error_message


def create_descriptive_error(error: Exception, context: Optional[str] = None) -> str:
    """
    Create a descriptive error message with context.
    
    Args:
        error: The exception
        context: Optional context string (e.g., "Failed to process step 3")
        
    Returns:
        Descriptive error message
    """
    error_type, error_message = normalize_error_message(error)
    
    if context:
        return f"{context}: {error_type} - {error_message}"
    else:
        return f"{error_type}: {error_message}"
