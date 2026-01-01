import logging
import time
import json
import warnings
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from services.cua.types import (
    LogEvent, ActionCallEvent, ScreenshotEvent, 
    LoopCompleteEvent, SafetyCheckEvent, ActionExecutedEvent, CUAEvent
)
from services.cua.environment import Environment
from services.shell_executor_service import ShellExecutorService

logger = logging.getLogger(__name__)

def _get_attr_or_key(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)

def _to_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            # If it's a simple string that isn't JSON, wrap it (defensive)
            # But for function args, it should be JSON.
            return {}
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return {}

class CUAgent:
    """Agent for running the Computer Use API loop as a generator."""
    
    def __init__(self, environment: Environment, image_handler: Any):
        self.env = environment
        self.image_handler = image_handler
        self.shell_executor = ShellExecutorService()

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
        recent_actions = []  # Track recent actions to detect loops
        max_recent_actions = 5  # Keep last 5 actions for loop detection
        
        # Suppress Pydantic warnings
        warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')

        # ------------------------------------------------------------------
        # Tool guidance: when both Computer Use and Shell are enabled, strongly
        # steer the model to call the backend shell tool instead of looking for
        # a terminal UI in the browser.
        # ------------------------------------------------------------------
        instructions_for_model = instructions or ""
        has_computer_use_tool = any(
            (t == "computer_use_preview")
            or (isinstance(t, dict) and t.get("type") == "computer_use_preview")
            for t in (tools or [])
        )
        has_shell_tool = any(
            (t == "shell") or (isinstance(t, dict) and t.get("type") == "shell")
            for t in (tools or [])
        )
        if has_computer_use_tool and has_shell_tool:
            hint = (
                "TOOL ORDER: If a subtask can be solved via command-line/network inspection "
                "(e.g. ping, dig, nslookup, whois, curl), prefer starting with "
                "`execute_shell_command` to gather facts first, then use `computer_use_preview` "
                "to browse/verify visually.\n"
                "CLOUD PROVIDER TASKS: To identify a site's cloud/DNS provider, first run:\n"
                "- dig +short NS <domain>\n"
                "- dig +short A <domain>\n"
                "- whois <ip>\n"
                "Then infer provider from NS/WHOIS (e.g. any NS contains 'cloudflare.com' => Cloudflare) "
                "and navigate to the provider's homepage (e.g. https://cloudflare.com).\n"
                "WEB NAVIGATION: When you need to open a new website, use a computer action of type "
                "`navigate` with a full URL (e.g. https://cloudflare.com). This is more reliable than "
                "clicking the address bar/search box. Avoid repeating clicks if the page doesn't change.\n"
                "IMPORTANT: When you need to run shell/terminal commands, call "
                "`execute_shell_command` to run commands directly on the backend server. "
                "Do NOT try to open or click a terminal inside the browser UI. "
                "Call it with JSON like: {\"commands\": [\"ping -c 1 coursecreator360.com\", \"ls -la\"]}."
            )
            if hint not in instructions_for_model:
                instructions_for_model = (instructions_for_model or "").rstrip()
                instructions_for_model = (
                    f"{instructions_for_model}\n\n{hint}"
                    if instructions_for_model
                    else hint
                )

            # #region agent log
            try:
                with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({
                        "sessionId": "debug-session",
                        "runId": "repro-6",
                        "hypothesisId": "instructions-injection",
                        "location": "agent.py:run_loop",
                        "timestamp": int(time.time() * 1000),
                        "message": "Appended shell tool guidance to instructions",
                        "data": {
                            "has_computer_use_tool": True,
                            "has_shell_tool": True,
                            "instructions_length": len(instructions_for_model),
                        },
                    }) + '\n')
            except Exception:
                pass
            # #endregion
        
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

            # Check if instructions/input_text contain a URL and navigate there
            import re
            url_search_text = f"{instructions or ''}\n{input_text or ''}".strip()
            # Try to extract URL from task text
            # Pattern 1: Full URL (http:// or https://)
            url_pattern = r'https?://[^\s<>"\'\)]+'
            url_match = re.search(url_pattern, url_search_text)
            initial_url = None
            
            if url_match:
                initial_url = url_match.group(0).rstrip('.,;!?)')
            else:
                # Pattern 2: Domain-like patterns (e.g., "bing.com", "go to example.com")
                domain_pattern = r'(?:go to |visit |navigate to |open )?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)'
                domain_match = re.search(domain_pattern, url_search_text, re.IGNORECASE)
                if domain_match:
                    domain = domain_match.group(1)
                    # Don't match common non-URL words
                    if domain and not domain.lower() in ['com', 'org', 'net', 'io', 'ai', 'the', 'and', 'for']:
                        initial_url = f"https://{domain}"
            
            # Navigate to URL if found, otherwise use default
            target_url = initial_url if initial_url else "https://www.bing.com"
            initial_screenshot_b64_for_model: Optional[str] = None
            initial_current_url_for_model: Optional[str] = None
            if initial_url:
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'Detected URL in task: {target_url}')
            else:
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'No URL found in instructions/input, using default: {target_url}')
            
            try:
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'🌐 Navigate to: {target_url}')
                await self.env.execute_action({'type': 'navigate', 'url': target_url})
                # Capture screenshot after navigation
                screenshot_b64 = await self.env.capture_screenshot()
                current_url = await self.env.get_current_url()
                initial_screenshot_b64_for_model = screenshot_b64
                initial_current_url_for_model = current_url
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
                instructions=instructions_for_model,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                has_computer_use=True
            )
            initial_params['truncation'] = 'auto'
            if params:
                initial_params.update(params)

            # Include initial screenshot in the FIRST request so the model doesn't waste an iteration asking for it.
            if initial_screenshot_b64_for_model:
                user_text = (input_text or "").strip() or "Start the task."
                if initial_current_url_for_model:
                    user_text = f"{user_text}\n\n(Current URL: {initial_current_url_for_model})"
                initial_params["input"] = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": user_text},
                            {
                                "type": "input_image",
                                "image_url": f"data:image/jpeg;base64,{initial_screenshot_b64_for_model}",
                            },
                        ],
                    }
                ]
            
            yield LogEvent(type='log', timestamp=time.time(), level='info', message='Sending initial request to model...')
            if instructions:
                preview = (instructions or "").strip()
                if len(preview) > 240:
                    preview = preview[:240] + "..."
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'📋 Instructions: {preview}')
            if input_text:
                yield LogEvent(type='log', timestamp=time.time(), level='info', 
                             message=f'📋 Task: {input_text}')
            
            # This is sync in existing code, but we are in async def. 
            # Ideally openai_client should be async, but if it's sync, we block.
            # Assuming it's the sync client from the existing service.
            try:
                response = openai_client.make_api_call(initial_params)
                previous_response_id = getattr(response, 'id', None)
            except Exception as e:
                error_msg = str(e)
                yield LogEvent(type='log', timestamp=time.time(), level='error', 
                             message=f'❌ API Error: {error_msg}')
                yield LoopCompleteEvent(
                    type='complete', timestamp=time.time(),
                    final_text="", screenshots=screenshot_urls, usage={}, reason='error'
                )
                raise
            
            # Log initial reasoning/text if present
            if hasattr(response, 'output') and response.output:
                for item in response.output:
                    item_type = getattr(item, 'type', '')
                    if item_type == 'reasoning':
                        summary = getattr(item, 'summary', [])
                        for s in summary:
                            if hasattr(s, 'text'):
                                reasoning_text = getattr(s, 'text', '')
                                if reasoning_text:
                                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                                 message=f'💭 {reasoning_text}')
                            elif isinstance(s, dict) and 'text' in s:
                                yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                             message=f'💭 {s.get("text", "")}')
                    elif item_type == 'message':
                        # Some models return assistant narration as a "message" item with content parts.
                        # We surface any output_text/text parts as normal log lines for visibility.
                        content = getattr(item, 'content', None)
                        if isinstance(content, list):
                            for c in content:
                                c_type = _get_attr_or_key(c, 'type')
                                if str(c_type) in ('output_text', 'text'):
                                    txt = _get_attr_or_key(c, 'text') or ''
                                    if txt:
                                        yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'📝 {txt}')
                    elif item_type == 'text' or item_type == 'output_text':
                        text_content = getattr(item, 'text', '') or getattr(item, 'content', '')
                        if text_content:
                            yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                         message=f'📝 {text_content}')

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

                # Parse response - log reasoning and text content
                computer_calls = []
                shell_calls = []
                reasoning_items = []
                text_outputs = []
                
                if hasattr(response, 'output') and response.output:
                    # #region agent log
                    try:
                        import json
                        # Log shell call detection
                        with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                            f.write(json.dumps({
                                "sessionId": "debug-session",
                                "runId": "repro-5",
                                "hypothesisId": "debug-shell-execution",
                                "location": "agent.py:run_loop",
                                "timestamp": int(time.time() * 1000),
                                "message": "Analyzing response output",
                                "data": {
                                    "output_items_count": len(response.output),
                                    "item_types": [str(getattr(i, 'type', 'unknown')) for i in response.output]
                                }
                            }) + '\n')
                    except Exception:
                        pass
                    # #endregion

                    # #region agent-message-items
                    try:
                        message_items = []
                        for i in response.output:
                            if str(getattr(i, "type", "")) != "message":
                                continue
                            role = getattr(i, "role", None)
                            content = getattr(i, "content", None)
                            content_types = []
                            text_previews = []

                            if isinstance(content, list):
                                for c in content:
                                    c_type = _get_attr_or_key(c, "type")
                                    if c_type:
                                        content_types.append(str(c_type))
                                    if str(c_type) in ("output_text", "text"):
                                        txt = _get_attr_or_key(c, "text") or ""
                                        if txt:
                                            text_previews.append(str(txt)[:160])
                            message_items.append(
                                {
                                    "role": role,
                                    "content_types": content_types[:8],
                                    "text_previews": text_previews[:2],
                                }
                            )

                        with open("/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log", "a") as f:
                            f.write(
                                json.dumps(
                                    {
                                        "sessionId": "debug-session",
                                        "runId": "pre-fix",
                                        "hypothesisId": "H5-message-items-dropped",
                                        "location": "agent.py:run_loop",
                                        "timestamp": int(time.time() * 1000),
                                        "message": "Response output message items (if any)",
                                        "data": {
                                            "message_items_count": len(message_items),
                                            "message_items": message_items[:3],
                                        },
                                    }
                                )
                                + "\n"
                            )
                    except Exception:
                        pass
                    # #endregion

                    for item in response.output:
                        item_type = getattr(item, 'type', '')
                        if item_type == 'computer_call':
                            computer_calls.append(item)
                        elif item_type == 'shell_call':
                            shell_calls.append(item)
                        elif item_type == 'tool_call':
                            tool_name = _get_attr_or_key(item, 'tool_name')
                            # Fallback for standard function calls where name is in 'function' object
                            if not tool_name:
                                func = _get_attr_or_key(item, 'function')
                                if func:
                                    tool_name = _get_attr_or_key(func, 'name')
                            
                            if tool_name in ('shell', 'execute_shell_command'):
                                shell_calls.append(item)
                        elif item_type == 'function_call':
                            fn_name = _get_attr_or_key(item, 'name')
                            if not fn_name:
                                func = _get_attr_or_key(item, 'function')
                                if func:
                                    fn_name = _get_attr_or_key(func, 'name')
                            if fn_name in ('shell', 'execute_shell_command'):
                                shell_calls.append(item)
                        elif item_type == 'reasoning':
                            # Extract reasoning summary
                            summary = getattr(item, 'summary', [])
                            # #region agent-reasoning-shape
                            try:
                                with open("/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log", "a") as f:
                                    f.write(
                                        json.dumps(
                                            {
                                                "sessionId": "debug-session",
                                                "runId": "pre-fix",
                                                "hypothesisId": "H4-reasoning-not-visible",
                                                "location": "agent.py:run_loop",
                                                "timestamp": int(time.time() * 1000),
                                                "message": "Reasoning item summary shape",
                                                "data": {
                                                    "summary_is_none": summary is None,
                                                    "summary_type": type(summary).__name__,
                                                    "summary_len": (len(summary) if isinstance(summary, list) else None),
                                                    "summary_entry_types": (
                                                        [type(s).__name__ for s in (summary[:3] if isinstance(summary, list) else [])]
                                                    ),
                                                },
                                            }
                                        )
                                        + "\n"
                                    )
                            except Exception:
                                pass
                            # #endregion
                            if summary:
                                for s in summary:
                                    if hasattr(s, 'text'):
                                        reasoning_text = getattr(s, 'text', '')
                                        if reasoning_text:
                                            reasoning_items.append(reasoning_text)
                                    elif isinstance(s, dict) and 'text' in s:
                                        reasoning_items.append(s.get('text', ''))
                        elif item_type == 'message':
                            # Capture assistant narration in "message" items (most common shape: content=[{type:"output_text", text:"..."}])
                            content = getattr(item, 'content', None)
                            if isinstance(content, list):
                                for c in content:
                                    c_type = _get_attr_or_key(c, 'type')
                                    if str(c_type) in ('output_text', 'text'):
                                        txt = _get_attr_or_key(c, 'text') or ''
                                        if txt:
                                            text_outputs.append(str(txt))
                        elif item_type == 'text' or item_type == 'output_text':
                            text_content = getattr(item, 'text', '') or getattr(item, 'content', '')
                            if text_content:
                                text_outputs.append(text_content)
                
                # Log reasoning items
                for reasoning_text in reasoning_items:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'💭 {reasoning_text}')
                
                # Log text outputs
                for text_content in text_outputs:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'📝 {text_content}')
                
                if not computer_calls and not shell_calls:
                    final_text = getattr(response, 'output_text', '') or ' '.join(text_outputs)
                    usage_info = {}
                    if hasattr(response, 'usage'):
                        usage_info = {
                            'input_tokens': response.usage.input_tokens,
                            'output_tokens': response.usage.output_tokens,
                            'total_tokens': response.usage.total_tokens
                        }
                    if final_text:
                        yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                     message=f'✅ Task completed: {final_text}')
                    else:
                        yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                     message='✅ Task completed by model.')
                    yield LoopCompleteEvent(
                        type='complete', timestamp=time.time(),
                        final_text=final_text, screenshots=screenshot_urls,
                        usage=usage_info, reason='completed'
                    )
                    return

                # Prepare list for next inputs (accumulate outputs from all tools)
                next_input = []
                
                # --- Handle Computer Use ---
                if computer_calls:
                    # Process first call (usually only one computer call per turn supported currently)
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
                        yield LogEvent(type='log', timestamp=time.time(), level='warning', message='Auto-acknowledging safety checks...')
                        acknowledged_safety_checks = checks_data

                    # Log action details before execution
                    action_type = action.get('type', 'unknown')
                    # #region agent-move-action
                    try:
                        with open("/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log", "a") as f:
                            f.write(
                                json.dumps(
                                    {
                                        "sessionId": "debug-session",
                                        "runId": "pre-fix",
                                        "hypothesisId": "H1-move-unsupported",
                                        "location": "agent.py:run_loop",
                                        "timestamp": int(time.time() * 1000),
                                        "message": "Computer call action received",
                                        "data": {
                                            "iteration": iteration,
                                            "call_id": call_id,
                                            "action_type": action_type,
                                            "x": action.get("x"),
                                            "y": action.get("y"),
                                            "url": action.get("url"),
                                            "keys": action.get("keys") or action.get("key"),
                                        },
                                    }
                                )
                                + "\n"
                            )
                    except Exception:
                        pass
                    # #endregion
                    action_details = []
                    
                    if action_type == 'click':
                        x = action.get('x', '?')
                        y = action.get('y', '?')
                        button = action.get('button', 'left')
                        action_details.append(f"🖱️ Click at ({x}, {y}) with {button} button")
                    elif action_type == 'type':
                        text = action.get('text', '')
                        action_details.append(f"⌨️ Type: {text[:100]}{'...' if len(text) > 100 else ''}")
                    elif action_type == 'scroll':
                        scroll_x = action.get('scroll_x', action.get('delta_x', 0))
                        scroll_y = action.get('scroll_y', action.get('delta_y', 0))
                        x = action.get('x', '?')
                        y = action.get('y', '?')
                        action_details.append(f"📜 Scroll at ({x}, {y}): x={scroll_x}, y={scroll_y}")
                    elif action_type == 'keypress':
                        keys = action.get('keys', [])
                        key = action.get('key', '')
                        if keys:
                            action_details.append(f"⌨️ Keypress: {', '.join(str(k) for k in keys)}")
                        elif key:
                            action_details.append(f"⌨️ Keypress: {key}")
                    elif action_type == 'wait':
                        duration_ms = action.get('duration_ms', 1000)
                        action_details.append(f"⏳ Wait: {duration_ms}ms")
                    elif action_type == 'navigate':
                        url = action.get('url', '')
                        action_details.append(f"🌐 Navigate to: {url}")
                    else:
                        action_details.append(f"🔧 Action: {action_type} - {str(action)[:200]}")
                    
                    for detail in action_details:
                        yield LogEvent(type='log', timestamp=time.time(), level='info', message=detail)
                    
                    yield ActionCallEvent(
                        type='action_call', timestamp=time.time(),
                        call_id=call_id, action=action
                    )

                    # Execute Computer Action
                    try:
                        await self.env.execute_action(action)
                        yield ActionExecutedEvent(
                            type='action_executed', timestamp=time.time(),
                            action_type=action_type, success=True
                        )
                        yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                    message=f'✅ Action executed successfully: {action_type}')
                        
                        # Track action for loop detection (include action-specific details so we don't
                        # false-positive on diverse keypresses, etc.)
                        if action_type == "keypress":
                            keys = action.get("keys")
                            key = action.get("key")
                            if isinstance(keys, list) and keys:
                                key_sig = ",".join(str(k) for k in keys)[:80]
                            else:
                                key_sig = str(key or "")[:80]
                            action_signature = f"keypress:{key_sig}"
                        elif action_type == "click":
                            action_signature = (
                                f"click:{action.get('x', '')}:{action.get('y', '')}:{action.get('button', '')}"
                            )
                        elif action_type == "scroll":
                            sx = action.get("scroll_x", action.get("delta_x", 0))
                            sy = action.get("scroll_y", action.get("delta_y", 0))
                            action_signature = (
                                f"scroll:{action.get('x', '')}:{action.get('y', '')}:{sx}:{sy}"
                            )
                        elif action_type == "type":
                            action_signature = f"type:{str(action.get('text', ''))[:80]}"
                        elif action_type == "wait":
                            action_signature = f"wait:{action.get('duration_ms', '')}"
                        elif action_type == "navigate":
                            action_signature = f"navigate:{str(action.get('url', ''))[:120]}"
                        else:
                            action_signature = f"{action_type}:{str(action)[:120]}"
                        recent_actions.append(action_signature)
                        if len(recent_actions) > max_recent_actions:
                            recent_actions.pop(0)
                        
                        # Check for loops: if same action repeated 3+ times in recent history
                        if len(recent_actions) >= 3:
                            if recent_actions[-1] == recent_actions[-2] == recent_actions[-3]:
                                # #region agent log
                                try:
                                    with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                                        f.write(json.dumps({
                                            "sessionId": "debug-session",
                                            "runId": "repro-7",
                                            "hypothesisId": "loop-detection",
                                            "location": "agent.py:run_loop",
                                            "timestamp": int(time.time() * 1000),
                                            "message": "Detected repetitive action loop",
                                            "data": {
                                                "action_type": action_type,
                                                "action_signature": action_signature,
                                                "recent_actions": recent_actions[-5:],
                                            },
                                        }) + '\n')
                                except Exception:
                                    pass
                                # #endregion
                                yield LogEvent(type='log', timestamp=time.time(), level='warning', 
                                            message=f'⚠️ Detected repetitive action loop. Stopping to prevent infinite loop.')
                                yield LoopCompleteEvent(
                                    type='complete', timestamp=time.time(),
                                    final_text="", screenshots=screenshot_urls, 
                                    usage={}, reason='loop_detected'
                                )
                                return
                        
                        # Wait after action to let page update (longer for certain actions)
                        wait_time = 1000  # Default 1 second
                        if action_type in ['click', 'type', 'keypress']:
                            wait_time = 1500  # 1.5 seconds for interactive actions
                        elif action_type == 'navigate':
                            wait_time = 2000  # 2 seconds after navigation
                        elif action_type == 'scroll':
                            wait_time = 800  # 0.8 seconds for scroll
                        elif action_type == 'screenshot':
                            wait_time = 0  # no-op action; don't delay
                        
                        await asyncio.sleep(wait_time / 1000.0)
                        
                    except Exception as e:
                        logger.error(f"Action failed: {e}")
                        yield ActionExecutedEvent(
                            type='action_executed', timestamp=time.time(),
                            action_type=action_type, success=False, error=str(e)
                        )
                        yield LogEvent(type='log', timestamp=time.time(), level='error', 
                                    message=f'❌ Action failed: {action_type} - {str(e)}')
                        # We continue to take screenshot even if action failed
                        await asyncio.sleep(500 / 1000.0)  # Short wait even on error
                    
                    # Capture Screenshot after computer action
                    try:
                        screenshot_b64 = await self.env.capture_screenshot()
                        current_url = await self.env.get_current_url()
                        
                        # Upload (using jpeg for faster uploads)
                        url = self.image_handler.upload_base64_image_to_s3(
                            screenshot_b64, 'image/jpeg', tenant_id=tenant_id, job_id=job_id
                        )
                        
                        screenshot_event = ScreenshotEvent(
                            type='screenshot', timestamp=time.time(),
                            url=url or '', current_url=current_url, base64=screenshot_b64
                        )
                        yield screenshot_event
                        
                        if url:
                            screenshot_urls.append(url)
                        
                        # Add computer output to next_input
                        computer_output_item = {
                            'type': 'computer_call_output',
                            'call_id': call_id,
                            'output': {
                                'type': 'input_image',
                                'image_url': f"data:image/jpeg;base64,{screenshot_b64}"
                            }
                        }
                        if current_url:
                            computer_output_item['current_url'] = current_url
                        
                        if acknowledged_safety_checks:
                            computer_output_item['acknowledged_safety_checks'] = acknowledged_safety_checks
                            acknowledged_safety_checks = []

                        next_input.append(computer_output_item)

                    except Exception as e:
                         logger.error(f"Screenshot failed: {e}")
                         yield LogEvent(type='log', timestamp=time.time(), level='error', message=f'Screenshot failed: {e}')

                # --- Handle Shell Calls ---
                if shell_calls:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'Processing {len(shell_calls)} shell commands...')
                    
                    # Use job_id to seed a consistent workspace ID for this session if not provided
                    # In local dev, workspace_id is usually directory based or ignored.
                    # We'll use the job_id as the workspace identifier
                    workspace_id = job_id or f"temp_{int(time.time())}"
                    
                    for call in shell_calls:
                        call_type = _get_attr_or_key(call, "type")
                        call_id = _get_attr_or_key(call, "call_id") or _get_attr_or_key(call, "id")
                        if not call_id:
                            yield LogEvent(
                                type='log',
                                timestamp=time.time(),
                                level='error',
                                message='❌ Shell tool call missing call_id; cannot execute.',
                            )
                            continue
                        # Handle both 'action' (custom) and 'function' (standard) structures
                        action = _get_attr_or_key(call, "action") or _get_attr_or_key(call, "arguments")
                        if not action:
                             func = _get_attr_or_key(call, 'function')
                             if func:
                                 # Standard function call has 'arguments' inside 'function' object
                                 action = _get_attr_or_key(func, 'arguments')
                        
                        action_dict = _to_dict(action)
                        
                        commands = action_dict.get("commands") or []
                        
                        # #region agent log
                        try:
                            import json
                            with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                                f.write(json.dumps({
                                    "sessionId": "debug-session",
                                    "runId": "repro-5",
                                    "hypothesisId": "debug-shell-args",
                                    "location": "agent.py:run_loop",
                                    "timestamp": int(time.time() * 1000),
                                    "message": "Extracted shell args",
                                    "data": {
                                        "commands": commands,
                                        "commands_type": str(type(commands)),
                                        "action_raw": str(action)[:200]
                                    }
                                }) + '\n')
                        except Exception:
                            pass
                        # #endregion

                        timeout_ms = action_dict.get("timeout_ms")
                        max_output_length = action_dict.get("max_output_length")
                        
                        if not isinstance(commands, list):
                            commands = [str(commands)] if commands else []
                        
                        if not commands:
                            if call_type == "function_call":
                                next_input.append({
                                    "type": "function_call_output",
                                    "call_id": call_id,
                                    "output": json.dumps({
                                        "error": "No commands provided",
                                        "output": [],
                                    }),
                                })
                            else:
                                next_input.append({
                                    "type": "shell_call_output",
                                    "call_id": call_id,
                                    "output": [{
                                        "stdout": "", 
                                        "stderr": "No commands provided", 
                                        "outcome": {"type": "exit", "exit_code": 1}
                                    }]
                                })
                            continue
                            
                        # Log commands
                        for cmd in commands:
                            yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                         message=f'💻 Shell: {cmd}')
                        
                        # Execute
                        try:
                            result = self.shell_executor.run_shell_job(
                                commands=commands,
                                timeout_ms=timeout_ms or 120000,
                                max_output_length=max_output_length or 4096,
                                workspace_id=workspace_id,
                                reset_workspace=False # Persist workspace between calls in same loop
                            )
                            
                            # Log output (truncated)
                            output_list = result.get('output', [])
                            for out_item in output_list:
                                stdout = out_item.get('stdout', '')
                                stderr = out_item.get('stderr', '')
                                if stdout.strip():
                                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                                 message=f'📤 Stdout: {stdout[:200]}{"..." if len(stdout)>200 else ""}')
                                if stderr.strip():
                                    yield LogEvent(type='log', timestamp=time.time(), level='warning', 
                                                 message=f'⚠️ Stderr: {stderr[:200]}{"..." if len(stderr)>200 else ""}')
                                
                            next_input.append({
                                "type": "function_call_output" if call_type == "function_call" else "shell_call_output",
                                "call_id": call_id,
                                **(
                                    {"output": json.dumps({
                                        "commands": commands,
                                        "output": output_list,
                                        "max_output_length": result.get("max_output_length"),
                                    })}
                                    if call_type == "function_call"
                                    else {"max_output_length": result.get("max_output_length"), "output": output_list}
                                ),
                            })
                            
                        except Exception as e:
                            logger.error(f"Shell execution failed: {e}")
                            yield LogEvent(type='log', timestamp=time.time(), level='error', 
                                         message=f'❌ Shell execution error: {e}')
                            if call_type == "function_call":
                                next_input.append({
                                    "type": "function_call_output",
                                    "call_id": call_id,
                                    "output": json.dumps({
                                        "error": str(e),
                                        "output": [],
                                    }),
                                })
                            else:
                                next_input.append({
                                    "type": "shell_call_output",
                                    "call_id": call_id,
                                    "output": [{
                                        "stdout": "", 
                                        "stderr": str(e), 
                                        "outcome": {"type": "error", "message": str(e)}
                                    }]
                                })

                # If we had tools to process, send result back to model
                if next_input:
                    # Next API Call
                    next_params = openai_client.build_api_params(
                        model=model,
                        instructions=instructions_for_model,
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
                    try:
                        response = openai_client.make_api_call(next_params)
                        previous_response_id = getattr(response, 'id', None)
                    except Exception as e:
                        error_msg = str(e)
                        yield LogEvent(type='log', timestamp=time.time(), level='error', 
                                     message=f'❌ API Error: {error_msg}')
                        yield LoopCompleteEvent(
                            type='complete', timestamp=time.time(),
                            final_text="", screenshots=screenshot_urls, usage={}, reason='error'
                        )
                        raise
                else:
                    # No tools used, but loop didn't return above?
                    # This happens if response has no computer calls AND no shell calls AND no text (rare)
                    yield LogEvent(type='log', timestamp=time.time(), level='warning', 
                                 message='Model returned no actions or text. Retrying...')
                    # Add a user prompt to nudge? Or just break?
                    # For now, let's break to avoid infinite loops of nothingness
                    yield LoopCompleteEvent(
                        type='complete', timestamp=time.time(),
                        final_text="Model returned empty response.", screenshots=screenshot_urls, 
                        usage={}, reason='empty_response'
                    )
                    break
        
        finally:
            try:
                await self.env.cleanup()
            except Exception:
                pass