"""
Computer Use API (CUA) Loop Service
Handles the full CUA loop: execute actions → capture screenshots → send back to model.
"""

import logging
import time
import warnings
from typing import Tuple, List, Dict, Any, Optional

# Suppress Pydantic serialization warnings
warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')

from services.cua.environment_factory import (
    resolve_cua_environment_config,
    create_sync_controller,
)

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
        max_duration_seconds: int = 300,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
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
        from services.tools import ToolValidator
        
        logger.info(f"[CUALoopService] Starting CUA loop", extra={
            'model': model,
            'max_iterations': max_iterations,
            'max_duration_seconds': max_duration_seconds
        })
        
        # Extract computer_use_preview tool config
        computer_use_tool_present = any(
            (isinstance(t, str) and t == "computer_use_preview")
            or (isinstance(t, dict) and t.get("type") == "computer_use_preview")
            for t in tools
        )
        if not computer_use_tool_present:
            raise ValueError("computer_use_preview tool not found in tools list")

        env_config = resolve_cua_environment_config(tools)
        display_width = env_config.display_width
        display_height = env_config.display_height
        environment_name = env_config.environment
        logger.info(
            f"[CUALoopService] Using CUA environment: {environment_name}",
            extra={"display_width": display_width, "display_height": display_height},
        )
        
        # Initialize browser/controller
        browser = create_sync_controller(environment_name)
        screenshot_urls = []
        start_time = time.time()
        iteration = 0
        previous_response_id = None
        last_call_id = None
        acknowledged_safety_checks = []
        
        try:
            browser.initialize(display_width=display_width, display_height=display_height)
            
            # Navigate to a default page first to ensure browser is ready
            # This helps avoid "browser has been closed" errors
            try:
                browser.navigate("about:blank")
                logger.info("[CUALoopService] Browser initialized and ready")
            except Exception as nav_error:
                logger.warning(f"[CUALoopService] Failed to navigate to initial page: {nav_error}")
                # Continue anyway - browser might still work
            
            # Build initial request params using build_api_params to ensure proper tool cleaning
            # This ensures container parameters are removed and Decimal values are converted
            
            # Enforce "Autonomy Mode": Modify instructions to prevent asking for permission.
            enhanced_instructions = instructions
            if "do not ask for permission" not in enhanced_instructions.lower():
                enhanced_instructions += (
                    "\n\n[COMPUTER USE GUIDELINES]\n"
                    "1. AUTONOMY: You are an autonomous agent. Do NOT ask for permission to proceed. Do NOT ask 'Should I...?'\n"
                    "2. COMPLETION: Execute all necessary steps to achieve the goal fully. Only stop when the request is strictly satisfied.\n"
                    "3. IF STUCK: Try alternative paths (e.g. scroll, search, different selectors) before giving up.\n"
                    "4. UPLOADS: If the task involves uploading a screenshot, the system automatically uploads it. Use the provided URL.\n"
                )

            # Prefer the pre-built params (includes service_tier/text.format/etc) and only
            # override what the CUA loop needs (instructions/input/truncation).
            initial_params = dict(params) if isinstance(params, dict) and params else openai_client.build_api_params(
                model=model,
                instructions=enhanced_instructions,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                has_computer_use=True
            )
            initial_params["model"] = model
            initial_params["instructions"] = enhanced_instructions
            initial_params["input"] = input_text
            if "tools" not in initial_params:
                initial_params["tools"] = tools
            if tool_choice and tool_choice != "none":
                # Only set tool_choice if tools are present and non-empty
                if "tools" in initial_params and initial_params["tools"]:
                    initial_params["tool_choice"] = tool_choice
                else:
                    # If tools are missing but tool_choice is requested, we must not set it to avoid API error
                    # "Tool choice 'required' must be specified with 'tools' parameter."
                    logger.warning(
                        "[CUALoopService] Not setting tool_choice because tools list is missing or empty in params",
                        extra={"requested_tool_choice": tool_choice}
                    )
                    initial_params.pop("tool_choice", None)
            else:
                initial_params.pop("tool_choice", None)
            # Truncation parameter required for computer use
            initial_params["truncation"] = "auto"
            
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
                execution_error = None
                try:
                    import warnings
                    with warnings.catch_warnings():
                        warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
                        warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')
                        action_dict = action if isinstance(action, dict) else action.model_dump() if hasattr(action, 'model_dump') else {}
                    
                    # Log action details for debugging
                    action_type = action_dict.get('type', 'unknown')
                    logger.info(f"[CUALoopService] Executing action: {action_type}", extra={'action': action_dict})
                    
                    browser.execute_action(action_dict)
                except Exception as e:
                    logger.error(f"[CUALoopService] Error executing action: {e}", exc_info=True)
                    execution_error = str(e)
                    # Continue anyway - capture screenshot of current state
                
                # Small delay to allow page to update
                time.sleep(1)
                
                # Capture screenshot
                screenshot_b64 = None
                current_url = None
                try:
                    screenshot_b64 = browser.capture_screenshot()
                    current_url = browser.get_current_url()
                    
                    # Upload screenshot to S3 under the workflow run folder if context is available
                    screenshot_url = self.image_handler.upload_base64_image_to_s3(
                        screenshot_b64,
                        'image/png',
                        tenant_id=tenant_id,
                        job_id=job_id,
                    )
                    if screenshot_url:
                        screenshot_urls.append(screenshot_url)
                        logger.info(f"[CUALoopService] Screenshot captured and uploaded: {screenshot_url}")
                        # Print for visibility in test runner output
                        print(f"🖼️ Object URL: {screenshot_url}", flush=True)
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
                            'type': 'computer_screenshot',
                            'image_url': f"data:image/png;base64,{screenshot_b64}"
                        }
                    }]
                    
                    # Provide additional context via a standard message input item (no custom fields on tool outputs)
                    notes = []
                    if execution_error:
                        notes.append(f"Computer action failed: {execution_error}")
                    if current_url:
                        notes.append(f"Current URL: {current_url}")
                    if screenshot_url:
                        notes.append(f"Screenshot uploaded to: {screenshot_url}")
                    if notes:
                        next_input.append(
                            {
                                "type": "message",
                                "role": "system",
                                "content": [{"type": "input_text", "text": "\n".join(notes)}],
                            }
                        )
                    
                    # Add acknowledged safety checks if any
                    if acknowledged_safety_checks:
                        next_input[0]['acknowledged_safety_checks'] = acknowledged_safety_checks
                        acknowledged_safety_checks = []  # Clear after acknowledging
                else:
                    # If screenshot capture failed, we can't continue the loop
                    logger.error(f"[CUALoopService] Screenshot capture failed, cannot continue CUA loop")
                    break
                
                # Build next request params by reusing the initial params (preserves service_tier/text.format)
                # and swapping in the tool output + previous_response_id.
                next_params = dict(initial_params)
                next_params["instructions"] = enhanced_instructions
                next_params["input"] = next_input
                next_params["truncation"] = "auto"
                
                # Use previous_response_id if available (recommended)
                if previous_response_id:
                    next_params["previous_response_id"] = previous_response_id
                else:
                    next_params.pop("previous_response_id", None)
                
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

