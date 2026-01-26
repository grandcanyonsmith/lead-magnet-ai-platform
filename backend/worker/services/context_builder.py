"""
Context Builder Service
Handles building context for workflow steps from submission data and previous step outputs.
"""

import json
import logging
from typing import Dict, Any, List, Set, Optional
from utils.image_utils import extract_image_urls, extract_image_urls_from_object

logger = logging.getLogger(__name__)


class ContextBuilder:
    """Service for building context strings for workflow steps."""

    @staticmethod
    def _stringify_step_output(output: Any) -> str:
        """Convert step output to a stable string representation."""
        if output is None:
            return ""
        if isinstance(output, (dict, list)):
            try:
                return json.dumps(output, ensure_ascii=False, indent=2)
            except Exception:
                return str(output)
        return str(output)

    @staticmethod
    def _resolve_deliverable_indices(sorted_steps: List[Dict[str, Any]]) -> List[int]:
        """Resolve which workflow steps should be treated as deliverable sources."""
        from utils.step_utils import normalize_step_order

        if not sorted_steps:
            return []

        deliverable_indices = [
            idx for idx, step in enumerate(sorted_steps)
            if step.get('is_deliverable') is True
        ]
        if deliverable_indices:
            return deliverable_indices

        max_order = max(normalize_step_order(step) for step in sorted_steps)
        return [
            idx for idx, step in enumerate(sorted_steps)
            if normalize_step_order(step) == max_order
        ]
    
    @staticmethod
    def format_submission_data_with_labels(data: Dict[str, Any], field_label_map: Dict[str, str]) -> str:
        """
        Format submission data using field labels instead of field IDs.
        
        Args:
            data: Submission data dictionary
            field_label_map: Map of field IDs to labels
            
        Returns:
            Formatted string with labels
        """
        from utils.decimal_utils import convert_decimals_to_float
        
        # Convert Decimal values to float for proper string formatting
        serializable_data = convert_decimals_to_float(data)
        
        lines = []
        for key, value in serializable_data.items():
            label = field_label_map.get(key, key)  # Use label if available, otherwise use key
            lines.append(f"{label}: {value}")
        return "\n".join(lines)
    
    @staticmethod
    def build_previous_context_from_step_outputs(
        initial_context: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        dependency_indices: Optional[List[int]] = None,
        include_form_submission: bool = True
    ) -> str:
        """
        Build previous context string from step outputs.
        
        Args:
            initial_context: Formatted submission context
            step_outputs: List of step output dictionaries
            sorted_steps: List of step configurations sorted by order
            dependency_indices: Optional list of step indices to include
            include_form_submission: Whether to include form submission (only True for first step)
            
        Returns:
            Combined previous context string
        """
        all_previous_outputs = []
        if include_form_submission:
            all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
        
        # Include dependency step outputs explicitly (with image URLs if present)
        for prev_idx, prev_step_output in enumerate(step_outputs):
            step_index = prev_step_output.get("step_index", prev_idx)
            if dependency_indices is not None and step_index not in dependency_indices:
                continue

            step_number = step_index + 1
            prev_step_name = prev_step_output.get("step_name")
            if not prev_step_name and 0 <= step_index < len(sorted_steps):
                prev_step_name = sorted_steps[step_index].get("step_name")
            prev_step_name = prev_step_name or f"Step {step_number}"
            prev_output_raw = prev_step_output.get('output', '')
            prev_output_text = ContextBuilder._stringify_step_output(prev_output_raw)
            
            # Extract image URLs from multiple sources:
            # 1. From image_urls array in step output
            prev_image_urls_raw = prev_step_output.get('image_urls', [])
            # Normalize to list: handle None, empty list, or already a list
            if prev_image_urls_raw is None:
                image_urls_from_array = []
            elif isinstance(prev_image_urls_raw, list):
                image_urls_from_array = [url for url in prev_image_urls_raw if url]  # Filter out None/empty strings
            else:
                # If it's not a list, try to convert (shouldn't happen, but be safe)
                image_urls_from_array = [str(prev_image_urls_raw)] if prev_image_urls_raw else []
            
            # 2. Extract image URLs from the output text itself
            image_urls_from_text = []
            if isinstance(prev_output_raw, str):
                image_urls_from_text = extract_image_urls(prev_output_raw)
            elif isinstance(prev_output_raw, (dict, list)):
                image_urls_from_text = extract_image_urls_from_object(prev_output_raw)
            
            # Combine and deduplicate all image URLs
            all_image_urls: Set[str] = set(image_urls_from_array) | set(image_urls_from_text)
            prev_image_urls = sorted(list(all_image_urls))  # Sort for consistent output
            
            step_context = f"\n=== Step {step_number}: {prev_step_name} ===\n{prev_output_text}"
            if prev_image_urls:
                step_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in prev_image_urls])
            all_previous_outputs.append(step_context)
        
        # Combine all previous outputs into context
        return "\n\n".join(all_previous_outputs)
    
    @staticmethod
    def build_previous_context_from_execution_steps(
        initial_context: str,
        execution_steps: List[Dict[str, Any]],
        current_step_order: int,
        dependency_indices: Optional[List[int]] = None,
        include_form_submission: bool = True
    ) -> str:
        """
        Build previous context from execution_steps.
        
        Note: Execution steps are stored in S3 (not DynamoDB), but are loaded into memory
        by db_service.get_job() when s3_service is provided.
        
        Args:
            initial_context: Formatted submission context
            execution_steps: List of execution step dictionaries (loaded from S3)
            current_step_order: Order of current step (1-indexed)
            dependency_indices: Optional list of step indices to include
            include_form_submission: Whether to include form submission (only True for first step)
            
        Returns:
            Combined previous context string
        """
        from utils.step_utils import normalize_step_order
        
        all_previous_outputs = []
        if include_form_submission:
            all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
        
        # Load previous step outputs from execution_steps
        # Filter to only include workflow-relevant steps (exclude internal/system steps)
        def _is_context_step(step_data: Dict[str, Any]) -> bool:
            step_type = step_data.get("step_type")
            if step_type in {"s3_upload", "form_submission"}:
                return False
            return True

        sorted_execution_steps = sorted(
            [s for s in execution_steps if _is_context_step(s)],
            key=normalize_step_order,
        )
        
        for prev_step_data in sorted_execution_steps:
            prev_step_order = normalize_step_order(prev_step_data)
            
            # Determine if this step should be included
            should_include = False
            if dependency_indices is not None:
                # Include if workflow step index matches a dependency index
                should_include = (prev_step_order - 1) in dependency_indices
            else:
                # Default: include all steps that come before the current step
                should_include = prev_step_order < current_step_order
            
            if should_include:
                prev_step_name = prev_step_data.get('step_name', 'Unknown Step')
                prev_output_raw = prev_step_data.get('output', '')
                prev_output_text = ContextBuilder._stringify_step_output(prev_output_raw)
                
                # Extract image URLs from multiple sources:
                # 1. From image_urls array in execution step
                prev_image_urls_raw = prev_step_data.get('image_urls', [])
                # Normalize to list: handle None, empty list, or already a list
                if prev_image_urls_raw is None:
                    image_urls_from_array = []
                elif isinstance(prev_image_urls_raw, list):
                    image_urls_from_array = [url for url in prev_image_urls_raw if url]  # Filter out None/empty strings
                else:
                    # If it's not a list, try to convert (shouldn't happen, but be safe)
                    image_urls_from_array = [str(prev_image_urls_raw)] if prev_image_urls_raw else []
                
                # 2. Extract image URLs from the output text itself
                image_urls_from_text = []
                if isinstance(prev_output_raw, str):
                    image_urls_from_text = extract_image_urls(prev_output_raw)
                elif isinstance(prev_output_raw, (dict, list)):
                    image_urls_from_text = extract_image_urls_from_object(prev_output_raw)
                
                # Combine and deduplicate all image URLs
                all_image_urls: Set[str] = set(image_urls_from_array) | set(image_urls_from_text)
                prev_image_urls = sorted(list(all_image_urls))  # Sort for consistent output
                
                step_context = f"\n=== Step {prev_step_order}: {prev_step_name} ===\n{prev_output_text}"
                if prev_image_urls:
                    step_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in prev_image_urls])
                all_previous_outputs.append(step_context)
        
        # Combine all previous outputs into context
        return "\n\n".join(all_previous_outputs)
    
    @staticmethod
    def build_accumulated_context_for_html(
        initial_context: str,
        execution_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Build accumulated context from all workflow steps for HTML generation.
        
        Args:
            initial_context: Formatted submission context
            execution_steps: List of execution step dictionaries
            
        Returns:
            Accumulated context string
        """
        accumulated_context = f"=== Form Submission ===\n{initial_context}\n\n"
        for step_data in execution_steps:
            if step_data.get('step_type') == 'ai_generation':
                step_name = step_data.get('step_name', 'Unknown Step')
                step_output_raw = step_data.get('output', '')
                step_output_text = ContextBuilder._stringify_step_output(step_output_raw)
                
                # Extract image URLs from multiple sources:
                # 1. From image_urls array
                image_urls_raw = step_data.get('image_urls', [])
                if image_urls_raw is None:
                    image_urls_from_array = []
                elif isinstance(image_urls_raw, list):
                    image_urls_from_array = [url for url in image_urls_raw if url]
                else:
                    image_urls_from_array = [str(image_urls_raw)] if image_urls_raw else []
                
                # 2. Extract image URLs from the output text itself
                image_urls_from_text = []
                if isinstance(step_output_raw, str):
                    image_urls_from_text = extract_image_urls(step_output_raw)
                elif isinstance(step_output_raw, (dict, list)):
                    image_urls_from_text = extract_image_urls_from_object(step_output_raw)
                
                # Combine and deduplicate all image URLs
                all_image_urls: Set[str] = set(image_urls_from_array) | set(image_urls_from_text)
                image_urls = sorted(list(all_image_urls))  # Sort for consistent output
                
                accumulated_context += f"--- {step_name} ---\n{step_output_text}\n\n"
                if image_urls:
                    accumulated_context += f"Generated Images:\n" + "\n".join([f"- {url}" for url in image_urls]) + "\n\n"
        
        return accumulated_context

    @staticmethod
    def build_deliverable_context_from_step_outputs(
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Build deliverable-only context from the terminal workflow steps.

        This intentionally excludes earlier step outputs to avoid leaking
        internal research, raw notes, or submission scaffolding into the
        customer-facing deliverable.
        """
        if not step_outputs or not sorted_steps:
            return ""

        target_indices = ContextBuilder._resolve_deliverable_indices(sorted_steps)
        if not target_indices:
            return ""

        deliverable_outputs: List[str] = []
        for idx in target_indices:
            if idx >= len(step_outputs):
                continue
            output = step_outputs[idx].get('output', '')
            output_text = ContextBuilder._stringify_step_output(output).strip()
            if output_text:
                deliverable_outputs.append(output_text)

        return "\n\n".join(deliverable_outputs)

    @staticmethod
    def build_deliverable_context_from_execution_steps(
        execution_steps: List[Dict[str, Any]],
        deliverable_step_orders: Optional[List[int]] = None
    ) -> str:
        """
        Build deliverable-only context from execution steps (single-step mode).
        """
        from utils.step_utils import normalize_step_order

        if not execution_steps:
            return ""

        ai_steps = [s for s in execution_steps if s.get('step_type') == 'ai_generation']
        if not ai_steps:
            return ""

        deliverable_orders = set(deliverable_step_orders or [])
        if deliverable_orders:
            terminal_steps = [
                step for step in ai_steps
                if normalize_step_order(step) in deliverable_orders
            ]
            if not terminal_steps:
                deliverable_orders = set()

        if not deliverable_orders:
            max_order = max(normalize_step_order(step) for step in ai_steps)
            terminal_steps = [
                step for step in ai_steps
                if normalize_step_order(step) == max_order
            ]

        deliverable_outputs: List[str] = []
        for step in terminal_steps:
            output = step.get('output', '')
            output_text = ContextBuilder._stringify_step_output(output).strip()
            if output_text:
                deliverable_outputs.append(output_text)

        return "\n\n".join(deliverable_outputs)
    
    @staticmethod
    def get_current_step_context(step_index: int, initial_context: str) -> str:
        """
        Get current step context (empty for subsequent steps, initial_context for first step).
        
        Args:
            step_index: Index of current step (0-based)
            initial_context: Formatted submission context
            
        Returns:
            Current step context string
        """
        return initial_context if step_index == 0 else ""
    
    @staticmethod
    def collect_previous_image_urls(
        execution_steps: List[Dict[str, Any]],
        current_step_order: int,
        dependency_indices: Optional[List[int]] = None,
    ) -> List[str]:
        """
        Collect all image URLs from previous execution steps.
        
        Iterates through execution_steps and extracts all image URLs from steps
        that come before the current step. Handles both array and single value
        formats, and deduplicates the results.
        
        Args:
            execution_steps: List of all execution step dictionaries
            current_step_order: Current step order (1-indexed)
            dependency_indices: Optional list of step indices to include
            
        Returns:
            List of unique image URLs from previous steps, sorted alphabetically
        """
        from utils.step_utils import normalize_step_order
        
        all_image_urls: Set[str] = set()
        
        # Filter to only include AI generation steps that come before current step
        for step_data in execution_steps:
            # Only process AI generation steps
            if step_data.get('step_type') != 'ai_generation':
                continue
            
            step_order = normalize_step_order(step_data)
            
            if dependency_indices is not None:
                if (step_order - 1) not in dependency_indices:
                    continue
            else:
                # Only include steps that come before the current step
                if step_order >= current_step_order:
                    continue
            
            # Extract image URLs from multiple sources:
            # 1. From image_urls array in execution step
            image_urls_raw = step_data.get('image_urls', [])
            if image_urls_raw is None:
                image_urls_from_array = []
            elif isinstance(image_urls_raw, list):
                image_urls_from_array = [url for url in image_urls_raw if url]  # Filter out None/empty strings
            else:
                # If it's not a list, try to convert (shouldn't happen, but be safe)
                image_urls_from_array = [str(image_urls_raw)] if image_urls_raw else []
            
            # 2. Extract image URLs from the output text itself
            step_output = step_data.get('output', '')
            image_urls_from_text = []
            if isinstance(step_output, str):
                image_urls_from_text = extract_image_urls(step_output)
            elif isinstance(step_output, (dict, list)):
                image_urls_from_text = extract_image_urls_from_object(step_output)
            
            # Combine and add to set (automatically deduplicates)
            all_image_urls.update(image_urls_from_array)
            all_image_urls.update(image_urls_from_text)
        
        # Return sorted list for consistent ordering
        return sorted(list(all_image_urls))

