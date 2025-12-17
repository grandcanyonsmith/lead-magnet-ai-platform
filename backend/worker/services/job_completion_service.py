"""
Job Completion Service
Handles job finalization, artifact storage, delivery, and notifications.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from artifact_service import ArtifactService
from db_service import DynamoDBService
from s3_service import S3Service
from delivery_service import DeliveryService
from services.execution_step_manager import ExecutionStepManager
from services.usage_service import UsageService
from ai_service import AIService

logger = logging.getLogger(__name__)


class JobCompletionService:
    """Service for completing jobs."""
    
    def __init__(
        self,
        artifact_service: ArtifactService,
        db_service: DynamoDBService,
        s3_service: S3Service,
        delivery_service: DeliveryService,
        usage_service: UsageService
    ):
        """
        Initialize job completion service.
        
        Args:
            artifact_service: Artifact service instance
            db_service: DynamoDB service instance
            s3_service: S3 service instance
            delivery_service: Delivery service instance
            usage_service: Usage service instance
        """
        self.artifact_service = artifact_service
        self.db = db_service
        self.s3 = s3_service
        self.delivery_service = delivery_service
        self.usage_service = usage_service
        self.ai_service = AIService()
    
    def finalize_job(
        self,
        job_id: str,
        job: Dict[str, Any],
        workflow: Dict[str, Any],
        submission: Dict[str, Any],
        final_content: str,
        final_artifact_type: str,
        final_filename: str,
        report_artifact_id: Optional[str],
        all_image_artifact_ids: List[str],
        execution_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Finalize a job by storing final artifact and updating job status.
        
        Args:
            job_id: Job ID
            job: Job dictionary
            workflow: Workflow configuration
            submission: Submission dictionary
            final_content: Final content to store
            final_artifact_type: Type of final artifact
            final_filename: Filename for final artifact
            report_artifact_id: Optional report artifact ID
            all_image_artifact_ids: List of all image artifact IDs
            execution_steps: List of execution steps
            
        Returns:
            Public URL of final artifact
            
        Raises:
            Exception: If finalization fails
        """
        # Store final artifact
        try:
            # Guarantee tracking injection for the final HTML deliverable regardless of how it was generated.
            if final_artifact_type == 'html_final' and isinstance(final_content, str) and final_content.strip():
                if 'Lead Magnet Tracking Script' not in final_content:
                    from services.tracking_script_generator import TrackingScriptGenerator
                    tracking_generator = TrackingScriptGenerator()
                    final_content = tracking_generator.inject_tracking_script(
                        html_content=final_content,
                        job_id=job_id,
                        tenant_id=job.get('tenant_id', '')
                    )

            final_start_time = datetime.utcnow()
            final_artifact_id = self.artifact_service.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type=final_artifact_type,
                content=final_content,
                filename=final_filename,
                public=True
            )
            
            # Get public URL for final artifact
            public_url = self.artifact_service.get_artifact_public_url(final_artifact_id)
            
            final_duration = (datetime.utcnow() - final_start_time).total_seconds() * 1000

            logger.info(f"Final artifact stored with URL: {public_url[:80]}...")
        except Exception as e:
            raise Exception(f"Failed to store final document: {str(e)}") from e
        
        # Build artifacts list
        artifacts_list = []
        if report_artifact_id:
            artifacts_list.append(report_artifact_id)
        artifacts_list.append(final_artifact_id)
        artifacts_list.extend(all_image_artifact_ids)
        
        # CRITICAL: Reload execution_steps from S3 to ensure we have all workflow steps
        # that were saved during step processing and HTML generation. The execution_steps
        # list passed as parameter might be stale if steps were saved in separate operations.
        try:
            job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
            if job_with_steps and job_with_steps.get('execution_steps'):
                execution_steps = job_with_steps['execution_steps']
                logger.debug(f"[JobCompletionService] Reloaded execution_steps from S3 before finalizing job", extra={
                    'job_id': job_id,
                    'execution_steps_count': len(execution_steps)
                })
        except Exception as e:
            logger.warning(f"[JobCompletionService] Failed to reload execution_steps from S3, using provided list", extra={
                'job_id': job_id,
                'error': str(e)
            })
            # Continue with provided execution_steps if reload fails

        # Add final output step AFTER reload so we don't lose it
        execution_steps.append(
            ExecutionStepManager.create_final_output_step(
                final_artifact_type=final_artifact_type,
                final_filename=final_filename,
                final_artifact_id=final_artifact_id,
                public_url=public_url,
                step_order=len(execution_steps)
            )
        )
        
        # Update job as completed
        logger.info("Finalizing job")
        self.db.update_job(job_id, {
            'status': 'completed',
            'completed_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'output_url': public_url,
            'artifacts': artifacts_list,
            'execution_steps': execution_steps
        }, s3_service=self.s3)
        
        # Deliver based on workflow configuration
        self._deliver_job(workflow, job, job_id, public_url, submission, report_artifact_id)
        
        # Create notification for job completion
        self._create_completion_notification(job, workflow, submission, job_id)
        
        return public_url
    
    def _deliver_job(
        self,
        workflow: Dict[str, Any],
        job: Dict[str, Any],
        job_id: str,
        public_url: str,
        submission: Dict[str, Any],
        report_artifact_id: Optional[str]
    ) -> None:
        """
        Deliver job based on workflow configuration.
        
        Args:
            workflow: Workflow configuration
            job: Job dictionary
            job_id: Job ID
            public_url: Public URL of final artifact
            submission: Submission dictionary
            report_artifact_id: Optional report artifact ID
        """
        delivery_method = workflow.get('delivery_method', 'none')
        
        if delivery_method == 'webhook':
            webhook_url = workflow.get('delivery_webhook_url')
            if webhook_url:
                logger.info("Sending webhook notification")
                webhook_headers = workflow.get('delivery_webhook_headers', {})
                self.delivery_service.send_webhook_notification(
                    webhook_url,
                    webhook_headers,
                    job_id,
                    public_url,
                    submission,
                    job
                )
            else:
                logger.warning("Webhook delivery enabled but no webhook URL configured")
        elif delivery_method == 'sms':
            logger.info("Sending SMS notification")
            # Get research content for SMS if available
            research_content = None
            if report_artifact_id:
                try:
                    report_artifact = self.db.get_artifact(report_artifact_id)
                    if report_artifact:
                        s3_key = report_artifact.get('s3_key')
                        if s3_key:
                            research_content = self.s3.download_artifact(s3_key)
                except Exception as e:
                    logger.warning(f"Could not load research content for SMS: {e}")
            
            self.delivery_service.send_sms_notification(
                workflow,
                job['tenant_id'],
                job_id,
                public_url,
                submission,
                research_content
            )
        else:
            logger.info("No delivery method configured, skipping delivery")
    
    def _create_completion_notification(
        self,
        job: Dict[str, Any],
        workflow: Dict[str, Any],
        submission: Dict[str, Any],
        job_id: str
    ) -> None:
        """
        Create notification for job completion.
        
        Args:
            job: Job dictionary
            workflow: Workflow configuration
            submission: Submission dictionary
            job_id: Job ID
        """
        try:
            workflow_name = workflow.get('workflow_name', 'Lead magnet')
            submission_email = submission.get('submitter_email', 'customer')
            self.db.create_notification(
                tenant_id=job['tenant_id'],
                notification_type='job_completed',
                title='Lead magnet delivered',
                message=f'Your lead magnet "{workflow_name}" has been delivered for {submission_email}.',
                related_resource_id=job_id,
                related_resource_type='job'
            )
        except Exception as e:
            logger.error(f"Error creating notification for job completion: {e}")
            # Don't fail the job if notification fails
    
    def generate_html_from_accumulated_context(
        self,
        accumulated_context: str,
        submission_data: Dict[str, Any],
        workflow: Dict[str, Any],
        execution_steps: List[Dict[str, Any]],
        job_id: str,
        tenant_id: str
    ) -> Tuple[str, str, str]:
        """
        Generate HTML from accumulated context (used during batch workflow execution).
        
        Args:
            accumulated_context: Accumulated context from all workflow steps
            submission_data: Submission data dictionary
            workflow: Workflow configuration
            execution_steps: List of execution steps (will be updated)
            job_id: Job ID
            tenant_id: Tenant ID
            
        Returns:
            Tuple of (final_content, final_artifact_type, final_filename)
        """
        template = None
        template_id = workflow.get('template_id')
        if template_id:
            try:
                template = self.db.get_template(
                    template_id,
                    workflow.get('template_version', 0)
                )
                if not template:
                    logger.warning(f"Template {template_id} not found, skipping HTML generation")
            except Exception as e:
                logger.warning(f"Failed to load template: {e}, skipping HTML generation")
        
        if not template:
            # No template, return markdown
            return "", 'markdown_final', 'final.md'
        
        # Check if we need to generate HTML (last step might already be HTML)
        # This check is done by the caller in workflow_orchestrator
        
        # Generate HTML from accumulated context
        logger.info("Generating HTML from accumulated step outputs")
        html_start_time = datetime.utcnow()
        
        steps = workflow.get('steps', [])
        sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
        model = sorted_steps[-1].get('model', 'gpt-5') if sorted_steps else 'gpt-5'
        
        final_content, html_usage_info, html_request_details, html_response_details = self.ai_service.generate_styled_html(
            research_content=accumulated_context,
            template_html=template['html_content'],
            template_style=template.get('style_description', ''),
            submission_data=submission_data,
            model=model
        )
        
        html_duration = (datetime.utcnow() - html_start_time).total_seconds() * 1000
        
        # Store usage record
        self.usage_service.store_usage_record(tenant_id, job_id, html_usage_info)
        
        # Inject tracking script into HTML
        from services.tracking_script_generator import TrackingScriptGenerator
        tracking_generator = TrackingScriptGenerator()
        final_content = tracking_generator.inject_tracking_script(
            html_content=final_content,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        # CRITICAL: Reload execution_steps from S3 to ensure we have all workflow steps
        # that were saved during step processing. The execution_steps list passed as parameter
        # might be stale if steps were saved in separate operations.
        try:
            job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
            if job_with_steps and job_with_steps.get('execution_steps'):
                execution_steps = job_with_steps['execution_steps']
                logger.debug(f"[JobCompletionService] Reloaded execution_steps from S3 before HTML generation", extra={
                    'job_id': job_id,
                    'execution_steps_count': len(execution_steps)
                })
        except Exception as e:
            logger.warning(f"[JobCompletionService] Failed to reload execution_steps from S3, using provided list", extra={
                'job_id': job_id,
                'error': str(e)
            })
            # Continue with provided execution_steps if reload fails
        
        # Add HTML generation step
        html_step_data = ExecutionStepManager.create_html_generation_step(
            model=model,
            html_request_details=html_request_details,
            html_response_details=html_response_details,
            html_usage_info=html_usage_info,
            html_start_time=html_start_time,
            html_duration=html_duration,
            step_order=len(execution_steps)
        )
        execution_steps.append(html_step_data)
        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
        
        return final_content, 'html_final', 'final.html'
    
    def generate_html_from_steps(
        self,
        job_id: str,
        job: Dict[str, Any],
        workflow: Dict[str, Any],
        submission_data: Dict[str, Any],
        execution_steps: List[Dict[str, Any]],
        initial_context: str
    ) -> Dict[str, Any]:
        """
        Generate HTML from accumulated workflow steps.
        
        This is used for per-step processing mode when HTML generation
        is triggered after all steps complete.
        
        Args:
            job_id: Job ID
            job: Job dictionary
            workflow: Workflow configuration
            submission_data: Submission data
            execution_steps: List of execution steps
            initial_context: Initial formatted submission context
            
        Returns:
            Dictionary with success status and HTML content
            
        Raises:
            ValueError: If template is not found
            Exception: If HTML generation fails
        """
        from services.context_builder import ContextBuilder
        
        template_id = workflow.get('template_id')
        if not template_id:
            raise ValueError("Template ID is required for HTML generation")
        
        template = self.db.get_template(
            template_id,
            workflow.get('template_version', 0)
        )
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        logger.info("Generating HTML from accumulated step outputs")
        html_start_time = datetime.utcnow()

        # CRITICAL: Reload execution_steps from S3 to avoid overwriting the canonical
        # execution_steps.json with a stale/partial list (common in per-step Step Functions mode).
        try:
            job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
            if job_with_steps and job_with_steps.get('execution_steps'):
                execution_steps = job_with_steps['execution_steps']
                logger.debug(f"[JobCompletionService] Reloaded execution_steps from S3 before HTML generation (single-step mode)", extra={
                    'job_id': job_id,
                    'execution_steps_count': len(execution_steps)
                })
        except Exception as e:
            logger.warning(f"[JobCompletionService] Failed to reload execution_steps from S3 for HTML generation (single-step mode), using provided list", extra={
                'job_id': job_id,
                'error': str(e)
            })
        
        # Build accumulated context from all workflow steps
        accumulated_context = ContextBuilder.build_accumulated_context_for_html(
            initial_context=initial_context,
            execution_steps=execution_steps
        )
        
        # Get model from last workflow step or default
        steps = workflow.get('steps', [])
        model = 'gpt-5'
        if steps:
            sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
            if sorted_steps:
                model = sorted_steps[-1].get('model', 'gpt-5')
        
        # Generate HTML
        from ai_service import AIService
        ai_service = AIService()
        
        final_content, html_usage_info, html_request_details, html_response_details = ai_service.generate_styled_html(
            research_content=accumulated_context,
            template_html=template['html_content'],
            template_style=template.get('style_description', ''),
            submission_data=submission_data,
            model=model
        )
        
        html_duration = (datetime.utcnow() - html_start_time).total_seconds() * 1000
        self.usage_service.store_usage_record(job['tenant_id'], job_id, html_usage_info)
        
        # Inject tracking script into HTML
        from services.tracking_script_generator import TrackingScriptGenerator
        tracking_generator = TrackingScriptGenerator()
        final_content = tracking_generator.inject_tracking_script(
            html_content=final_content,
            job_id=job_id,
            tenant_id=job['tenant_id']
        )
        
        # Store HTML as final artifact
        final_artifact_id = self.artifact_service.store_artifact(
            tenant_id=job['tenant_id'],
            job_id=job_id,
            artifact_type='html_final',
            content=final_content,
            filename='final.html',
            public=True
        )
        
        # Get public URL for final artifact
        public_url = self.artifact_service.get_artifact_public_url(final_artifact_id)
        
        # Add HTML generation step to execution_steps
        from services.execution_step_manager import ExecutionStepManager
        html_step_data = ExecutionStepManager.create_html_generation_step(
            model=model,
            html_request_details=html_request_details,
            html_response_details=html_response_details,
            html_usage_info=html_usage_info,
            html_start_time=html_start_time,
            html_duration=html_duration,
            step_order=len(execution_steps) + 1
        )
        execution_steps.append(html_step_data)
        
        # Update job with final output
        artifacts_list = job.get('artifacts', [])
        if final_artifact_id not in artifacts_list:
            artifacts_list.append(final_artifact_id)
        
        self.db.update_job(job_id, {
            'execution_steps': execution_steps,
            'output_url': public_url,
            'artifacts': artifacts_list,
            'status': 'completed',
            'completed_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }, s3_service=self.s3)
        
        logger.info(f"HTML generation completed successfully. Final artifact: {public_url[:80]}...")
        
        return {
            'success': True,
            'step_type': 'html_generation',
            'final_content': final_content,
            'artifact_id': final_artifact_id,
            'output_url': public_url,
            'usage_info': html_usage_info,
            'duration_ms': int(html_duration)
        }

