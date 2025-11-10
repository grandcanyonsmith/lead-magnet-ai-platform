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
    Recursively convert Decimal types to int for JSON serialization.
    Use this for timestamps and counts.
    
    Args:
        obj: Object that may contain Decimal values
        
    Returns:
        Object with Decimals converted to int
    """
    if isinstance(obj, Decimal):
        return int(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals_to_int(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_int(item) for item in obj]
    return obj
