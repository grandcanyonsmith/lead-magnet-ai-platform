import logging
import time
import warnings
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from services.cua.types import (
    LogEvent, ActionCallEvent, ScreenshotEvent, 
    LoopCompleteEvent, SafetyCheckEvent, ActionExecutedEvent, CUAEvent
)
from services.cua.environment import Environment

logger = logging.getLogger(__name__)

class CUAgent:
    """Agent for running the Computer Use API loop as a generator."""
    
    def __init__(self, environment: Environment, image_handler: Any):
        self.env = environment
        self.image_handler = image_handler

    async def run_loop(
        self,
        openai_client: Any,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict],
        tool_choice: str,
        max_iterations: int = 50,
        max_duration_seconds: int = 300,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        params: Optional[Dict] = None
    ) -> AsyncGenerator[CUAEvent, None]:
        
        start_time = time.time()
        iteration = 0
        previous_response_id = None
        screenshot_urls = []
        acknowledged_safety_checks = []
        
        # Suppress Pydantic warnings
        warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
        
        try:
            # 1. Initialize Environment
            yield LogEvent(type='log', timestamp=time.time(), level='info', message='Initializing environment...')
            # Note: initialization might be sync or async depending on implementation, 
            # but our interface is currently sync for simplicity with existing code, 
            # or we can wrap it. The existing BrowserService is sync.
            # However, for consistency with async generator, we might want to ensure non-blocking.
            # For now, we assume the environment methods are fast enough or run in thread pool if needed.
            # Re-using the existing sync pattern for now.
            
            # Find display size from tools
            display_width = 1024
            display_height = 768
            for tool in tools:
                t_type = tool.get('type') if isinstance(tool, dict) else tool
                if t_type == 'computer_use_preview' and isinstance(tool, dict):
                    display_width = int(tool.get('display_width', 1024))
                    display_height = int(tool.get('display_height', 768))
                    break

            await self.env.initialize(display_width, display_height)
            yield LogEvent(type='log', timestamp=time.time(), level='info', message='Environment ready.')

            # Check if input_text contains a URL and navigate there
            import re
            # Try to extract URL from input_text
            # Pattern 1: Full URL (http:// or https://)
            url_pattern = r'https?://[^\s<>"\'\)]+'
            url_match = re.search(url_pattern, input_text)
            initial_url = None
            
            if url_match:
                initial_url = url_match.group(0).rstrip('.,;!?)')
            else:
                # Pattern 2: Domain-like patterns (e.g., "bing.com", "go to example.com")
                domain_pattern = r'(?:go to |visit |navigate to |open )?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)'
                domain_match = re.search(domain_pattern, input_text, re.IGNORECASE)
                if domain_match:
                    domain = domain_match.group(1)
                    # Don't match common non-URL words
                    if domain and not domain.lower() in ['com', 'org', 'net', 'io', 'ai', 'the', 'and', 'for']:
                        initial_url = f"https://{domain}"
            
            # Navigate to URL if found, otherwise use default
            target_url = initial_url if initial_url else "https://www.bing.com"
            if not initial_url:
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'No URL found in input, using default: {target_url}')
            
            try:
                await self.env.execute_action({'type': 'navigate', 'url': target_url})
                # Capture screenshot after navigation
                screenshot_b64 = await self.env.capture_screenshot()
                current_url = await self.env.get_current_url()
                url = self.image_handler.upload_base64_image_to_s3(
                    screenshot_b64, 'image/jpeg', tenant_id=tenant_id, job_id=job_id
                )
                yield ScreenshotEvent(
                    type='screenshot', timestamp=time.time(),
                    url=url or '', current_url=current_url, base64=screenshot_b64
                )
                if url:
                    screenshot_urls.append(url)
            except Exception as e:
                logger.warning(f"Failed to navigate to {target_url}: {e}")
                yield LogEvent(type='log', timestamp=time.time(), level='warning', message=f'Navigation failed: {e}')

            # 2. Initial Request
            initial_params = openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                has_computer_use=True
            )
            initial_params['truncation'] = 'auto'
            if params:
                initial_params.update(params)

            # Skip initial screenshot - we'll capture after navigation instead
            # This saves time and avoids blank screenshots
            
            yield LogEvent(type='log', timestamp=time.time(), level='info', message='Sending initial request to model...')
            
            # This is sync in existing code, but we are in async def. 
            # Ideally openai_client should be async, but if it's sync, we block.
            # Assuming it's the sync client from the existing service.
            response = openai_client.make_api_call(initial_params)
            previous_response_id = getattr(response, 'id', None)

            while iteration < max_iterations:
                elapsed = time.time() - start_time
                if elapsed > max_duration_seconds:
                    yield LogEvent(type='log', timestamp=time.time(), level='warning', message='Max duration reached.')
                    yield LoopCompleteEvent(
                        type='complete', timestamp=time.time(), 
                        final_text="", screenshots=screenshot_urls, 
                        usage={}, reason='timeout'
                    )
                    return

                iteration += 1
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'Iteration {iteration}')

                # Parse response
                computer_calls = []
                if hasattr(response, 'output') and response.output:
                    for item in response.output:
                        if getattr(item, 'type', '') == 'computer_call':
                            computer_calls.append(item)
                
                if not computer_calls:
                    final_text = getattr(response, 'output_text', '')
                    usage_info = {}
                    if hasattr(response, 'usage'):
                        usage_info = {
                            'input_tokens': response.usage.input_tokens,
                            'output_tokens': response.usage.output_tokens,
                            'total_tokens': response.usage.total_tokens
                        }
                    yield LogEvent(type='log', timestamp=time.time(), level='info', message='Task completed by model.')
                    yield LoopCompleteEvent(
                        type='complete', timestamp=time.time(),
                        final_text=final_text, screenshots=screenshot_urls,
                        usage=usage_info, reason='completed'
                    )
                    return

                # Process first call
                call = computer_calls[0]
                call_id = getattr(call, 'call_id', None)
                action = getattr(call, 'action', {})
                # Convert action to dict if it's a model
                if hasattr(action, 'model_dump'):
                    action = action.model_dump()
                elif not isinstance(action, dict):
                     # fallback
                     action = {}
                
                # Check safety checks
                pending_checks = getattr(call, 'pending_safety_checks', [])
                if pending_checks:
                    checks_data = [{'code': getattr(c, 'code', ''), 'message': getattr(c, 'message', ''), 'id': getattr(c, 'id', '')} for c in pending_checks]
                    yield SafetyCheckEvent(
                        type='safety_check', timestamp=time.time(),
                        checks=checks_data, action_call_id=call_id, action=action
                    )
                    # For now, auto-acknowledge (per plan "Auto-approve mode" initially)
                    # Ideally we yield and wait for user input, but that requires bidirectional stream or breaking the loop.
                    # We'll just log and proceed for this iteration.
                    yield LogEvent(type='log', timestamp=time.time(), level='warning', message='Auto-acknowledging safety checks...')
                    acknowledged_safety_checks = checks_data

                yield ActionCallEvent(
                    type='action_call', timestamp=time.time(),
                    call_id=call_id, action=action
                )

                # Execute
                try:
                    await self.env.execute_action(action)
                    yield ActionExecutedEvent(
                        type='action_executed', timestamp=time.time(),
                        action_type=action.get('type', 'unknown'), success=True
                    )
                except Exception as e:
                    logger.error(f"Action failed: {e}")
                    yield ActionExecutedEvent(
                        type='action_executed', timestamp=time.time(),
                        action_type=action.get('type', 'unknown'), success=False, error=str(e)
                    )
                    # We continue to take screenshot even if action failed
                
                # Screenshot
                try:
                    screenshot_b64 = await self.env.capture_screenshot()
                    current_url = await self.env.get_current_url()
                    
                    # Upload (using jpeg for faster uploads)
                    url = self.image_handler.upload_base64_image_to_s3(
                        screenshot_b64, 'image/jpeg', tenant_id=tenant_id, job_id=job_id
                    )
                    
                    # Always include base64 for local dev fallback, even if URL exists
                    screenshot_event = ScreenshotEvent(
                        type='screenshot', timestamp=time.time(),
                        url=url or '', current_url=current_url, base64=screenshot_b64
                    )
                    yield screenshot_event
                    
                    if url:
                        screenshot_urls.append(url)
                    
                    # Prepare next input
                    next_input = [{
                        'type': 'computer_call_output',
                        'call_id': call_id,
                        'output': {
                            'type': 'input_image',
                            'image_url': f"data:image/png;base64,{screenshot_b64}"
                        }
                    }]
                    if current_url:
                        next_input[0]['current_url'] = current_url
                    
                    if acknowledged_safety_checks:
                        next_input[0]['acknowledged_safety_checks'] = acknowledged_safety_checks
                        acknowledged_safety_checks = []

                    # Next API Call
                    next_params = openai_client.build_api_params(
                        model=model,
                        instructions=instructions,
                        input_text='',
                        tools=tools,
                        tool_choice=tool_choice,
                        has_computer_use=True
                    )
                    next_params['truncation'] = 'auto'
                    if previous_response_id:
                        next_params['previous_response_id'] = previous_response_id
                        next_params['input'] = next_input
                    else:
                        next_params['input'] = next_input
                    
                    yield LogEvent(type='log', timestamp=time.time(), level='info', message='Sending feedback to model...')
                    response = openai_client.make_api_call(next_params)
                    previous_response_id = getattr(response, 'id', None)

                except Exception as e:
                    logger.error(f"Error in loop: {e}", exc_info=True)
                    yield LogEvent(type='log', timestamp=time.time(), level='error', message=f'Error: {str(e)}')
                    yield LoopCompleteEvent(
                        type='complete', timestamp=time.time(),
                        final_text="", screenshots=screenshot_urls, usage={}, reason='error'
                    )
                    break
        
        finally:
            try:
                await self.env.cleanup()
            except Exception:
                pass

