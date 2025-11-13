"""Decimal utilities for JSON serialization."""
from decimal import Decimal
from typing import Any


def convert_decimals_to_float(obj: Any) -> Any:
    """
    Recursively convert Decimal types to float for JSON serialization.
    This fixes the "Object of type Decimal is not JSON serializable" error.
    
    Args:
        obj: Object that may contain Decimal values (dict, list, or Decimal)
        
    Returns:
        Object with Decimals converted to float
    """
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_float(item) for item in obj]
    return obj


def convert_decimals_to_int(obj: Any) -> Any:
    """
    Recursively convert Decimal and float types to int for JSON serialization.
    Use this for timestamps, counts, and integer fields like display_width.
    
    Args:
        obj: Object that may contain Decimal or float values
        
    Returns:
        Object with Decimals and whole-number floats converted to int
    """
    if isinstance(obj, Decimal):
        return int(obj)
    elif isinstance(obj, float):
        # Convert float to int if it represents a whole number
        # This handles cases where Decimal was converted to float (e.g., 1024.0 -> 1024)
        if obj.is_integer():
            return int(obj)
        return obj  # Keep non-integer floats as-is
    elif isinstance(obj, dict):
        return {k: convert_decimals_to_int(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_int(item) for item in obj]
    return obj


def convert_floats_to_decimal(obj: Any) -> Any:
    """
    Recursively convert float types to Decimal for DynamoDB storage.
    DynamoDB requires Decimal type for numeric values to maintain precision.
    
    Args:
        obj: Object that may contain float values (dict, list, or float)
        
    Returns:
        Object with floats converted to Decimal
    """
    if isinstance(obj, float):
        return Decimal(str(obj))  # Convert via string to avoid precision issues
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    return obj
