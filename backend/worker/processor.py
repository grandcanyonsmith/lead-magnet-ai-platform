"""
Job Processor
Handles the complete workflow of generating AI reports and rendering HTML.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

from ai_service import AIService
try:
    from model_types import Job, Workflow, Step, Submission, Form, ExecutionStep
except ImportError:
    # Fallback if model_types module not available
    Job = Dict[str, Any]
    Workflow = Dict[str, Any]
    Step = Dict[str, Any]
    Submission = Dict[str, Any]
    Form = Dict[str, Any]
    ExecutionStep = Dict[str, Any]
from template_service import TemplateService
from db_service import DynamoDBService
from s3_service import S3Service
from artifact_service import ArtifactService
from delivery_service import DeliveryService
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.field_label_service import FieldLabelService
from services.step_processor import StepProcessor
from services.workflow_orchestrator import WorkflowOrchestrator
from services.job_completion_service import JobCompletionService
from services.job_error_handler import JobErrorHandler
from services.data_loader_service import DataLoaderService
from dependency_resolver import resolve_execution_groups, validate_dependencies
from core import log_context

logger = logging.getLogger(__name__)


class JobProcessor:
    """Processes lead magnet generation jobs."""
    
    def __init__(
        self,
        db_service: DynamoDBService,
        s3_service: S3Service,
        ai_service: Optional[AIService] = None,
        template_service: Optional[TemplateService] = None,
        artifact_service: Optional[ArtifactService] = None,
        delivery_service: Optional[DeliveryService] = None,
        usage_service: Optional[UsageService] = None,
        image_artifact_service: Optional[Any] = None,
        job_completion_service: Optional[JobCompletionService] = None,
        step_processor: Optional[StepProcessor] = None,
        workflow_orchestrator: Optional[WorkflowOrchestrator] = None,
        data_loader: Optional[DataLoaderService] = None
    ):
        """
        Initialize job processor with all required services.
        
        Args:
            db_service: DynamoDB service instance
            s3_service: S3 service instance
            ai_service: Optional AI service instance
            template_service: Optional Template service instance
            artifact_service: Optional Artifact service instance
            delivery_service: Optional Delivery service instance
            usage_service: Optional Usage service instance
            image_artifact_service: Optional Image Artifact service instance
            job_completion_service: Optional Job Completion service instance
            step_processor: Optional Step Processor instance
            workflow_orchestrator: Optional Workflow Orchestrator instance
            data_loader: Optional Data Loader service instance
        """
        self.db = db_service
        self.s3 = s3_service
        # Pass db/s3 so AIService can optionally persist live step output while streaming.
        self.ai_service = ai_service or AIService(db_service=db_service, s3_service=s3_service)
        self.template_service = template_service or TemplateService()
        
        # Initialize core services
        self.artifact_service = artifact_service or ArtifactService(db_service, s3_service)
        self.delivery_service = delivery_service or DeliveryService(db_service, self.ai_service, s3_service)
        self.usage_service = usage_service or UsageService(db_service)
        
        # Initialize image artifact service
        if image_artifact_service:
            self.image_artifact_service = image_artifact_service
        else:
            from services.image_artifact_service import ImageArtifactService
            self.image_artifact_service = ImageArtifactService(self.artifact_service)
        
        # Initialize job completion service (needed by workflow orchestrator)
        self.job_completion_service = job_completion_service or JobCompletionService(
            artifact_service=self.artifact_service,
            db_service=self.db,
            s3_service=self.s3,
            delivery_service=self.delivery_service,
            usage_service=self.usage_service
        )
        
        # Initialize step processor
        self.step_processor = step_processor or StepProcessor(
            ai_service=self.ai_service,
            artifact_service=self.artifact_service,
            db_service=self.db,
            s3_service=self.s3,
            usage_service=self.usage_service,
            image_artifact_service=self.image_artifact_service
        )
        
        # Initialize workflow orchestrator
        self.workflow_orchestrator = workflow_orchestrator or WorkflowOrchestrator(
            step_processor=self.step_processor,
            ai_service=self.ai_service,
            db_service=self.db,
            s3_service=self.s3,
            job_completion_service=self.job_completion_service
        )
        
        # Initialize data loader service for parallel data loading
        self.data_loader = data_loader or DataLoaderService(self.db)
    
    def resolve_step_dependencies(self, steps: List[Step]) -> Dict[str, Any]:
        """
        Resolve step dependencies and build execution plan.
        
        Args:
            steps: List of workflow step dictionaries
            
        Returns:
            Dictionary with executionGroups and totalSteps
        """
        try:
            # Validate dependencies first
            is_valid, errors = validate_dependencies(steps)
            if not is_valid:
                logger.warning(f"Dependency validation errors: {errors}")
                # Continue anyway for backward compatibility
            
            # Resolve execution groups
            execution_plan = resolve_execution_groups(steps)
            
            logger.info(f"[JobProcessor] Resolved execution plan", extra={
                'total_steps': execution_plan['totalSteps'],
                'execution_groups': len(execution_plan['executionGroups']),
                'groups': [
                    {
                        'groupIndex': g['groupIndex'],
                        'stepIndices': g['stepIndices'],
                        'canRunInParallel': g['canRunInParallel']
                    }
                    for g in execution_plan['executionGroups']
                ]
            })
            
            return execution_plan
        except Exception as e:
            logger.error(f"Error resolving step dependencies: {e}", exc_info=True)
            # Fallback to sequential execution
            return {
                'executionGroups': [{'groupIndex': i, 'stepIndices': [i], 'canRunInParallel': False} for i in range(len(steps))],
                'totalSteps': len(steps),
            }
    
    def _load_job_data(self, job_id: str) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Optional[Dict[str, Any]]]:
        """
        Load all required data for job processing using parallel loading.
        
        Args:
            job_id: The job ID to load data for
            
        Returns:
            Tuple of (job, workflow, submission, form)
            
        Raises:
            ValueError: If job, workflow, or submission is not found
        """
        logger.debug(f"[JobProcessor] Loading job data in parallel", extra={'job_id': job_id})
        
        # Use DataLoaderService for parallel loading
        data = self.data_loader.load_job_data(job_id)
        
        job = data['job']
        workflow = data['workflow']
        submission = data['submission']
        form = data['form']
        
        # Bind correlation context
        log_context.bind(
            tenant_id=job.get('tenant_id'),
            workflow_id=workflow.get('workflow_id'),
            submission_id=submission.get('submission_id'),
            workflow_name=workflow.get('workflow_name')
        )
        
        logger.info(f"[JobProcessor] Job data loaded successfully", extra={
            'job_id': job_id,
            'tenant_id': job.get('tenant_id'),
            'workflow_id': workflow.get('workflow_id'),
            'submission_id': submission.get('submission_id'),
            'workflow_name': workflow.get('workflow_name'),
            'has_steps': bool(workflow.get('steps')),
            'steps_count': len(workflow.get('steps', [])),
            'has_form': form is not None
        })
        
        return job, workflow, submission, form
    
    def _initialize_job_execution(self, job_id: str, process_start_time: datetime) -> List[Dict[str, Any]]:
        """
        Initialize job execution by updating status and creating initial execution steps.
        
        Args:
            job_id: The job ID
            process_start_time: Start time of the process
            
        Returns:
            Initialized execution steps list
        """
        execution_steps = []
        
        # Update job status to processing
        logger.debug(f"[JobProcessor] Updating job status to processing", extra={'job_id': job_id})
        self.db.update_job(job_id, {
            'status': 'processing',
            'started_at': process_start_time.isoformat(),
            'updated_at': process_start_time.isoformat(),
            'execution_steps': execution_steps
        }, s3_service=self.s3)
        
        return execution_steps
    
    def _add_form_submission_step(self, job_id: str, submission: Dict[str, Any], form: Optional[Dict[str, Any]], execution_steps: List[Dict[str, Any]]) -> None:
        """
        Add form submission as the initial execution step.
        
        Args:
            job_id: The job ID
            submission: Submission dictionary
            form: Optional form dictionary (used for label mapping)
            execution_steps: Execution steps list to update
        """
        submission_data = submission.get('submission_data', {})
        
        # Map fields if form is available to ensure labels are used in execution steps
        if form:
            try:
                field_label_map = FieldLabelService.build_field_label_map(form)
                submission_data = FieldLabelService.map_submission_data_keys(
                    submission_data,
                    field_label_map
                )
            except Exception as e:
                logger.warning(f"[JobProcessor] Failed to map form submission labels: {e}")
                # Continue with original submission_data
        
        execution_steps.append(
            ExecutionStepManager.create_form_submission_step(submission_data)
        )
        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)

    def _validate_workflow_steps(self, workflow: Dict[str, Any]) -> None:
        """
        Validate that workflow has steps configured.
        
        Args:
            workflow: Workflow dictionary
            
        Raises:
            ValueError: If workflow has no steps
        """
        steps = workflow.get('steps', [])
        if not steps or len(steps) == 0:
            workflow_id = workflow.get('workflow_id', 'unknown')
            raise ValueError(
                f"Workflow {workflow_id} has no steps configured. "
                "All workflows must use the steps format. "
                "Legacy format is no longer supported."
            )
    
    def process_job(self, job_id: str) -> Dict[str, Any]:
        """
        Process a job end-to-end.
        
        Args:
            job_id: The job ID to process
            
        Returns:
            Dictionary with success status and optional error
        """
        process_start_time = datetime.utcnow()
        logger.info(f"[JobProcessor] Starting job processing", extra={
            'job_id': job_id,
            'start_time': process_start_time.isoformat()
        })
        
        try:
            # Initialize execution
            execution_steps = self._initialize_job_execution(job_id, process_start_time)
            
            # Load all required data
            job, workflow, submission, form = self._load_job_data(job_id)
            
            # Add form submission as step 0
            self._add_form_submission_step(job_id, submission, form, execution_steps)
            
            # Validate workflow has steps
            self._validate_workflow_steps(workflow)
            
            # Process workflow using steps format
            final_content, final_artifact_type, final_filename, report_artifact_id, all_image_artifact_ids = \
                self.workflow_orchestrator.execute_workflow(
                    job_id=job_id,
                    job=job,
                    workflow=workflow,
                    submission=submission,
                    form=form,
                    execution_steps=execution_steps
                )
            
            # Finalize job (store final artifact, update status, deliver, notify)
            public_url = self.job_completion_service.finalize_job(
                job_id=job_id,
                job=job,
                workflow=workflow,
                submission=submission,
                final_content=final_content,
                final_artifact_type=final_artifact_type,
                final_filename=final_filename,
                report_artifact_id=report_artifact_id,
                all_image_artifact_ids=all_image_artifact_ids,
                execution_steps=execution_steps
            )
            
            logger.info(f"Job {job_id} completed successfully")
            return {
                'success': True,
                'job_id': job_id,
                'output_url': public_url
            }
            
        except Exception as e:
            logger.exception(f"Error processing job {job_id}")
            
            # Use error handler service for consistent error handling
            error_handler = JobErrorHandler(self.db)
            return error_handler.handle_job_error(
                job_id=job_id,
                error=e,
                step_index=None,
                step_type='workflow_step'
            )
    
    def _load_single_step_data(self, job_id: str) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Optional[Dict[str, Any]]]:
        """
        Load data required for single step processing using parallel loading.
        
        Args:
            job_id: The job ID
            
        Returns:
            Tuple of (job, workflow, submission, form)
            
        Raises:
            ValueError: If job, workflow, or submission is not found or missing required fields
        """
        # Use DataLoaderService for parallel loading
        data = self.data_loader.load_job_data(job_id)
        
        job = data['job']
        workflow = data['workflow']
        submission = data['submission']
        form = data['form']
        
        # Validate required job fields
        if not job.get('workflow_id'):
            raise ValueError(f"Job {job_id} is missing required field 'workflow_id'")
        if not job.get('submission_id'):
            raise ValueError(f"Job {job_id} is missing required field 'submission_id'")
        
        # Bind correlation context
        log_context.bind(
            tenant_id=job.get('tenant_id'),
            workflow_id=workflow.get('workflow_id'),
            submission_id=submission.get('submission_id'),
            workflow_name=workflow.get('workflow_name')
        )
        
        return job, workflow, submission, form
    
    def _build_initial_context(self, submission: Dict[str, Any], form: Optional[Dict[str, Any]]) -> str:
        """
        Build initial context from submission data with field labels.
        
        Args:
            submission: Submission dictionary
            form: Optional form dictionary
            
        Returns:
            Formatted initial context string
        """
        submission_data = submission.get('submission_data', {})
        field_label_map = FieldLabelService.build_field_label_map(form)
        return FieldLabelService.format_submission_data_with_labels(
            submission_data,
            field_label_map
        )
    
    def _validate_step_index(self, step_index: int, steps: List[Dict[str, Any]], workflow_id: str) -> None:
        """
        Validate that step index is within bounds.
        
        Args:
            step_index: Step index to validate
            steps: List of workflow steps
            workflow_id: Workflow ID for error messages
            
        Raises:
            ValueError: If step index is invalid or workflow has no steps
        """
        if not steps or len(steps) == 0:
            raise ValueError(f"Workflow {workflow_id} has no steps configured")
        
        if step_index < 0 or step_index >= len(steps):
            raise ValueError(f"Step index {step_index} is out of range. Workflow has {len(steps)} steps.")
    
    def process_single_step(self, job_id: str, step_index: int, step_type: str = 'workflow_step') -> Dict[str, Any]:
        """
        Process a single step of a workflow job.
        
        This method is called by Step Functions for per-step processing,
        where each step gets its own Lambda invocation and 15-minute timeout.
        
        Args:
            job_id: The job ID to process
            step_index: The index of the step to process (0-based)
            step_type: Type of step - 'workflow_step' or 'html_generation'
            
        Returns:
            Dictionary with success status, step output, and metadata
        """

        try:
            # Load all required data
            job, workflow, submission, form = self._load_single_step_data(job_id)
            
            # Build initial context
            initial_context = self._build_initial_context(submission, form)
            
            # Load existing execution_steps
            execution_steps = job.get('execution_steps', [])
            
            # Handle HTML generation step (special case)
            if step_type == 'html_generation':
                submission_data = submission.get('submission_data', {})
                return self.job_completion_service.generate_html_from_steps(
                    job_id=job_id,
                    job=job,
                    workflow=workflow,
                    submission_data=submission_data,
                    execution_steps=execution_steps,
                    initial_context=initial_context
                )
            
            # Handle workflow step
            steps = workflow.get('steps', [])
            self._validate_step_index(step_index, steps, workflow.get('workflow_id', 'unknown'))
            
            # Get the step to process
            step = steps[step_index]
            
            # Process the step using step processor
            return self.step_processor.process_single_step(
                step=step,
                step_index=step_index,
                steps=steps,
                job_id=job_id,
                job=job,
                initial_context=initial_context,
                execution_steps=execution_steps
            )
            
        except Exception as e:
            logger.exception(f"Error processing step {step_index} for job {job_id}")
            
            # Use error handler service for consistent error handling
            error_handler = JobErrorHandler(self.db)
            return error_handler.handle_job_error(
                job_id=job_id,
                error=e,
                step_index=step_index,
                step_type=step_type
            )
