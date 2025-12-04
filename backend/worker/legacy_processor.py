"""
Legacy Workflow Processor
Handles processing of legacy workflow formats (research_enabled, html_enabled, ai_instructions).
"""

import logging
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from decimal import Decimal

from ai_service import AIService
from db_service import DynamoDBService
from s3_service import S3Service
from artifact_service import ArtifactService
from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)


class LegacyWorkflowProcessor:
    """Processes legacy workflow formats."""
    
    def __init__(
        self,
        db_service: DynamoDBService,
        s3_service: S3Service,
        ai_service: AIService,
        artifact_service: ArtifactService
    ):
        self.db = db_service
        self.s3 = s3_service
        self.ai_service = ai_service
        self.artifact_service = artifact_service
    
    def process_legacy_workflow(
        self,
        job_id: str,
        workflow: Dict[str, Any],
        submission: Dict[str, Any],
        field_label_map: Dict[str, str],
        execution_steps: list,
        job: Dict[str, Any]
    ) -> Tuple[str, str, str, Optional[str]]:
        """
        Process a legacy workflow format.
        
        Args:
            job_id: Job ID
            workflow: Workflow configuration
            submission: Submission data
            field_label_map: Map of field IDs to labels
            execution_steps: List of execution steps (will be modified)
            job: Job data
            
        Returns:
            Tuple of (final_content, final_artifact_type, final_filename, report_artifact_id)
            
        Raises:
            Exception: If workflow processing fails
        """
        logger.info("Processing legacy workflow format")
        research_enabled = workflow.get('research_enabled', True)
        html_enabled = workflow.get('html_enabled', True)
        
        logger.info(f"Workflow settings: research_enabled={research_enabled}, html_enabled={html_enabled}")
        
        # Step 1: Generate AI report (if research enabled)
        report_content = ""
        report_artifact_id = None
        
        if research_enabled:
            logger.info("Step 1: Generating AI report")
            try:
                report_start_time = datetime.utcnow()
                report_content, usage_info, request_details, response_details = self._generate_report(
                    workflow, submission, field_label_map
                )
                report_duration = (datetime.utcnow() - report_start_time).total_seconds() * 1000
                
                # Store usage record
                self._store_usage_record(job['tenant_id'], job_id, usage_info)
                
                # Store report as artifact
                report_artifact_id = self.artifact_service.store_artifact(
                    tenant_id=job['tenant_id'],
                    job_id=job_id,
                    artifact_type='report_markdown',
                    content=report_content,
                    filename='report.md'
                )
                
                # Add execution step (convert floats to Decimal for DynamoDB)
                report_step_data = {
                    'step_name': 'AI Research Report',
                    'step_order': 1,
                    'step_type': 'ai_generation',
                    'model': workflow.get('ai_model', 'gpt-5'),
                    'input': request_details,
                    'output': response_details.get('output_text', ''),
                    'usage_info': convert_floats_to_decimal(usage_info),
                    'timestamp': report_start_time.isoformat(),
                    'duration_ms': int(report_duration),
                    'artifact_id': report_artifact_id,
                }
                execution_steps.append(report_step_data)
                self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            except Exception as e:
                raise Exception(f"Failed to generate AI report: {str(e)}") from e
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
                    raise ValueError(f"Template {template_id} (version {workflow.get('template_version', 0)}) not found.")
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
                html_start_time = datetime.utcnow()
                if research_enabled:
                    # Use research content + template
                    final_content, html_usage_info, html_request_details, html_response_details = self.ai_service.generate_styled_html(
                        research_content=report_content,
                        template_html=template['html_content'],
                        template_style=template.get('style_description', ''),
                        submission_data=submission.get('submission_data', {}),
                        model=workflow.get('rewrite_model', 'gpt-5')
                    )
                    # Store usage record
                    self._store_usage_record(job['tenant_id'], job_id, html_usage_info)
                else:
                    # Generate HTML directly from submission data + template
                    final_content, html_usage_info, html_request_details, html_response_details = self.ai_service.generate_html_from_submission(
                        submission_data=submission.get('submission_data', {}),
                        template_html=template['html_content'],
                        template_style=template.get('style_description', ''),
                        ai_instructions=workflow.get('ai_instructions', ''),
                        model=workflow.get('rewrite_model', 'gpt-5')
                    )
                    # Store usage record
                    self._store_usage_record(job['tenant_id'], job_id, html_usage_info)
                
                html_duration = (datetime.utcnow() - html_start_time).total_seconds() * 1000
                
                # Add execution step
                html_step_data = {
                    'step_name': 'HTML Generation',
                    'step_order': len(execution_steps),
                    'step_type': 'html_generation',
                    'model': workflow.get('rewrite_model', 'gpt-5'),
                    'input': html_request_details,
                    'output': html_response_details.get('output_text', '')[:5000],  # Truncate for storage
                    'usage_info': convert_floats_to_decimal(html_usage_info),
                    'timestamp': html_start_time.isoformat(),
                    'duration_ms': int(html_duration),
                }
                execution_steps.append(html_step_data)
                self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
                
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
                final_content = self._generate_content_from_submission(workflow, submission)
                final_artifact_type = 'text_final'
                final_filename = 'final.txt'
        
        return final_content, final_artifact_type, final_filename, report_artifact_id
    
    def _generate_report(
        self,
        workflow: Dict[str, Any],
        submission: Dict[str, Any],
        field_label_map: Dict[str, str]
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate AI report for legacy workflow.
        
        Args:
            workflow: Workflow configuration
            submission: Submission data
            field_label_map: Map of field IDs to labels
            
        Returns:
            Tuple of (report_content, usage_info, request_details, response_details)
        """
        ai_instructions = workflow['ai_instructions']
        
        # Format submission data with labels
        submission_data = submission.get('submission_data', {})
        formatted_data = []
        for key, value in submission_data.items():
            label = field_label_map.get(key, key)
            formatted_data.append(f"{label}: {value}")
        formatted_submission = "\n".join(formatted_data)
        
        return self.ai_service.generate_report(
            model=workflow.get('ai_model', 'gpt-5'),
            instructions=ai_instructions,
            context=formatted_submission,
            previous_context="",
            tools=[{"type": "web_search_preview"}],  # Default for legacy workflows
            tool_choice="auto"
        )
    
    def _generate_content_from_submission(
        self,
        workflow: Dict[str, Any],
        submission: Dict[str, Any]
    ) -> str:
        """
        Generate simple content from submission data.
        
        Args:
            workflow: Workflow configuration
            submission: Submission data
            
        Returns:
            Generated content string
        """
        submission_data = submission.get('submission_data', {})
        content_parts = []
        
        for key, value in submission_data.items():
            content_parts.append(f"{key}: {value}")
        
        return "\n".join(content_parts)
    
    def _store_usage_record(
        self,
        tenant_id: str,
        job_id: str,
        usage_info: Dict[str, Any]
    ):
        """
        Store usage record in DynamoDB.
        
        Args:
            tenant_id: Tenant ID
            job_id: Job ID
            usage_info: Usage information dictionary
        """
        try:
            from decimal import Decimal
            from ulid import new as ulid
            
            usage_id = f"usage_{ulid()}"
            # Convert cost_usd to Decimal for DynamoDB compatibility
            cost_usd = usage_info.get('cost_usd', 0.0)
            if isinstance(cost_usd, float):
                cost_usd = Decimal(str(cost_usd))
            elif not isinstance(cost_usd, Decimal):
                cost_usd = Decimal(str(cost_usd))
            
            usage_record = {
                'usage_id': usage_id,
                'tenant_id': tenant_id,
                'job_id': job_id,
                'service_type': usage_info.get('service_type', 'openai_workflow'),
                'model': usage_info.get('model', 'gpt-5'),
                'input_tokens': usage_info.get('input_tokens', 0),
                'output_tokens': usage_info.get('output_tokens', 0),
                'cost_usd': cost_usd,
                'created_at': datetime.utcnow().isoformat(),
            }
            self.db.put_usage_record(usage_record)
        except Exception as e:
            logger.error(f"Failed to store usage record: {e}")
            # Don't fail the job if usage record fails

