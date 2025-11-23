"""
Step Output Builder Service
Handles building standardized step output dictionaries.
"""

from typing import Dict, Any, List, Optional


class StepOutputBuilder:
    """Service for building step output dictionaries."""
    
    def build_batch_mode_output(
        self,
        step_name: str,
        step_index: int,
        step_output: str,
        step_artifact_id: Optional[str],
        image_urls: List[str],
        webhook_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Build step output dictionary for batch mode.
        
        Args:
            step_name: Name of the step
            step_index: Step index (0-based)
            step_output: Step output text
            step_artifact_id: Artifact ID (if any)
            image_urls: List of image URLs
            webhook_result: Optional webhook result dictionary
            
        Returns:
            Step output dictionary
        """
        output_dict = {
            'step_name': step_name,
            'step_index': step_index,
            'output': step_output,
            'artifact_id': step_artifact_id,
            'image_urls': image_urls
        }
        
        if webhook_result is not None:
            output_dict['webhook_result'] = webhook_result
        
        return output_dict
    
    def build_single_mode_output(
        self,
        step_name: str,
        step_index: int,
        step_output: str,
        step_artifact_id: Optional[str],
        image_urls: List[str],
        image_artifact_ids: List[str],
        usage_info: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
        webhook_result: Optional[Dict[str, Any]] = None,
        success: bool = True
    ) -> Dict[str, Any]:
        """
        Build step output dictionary for single mode.
        
        Args:
            step_name: Name of the step
            step_index: Step index (0-based)
            step_output: Step output text
            step_artifact_id: Artifact ID (if any)
            image_urls: List of image URLs
            image_artifact_ids: List of image artifact IDs
            usage_info: Optional usage information dictionary
            duration_ms: Optional duration in milliseconds
            webhook_result: Optional webhook result dictionary
            success: Whether the step succeeded
            
        Returns:
            Step result dictionary
        """
        output_dict = {
            'success': success,
            'step_index': step_index,
            'step_name': step_name,
            'step_output': step_output,
            'artifact_id': step_artifact_id,
            'image_urls': image_urls,
            'image_artifact_ids': image_artifact_ids
        }
        
        if usage_info is not None:
            output_dict['usage_info'] = usage_info
        
        if duration_ms is not None:
            output_dict['duration_ms'] = duration_ms
        
        if webhook_result is not None:
            output_dict['webhook_result'] = webhook_result
        
        return output_dict

