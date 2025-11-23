"""
Dependency Validation Service
Handles validation and normalization of step dependencies.
"""

import logging
from typing import Dict, Any, List

from utils.step_utils import normalize_step_order, normalize_dependency_list
from core.dependency_resolver import get_ready_steps, get_step_status

logger = logging.getLogger(__name__)


class DependencyValidationService:
    """Service for validating and normalizing step dependencies."""
    
    def normalize_dependencies(
        self,
        step: Dict[str, Any],
        step_index: int,
        steps: List[Dict[str, Any]]
    ) -> List[int]:
        """
        Normalize and extract step dependencies.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            steps: List of all steps
            
        Returns:
            List of dependency indices (0-based)
        """
        step_deps = step.get('depends_on', [])
        if not step_deps:
            # Auto-detect from step_order
            step_order = step.get('step_order', step_index)
            step_deps = [
                i for i, s in enumerate(steps)
                if s.get('step_order', i) < step_order
            ]
        else:
            # Normalize dependency values (handle Decimal types from DynamoDB)
            step_deps = normalize_dependency_list(step_deps)
        return step_deps
    
    def get_completed_step_indices(
        self,
        execution_steps: List[Dict[str, Any]]
    ) -> List[int]:
        """
        Get list of completed step indices from execution_steps.
        
        Args:
            execution_steps: List of execution steps
            
        Returns:
            List of completed step indices (0-based)
        """
        return [
            normalize_step_order(s) - 1  # Convert 1-indexed step_order to 0-indexed
            for s in execution_steps
            if s.get('step_type') in ['ai_generation', 'webhook'] and normalize_step_order(s) > 0
        ]
    
    def validate_dependencies(
        self,
        step: Dict[str, Any],
        step_index: int,
        steps: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
        job_id: str
    ) -> None:
        """
        Validate that all step dependencies are satisfied.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            steps: List of all steps
            execution_steps: List of execution steps
            job_id: Job ID for logging
            
        Raises:
            ValueError: If dependencies are not satisfied
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        # Normalize dependencies
        step_deps = self.normalize_dependencies(step, step_index, steps)
        
        # Get completed step indices
        completed_step_indices = self.get_completed_step_indices(execution_steps)
        
        logger.debug(f"[DependencyValidationService] Dependency check", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_deps': step_deps,
            'completed_step_indices': completed_step_indices,
            'execution_steps_count': len(execution_steps),
            'execution_steps_types': [s.get('step_type') for s in execution_steps],
            'execution_steps_orders': [normalize_step_order(s) for s in execution_steps]
        })
        
        # Check if all dependencies are completed
        all_deps_completed = len(step_deps) == 0 or all(dep_index in completed_step_indices for dep_index in step_deps)
        
        if not all_deps_completed:
            missing_deps = [dep for dep in step_deps if dep not in completed_step_indices]
            logger.warning(f"[DependencyValidationService] Step {step_index + 1} ({step_name}) waiting for dependencies", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_status': 'waiting',
                'missing_dependencies': missing_deps,
                'completed_steps': completed_step_indices
            })
            raise ValueError(f"Step {step_index + 1} ({step_name}) cannot execute yet. Missing dependencies: {missing_deps}")
        
        # Get ready steps for logging (only for AI steps)
        if step_type != 'webhook':
            ready_steps = get_ready_steps(completed_step_indices, steps)
            step_status_map = get_step_status(completed_step_indices, [], steps)
            
            logger.info(f"[DependencyValidationService] Step readiness check", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_status': 'ready',
                'dependencies': step_deps,
                'all_dependencies_completed': all_deps_completed,
                'ready_steps': ready_steps,
                'step_status_map': {k: v for k, v in step_status_map.items()}
            })

