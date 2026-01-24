from dataclasses import dataclass
from typing import Optional, Dict, Any, List


@dataclass(frozen=True)
class ReportContext:
    model: str
    instructions: str
    context: str
    previous_context: str
    tenant_id: Optional[str]
    job_id: Optional[str]
    previous_image_urls: Optional[List[str]]
    reasoning_effort: Optional[str]
    service_tier: Optional[str]
    output_format: Optional[Dict[str, Any]]
    step_index: Optional[int]
    text_verbosity: Optional[str]
    max_output_tokens: Optional[int]
    shell_settings: Optional[Dict[str, Any]]
    validated_tools: List[Dict[str, Any]]
    normalized_tool_choice: str
    has_image_generation: bool
    has_computer_use: bool
    has_shell: bool
    effective_instructions: str
    tool_secrets: Dict[str, str]
    should_inject_tool_secrets: bool
    input_text: str
    full_context: str
    step_name: Optional[str]
    step_instructions: str
