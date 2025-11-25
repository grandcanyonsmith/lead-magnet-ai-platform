"""
Step Processor Service
Handles processing of individual workflow steps.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from ai_service import AIService
try:
    from model_types import Step, StepOutput, ExecutionStep, WebhookResult
except ImportError:
    # Fallback if model_types module not available
    Step = Dict[str, Any]
    StepOutput = Dict[str, Any]
    ExecutionStep = Dict[str, Any]
    WebhookResult = Dict[str, Any]
from artifact_service import ArtifactService
from db_service import DynamoDBService
from s3_service import S3Service
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.image_artifact_service import ImageArtifactService
from services.webhook_step_service import WebhookStepService
from services.ai_step_processor import AIStepProcessor
from utils.step_utils import normalize_step_order, normalize_dependency_list
from dependency_resolver import get_ready_steps, get_step_status

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
        image_artifact_service: ImageArtifactService
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
        
        # Extract tools and tool_choice from step config
        step_tools_raw = step.get('tools', ['web_search'])
        step_tools = [{"type": tool} if isinstance(tool, str) else tool for tool in step_tools_raw]
        step_tool_choice = step.get('tool_choice', 'auto')
        
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
        
        # Build context with ALL previous step outputs
        all_previous_context = ContextBuilder.build_previous_context_from_step_outputs(
            initial_context=initial_context,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps
        )
        
        logger.info(f"[StepProcessor] Built previous context for step {step_index + 1}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'previous_steps_count': len(step_outputs),
            'previous_context_length': len(all_previous_context),
            'previous_step_names': [sorted_steps[i].get('step_name') for i in range(len(step_outputs))],
            'previous_steps_with_images': len([s for s in step_outputs if s.get('image_urls')])
        })
        
        # Current step context (empty for subsequent steps, initial_context for first step)
        current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
        
        # Collect previous image URLs for image generation steps
        previous_image_urls = None
        # Check if this step uses image_generation tool
        has_image_generation = any(
            isinstance(t, dict) and t.get('type') == 'image_generation' 
            for t in step_tools
        ) if step_tools else False
        
        if has_image_generation:
            previous_image_urls = ContextBuilder.collect_previous_image_urls(
                execution_steps=execution_steps,
                current_step_order=step_index + 1
            )
            logger.info(f"[StepProcessor] Collected previous image URLs for image generation step (batch mode)", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'previous_image_urls_count': len(previous_image_urls),
                'previous_image_urls': previous_image_urls
            })
        
        # Process AI step using AI step processor
        step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self.ai_step_processor.process_ai_step(
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
        
        # Create step output dict
        step_output_dict = {
            'step_name': step_name,
            'step_index': step_index,
            'output': step_output,
            'artifact_id': step_artifact_id,
            'image_urls': image_urls
        }
        
        # Add execution step
        step_data = ExecutionStepManager.create_ai_generation_step(
            step_name=step_name,
            step_order=step_index + 1,
            step_model=step_model,
            request_details=request_details,
            response_details=response_details,
            usage_info=usage_info,
            step_start_time=step_start_time,
            step_duration=(datetime.utcnow() - step_start_time).total_seconds() * 1000,
            artifact_id=step_output_dict['artifact_id']
        )
        execution_steps.append(step_data)
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
    
    def _get_submission_for_webhook(
        self,
        job: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get submission data for webhook processing.
        
        Args:
            job: Job dictionary
            
        Returns:
            Submission dictionary (minimal dict if not found)
        """
        submission_id = job.get('submission_id')
        submission = None
        if submission_id:
            submission = self.db.get_submission(submission_id)
        if not submission:
            submission = {'submission_data': {}}
        return submission
    
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
        
        submission = self._get_submission_for_webhook(job)
        
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
        
        execution_steps.append(step_data)
        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
        
        # Create step output dict (webhook steps don't produce content artifacts)
        step_output_dict = {
            'step_name': step_name,
            'step_index': step_index,
            'output': f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
            'artifact_id': None,
            'image_urls': [],
            'webhook_result': webhook_result
        }
        
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
    
    def _build_step_outputs_from_execution_steps(
        self,
        execution_steps: List[Dict[str, Any]],
        steps: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Build step_outputs list from execution_steps for single mode processing.
        
        Args:
            execution_steps: List of execution steps
            steps: List of all workflow steps
            
        Returns:
            List of step output dictionaries
        """
        step_outputs = []
        sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
        for i, exec_step in enumerate(execution_steps):
            if exec_step.get('step_type') == 'ai_generation' and exec_step.get('step_order', 0) > 0:
                step_outputs.append({
                    'step_name': exec_step.get('step_name', f'Step {i}'),
                    'output': exec_step.get('output', ''),
                    'artifact_id': exec_step.get('artifact_id'),
                    'image_urls': exec_step.get('image_urls', [])
                })
        return step_outputs
    
    def _update_execution_steps_with_rerun_support(
        self,
        execution_steps: List[Dict[str, Any]],
        step_data: Dict[str, Any],
        step_order: int,
        step_type: str
    ) -> None:
        """
        Update execution_steps list, replacing existing step if present (for reruns).
        
        Args:
            execution_steps: List of execution steps (modified in place)
            step_data: New step data to add or replace
            step_order: Step order number
            step_type: Type of step ('webhook' or 'ai_generation')
        """
        existing_step_index = None
        for i, existing_step in enumerate(execution_steps):
            if existing_step.get('step_order') == step_order and existing_step.get('step_type') == step_type:
                existing_step_index = i
                break
        
        if existing_step_index is not None:
            logger.info(f"Replacing existing {step_type} execution step for step_order {step_order} (rerun)")
            execution_steps[existing_step_index] = step_data
        else:
            execution_steps.append(step_data)
    
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
        submission = self._get_submission_for_webhook(job)
        
        # Build step_outputs from execution_steps
        sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
        step_outputs = self._build_step_outputs_from_execution_steps(execution_steps, steps)
        
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
        self._update_execution_steps_with_rerun_support(
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
        
        return {
            'success': success,
            'step_index': step_index,
            'step_name': step_name,
            'step_output': f"Webhook sent to {webhook_result.get('webhook_url', 'N/A')}. Status: {webhook_result.get('response_status', 'N/A')}",
            'artifact_id': None,
            'image_urls': [],
            'image_artifact_ids': [],
            'webhook_result': webhook_result,
            'duration_ms': webhook_result.get('duration_ms', 0)
        }
    
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
        step_instructions = step.get('instructions', '')
        
        # Reload execution_steps from database/S3 to ensure we have the latest data
        # This is important when steps are processed in separate Lambda invocations
        try:
            job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
            if job_with_steps and job_with_steps.get('execution_steps'):
                execution_steps = job_with_steps['execution_steps']
                logger.debug(f"[StepProcessor] Reloaded execution_steps from database", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'execution_steps_count': len(execution_steps)
                })
        except Exception as e:
            logger.warning(f"[StepProcessor] Failed to reload execution_steps, using provided list", extra={
                'job_id': job_id,
                'step_index': step_index,
                'error': str(e)
            })
            # Continue with provided execution_steps if reload fails
        
        # Check if dependencies are satisfied
        step_deps = step.get('depends_on', [])
        if not step_deps:
            # Auto-detect from step_order
            step_order = step.get('step_order', step_index)
            step_deps = [
                i for i, s in enumerate(steps)
                if s.get('step_order', i) < step_order
            ]
        else:
            # Normalize dependency values (handle Decimal types from DynamoDB)
            step_deps = normalize_dependency_list(step_deps)
        
        # Get completed step indices from execution_steps (include both AI and webhook steps)
        completed_step_indices = [
            normalize_step_order(s) - 1  # Convert 1-indexed step_order to 0-indexed
            for s in execution_steps
            if s.get('step_type') in ['ai_generation', 'webhook'] and normalize_step_order(s) > 0
        ]
        
        logger.debug(f"[StepProcessor] Dependency check", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_deps': step_deps,
            'completed_step_indices': completed_step_indices,
            'execution_steps_count': len(execution_steps),
            'execution_steps_types': [s.get('step_type') for s in execution_steps],
            'execution_steps_orders': [normalize_step_order(s) for s in execution_steps]
        })
        
        # Check if all dependencies are completed
        all_deps_completed = len(step_deps) == 0 or all(dep_index in completed_step_indices for dep_index in step_deps)
        
        if not all_deps_completed:
            missing_deps = [dep for dep in step_deps if dep not in completed_step_indices]
            logger.warning(f"[StepProcessor] Step {step_index + 1} ({step_name}) waiting for dependencies", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_status': 'waiting',
                'missing_dependencies': missing_deps,
                'completed_steps': completed_step_indices
            })
            raise ValueError(f"Step {step_index + 1} ({step_name}) cannot execute yet. Missing dependencies: {missing_deps}")
        
        # Get ready steps for logging (only for AI steps)
        if step_type != 'webhook':
            ready_steps = get_ready_steps(completed_step_indices, steps)
            step_status_map = get_step_status(completed_step_indices, [], steps)
            
            logger.info(f"[StepProcessor] Step readiness check", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_status': 'ready',
                'dependencies': step_deps,
                'all_dependencies_completed': all_deps_completed,
                'ready_steps': ready_steps,
                'step_status_map': {k: v for k, v in step_status_map.items()}
            })
        
        # Extract tools and tool_choice from step config
        step_tools_raw = step.get('tools', ['web_search'])
        step_tools = [{"type": tool} if isinstance(tool, str) else tool for tool in step_tools_raw]
        step_tool_choice = step.get('tool_choice', 'auto')
        
        logger.info(f"Processing step {step_index + 1}/{len(steps)}: {step_name}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_status': 'ready'
        })
        
        step_start_time = datetime.utcnow()
        image_artifact_ids = []
        current_step_order = step_index + 1
        
        # Build context only from dependency steps
        all_previous_context = ContextBuilder.build_previous_context_from_execution_steps(
            initial_context=initial_context,
            execution_steps=execution_steps,
            current_step_order=step_index + 1,
            dependency_indices=step_deps
        )
        
        logger.info(f"[StepProcessor] Built previous context for step {step_index + 1}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'current_step_order': current_step_order,
            'previous_steps_count': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order]),
            'previous_context_length': len(all_previous_context),
            'previous_steps_with_images': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order and s.get('image_urls')])
        })
        
        # Current step context
        current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
        
        # Collect previous image URLs for image generation steps
        previous_image_urls = []
        # Check if this step uses image_generation tool
        has_image_generation = any(
            isinstance(t, dict) and t.get('type') == 'image_generation' 
            for t in step_tools
        ) if step_tools else False
        
        if has_image_generation:
            previous_image_urls = ContextBuilder.collect_previous_image_urls(
                execution_steps=execution_steps,
                current_step_order=step_index + 1
            )
            logger.info(f"[StepProcessor] Collected previous image URLs for image generation step", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'previous_image_urls_count': len(previous_image_urls),
                'previous_image_urls': previous_image_urls
            })
        
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
            'previous_image_urls_count': len(previous_image_urls)
        })
        
        # Process AI step using AI step processor
        try:
            step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = self.ai_step_processor.process_ai_step(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=job['tenant_id'],
                initial_context=initial_context,
                previous_context=all_previous_context,
                current_step_context=current_step_context,
                step_tools=step_tools,
                step_tool_choice=step_tool_choice,
                previous_image_urls=previous_image_urls if has_image_generation else None
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
        except Exception as step_error:
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
        
        step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
        
        # Extract image URLs from response
        image_urls = response_details.get('image_urls', [])
        
        # Add execution step
        step_data = ExecutionStepManager.create_ai_generation_step(
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
        
        # Update execution steps with rerun support
        self._update_execution_steps_with_rerun_support(
            execution_steps=execution_steps,
            step_data=step_data,
            step_order=step_index + 1,
            step_type='ai_generation'
        )
        
        # Update job with execution steps and add artifacts to job's artifacts list
        artifacts_list = job.get('artifacts', [])
        if step_artifact_id not in artifacts_list:
            artifacts_list.append(step_artifact_id)
        for image_artifact_id in image_artifact_ids:
            if image_artifact_id not in artifacts_list:
                artifacts_list.append(image_artifact_id)
        
        self.db.update_job(job_id, {
            'execution_steps': execution_steps,
            'artifacts': artifacts_list
        }, s3_service=self.s3)
        
        logger.info(f"Step {step_index + 1} completed successfully in {step_duration:.0f}ms")
        
        return {
            'success': True,
            'step_index': step_index,
            'step_name': step_name,
            'step_output': step_output,
            'artifact_id': step_artifact_id,
            'image_urls': image_urls,
            'image_artifact_ids': image_artifact_ids,
            'usage_info': usage_info,
            'duration_ms': int(step_duration)
        }

