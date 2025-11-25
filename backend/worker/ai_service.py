"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

import logging
from typing import Optional, Dict, Tuple, List

from s3_service import S3Service
from services.tool_validator import ToolValidator
from services.image_handler import ImageHandler
from services.html_generator import HTMLGenerator
from services.openai_client import OpenAIClient
from services.cua_loop_service import CUALoopService
from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered content generation."""
    
    def __init__(self):
        """Initialize services."""
        self.s3_service = S3Service()
        self.openai_client = OpenAIClient()
        self.image_handler = ImageHandler(self.s3_service)
        self.html_generator = HTMLGenerator(self.openai_client)
        self.cua_loop_service = CUALoopService(self.image_handler)
    
    def generate_report(
        self,
        model: str,
        instructions: str,
        context: str,
        previous_context: str = "",
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate a report using OpenAI with configurable tools.
        
        Args:
            model: OpenAI model to use (e.g., 'gpt-5')
            instructions: System instructions for the AI
            context: User context/data to generate report from
            previous_context: Optional context from previous steps (accumulated)
            tools: List of tool dictionaries (e.g., [{"type": "web_search"}])
            tool_choice: How model should use tools - "auto", "required", or "none"
            tenant_id: Optional tenant ID for image storage context
            job_id: Optional job ID for image storage context
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            
        Returns:
            Tuple of (generated report content, usage info dict, request details dict, response details dict)
        """
        # Validate and filter tools (including model compatibility check)
        validated_tools, normalized_tool_choice = ToolValidator.validate_and_filter_tools(tools, tool_choice, model=model)
        
        # Normalize DynamoDB Decimal values to prevent JSON serialization errors
        if validated_tools:
            validated_tools = convert_decimals_to_float(validated_tools)
        
        logger.debug(f"[AI Service] After tool validation", extra={
            'validated_tools_count': len(validated_tools) if validated_tools else 0,
            'validated_tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'normalized_tool_choice': normalized_tool_choice,
            'original_tool_choice': tool_choice
        })
        
        # Detect image_generation tool
        has_image_generation = ToolValidator.has_image_generation(validated_tools)
        
        # CRITICAL VALIDATION: Ensure tool_choice='required' never exists with empty tools
        if normalized_tool_choice == "required":
            if not validated_tools or len(validated_tools) == 0:
                logger.error("[AI Service] CRITICAL: tool_choice='required' but validated_tools is empty!", extra={
                    'original_tool_choice': tool_choice,
                    'has_image_generation': has_image_generation,
                    'validated_tools_count': 0
                })
                raise ValueError("Invalid workflow configuration: tool_choice='required' but no valid tools available after validation. Please check your workflow step configuration and ensure at least one valid tool is included.")
        
        # Check if computer_use_preview is in tools (requires truncation="auto")
        has_computer_use = ToolValidator.has_computer_use(validated_tools)
        
        logger.info(f"[AI Service] Generating report", extra={
            'model': model,
            'tools_count': len(validated_tools) if validated_tools else 0,
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'tool_choice': normalized_tool_choice,
            'has_computer_use': has_computer_use,
            'has_image_generation': has_image_generation,
            'instructions_length': len(instructions),
            'context_length': len(context),
            'previous_context_length': len(previous_context),
            'previous_image_urls_count': len(previous_image_urls) if previous_image_urls else 0
        })
        
        # Build input text
        input_text = OpenAIClient.build_input_text(context, previous_context)
        full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}" if previous_context else context
        
        # Check if we need to use CUA loop (computer-use-preview model with computer_use_preview tool)
        use_cua_loop = (
            has_computer_use and 
            (model == 'computer-use-preview' or 'computer-use' in model.lower())
        )
        
        if use_cua_loop:
            logger.info(f"[AI Service] Using CUA loop for computer-use-preview", extra={
                'model': model,
                'has_computer_use': has_computer_use
            })
            
            try:
                # Build API parameters for CUA loop
                params = self.openai_client.build_api_params(
                    model=model,
                    instructions=instructions,
                    input_text=input_text,
                    tools=validated_tools,
                    tool_choice=normalized_tool_choice,
                    has_computer_use=has_computer_use,
                    reasoning_level=None,
                    previous_image_urls=previous_image_urls if has_image_generation else None,
                    job_id=job_id,
                    tenant_id=tenant_id
                )
                
                # Run CUA loop
                final_report, screenshot_urls, cua_usage_info = self.cua_loop_service.run_cua_loop(
                    openai_client=self.openai_client,
                    model=model,
                    instructions=instructions,
                    input_text=input_text,
                    tools=validated_tools,
                    tool_choice=normalized_tool_choice,
                    params=params,
                    max_iterations=50,
                    max_duration_seconds=300,
                    tenant_id=tenant_id,
                    job_id=job_id
                )
                
                # Build usage info from CUA loop
                from cost_service import calculate_openai_cost
                
                cost_data = calculate_openai_cost(
                    model,
                    cua_usage_info.get('input_tokens', 0),
                    cua_usage_info.get('output_tokens', 0)
                )
                
                usage_info = {
                    'model': model,
                    'input_tokens': cua_usage_info.get('input_tokens', 0),
                    'output_tokens': cua_usage_info.get('output_tokens', 0),
                    'total_tokens': cua_usage_info.get('total_tokens', 0),
                    'cost_usd': cost_data['cost_usd'],
                    'service_type': 'openai_worker_report',
                }
                usage_info = convert_decimals_to_float(usage_info)
                
                # Build request details
                request_details = {
                    'model': model,
                    'instructions': instructions,
                    'input': input_text,
                    'previous_context': previous_context,
                    'context': context,
                    'tools': validated_tools,
                    'tool_choice': normalized_tool_choice,
                    'truncation': params.get('truncation'),
                    'used_cua_loop': True,
                }
                
                # Build response details
                response_details = {
                    'output_text': final_report,
                    'image_urls': screenshot_urls,  # Screenshot URLs from CUA loop
                    'usage': {
                        'input_tokens': usage_info['input_tokens'],
                        'output_tokens': usage_info['output_tokens'],
                        'total_tokens': usage_info['total_tokens'],
                    },
                    'model': model,
                }
                
                logger.info(f"[AI Service] CUA loop completed", extra={
                    'model': model,
                    'total_tokens': usage_info['total_tokens'],
                    'screenshots_captured': len(screenshot_urls),
                    'cost_usd': usage_info['cost_usd']
                })
                
                return final_report, usage_info, request_details, response_details
                
            except Exception as e:
                logger.error(f"[AI Service] Error in CUA loop: {e}", exc_info=True)
                # Fall through to regular error handling
                raise
        
        # Regular API call flow (non-CUA)
        try:
            # Build API parameters
            # NOTE: reasoning_level is NOT supported in Responses API, so we don't pass it
            logger.debug(f"[AI Service] About to build API params", extra={
                'model': model,
                'normalized_tool_choice': normalized_tool_choice,
                'validated_tools_count': len(validated_tools) if validated_tools else 0
            })
            
            params = self.openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                has_computer_use=has_computer_use,
                reasoning_level=None,  # Not supported in Responses API
                previous_image_urls=previous_image_urls if has_image_generation else None,
                job_id=job_id,
                tenant_id=tenant_id
            )
            
            logger.debug(f"[AI Service] API params built successfully", extra={
                'params_keys': list(params.keys()),
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice_value': params.get('tool_choice')
            })
            
            # Make API call
            logger.info(f"[AI Service] Making OpenAI API call", extra={
                'model': model,
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice': params.get('tool_choice')
            })
            
            response = self.openai_client.make_api_call(params)
            
            # Process response
            return self.openai_client.process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                params=params,
                image_handler=self.image_handler,
                tenant_id=tenant_id,
                job_id=job_id
            )
            
        except Exception as e:
            # Handle errors with retry logic
            return self.openai_client.handle_openai_error(
                error=e,
                model=model,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                instructions=instructions,
                context=context,
                full_context=full_context,
                previous_context=previous_context,
                image_handler=self.image_handler
            )
    
    def generate_html_from_submission(
        self,
        submission_data: dict,
        template_html: str,
        template_style: str = '',
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate HTML document directly from submission data and template.
        
        Takes submission data and generates HTML styled to match the template.
        
        Args:
            submission_data: Form submission data
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        return self.html_generator.generate_html_from_submission(
            submission_data=submission_data,
            template_html=template_html,
            template_style=template_style,
            model=model
        )

    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: dict = None,
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
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
        return self.html_generator.generate_styled_html(
            research_content=research_content,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            model=model
        )

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
        return self.html_generator.rewrite_html(html_content, model)
