"""
Workflow Orchestrator Service
Handles orchestration of multi-step workflow execution.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

from ai_service import AIService
from db_service import DynamoDBService
from s3_service import S3Service
from services.execution_step_manager import ExecutionStepManager
from services.step_processor import StepProcessor
from services.field_label_service import FieldLabelService

logger = logging.getLogger(__name__)


class WorkflowOrchestrator:
    """Service for orchestrating workflow execution."""
    
    def __init__(
        self,
        step_processor: StepProcessor,
        ai_service: AIService,
        db_service: DynamoDBService,
        s3_service: S3Service
    ):
        """
        Initialize workflow orchestrator.
        
        Args:
            step_processor: Step processor instance
            ai_service: AI service instance
            db_service: DynamoDB service instance
            s3_service: S3 service instance
        """
        self.step_processor = step_processor
        self.ai_service = ai_service
        self.db = db_service
        self.s3 = s3_service
    
    def execute_workflow(
        self,
        job_id: str,
        job: Dict[str, Any],
        workflow: Dict[str, Any],
        submission: Dict[str, Any],
        form: Optional[Dict[str, Any]],
        execution_steps: List[Dict[str, Any]]
    ) -> Tuple[str, str, str, Optional[str], List[str]]:
        """
        Execute a multi-step workflow.
        
        Args:
            job_id: Job ID
            job: Job dictionary
            workflow: Workflow configuration
            submission: Submission dictionary
            form: Optional form dictionary for field labels
            execution_steps: List of execution steps (will be updated)
            
        Returns:
            Tuple of (final_content, final_artifact_type, final_filename, report_artifact_id, all_image_artifact_ids)
            
        Raises:
            Exception: If workflow execution fails
        """
        steps = workflow.get('steps', [])
        if not steps:
            raise ValueError(f"Workflow {workflow.get('workflow_id')} has no steps configured")
        
        logger.info(f"Processing workflow with {len(steps)} steps")
        
        # Build field label map
        field_label_map = FieldLabelService.build_field_label_map(form)
        
        # Format initial submission data as context with labels
        submission_data = submission.get('submission_data', {})
        initial_context = FieldLabelService.format_submission_data_with_labels(
            submission_data,
            field_label_map
        )
        
        # Sort steps by step_order if present
        sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
        
        # Process each step
        accumulated_context = ""
        step_outputs = []
        all_image_artifact_ids = []
        
        for step_index, step in enumerate(sorted_steps):
            step_output_dict, image_artifact_ids = self.step_processor.process_step_batch_mode(
                step=step,
                step_index=step_index,
                job_id=job_id,
                tenant_id=job['tenant_id'],
                initial_context=initial_context,
                step_outputs=step_outputs,
                sorted_steps=sorted_steps,
                execution_steps=execution_steps,
                all_image_artifact_ids=all_image_artifact_ids
            )
            
            step_outputs.append(step_output_dict)
            
            # Accumulate context for next step (include image URLs if present)
            step_name = step_output_dict['step_name']
            step_output = step_output_dict['output']
            
            # Extract image URLs from multiple sources:
            # 1. From image_urls array
            image_urls_from_array = step_output_dict.get('image_urls', [])
            if image_urls_from_array is None:
                image_urls_from_array = []
            elif not isinstance(image_urls_from_array, list):
                image_urls_from_array = [str(image_urls_from_array)] if image_urls_from_array else []
            else:
                image_urls_from_array = [url for url in image_urls_from_array if url]
            
            # 2. Extract image URLs from the output text itself
            from utils.image_utils import extract_image_urls, extract_image_urls_from_object
            image_urls_from_text = []
            if isinstance(step_output, str):
                image_urls_from_text = extract_image_urls(step_output)
            elif isinstance(step_output, (dict, list)):
                image_urls_from_text = extract_image_urls_from_object(step_output)
            
            # Combine and deduplicate all image URLs
            all_image_urls = set(image_urls_from_array) | set(image_urls_from_text)
            image_urls = sorted(list(all_image_urls))  # Sort for consistent output
            
            accumulated_context += f"\n\n--- Step {step_index + 1}: {step_name} ---\n{step_output}"
            if image_urls:
                accumulated_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in image_urls])
        
        # Generate final content
        final_content, final_artifact_type, final_filename = self._generate_final_content(
            workflow=workflow,
            step_outputs=step_outputs,
            accumulated_context=accumulated_context,
            submission_data=submission_data,
            execution_steps=execution_steps,
            job_id=job_id,
            tenant_id=job['tenant_id']
        )
        
        report_artifact_id = step_outputs[0]['artifact_id'] if step_outputs else None
        
        return final_content, final_artifact_type, final_filename, report_artifact_id, all_image_artifact_ids
    
    def _generate_final_content(
        self,
        workflow: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        accumulated_context: str,
        submission_data: Dict[str, Any],
        execution_steps: List[Dict[str, Any]],
        job_id: str,
        tenant_id: str
    ) -> Tuple[str, str, str]:
        """
        Generate final content (HTML or markdown) from workflow steps.
        
        Args:
            workflow: Workflow configuration
            step_outputs: List of step output dictionaries
            accumulated_context: Accumulated context from all steps
            submission_data: Submission data
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
        
        final_content = ""
        final_artifact_type = ""
        final_filename = ""
        
        if template:
            # Last step output should be HTML-ready, but if not, generate HTML
            last_step_output = step_outputs[-1]['output'] if step_outputs else ""
            
            # Check if last step output looks like HTML
            if last_step_output.strip().startswith('<'):
                final_content = last_step_output
            else:
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
                from services.usage_service import UsageService
                usage_service = UsageService(self.db)
                usage_service.store_usage_record(tenant_id, job_id, html_usage_info)
                
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
            
            final_artifact_type = 'html_final'
            final_filename = 'final.html'
        else:
            # Use last step output as final content
            final_content = step_outputs[-1]['output'] if step_outputs else accumulated_context
            final_artifact_type = 'markdown_final'
            final_filename = 'final.md'
        
        return final_content, final_artifact_type, final_filename

