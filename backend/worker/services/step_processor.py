"""
Step Processor Service
Handles processing of individual workflow steps.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from ai_service import AIService
from artifact_service import ArtifactService
from db_service import DynamoDBService
from s3_service import S3Service
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.image_artifact_service import ImageArtifactService
from utils.content_detector import detect_content_type
from utils.step_utils import normalize_step_order
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
        step_model = step.get('model', 'gpt-5')
        step_instructions = step.get('instructions', '')
        
        # Extract tools and tool_choice from step config
        step_tools_raw = step.get('tools', ['web_search_preview'])
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
        
        # Generate step output
        step_output, usage_info, request_details, response_details = self.ai_service.generate_report(
            model=step_model,
            instructions=step_instructions,
            context=current_step_context,
            previous_context=all_previous_context,
            tools=step_tools,
            tool_choice=step_tool_choice,
            tenant_id=tenant_id,
            job_id=job_id
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
        
        step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
        
        logger.info(f"[StepProcessor] Step completed successfully", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_model': step_model,
            'duration_ms': step_duration,
            'output_length': len(step_output),
            'input_tokens': usage_info.get('input_tokens', 0),
            'output_tokens': usage_info.get('output_tokens', 0),
            'total_tokens': usage_info.get('total_tokens', 0),
            'cost_usd': usage_info.get('cost_usd', 0),
            'images_generated': len(response_details.get('image_urls', []))
        })
        
        # Store usage record
        self.usage_service.store_usage_record(tenant_id, job_id, usage_info)
        
        # Determine file extension based on content and step name
        file_ext = detect_content_type(step_output, step_name)
        
        # Store step output as artifact
        step_artifact_id = self.artifact_service.store_artifact(
            tenant_id=tenant_id,
            job_id=job_id,
            artifact_type='step_output',
            content=step_output,
            filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}{file_ext}'
        )
        
        # Extract and store image URLs
        image_urls = response_details.get('image_urls', [])
        logger.info("[StepProcessor] Extracting image URLs from response_details", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count_before': len(image_urls),
            'image_urls': image_urls,
            'image_urls_type': type(image_urls).__name__
        })
        
        image_artifact_ids = self.image_artifact_service.store_image_artifacts(
            image_urls=image_urls,
            tenant_id=tenant_id,
            job_id=job_id,
            step_index=step_index,
            step_name=step_name
        )
        
        logger.info("[StepProcessor] Image artifacts stored", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count': len(image_urls),
            'image_artifact_ids_count': len(image_artifact_ids),
            'image_artifact_ids': image_artifact_ids
        })
        
        all_image_artifact_ids.extend(image_artifact_ids)
        
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
            step_duration=step_duration,
            artifact_id=step_artifact_id
        )
        execution_steps.append(step_data)
        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
        
        return step_output_dict, image_artifact_ids
    
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
        step_model = step.get('model', 'gpt-5')
        step_instructions = step.get('instructions', '')
        
        # Check if dependencies are satisfied
        step_deps = step.get('depends_on', [])
        if not step_deps:
            # Auto-detect from step_order
            step_order = step.get('step_order', step_index)
            step_deps = [
                i for i, s in enumerate(steps)
                if s.get('step_order', i) < step_order
            ]
        
        # Get completed step indices from execution_steps
        completed_step_indices = [
            normalize_step_order(s) - 1  # Convert 1-indexed step_order to 0-indexed
            for s in execution_steps
            if s.get('step_type') == 'ai_generation' and normalize_step_order(s) > 0
        ]
        
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
        
        # Get ready steps for logging
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
        step_tools_raw = step.get('tools', ['web_search_preview'])
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
        
        logger.info(f"[StepProcessor] Processing step {step_index + 1}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'step_model': step_model,
            'step_tool_choice': step_tool_choice,
            'step_tools_count': len(step_tools) if step_tools else 0,
            'step_tools': [t.get('type') if isinstance(t, dict) else t for t in step_tools] if step_tools else [],
            'current_step_context_length': len(current_step_context),
            'previous_context_length': len(all_previous_context)
        })
        
        # Generate step output
        try:
            step_output, usage_info, request_details, response_details = self.ai_service.generate_report(
                model=step_model,
                instructions=step_instructions,
                context=current_step_context,
                previous_context=all_previous_context,
                tools=step_tools,
                tool_choice=step_tool_choice,
                tenant_id=job['tenant_id'],
                job_id=job_id
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
        
        # Store usage record
        self.usage_service.store_usage_record(job['tenant_id'], job_id, usage_info)
        
        # Determine file extension
        file_ext = detect_content_type(step_output, step_name)
        
        # Store step output as artifact
        step_artifact_id = self.artifact_service.store_artifact(
            tenant_id=job['tenant_id'],
            job_id=job_id,
            artifact_type='step_output',
            content=step_output,
            filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}{file_ext}'
        )
        
        # Extract and store image URLs
        image_urls = response_details.get('image_urls', [])
        logger.info("[StepProcessor] Extracting image URLs from response_details", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count_before': len(image_urls),
            'image_urls': image_urls,
            'image_urls_type': type(image_urls).__name__
        })
        
        image_artifact_ids = self.image_artifact_service.store_image_artifacts(
            image_urls=image_urls,
            tenant_id=job['tenant_id'],
            job_id=job_id,
            step_index=step_index,
            step_name=step_name
        )
        
        logger.info("[StepProcessor] Image artifacts stored", extra={
            'job_id': job_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count': len(image_urls),
            'image_artifact_ids_count': len(image_artifact_ids),
            'image_artifact_ids': image_artifact_ids
        })
        
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
        
        # Check if this step already exists (for reruns) and replace it, otherwise append
        step_order = step_index + 1
        existing_step_index = None
        for i, existing_step in enumerate(execution_steps):
            if existing_step.get('step_order') == step_order and existing_step.get('step_type') == 'ai_generation':
                existing_step_index = i
                break
        
        if existing_step_index is not None:
            logger.info(f"Replacing existing execution step for step_order {step_order} (rerun)")
            execution_steps[existing_step_index] = step_data
        else:
            execution_steps.append(step_data)
        
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

