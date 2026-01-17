"""
Dependency Resolution Engine for Python
Handles building dependency graphs, detecting parallel opportunities, and resolving execution groups
"""

import logging
from typing import Dict, List, Set, Tuple, Optional, Any
from enum import Enum
from utils.step_utils import coerce_dependency_value, normalize_dependency_list, normalize_step_order

logger = logging.getLogger(__name__)


class StepStatus(Enum):
    COMPLETED = "completed"
    RUNNING = "running"
    WAITING = "waiting"
    READY = "ready"


# Helper functions

def _build_order_to_index(steps: List[Dict]) -> Dict[int, int]:
    """
    Build a mapping from step_order to array index for normalization.
    
    Args:
        steps: List of step dictionaries
        
    Returns:
        Dictionary mapping step_order to array index
    """
    order_to_index: Dict[int, int] = {}
    for index, step in enumerate(steps):
        step_order = normalize_step_order(step)
        order_to_index[step_order] = index
    return order_to_index


def _normalize_dependency_index(
    dep_value: Any,
    order_to_index: Dict[int, int],
    steps_length: int,
    current_index: int
) -> Optional[int]:
    """
    Normalize a dependency value (step_order or array index) to an array index.
    
    Args:
        dep_value: Dependency value (could be step_order or array index)
        order_to_index: Mapping from step_order to array index
        steps_length: Total number of steps
        current_index: Index of the current step (to prevent self-dependencies)
        
    Returns:
        Normalized array index, or None if invalid
    """
    dep_index_value, _ = coerce_dependency_value(dep_value)
    if dep_index_value is None:
        return None
    
    # Try to normalize: if dep_value matches a step_order, convert to array index
    dep_index = dep_index_value
    if dep_index_value in order_to_index:
        dep_index = order_to_index[dep_index_value]
    elif dep_index_value >= 0 and dep_index_value < steps_length:
        # Already an array index, use as-is
        dep_index = dep_index_value
    else:
        # Invalid - doesn't match any step_order or array index
        return None
    
    # Validate normalized index
    if dep_index < 0 or dep_index >= steps_length or dep_index == current_index:
        return None
    
    return dep_index


def _get_step_dependencies(step: Dict, step_index: int, steps: List[Dict]) -> List[int]:
    """
    Extract dependencies for a step, handling both explicit and auto-detected dependencies.
    
    Args:
        step: Step dictionary
        step_index: Index of the step in the steps list
        steps: List of all step dictionaries
        
    Returns:
        List of dependency indices
    """
    deps: List[int] = []
    
    if step.get('depends_on') and isinstance(step.get('depends_on'), list):
        # Explicit dependencies provided
        deps = normalize_dependency_list(step['depends_on'])
    else:
        # Auto-detect from step_order
        step_order = normalize_step_order(step)
        for i, s in enumerate(steps):
            other_order = normalize_step_order(s)
            if other_order < step_order:
                deps.append(i)
    
    return deps


def build_dependency_graph(steps: List[Dict]) -> Dict[int, List[int]]:
    """
    Build dependency graph from workflow steps.
    
    Args:
        steps: List of step dictionaries
        
    Returns:
        Dictionary mapping step index to list of dependency indices
    """
    dependencies: Dict[int, List[int]] = {}
    order_to_index = _build_order_to_index(steps)
    
    for index, step in enumerate(steps):
        deps: List[int] = []
        
        if step.get('depends_on') and isinstance(step.get('depends_on'), list):
            # Explicit dependencies provided - normalize step_order values to array indices
            for dep_value in normalize_dependency_list(step['depends_on']):
                dep_index = _normalize_dependency_index(
                    dep_value, order_to_index, len(steps), index
                )
                if dep_index is not None:
                    deps.append(dep_index)
        else:
            # Auto-detect from step_order
            step_order = normalize_step_order(step)
            for i, s in enumerate(steps):
                other_order = normalize_step_order(s)
                if other_order < step_order:
                    deps.append(i)
        
        dependencies[index] = deps
    
    return dependencies


def detect_parallel_opportunities(steps: List[Dict]) -> Dict[int, List[int]]:
    """
    Detect parallel opportunities from step_order.
    Steps with the same step_order can run in parallel.
    
    Args:
        steps: List of step dictionaries
        
    Returns:
        Dictionary mapping step_order to list of step indices
    """
    order_groups: Dict[int, List[int]] = {}
    
    for index, step in enumerate(steps):
        step_order = step.get('step_order', index)
        
        if step_order not in order_groups:
            order_groups[step_order] = []
        order_groups[step_order].append(index)
    
    return order_groups


def resolve_execution_groups(steps: List[Dict]) -> Dict:
    """
    Resolve execution groups - group steps into batches that can run in parallel.
    
    Args:
        steps: List of step dictionaries
        
    Returns:
        Dictionary with executionGroups and totalSteps
    """
    if not steps:
        return {
            'executionGroups': [],
            'totalSteps': 0,
        }
    
    dependencies = build_dependency_graph(steps)
    execution_groups: List[Dict] = []
    completed: Set[int] = set()
    group_index = 0
    
    while len(completed) < len(steps):
        # Find all steps that are ready to execute (all dependencies completed)
        ready_steps: List[int] = []
        
        for i in range(len(steps)):
            if i in completed:
                continue  # Already completed
            
            deps = dependencies.get(i, [])
            all_deps_completed = len(deps) == 0 or all(dep_index in completed for dep_index in deps)
            
            if all_deps_completed:
                ready_steps.append(i)
        
        if len(ready_steps) == 0:
            # This shouldn't happen if dependencies are valid, but handle gracefully
            logger.warning(
                f"No ready steps found, but {len(completed)}/{len(steps)} steps completed. "
                "Possible circular dependency."
            )
            break
        
        # Check if steps in this group can run in parallel
        # Steps can run in parallel if they don't depend on each other
        can_run_in_parallel = len(ready_steps) > 1 and not _has_internal_dependencies(ready_steps, dependencies)
        
        execution_groups.append({
            'groupIndex': group_index,
            'stepIndices': ready_steps,
            'canRunInParallel': can_run_in_parallel or len(ready_steps) == 1,
        })
        
        # Mark these steps as completed for next iteration
        completed.update(ready_steps)
        group_index += 1
    
    return {
        'executionGroups': execution_groups,
        'totalSteps': len(steps),
    }


def _has_internal_dependencies(step_indices: List[int], dependencies: Dict[int, List[int]]) -> bool:
    """Check if steps in a group have internal dependencies (can't run in parallel)."""
    for step_index in step_indices:
        deps = dependencies.get(step_index, [])
        # If any dependency is also in this group, they can't run in parallel
        if any(dep_index in step_indices for dep_index in deps):
            return True
    return False


def validate_dependencies(steps: List[Dict]) -> Tuple[bool, List[str]]:
    """
    Validate dependencies - check for circular dependencies and invalid references.
    
    Args:
        steps: List of step dictionaries
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors: List[str] = []
    
    if not steps:
        return True, []
    
    order_to_index = _build_order_to_index(steps)
    
    # Check for invalid dependency indices
    coerced_values: List[Dict[str, Any]] = []
    for index, step in enumerate(steps):
        if step.get('depends_on') and isinstance(step.get('depends_on'), list):
            step_order = normalize_step_order(step)
            step_name = step.get('step_name', 'Unknown')
            
            for dep_value in step['depends_on']:
                dep_index_value, was_coerced = coerce_dependency_value(dep_value)
                if dep_index_value is None:
                    errors.append(
                        f"Step {step_order} ({step_name}): "
                        f"depends_on contains invalid value {dep_value} "
                        f"(type={type(dep_value).__name__})"
                    )
                    continue
                if was_coerced:
                    coerced_values.append({
                        "step_order": step_order,
                        "step_name": step_name,
                        "raw_value": dep_value,
                        "normalized": dep_index_value,
                    })
                
                dep_index = _normalize_dependency_index(
                    dep_index_value, order_to_index, len(steps), index
                )
                
                if dep_index is None:
                    # Provide more helpful error message
                    # Check if dep_value matches a step_order
                    matching_order = None
                    for order, idx in order_to_index.items():
                        if order == dep_index_value:
                            matching_order = order
                            break
                    
                    if matching_order is not None:
                        # It matched a step_order but normalization failed (self-dependency or invalid)
                        errors.append(
                            f"Step {step_order} ({step_name}): "
                            f"depends_on step_order {dep_index_value} is invalid "
                            f"(could be self-dependency or step doesn't exist)"
                        )
                    elif dep_index_value >= 0 and dep_index_value < len(steps):
                        # It's a valid array index but normalization failed
                        errors.append(
                            f"Step {step_order} ({step_name}): "
                            f"depends_on array index {dep_index_value} is invalid "
                            f"(could be self-dependency)"
                        )
                    else:
                        # Completely out of range
                        errors.append(
                            f"Step {step_order} ({step_name}): "
                            f"depends_on value {dep_index_value} is out of range "
                            f"(valid step_orders: {sorted(order_to_index.keys())}, "
                            f"valid array indices: 0-{len(steps)-1})"
                        )
                    continue
                
                # Additional validation for error messages
                if dep_index == index:
                    errors.append(
                        f"Step {step_order} ({step_name}): "
                        "cannot depend on itself"
                    )
    
    # Check for circular dependencies using DFS
    visited: Set[int] = set()
    rec_stack: Set[int] = set()
    order_to_index_for_cycle = _build_order_to_index(steps)
    
    def has_cycle(node_index: int) -> bool:
        if node_index < 0 or node_index >= len(steps):
            return False  # Invalid index, skip
        if node_index in rec_stack:
            return True  # Found a cycle
        if node_index in visited:
            return False  # Already processed
        
        visited.add(node_index)
        rec_stack.add(node_index)
        
        step = steps[node_index]
        dep_values = _get_step_dependencies(step, node_index, steps)
        
        # Normalize dependency values to indices
        for dep_value in dep_values:
            dep_index = _normalize_dependency_index(
                dep_value, order_to_index_for_cycle, len(steps), node_index
            )
            if dep_index is not None and has_cycle(dep_index):
                return True
        
        rec_stack.remove(node_index)
        return False
    
    for i in range(len(steps)):
        if i not in visited and has_cycle(i):
            errors.append(f"Circular dependency detected involving step {i} ({steps[i].get('step_name', 'Unknown')})")
            break

    if coerced_values:
        logger.info(
            "[DependencyResolver] Coerced depends_on values to integers",
            extra={
                "coerced_count": len(coerced_values),
                "coerced_samples": coerced_values[:5],
                "total_steps": len(steps),
            },
        )
    
    return len(errors) == 0, errors


def get_ready_steps(completed_step_indices: List[int], all_steps: List[Dict]) -> List[int]:
    """
    Get steps that are ready to execute based on completed steps.
    
    Args:
        completed_step_indices: List of completed step indices
        all_steps: List of all step dictionaries
        
    Returns:
        List of ready step indices
    """
    completed = set(completed_step_indices)
    dependencies = build_dependency_graph(all_steps)
    ready_steps: List[int] = []
    
    for i in range(len(all_steps)):
        if i in completed:
            continue  # Already completed
        
        deps = dependencies.get(i, [])
        all_deps_completed = len(deps) == 0 or all(dep_index in completed for dep_index in deps)
        
        if all_deps_completed:
            ready_steps.append(i)
    
    return ready_steps


def get_step_status(
    completed_step_indices: List[int],
    running_step_indices: List[int],
    all_steps: List[Dict]
) -> Dict[int, str]:
    """
    Get step status for all steps.
    
    Args:
        completed_step_indices: List of completed step indices
        running_step_indices: List of running step indices
        all_steps: List of all step dictionaries
        
    Returns:
        Dictionary mapping step index to status string
    """
    status: Dict[int, str] = {}
    completed = set(completed_step_indices)
    running = set(running_step_indices)
    ready_steps = get_ready_steps(completed_step_indices, all_steps)
    
    for index in range(len(all_steps)):
        if index in completed:
            status[index] = StepStatus.COMPLETED.value
        elif index in running:
            status[index] = StepStatus.RUNNING.value
        elif index in ready_steps:
            status[index] = StepStatus.READY.value
        else:
            status[index] = StepStatus.WAITING.value
    
    return status

