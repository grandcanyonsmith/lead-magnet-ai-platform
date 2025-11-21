"""
Type definitions for the worker module.
"""

from typing import TypedDict, List, Optional, Dict, Any

__all__ = [
    'Job',
    'Workflow',
    'Step',
    'Submission',
    'Form',
    'ExecutionStep',
    'StepOutput',
    'WebhookResult',
    'UsageInfo',
    'ArtifactInfo',
]


class Job(TypedDict, total=False):
    """Job data structure."""
    job_id: str
    tenant_id: str
    workflow_id: str
    submission_id: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    updated_at: Optional[str]
    error_message: Optional[str]
    error_type: Optional[str]
    execution_steps: List['ExecutionStep']
    execution_plan: Optional[Dict[str, Any]]
    artifacts: List[str]


class Workflow(TypedDict, total=False):
    """Workflow configuration structure."""
    workflow_id: str
    workflow_name: str
    steps: List['Step']
    template_id: Optional[str]
    template_version: Optional[int]


class Step(TypedDict, total=False):
    """Workflow step configuration structure."""
    step_name: str
    step_order: int
    step_type: str
    instructions: str
    model: str
    tools: List[Dict[str, Any]]
    tool_choice: str
    depends_on: Optional[List[int]]
    webhook_url: Optional[str]


class Submission(TypedDict, total=False):
    """Submission data structure."""
    submission_id: str
    form_id: Optional[str]
    submission_data: Dict[str, Any]
    created_at: Optional[str]


class Form(TypedDict, total=False):
    """Form configuration structure."""
    form_id: str
    form_name: str
    fields: List[Dict[str, Any]]


class ExecutionStep(TypedDict, total=False):
    """Execution step record structure."""
    step_type: str
    step_name: str
    step_order: int
    model: Optional[str]
    output: Optional[str]
    artifact_id: Optional[str]
    image_urls: Optional[List[str]]
    request_details: Optional[Dict[str, Any]]
    response_details: Optional[Dict[str, Any]]
    usage_info: Optional['UsageInfo']
    step_start_time: Optional[str]
    step_duration: Optional[float]
    webhook_url: Optional[str]
    response_status: Optional[int]
    success: Optional[bool]
    error: Optional[str]
    duration_ms: Optional[float]


class StepOutput(TypedDict, total=False):
    """Step output structure."""
    step_name: str
    step_index: int
    output: str
    artifact_id: Optional[str]
    image_urls: List[str]
    webhook_result: Optional['WebhookResult']


class WebhookResult(TypedDict, total=False):
    """Webhook execution result structure."""
    webhook_url: str
    payload: Dict[str, Any]
    response_status: Optional[int]
    response_body: Optional[Any]
    success: bool
    error: Optional[str]
    duration_ms: float


class UsageInfo(TypedDict, total=False):
    """Usage information structure."""
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    service_type: str


class ArtifactInfo(TypedDict, total=False):
    """Artifact information structure."""
    artifact_id: str
    artifact_type: str
    filename: str
    s3_key: Optional[str]
    public_url: Optional[str]

