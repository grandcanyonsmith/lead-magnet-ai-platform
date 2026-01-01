"""
OpenAI Request Builder Service
Handles construction of API parameters for OpenAI Responses API calls.
"""
import logging
from typing import Dict, List, Optional, Any
from services.tool_builder import ToolBuilder
from utils import image_utils

logger = logging.getLogger(__name__)


class OpenAIRequestBuilder:
    """Builder for OpenAI API request parameters."""
    
    @staticmethod
    def build_input_text(context: str, previous_context: str = "") -> str:
        """
        Build input text for API call.
        
        Args:
            context: Current context
            previous_context: Previous step context
            
        Returns:
            Combined input text
        """
        if previous_context:
            return f"{previous_context}\n\n--- Current Step Context ---\n{context}"
        return context
    
    @staticmethod
    def build_api_params(
        model: str,
        instructions: str,
        input_text: str,
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        has_computer_use: bool = False,
        reasoning_level: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None
    ) -> Dict:
        """
        Build parameters for OpenAI Responses API call.
        
        Args:
            model: Model name
            instructions: System instructions
            input_text: User input
            tools: List of tools
            tool_choice: Tool choice setting
            has_computer_use: Whether computer_use_preview is in tools
            reasoning_level: Reasoning level (deprecated, kept for compatibility)
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            reasoning_effort: Reasoning effort for supported models ('none'|'low'|'medium'|'high'|'xhigh')
            service_tier: Service tier / speed preference (e.g., 'default' for fast)
            text_verbosity: Output verbosity ('low'|'medium'|'high')
            max_output_tokens: Maximum number of output tokens
            
        Returns:
            API parameters dictionary for Responses API
        """
        # Check if image_generation tool is present
        has_image_generation = False
        if tools:
            for tool in tools:
                if isinstance(tool, dict) and tool.get('type') == 'image_generation':
                    has_image_generation = True
                    break
        
        # Build input: if image_generation tool is present and we have previous image URLs,
        # use list format with text and images; otherwise use string format (backward compatible)
        if has_image_generation and previous_image_urls and len(previous_image_urls) > 0:
            api_input = OpenAIRequestBuilder._build_multimodal_input(
                input_text, previous_image_urls, job_id, tenant_id
            )
        else:
            # Use string format (backward compatible)
            api_input = input_text
            if has_image_generation and previous_image_urls:
                logger.debug("[OpenAI Request Builder] Image generation tool present but no previous image URLs to include")
        
        params = {
            "model": model,
            "instructions": instructions,
            "input": api_input
        }
        
        if tools and len(tools) > 0:
            # Filter out incompatible tools when computer_use_preview is present
            # OpenAI doesn't support certain tools (like 'shell') alongside computer_use_preview
            if has_computer_use:
                # Tools incompatible with computer_use_preview
                # Note: 'shell' is now supported alongside computer_use_preview
                INCOMPATIBLE_WITH_CUA = {'code_interpreter'}
                filtered_tools = []
                for tool in tools:
                    tool_type = tool.get('type') if isinstance(tool, dict) else tool
                    if tool_type not in INCOMPATIBLE_WITH_CUA:
                        filtered_tools.append(tool)
                    else:
                        logger.debug(f"Filtering out incompatible tool '{tool_type}' when computer_use_preview is present")
                tools = filtered_tools
            
            # Clean tools before sending to OpenAI API
            cleaned_tools = ToolBuilder.clean_tools(tools)
            
            # #region agent log
            try:
                import json
                import time
                # Filter out shell tool if computer_use_preview is present to avoid API error
                # Note: ToolBuilder.clean_tools already handles the conversion of 'shell' to a function tool if needed
                # So we just log what's happening here without removing it again
                
                with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({
                        "sessionId": "debug-session",
                        "runId": "repro-3",
                        "hypothesisId": "check-tools-after-builder",
                        "location": "openai_request_builder.py:build_api_params",
                        "timestamp": int(time.time() * 1000),
                        "message": "Tools after ToolBuilder.clean_tools",
                        "data": {
                            "model": model,
                            "has_computer_use": has_computer_use,
                            "final_tools_count": len(cleaned_tools),
                            "final_tool_types": [t.get('type') for t in cleaned_tools],
                            "final_tool_names": [t.get('name') for t in cleaned_tools if t.get('type') == 'function']
                        }
                    }) + '\n')
            except Exception:
                pass
            # #endregion

            params["tools"] = cleaned_tools
            if tool_choice != "none":
                params["tool_choice"] = tool_choice

        # Reasoning + speed controls (Responses API) 
        # Map deprecated reasoning_level to reasoning_effort if provided
        if reasoning_level and not reasoning_effort:
            reasoning_effort = reasoning_level

        # Default to "high" reasoning for GPT-5 family unless explicitly overridden
        if reasoning_effort is None and isinstance(model, str) and model.startswith('gpt-5'):
            reasoning_effort = 'high'

        if reasoning_effort:
            params["reasoning"] = {"effort": reasoning_effort}

        # Prefer the priority tier for fastest responses on supported models (best-effort; we retry without if unsupported)
        if service_tier is None and isinstance(model, str) and model.startswith('gpt-5'):
            service_tier = 'priority'

        if service_tier:
            params["service_tier"] = service_tier

        # Output verbosity control
        if text_verbosity:
            params["text"] = {"verbosity": text_verbosity}

        # Maximum output tokens
        if max_output_tokens is not None:
            params["max_output_tokens"] = max_output_tokens
        
        return params

    @staticmethod
    def _build_multimodal_input(
        input_text: str,
        previous_image_urls: List[str],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Build multimodal input with text and images.
        Handles image deduplication and base64 conversion for problematic URLs.
        """
        # Build input as list of content items
        input_content = [
            {"type": "input_text", "text": input_text}
        ]
        
        deduplicated_urls = image_utils.deduplicate_image_urls(previous_image_urls, job_id=job_id, tenant_id=tenant_id)
        
        # Process image URLs - convert problematic ones to base64 upfront
        valid_image_urls = []
        skipped_count = 0
        converted_count = 0
        problematic_urls = []
        direct_urls = []
        
        # Separate problematic URLs from direct URLs
        for image_url in deduplicated_urls:
            if not image_url:  # Skip empty URLs
                skipped_count += 1
                continue
            
            # Skip cdn.openai.com URLs (they can be problematic and we can't download them)
            if 'cdn.openai.com' in image_url:
                skipped_count += 1
                logger.warning("[OpenAI Request Builder] Skipping potentially problematic image URL: cdn.openai.com", extra={
                    'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                    'reason': 'cdn.openai.com URLs may fail to download',
                    'job_id': job_id,
                    'tenant_id': tenant_id
                })
                continue
            
            # Check if URL is problematic - if so, convert to base64 upfront
            if image_utils.is_problematic_url(image_url):
                problematic_urls.append(image_url)
            else:
                direct_urls.append(image_url)
        
        # Convert problematic URLs concurrently if we have multiple
        if problematic_urls:
            if len(problematic_urls) > 1:
                # Use concurrent downloads for multiple problematic URLs
                logger.info("[OpenAI Request Builder] Converting multiple problematic URLs concurrently", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'problematic_urls_count': len(problematic_urls)
                })
            
            for idx, image_url in enumerate(problematic_urls):
                logger.info("[OpenAI Request Builder] Converting problematic URL to base64 upfront", extra={
                    'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'image_index': idx,
                    'total_images': len(problematic_urls)
                })
                data_url = image_utils.download_image_and_convert_to_data_url(
                    url=image_url,
                    job_id=job_id,
                    tenant_id=tenant_id,
                    image_index=idx,
                    total_images=len(problematic_urls)
                )
                if data_url:
                    input_content.append({
                        "type": "input_image",
                        "image_url": data_url
                    })
                    valid_image_urls.append(image_url)  # Track original URL
                    converted_count += 1
                else:
                    skipped_count += 1
                    logger.warning("[OpenAI Request Builder] Failed to convert problematic URL, skipping", extra={
                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'image_index': idx,
                        'total_images': len(problematic_urls)
                    })
        
        # Add direct URLs (non-problematic) as-is
        for image_url in direct_urls:
            if not image_url:  # Skip empty URLs
                skipped_count += 1
                continue
            
            # Skip cdn.openai.com URLs (redundant check but safe)
            if 'cdn.openai.com' in image_url:
                skipped_count += 1
                continue
            
            # Add the image URL as-is
            valid_image_urls.append(image_url)
            input_content.append({
                "type": "input_image",
                "image_url": image_url
            })
        
        # Only use list format if we have valid image URLs
        if valid_image_urls:
            # OpenAI Responses API expects input as a list with role and content
            api_input = [
                {
                    "role": "user",
                    "content": input_content
                }
            ]
            
            logger.info("[OpenAI Request Builder] Building API params with previous image URLs", extra={
                'original_image_urls_count': len(previous_image_urls),
                'deduplicated_urls_count': len(deduplicated_urls),
                'valid_image_urls_count': len(valid_image_urls),
                'problematic_urls_count': len(problematic_urls),
                'direct_urls_count': len(direct_urls),
                'skipped_count': skipped_count,
                'converted_to_base64_count': converted_count,
                'input_content_items': len(input_content)
            })
            return api_input
        else:
            # No valid image URLs, fall back to string format
            logger.warning("[OpenAI Request Builder] No valid image URLs after filtering, using text-only input", extra={
                'original_count': len(previous_image_urls)
            })
            return input_text

