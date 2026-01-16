import logging
from typing import Dict, Any, List, Tuple
from datetime import datetime
from services.steps.base import AbstractStepHandler
from services.ai_step_processor import AIStepProcessor
from services.execution_step_manager import ExecutionStepManager
from services.s3_context_service import S3ContextService
from services.context_builder import ContextBuilder
from services.tools import get_image_generation_defaults
from core import log_context

logger = logging.getLogger(__name__)

class AIStepHandler(AbstractStepHandler):
    """Handler for AI generation steps."""
    
    def __init__(self, services: Dict[str, Any]):
        super().__init__(services)
        self.ai_step_processor = AIStepProcessor(
            ai_service=services['ai_service'],
            artifact_service=services['artifact_service'],
            usage_service=services['usage_service'],
            image_artifact_service=services['image_artifact_service']
        )
        self.s3_context_service = S3ContextService(
            db_service=services['db_service'],
            s3_service=services['s3_service'],
            artifact_service=services['artifact_service']
        )

    def _prepare_step_tools(self, step: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]], str]:
        """Prepare and normalize tools for a step."""
        step_model = step.get('model', 'gpt-5.2')
        
        # Check if this is a deep research model
        is_deep_research_model = (
            isinstance(step_model, str) and 
            ('deep-research' in step_model.lower() or step_model == 'o4-mini-deep-research')
        )
        
        # Deep research models require at least one of: web_search_preview, mcp, or file_search
        # Regular models get web_search by default
        if is_deep_research_model:
            default_tools = []  # Don't auto-add web_search for deep research models
        else:
            default_tools = ['web_search']
        
        step_tools_raw = step.get('tools', default_tools)
        
        # Convert string tools to objects
        step_tools = []
        for tool in step_tools_raw:
            if isinstance(tool, str):
                if tool == 'image_generation':
                    step_tools.append(get_image_generation_defaults())
                else:
                    step_tools.append({"type": tool})
            else:
                step_tools.append(tool)
        
        # For deep research models, ensure at least one required tool is present
        if is_deep_research_model:
            required_tool_types = {'web_search_preview', 'mcp', 'file_search'}
            has_required_tool = any(
                (isinstance(t, dict) and t.get('type') in required_tool_types) or
                (isinstance(t, str) and t in required_tool_types)
                for t in step_tools
            )
            
            if not has_required_tool:
                # Add file_search as default for deep research models if no required tool is present
                logger.info(
                    f"[AIStepHandler] Deep research model '{step_model}' requires at least one of "
                    "web_search_preview, mcp, or file_search. Adding file_search as default.",
                    extra={'step_model': step_model, 'step_tools': step_tools_raw}
                )
                step_tools.append({"type": "file_search"})
        
        step_tool_choice = step.get('tool_choice')
        if step_tool_choice not in ('auto', 'required', 'none'):
            step_tool_choice = 'required' if len(step_tools) > 0 else 'none'
        
        # Filter code_interpreter if S3 upload requested in instructions
        instructions = step.get("instructions", "")
        if self.s3_context_service.parse_s3_upload_target_from_instructions(instructions):
            step_tools = [
                t for t in step_tools
                if not (isinstance(t, dict) and t.get("type") == "code_interpreter")
            ]
            if str(step_tool_choice).strip().lower() == "required" and len(step_tools) == 0:
                step_tool_choice = "none"
        
        return step_model, step_tools, step_tool_choice

    @staticmethod
    def _split_step_context(step_index: int, full_context: str) -> Tuple[str, str]:
        """Return (previous_context, current_step_context) based on step index."""
        current_step_context = ContextBuilder.get_current_step_context(step_index, full_context)
        previous_context = full_context if step_index > 0 else ""
        return previous_context, current_step_context

    def execute(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        context: str,
        step_outputs: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], List[str]]:
        
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_model, step_tools, step_tool_choice = self._prepare_step_tools(step)
        step_start_time = datetime.utcnow()
        
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type='ai_generation',
            step_model=step_model
        ):
            # Check dependency steps to build context
            # Note: dependency resolution happens in step_processor main loop now
            
            previous_context, current_step_context = self._split_step_context(step_index, context)
            current_step_context = self.s3_context_service.maybe_inject_s3_upload_context(
                step=step,
                step_index=step_index,
                tenant_id=tenant_id,
                job_id=job_id,
                current_step_context=current_step_context,
                step_outputs=step_outputs,
                step_tools=step_tools,
            )
            current_step_context = self.s3_context_service.maybe_inject_s3_publish_output_only_context(
                step=step,
                current_step_context=current_step_context,
            )
            
            # Collect previous image URLs
            has_image_generation = any(
                isinstance(tool, dict) and tool.get('type') == 'image_generation'
                for tool in (step_tools or [])
            )
            
            previous_image_urls = (
                ContextBuilder.collect_previous_image_urls(
                    execution_steps=execution_steps,
                    current_step_order=step_index + 1
                )
                if has_image_generation
                else None
            )

            try:
                # Execute AI step
                step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self.ai_step_processor.process_ai_step(
                    step=step,
                    step_index=step_index,
                    job_id=job_id,
                    tenant_id=tenant_id,
                    initial_context=context,
                    previous_context=previous_context,
                    current_step_context=current_step_context,
                    step_tools=step_tools,
                    step_tool_choice=step_tool_choice,
                    previous_image_urls=previous_image_urls
                )
                
                step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
                image_urls = response_details.get('image_urls', [])
                
                step_output_result = {
                    'step_name': step_name,
                    'step_index': step_index,
                    'output': step_output,
                    'artifact_id': step_artifact_id,
                    'image_urls': image_urls,
                    'image_artifact_ids': image_artifact_ids,
                    'usage_info': usage_info,
                    'duration_ms': int(step_duration),
                    'success': True
                }
                
                execution_step_data = ExecutionStepManager.create_ai_generation_step(
                    step_name=step_name,
                    step_order=step_index + 1,
                    step_model=step_model,
                    request_details=request_details,
                    response_details=response_details,
                    usage_info=usage_info,
                    step_start_time=step_start_time,
                    step_duration=step_duration,
                    artifact_id=step_artifact_id
                )
                
                execution_steps.append(execution_step_data)
                
                # Post-processing S3 upload
                s3_publish_step = self.s3_context_service.maybe_publish_current_step_output_to_s3(
                    step=step,
                    step_index=step_index,
                    tenant_id=tenant_id,
                    job_id=job_id,
                    step_name=step_name,
                    step_output_result=step_output_result,
                )
                if s3_publish_step:
                    execution_steps.append(s3_publish_step)

                # Update job with execution steps
                self.services['db_service'].update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.services['s3_service'])

                return step_output_result, image_artifact_ids

            except Exception as step_error:
                step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
                error_message = f"Step {step_index + 1} ({step_name}) failed: {step_error}"
                
                logger.error(f"[AIStepHandler] AI step failed", extra={
                    'error': str(step_error),
                    'job_id': job_id
                }, exc_info=True)
                
                execution_step_data = ExecutionStepManager.create_failed_ai_generation_step(
                    step_name=step_name,
                    step_order=step_index + 1,
                    step_model=step_model,
                    error_message=error_message,
                    step_start_time=step_start_time,
                    duration_ms=step_duration
                )
                
                execution_steps.append(execution_step_data)
                self.services['db_service'].update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.services['s3_service'])
                
                failed_result = {
                    'step_name': step_name,
                    'step_index': step_index,
                    'output': error_message,
                    'artifact_id': None,
                    'image_urls': [],
                    'image_artifact_ids': [],
                    'usage_info': {},
                    'error': str(step_error),
                    'duration_ms': int(step_duration),
                    'success': False
                }
                
                return failed_result, []
