"""
Job Processor
Handles the complete workflow of generating AI reports and rendering HTML.
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional
from ulid import new as ulid

from ai_service import AIService
from template_service import TemplateService
from db_service import DynamoDBService
from s3_service import S3Service
from artifact_service import ArtifactService
from delivery_service import DeliveryService
from legacy_processor import LegacyWorkflowProcessor
from utils.decimal_utils import convert_decimals_to_float
from utils.error_utils import create_descriptive_error, normalize_error_message
from utils.step_utils import normalize_step_order
from services.context_builder import ContextBuilder
from services.execution_step_manager import ExecutionStepManager
from dependency_resolver import resolve_execution_groups, get_ready_steps, get_step_status, validate_dependencies

logger = logging.getLogger(__name__)






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
                return ContextBuilder.format_submission_data_with_labels(data, field_label_map)
            
            # Add form submission as step 0
            submission_data = submission.get('submission_data', {})
            execution_steps.append(
                ExecutionStepManager.create_form_submission_step(submission_data)
            )
            self.db.update_job(job_id, {'execution_steps': execution_steps}, s3_service=self.s3)
            
            # Workflow Format Detection:
            # The system supports two workflow formats:
            # 1. Legacy Format: Uses boolean flags (research_enabled, html_enabled) with ai_instructions
            #    - Limited to 2 steps (research + HTML)
            #    - Processed by LegacyWorkflowProcessor
            # 2. Steps Format: Uses steps array with dependencies and parallel execution support
            #    - Supports unlimited steps with dependencies
            #    - Processed by multi-step workflow logic below
            # 
            # Detection: If workflow has a non-empty 'steps' array, use steps format.
            # Otherwise, fall back to legacy format processing.
            steps = workflow.get('steps', [])
            use_steps_format = steps and len(steps) > 0
            
            if use_steps_format:
                logger.info(f"Processing workflow with {len(steps)} steps")
                # New multi-step workflow processing
                accumulated_context = ""
                step_outputs = []
                all_image_artifact_ids = []  # Track all image artifacts
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
                        all_previous_context = ContextBuilder.build_previous_context_from_step_outputs(
                            initial_context=initial_context,
                            step_outputs=step_outputs,
                            sorted_steps=sorted_steps
                        )
                        
                        logger.info(f"[JobProcessor] Built previous context for step {step_index + 1}", extra={
                            'job_id': job_id,
                            'step_index': step_index,
                            'previous_steps_count': len(step_outputs),
                            'previous_context_length': len(all_previous_context),
                            'previous_step_names': [sorted_steps[i].get('step_name') for i in range(len(step_outputs))],
                            'previous_steps_with_images': len([s for s in step_outputs if s.get('image_urls')])
                        })
                        
                        # Current step context (empty for subsequent steps, initial_context for first step)
                        current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
                        
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
                        
                        # Determine file extension based on content and step name
                        # Check if content looks like HTML (DOCTYPE, html tag, or common HTML tags)
                        step_output_stripped = step_output.strip()
                        step_name_lower = step_name.lower()
                        is_html = (
                            step_output_stripped.startswith('<!DOCTYPE') or
                            step_output_stripped.startswith('<!doctype') or
                            step_output_stripped.startswith('<html') or
                            step_output_stripped.startswith('<HTML') or
                            (step_output_stripped.startswith('<') and 
                             any(tag in step_output_stripped[:200].lower() for tag in ['<html', '<head', '<body', '<div', '<p>', '<h1', '<h2', '<h3'])) or
                            'html' in step_name_lower  # Step name hint (e.g., "Landing Page HTML")
                        )
                        file_ext = '.html' if is_html else '.md'
                        
                        # Store step output as artifact
                        step_artifact_id = self.artifact_service.store_artifact(
                            tenant_id=job['tenant_id'],
                            job_id=job_id,
                            artifact_type='step_output',
                            content=step_output,
                            filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}{file_ext}'
                        )
                        # Extract image URLs from response
                        image_urls = response_details.get('image_urls', [])
                        
                        # Store images as artifacts
                        image_artifact_ids = []
                        for idx, image_url in enumerate(image_urls):
                            if image_url:
                                try:
                                    # Extract filename from URL or generate one
                                    import re
                                    filename_match = re.search(r'/([^/?]+\.(png|jpg|jpeg))', image_url)
                                    filename = filename_match.group(1) if filename_match else f"image_{step_index + 1}_{idx + 1}.png"
                                    
                                    image_artifact_id = self.artifact_service.store_image_artifact(
                                        tenant_id=job['tenant_id'],
                                        job_id=job_id,
                                        image_url=image_url,
                                        filename=filename
                                    )
                                    image_artifact_ids.append(image_artifact_id)
                                    all_image_artifact_ids.append(image_artifact_id)
                                    logger.info(f"Stored image artifact: {image_artifact_id} for URL: {image_url[:80]}...")
                                except Exception as e:
                                    logger.warning(f"Failed to store image artifact for URL {image_url[:80]}...: {e}", exc_info=True)
                        
                        step_outputs.append({
                            'step_name': step_name,
                            'step_index': step_index,
                            'output': step_output,
                            'artifact_id': step_artifact_id,
                            'image_urls': image_urls  # Store image URLs for context passing
                        })
                        
                        # Add execution step (convert floats to Decimal for DynamoDB)
                        step_data = ExecutionStepManager.create_ai_generation_step(
                            step_name=step_name,
                            step_order=step_index + 1,
                            step_model=step_model,
                            request_details=request_details,
                            response_details=response_details,
                            usage_info=usage_info,
                            step_start_time=step_start_time,
                            step_duration=step_duration,
                            artifact_id=step_artifact_id
                        )
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
                    except Exception as e:
                        logger.warning(f"Failed to load template: {e}, skipping HTML generation")
                
                # Generate final content
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
                        html_step_data = ExecutionStepManager.create_html_generation_step(
                            model=sorted_steps[-1].get('model', 'gpt-5') if sorted_steps else 'gpt-5',
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
                execution_steps.append(
                    ExecutionStepManager.create_final_output_step(
                        final_artifact_type=final_artifact_type,
                        final_filename=final_filename,
                        final_artifact_id=final_artifact_id,
                        public_url=public_url,
                        step_order=len(execution_steps)
                    )
                )
                
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
            # Add all image artifacts
            artifacts_list.extend(all_image_artifact_ids)
            
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
                return ContextBuilder.format_submission_data_with_labels(data, field_label_map)
            
            initial_context = format_submission_data_with_labels(submission_data)
            
            # Load existing execution_steps (stored in S3, loaded via db_service.get_job if s3_service provided)
            # If not loaded yet, start with empty array
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
            
            if step_index < 0 or step_index >= len(steps):
                raise ValueError(f"Step index {step_index} is out of range. Workflow has {len(steps)} steps.")
            
            # Get the step to process (use original steps array, not sorted)
            step = steps[step_index]
            step_name = step.get('step_name', f'Step {step_index + 1}')
            step_model = step.get('model', 'gpt-5')
            step_instructions = step.get('instructions', '')
            
            # Check if dependencies are satisfied
            step_deps = step.get('depends_on', [])
            if not step_deps:
                # Auto-detect from step_order
                step_order = step.get('step_order', step_index)
                step_deps = [
                    i for i, s in enumerate(steps)
                    if s.get('step_order', i) < step_order
                ]
            
            # Get completed step indices from execution_steps
            completed_step_indices = [
                normalize_step_order(s) - 1  # Convert 1-indexed step_order to 0-indexed
                for s in execution_steps
                if s.get('step_type') == 'ai_generation' and normalize_step_order(s) > 0
            ]
            
            # Check if all dependencies are completed
            all_deps_completed = len(step_deps) == 0 or all(dep_index in completed_step_indices for dep_index in step_deps)
            
            if not all_deps_completed:
                missing_deps = [dep for dep in step_deps if dep not in completed_step_indices]
                logger.warning(f"[JobProcessor] Step {step_index + 1} ({step_name}) waiting for dependencies", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'step_name': step_name,
                    'step_status': 'waiting',
                    'missing_dependencies': missing_deps,
                    'completed_steps': completed_step_indices
                })
                raise ValueError(f"Step {step_index + 1} ({step_name}) cannot execute yet. Missing dependencies: {missing_deps}")
            
            # Get ready steps for logging
            ready_steps = get_ready_steps(completed_step_indices, steps)
            step_status_map = get_step_status(completed_step_indices, [], steps)
            
            logger.info(f"[JobProcessor] Step readiness check", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_status': 'ready',
                'dependencies': step_deps,
                'all_dependencies_completed': all_deps_completed,
                'ready_steps': ready_steps,
                'step_status_map': {k: v for k, v in step_status_map.items()}
            })
            
            # Extract tools and tool_choice from step config
            step_tools_raw = step.get('tools', ['web_search_preview'])
            step_tools = [{"type": tool} if isinstance(tool, str) else tool for tool in step_tools_raw]
            step_tool_choice = step.get('tool_choice', 'auto')
            
            logger.info(f"Processing step {step_index + 1}/{len(steps)}: {step_name}", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'step_status': 'ready'
            })
            
            step_start_time = datetime.utcnow()
            
            # Initialize image_artifact_ids early to ensure it's always available in return value
            # This ensures image artifacts are tracked even if errors occur after they're stored
            image_artifact_ids = []
            
            # step_index is 0-indexed, step_order is 1-indexed
            current_step_order = step_index + 1
            
            # Build context with ALL previous step outputs from execution_steps
            # Only include steps that this step depends on (or all previous if no explicit deps)
            step_deps = step.get('depends_on', [])
            if not step_deps:
                # Auto-detect from step_order
                step_order = step.get('step_order', step_index)
                step_deps = [
                    i for i, s in enumerate(steps)
                    if s.get('step_order', i) < step_order
                ]
            
            # Build context only from dependency steps
            all_previous_context = ContextBuilder.build_previous_context_from_execution_steps(
                initial_context=initial_context,
                execution_steps=execution_steps,
                current_step_order=step_index + 1,  # Use step_index + 1 for step_order
                dependency_indices=step_deps  # Only include these dependencies
            )
            
            logger.info(f"[JobProcessor] Built previous context for step {step_index + 1}", extra={
                'job_id': job_id,
                'step_index': step_index,
                'current_step_order': current_step_order,
                'previous_steps_count': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order]),
                'previous_context_length': len(all_previous_context),
                'previous_steps_with_images': len([s for s in execution_steps if s.get('step_type') == 'ai_generation' and normalize_step_order(s) < current_step_order and s.get('image_urls')])
            })
            
            # Current step context (empty for subsequent steps, initial_context for first step)
            current_step_context = ContextBuilder.get_current_step_context(step_index, initial_context)
            
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
            
            # Determine file extension based on content and step name
            # Check if content looks like HTML (DOCTYPE, html tag, or common HTML tags)
            step_output_stripped = step_output.strip()
            step_name_lower = step_name.lower()
            is_html = (
                step_output_stripped.startswith('<!DOCTYPE') or
                step_output_stripped.startswith('<!doctype') or
                step_output_stripped.startswith('<html') or
                step_output_stripped.startswith('<HTML') or
                (step_output_stripped.startswith('<') and 
                 any(tag in step_output_stripped[:200].lower() for tag in ['<html', '<head', '<body', '<div', '<p>', '<h1', '<h2', '<h3'])) or
                'html' in step_name_lower  # Step name hint (e.g., "Landing Page HTML")
            )
            file_ext = '.html' if is_html else '.md'
            
            # Store step output as artifact
            step_artifact_id = self.artifact_service.store_artifact(
                tenant_id=job['tenant_id'],
                job_id=job_id,
                artifact_type='step_output',
                content=step_output,
                filename=f'step_{step_index + 1}_{step_name.lower().replace(" ", "_")}{file_ext}'
            )
            
            # Extract image URLs from response
            image_urls = response_details.get('image_urls', [])
            
            # Store images as artifacts
            for idx, image_url in enumerate(image_urls):
                if image_url:
                    try:
                        # Extract filename from URL or generate one
                        import re
                        filename_match = re.search(r'/([^/?]+\.(png|jpg|jpeg))', image_url)
                        filename = filename_match.group(1) if filename_match else f"image_{step_index + 1}_{idx + 1}.png"
                        
                        image_artifact_id = self.artifact_service.store_image_artifact(
                            tenant_id=job['tenant_id'],
                            job_id=job_id,
                            image_url=image_url,
                            filename=filename
                        )
                        image_artifact_ids.append(image_artifact_id)
                        logger.info(f"Stored image artifact: {image_artifact_id} for URL: {image_url[:80]}...")
                    except Exception as e:
                        logger.warning(f"Failed to store image artifact for URL {image_url[:80]}...: {e}", exc_info=True)
            
            # Add execution step (convert floats to Decimal for DynamoDB)
            step_data = ExecutionStepManager.create_ai_generation_step(
                step_name=step_name,
                step_order=step_index + 1,
                step_model=step_model,
                request_details=request_details,
                response_details=response_details,
                usage_info=usage_info,
                step_start_time=step_start_time,
                step_duration=step_duration,
                artifact_id=step_artifact_id
            )
            
            # Check if this step already exists (for reruns) and replace it, otherwise append
            step_order = step_index + 1
            existing_step_index = None
            for i, existing_step in enumerate(execution_steps):
                if existing_step.get('step_order') == step_order and existing_step.get('step_type') == 'ai_generation':
                    existing_step_index = i
                    break
            
            if existing_step_index is not None:
                # Replace existing step (rerun case)
                logger.info(f"Replacing existing execution step for step_order {step_order} (rerun)")
                execution_steps[existing_step_index] = step_data
            else:
                # Append new step (first run case)
                execution_steps.append(step_data)
            
            # Update job with execution steps and add image artifacts to job's artifacts list
            artifacts_list = job.get('artifacts', [])
            if step_artifact_id not in artifacts_list:
                artifacts_list.append(step_artifact_id)
            # Add image artifact IDs to job's artifacts list
            for image_artifact_id in image_artifact_ids:
                if image_artifact_id not in artifacts_list:
                    artifacts_list.append(image_artifact_id)
            
            self.db.update_job(job_id, {
                'execution_steps': execution_steps,
                'artifacts': artifacts_list
            }, s3_service=self.s3)
            
            logger.info(f"Step {step_index + 1} completed successfully in {step_duration:.0f}ms")
            
            # Return step result - HTML generation will be handled separately after all steps complete
            result = {
                'success': True,
                'step_index': step_index,
                'step_name': step_name,
                'step_output': step_output,
                'artifact_id': step_artifact_id,
                'image_urls': image_urls,
                'image_artifact_ids': image_artifact_ids,  # Include image artifact IDs so they can be added to job's artifacts list
                'usage_info': usage_info,
                'duration_ms': int(step_duration)
            }
            
            return result
            
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
            
            # Return error result - include image_artifact_ids if any were stored before the error
            # This ensures image artifacts are tracked even when step processing fails
            # image_artifact_ids is initialized early in the try block, so it's always available
            return {
                'success': False,
                'error': descriptive_error,
                'error_type': error_type,
                'step_index': step_index,
                'image_artifact_ids': image_artifact_ids
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
            
            logger.info("Generating HTML from accumulated step outputs")
            html_start_time = datetime.utcnow()
            
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
            
        except Exception as e:
            logger.exception(f"Error processing HTML generation step for job {job_id}")
            
            # Use utility function for error handling
            error_type, error_message = normalize_error_message(e)
            descriptive_error = create_descriptive_error(e, "Failed to generate HTML")
            
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

