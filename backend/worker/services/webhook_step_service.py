"""
Webhook Step Service
Handles execution of webhook steps in workflows.
"""

import logging
import json
import re
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from services.context_builder import ContextBuilder

logger = logging.getLogger(__name__)


class WebhookStepService:
    """Service for executing webhook steps."""
    
    def __init__(self, db_service=None, s3_service=None):
        """
        Initialize webhook step service.
        
        Args:
            db_service: DynamoDB service instance for querying artifacts
            s3_service: S3 service instance for downloading artifact content
        """
        self.db = db_service
        self.s3_service = s3_service
    
    def execute_webhook_step(
        self,
        step: Dict[str, Any],
        step_index: int,
        job_id: str,
        job: Dict[str, Any],
        submission: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Execute a webhook step by sending POST request with selected data.
        
        Args:
            step: Step configuration dictionary
            step_index: Step index (0-based)
            job_id: Job ID
            job: Job dictionary
            submission: Submission dictionary
            step_outputs: List of previous step outputs
            sorted_steps: List of all steps sorted by order
            
        Returns:
            Tuple of (result_dict, success)
            result_dict contains:
                - webhook_url: URL called
                - payload: Payload sent
                - response_status: HTTP status code
                - response_body: Response body (truncated if too long)
                - success: Whether request succeeded
                - error: Error message if failed
        """
        webhook_url = step.get('webhook_url')
        if not webhook_url:
            error_msg = f"Webhook step {step_index} has no webhook_url configured"
            logger.error(f"[WebhookStepService] {error_msg}")
            return {
                'webhook_url': None,
                'payload': None,
                'response_status': None,
                'response_body': None,
                'success': False,
                'error': error_msg
            }, False
        
        webhook_headers = step.get('webhook_headers', {})
        data_selection = step.get('webhook_data_selection', {})
        
        # Build payload based on data selection
        payload = self._build_webhook_payload(
            job_id=job_id,
            job=job,
            submission=submission,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            step_index=step_index,
            data_selection=data_selection
        )
        
        # Prepare headers
        headers = {
            'Content-Type': 'application/json',
            **webhook_headers
        }
        
        logger.info(f"[WebhookStepService] Executing webhook step {step_index}", extra={
            'job_id': job_id,
            'step_index': step_index,
            'webhook_url': webhook_url,
            'payload_keys': list(payload.keys()) if payload else [],
            'headers_count': len(headers)
        })
        
        step_start_time = datetime.utcnow()
        
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
            
            # Get response body (truncate if too long)
            response_body = None
            try:
                response_body = response.text
                if len(response_body) > 10000:  # Truncate if too long
                    response_body = response_body[:10000] + "... (truncated)"
            except Exception:
                pass
            
            response.raise_for_status()
            
            logger.info(f"[WebhookStepService] Webhook step executed successfully", extra={
                'job_id': job_id,
                'step_index': step_index,
                'webhook_url': webhook_url,
                'status_code': response.status_code,
                'duration_ms': step_duration
            })
            
            return {
                'webhook_url': webhook_url,
                'payload': payload,
                'response_status': response.status_code,
                'response_body': response_body,
                'success': True,
                'error': None,
                'duration_ms': int(step_duration)
            }, True
            
        except requests.exceptions.RequestException as e:
            step_duration = (datetime.utcnow() - step_start_time).total_seconds() * 1000
            error_msg = str(e)
            
            # Try to get response status if available
            response_status = None
            response_body = None
            if hasattr(e, 'response') and e.response is not None:
                response_status = e.response.status_code
                try:
                    response_body = e.response.text
                    if len(response_body) > 10000:
                        response_body = response_body[:10000] + "... (truncated)"
                except Exception:
                    pass
            
            logger.error(f"[WebhookStepService] Webhook step failed", extra={
                'job_id': job_id,
                'step_index': step_index,
                'webhook_url': webhook_url,
                'error_type': type(e).__name__,
                'error_message': error_msg,
                'response_status': response_status,
                'duration_ms': step_duration
            }, exc_info=True)
            
            return {
                'webhook_url': webhook_url,
                'payload': payload,
                'response_status': response_status,
                'response_body': response_body,
                'success': False,
                'error': error_msg,
                'duration_ms': int(step_duration)
            }, False
    
    def _build_webhook_payload(
        self,
        job_id: str,
        job: Dict[str, Any],
        submission: Dict[str, Any],
        step_outputs: List[Dict[str, Any]],
        sorted_steps: List[Dict[str, Any]],
        step_index: int,
        data_selection: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build webhook payload from selected data.
        
        Args:
            job_id: Job ID
            job: Job dictionary
            submission: Submission dictionary
            step_outputs: List of previous step outputs
            sorted_steps: List of all steps sorted by order
            step_index: Current step index
            data_selection: Data selection configuration
            
        Returns:
            Payload dictionary with nested structure
        """
        payload = {}
        
        # Build context from submission data and previous step outputs
        # Format initial context from submission data (simple key-value format)
        # Exclude 'context' and 'icp' fields from submission_data since we build a new context
        submission_data = submission.get('submission_data', {})
        initial_context_lines = []
        for key, value in submission_data.items():
            # Skip 'context' and 'icp' fields - we'll build a comprehensive context separately
            if key.lower() in ('context', 'icp'):
                continue
            # Format value as string, handling None and complex types
            if value is None:
                value_str = 'null'
            elif isinstance(value, (dict, list)):
                value_str = json.dumps(value, default=str)
            else:
                value_str = str(value)
            initial_context_lines.append(f"{key}: {value_str}")
        initial_context = "\n".join(initial_context_lines) if initial_context_lines else ""
        
        # Build full context including previous step outputs
        context = ContextBuilder.build_previous_context_from_step_outputs(
            initial_context=initial_context,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps
        )
        
        logger.info(f"[WebhookStepService] Built context for webhook step", extra={
            'job_id': job_id,
            'step_index': step_index,
            'context_length': len(context),
            'previous_steps_count': len(step_outputs),
            'has_initial_context': bool(initial_context)
        })
        
        # Add context at root level (for direct format)
        payload['context'] = context
        
        # Include submission data if selected (default: true)
        include_submission = data_selection.get('include_submission', True)
        if include_submission:
            # Create a copy of submission_data to avoid modifying the original
            submission_data_copy = dict(submission_data)
            # Add 'icp' field to submission_data (for webhook format)
            submission_data_copy['icp'] = context
            payload['submission_data'] = submission_data_copy
        
        # Include step outputs (all by default, exclude specified indices)
        exclude_step_indices = set(data_selection.get('exclude_step_indices', []))
        step_outputs_dict = {}
        
        for i, step_output in enumerate(step_outputs):
            if i not in exclude_step_indices and i < step_index:  # Only include previous steps
                step_name = sorted_steps[i].get('step_name', f'Step {i}') if i < len(sorted_steps) else f'Step {i}'
                step_outputs_dict[f'step_{i}'] = {
                    'step_name': step_name,
                    'step_index': i,
                    'output': step_output.get('output', ''),
                    'artifact_id': step_output.get('artifact_id'),
                    'image_urls': step_output.get('image_urls', [])
                }
        
        if step_outputs_dict:
            payload['step_outputs'] = step_outputs_dict
        
        # Include job info if selected (default: true)
        include_job_info = data_selection.get('include_job_info', True)
        if include_job_info:
            payload['job_info'] = {
                'job_id': job_id,
                'workflow_id': job.get('workflow_id'),
                'status': job.get('status'),
                'created_at': job.get('created_at'),
                'updated_at': job.get('updated_at')
            }
        
        # Load execution_steps from S3 if not already in job
        execution_steps = job.get('execution_steps', [])
        if not execution_steps and job.get('execution_steps_s3_key') and self.s3_service:
            try:
                s3_key = job['execution_steps_s3_key']
                execution_steps_json = self.s3_service.download_artifact(s3_key)
                execution_steps = json.loads(execution_steps_json)
                job['execution_steps'] = execution_steps
                logger.debug(f"[WebhookStepService] Loaded execution_steps from S3 for webhook step", extra={
                    'job_id': job_id,
                    'steps_count': len(execution_steps)
                })
            except Exception as e:
                logger.warning(f"[WebhookStepService] Failed to load execution_steps from S3", extra={
                    'job_id': job_id,
                    's3_key': job.get('execution_steps_s3_key'),
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }, exc_info=True)
                execution_steps = []
        
        # Query and include artifacts if db_service is available
        if self.db:
            try:
                all_artifacts = self.db.query_artifacts_by_job_id(job_id)
                logger.debug(f"[WebhookStepService] Queried artifacts for webhook step", extra={
                    'job_id': job_id,
                    'artifacts_count': len(all_artifacts)
                })
            except Exception as e:
                logger.warning(f"[WebhookStepService] Failed to query artifacts for webhook step", extra={
                    'job_id': job_id,
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }, exc_info=True)
                all_artifacts = []
            
            # Categorize artifacts
            artifacts_list = []
            images_list = []
            html_files_list = []
            markdown_files_list = []
            
            for artifact in all_artifacts:
                # Build artifact metadata
                public_url = artifact.get('public_url') or artifact.get('s3_url') or ''
                artifact_metadata = {
                    'artifact_id': artifact.get('artifact_id'),
                    'artifact_type': artifact.get('artifact_type'),
                    'artifact_name': artifact.get('artifact_name') or artifact.get('file_name') or '',
                    'public_url': public_url,
                    'object_url': public_url,  # Alias for public_url for compatibility
                    's3_key': artifact.get('s3_key'),
                    's3_url': artifact.get('s3_url'),
                    'file_size_bytes': artifact.get('file_size_bytes'),
                    'mime_type': artifact.get('mime_type'),
                    'created_at': artifact.get('created_at')
                }
                
                # Add to all artifacts
                artifacts_list.append(artifact_metadata)
                
                # Categorize by type
                artifact_type = artifact.get('artifact_type', '').lower()
                artifact_name = (artifact_metadata['artifact_name'] or '').lower()
                
                if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                    images_list.append(artifact_metadata)
                elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
                    html_files_list.append(artifact_metadata)
                elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
                    markdown_files_list.append(artifact_metadata)
            
            # Include artifacts in payload
            if artifacts_list:
                payload['artifacts'] = artifacts_list
                payload['images'] = images_list
                payload['html_files'] = html_files_list
                payload['markdown_files'] = markdown_files_list
                
                # Log artifact URLs for debugging
                artifact_urls = [a.get('public_url') for a in artifacts_list if a.get('public_url')]
                logger.info(f"[WebhookStepService] Artifact URLs in webhook step payload", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'artifact_urls_count': len(artifact_urls),
                    'artifact_urls': artifact_urls[:5]  # Log first 5 URLs
                })
            
            # Extract artifact content and append to context
            # Also collect image URLs from execution steps (already loaded above)
            artifact_content = self._extract_artifact_content(all_artifacts, job_id, execution_steps)
            if artifact_content:
                # Append artifact content to existing context (no truncation - include everything)
                if context:
                    context = f"{context}\n\n{artifact_content}"
                else:
                    context = artifact_content
                
                logger.info(f"[WebhookStepService] Final context built with artifact content", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'context_length': len(context),
                    'artifact_content_length': len(artifact_content),
                    'has_artifact_content': bool(artifact_content)
                })
                
                # Update context in payload (ensure full context is included)
                payload['context'] = context
                
                # Update icp in submission_data if it exists (ensure full context is included)
                if 'submission_data' in payload and 'icp' in payload['submission_data']:
                    payload['submission_data']['icp'] = context
                    logger.debug(f"[WebhookStepService] Updated submission_data['icp'] with full context", extra={
                        'job_id': job_id,
                        'step_index': step_index,
                        'icp_length': len(context)
                    })
        
        return payload
    
    def _extract_text_from_html(self, html_content: str) -> str:
        """
        Extract text content from HTML by stripping tags.
        
        Args:
            html_content: HTML content as string
            
        Returns:
            Extracted text content
        """
        if not html_content:
            return ""
        
        # Remove script and style elements and their content
        html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html_content)
        
        # Decode HTML entities (basic ones)
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#39;', "'")
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text
    
    def _extract_artifact_content(self, all_artifacts: List[Dict[str, Any]], job_id: str, execution_steps: List[Dict[str, Any]] = None) -> str:
        """
        Extract text content from .md and .html artifacts and collect image URLs from both artifacts and execution steps.
        
        Args:
            all_artifacts: List of artifact dictionaries
            job_id: Job ID for logging
            execution_steps: Optional list of execution steps to extract image URLs from
            
        Returns:
            Formatted string containing all artifact text content and image URLs
        """
        if not self.s3_service:
            logger.warning(f"[WebhookStepService] S3 service not available, skipping artifact content extraction", extra={
                'job_id': job_id
            })
            return ""
        
        content_parts = []
        image_urls_set = set()  # Use set to avoid duplicates
        
        # Filter and process markdown and HTML files
        markdown_artifacts = []
        html_artifacts = []
        
        for artifact in all_artifacts:
            artifact_type = artifact.get('artifact_type', '').lower()
            artifact_name = (artifact.get('artifact_name') or artifact.get('file_name') or '').lower()
            s3_key = artifact.get('s3_key')
            public_url = artifact.get('public_url') or artifact.get('s3_url') or ''
            
            # Collect image URLs from artifacts
            if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                if public_url:
                    image_urls_set.add(public_url)
            
            # Categorize text artifacts
            elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
                if s3_key:
                    markdown_artifacts.append((artifact, s3_key))
            elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
                if s3_key:
                    html_artifacts.append((artifact, s3_key))
        
        # Collect image URLs from execution steps
        if execution_steps:
            for step in execution_steps:
                step_image_urls = step.get('image_urls', [])
                if step_image_urls:
                    if isinstance(step_image_urls, list):
                        for url in step_image_urls:
                            if url and isinstance(url, str):
                                image_urls_set.add(url)
                    elif isinstance(step_image_urls, str):
                        image_urls_set.add(step_image_urls)
        
        # Download and extract content from markdown files
        for artifact, s3_key in markdown_artifacts:
            artifact_name = artifact.get('artifact_name') or artifact.get('file_name') or 'unknown.md'
            try:
                content = self.s3_service.download_artifact(s3_key)
                if content:
                    # Include full content without truncation
                    content_parts.append(f"[Markdown File: {artifact_name}]\n{content}\n")
                    logger.debug(f"[WebhookStepService] Extracted markdown content", extra={
                        'job_id': job_id,
                        'artifact_name': artifact_name,
                        'content_length': len(content)
                    })
            except Exception as e:
                logger.warning(f"[WebhookStepService] Failed to download markdown artifact", extra={
                    'job_id': job_id,
                    'artifact_name': artifact_name,
                    's3_key': s3_key,
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }, exc_info=True)
        
        # Download and extract content from HTML files
        for artifact, s3_key in html_artifacts:
            artifact_name = artifact.get('artifact_name') or artifact.get('file_name') or 'unknown.html'
            try:
                html_content = self.s3_service.download_artifact(s3_key)
                if html_content:
                    # Extract text from HTML - include full extracted text without truncation
                    text_content = self._extract_text_from_html(html_content)
                    if text_content:
                        content_parts.append(f"[HTML File: {artifact_name}]\n{text_content}\n")
                        logger.debug(f"[WebhookStepService] Extracted HTML content", extra={
                            'job_id': job_id,
                            'artifact_name': artifact_name,
                            'text_length': len(text_content)
                        })
            except Exception as e:
                logger.warning(f"[WebhookStepService] Failed to download HTML artifact", extra={
                    'job_id': job_id,
                    'artifact_name': artifact_name,
                    's3_key': s3_key,
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }, exc_info=True)
        
        # Build final content string - ensure no truncation
        result_parts = []
        if content_parts:
            result_parts.append("=== ARTIFACT CONTENT ===\n")
            result_parts.extend(content_parts)
        
        # Sort image URLs for consistent output
        image_urls_sorted = sorted(list(image_urls_set))
        if image_urls_sorted:
            result_parts.append("\n=== IMAGE LINKS ===\n")
            for url in image_urls_sorted:
                result_parts.append(f"- {url}\n")
        
        final_content = "\n".join(result_parts)
        
        logger.info(f"[WebhookStepService] Extracted artifact content for webhook", extra={
            'job_id': job_id,
            'content_parts_count': len(content_parts),
            'image_urls_count': len(image_urls_sorted),
            'total_content_length': len(final_content)
        })
        
        return final_content

