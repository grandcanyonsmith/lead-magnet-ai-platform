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

logger = logging.getLogger(__name__)


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
    
    def process_job(self, job_id: str) -> Dict[str, Any]:
        """
        Process a job end-to-end.
        
        Args:
            job_id: The job ID to process
            
        Returns:
            Dictionary with success status and optional error
        """
        try:
            # Initialize execution steps array
            execution_steps = []
            
            # Update job status to processing
            self.db.update_job(job_id, {
                'status': 'processing',
                'started_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'execution_steps': execution_steps
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
            self.db.update_job(job_id, {'execution_steps': execution_steps})
            
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
                    
                    logger.info(f"Processing step {step_index + 1}/{len(sorted_steps)}: {step_name}")
                    
                    try:
                        step_start_time = datetime.utcnow()
                        
                        # Build context with ALL previous step outputs
                        # Include form submission data
                        all_previous_outputs = []
                        all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
                        
                        # Include all previous step outputs explicitly (with image URLs if present)
                        for prev_idx, prev_step_output in enumerate(step_outputs):
                            prev_step_name = sorted_steps[prev_idx].get('step_name', f'Step {prev_idx + 1}')
                            prev_output_text = prev_step_output['output']
                            prev_image_urls = prev_step_output.get('image_urls', [])
                            
                            step_context = f"\n=== Step {prev_idx + 1}: {prev_step_name} ===\n{prev_output_text}"
                            if prev_image_urls:
                                step_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in prev_image_urls])
                            all_previous_outputs.append(step_context)
                        
                        # Combine all previous outputs into context
                        all_previous_context = "\n\n".join(all_previous_outputs)
                        
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
                        
                        # Store usage record
                        self.store_usage_record(job['tenant_id'], job_id, usage_info)
                        
                        # Store step output as artifact
                        step_artifact_id = self.store_artifact(
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
                        self.db.update_job(job_id, {'execution_steps': execution_steps})
                        
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
                        self.db.update_job(job_id, {'execution_steps': execution_steps})
                    
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
                        report_content, usage_info, request_details, response_details = self.generate_report(workflow, submission, field_label_map)
                        report_duration = (datetime.utcnow() - report_start_time).total_seconds() * 1000
                        
                        # Store usage record
                        self.store_usage_record(job['tenant_id'], job_id, usage_info)
                        
                        # Store report as artifact
                        report_artifact_id = self.store_artifact(
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
                        self.db.update_job(job_id, {'execution_steps': execution_steps})
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
                            self.store_usage_record(job['tenant_id'], job_id, html_usage_info)
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
                            self.store_usage_record(job['tenant_id'], job_id, html_usage_info)
                        
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
                        self.db.update_job(job_id, {'execution_steps': execution_steps})
                        
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
                final_start_time = datetime.utcnow()
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
            })
            
            # Step 6: Deliver based on workflow configuration
            delivery_method = workflow.get('delivery_method', 'none')
            
            if delivery_method == 'webhook':
                webhook_url = workflow.get('delivery_webhook_url')
                if webhook_url:
                    logger.info("Step 6: Sending webhook notification")
                    webhook_headers = workflow.get('delivery_webhook_headers', {})
                    self.send_webhook_notification(
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
                self.send_sms_notification(
                    workflow,
                    job['tenant_id'],
                    job_id,
                    public_url,
                    submission,
                    report_content if research_enabled else None
                )
            else:
                logger.info("Step 6: No delivery method configured, skipping delivery")
            
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
            job = self.db.get_job(job_id)
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
                raise ValueError(f"Workflow {workflow.get('workflow_id')} has no steps configured")
            
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
            all_previous_outputs = []
            all_previous_outputs.append(f"=== Form Submission ===\n{initial_context}")
            
            # Load previous step outputs from execution_steps
            for prev_step_data in execution_steps:
                if prev_step_data.get('step_type') == 'ai_generation':
                    prev_step_name = prev_step_data.get('step_name', 'Unknown Step')
                    prev_output_text = prev_step_data.get('output', '')
                    prev_image_urls = prev_step_data.get('image_urls', [])
                    
                    step_context = f"\n=== {prev_step_name} ===\n{prev_output_text}"
                    if prev_image_urls:
                        step_context += f"\n\nGenerated Images:\n" + "\n".join([f"- {url}" for url in prev_image_urls])
                    all_previous_outputs.append(step_context)
            
            # Combine all previous outputs into context
            all_previous_context = "\n\n".join(all_previous_outputs)
            
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
            
            # Store usage record
            self.store_usage_record(job['tenant_id'], job_id, usage_info)
            
            # Store step output as artifact
            step_artifact_id = self.store_artifact(
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
            self.db.update_job(job_id, {'execution_steps': execution_steps})
            
            logger.info(f"Step {step_index + 1} completed successfully in {step_duration:.0f}ms")
            
            return {
                'success': True,
                'step_index': step_index,
                'step_name': step_name,
                'step_output': step_output,
                'artifact_id': step_artifact_id,
                'image_urls': image_urls,
                'usage_info': usage_info,
                'duration_ms': int(step_duration)
            }
            
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
            final_artifact_id = self.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type='html_final',
                content=final_content,
                filename='final.html',
                public=True
            )
            
            # Get public URL for final artifact
            final_artifact = self.db.get_artifact(final_artifact_id)
            public_url = final_artifact.get('public_url')
            
            if not public_url:
                raise ValueError("Failed to generate public URL for final artifact")
            
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
            })
            
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
    
    def generate_report(self, workflow: Dict[str, Any], submission: Dict[str, Any], field_label_map: Dict[str, str] = None) -> Tuple[str, Dict, Dict, Dict]:
        """Generate AI report content."""
        ai_model = workflow.get('ai_model', 'gpt-5')
        ai_instructions = workflow['ai_instructions']
        submission_data = submission.get('submission_data', {})
        
        # Format submission data as context with labels if available
        if field_label_map:
            context = "\n".join([
                f"{field_label_map.get(key, key)}: {value}"
                for key, value in submission_data.items()
            ])
        else:
            context = "\n".join([
                f"{key}: {value}"
                for key, value in submission_data.items()
            ])
        
        # Generate report
        report, usage_info, request_details, response_details = self.ai_service.generate_report(
            model=ai_model,
            instructions=ai_instructions,
            context=context,
            tools=[{"type": "web_search_preview"}],  # Default for legacy workflows
            tool_choice="auto"
        )
        
        return report, usage_info, request_details, response_details
    
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
        webhook_headers: Dict[str, str],
        job_id: str,
        output_url: str,
        submission: Dict[str, Any],
        job: Dict[str, Any]
    ):
        """Send webhook notification about completed job with dynamic payload."""
        import requests
        
        # Build payload with dynamic values from submission data
        submission_data = submission.get('submission_data', {})
        payload = {
            'job_id': job_id,
            'status': 'completed',
            'output_url': output_url,
            'submission_data': submission_data,
            'lead_name': submission_data.get('name'),
            'lead_email': submission_data.get('email'),
            'lead_phone': submission_data.get('phone'),
            'completed_at': datetime.utcnow().isoformat(),
            'workflow_id': job.get('workflow_id'),
        }
        
        # Merge with any additional dynamic values from submission
        for key, value in submission_data.items():
            if key not in payload:
                payload[f'submission_{key}'] = value
        
        headers = {
            'Content-Type': 'application/json',
            **webhook_headers
        }
        
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            logger.info(f"Webhook notification sent successfully to {webhook_url}")
        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")
    
    def _get_twilio_credentials(self) -> Dict[str, str]:
        """Get Twilio credentials from AWS Secrets Manager."""
        secret_name = os.environ.get('TWILIO_SECRET_NAME', 'leadmagnet/twilio-credentials')
        # Twilio secret is stored in us-east-1
        region = os.environ.get('AWS_REGION', 'us-east-1')
        
        # Create a Secrets Manager client
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region
        )
        
        try:
            response = client.get_secret_value(SecretId=secret_name)
            
            # Parse the secret value
            if 'SecretString' in response:
                secret = response['SecretString']
                # Handle both plain string and JSON format
                try:
                    secret_dict = json.loads(secret)
                    return {
                        'account_sid': secret_dict.get('TWILIO_ACCOUNT_SID', ''),
                        'auth_token': secret_dict.get('TWILIO_AUTH_TOKEN', ''),
                        'from_number': secret_dict.get('TWILIO_FROM_NUMBER', '')
                    }
                except json.JSONDecodeError:
                    # If not JSON, try to parse as plain string (fallback)
                    return {
                        'account_sid': '',
                        'auth_token': '',
                        'from_number': ''
                    }
            else:
                raise ValueError("Secret binary format not supported")
                
        except Exception as e:
            logger.error(f"Failed to retrieve Twilio credentials: {e}")
            raise
    
    def send_sms_notification(
        self,
        workflow: Dict[str, Any],
        tenant_id: str,
        job_id: str,
        output_url: str,
        submission: Dict[str, Any],
        research_content: Optional[str] = None
    ):
        """Send SMS notification using Twilio or AI-generated message."""
        import requests
        
        submission_data = submission.get('submission_data', {})
        phone_number = submission_data.get('phone')
        
        logger.info(f"SMS Notification: Starting for job {job_id}, phone: {phone_number[:10] if phone_number else 'N/A'}...")
        
        if not phone_number:
            logger.error(f"SMS Notification: No phone number in submission data for job {job_id}. Submission data keys: {list(submission_data.keys())}")
            return
        
        # Validate phone number format
        if not phone_number or len(phone_number.strip()) < 10:
            logger.error(f"SMS Notification: Invalid phone number format: {phone_number}")
            return
        
        # Get SMS message
        sms_message = None
        if workflow.get('delivery_sms_ai_generated', False):
            # Generate SMS via AI
            logger.info(f"SMS Notification: Generating AI SMS message for job {job_id}")
            try:
                sms_message = self.generate_sms_message(
                    workflow,
                    tenant_id,
                    job_id,
                    submission_data,
                    output_url,
                    research_content
                )
                logger.info(f"SMS Notification: AI message generated successfully, length: {len(sms_message) if sms_message else 0}")
            except Exception as e:
                logger.error(f"SMS Notification: Failed to generate AI message: {e}")
                sms_message = f"Thank you! Your personalized report is ready: {output_url}"
        else:
            # Use manual message or default
            sms_message = workflow.get('delivery_sms_message', '')
            if not sms_message:
                # Default message
                sms_message = f"Thank you! Your personalized report is ready: {output_url}"
            else:
                # Replace placeholders in manual message
                sms_message = sms_message.replace('{output_url}', output_url)
                sms_message = sms_message.replace('{name}', submission_data.get('name', 'there'))
                sms_message = sms_message.replace('{job_id}', job_id)
        
        if not sms_message:
            logger.error(f"SMS Notification: No SMS message generated for job {job_id}, cannot send SMS")
            return
        
        logger.info(f"SMS Notification: Prepared message (length: {len(sms_message)}) for job {job_id}")
        
        # Get Twilio credentials from Secrets Manager
        try:
            logger.info(f"SMS Notification: Retrieving Twilio credentials...")
            twilio_creds = self._get_twilio_credentials()
            twilio_account_sid = twilio_creds['account_sid']
            twilio_auth_token = twilio_creds['auth_token']
            twilio_from_number = twilio_creds['from_number']
            
            if not twilio_account_sid or not twilio_auth_token or not twilio_from_number:
                logger.error(f"SMS Notification: Twilio credentials incomplete - account_sid: {'present' if twilio_account_sid else 'missing'}, auth_token: {'present' if twilio_auth_token else 'missing'}, from_number: {'present' if twilio_from_number else 'missing'}")
                return
            
            logger.info(f"SMS Notification: Twilio credentials retrieved successfully, from_number: {twilio_from_number[:5]}...")
        except Exception as e:
            logger.error(f"SMS Notification: Failed to retrieve Twilio credentials: {e}", exc_info=True)
            return
        
        try:
            # Send SMS via Twilio API
            logger.info(f"SMS Notification: Sending SMS to {phone_number} via Twilio...")
            response = requests.post(
                f'https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/Messages.json',
                auth=(twilio_account_sid, twilio_auth_token),
                data={
                    'From': twilio_from_number,
                    'To': phone_number,
                    'Body': sms_message
                }
            )
            response.raise_for_status()
            response_data = response.json()
            logger.info(f"SMS Notification: SMS sent successfully to {phone_number}. Twilio SID: {response_data.get('sid', 'N/A')}, Status: {response_data.get('status', 'N/A')}")
        except requests.exceptions.HTTPError as e:
            logger.error(f"SMS Notification: HTTP error sending SMS: {e}. Response: {e.response.text if e.response else 'N/A'}")
        except Exception as e:
            logger.error(f"SMS Notification: Failed to send SMS: {e}", exc_info=True)
    
    def generate_sms_message(
        self,
        workflow: Dict[str, Any],
        tenant_id: str,
        job_id: str,
        submission_data: Dict[str, Any],
        output_url: str,
        research_content: Optional[str] = None
    ) -> str:
        """Generate SMS message using AI based on context."""
        sms_instructions = workflow.get('delivery_sms_ai_instructions', '')
        
        # Build context for SMS generation
        context_parts = []
        if research_content:
            context_parts.append(f"Research Content: {research_content[:500]}...")  # Truncate for SMS context
        
        context_parts.append(f"Form Submission: {json.dumps(submission_data)}")
        context_parts.append(f"Lead Magnet URL: {output_url}")
        
        context = "\n".join(context_parts)
        
        prompt = f"""Generate a friendly, concise SMS message (max 160 characters) to send to a lead with their personalized lead magnet.

{sms_instructions if sms_instructions else "Keep it friendly, include the URL, and make it personal."}

Context:
{context}

Generate ONLY the SMS message text, no explanations, no markdown."""
        
        try:
            response, usage_info = self.ai_service.generate_report(
                model=workflow.get('ai_model', 'gpt-5'),
                instructions=prompt,
                context="",
                tools=[{"type": "web_search_preview"}],
                tool_choice="auto"
            )
            # Store usage record
            self.store_usage_record(
                tenant_id,
                job_id,
                {
                    'service_type': 'openai_sms_generation',
                    'model': usage_info.get('model', workflow.get('ai_model', 'gpt-5')),
                    'input_tokens': usage_info.get('input_tokens', 0),
                    'output_tokens': usage_info.get('output_tokens', 0),
                    'cost_usd': usage_info.get('cost_usd', 0.0)
                }
            )
            
            # Clean up the response
            sms_text = response.strip()
            # Remove quotes if wrapped
            if sms_text.startswith('"') and sms_text.endswith('"'):
                sms_text = sms_text[1:-1]
            if sms_text.startswith("'") and sms_text.endswith("'"):
                sms_text = sms_text[1:-1]
            
            # Ensure it fits in SMS (160 chars)
            if len(sms_text) > 160:
                sms_text = sms_text[:157] + "..."
            
            return sms_text
        except Exception as e:
            logger.error(f"Failed to generate SMS message: {e}")
            # Fallback to default message
            return f"Thank you! Your personalized report is ready: {output_url}"

