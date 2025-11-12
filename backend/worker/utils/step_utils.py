"""Step utilities for workflow processing."""

from typing import Dict, Any


def normalize_step_order(step: Dict[str, Any]) -> int:
    """
    Get the step order from a step dictionary.
    
    Args:
        step: Step dictionary that may have 'step_order' or 'stepOrder'
        
    Returns:
        Integer step order (1-indexed)
    """
    # Try both snake_case and camelCase
    step_order = step.get('step_order') or step.get('stepOrder')
    
    if step_order is None:
        return 0
    
    # Handle Decimal from DynamoDB
    if hasattr(step_order, '__int__'):
        return int(step_order)
    
    return step_order
