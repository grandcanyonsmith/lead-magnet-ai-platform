"""
Job Processor
Handles the complete workflow of generating AI reports and rendering HTML.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional

from ai_service import AIService
from template_service import TemplateService
from db_service import DynamoDBService
from s3_service import S3Service
from artifact_service import ArtifactService
from delivery_service import DeliveryService
from utils.error_utils import create_descriptive_error, normalize_error_message
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from services.field_label_service import FieldLabelService
from services.step_processor import StepProcessor
from services.workflow_orchestrator import WorkflowOrchestrator
from services.job_completion_service import JobCompletionService
from dependency_resolver import resolve_execution_groups, validate_dependencies

logger = logging.getLogger(__name__)


class JobProcessor:
    """Processes lead magnet generation jobs."""
    
    def __init__(self, db_service: DynamoDBService, s3_service: S3Service):
        """
        Initialize job processor with all required services.
        
        Args:
            db_service: DynamoDB service instance
            s3_service: S3 service instance
        """
        self.db = db_service
        self.s3 = s3_service
        self.ai_service = AIService()
        self.template_service = TemplateService()
        
        # Initialize core services
        self.artifact_service = ArtifactService(db_service, s3_service)
        self.delivery_service = DeliveryService(db_service, self.ai_service)
        self.usage_service = UsageService(db_service)
        
        # Initialize image artifact service
        from services.image_artifact_service import ImageArtifactService
        self.image_artifact_service = ImageArtifactService(self.artifact_service)
        
        # Initialize step processor
        self.step_processor = StepProcessor(
            ai_service=self.ai_service,
            artifact_service=self.artifact_service,
            db_service=self.db,
            s3_service=self.s3,
            usage_service=self.usage_service,
            image_artifact_service=self.image_artifact_service
        )
        
        # Initialize workflow orchestrator
        self.workflow_orchestrator = WorkflowOrchestrator(
            step_processor=self.step_processor,
            ai_service=self.ai_service,
            db_service=self.db,
            s3_service=self.s3
        )
        
        # Initialize job completion service
        self.job_completion_service = JobCompletionService(
            artifact_service=self.artifact_service,
            db_service=self.db,
            s3_service=self.s3,
            delivery_service=self.delivery_service,
            usage_service=self.usage_service
        )
    
    def resolve_step_dependencies(self, steps: list) -> Dict[str, Any]:
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
            # Initialize execution steps array
            execution_steps = []
            
            # Update job status to processing
            logger.debug(f"[JobProcessor] Updating job status to processing", extra={'job_id': job_id})
            self.db.update_job(job_id, {
                'status': 'processing',
                'started_at': process_start_time.isoformat(),
                'updated_at': process_start_time.isoformat(),
                'execution_steps': execution_steps
            }, s3_service=self.s3)
            
            # Get job details
            logger.debug(f"[JobProcessor] Retrieving job details", extra={'job_id': job_id})
            job = self.db.get_job(job_id, s3_service=self.s3)
            if not job:
                logger.error(f"[JobProcessor] Job not found", extra={'job_id': job_id})
                raise ValueError(f"Job {job_id} not found")
            
            tenant_id = job.get('tenant_id')
            workflow_id = job.get('workflow_id')
            submission_id = job.get('submission_id')
            
            logger.info(f"[JobProcessor] Job retrieved successfully", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'workflow_id': workflow_id,
                'submission_id': submission_id,
                'job_status': job.get('status')
            })
            
            # Get workflow configuration
            logger.debug(f"[JobProcessor] Retrieving workflow configuration", extra={'workflow_id': workflow_id})
            workflow = self.db.get_workflow(workflow_id)
            if not workflow:
                logger.error(f"[JobProcessor] Workflow not found", extra={
                    'job_id': job_id,
                    'workflow_id': workflow_id
                })
                raise ValueError(f"Workflow {workflow_id} not found")
            
            logger.info(f"[JobProcessor] Workflow retrieved successfully", extra={
                'workflow_id': workflow_id,
                'workflow_name': workflow.get('workflow_name'),
                'has_steps': bool(workflow.get('steps')),
                'steps_count': len(workflow.get('steps', []))
            })
            
            # Get submission data
            logger.debug(f"[JobProcessor] Retrieving submission data", extra={'submission_id': submission_id})
            submission = self.db.get_submission(submission_id)
            if not submission:
                raise ValueError(f"Submission {submission_id} not found")
            
            # Get form to retrieve field labels
            form = None
            form_id = submission.get('form_id')
            if form_id:
                try:
                    form = self.db.get_form(form_id)
                except Exception as e:
                    logger.warning(f"Could not retrieve form {form_id} for field labels: {e}")
            
            # Add form submission as step 0
            submission_data = submission.get('submission_data', {})
            execution_steps.append(
                ExecutionStepManager.create_form_submission_step(submission_data)
            )
            self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            
            # Workflow processing - all workflows must use steps format
            steps = workflow.get('steps', [])
            if not steps or len(steps) == 0:
                raise ValueError(
                    f"Workflow {workflow_id} has no steps configured. "
                    "All workflows must use the steps format. "
                    "Legacy format is no longer supported."
                )
            
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
            
            # Use utility function for error handling
            error_type, error_message = normalize_error_message(e)
            descriptive_error = create_descriptive_error(e)
            
            # Update job status to failed
            try:
                self.db.update_job(job_id, {
                    'status': 'failed',
                    'error_message': descriptive_error,
                    'error_type': error_type,
                    'updated_at': datetime.utcnow().isoformat()
                })
            except Exception as update_error:
                logger.error(f"Failed to update job status: {update_error}")
            
            return {
                'success': False,
                'error': descriptive_error,
                'error_type': error_type
            }
    
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
            # Get job details
            job = self.db.get_job(job_id, s3_service=self.s3)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            # Validate required job fields
            workflow_id = job.get('workflow_id')
            if not workflow_id:
                raise ValueError(f"Job {job_id} is missing required field 'workflow_id'")
            
            submission_id = job.get('submission_id')
            if not submission_id:
                raise ValueError(f"Job {job_id} is missing required field 'submission_id'")
            
            # Get workflow configuration
            workflow = self.db.get_workflow(workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            # Get submission data
            submission = self.db.get_submission(submission_id)
            if not submission:
                raise ValueError(f"Submission {submission_id} not found")
            
            submission_data = submission.get('submission_data', {})
            
            # Get form to retrieve field labels
            form = None
            form_id = submission.get('form_id')
            if form_id:
                try:
                    form = self.db.get_form(form_id)
                except Exception as e:
                    logger.warning(f"Could not retrieve form {form_id} for field labels: {e}")
            
            # Build field label map and format initial context
            field_label_map = FieldLabelService.build_field_label_map(form)
            initial_context = FieldLabelService.format_submission_data_with_labels(
                submission_data,
                field_label_map
            )
            
            # Load existing execution_steps
            execution_steps = job.get('execution_steps', [])
            
            # Handle HTML generation step (special case)
            if step_type == 'html_generation':
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
            if not steps or len(steps) == 0:
                raise ValueError(f"Workflow {job.get('workflow_id')} has no steps configured")
            
            if step_index < 0 or step_index >= len(steps):
                raise ValueError(f"Step index {step_index} is out of range. Workflow has {len(steps)} steps.")
            
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
            
            # Use utility function for error handling
            error_type, error_message = normalize_error_message(e)
            descriptive_error = create_descriptive_error(e, f"Failed to process step {step_index}")
            
            # Update job status to failed
            try:
                self.db.update_job(job_id, {
                    'status': 'failed',
                    'error_message': descriptive_error,
                    'error_type': error_type,
                    'updated_at': datetime.utcnow().isoformat()
                })
            except Exception as update_error:
                logger.error(f"Failed to update job status: {update_error}")
            
            # Return error result
            return {
                'success': False,
                'error': descriptive_error,
                'error_type': error_type,
                'step_index': step_index
            }
