"""
Step Processor Service
Handles processing of individual workflow steps using delegated handlers.
"""

import logging
from typing import Dict, Any, List, Tuple

from ai_service import AIService
from artifact_service import ArtifactService
from db_service import DynamoDBService
from s3_service import S3Service
from services.usage_service import UsageService
from services.image_artifact_service import ImageArtifactService
from services.context_builder import ContextBuilder
from utils.step_utils import normalize_step_order, normalize_dependency_list
from dependency_resolver import get_ready_steps, get_step_status
from core import log_context

from services.steps.registry import StepRegistry
from services.steps.handlers.ai_generation import AIStepHandler
from services.steps.handlers.webhook import WebhookStepHandler
from services.steps.handlers.browser_automation import BrowserStepHandler
from services.steps.handlers.html_patch import HtmlStepHandler
from services.steps.handlers.handoff import HandoffStepHandler

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
        """
        self.db = db_service
        self.s3 = s3_service
        
        # Initialize Step Registry and Handlers
        self.registry = StepRegistry()
        
        # Shared services dict for handlers
        services = {
            'ai_service': ai_service,
            'artifact_service': artifact_service,
            'db_service': db_service,
            's3_service': s3_service,
            'usage_service': usage_service,
            'image_artifact_service': image_artifact_service
        }
        
        # Register default handlers
        self.registry.register('ai_generation', AIStepHandler(services))
        self.registry.register('webhook', WebhookStepHandler(services))
        self.registry.register('workflow_handoff', HandoffStepHandler(services))
        self.registry.register('browser', BrowserStepHandler(services))
        self.registry.register('html', HtmlStepHandler(services))

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
        Delegates to registered handlers.
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        has_webhook = bool(step.get('webhook_url'))
        has_handoff = bool(step.get('handoff_workflow_id'))

        if has_webhook and has_handoff:
            raise ValueError("Step cannot have both webhook_url and handoff_workflow_id")

        # Normalize step type for webhook/handoff based on config fields (step_type is deprecated)
        if has_webhook:
            step_type = 'webhook'
            step['_sorted_steps'] = sorted_steps
        elif has_handoff:
            step_type = 'workflow_handoff'
            
        handler = self.registry.get_handler(step_type)
        if not handler:
            # Fallback to AI generation for unknown types (or raise error)
            # Legacy behavior defaulted to AI generation often
            handler = self.registry.get_handler('ai_generation')
            step_type = 'ai_generation'

        # Bind step-specific context
        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type=step_type
        ):
            # Reload execution_steps from S3 to ensure freshness
            try:
                job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
                if job_with_steps and job_with_steps.get('execution_steps'):
                    execution_steps = job_with_steps['execution_steps']
            except Exception as e:
                logger.warning(f"[StepProcessor] Failed to reload execution_steps, using provided list: {e}")

            # Build context
            # For AI steps, we build full context. For webhooks, it might be unused but passed for consistency.
            # Only include form submission in the first step (step_index 0)
            all_previous_context = ContextBuilder.build_previous_context_from_step_outputs(
                initial_context=initial_context,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                include_form_submission=(step_index == 0)
            )
            
            # Execute handler
            # Handlers are responsible for updating execution_steps and DB
            step_output_result, image_artifact_ids = handler.execute(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=tenant_id,
                context=all_previous_context,
                step_outputs=step_outputs,
                execution_steps=execution_steps
            )
            
            # Update local state if needed (though handlers update DB, we return results)
            all_image_artifact_ids.extend(image_artifact_ids)
            
            return step_output_result, image_artifact_ids

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
        Process a single step (used by process_single_step / rerun).
        Delegates to registered handlers.
        """
        step_name = step.get('step_name', f'Step {step_index + 1}')
        step_type = step.get('step_type', 'ai_generation')
        
        has_webhook = bool(step.get('webhook_url'))
        has_handoff = bool(step.get('handoff_workflow_id'))

        if has_webhook and has_handoff:
            raise ValueError("Step cannot have both webhook_url and handoff_workflow_id")

        if has_webhook:
            step_type = 'webhook'
            step['_sorted_steps'] = sorted(steps, key=lambda s: s.get('step_order', 0))
        elif has_handoff:
            step_type = 'workflow_handoff'
            
        handler = self.registry.get_handler(step_type)
        if not handler:
            handler = self.registry.get_handler('ai_generation')
            step_type = 'ai_generation'

        with log_context.log_context(
            step_index=step_index,
            step_name=step_name,
            step_type=step_type
        ):
            # Reload execution_steps from DB/S3
            try:
                job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
                if job_with_steps and job_with_steps.get('execution_steps'):
                    execution_steps = job_with_steps['execution_steps']
            except Exception as e:
                logger.warning(f"[StepProcessor] Failed to reload execution_steps: {e}")

            # Check dependencies (only if configured)
            self._check_dependencies(step, step_index, steps, execution_steps)
            
            # Build context from execution steps (since we are in single step mode, we might not have step_outputs list passed in)
            # Use helper to build step_outputs from execution_steps
            step_outputs = self._build_step_outputs_from_execution_steps(execution_steps, steps)
            
            # Dependency-aware context building
            step_deps = normalize_dependency_list(step.get('depends_on', []))
            if not step_deps:
                 step_order = step.get('step_order', step_index)
                 step_deps = [i for i, s in enumerate(steps) if s.get('step_order', i) < step_order]

            # Only include form submission in the first step (step_index 0)
            context = ContextBuilder.build_previous_context_from_execution_steps(
                initial_context=initial_context,
                execution_steps=execution_steps,
                current_step_order=step_index + 1,
                dependency_indices=step_deps,
                include_form_submission=(step_index == 0)
            )
            
            # Execute handler
            step_output_result, image_artifact_ids = handler.execute(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=job.get('tenant_id'),
                context=context,
                step_outputs=step_outputs,
                execution_steps=execution_steps
            )
            
            # Helper to update artifacts list in job (handlers might not do this part fully or might need consolidation)
            # Handlers typically update execution_steps. Artifacts list update is job-level.
            self._update_job_artifacts(job, step_output_result, image_artifact_ids)
            
            return step_output_result

    def _check_dependencies(
        self, 
        step: Dict[str, Any], 
        step_index: int, 
        steps: List[Dict[str, Any]], 
        execution_steps: List[Dict[str, Any]]
    ):
        """Check if step dependencies are satisfied."""
        step_deps = step.get('depends_on', [])
        if not step_deps:
            step_order = step.get('step_order', step_index)
            step_deps = [i for i, s in enumerate(steps) if s.get('step_order', i) < step_order]
        else:
            step_deps = normalize_dependency_list(step_deps)
            
        completed_step_indices = [
            normalize_step_order(s) - 1
            for s in execution_steps
            if s.get('step_type') in ['ai_generation', 'webhook', 'workflow_handoff', 'html_patch', 'browser'] and normalize_step_order(s) > 0
        ]
        
        all_deps_completed = all(dep_index in completed_step_indices for dep_index in step_deps)
        
        if not all_deps_completed:
            missing_deps = [dep for dep in step_deps if dep not in completed_step_indices]
            logger.warning(f"Step {step_index + 1} waiting for dependencies: {missing_deps}")
            raise ValueError(f"Step {step_index + 1} cannot execute yet. Missing dependencies: {missing_deps}")

    def _build_step_outputs_from_execution_steps(
        self,
        execution_steps: List[Dict[str, Any]],
        steps: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Build step_outputs list from execution_steps.
        """
        step_outputs = []
        for exec_step in execution_steps:
            if exec_step.get('step_type') == 's3_upload': # Skip internal types
                continue
                
            step_order = normalize_step_order(exec_step)
            if step_order <= 0:
                continue
            
            workflow_step_index = step_order - 1
            step_outputs.append({
                'step_name': exec_step.get('step_name', f'Step {workflow_step_index + 1}'),
                'step_index': workflow_step_index,
                'output': exec_step.get('output', ''),
                'artifact_id': exec_step.get('artifact_id'),
                'image_urls': exec_step.get('image_urls', [])
            })

        step_outputs.sort(key=lambda s: s.get('step_index', 0))
        return step_outputs

    def _update_job_artifacts(
        self, 
        job: Dict[str, Any], 
        step_output_result: Dict[str, Any], 
        image_artifact_ids: List[str]
    ):
        """Update job artifacts list with new artifacts."""
        artifacts_list = job.get('artifacts', [])
        modified = False
        
        step_artifact_id = step_output_result.get('artifact_id')
        if step_artifact_id and step_artifact_id not in artifacts_list:
            artifacts_list.append(step_artifact_id)
            modified = True
            
        for img_id in image_artifact_ids:
            if img_id not in artifacts_list:
                artifacts_list.append(img_id)
                modified = True
                
        if modified:
            self.db.update_job(job['job_id'], {'artifacts': artifacts_list}, s3_service=self.s3)
