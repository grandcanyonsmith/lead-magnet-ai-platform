"""
Computer Use API (CUA) Loop Service
Handles the full CUA loop: execute actions → capture screenshots → send back to model.
"""

import logging
import time
from typing import Tuple, List, Dict, Any, Optional

from services.browser_service import BrowserService

logger = logging.getLogger(__name__)


class CUALoopService:
    """Service for running the Computer Use API loop."""
    
    def __init__(self, image_handler: Any):
        """
        Initialize CUA loop service.
        
        Args:
            image_handler: ImageHandler instance for uploading screenshots
        """
        self.image_handler = image_handler
    
    def run_cua_loop(
        self,
        openai_client: Any,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict,
        max_iterations: int = 50,
        max_duration_seconds: int = 300
    ) -> Tuple[str, List[str], Dict]:
        """
        Run the full Computer Use API loop: execute actions → capture screenshots → send back to model.
        
        Args:
            openai_client: OpenAIClient instance
            model: Model name (should be 'computer-use-preview')
            instructions: System instructions
            input_text: Initial input text
            tools: List of tools (should include computer_use_preview)
            tool_choice: Tool choice setting
            params: API parameters dict
            max_iterations: Maximum number of loop iterations
            max_duration_seconds: Maximum duration in seconds
            
        Returns:
            Tuple of (final_report_text, screenshot_urls, usage_info)
        """
        from services.tool_validator import ToolValidator
        
        logger.info(f"[CUALoopService] Starting CUA loop", extra={
            'model': model,
            'max_iterations': max_iterations,
            'max_duration_seconds': max_duration_seconds
        })
        
        # Extract computer_use_preview tool config
        computer_use_tool = None
        display_width = 1024
        display_height = 768
        environment = 'browser'
        
        for tool in tools:
            tool_type = tool.get('type') if isinstance(tool, dict) else tool
            if tool_type == 'computer_use_preview':
                computer_use_tool = tool if isinstance(tool, dict) else {'type': tool_type}
                # Convert to int in case they're Decimal from DynamoDB
                display_width = int(computer_use_tool.get('display_width', 1024))
                display_height = int(computer_use_tool.get('display_height', 768))
                environment = computer_use_tool.get('environment', 'browser')
                break
        
        if not computer_use_tool:
            raise ValueError("computer_use_preview tool not found in tools list")
        
        # Initialize browser
        browser = BrowserService()
        screenshot_urls = []
        start_time = time.time()
        iteration = 0
        previous_response_id = None
        last_call_id = None
        acknowledged_safety_checks = []
        
        try:
            browser.initialize(display_width=display_width, display_height=display_height)
            
            # Build initial request params (use string format for initial request)
            initial_params = {
                'model': model,
                'instructions': instructions,
                'input': input_text,  # Use string format for initial request
                'tools': tools,
                'tool_choice': tool_choice,
                'truncation': 'auto'
            }
            
            # Make initial API call
            logger.info(f"[CUALoopService] Making initial CUA request")
            response = openai_client.make_api_call(initial_params)
            previous_response_id = response.id if hasattr(response, 'id') else None
            
            # Main CUA loop
            while iteration < max_iterations:
                # Check timeout
                elapsed = time.time() - start_time
                if elapsed > max_duration_seconds:
                    logger.warning(f"[CUALoopService] CUA loop timeout after {elapsed:.1f} seconds")
                    break
                
                iteration += 1
                logger.info(f"[CUALoopService] CUA loop iteration {iteration}")
                
                # Find computer_call items in response
                computer_calls = []
                if hasattr(response, 'output') and response.output:
                    for item in response.output:
                        if hasattr(item, 'type') and item.type == 'computer_call':
                            computer_calls.append(item)
                
                # If no computer calls, we're done
                if not computer_calls:
                    logger.info(f"[CUALoopService] No more computer calls, CUA loop complete")
                    break
                
                # Process first computer call (typically only one per response)
                computer_call = computer_calls[0]
                call_id = getattr(computer_call, 'call_id', None)
                action = getattr(computer_call, 'action', None)
                pending_safety_checks = getattr(computer_call, 'pending_safety_checks', [])
                
                if not action:
                    logger.warning(f"[CUALoopService] Computer call has no action, breaking loop")
                    break
                
                # Handle safety checks
                if pending_safety_checks:
                    logger.warning(f"[CUALoopService] Safety checks triggered: {len(pending_safety_checks)}", extra={
                        'safety_checks': [{'id': sc.id if hasattr(sc, 'id') else None, 
                                         'code': sc.code if hasattr(sc, 'code') else None} 
                                        for sc in pending_safety_checks]
                    })
                    # For now, acknowledge all safety checks automatically
                    # TODO: Implement user confirmation flow
                    acknowledged_safety_checks = [
                        {
                            'id': sc.id if hasattr(sc, 'id') else None,
                            'code': sc.code if hasattr(sc, 'code') else None,
                            'message': sc.message if hasattr(sc, 'message') else ''
                        }
                        for sc in pending_safety_checks
                    ]
                
                # Execute action
                try:
                    action_dict = action if isinstance(action, dict) else action.model_dump() if hasattr(action, 'model_dump') else {}
                    logger.info(f"[CUALoopService] Executing action: {action_dict.get('type', 'unknown')}")
                    browser.execute_action(action_dict)
                except Exception as e:
                    logger.error(f"[CUALoopService] Error executing action: {e}", exc_info=True)
                    # Continue anyway - capture screenshot of current state
                
                # Small delay to allow page to update
                time.sleep(1)
                
                # Capture screenshot
                screenshot_b64 = None
                current_url = None
                try:
                    screenshot_b64 = browser.capture_screenshot()
                    current_url = browser.get_current_url()
                    
                    # Upload screenshot to S3
                    screenshot_url = self.image_handler.upload_base64_image_to_s3(screenshot_b64, 'image/png')
                    if screenshot_url:
                        screenshot_urls.append(screenshot_url)
                        logger.info(f"[CUALoopService] Screenshot captured and uploaded: {screenshot_url}")
                    else:
                        logger.warning(f"[CUALoopService] Failed to upload screenshot")
                except Exception as e:
                    logger.error(f"[CUALoopService] Error capturing screenshot: {e}", exc_info=True)
                    # Continue loop even if screenshot fails
                
                # Build next request with screenshot (only if screenshot was captured successfully)
                if screenshot_b64:
                    next_input = [{
                        'type': 'computer_call_output',
                        'call_id': call_id,
                        'output': {
                            'type': 'input_image',
                            'image_url': f"data:image/png;base64,{screenshot_b64}"
                        }
                    }]
                    
                    # Add current_url if available
                    if current_url:
                        next_input[0]['current_url'] = current_url
                    
                    # Add acknowledged safety checks if any
                    if acknowledged_safety_checks:
                        next_input[0]['acknowledged_safety_checks'] = acknowledged_safety_checks
                        acknowledged_safety_checks = []  # Clear after acknowledging
                else:
                    # If screenshot capture failed, we can't continue the loop
                    logger.error(f"[CUALoopService] Screenshot capture failed, cannot continue CUA loop")
                    break
                
                # Build next request params
                next_params = {
                    'model': model,
                    'tools': tools,
                    'truncation': 'auto'
                }
                
                # Use previous_response_id if available (recommended)
                if previous_response_id:
                    next_params['previous_response_id'] = previous_response_id
                    next_params['input'] = next_input
                else:
                    # Fallback: include all previous output items
                    # This is more complex, so prefer previous_response_id
                    next_params['input'] = next_input
                
                # Make next API call
                logger.info(f"[CUALoopService] Sending screenshot back to model (iteration {iteration})")
                response = openai_client.make_api_call(next_params)
                previous_response_id = response.id if hasattr(response, 'id') else None
                last_call_id = call_id
            
            # Get final report text
            final_report = response.output_text if hasattr(response, 'output_text') else ""
            
            # Build usage info
            usage_info = {}
            if hasattr(response, 'usage'):
                usage = response.usage
                usage_info = {
                    'input_tokens': usage.input_tokens or 0,
                    'output_tokens': usage.output_tokens or 0,
                    'total_tokens': usage.total_tokens or 0,
                }
            
            logger.info(f"[CUALoopService] CUA loop complete", extra={
                'iterations': iteration,
                'screenshots_captured': len(screenshot_urls),
                'final_report_length': len(final_report),
                'total_tokens': usage_info.get('total_tokens', 0)
            })
            
            return final_report, screenshot_urls, usage_info
            
        except Exception as e:
            logger.error(f"[CUALoopService] Error in CUA loop: {e}", exc_info=True)
            raise
        finally:
            # Always cleanup browser
            try:
                browser.cleanup()
            except Exception as cleanup_error:
                logger.warning(f"[CUALoopService] Error during browser cleanup: {cleanup_error}")

