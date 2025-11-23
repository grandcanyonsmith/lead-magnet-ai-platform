"""
Step Processor Service
Handles processing of individual workflow steps.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from core.ai_service import AIService
try:
    from model_types import Step, StepOutput, ExecutionStep, WebhookResult
except ImportError:
    # Fallback if model_types module not available
    Step = Dict[str, Any]
    StepOutput = Dict[str, Any]
    ExecutionStep = Dict[str, Any]
    WebhookResult = Dict[str, Any]
from core.artifact_service import ArtifactService
from core.db_service import DynamoDBService
from core.s3_service import S3Service
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.image_artifact_service import ImageArtifactService
from services.webhook_step_service import WebhookStepService
from services.ai_step_processor import AIStepProcessor
from services.dependency_validation_service import DependencyValidationService
from services.step_context_service import StepContextService
from services.execution_step_coordinator import ExecutionStepCoordinator
from services.step_output_builder import StepOutputBuilder
from services.step_processor_utils import extract_step_tools, get_submission_data, update_job_artifacts_list

logger = logging.getLogger(__name__)


class StepProcessor:
    """Service for processing workflow steps."""
    
    def __init__(
        self,
        ai_service: AIService,
        artifact_service: ArtifactService,
        db_service: DynamoDBService,
        s3_service: S3Service,
        usage_service: UsageService,
        image_artifact_service: ImageArtifactService,
        dependency_validator: Optional[DependencyValidationService] = None,
        context_service: Optional[StepContextService] = None,
        execution_coordinator: Optional[ExecutionStepCoordinator] = None,
        output_builder: Optional[StepOutputBuilder] = None
    ):
        """
        Initialize step processor.
        
        Args:
            ai_service: AI service instance
            artifact_service: Artifact service instance
            db_service: DynamoDB service instance
            s3_service: S3 service instance
            usage_service: Usage service instance
            image_artifact_service: Image artifact service instance
            dependency_validator: Optional dependency validation service
            context_service: Optional step context service
            execution_coordinator: Optional execution step coordinator
            output_builder: Optional step output builder
        """
        self.ai_service = ai_service
        self.artifact_service = artifact_service
        self.db = db_service
        self.s3 = s3_service
        self.usage_service = usage_service
        self.image_artifact_service = image_artifact_service
        self.webhook_step_service = WebhookStepService()
        self.ai_step_processor = AIStepProcessor(
            ai_service=ai_service,
            artifact_service=artifact_service,
            usage_service=usage_service,
            image_artifact_service=image_artifact_service
        )
        
        # Initialize new services with defaults if not provided
        self.dependency_validator = dependency_validator or DependencyValidationService()
        self.context_service = context_service or StepContextService()
        self.execution_coordinator = execution_coordinator or ExecutionStepCoordinator(db_service, s3_service)
        self.output_builder = output_builder or StepOutputBuilder()
    
    def process_step_batch_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        initial_context: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
        all_image_artifact_ids: List[str]
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Process a step in batch mode (used by process_job).
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            tenant_id: Tenant ID
            initial_context: Initial formatted submission context
            step_outputs: List of previous step outputs (for context building)
            sorted_steps: List of all steps sorted by order
            execution_steps: List of execution steps (will be updated)
            all_image_artifact_ids: List to append image artifact IDs to
            
        Returns:
            Tuple of (step_output_dict, image_artifact_ids)
            
        Raises:
            Exception: If step processing fails
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        # Check if this is a webhook step
        if step_type == 'webhook' or step.get('webhook_url'):
            return self._process_webhook_step_batch_mode(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=tenant_id,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                execution_steps=execution_steps,
                all_image_artifact_ids=all_image_artifact_ids
            )
        
        # Regular AI generation step
        step_model = step.get('model', 'gpt-5')
        
        # Extract tools and tool_choice
        step_tools, step_tool_choice = extract_step_tools(step)
        
        logger.info(f"[StepProcessor] Processing step {step_index + 1}/{len(sorted_steps)}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_model': step_model,
            'total_steps': len(sorted_steps),
            'tools_count': len(step_tools),
            'tool_choice': step_tool_choice
        })
        
        step_start_time = datetime.utcnow()
        
        # Build contexts using context service
        all_previous_context, current_step_context, previous_image_urls = self.context_service.build_contexts_for_batch_mode(
            step=step,
            step_index=step_index,
            initial_context=initial_context,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            execution_steps=execution_steps,
            step_tools=step_tools,
            job_id=job_id
        )
        
        # Process AI step using AI step processor
        step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self._process_ai_step_with_processor(
            step=step,
            step_index=step_index,
            job_id=job_id,
            tenant_id=tenant_id,
            initial_context=initial_context,
            previous_context=all_previous_context,
            current_step_context=current_step_context,
            step_tools=step_tools,
            step_tool_choice=step_tool_choice,
            previous_image_urls=previous_image_urls
        )
        
        all_image_artifact_ids.extend(image_artifact_ids)
        
        # Extract image URLs from response
        image_urls = response_details.get('image_urls', [])
        
        # Create step output dict using output builder
        step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
        step_output_dict = self.output_builder.build_batch_mode_output(
            step_name=step_name,
            step_index=step_index,
            step_output=step_output,
            step_artifact_id=step_artifact_id,
            image_urls=image_urls
        )
        
        # Create and add execution step using coordinator
        self.execution_coordinator.create_and_add_step(
            step_name=step_name,
            step_index=step_index,
            step_model=step_model,
            request_details=request_details,
            response_details=response_details,
            usage_info=usage_info,
            step_start_time=step_start_time,
            step_duration=step_duration,
            step_artifact_id=step_artifact_id,
            execution_steps=execution_steps,
            step_type='ai_generation'
        )
        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
        
        return step_output_dict, image_artifact_ids
    
    def _execute_webhook_step_core(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        job: Dict[str, Any],
        submission: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        step_start_time: datetime
    ) -> Tuple[Dict[str, Any], bool, Dict[str, Any]]:
        """
        Core webhook execution logic shared between batch and single modes.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            job: Job dictionary
            submission: Submission dictionary
            step_outputs: List of previous step outputs
            sorted_steps: List of all steps sorted by order
            step_start_time: Start time of the step
            
        Returns:
            Tuple of (webhook_result, success, step_data)
        """
        # Execute webhook step
        webhook_result, success = self.webhook_step_service.execute_webhook_step(
            step=step,
            step_index=step_index,
            job_id=job_id,
            job=job,
            submission=submission,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps
        )
        
        # Create execution step record
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_data = ExecutionStepManager.create_webhook_step(
            step_name=step_name,
            step_order=step_index + 1,
            webhook_url=webhook_result.get('webhook_url', ''),
            payload=webhook_result.get('payload', {}),
            response_status=webhook_result.get('response_status'),
            response_body=webhook_result.get('response_body'),
            success=success,
            error=webhook_result.get('error'),
            step_start_time=step_start_time,
            duration_ms=webhook_result.get('duration_ms', 0)
        )
        
        return webhook_result, success, step_data
    
    def _process_webhook_step_batch_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]],
        all_image_artifact_ids: List[str]
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Process a webhook step in batch mode.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            tenant_id: Tenant ID
            step_outputs: List of previous step outputs
            sorted_steps: List of all steps sorted by order
            execution_steps: List of execution steps (will be updated)
            all_image_artifact_ids: List to append image artifact IDs to (not used for webhook steps)
            
        Returns:
            Tuple of (step_output_dict, image_artifact_ids)
        """
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_start_time = datetime.utcnow()
        
        logger.info(f"[StepProcessor] Processing webhook step {step_index + 1}/{len(sorted_steps)}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'webhook_url': step.get('webhook_url')
        })
        
        # Get job and submission data
        job = self.db.get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        submission = get_submission_data(self.db, job)
        
        # Execute webhook using shared core logic
        webhook_result, success, step_data = self._execute_webhook_step_core(
            step=step,
            step_index=step_index,
            job_id=job_id,
            job=job,
            submission=submission,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            step_start_time=step_start_time
        )
        
        self.execution_coordinator.update_execution_steps(
            execution_steps=execution_steps,
            step_data=step_data,
            step_order=step_index + 1,
            step_type='webhook'
        )
        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
        
        # Create step output dict using output builder
        step_output_dict = self.output_builder.build_batch_mode_output(
            step_name=step_name,
            step_index=step_index,
            step_output=f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
            step_artifact_id=None,
            image_urls=[],
            webhook_result=webhook_result
        )
        
        logger.info(f"[StepProcessor] Webhook step completed", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'success': success,
            'response_status': webhook_result.get('response_status')
        })
        
        # Webhook failures don't fail the workflow (log error but continue)
        if not success:
            logger.warning(f"[StepProcessor] Webhook step failed but continuing workflow", extra={
                'job_id': job_id,
                'step_index': step_index,
                'error': webhook_result.get('error')
            })
        
        return step_output_dict, []
    
    
    def _process_ai_step_with_processor(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        tenant_id: str,
        initial_context: str,
        previous_context: str,
        current_step_context: str,
        step_tools: List[Dict[str, Any]],
        step_tool_choice: str,
        previous_image_urls: Optional[List[str]]
    ) -> Tuple[str, Dict[str, Any], Dict[str, Any], Dict[str, Any], List[str], Optional[str]]:
        """
        Process AI step using AI step processor.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            tenant_id: Tenant ID
            initial_context: Initial formatted submission context
            previous_context: Previous step context
            current_step_context: Current step context
            step_tools: List of step tools
            step_tool_choice: Tool choice setting
            previous_image_urls: Previous image URLs (if any)
            
        Returns:
            Tuple of (step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id)
            
        Raises:
            Exception: If step processing fails
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        
        try:
            step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self.ai_step_processor.process_ai_step(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=tenant_id,
                initial_context=initial_context,
                previous_context=previous_context,
                current_step_context=current_step_context,
                step_tools=step_tools,
                step_tool_choice=step_tool_choice,
                previous_image_urls=previous_image_urls
            )
            
            logger.info("[StepProcessor] Received response_details from AI service", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'response_details_keys': list(response_details.keys()) if isinstance(response_details, dict) else None,
                'has_image_urls_key': 'image_urls' in response_details if isinstance(response_details, dict) else False,
                'image_urls_count': len(response_details.get('image_urls', [])) if isinstance(response_details, dict) else 0,
                'image_urls': response_details.get('image_urls', []) if isinstance(response_details, dict) else []
            })
            
            return step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id
            
        except Exception as step_error:
            step_model = step.get('model', 'gpt-5')
            logger.error(f"[StepProcessor] Error generating report for step {step_index + 1}", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_model': step_model,
                'step_tool_choice': step_tool_choice,
                'step_tools_count': len(step_tools) if step_tools else 0,
                'step_tools': [t.get('type') if isinstance(t, dict) else t for t in step_tools] if step_tools else [],
                'error_type': type(step_error).__name__,
                'error_message': str(step_error)
            }, exc_info=True)
            raise
    
    
    def _process_webhook_step_single_mode(
        self,
        step: Dict[str, Any],
        step_index: int,
        steps: List[Dict[str, Any]],
        job_id: str,
        job: Dict[str, Any],
        execution_steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process a webhook step in single mode.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            steps: List of all steps
            job_id: Job ID
            job: Job dictionary
            execution_steps: List of execution steps (will be updated)
            
        Returns:
            Dictionary with step result
        """
        step_name = step.get('step_name', f'Webhook Step {step_index + 1}')
        step_start_time = datetime.utcnow()
        
        logger.info(f"[StepProcessor] Processing webhook step {step_index + 1} in single mode", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'webhook_url': step.get('webhook_url')
        })
        
        # Get submission data
        submission = get_submission_data(self.db, job)
        
        # Build step_outputs from execution_steps
        sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
        step_outputs = self.execution_coordinator.build_step_outputs(execution_steps, steps)
        
        # Execute webhook using shared core logic
        webhook_result, success, step_data = self._execute_webhook_step_core(
            step=step,
            step_index=step_index,
            job_id=job_id,
            job=job,
            submission=submission,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            step_start_time=step_start_time
        )
        
        # Update execution steps with rerun support
        self.execution_coordinator.update_execution_steps(
            execution_steps=execution_steps,
            step_data=step_data,
            step_order=step_index + 1,
            step_type='webhook'
        )
        
        # Update job with execution steps
        self.db.update_job(job_id, {
            'execution_steps': execution_steps
        }, s3_service=self.s3)
        
        logger.info(f"Webhook step {step_index + 1} completed successfully in {webhook_result.get('duration_ms', 0):.0f}ms")
        
        # Webhook failures don't fail the workflow (log error but continue)
        if not success:
            logger.warning(f"[StepProcessor] Webhook step failed but continuing workflow", extra={
                'job_id': job_id,
                'step_index': step_index,
                'error': webhook_result.get('error')
            })
        
        # Build output using output builder
        return self.output_builder.build_single_mode_output(
            step_name=step_name,
            step_index=step_index,
            step_output=f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
            step_artifact_id=None,
            image_urls=[],
            image_artifact_ids=[],
            webhook_result=webhook_result,
            duration_ms=webhook_result.get('duration_ms', 0),
            success=success
        )
    
    def process_single_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        steps: List[Dict[str, Any]],
        job_id: str,
        job: Dict[str, Any],
        initial_context: str,
        execution_steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process a single step (used by process_single_step).
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            steps: List of all steps
            job_id: Job ID
            job: Job dictionary
            initial_context: Initial formatted submission context
            execution_steps: List of execution steps (will be updated)
            
        Returns:
            Dictionary with step result
            
        Raises:
            ValueError: If dependencies are not satisfied or step index is invalid
            Exception: If step processing fails
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        # Check if this is a webhook step
        if step_type == 'webhook' or step.get('webhook_url'):
            return self._process_webhook_step_single_mode(
                step=step,
                step_index=step_index,
                steps=steps,
                job_id=job_id,
                job=job,
                execution_steps=execution_steps
            )
        
        # Regular AI generation step
        step_model = step.get('model', 'gpt-5')
        
        # Reload execution_steps from database/S3 to ensure we have the latest data
        execution_steps = self.execution_coordinator.reload_execution_steps(job_id, execution_steps, step_index)
        
        # Validate dependencies
        self.dependency_validator.validate_dependencies(step, step_index, steps, execution_steps, job_id)
        
        # Extract tools and tool_choice
        step_tools, step_tool_choice = extract_step_tools(step)
        
        # Get normalized dependencies for context building
        step_deps = self.dependency_validator.normalize_dependencies(step, step_index, steps)
        
        logger.info(f"Processing step {step_index + 1}/{len(steps)}: {step_name}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_status': 'ready'
        })
        
        step_start_time = datetime.utcnow()
        
        # Build contexts using context service
        all_previous_context, current_step_context, previous_image_urls = self.context_service.build_contexts_for_step(
            step=step,
            step_index=step_index,
            initial_context=initial_context,
            execution_steps=execution_steps,
            step_deps=step_deps,
            step_tools=step_tools,
            job_id=job_id
        )
        
        # Log processing details
        has_image_generation = previous_image_urls is not None
        logger.info(f"[StepProcessor] Processing step {step_index + 1}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_model': step_model,
            'step_tool_choice': step_tool_choice,
            'step_tools_count': len(step_tools) if step_tools else 0,
            'step_tools': [t.get('type') if isinstance(t, dict) else t for t in step_tools] if step_tools else [],
            'current_step_context_length': len(current_step_context),
            'previous_context_length': len(all_previous_context),
            'has_image_generation': has_image_generation,
            'previous_image_urls_count': len(previous_image_urls) if previous_image_urls else 0
        })
        
        # Process AI step
        step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self._process_ai_step_with_processor(
            step=step,
            step_index=step_index,
            job_id=job_id,
            tenant_id=job['tenant_id'],
            initial_context=initial_context,
            previous_context=all_previous_context,
            current_step_context=current_step_context,
            step_tools=step_tools,
            step_tool_choice=step_tool_choice,
            previous_image_urls=previous_image_urls
        )
        
        step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
        
        # Extract image URLs from response
        image_urls = response_details.get('image_urls', [])
        
        # Create and update execution step using coordinator
        self.execution_coordinator.create_and_add_step(
            step_name=step_name,
            step_index=step_index,
            step_model=step_model,
            request_details=request_details,
            response_details=response_details,
            usage_info=usage_info,
            step_start_time=step_start_time,
            step_duration=step_duration,
            step_artifact_id=step_artifact_id,
            execution_steps=execution_steps,
            step_type='ai_generation'
        )
        
        # Update job with execution steps and artifacts
        artifacts_list = update_job_artifacts_list(job, step_artifact_id, image_artifact_ids)
        
        self.db.update_job(job_id, {
            'execution_steps': execution_steps,
            'artifacts': artifacts_list
        }, s3_service=self.s3)
        
        logger.info(f"Step {step_index + 1} completed successfully in {step_duration:.0f}ms")
        
        # Build output using output builder
        return self.output_builder.build_single_mode_output(
            step_name=step_name,
            step_index=step_index,
            step_output=step_output,
            step_artifact_id=step_artifact_id,
            image_urls=image_urls,
            image_artifact_ids=image_artifact_ids,
            usage_info=usage_info,
            duration_ms=int(step_duration),
            success=True
        )

