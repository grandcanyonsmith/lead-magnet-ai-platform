"""
Step Context Service
Handles building context for workflow steps from submission data and previous step outputs.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple

from services.context_builder import ContextBuilder
from utils.step_utils import normalize_step_order

logger = logging.getLogger(__name__)


class StepContextService:
    """Service for building context for workflow steps."""
    
    def build_contexts_for_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        initial_context: str,
        execution_steps: List[Dict[str, Any]],
        step_deps: List[int],
        step_tools: List[Dict[str, Any]],
        job_id: str
    ) -> Tuple[str, str, Optional[List[str]]]:
        """
        Build previous context, current step context, and collect previous image URLs.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            initial_context: Initial formatted submission context
            execution_steps: List of execution steps
            step_deps: List of dependency indices
            step_tools: List of step tools
            job_id: Job ID for logging
            
        Returns:
            Tuple of (all_previous_context, current_step_context, previous_image_urls)
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        current_step_order = step_index + 1
        
        # Build context only from dependency steps
        all_previous_context = ContextBuilder.build_previous_context_from_execution_steps(
            initial_context=initial_context,
            execution_steps=execution_steps,
            current_step_order=current_step_order,
            dependency_indices=step_deps
        )
        
        logger.info(f"[StepContextService] Built previous context for step {step_index + 1}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'current_step_order': current_step_order,
            'previous_steps_count': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order]),
            'previous_context_length': len(all_previous_context),
            'previous_steps_with_images': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order and s.get('image_urls')])
        })
        
        # Current step context
        current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
        
        # Collect previous image URLs for image generation steps
        previous_image_urls = None
        has_image_generation = any(
            isinstance(t, dict) and t.get('type') == 'image_generation' 
            for t in step_tools
        ) if step_tools else False
        
        if has_image_generation:
            previous_image_urls = ContextBuilder.collect_previous_image_urls(
                execution_steps=execution_steps,
                current_step_order=current_step_order
            )
            logger.info(f"[StepContextService] Collected previous image URLs for image generation step", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'previous_image_urls_count': len(previous_image_urls),
                'previous_image_urls': previous_image_urls
            })
        
        return all_previous_context, current_step_context, previous_image_urls
    
    def build_contexts_for_batch_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        initial_context: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
        step_tools: List[Dict[str, Any]],
        job_id: str
    ) -> Tuple[str, str, Optional[List[str]]]:
        """
        Build contexts for batch mode processing.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            initial_context: Initial formatted submission context
            step_outputs: List of previous step outputs (for context building)
            sorted_steps: List of all steps sorted by order
            execution_steps: List of execution steps
            step_tools: List of step tools
            job_id: Job ID for logging
            
        Returns:
            Tuple of (all_previous_context, current_step_context, previous_image_urls)
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        
        # Build context with ALL previous step outputs (batch mode uses step_outputs)
        all_previous_context = ContextBuilder.build_previous_context_from_step_outputs(
            initial_context=initial_context,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps
        )
        
        logger.info(f"[StepContextService] Built previous context for step {step_index + 1} (batch mode)", extra={
            'job_id': job_id,
            'step_index': step_index,
            'previous_steps_count': len(step_outputs),
            'previous_context_length': len(all_previous_context),
            'previous_step_names': [sorted_steps[i].get('step_name') for i in range(len(step_outputs))],
            'previous_steps_with_images': len([s for s in step_outputs if s.get('image_urls')])
        })
        
        # Current step context (empty for subsequent steps, initial_context for first step)
        current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
        
        # Collect previous image URLs for image generation steps
        previous_image_urls = None
        has_image_generation = any(
            isinstance(t, dict) and t.get('type') == 'image_generation' 
            for t in step_tools
        ) if step_tools else False
        
        if has_image_generation:
            previous_image_urls = ContextBuilder.collect_previous_image_urls(
                execution_steps=execution_steps,
                current_step_order=step_index + 1
            )
            logger.info(f"[StepContextService] Collected previous image URLs for image generation step (batch mode)", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'previous_image_urls_count': len(previous_image_urls),
                'previous_image_urls': previous_image_urls
            })
        
        return all_previous_context, current_step_context, previous_image_urls

