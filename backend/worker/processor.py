"""
Job Processor
Handles the complete workflow of generating AI reports and rendering HTML.
"""

import logging
import json
import os
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional, Tuple, Union
from ulid import new as ulid
import boto3

from ai_service import AIService
from template_service import TemplateService
from db_service import DynamoDBService
from s3_service import S3Service
from artifact_service import ArtifactService
from delivery_service import DeliveryService
from legacy_processor import LegacyWorkflowProcessor

logger = logging.getLogger(__name__)


def normalize_step_order(step_data: Dict[str, Any]) -> int:
    """
    Normalize step_order to integer.
    DynamoDB may store step_order as string or number, so we need to handle both.
    
    Args:
        step_data: Step data dictionary containing step_order
        
    Returns:
        Integer step_order value, or 0 if not found/invalid
    """
    step_order = step_data.get('step_order', 0)
    if isinstance(step_order, int):
        return step_order
    elif isinstance(step_order, str):
        try:
            return int(step_order)
        except (ValueError, TypeError):
            return 0
    elif isinstance(step_order, (float, Decimal)):
        return int(step_order)
    else:
        return 0


def convert_floats_to_decimal(obj: Any) -> Any:
    """
    Recursively convert float values to Decimal for DynamoDB compatibility.
    
    Args:
        obj: Object to convert (dict, list, or primitive)
        
    Returns:
        Object with floats converted to Decimal
    """
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {key: convert_floats_to_decimal(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    else:
        return obj


class JobProcessor:
    """Processes lead magnet generation jobs."""
    
    def __init__(self, db_service: DynamoDBService, s3_service: S3Service):
        self.db = db_service
        self.s3 = s3_service
        self.ai_service = AIService()
        self.template_service = TemplateService()
        
        # Initialize extracted services
        self.artifact_service = ArtifactService(db_service, s3_service)
        self.delivery_service = DeliveryService(db_service, self.ai_service)
        self.legacy_processor = LegacyWorkflowProcessor(
            db_service,
            s3_service,
            self.ai_service,
            self.artifact_service
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
                raise ValueError(f"Submission {job['submission_id']} not found")
            
            # Get form to retrieve field labels
            form = None
            form_id = submission.get('form_id')
            if form_id:
                try:
                    form = self.db.get_form(form_id)
                except Exception as e:
                    logger.warning(f"Could not retrieve form {form_id} for field labels: {e}")
            
            # Create field_id to label mapping
            field_label_map = {}
            if form and form.get('form_fields_schema') and form['form_fields_schema'].get('fields'):
                for field in form['form_fields_schema']['fields']:
                    field_label_map[field.get('field_id')] = field.get('label', field.get('field_id'))
            
            # Helper function to format submission data with labels
            def format_submission_data_with_labels(data: Dict[str, Any]) -> str:
                """Format submission data using field labels instead of field IDs."""
                lines = []
                for key, value in data.items():
                    label = field_label_map.get(key, key)  # Use label if available, otherwise use key
                    lines.append(f"{label}: {value}")
                return "\n".join(lines)
            
            # Add form submission as step 0
            submission_data = submission.get('submission_data', {})
            form_step_start = datetime.utcnow()
            execution_steps.append({
                'step_name': 'Form Submission',
                'step_order': 0,
                'step_type': 'form_submission',
                'input': submission_data,
                'output': submission_data,
                'timestamp': form_step_start.isoformat(),
                'duration_ms': 0,
            })
            self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            
            # Check if workflow uses new steps format or legacy format
            steps = workflow.get('steps', [])
            use_steps_format = steps and len(steps) > 0
            
            if use_steps_format:
                logger.info(f"Processing workflow with {len(steps)} steps")
                # New multi-step workflow processing
                accumulated_context = ""
                step_outputs = []
                submission_data = submission.get('submission_data', {})
                
                # Format initial submission data as context with labels
                initial_context = format_submission_data_with_labels(submission_data)
                
                # Sort steps by step_order if present
                sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
                
                # Process each step
                for step_index, step in enumerate(sorted_steps):
                    step_name = step.get('step_name', f'Step {step_index + 1}')
                    step_model = step.get('model', 'gpt-5')
                    step_instructions = step.get('instructions', '')
                    
                    # Extract tools and tool_choice from step config
                    step_tools_raw = step.get('tools', ['web_search_preview'])  # Default for backward compatibility
                    # Convert tool strings to tool dicts format: [{"type": "web_search_preview"}]
                    step_tools = [{"type": tool} if isinstance(tool, str) else tool for tool in step_tools_raw]
                    step_tool_choice = step.get('tool_choice', 'auto')
                    
                    logger.info(f"[JobProcessor] Processing step {step_index + 1}/{len(sorted_steps)}", extra={
                        'job_id': job_id,
                        'step_index': step_index,
                        'step_name': step_name,
                        'step_model': step_model,
                        'total_steps': len(sorted_steps),
                        'tools_count': len(step_tools),
                        'tool_choice': step_tool_choice
                    })
                    
                    try:
                        step_start_time = datetime.utcnow()
                        
                        # Build context with ALL previous step outputs
                        # Include form submission data
                        all_previous_outputs = []
                        all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
                        
                        # Include all previous step outputs explicitly (with image URLs if present)
                        # step_outputs contains outputs from steps 0 through (step_index - 1)
                        for prev_idx, prev_step_output in enumerate(step_outputs):
                            prev_step_name = sorted_steps[prev_idx].get('step_name', f'Step {prev_idx + 1}')
                            prev_output_text = prev_step_output['output']
                            
                            # Extract image URLs - handle both list and None cases
                            prev_image_urls_raw = prev_step_output.get('image_urls', [])
                            # Normalize to list: handle None, empty list, or already a list
                            if prev_image_urls_raw is None:
                                prev_image_urls = []
                            elif isinstance(prev_image_urls_raw, list):
                                prev_image_urls = [url for url in prev_image_urls_raw if url]  # Filter out None/empty strings
                            else:
                                # If it's not a list, try to convert (shouldn't happen, but be safe)
                                prev_image_urls = [str(prev_image_urls_raw)] if prev_image_urls_raw else []
                            
                            step_context = f"\n=== Step {prev_idx + 1}: {prev_step_name} ===\n{prev_output_text}"
                            if prev_image_urls:
                                step_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in prev_image_urls])
                            all_previous_outputs.append(step_context)
                        
                        # Combine all previous outputs into context
                        all_previous_context = "\n\n".join(all_previous_outputs)
                        
                        logger.info(f"[JobProcessor] Built previous context for step {step_index + 1}", extra={
                            'job_id': job_id,
                            'step_index': step_index,
                            'previous_steps_count': len(step_outputs),
                            'previous_context_length': len(all_previous_context),
                            'previous_step_names': [sorted_steps[i].get('step_name') for i in range(len(step_outputs))],
                            'previous_steps_with_images': len([s for s in step_outputs if s.get('image_urls')])
                        })
                        
                        # Current step context (empty for subsequent steps, initial_context for first step)
                        current_step_context = initial_context if step_index == 0 else ""
                        
                        # Generate step output with all previous step outputs
                        step_output, usage_info, request_details, response_details = self.ai_service.generate_report(
                            model=step_model,
                            instructions=step_instructions,
                            context=current_step_context,
                            previous_context=all_previous_context,
                            tools=step_tools,
                            tool_choice=step_tool_choice
                        )
                        
                        step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
                        
                        logger.info(f"[JobProcessor] Step completed successfully", extra={
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
                        self.store_usage_record(job['tenant_id'], job_id, usage_info)
                        
                        # Store step output as artifact
                        step_artifact_id = self.artifact_service.store_artifact(
                            tenant_id=job['tenant_id'],
                            job_id=job_id,
                            artifact_type='step_output',
                            content=step_output,
                            filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}.md'
                        )
                        # Extract image URLs from response
                        image_urls = response_details.get('image_urls', [])
                        
                        step_outputs.append({
                            'step_name': step_name,
                            'step_index': step_index,
                            'output': step_output,
                            'artifact_id': step_artifact_id,
                            'image_urls': image_urls  # Store image URLs for context passing
                        })
                        
                        # Add execution step (convert floats to Decimal for DynamoDB)
                        step_data = {
                            'step_name': step_name,
                            'step_order': step_index + 1,
                            'step_type': 'ai_generation',
                            'model': step_model,
                            'input': request_details,
                            'output': response_details.get('output_text', ''),
                            'image_urls': image_urls,  # Store image URLs
                            'usage_info': convert_floats_to_decimal(usage_info),
                            'timestamp': step_start_time.isoformat(),
                            'duration_ms': int(step_duration),
                            'artifact_id': step_artifact_id,
                        }
                        execution_steps.append(step_data)
                        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
                        
                        # Accumulate context for next step (include image URLs if present)
                        accumulated_context += f"\n\n--- Step {step_index + 1}: {step_name} ---\n{step_output}"
                        if image_urls:
                            accumulated_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in image_urls])
                        
                    except Exception as e:
                        raise Exception(f"Failed to process step '{step_name}': {str(e)}") from e
                
                # Final step: Check if last step should generate HTML
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
                        elif not template.get('is_published', False):
                            logger.warning(f"Template {template_id} not published, skipping HTML generation")
                    except Exception as e:
                        logger.warning(f"Failed to load template: {e}, skipping HTML generation")
                
                # Generate final content
                final_content = ""
                final_artifact_type = ""
                final_filename = ""
                
                if template and template.get('is_published'):
                    # Last step output should be HTML-ready, but if not, generate HTML
                    last_step_output = step_outputs[-1]['output'] if step_outputs else ""
                    
                    # Check if last step output looks like HTML
                    if last_step_output.strip().startswith('<'):
                        final_content = last_step_output
                    else:
                        # Generate HTML from accumulated context
                        logger.info("Generating HTML from accumulated step outputs")
                        html_start_time = datetime.utcnow()
                        final_content, html_usage_info, html_request_details, html_response_details = self.ai_service.generate_styled_html(
                            research_content=accumulated_context,
                            template_html=template['html_content'],
                            template_style=template.get('style_description', ''),
                            submission_data=submission_data,
                            model=sorted_steps[-1].get('model', 'gpt-5') if sorted_steps else 'gpt-5'
                        )
                        html_duration = (datetime.utcnow() - html_start_time).total_seconds() * 1000
                        self.store_usage_record(job['tenant_id'], job_id, html_usage_info)
                        
                        # Add HTML generation step (convert floats to Decimal for DynamoDB)
                        html_step_data = {
                            'step_name': 'HTML Generation',
                            'step_order': len(execution_steps),
                            'step_type': 'html_generation',
                            'model': sorted_steps[-1].get('model', 'gpt-5') if sorted_steps else 'gpt-5',
                            'input': html_request_details,
                            'output': html_response_details.get('output_text', '')[:5000],  # Truncate for storage
                            'usage_info': convert_floats_to_decimal(html_usage_info),
                            'timestamp': html_start_time.isoformat(),
                            'duration_ms': int(html_duration),
                        }
                        execution_steps.append(html_step_data)
                        self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
                    
                    final_artifact_type = 'html_final'
                    final_filename = 'final.html'
                else:
                    # Use last step output as final content
                    final_content = step_outputs[-1]['output'] if step_outputs else accumulated_context
                    final_artifact_type = 'markdown_final'
                    final_filename = 'final.md'
                
                report_artifact_id = step_outputs[0]['artifact_id'] if step_outputs else None
                
            else:
                # Legacy workflow processing
                final_content, final_artifact_type, final_filename, report_artifact_id = self.legacy_processor.process_legacy_workflow(
                    job_id=job_id,
                    workflow=workflow,
                    submission=submission,
                    field_label_map=field_label_map,
                    execution_steps=execution_steps,
                    job=job
                )
            
            # Step 4: Store final artifact
            try:
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
                
                # Add final output step
                execution_steps.append({
                    'step_name': 'Final Output',
                    'step_order': len(execution_steps),
                    'step_type': 'final_output',
                    'input': {'artifact_type': final_artifact_type, 'filename': final_filename},
                    'output': {'artifact_id': final_artifact_id, 'public_url': public_url},
                    'timestamp': final_start_time.isoformat(),
                    'duration_ms': int(final_duration),
                    'artifact_id': final_artifact_id,
                })
                
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
                'artifacts': artifacts_list,
                'execution_steps': execution_steps
            }, s3_service=self.s3)
            
            # Step 6: Deliver based on workflow configuration
            delivery_method = workflow.get('delivery_method', 'none')
            
            if delivery_method == 'webhook':
                webhook_url = workflow.get('delivery_webhook_url')
                if webhook_url:
                    logger.info("Step 6: Sending webhook notification")
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
                    logger.warning("Step 6: Webhook delivery enabled but no webhook URL configured")
            elif delivery_method == 'sms':
                logger.info("Step 6: Sending SMS notification")
                # Get research content for SMS if available
                research_content = None
                if report_artifact_id:
                    try:
                        report_artifact = self.db.get_artifact(report_artifact_id)
                        if report_artifact:
                            # Load report content from S3 if needed
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
                logger.info("Step 6: No delivery method configured, skipping delivery")
            
            # Create notification for job completion
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
            
            # Get workflow configuration
            workflow = self.db.get_workflow(job['workflow_id'])
            if not workflow:
                raise ValueError(f"Workflow {job['workflow_id']} not found")
            
            # Get submission data
            submission = self.db.get_submission(job['submission_id'])
            if not submission:
                raise ValueError(f"Submission {job['submission_id']} not found")
            
            submission_data = submission.get('submission_data', {})
            
            # Get form to retrieve field labels
            form = None
            form_id = submission.get('form_id')
            if form_id:
                try:
                    form = self.db.get_form(form_id)
                except Exception as e:
                    logger.warning(f"Could not retrieve form {form_id} for field labels: {e}")
            
            # Create field_id to label mapping
            field_label_map = {}
            if form and form.get('form_fields_schema') and form['form_fields_schema'].get('fields'):
                for field in form['form_fields_schema']['fields']:
                    field_label_map[field.get('field_id')] = field.get('label', field.get('field_id'))
            
            # Helper function to format submission data with labels
            def format_submission_data_with_labels(data: Dict[str, Any]) -> str:
                """Format submission data using field labels instead of field IDs."""
                lines = []
                for key, value in data.items():
                    label = field_label_map.get(key, key)
                    lines.append(f"{label}: {value}")
                return "\n".join(lines)
            
            initial_context = format_submission_data_with_labels(submission_data)
            
            # Load existing execution_steps from DynamoDB
            execution_steps = job.get('execution_steps', [])
            
            # Handle HTML generation step (special case)
            if step_type == 'html_generation':
                return self._process_html_generation_step(
                    job_id, job, workflow, submission_data, execution_steps, initial_context
                )
            
            # Handle workflow step
            steps = workflow.get('steps', [])
            if not steps or len(steps) == 0:
                raise ValueError(f"Workflow {job.get('workflow_id')} has no steps configured")
            
            # Sort steps by step_order if present
            sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
            
            if step_index < 0 or step_index >= len(sorted_steps):
                raise ValueError(f"Step index {step_index} is out of range. Workflow has {len(sorted_steps)} steps.")
            
            # Get the step to process
            step = sorted_steps[step_index]
            step_name = step.get('step_name', f'Step {step_index + 1}')
            step_model = step.get('model', 'gpt-5')
            step_instructions = step.get('instructions', '')
            
            # Extract tools and tool_choice from step config
            step_tools_raw = step.get('tools', ['web_search_preview'])
            step_tools = [{"type": tool} if isinstance(tool, str) else tool for tool in step_tools_raw]
            step_tool_choice = step.get('tool_choice', 'auto')
            
            logger.info(f"Processing step {step_index + 1}/{len(sorted_steps)}: {step_name}")
            
            step_start_time = datetime.utcnow()
            
            # Build context with ALL previous step outputs from execution_steps
            # Only include steps that come BEFORE the current step_index
            all_previous_outputs = []
            all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
            
            # Load previous step outputs from execution_steps
            # Filter to only include steps with step_order < (step_index + 1)
            # step_index is 0-indexed, step_order is 1-indexed
            current_step_order = step_index + 1
            
            # Sort execution_steps by step_order to ensure correct order
            sorted_execution_steps = sorted(
                [s for s in execution_steps if s.get('step_type') == 'ai_generation'],
                key=normalize_step_order
            )
            
            for prev_step_data in sorted_execution_steps:
                prev_step_order = normalize_step_order(prev_step_data)
                # Only include steps that come before the current step
                if prev_step_order < current_step_order:
                    prev_step_name = prev_step_data.get('step_name', 'Unknown Step')
                    prev_output_text = prev_step_data.get('output', '')
                    
                    # Extract image URLs - handle both list and None cases
                    prev_image_urls_raw = prev_step_data.get('image_urls', [])
                    # Normalize to list: handle None, empty list, or already a list
                    if prev_image_urls_raw is None:
                        prev_image_urls = []
                    elif isinstance(prev_image_urls_raw, list):
                        prev_image_urls = [url for url in prev_image_urls_raw if url]  # Filter out None/empty strings
                    else:
                        # If it's not a list, try to convert (shouldn't happen, but be safe)
                        prev_image_urls = [str(prev_image_urls_raw)] if prev_image_urls_raw else []
                    
                    step_context = f"\n=== Step {prev_step_order}: {prev_step_name} ===\n{prev_output_text}"
                    if prev_image_urls:
                        step_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in prev_image_urls])
                    all_previous_outputs.append(step_context)
            
            # Combine all previous outputs into context
            all_previous_context = "\n\n".join(all_previous_outputs)
            
            logger.info(f"[JobProcessor] Built previous context for step {step_index + 1}", extra={
                'job_id': job_id,
                'step_index': step_index,
                'current_step_order': current_step_order,
                'previous_steps_count': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order]),
                'previous_context_length': len(all_previous_context),
                'previous_steps_with_images': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order and s.get('image_urls')])
            })
            
            # Current step context (empty for subsequent steps, initial_context for first step)
            current_step_context = initial_context if step_index == 0 else ""
            
            logger.info(f"[JobProcessor] Processing step {step_index + 1}", extra={
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
            
            # Generate step output with all previous step outputs
            try:
                step_output, usage_info, request_details, response_details = self.ai_service.generate_report(
                    model=step_model,
                    instructions=step_instructions,
                    context=current_step_context,
                    previous_context=all_previous_context,
                    tools=step_tools,
                    tool_choice=step_tool_choice
                )
            except Exception as step_error:
                logger.error(f"[JobProcessor] Error generating report for step {step_index + 1}", extra={
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
            self.store_usage_record(job['tenant_id'], job_id, usage_info)
            
            # Store step output as artifact
            step_artifact_id = self.artifact_service.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type='step_output',
                content=step_output,
                filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}.md'
            )
            
            # Extract image URLs from response
            image_urls = response_details.get('image_urls', [])
            
            # Add execution step (convert floats to Decimal for DynamoDB)
            step_data = {
                'step_name': step_name,
                'step_order': step_index + 1,
                'step_type': 'ai_generation',
                'model': step_model,
                'input': request_details,
                'output': response_details.get('output_text', ''),
                'image_urls': image_urls,
                'usage_info': convert_floats_to_decimal(usage_info),
                'timestamp': step_start_time.isoformat(),
                'duration_ms': int(step_duration),
                'artifact_id': step_artifact_id,
            }
            
            # Append to execution_steps and update DynamoDB
            execution_steps.append(step_data)
            self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            
            logger.info(f"Step {step_index + 1} completed successfully in {step_duration:.0f}ms")
            
            # Check if this is the last step and if template exists - store output as HTML artifact
            total_steps = len(sorted_steps)
            is_last_step = (step_index + 1) == total_steps
            template_id = workflow.get('template_id')
            
            result = {
                'success': True,
                'step_index': step_index,
                'step_name': step_name,
                'step_output': step_output,
                'artifact_id': step_artifact_id,
                'image_urls': image_urls,
                'usage_info': usage_info,
                'duration_ms': int(step_duration)
            }
            
            if is_last_step and template_id:
                try:
                    # Get template to verify it exists and is published
                    template = self.db.get_template(
                        template_id,
                        workflow.get('template_version', 0)
                    )
                    
                    if template and template.get('is_published', False):
                        logger.info(f"Last step completed with template - storing output as HTML artifact")
                        
                        # Store step output as final HTML artifact
                        final_artifact_id = self.artifact_service.store_artifact(
                            tenant_id=job['tenant_id'],
                            job_id=job_id,
                            artifact_type='html_final',
                            content=step_output,
                            filename='final.html',
                            public=True
                        )
                        
                        # Get public URL for final artifact
                        public_url = self.artifact_service.get_artifact_public_url(final_artifact_id)
                        
                        # Update job with final output
                        artifacts_list = job.get('artifacts', [])
                        if final_artifact_id not in artifacts_list:
                            artifacts_list.append(final_artifact_id)
                        
                        self.db.update_job(job_id, {
                            'output_url': public_url,
                            'artifacts': artifacts_list,
                        }, s3_service=self.s3)
                        
                        logger.info(f"Final HTML artifact stored: {public_url[:80]}...")
                        
                        # Add to result
                        result['final_artifact_id'] = final_artifact_id
                        result['output_url'] = public_url
                    else:
                        logger.info(f"Template {template_id} not found or not published, skipping HTML artifact storage")
                except Exception as template_error:
                    logger.warning(f"Failed to store HTML artifact for last step: {template_error}")
                    # Don't fail the step if HTML storage fails
            
            return result
            
        except Exception as e:
            logger.exception(f"Error processing step {step_index} for job {job_id}")
            
            # Create descriptive error message
            error_type = type(e).__name__
            error_message = str(e)
            
            if not error_message or error_message == error_type:
                error_message = f"{error_type}: {error_message}" if error_message else error_type
            
            descriptive_error = f"Failed to process step {step_index}: {error_message}"
            
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
                'error_type': error_type,
                'step_index': step_index
            }
    
    def _process_html_generation_step(
        self,
        job_id: str,
        job: Dict[str, Any],
        workflow: Dict[str, Any],
        submission_data: Dict[str, Any],
        execution_steps: list,
        initial_context: str
    ) -> Dict[str, Any]:
        """
        Process HTML generation step (called after all workflow steps complete).
        
        Args:
            job_id: The job ID
            job: Job record from DynamoDB
            workflow: Workflow configuration
            submission_data: Form submission data
            execution_steps: List of completed execution steps
            initial_context: Formatted submission context
            
        Returns:
            Dictionary with success status and HTML content
        """
        try:
            template_id = workflow.get('template_id')
            if not template_id:
                raise ValueError("Template ID is required for HTML generation")
            
            template = self.db.get_template(
                template_id,
                workflow.get('template_version', 0)
            )
            if not template:
                raise ValueError(f"Template {template_id} not found")
            
            if not template.get('is_published', False):
                raise ValueError(f"Template {template_id} is not published")
            
            logger.info("Generating HTML from accumulated step outputs")
            html_start_time = datetime.utcnow()
            
            # Build accumulated context from all workflow steps
            accumulated_context = f"=== Form Submission ===\n{initial_context}\n\n"
            for step_data in execution_steps:
                if step_data.get('step_type') == 'ai_generation':
                    step_name = step_data.get('step_name', 'Unknown Step')
                    step_output = step_data.get('output', '')
                    image_urls = step_data.get('image_urls', [])
                    
                    accumulated_context += f"--- {step_name} ---\n{step_output}\n\n"
                    if image_urls:
                        accumulated_context += f"Generated Images:\n" + "\n".join([f"- {url}" for url in image_urls]) + "\n\n"
            
            # Get model from last workflow step or default
            steps = workflow.get('steps', [])
            model = 'gpt-5'
            if steps:
                sorted_steps = sorted(steps, key=lambda s: s.get('step_order', 0))
                if sorted_steps:
                    model = sorted_steps[-1].get('model', 'gpt-5')
            
            # Generate HTML
            final_content, html_usage_info, html_request_details, html_response_details = self.ai_service.generate_styled_html(
                research_content=accumulated_context,
                template_html=template['html_content'],
                template_style=template.get('style_description', ''),
                submission_data=submission_data,
                model=model
            )
            
            html_duration = (datetime.utcnow() - html_start_time).total_seconds() * 1000
            self.store_usage_record(job['tenant_id'], job_id, html_usage_info)
            
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
            html_step_data = {
                'step_name': 'HTML Generation',
                'step_order': len(execution_steps) + 1,
                'step_type': 'html_generation',
                'model': model,
                'input': html_request_details,
                'output': html_response_details.get('output_text', '')[:5000],  # Truncate for storage
                'usage_info': convert_floats_to_decimal(html_usage_info),
                'timestamp': html_start_time.isoformat(),
                'duration_ms': int(html_duration),
                'artifact_id': final_artifact_id,
            }
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
            
        except Exception as e:
            logger.exception(f"Error processing HTML generation step for job {job_id}")
            
            error_type = type(e).__name__
            error_message = str(e)
            
            if not error_message or error_message == error_type:
                error_message = f"{error_type}: {error_message}" if error_message else error_type
            
            descriptive_error = f"Failed to generate HTML: {error_message}"
            
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
                'error_type': error_type,
                'step_type': 'html_generation'
            }
    
    def store_usage_record(self, tenant_id: str, job_id: str, usage_info: Dict[str, Any]):
        """Store usage record for billing tracking."""
        try:
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
                'service_type': usage_info.get('service_type', 'unknown'),
                'model': usage_info.get('model', 'unknown'),
                'input_tokens': usage_info.get('input_tokens', 0),
                'output_tokens': usage_info.get('output_tokens', 0),
                'cost_usd': cost_usd,
                'created_at': datetime.utcnow().isoformat(),
            }
            self.db.put_usage_record(usage_record)
            logger.debug(f"Stored usage record {usage_id} for job {job_id}")
        except Exception as e:
            logger.error(f"Failed to store usage record: {e}")
            # Don't fail the job if usage tracking fails
            pass

