"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

import os
import logging
from typing import Optional, Dict, Tuple
import boto3
import json
from datetime import datetime
from ulid import new as ulid
from openai import OpenAI
from cost_service import calculate_openai_cost

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered content generation."""
    
    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        self.openai_api_key = self._get_openai_key()
        self.client = OpenAI(api_key=self.openai_api_key)
    
    def _get_openai_key(self) -> str:
        """Get OpenAI API key from AWS Secrets Manager."""
        secret_name = os.environ.get('OPENAI_SECRET_NAME', 'leadmagnet/openai-api-key')
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
                    return secret_dict.get('api_key', secret)
                except json.JSONDecodeError:
                    return secret
            else:
                raise ValueError("Secret binary format not supported")
                
        except Exception as e:
            logger.error(f"Failed to retrieve OpenAI API key: {e}")
            raise
    
    def generate_report(
        self,
        model: str,
        instructions: str,
        context: str,
        previous_context: str = "",
    ) -> Tuple[str, Dict]:
        """
        Generate a report using OpenAI with web search preview enabled.
        
        Args:
            model: OpenAI model to use (e.g., 'gpt-5')
            instructions: System instructions for the AI
            context: User context/data to generate report from
            previous_context: Optional context from previous steps (accumulated)
            
        Returns:
            Tuple of (generated report content, usage info dict)
        """
        logger.info(f"Generating report with model: {model} (with web search preview)")
        
        # Only use reasoning_level for o3 models (requires minimum "medium")
        is_o3_model = model.startswith('o3') or 'o3-deep-research' in model.lower()
        
        # Combine previous context with current context if provided
        full_context = context
        if previous_context:
            full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}"
        
        try:
            params = {
                "model": model,
                "instructions": instructions,
                "input": f"Generate a report based on the following information:\n\n{full_context}",
                "tools": [{"type": "web_search_preview"}],
            }
            
            # Add reasoning_level only for o3 models
            if is_o3_model:
                params["reasoning_level"] = "medium"
                logger.info(f"Using reasoning_level=medium for o3 model: {model}")
            
            response = self.client.responses.create(**params)
            
            report = response.output_text
            
            # Log token usage for cost tracking
            usage = response.usage
            logger.info(
                f"Report generation completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Calculate cost
            cost_data = calculate_openai_cost(
                model,
                usage.input_tokens or 0,
                usage.output_tokens or 0
            )
            
            usage_info = {
                'model': model,
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
                'cost_usd': cost_data['cost_usd'],
                'service_type': 'openai_worker_report',
            }
            
            return report, usage_info
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # If reasoning_level is not supported and we're using an o3 model, retry without it
            # (This shouldn't happen for o3 models, but handle gracefully)
            if ("reasoning_level" in error_message.lower() or "unsupported" in error_message.lower()) and is_o3_model:
                logger.warning(f"reasoning_level parameter not supported for o3 model, retrying without it: {error_message}")
                try:
                    params_no_reasoning = {
                        "model": model,
                        "instructions": instructions,
                        "input": f"Generate a report based on the following information:\n\n{full_context}",
                        "tools": [{"type": "web_search_preview"}],
                    }
                    response = self.client.responses.create(**params_no_reasoning)
                    report = response.output_text
                    usage = response.usage
                    
                    logger.info(
                        f"Report generation completed (without reasoning_level). "
                        f"Tokens: {usage.total_tokens} "
                        f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
                    )
                    
                    cost_data = calculate_openai_cost(
                        model,
                        usage.input_tokens or 0,
                        usage.output_tokens or 0
                    )
                    
                    usage_info = {
                        'model': model,
                        'input_tokens': usage.input_tokens or 0,
                        'output_tokens': usage.output_tokens or 0,
                        'total_tokens': usage.total_tokens or 0,
                        'cost_usd': cost_data['cost_usd'],
                        'service_type': 'openai_worker_report',
                    }
                    
                    return report, usage_info
                except Exception as retry_error:
                    # If retry also fails, continue with original error
                    error_message = str(retry_error)
                    error_type = type(retry_error).__name__
            
            # Provide more descriptive error messages
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed. Please check your API key configuration: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded. Please try again later: {error_message}")
            elif "model" in error_message.lower() and "not found" in error_message.lower():
                raise Exception(f"Invalid AI model specified. Please check your workflow configuration: {error_message}")
            elif "timeout" in error_message.lower():
                raise Exception(f"OpenAI API request timed out. The request took too long to complete: {error_message}")
            elif "connection" in error_message.lower():
                raise Exception(f"Unable to connect to OpenAI API. Please check your network connection: {error_message}")
            else:
                raise Exception(f"OpenAI API error ({error_type}): {error_message}")
    
    def generate_html_from_submission(
        self,
        submission_data: dict,
        template_html: str,
        template_style: str = '',
        ai_instructions: str = '',
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict]:
        """
        Generate HTML document directly from submission data and template.
        
        Used when research is disabled but HTML generation is enabled.
        Takes submission data and generates HTML styled to match the template.
        
        Args:
            submission_data: Form submission data
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            ai_instructions: AI instructions from workflow
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        logger.info(f"Generating HTML from submission with model: {model}")
        
        # Format submission data for context
        submission_context = "\n".join([
            f"- {key}: {value}"
            for key, value in submission_data.items()
        ])
        
        # Build system instructions
        instructions = f"""You are an expert web developer and content designer.

Your task is to create a beautifully styled HTML document based on user submission data and a template design.

Requirements:
1. Use the submission data provided as the basis for the document
2. Style the HTML to match the design and structure of the provided template
3. Apply the template's styling, layout, and visual design
4. Ensure semantic HTML structure
5. Include proper headings, sections, and formatting
6. Make it visually appealing and professional
7. Personalize the content based on the submission data
8. DO NOT use placeholder syntax like {{PLACEHOLDER_NAME}} - generate complete, personalized content directly

{('Template Style Notes: ' + template_style) if template_style else ''}

{('Additional Instructions: ' + ai_instructions) if ai_instructions else ''}

Return ONLY the complete HTML document, with no additional commentary or markdown code blocks."""
        
        # Build user message with submission data and template
        user_message = f"""Given this submission data:

{submission_context}

And this template to style it after:

{template_html}

Generate a complete HTML document that:
- Contains personalized content based on the submission data
- Matches the template's design, layout, and styling
- Is ready to use as a final document"""
        
        try:
            params = {
                "model": model,
                "instructions": instructions,
                "input": user_message,
            }
            
            response = self.client.responses.create(**params)
            
            html_content = response.output_text
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"HTML generation from submission completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Calculate cost
            cost_data = calculate_openai_cost(
                model,
                usage.input_tokens or 0,
                usage.output_tokens or 0
            )
            
            usage_info = {
                'model': model,
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
                'cost_usd': cost_data['cost_usd'],
                'service_type': 'openai_worker_html',
            }
            
            # Clean up markdown code blocks if present
            if html_content.startswith('```html'):
                html_content = html_content.replace('```html', '').replace('```', '').strip()
            elif html_content.startswith('```'):
                html_content = html_content.split('```')[1].strip()
                if html_content.startswith('html'):
                    html_content = html_content[4:].strip()
            
            return html_content, usage_info
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Provide descriptive error messages
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded: {error_message}")
            elif "model" in error_message.lower() and "not found" in error_message.lower():
                raise Exception(f"Invalid AI model specified: {error_message}")
            else:
                raise Exception(f"OpenAI API error ({error_type}): {error_message}")

    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: dict = None,
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict]:
        """
        Generate styled HTML document from research content and template.
        
        Takes the research from Step 1 and uses it as context to generate
        a properly styled HTML document that matches the template's design.
        
        Args:
            research_content: The markdown report content from Step 1 (research)
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            submission_data: Additional submission data to include (name, email, etc.)
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        logger.info(f"Generating styled HTML with model: {model}")
        
        # Format submission data for context
        submission_context = ""
        if submission_data:
            submission_context = "\n\nAdditional Context:\n" + "\n".join([
                f"- {key}: {value}"
                for key, value in submission_data.items()
            ])
        
        # Build system instructions
        instructions = f"""You are an expert web developer and content designer.

Your task is to create a beautifully styled HTML document based on research content and a template design.

Requirements:
1. Use the research content provided as the basis for the document
2. Style the HTML to match the design and structure of the provided template
3. Maintain all research content and facts accurately
4. Apply the template's styling, layout, and visual design
5. Ensure semantic HTML structure
6. Include proper headings, sections, and formatting
7. Make it visually appealing and professional
8. DO NOT use placeholder syntax like {{PLACEHOLDER_NAME}} - generate complete, personalized content directly
9. Personalize all content based on the research and submission data provided

{('Template Style Notes: ' + template_style) if template_style else ''}

Return ONLY the complete HTML document, with no additional commentary or markdown code blocks."""
        
        # Build user message with research and template
        user_message = f"""Given this research content from Step 1:

{research_content}
{submission_context}

And this template to style it after:

{template_html}

Generate a complete HTML document that:
- Contains all the research content
- Matches the template's design, layout, and styling
- Is ready to use as a final document"""
        
        try:
            params = {
                "model": model,
                "instructions": instructions,
                "input": user_message,
            }
            
            response = self.client.responses.create(**params)
            
            html_content = response.output_text
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"Styled HTML generation completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Calculate cost
            cost_data = calculate_openai_cost(
                model,
                usage.input_tokens or 0,
                usage.output_tokens or 0
            )
            
            usage_info = {
                'model': model,
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
                'cost_usd': cost_data['cost_usd'],
                'service_type': 'openai_worker_html',
            }
            
            # Clean up markdown code blocks if present
            if html_content.startswith('```html'):
                html_content = html_content.replace('```html', '').replace('```', '').strip()
            elif html_content.startswith('```'):
                html_content = html_content.split('```')[1].strip()
                if html_content.startswith('html'):
                    html_content = html_content[4:].strip()
            
            return html_content, usage_info
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Provide descriptive error messages
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded: {error_message}")
            elif "model" in error_message.lower() and "not found" in error_message.lower():
                raise Exception(f"Invalid AI model specified: {error_message}")
            else:
                raise Exception(f"OpenAI API error ({error_type}): {error_message}")

    def rewrite_html(
        self,
        html_content: str,
        model: str = 'gpt-5',
    ) -> str:
        """
        Rewrite/enhance HTML content using AI.
        
        Args:
            html_content: Original HTML content
            model: OpenAI model to use
            
        Returns:
            Enhanced HTML content
        """
        logger.info(f"Rewriting HTML with model: {model}")
        
        instructions = """You are an expert web developer and content editor.
        Your task is to enhance HTML documents by:
        1. Improving formatting and structure
        2. Adding appropriate styling classes
        3. Ensuring semantic HTML
        4. Improving readability
        5. Maintaining all original content
        
        Return ONLY the enhanced HTML, with no additional commentary."""
        
        try:
            params = {
                "model": model,
                "instructions": instructions,
                "input": f"Enhance this HTML document:\n\n{html_content}",
            }
            
            response = self.client.responses.create(**params)
            
            enhanced_html = response.output_text
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"HTML rewriting completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Clean up markdown code blocks if present
            if enhanced_html.startswith('```html'):
                enhanced_html = enhanced_html.replace('```html', '').replace('```', '').strip()
            
            return enhanced_html
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Provide more descriptive error messages for HTML rewriting
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed during HTML rewrite: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded during HTML rewrite: {error_message}")
            elif "timeout" in error_message.lower():
                raise Exception(f"OpenAI API request timed out during HTML rewrite: {error_message}")
            else:
                # For HTML rewrite, we return original HTML on error (handled in processor.py)
                logger.error(f"Error rewriting HTML: {e}")
                raise Exception(f"HTML rewrite failed ({error_type}): {error_message}")

