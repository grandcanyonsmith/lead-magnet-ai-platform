"""
Job Processor
Handles the complete workflow of generating AI reports and rendering HTML.
"""

import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from ulid import ulid

from ai_service import AIService
from template_service import TemplateService
from db_service import DynamoDBService
from s3_service import S3Service

logger = logging.getLogger(__name__)


class JobProcessor:
    """Processes lead magnet generation jobs."""
    
    def __init__(self, db_service: DynamoDBService, s3_service: S3Service):
        self.db = db_service
        self.s3 = s3_service
        self.ai_service = AIService()
        self.template_service = TemplateService()
    
    def process_job(self, job_id: str) -> Dict[str, Any]:
        """
        Process a job end-to-end.
        
        Args:
            job_id: The job ID to process
            
        Returns:
            Dictionary with success status and optional error
        """
        try:
            # Update job status to processing
            self.db.update_job(job_id, {
                'status': 'processing',
                'started_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
            
            # Get job details
            job = self.db.get_job(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            logger.info(f"Processing job {job_id} for workflow {job['workflow_id']}")
            
            # Get workflow configuration
            workflow = self.db.get_workflow(job['workflow_id'])
            if not workflow:
                raise ValueError(f"Workflow {job['workflow_id']} not found")
            
            # Get submission data
            submission = self.db.get_submission(job['submission_id'])
            if not submission:
                raise ValueError(f"Submission {job['submission_id']} not found")
            
            # Step 1: Generate AI report
            logger.info("Step 1: Generating AI report")
            report_content = self.generate_report(workflow, submission)
            
            # Store report as artifact
            report_artifact_id = self.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type='report_markdown',
                content=report_content,
                filename='report.md'
            )
            
            # Step 2: Get and prepare template
            logger.info("Step 2: Preparing HTML template")
            template = self.db.get_template(
                workflow['template_id'],
                workflow.get('template_version', 0)
            )
            if not template:
                raise ValueError(f"Template {workflow['template_id']} not found")
            
            # Step 3: Render template with report content
            logger.info("Step 3: Rendering HTML template")
            initial_html = self.template_service.render_template(
                template['html_content'],
                {
                    'REPORT_CONTENT': report_content,
                    'DATE': datetime.utcnow().strftime('%Y-%m-%d'),
                    **submission.get('submission_data', {})
                }
            )
            
            # Store initial HTML
            initial_html_artifact_id = self.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type='html_initial',
                content=initial_html,
                filename='initial.html'
            )
            
            # Step 4: AI rewrite (if enabled)
            final_html = initial_html
            if workflow.get('rewrite_enabled', False):
                logger.info("Step 4: AI rewriting HTML")
                final_html = self.ai_service.rewrite_html(
                    initial_html,
                    workflow.get('rewrite_model', 'gpt-4o')
                )
            
            # Step 5: Store final HTML
            logger.info("Step 5: Storing final HTML")
            final_html_artifact_id = self.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type='html_final',
                content=final_html,
                filename='final.html',
                public=True
            )
            
            # Get public URL for final artifact
            final_artifact = self.db.get_artifact(final_html_artifact_id)
            public_url = final_artifact.get('public_url')
            
            # Step 6: Update job as completed
            logger.info("Step 6: Finalizing job")
            self.db.update_job(job_id, {
                'status': 'completed',
                'completed_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'output_url': public_url,
                'artifacts': [
                    report_artifact_id,
                    initial_html_artifact_id,
                    final_html_artifact_id
                ]
            })
            
            # Step 7: Deliver via webhook if configured
            if workflow.get('delivery_webhook_url'):
                logger.info("Step 7: Sending webhook notification")
                self.send_webhook_notification(
                    workflow['delivery_webhook_url'],
                    job_id,
                    public_url,
                    submission
                )
            
            logger.info(f"Job {job_id} completed successfully")
            return {
                'success': True,
                'job_id': job_id,
                'output_url': public_url
            }
            
        except Exception as e:
            logger.exception(f"Error processing job {job_id}")
            
            # Update job status to failed
            try:
                self.db.update_job(job_id, {
                    'status': 'failed',
                    'error_message': str(e),
                    'updated_at': datetime.utcnow().isoformat()
                })
            except Exception as update_error:
                logger.error(f"Failed to update job status: {update_error}")
            
            return {
                'success': False,
                'error': str(e)
            }
    
    def generate_report(self, workflow: Dict[str, Any], submission: Dict[str, Any]) -> str:
        """Generate AI report content."""
        ai_model = workflow.get('ai_model', 'gpt-4o')
        ai_instructions = workflow['ai_instructions']
        submission_data = submission.get('submission_data', {})
        
        # Format submission data as context
        context = "\n".join([
            f"{key}: {value}"
            for key, value in submission_data.items()
        ])
        
        # Generate report
        report = self.ai_service.generate_report(
            model=ai_model,
            instructions=ai_instructions,
            context=context
        )
        
        return report
    
    def store_artifact(
        self,
        tenant_id: str,
        job_id: str,
        artifact_type: str,
        content: str,
        filename: str,
        public: bool = False
    ) -> str:
        """Store an artifact in S3 and DynamoDB."""
        
        # Generate artifact ID
        artifact_id = f"art_{ulid()}"
        
        # Upload to S3
        s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
        s3_url, public_url = self.s3.upload_artifact(
            key=s3_key,
            content=content,
            content_type=self.get_content_type(filename),
            public=public
        )
        
        # Create artifact record
        artifact = {
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': artifact_type,
            'artifact_name': filename,
            's3_key': s3_key,
            's3_url': s3_url,
            'public_url': public_url if public else None,
            'file_size_bytes': len(content.encode('utf-8')),
            'mime_type': self.get_content_type(filename),
            'created_at': datetime.utcnow().isoformat()
        }
        
        self.db.put_artifact(artifact)
        
        return artifact_id
    
    def get_content_type(self, filename: str) -> str:
        """Get MIME type from filename."""
        ext = filename.split('.')[-1].lower()
        types = {
            'html': 'text/html',
            'md': 'text/markdown',
            'txt': 'text/plain',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
        }
        return types.get(ext, 'application/octet-stream')
    
    def send_webhook_notification(
        self,
        webhook_url: str,
        job_id: str,
        output_url: str,
        submission: Dict[str, Any]
    ):
        """Send webhook notification about completed job."""
        import requests
        
        payload = {
            'job_id': job_id,
            'status': 'completed',
            'output_url': output_url,
            'submission_data': submission.get('submission_data', {}),
            'completed_at': datetime.utcnow().isoformat()
        }
        
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            response.raise_for_status()
            logger.info(f"Webhook notification sent successfully to {webhook_url}")
        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")

