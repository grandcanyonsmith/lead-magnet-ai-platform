"""
Step order normalization utilities for workflow processing.

Handles normalization of step_order values which may be stored in various
formats in DynamoDB (string, int, float, Decimal).
"""

from typing import Dict, Any, List, Union, Optional, Tuple
from decimal import Decimal


def coerce_dependency_value(
    dep_value: Union[int, str, float, Decimal]
) -> Tuple[Optional[int], bool]:
    """
    Coerce a dependency value to an integer when safe.
    
    DynamoDB may store dependency values as Decimal, string, or number.
    This function handles all cases and returns a consistent integer value
    only if the input is an integer or represents an integer.
    
    Args:
        dep_value: Dependency value (could be int, str, float, or Decimal)
        
    Returns:
        Tuple of (normalized int value or None, was_coerced flag).
        
    Example:
        >>> coerce_dependency_value(Decimal('0'))
        (0, True)
        >>> coerce_dependency_value('1')
        (1, True)
        >>> coerce_dependency_value(2.0)
        (2, True)
    """
    if isinstance(dep_value, bool):
        return None, False
    if isinstance(dep_value, int):
        return dep_value, False
    if isinstance(dep_value, Decimal):
        try:
            if dep_value != dep_value.to_integral_value():
                return None, False
            return int(dep_value), True
        except Exception:
            return None, False
    if isinstance(dep_value, float):
        if not dep_value.is_integer():
            return None, False
        return int(dep_value), True
    if isinstance(dep_value, str):
        stripped = dep_value.strip()
        if not stripped:
            return None, False
        try:
            parsed = Decimal(stripped)
        except Exception:
            return None, False
        if parsed != parsed.to_integral_value():
            return None, False
        return int(parsed), True
    return None, False


def normalize_dependency_value(dep_value: Union[int, str, float, Decimal]) -> Optional[int]:
    """
    Normalize a dependency value to integer from various possible types.
    
    Returns None if the value cannot be safely coerced to an integer.
    """
    normalized, _ = coerce_dependency_value(dep_value)
    return normalized


def normalize_dependency_list(dep_list: List[Union[int, str, float, Decimal]]) -> List[int]:
    """
    Normalize a list of dependency values to integers.
    
    Args:
        dep_list: List of dependency values (may contain Decimal, str, int, float)
        
    Returns:
        List of normalized integer dependency values (invalid entries dropped)
    """
    normalized: List[int] = []
    for dep in dep_list:
        value = normalize_dependency_value(dep)
        if value is None:
            continue
        normalized.append(value)
    return normalized


def normalize_step_order(step_data: Dict[str, Any]) -> int:
    """
    Normalize step_order to integer from various possible types.
    
    DynamoDB may store step_order as string, number, or Decimal depending on
    how the data was inserted. This function handles all cases and returns
    a consistent integer value.
    
    Args:
        step_data: Step data dictionary containing step_order field
        
    Returns:
        Integer step_order value. Returns 0 if:
        - step_order is missing from step_data
        - step_order cannot be converted to int
        - step_order is None or invalid type
        
    Example:
        >>> normalize_step_order({'step_order': '5'})
        5
        >>> normalize_step_order({'step_order': 10})
        10
        >>> normalize_step_order({'step_order': Decimal('3')})
        3
        >>> normalize_step_order({})
        0
    """
    step_order = step_data.get('step_order', 0)
    if isinstance(step_order, int):
        return step_order
    elif isinstance(step_order, str):
        try:
            return int(step_order)
        except (ValueError, TypeError):
            return 0
    elif isinstance(step_order, (float, Decimal)):
        return int(step_order)
    else:
        return 0

