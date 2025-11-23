"""
Step Processor Utilities
Shared utility functions for step processing.
"""

from typing import Dict, Any, List, Tuple, Optional

from core.db_service import DynamoDBService


def extract_step_tools(step: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str]:
    """
    Extract and normalize tools and tool_choice from step config.
    
    Args:
        step: Step configuration dictionary
        
    Returns:
        Tuple of (step_tools, step_tool_choice)
    """
    step_tools_raw = step.get('tools', ['web_search_preview'])
    step_tools = [{"type": tool} if isinstance(tool, str) else tool for tool in step_tools_raw]
    step_tool_choice = step.get('tool_choice', 'auto')
    return step_tools, step_tool_choice


def get_submission_data(
    db_service: DynamoDBService,
    job: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Get submission data for webhook processing.
    
    Args:
        db_service: DynamoDB service instance
        job: Job dictionary
        
    Returns:
        Submission dictionary (minimal dict if not found)
    """
    submission_id = job.get('submission_id')
    submission = None
    if submission_id:
        submission = db_service.get_submission(submission_id)
    if not submission:
        submission = {'submission_data': {}}
    return submission


def update_job_artifacts_list(
    job: Dict[str, Any],
    step_artifact_id: Optional[str],
    image_artifact_ids: List[str]
) -> List[str]:
    """
    Update job's artifacts list with new artifacts.
    
    Args:
        job: Job dictionary
        step_artifact_id: Step artifact ID
        image_artifact_ids: List of image artifact IDs
        
    Returns:
        Updated artifacts list
    """
    artifacts_list = job.get('artifacts', [])
    if step_artifact_id and step_artifact_id not in artifacts_list:
        artifacts_list.append(step_artifact_id)
    for image_artifact_id in image_artifact_ids:
        if image_artifact_id not in artifacts_list:
            artifacts_list.append(image_artifact_id)
    return artifacts_list

