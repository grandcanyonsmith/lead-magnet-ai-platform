import logging
import json
import re
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class WebhookPayloadBuilder:
    """Helper class to build webhook payloads."""

    def __init__(self, s3_service=None):
        self.s3_service = s3_service

    def build_payload(
        self,
        job_id: str,
        output_url: str,
        submission: Dict[str, Any],
        job: Dict[str, Any],
        all_artifacts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Build the webhook payload dictionary.
        """
        # Categorize artifacts
        artifacts_list = []
        images_list = []
        html_files_list = []
        markdown_files_list = []
        pdf_files_list = []
        
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
            elif artifact_type == 'pdf_final' or artifact_name.endswith('.pdf'):
                pdf_files_list.append(artifact_metadata)
        
        # Extract artifact content for context
        artifact_content = self._extract_artifact_content(all_artifacts, job_id)
        
        # Build payload with dynamic values from submission data
        submission_data = dict(submission.get('submission_data', {}) or {})
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
            'artifacts': artifacts_list,
            'images': images_list,
            'html_files': html_files_list,
            'markdown_files': markdown_files_list,
            'pdf_files': pdf_files_list,
        }
        
        # Build full context including submission data and artifact text
        submission_context_lines = []
        for key, value in submission_data.items():
            if isinstance(key, str) and key.lower() in ('context', 'icp'):
                continue  # Avoid recursive context nesting
            if value is None:
                value_str = 'null'
            elif isinstance(value, (dict, list)):
                try:
                    value_str = json.dumps(value, default=str)
                except Exception:
                    value_str = str(value)
            else:
                value_str = str(value)
            submission_context_lines.append(f"{key}: {value_str}")
        
        context_sections = []
        if submission_context_lines:
            submission_context = "\n".join(submission_context_lines)
            context_sections.append(f"=== Form Submission ===\n{submission_context}")
        
        if artifact_content:
            context_sections.append(artifact_content)
        
        if context_sections:
            combined_context = "\n\n".join(context_sections)
            payload['context'] = combined_context
            # Surface the same context inside submission_data for downstream consumers
            payload['submission_data']['icp'] = combined_context
        
        # Merge with any additional dynamic values from submission
        for key, value in submission_data.items():
            if key not in payload:
                payload[f'submission_{key}'] = value
                
        return payload

    def _extract_text_from_html(self, html_content: str) -> str:
        """
        Extract text content from HTML by stripping tags.
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
    
    def _extract_artifact_content(self, all_artifacts: List[Dict[str, Any]], job_id: str) -> str:
        """
        Extract text content from .md and .html artifacts and collect image URLs.
        """
        if not self.s3_service:
            logger.warning(f"[WebhookPayloadBuilder] S3 service not available, skipping artifact content extraction", extra={
                'job_id': job_id
            })
            return ""
        
        content_parts = []
        image_urls = []
        
        # Filter and process markdown and HTML files
        markdown_artifacts = []
        html_artifacts = []
        
        for artifact in all_artifacts:
            artifact_type = artifact.get('artifact_type', '').lower()
            artifact_name = (artifact.get('artifact_name') or artifact.get('file_name') or '').lower()
            s3_key = artifact.get('s3_key')
            public_url = artifact.get('public_url') or artifact.get('s3_url') or ''
            
            # Collect image URLs
            if artifact_type == 'image' or artifact_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                if public_url:
                    image_urls.append(public_url)
            
            # Categorize text artifacts
            elif artifact_type in ('markdown_final', 'step_output', 'report_markdown') or artifact_name.endswith(('.md', '.markdown')):
                if s3_key:
                    markdown_artifacts.append((artifact, s3_key))
            elif artifact_type == 'html_final' or artifact_name.endswith('.html'):
                if s3_key:
                    html_artifacts.append((artifact, s3_key))
        
        # Download and extract content from markdown files
        for artifact, s3_key in markdown_artifacts:
            artifact_name = artifact.get('artifact_name') or artifact.get('file_name') or 'unknown.md'
            try:
                content = self.s3_service.download_artifact(s3_key)
                if content:
                    content_parts.append(f"[Markdown File: {artifact_name}]\n{content}\n")
                    logger.debug(f"[WebhookPayloadBuilder] Extracted markdown content", extra={
                        'job_id': job_id,
                        'artifact_name': artifact_name,
                        'content_length': len(content)
                    })
            except Exception as e:
                logger.warning(f"[WebhookPayloadBuilder] Failed to download markdown artifact", extra={
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
                    # Extract text from HTML
                    text_content = self._extract_text_from_html(html_content)
                    if text_content:
                        content_parts.append(f"[HTML File: {artifact_name}]\n{text_content}\n")
                        logger.debug(f"[WebhookPayloadBuilder] Extracted HTML content", extra={
                            'job_id': job_id,
                            'artifact_name': artifact_name,
                            'text_length': len(text_content)
                        })
            except Exception as e:
                logger.warning(f"[WebhookPayloadBuilder] Failed to download HTML artifact", extra={
                    'job_id': job_id,
                    'artifact_name': artifact_name,
                    's3_key': s3_key,
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }, exc_info=True)
        
        # Build final content string
        result_parts = []
        if content_parts:
            result_parts.append("=== ARTIFACT CONTENT ===\n")
            result_parts.extend(content_parts)
        
        if image_urls:
            result_parts.append("\n=== IMAGE LINKS ===\n")
            for url in image_urls:
                result_parts.append(f"- {url}\n")
        
        return "\n".join(result_parts)
