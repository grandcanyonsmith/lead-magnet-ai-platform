"""
Report Generator
Handles the core logic for generating AI reports, including tool validation,
CUA loops, Shell loops, and standard OpenAI API interactions.
"""

from typing import Optional, Dict, Tuple, List, Any

from core.logger import get_logger
from services.tools import ToolBuilder, ToolValidator
from services.openai_client import OpenAIClient
from services.cua_loop_service import CUALoopService
from services.tools.execution import ShellLoopService
from services.ai.image_generator import ImageGenerator
from services.ai.report_context import ReportContext
from services.ai.report_strategies import (
    ImageGenerationStrategy,
    CUALoopStrategy,
    ShellLoopStrategy,
    StandardReportStrategy,
)
from services.image_handler import ImageHandler
from services.tool_secrets import (
    append_tool_secrets,
    get_tool_secrets,
)
from utils.decimal_utils import convert_decimals_to_float

logger = get_logger(__name__)


class ReportGenerator:
    """Service for generating reports using OpenAI with tool support."""

    def __init__(
        self,
        openai_client: OpenAIClient,
        cua_loop_service: CUALoopService,
        shell_loop_service: ShellLoopService,
        image_generator: ImageGenerator,
        image_handler: ImageHandler,
        db_service: Optional[Any] = None,
    ):
        self.openai_client = openai_client
        self.cua_loop_service = cua_loop_service
        self.shell_loop_service = shell_loop_service
        self.image_generator = image_generator
        self.image_handler = image_handler
        self.db_service = db_service
        
        # State for streaming updates
        self._current_step_name: Optional[str] = None
        self._current_step_instructions: Optional[str] = None

        self._image_strategy = ImageGenerationStrategy(image_generator, db_service)
        self._cua_strategy = CUALoopStrategy(openai_client, cua_loop_service)
        self._shell_strategy = ShellLoopStrategy(
            openai_client=openai_client,
            shell_loop_service=shell_loop_service,
            image_handler=image_handler,
            db_service=db_service,
        )
        self._standard_strategy = StandardReportStrategy(
            openai_client=openai_client,
            image_handler=image_handler,
            db_service=db_service,
        )

    def set_step_context(self, step_name: Optional[str], step_instructions: Optional[str]):
        """Set context for current step being processed."""
        self._current_step_name = step_name
        self._current_step_instructions = step_instructions

    def generate_report(
        self,
        model: str,
        instructions: str,
        context: str,
        previous_context: str = "",
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        output_format: Optional[Dict[str, Any]] = None,
        step_index: Optional[int] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        shell_settings: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate a report using OpenAI with configurable tools.
        
        Args:
            model: OpenAI model to use (e.g., 'gpt-5')
            instructions: System instructions for the AI
            context: User context/data to generate report from
            previous_context: Optional context from previous steps (accumulated)
            tools: List of tool dictionaries (e.g., [{"type": "web_search"}])
            tool_choice: How model should use tools - "auto", "required", or "none"
            tenant_id: Optional tenant ID for image storage context
            job_id: Optional job ID for image storage context
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            
        Returns:
            Tuple of (generated report content, usage info dict, request details dict, response details dict)
        """
        # Validate and filter tools (including model compatibility check)
        validated_tools, normalized_tool_choice = ToolValidator.validate_and_filter_tools(tools, tool_choice, model=model)
        
        # Normalize DynamoDB Decimal values to prevent JSON serialization errors
        if validated_tools:
            validated_tools = convert_decimals_to_float(validated_tools)
        
        logger.debug(f"[ReportGenerator] After tool validation", extra={
            'validated_tools_count': len(validated_tools) if validated_tools else 0,
            'validated_tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'normalized_tool_choice': normalized_tool_choice,
            'original_tool_choice': tool_choice
        })
        
        # Detect image_generation tool
        has_image_generation = ToolValidator.has_image_generation(validated_tools)
        
        # CRITICAL VALIDATION: Ensure tool_choice='required' never exists with empty tools
        if normalized_tool_choice == "required":
            if not validated_tools or len(validated_tools) == 0:
                logger.error("[ReportGenerator] CRITICAL: tool_choice='required' but validated_tools is empty!", extra={
                    'original_tool_choice': tool_choice,
                    'has_image_generation': has_image_generation,
                    'validated_tools_count': 0
                })
                raise ValueError("Invalid workflow configuration: tool_choice='required' but no valid tools available after validation. Please check your workflow step configuration and ensure at least one valid tool is included.")
        
        # Check if computer_use_preview is in tools (requires truncation="auto")
        has_computer_use = ToolValidator.has_computer_use(validated_tools)
        has_shell = any(
            isinstance(t, dict) and t.get("type") == "shell"
            for t in (validated_tools or [])
        )

        tool_secrets = get_tool_secrets(self.db_service, tenant_id) or {}
        should_inject_tool_secrets = bool(tool_secrets) and (has_shell or has_computer_use)
        effective_instructions = (
            append_tool_secrets(instructions, tool_secrets)
            if should_inject_tool_secrets
            else instructions
        )

        requested_code_interpreter = any(
            (isinstance(t, dict) and t.get("type") == "code_interpreter")
            or t == "code_interpreter"
            for t in (validated_tools or [])
        )
        if requested_code_interpreter and has_computer_use:
            openai_container_label = (
                "OpenAI container: not used (code_interpreter incompatible with computer_use_preview)"
            )
        elif requested_code_interpreter:
            openai_container_label = (
                f"OpenAI container: code_interpreter ({ToolBuilder.DEFAULT_CODE_INTERPRETER_MEMORY_LIMIT} enforced)"
            )
        else:
            openai_container_label = "OpenAI container: not used"
        
        logger.info(f"[ReportGenerator] Generating report", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'step_index': step_index,
            'model': model,
            'tools_count': len(validated_tools) if validated_tools else 0,
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'tool_choice': normalized_tool_choice,
            'has_computer_use': has_computer_use,
            'has_image_generation': has_image_generation,
            'reasoning_effort': reasoning_effort,
            'service_tier': service_tier,
            'output_format_type': (output_format or {}).get('type') if isinstance(output_format, dict) else None,
            'instructions_length': len(instructions),
            'context_length': len(context),
            'previous_context_length': len(previous_context),
            'previous_image_urls_count': len(previous_image_urls) if previous_image_urls else 0
        })

        logger.info(f"[ReportGenerator] Runtime context: {openai_container_label}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'step_index': step_index,
            'has_computer_use': has_computer_use,
            'has_code_interpreter': requested_code_interpreter,
        })
        
        # Build input text
        input_text = OpenAIClient.build_input_text(context, previous_context)
        full_context = (
            f"{previous_context}\n\n--- Current Step Context ---\n{context}"
            if previous_context
            else context
        )

        report_context = ReportContext(
            model=model,
            instructions=instructions,
            context=context,
            previous_context=previous_context,
            tenant_id=tenant_id,
            job_id=job_id,
            previous_image_urls=previous_image_urls,
            reasoning_effort=reasoning_effort,
            service_tier=service_tier,
            output_format=output_format,
            step_index=step_index,
            text_verbosity=text_verbosity,
            max_output_tokens=max_output_tokens,
            shell_settings=shell_settings,
            validated_tools=validated_tools or [],
            normalized_tool_choice=normalized_tool_choice,
            has_image_generation=has_image_generation,
            has_computer_use=has_computer_use,
            has_shell=has_shell,
            effective_instructions=effective_instructions,
            tool_secrets=tool_secrets,
            should_inject_tool_secrets=should_inject_tool_secrets,
            input_text=input_text,
            full_context=full_context,
            step_name=self._current_step_name,
            step_instructions=self._current_step_instructions or instructions,
        )

        for strategy in (
            self._image_strategy,
            self._cua_strategy,
            self._shell_strategy,
            self._standard_strategy,
        ):
            if strategy.can_handle(report_context):
                return strategy.execute(report_context)

        return self._standard_strategy.execute(report_context)
