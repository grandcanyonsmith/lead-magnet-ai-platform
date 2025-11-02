"""
Job Processor
Handles the complete workflow of generating AI reports and rendering HTML.
"""

import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from ulid import new as ulid

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
            
            # Check workflow settings
            research_enabled = workflow.get('research_enabled', True)
            html_enabled = workflow.get('html_enabled', True)
            
            logger.info(f"Workflow settings: research_enabled={research_enabled}, html_enabled={html_enabled}")
            
            # Step 1: Generate AI report (if research enabled)
            report_content = ""
            report_artifact_id = None
            
            if research_enabled:
                logger.info("Step 1: Generating AI report")
                try:
                    report_content, usage_info = self.generate_report(workflow, submission)
                    # Store usage record
                    self.store_usage_record(job['tenant_id'], job_id, usage_info)
                except Exception as e:
                    raise Exception(f"Failed to generate AI report: {str(e)}") from e
                
                # Store report as artifact
                report_artifact_id = self.store_artifact(
                    tenant_id=job['tenant_id'],
                    job_id=job_id,
                    artifact_type='report_markdown',
                    content=report_content,
                    filename='report.md'
                )
            else:
                logger.info("Step 1: Research disabled, skipping report generation")
            
            # Step 2: Get and prepare template (only if HTML enabled)
            template = None
            if html_enabled:
                logger.info("Step 2: Preparing HTML template")
                try:
                    template_id = workflow.get('template_id')
                    if not template_id:
                        raise ValueError("Template ID is required when HTML generation is enabled")
                    
                    template = self.db.get_template(
                        template_id,
                        workflow.get('template_version', 0)
                    )
                    if not template:
                        raise ValueError(f"Template {template_id} (version {workflow.get('template_version', 0)}) not found. Please check that the template exists and is published.")
                    
                    # Check if template is published
                    if not template.get('is_published', False):
                        raise ValueError(f"Template {template_id} (version {workflow.get('template_version', 0)}) exists but is not published. Please publish the template before using it in a workflow.")
                except ValueError:
                    raise
                except Exception as e:
                    raise Exception(f"Failed to load template: {str(e)}") from e
            else:
                logger.info("Step 2: HTML disabled, skipping template loading")
            
            # Step 3: Generate final content (HTML or markdown/text)
            final_content = ""
            final_artifact_type = ""
            final_filename = ""
            
            if html_enabled:
                # Generate HTML document
                logger.info("Step 3: Generating styled HTML document")
                try:
                    if research_enabled:
                        # Use research content + template
                        final_content, html_usage_info = self.ai_service.generate_styled_html(
                            research_content=report_content,
                            template_html=template['html_content'],
                            template_style=template.get('style_description', ''),
                            submission_data=submission.get('submission_data', {}),
                            model=workflow.get('rewrite_model', 'gpt-4o')
                        )
                        # Store usage record
                        self.store_usage_record(job['tenant_id'], job_id, html_usage_info)
                    else:
                        # Generate HTML directly from submission data + template
                        final_content, html_usage_info = self.ai_service.generate_html_from_submission(
                            submission_data=submission.get('submission_data', {}),
                            template_html=template['html_content'],
                            template_style=template.get('style_description', ''),
                            ai_instructions=workflow.get('ai_instructions', ''),
                            model=workflow.get('rewrite_model', 'gpt-4o')
                        )
                        # Store usage record
                        self.store_usage_record(job['tenant_id'], job_id, html_usage_info)
                    logger.info("Styled HTML generated successfully")
                    final_artifact_type = 'html_final'
                    final_filename = 'final.html'
                except Exception as e:
                    raise Exception(f"Failed to generate styled HTML: {str(e)}") from e
            else:
                # Store markdown/text content
                logger.info("Step 3: Generating markdown/text content")
                if research_enabled:
                    # Use research content
                    final_content = report_content
                    final_artifact_type = 'markdown_final'
                    final_filename = 'final.md'
                else:
                    # Generate simple content from submission data
                    final_content = self.generate_content_from_submission(
                        workflow,
                        submission
                    )
                    final_artifact_type = 'text_final'
                    final_filename = 'final.txt'
            
            # Step 4: Store final artifact
            try:
                final_artifact_id = self.store_artifact(
                    tenant_id=job['tenant_id'],
                    job_id=job_id,
                    artifact_type=final_artifact_type,
                    content=final_content,
                    filename=final_filename,
                    public=True
                )
                
                # Get public URL for final artifact
                final_artifact = self.db.get_artifact(final_artifact_id)
                public_url = final_artifact.get('public_url')
                
                if not public_url:
                    logger.error(f"Final artifact {final_artifact_id} has no public_url. Artifact data: {final_artifact}")
                    raise ValueError("Failed to generate public URL for final artifact")
                
                logger.info(f"Final artifact stored with URL: {public_url[:80]}...")
            except Exception as e:
                raise Exception(f"Failed to store final document: {str(e)}") from e
            
            # Step 5: Update job as completed
            logger.info("Step 5: Finalizing job")
            # Build artifacts list
            artifacts_list = []
            if report_artifact_id:
                artifacts_list.append(report_artifact_id)
            artifacts_list.append(final_artifact_id)
            
            self.db.update_job(job_id, {
                'status': 'completed',
                'completed_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'output_url': public_url,
                'artifacts': artifacts_list
            })
            
            # Step 6: Deliver via webhook if configured (from settings)
            settings = self.db.get_settings(job['tenant_id'])
            webhook_url = settings.get('ghl_webhook_url') if settings else None
            
            if webhook_url:
                logger.info("Step 6: Sending webhook notification")
                self.send_webhook_notification(
                    webhook_url,
                    job_id,
                    public_url,
                    submission
                )
            else:
                logger.info("Step 6: No webhook URL configured in settings, skipping delivery")
            
            logger.info(f"Job {job_id} completed successfully")
            return {
                'success': True,
                'job_id': job_id,
                'output_url': public_url
            }
            
        except Exception as e:
            logger.exception(f"Error processing job {job_id}")
            
            # Create descriptive error message
            error_type = type(e).__name__
            error_message = str(e)
            
            # Build context-aware error message
            if not error_message or error_message == error_type:
                error_message = f"{error_type}: {error_message}" if error_message else error_type
            
            # Add common error context
            descriptive_error = error_message
            
            # Handle specific error types with better messages
            if isinstance(e, ValueError):
                if "not found" in error_message.lower():
                    descriptive_error = f"Resource not found: {error_message}"
                else:
                    descriptive_error = f"Invalid configuration: {error_message}"
            elif isinstance(e, KeyError):
                descriptive_error = f"Missing required field: {error_message}"
            elif "OpenAI" in str(type(e)) or "API" in error_type:
                descriptive_error = f"AI service error: {error_message}"
            elif "Connection" in error_type or "Timeout" in error_type:
                descriptive_error = f"Network error: {error_message}"
            elif "Permission" in error_type or "Access" in error_type:
                descriptive_error = f"Access denied: {error_message}"
            
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
    
    def generate_content_from_submission(
        self,
        workflow: Dict[str, Any],
        submission: Dict[str, Any]
    ) -> str:
        """Generate simple text content from submission data without research."""
        submission_data = submission.get('submission_data', {})
        
        # Format submission data as simple text
        content_lines = []
        for key, value in submission_data.items():
            content_lines.append(f"{key}: {value}")
        
        return "\n".join(content_lines)
    
    def generate_report(self, workflow: Dict[str, Any], submission: Dict[str, Any]) -> Tuple[str, Dict]:
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
        report, usage_info = self.ai_service.generate_report(
            model=ai_model,
            instructions=ai_instructions,
            context=context
        )
        
        return report, usage_info
    
    def store_usage_record(self, tenant_id: str, job_id: str, usage_info: Dict[str, Any]):
        """Store usage record for billing tracking."""
        try:
            usage_id = f"usage_{ulid()}"
            usage_record = {
                'usage_id': usage_id,
                'tenant_id': tenant_id,
                'job_id': job_id,
                'service_type': usage_info.get('service_type', 'unknown'),
                'model': usage_info.get('model', 'unknown'),
                'input_tokens': usage_info.get('input_tokens', 0),
                'output_tokens': usage_info.get('output_tokens', 0),
                'cost_usd': usage_info.get('cost_usd', 0.0),
                'created_at': datetime.utcnow().isoformat(),
            }
            self.db.put_usage_record(usage_record)
            logger.debug(f"Stored usage record {usage_id} for job {job_id}")
        except Exception as e:
            logger.error(f"Failed to store usage record: {e}")
            # Don't fail the job if usage tracking fails
            pass
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
        # Always store public_url (either CloudFront URL or presigned URL) so artifacts are accessible
        artifact = {
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': artifact_type,
            'artifact_name': filename,
            's3_key': s3_key,
            's3_url': s3_url,
            'public_url': public_url,  # Always store URL (CloudFront or presigned)
            'is_public': public,  # Flag to indicate if it's truly public vs presigned
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

