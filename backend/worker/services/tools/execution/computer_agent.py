import logging
import time
import json
import warnings
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator

from services.cua.types import (
    LogEvent, LoopCompleteEvent, CUAEvent, ScreenshotEvent
)
from services.cua.environment import Environment
from services.shell_executor_service import ShellExecutorService
from services.tools import ToolBuilder
from core.prompts import COMPUTER_AGENT_TOOL_GUIDANCE

from .agent_utils import (
    supports_responses_api, 
    get_responses_client, is_incomplete_openai_stream_error
)
from .response_parser import ResponseParser
from .action_executor import ActionExecutor
from .agent_loop_handler import AgentLoopHandler
from .stream_handler import StreamHandler

logger = logging.getLogger(__name__)

class CUAgent:
    """Agent for running the Computer Use API loop as a generator."""
    
    def __init__(self, environment: Environment, image_handler: Any):
        self.env = environment
        self.image_handler = image_handler
        self.shell_executor = ShellExecutorService()
        self.response_parser = ResponseParser()
        self.action_executor = ActionExecutor(environment, image_handler, self.shell_executor)
        self.loop_handler = AgentLoopHandler(environment, image_handler)
        self.stream_handler = None

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
        params: Optional[Dict] = None,
        shell_env_overrides: Optional[Dict[str, str]] = None,
    ) -> AsyncGenerator[CUAEvent, None]:
        
        self.stream_handler = StreamHandler(openai_client)
        start_time = time.time()
        iteration = 0
        previous_response_id = None
        screenshot_urls = []
        recent_actions = []  # Track recent actions to detect loops
        max_recent_actions = 15  # Keep last 15 actions for loop detection
        
        # Suppress Pydantic warnings
        warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')

        # Tool detection
        has_computer_use_tool = any(
            (t == "computer_use_preview")
            or (isinstance(t, dict) and t.get("type") == "computer_use_preview")
            for t in (tools or [])
        )
        has_shell_tool = any(
            (t == "shell") or (isinstance(t, dict) and t.get("type") == "shell")
            for t in (tools or [])
        )
        has_code_interpreter_tool = any(
            (t == "code_interpreter")
            or (isinstance(t, dict) and t.get("type") == "code_interpreter")
            for t in (tools or [])
        )

        # Prepare instructions
        instructions_for_model = self.loop_handler.prepare_instructions(
            instructions, has_computer_use_tool, has_shell_tool
        )

        if has_code_interpreter_tool and has_computer_use_tool:
            openai_container_label = (
                "OpenAI container: not used (code_interpreter incompatible with computer_use_preview)"
            )
        elif has_code_interpreter_tool:
            openai_container_label = (
                f"OpenAI container: code_interpreter ({ToolBuilder.DEFAULT_CODE_INTERPRETER_MEMORY_LIMIT} enforced)"
            )
        else:
            openai_container_label = "OpenAI container: not used"

        yield LogEvent(
            type='log', timestamp=time.time(), level='info',
            message=f"Runtime context: {openai_container_label}",
        )
        yield LogEvent(
            type='log', timestamp=time.time(), level='info',
            message=(
                "CUA runtime: "
                f"max_iterations={max_iterations}, "
                f"max_duration_seconds={max_duration_seconds}"
            ),
        )
        
        try:
            # 1. Initialize Environment
            yield LogEvent(type='log', timestamp=time.time(), level='info', message='Initializing environment...')
            await self.loop_handler.initialize_environment(tools)
            yield LogEvent(type='log', timestamp=time.time(), level='info', message='Environment ready.')

            if not supports_responses_api(openai_client):
                yield LogEvent(
                    type='log', timestamp=time.time(), level='error',
                    message=(
                        "❌ OpenAI SDK missing Responses API; update worker dependency "
                        "(openai>=2.7.2) to run shell/computer_use tools."
                    ),
                )
                yield LoopCompleteEvent(
                    type='complete', timestamp=time.time(),
                    final_text="", screenshots=screenshot_urls,
                    usage={}, reason='error',
                )
                return

            # Initial Navigation
            target_url, initial_nav_error = await self.loop_handler.perform_initial_navigation(instructions, input_text)
            if target_url:
                if initial_nav_error:
                    yield LogEvent(type='log', timestamp=time.time(), level='warning', message=f'Navigation failed: {initial_nav_error}')
                else:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'🌐 Navigate to: {target_url}')

            # Capture Initial Screenshot
            screenshot_b64, current_url, s3_url = await self.loop_handler.capture_initial_screenshot(tenant_id, job_id)
            if s3_url:
                screenshot_urls.append(s3_url)
                yield ScreenshotEvent(
                    type='screenshot', timestamp=time.time(),
                    url=s3_url, current_url=current_url or '', base64=screenshot_b64 or ''
                )

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
                allowed_params = {
                    "temperature", "top_p", "max_tokens", "frequency_penalty", 
                    "presence_penalty", "stop", "logit_bias", "seed", "user", 
                    "response_format", "service_tier", "reasoning_effort"
                }
                filtered_params = {k: v for k, v in params.items() if k in allowed_params}
                if filtered_params:
                    initial_params.update(filtered_params)
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'Applied API params: {list(filtered_params.keys())}')

            if screenshot_b64:
                user_text = self.loop_handler.build_initial_user_message(
                    input_text, target_url, current_url, initial_nav_error
                )

                model_supports_image_inputs = not (
                    isinstance(model, str)
                    and (
                        model.lower().startswith("computer-use-preview")
                        or "deep-research" in model.lower()
                    )
                )

                if model_supports_image_inputs:
                    initial_params["input"] = [
                        {
                            "role": "user",
                            "content": [
                                {"type": "input_text", "text": user_text},
                                {
                                    "type": "input_image",
                                    "image_url": f"data:image/jpeg;base64,{screenshot_b64}",
                                },
                            ],
                        }
                    ]
                else:
                    initial_params["input"] = [
                        {
                            "role": "user",
                            "content": [{"type": "input_text", "text": user_text}],
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
            
            last_streamed_output_text = ""
            try:
                api_params = (
                    openai_client._sanitize_api_params(initial_params)
                    if hasattr(openai_client, "_sanitize_api_params")
                    else dict(initial_params)
                )

                for event in self.stream_handler.stream_response(
                    api_params=api_params,
                    fallback_params=initial_params
                ):
                    yield event
                
                response = self.stream_handler.final_response
                last_streamed_output_text = self.stream_handler.last_streamed_output_text
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
            parsed_initial = self.response_parser.parse_response(response)
            for reasoning_text in parsed_initial['reasoning_items']:
                yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'💭 {reasoning_text}')
            
            if not last_streamed_output_text:
                for text_content in parsed_initial['text_outputs']:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'📝 {text_content}')

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

                parsed = self.response_parser.parse_response(response)
                computer_calls = parsed['computer_calls']
                shell_calls = parsed['shell_calls']
                generic_tool_calls = parsed['generic_tool_calls']
                reasoning_items = parsed['reasoning_items']
                text_outputs = parsed['text_outputs']
                
                # Log reasoning items
                for reasoning_text in reasoning_items:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'💭 {reasoning_text}')
                
                # Log text outputs (avoid duplicating streamed output)
                if not last_streamed_output_text:
                    for text_content in text_outputs:
                        yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                     message=f'📝 {text_content}')
                
                if not computer_calls and not shell_calls and not generic_tool_calls:
                    final_text = (
                        getattr(response, 'output_text', '')
                        or last_streamed_output_text
                        or ' '.join(text_outputs)
                    )
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

                next_input = []
                
                # --- Handle Computer Use ---
                if computer_calls:
                    # Process first call
                    call = computer_calls[0]
                    
                    async for event in self.action_executor.execute_computer_action(
                        call, iteration, tenant_id, job_id, recent_actions, max_recent_actions
                    ):
                        if isinstance(event, dict) and event.get("type") == "result":
                            next_input.append(event["output_item"])
                            if event.get("notes"):
                                next_input.append({
                                    "type": "message",
                                    "role": "system",
                                    "content": [{"type": "input_text", "text": "\n".join(event["notes"])}],
                                })
                            if event.get("screenshot_url"):
                                screenshot_urls.append(event["screenshot_url"])
                        else:
                            yield event

                # --- Handle Shell Calls ---
                if shell_calls:
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'Processing {len(shell_calls)} shell commands...')
                    
                    for call in shell_calls:
                        async for event in self.action_executor.execute_shell_action(
                            call, job_id, tenant_id, shell_env_overrides
                        ):
                            if isinstance(event, dict) and event.get("type") == "result":
                                next_input.append(event["output_item"])
                            else:
                                yield event

                # --- Handle Generic/Other Tool Calls ---
                if generic_tool_calls:
                    for call in generic_tool_calls:
                        call_id = getattr(call, "call_id", None) or getattr(call, "id", None)
                        call_type = getattr(call, "type", None)
                        
                        tool_name = getattr(call, "tool_name", None)
                        if not tool_name:
                            func = getattr(call, 'function', None) or getattr(call, 'name', None)
                            if func:
                                tool_name = func.get('name') if isinstance(func, dict) else getattr(func, 'name', func)
                        
                        yield LogEvent(type='log', timestamp=time.time(), level='warning', 
                                     message=f'⚠️ Generic tool call detected: {tool_name} (ID: {call_id})')
                        
                        if not call_id:
                            continue

                        output_content = f"Tool '{tool_name}' executed successfully (simulated)."
                        if tool_name == 'web_search':
                            output_content = "Web search is not fully connected in this test environment. Please assume search completed or use shell commands/computer use for verification."
                        
                        yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                     message=f'🔙 Returning mock response for {tool_name}')

                        next_input.append({
                            "type": "function_call_output" if call_type == "function_call" else "tool_call_output",
                            "call_id": call_id,
                            "output": output_content
                        })

                if next_input:
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
                        last_streamed_output_text = ""
                        api_params = (
                            openai_client._sanitize_api_params(next_params)
                            if hasattr(openai_client, "_sanitize_api_params")
                            else dict(next_params)
                        )

                        for event in self.stream_handler.stream_response(
                            api_params=api_params,
                            fallback_params=next_params
                        ):
                            yield event
                        
                        response = self.stream_handler.final_response
                        last_streamed_output_text = self.stream_handler.last_streamed_output_text
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
                    yield LogEvent(type='log', timestamp=time.time(), level='warning', 
                                 message='Model returned no actions or text. Retrying...')
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