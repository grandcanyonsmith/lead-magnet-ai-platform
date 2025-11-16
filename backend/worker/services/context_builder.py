"""
Context Builder Service
Handles building context for workflow steps from submission data and previous step outputs.
"""

import logging
from typing import Dict, Any, List, Set
from utils.image_utils import extract_image_urls, extract_image_urls_from_object

logger = logging.getLogger(__name__)


class ContextBuilder:
    """Service for building context strings for workflow steps."""
    
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
        sorted_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Build previous context string from step outputs.
        
        Args:
            initial_context: Formatted submission context
            step_outputs: List of step output dictionaries
            sorted_steps: List of step configurations sorted by order
            
        Returns:
            Combined previous context string
        """
        all_previous_outputs = []
        all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
        
        # Include all previous step outputs explicitly (with image URLs if present)
        for prev_idx, prev_step_output in enumerate(step_outputs):
            prev_step_name = sorted_steps[prev_idx].get('step_name', f'Step {prev_idx + 1}')
            prev_output_text = prev_step_output['output']
            
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
            if isinstance(prev_output_text, str):
                image_urls_from_text = extract_image_urls(prev_output_text)
            elif isinstance(prev_output_text, (dict, list)):
                image_urls_from_text = extract_image_urls_from_object(prev_output_text)
            
            # Combine and deduplicate all image URLs
            all_image_urls: Set[str] = set(image_urls_from_array) | set(image_urls_from_text)
            prev_image_urls = sorted(list(all_image_urls))  # Sort for consistent output
            
            step_context = f"\n=== Step {prev_idx + 1}: {prev_step_name} ===\n{prev_output_text}"
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
        dependency_indices: List[int] = None
    ) -> str:
        """
        Build previous context from execution_steps.
        
        Note: Execution steps are stored in S3 (not DynamoDB), but are loaded into memory
        by db_service.get_job() when s3_service is provided.
        
        Args:
            initial_context: Formatted submission context
            execution_steps: List of execution step dictionaries (loaded from S3)
            current_step_order: Order of current step (1-indexed)
            dependency_indices: Optional list of step indices to include (if None, includes all previous steps)
            
        Returns:
            Combined previous context string
        """
        from utils.step_utils import normalize_step_order
        
        all_previous_outputs = []
        all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
        
        # Load previous step outputs from execution_steps
        # Filter to only include steps with step_order < current_step_order OR in dependency_indices
        sorted_execution_steps = sorted(
            [s for s in execution_steps if s.get('step_type') == 'ai_generation'],
            key=normalize_step_order
        )
        
        for prev_step_data in sorted_execution_steps:
            prev_step_order = normalize_step_order(prev_step_data)
            
            # Determine if this step should be included
            should_include = False
            if dependency_indices is not None:
                # Include if step_order matches a dependency index (step_order is 1-indexed, so subtract 1)
                should_include = (prev_step_order - 1) in dependency_indices
            else:
                # Default: include all steps that come before the current step
                should_include = prev_step_order < current_step_order
            
            if should_include:
                prev_step_name = prev_step_data.get('step_name', 'Unknown Step')
                prev_output_text = prev_step_data.get('output', '')
                
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
                if isinstance(prev_output_text, str):
                    image_urls_from_text = extract_image_urls(prev_output_text)
                elif isinstance(prev_output_text, (dict, list)):
                    image_urls_from_text = extract_image_urls_from_object(prev_output_text)
                
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
                step_output = step_data.get('output', '')
                
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
                if isinstance(step_output, str):
                    image_urls_from_text = extract_image_urls(step_output)
                elif isinstance(step_output, (dict, list)):
                    image_urls_from_text = extract_image_urls_from_object(step_output)
                
                # Combine and deduplicate all image URLs
                all_image_urls: Set[str] = set(image_urls_from_array) | set(image_urls_from_text)
                image_urls = sorted(list(all_image_urls))  # Sort for consistent output
                
                accumulated_context += f"--- {step_name} ---\n{step_output}\n\n"
                if image_urls:
                    accumulated_context += f"Generated Images:\n" + "\n".join([f"- {url}" for url in image_urls]) + "\n\n"
        
        return accumulated_context
    
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
        current_step_order: int
    ) -> List[str]:
        """
        Collect all image URLs from previous execution steps.
        
        Iterates through execution_steps and extracts all image URLs from steps
        that come before the current step. Handles both array and single value
        formats, and deduplicates the results. Filters out invalid URLs (e.g., 
        base64 data URLs) that should have been converted to S3 URLs.
        
        Args:
            execution_steps: List of all execution step dictionaries
            current_step_order: Current step order (1-indexed)
            
        Returns:
            List of unique valid image URLs from previous steps, sorted alphabetically
        """
        from utils.step_utils import normalize_step_order
        from utils.image_utils import is_base64_data_url, is_valid_http_url
        
        all_image_urls: Set[str] = set()
        
        # Filter to only include AI generation steps that come before current step
        for step_data in execution_steps:
            # Only process AI generation steps
            if step_data.get('step_type') != 'ai_generation':
                continue
            
            step_order = normalize_step_order(step_data)
            
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
            
            # Filter out invalid URLs (base64 data URLs, invalid HTTP URLs)
            # Only keep valid HTTP/HTTPS URLs
            for url in image_urls_from_array + image_urls_from_text:
                # Skip base64 data URLs - they should have been converted to S3 URLs
                if is_base64_data_url(url):
                    logger.warning(f"[ContextBuilder] Filtered base64 data URL from previous step (should be S3 URL)", extra={
                        'url_preview': url[:100] + '...' if len(url) > 100 else url,
                        'step_order': step_order
                    })
                    continue
                
                # Only keep valid HTTP/HTTPS URLs
                if is_valid_http_url(url):
                    all_image_urls.add(url)
                else:
                    logger.warning(f"[ContextBuilder] Filtered invalid image URL from previous step", extra={
                        'url_preview': url[:100] + '...' if len(url) > 100 else url,
                        'step_order': step_order
                    })
        
        # Return sorted list for consistent ordering
        return sorted(list(all_image_urls))

