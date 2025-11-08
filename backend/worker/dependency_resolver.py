"""
Dependency Resolution Engine for Python
Handles building dependency graphs, detecting parallel opportunities, and resolving execution groups
"""

from typing import Dict, List, Set, Tuple, Optional
from enum import Enum


class StepStatus(Enum):
    COMPLETED = "completed"
    RUNNING = "running"
    WAITING = "waiting"
    READY = "ready"


def build_dependency_graph(steps: List[Dict]) -> Dict[int, List[int]]:
    """
    Build dependency graph from workflow steps.
    
    Args:
        steps: List of step dictionaries
        
    Returns:
        Dictionary mapping step index to list of dependency indices
    """
    dependencies: Dict[int, List[int]] = {}
    
    for index, step in enumerate(steps):
        deps: List[int] = []
        
        if step.get('depends_on') and isinstance(step.get('depends_on'), list):
            # Explicit dependencies provided
            deps = [
                dep_index for dep_index in step['depends_on']
                if isinstance(dep_index, int) and 0 <= dep_index < len(steps) and dep_index != index
            ]
        else:
            # Auto-detect from step_order
            step_order = step.get('step_order', index)
            
            # Find all steps with lower step_order
            for i, s in enumerate(steps):
                other_order = s.get('step_order', i)
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
            print(f"WARNING: No ready steps found, but {len(completed)}/{len(steps)} steps completed. Possible circular dependency.")
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
    
    # Check for invalid dependency indices
    for index, step in enumerate(steps):
        if step.get('depends_on') and isinstance(step.get('depends_on'), list):
            for dep_index in step['depends_on']:
                if not isinstance(dep_index, int) or dep_index < 0 or dep_index >= len(steps):
                    errors.append(f"Step {index} ({step.get('step_name', 'Unknown')}): depends_on index {dep_index} is out of range")
                if dep_index == index:
                    errors.append(f"Step {index} ({step.get('step_name', 'Unknown')}): cannot depend on itself")
    
    # Check for circular dependencies using DFS
    visited: Set[int] = set()
    rec_stack: Set[int] = set()
    
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
        deps: List[int] = []
        
        if step.get('depends_on') and isinstance(step.get('depends_on'), list):
            deps = step['depends_on']
        elif step.get('step_order') is not None:
            # Auto-detect from step_order
            step_order = step.get('step_order', node_index)
            for i, s in enumerate(steps):
                other_order = s.get('step_order', i)
                if other_order < step_order:
                    deps.append(i)
        
        for dep_index in deps:
            if dep_index < 0 or dep_index >= len(steps):
                continue  # Skip invalid indices
            if has_cycle(dep_index):
                return True
        
        rec_stack.remove(node_index)
        return False
    
    for i in range(len(steps)):
        if i not in visited and has_cycle(i):
            errors.append(f"Circular dependency detected involving step {i} ({steps[i].get('step_name', 'Unknown')})")
            break
    
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

