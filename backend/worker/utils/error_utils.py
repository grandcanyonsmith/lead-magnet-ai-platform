"""
Error handling utilities for consistent error processing and messaging.

Provides utilities for normalizing error messages and creating descriptive
error messages with context for better debugging and user feedback.
"""

from typing import Tuple


def normalize_error_message(error: Exception) -> Tuple[str, str]:
    """
    Normalize error message and type for consistent error handling.
    
    Extracts the error type name and message, ensuring a meaningful message
    is always returned even if the exception has no message.
    
    Args:
        error: Exception object to normalize
        
    Returns:
        Tuple of (error_type, error_message) where:
        - error_type: Name of the exception class
        - error_message: String representation of the error, or error_type if empty
        
    Example:
        >>> try:
        ...     raise ValueError("Invalid input")
        ... except Exception as e:
        ...     error_type, error_msg = normalize_error_message(e)
        ...     print(f"{error_type}: {error_msg}")
        ValueError: Invalid input
    """
    error_type = type(error).__name__
    error_message = str(error)
    
    if not error_message or error_message == error_type:
        error_message = f"{error_type}: {error_message}" if error_message else error_type
    
    return error_type, error_message


def create_descriptive_error(error: Exception, context: str = "") -> str:
    """
    Create a descriptive error message with context and type-specific formatting.
    
    Enhances error messages by:
    - Adding context information
    - Formatting messages based on error type
    - Providing more user-friendly error descriptions
    
    Args:
        error: Exception object to create message for
        context: Optional additional context string to prepend to the error
        
    Returns:
        Descriptive error message string with context and formatting applied
        
    Example:
        >>> try:
        ...     raise KeyError("user_id")
        ... except Exception as e:
        ...     msg = create_descriptive_error(e, "Failed to process request")
        ...     print(msg)
        Failed to process request: Missing required field: 'user_id'
    """
    error_type, error_message = normalize_error_message(error)
    
    # Add common error context
    descriptive_error = error_message
    
    # Handle specific error types with better messages
    if isinstance(error, ValueError):
        if "not found" in error_message.lower():
            descriptive_error = f"Resource not found: {error_message}"
        else:
            descriptive_error = f"Invalid configuration: {error_message}"
    elif isinstance(error, KeyError):
        descriptive_error = f"Missing required field: {error_message}"
    elif "OpenAI" in str(type(error)) or "API" in error_type:
        descriptive_error = f"AI service error: {error_message}"
    elif "Connection" in error_type or "Timeout" in error_type:
        descriptive_error = f"Network error: {error_message}"
    elif "Permission" in error_type or "Access" in error_type:
        descriptive_error = f"Access denied: {error_message}"
    
    if context:
        descriptive_error = f"{context}: {descriptive_error}"
    
    return descriptive_error

