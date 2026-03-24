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
from services.artifact_finalizer import ArtifactFinalizer

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
        self.artifact_finalizer = ArtifactFinalizer(self.artifact_service)
    
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
        pdf_artifact_id = None

        # Store final artifact
        try:
            pdf_source_html = None
            # Guarantee tracking injection for the final HTML deliverable regardless of how it was generated.
            if final_artifact_type == 'html_final' and isinstance(final_content, str) and final_content.strip():
                final_content = self.artifact_finalizer.prepare_html_content(
                    html_content=final_content,
                    job_id=job_id,
                    tenant_id=job.get('tenant_id', ''),
                    api_url=job.get('api_url') or None
                )
                pdf_source_html = final_content

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
            
            logger.info(f"Final artifact stored with URL: {public_url[:80]}...")

            # Generate and store PDF deliverable alongside HTML (best-effort).
            if pdf_source_html:
                pdf_artifact_id = self.artifact_finalizer.store_pdf_deliverable(
                    job_id=job_id,
                    tenant_id=job['tenant_id'],
                    html_content=pdf_source_html
                )
        except Exception as e:
            raise Exception(f"Failed to store final document: {str(e)}") from e
        
        # Build artifacts list
        artifacts_list = []
        if report_artifact_id:
            artifacts_list.append(report_artifact_id)
        artifacts_list.append(final_artifact_id)
        if pdf_artifact_id:
            artifacts_list.append(pdf_artifact_id)
        artifacts_list.extend(all_image_artifact_ids)
        
        # CRITICAL: Reload execution_steps from S3 to ensure we have all workflow steps
        # that were saved during step processing and HTML generation. The execution_steps
        # list passed as parameter might be stale if steps were saved in separate operations.
        try:
            job_with_steps = self.db.get_job(job_id, s3_service=self.s3)
            if job_with_steps and job_with_steps.get('execution_steps'):
                execution_steps = job_with_steps['execution_steps']
                logger.debug("[JobCompletionService] Reloaded execution_steps from S3 before finalizing job", extra={
                    'job_id': job_id,
                    'execution_steps_count': len(execution_steps)
                })
        except Exception as e:
            logger.warning("[JobCompletionService] Failed to reload execution_steps from S3, using provided list", extra={
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
            'live_step': None,
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
    

