"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

import os
import logging
from typing import Optional
import boto3
import json
from openai import OpenAI

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
        max_tokens: int = 4000
    ) -> str:
        """
        Generate a report using OpenAI.
        
        Args:
            model: OpenAI model to use (e.g., 'gpt-4o')
            instructions: System instructions for the AI
            context: User context/data to generate report from
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated report content
        """
        logger.info(f"Generating report with model: {model}")
        
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": instructions
                    },
                    {
                        "role": "user",
                        "content": f"Generate a report based on the following information:\n\n{context}"
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.7,
            )
            
            report = response.choices[0].message.content
            
            # Log token usage for cost tracking
            usage = response.usage
            logger.info(
                f"Report generation completed. "
                f"Tokens: {usage.total_tokens} "
                f"(prompt: {usage.prompt_tokens}, completion: {usage.completion_tokens})"
            )
            
            return report
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
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
    
    def rewrite_html(
        self,
        html_content: str,
        model: str = 'gpt-4o',
        max_tokens: int = 6000
    ) -> str:
        """
        Rewrite/enhance HTML content using AI.
        
        Args:
            html_content: Original HTML content
            model: OpenAI model to use
            max_tokens: Maximum tokens to generate
            
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
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": instructions
                    },
                    {
                        "role": "user",
                        "content": f"Enhance this HTML document:\n\n{html_content}"
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.5,
            )
            
            enhanced_html = response.choices[0].message.content
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"HTML rewriting completed. "
                f"Tokens: {usage.total_tokens} "
                f"(prompt: {usage.prompt_tokens}, completion: {usage.completion_tokens})"
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

