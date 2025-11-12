"""Context builder for AI step processing."""

import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class ContextBuilder:
    """Builds context strings for AI processing from submission data and previous steps."""
    
    @staticmethod
    def format_submission_data_with_labels(
        data: Dict[str, Any],
        field_label_map: Dict[str, str]
    ) -> str:
        """
        Format submission data using field labels instead of field IDs.
        
        Args:
            data: Submission data dictionary with field IDs as keys
            field_label_map: Map of field IDs to human-readable labels
            
        Returns:
            Formatted string with labeled data
        """
        formatted_lines = []
        
        for field_id, value in data.items():
            label = field_label_map.get(field_id, field_id)
            
            # Skip empty values
            if value is None or value == '':
                continue
            
            # Format as key-value pair
            formatted_lines.append(f"{label}: {value}")
        
        return '\n'.join(formatted_lines) if formatted_lines else ''
    
    @staticmethod
    def build_previous_context_from_step_outputs(
        initial_context: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Build context from step outputs for a given step.
        
        Args:
            initial_context: Initial context (form submission)
            step_outputs: List of step output dictionaries with 'output', 'step_name', etc.
            sorted_steps: List of sorted workflow steps
            
        Returns:
            Accumulated context string
        """
        context_parts = []
        
        # Add initial context (form submission)
        if initial_context:
            context_parts.append(f"FORM SUBMISSION:\n{initial_context}")
        
        # Add all previous step outputs
        for i, step_output in enumerate(step_outputs):
            output_text = step_output.get('output', '')
            step_name = step_output.get('step_name', f'Step {i + 1}')
            
            if output_text:
                context_parts.append(f"STEP {i + 1} ({step_name}):\n{output_text}")
                
                # Add image URLs if present
                image_urls = step_output.get('image_urls', [])
                if image_urls:
                    context_parts.append(f"Generated Images:\n" + "\n".join([f"- {url}" for url in image_urls]))
        
        return '\n\n'.join(context_parts)
    
    @staticmethod
    def build_previous_context_from_execution_steps(
        initial_context: str,
        execution_steps: List[Dict[str, Any]],
        dependency_indices: List[int]
    ) -> str:
        """
        Build context from execution steps (for dependency-based execution).
        
        Args:
            initial_context: Initial context (form submission)
            execution_steps: List of execution step dictionaries
            dependency_indices: List of step indices this step depends on
            
        Returns:
            Accumulated context string
        """
        context_parts = []
        
        # Add initial context (form submission)
        if initial_context:
            context_parts.append(f"FORM SUBMISSION:\n{initial_context}")
        
        # Add outputs from dependency steps only
        for step in execution_steps:
            if step.get('step_type') != 'ai_generation':
                continue
            
            step_order = step.get('step_order', 0)
            step_index = step_order - 1  # Convert to 0-indexed
            
            # Only include if this is a dependency
            if step_index in dependency_indices:
                output = step.get('output', '')
                if output:
                    context_parts.append(f"STEP {step_order} OUTPUT:\n{output}")
        
        return '\n\n'.join(context_parts)
    
    @staticmethod
    def get_current_step_context(step_index: int, initial_context: str) -> str:
        """
        Get context for the current step.
        For first step (index 0), returns initial_context.
        For subsequent steps, returns empty string (they get context from previous steps).
        
        Args:
            step_index: 0-indexed step index
            initial_context: Initial context from form submission
            
        Returns:
            Context string for current step
        """
        if step_index == 0:
            return initial_context
        return ''
    
    @staticmethod
    def build_accumulated_context_for_html(
        initial_context: str,
        execution_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Build accumulated context for HTML generation from all workflow steps.
        
        Args:
            initial_context: Initial context (form submission)
            execution_steps: List of execution step dictionaries
            
        Returns:
            Accumulated context string for HTML generation
        """
        context_parts = []
        
        # Add initial context (form submission)
        if initial_context:
            context_parts.append(f"FORM SUBMISSION:\n{initial_context}")
        
        # Add all AI generation step outputs
        for step in execution_steps:
            if step.get('step_type') == 'ai_generation':
                step_order = step.get('step_order', 0)
                output = step.get('output', '')
                
                if output:
                    step_name = step.get('step_name', f'Step {step_order}')
                    context_parts.append(f"{step_name.upper()} (STEP {step_order}):\n{output}")
        
        return '\n\n'.join(context_parts)
