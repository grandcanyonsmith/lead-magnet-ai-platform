"""
Step order normalization utilities for workflow processing.

Handles normalization of step_order values which may be stored in various
formats in DynamoDB (string, int, float, Decimal).
"""

from typing import Dict, Any
from decimal import Decimal


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

