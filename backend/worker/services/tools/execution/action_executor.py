import logging
import time
import asyncio
import base64
from typing import List, Dict, Any, Optional, AsyncGenerator
from services.cua.types import (
    LogEvent, ActionCallEvent, ScreenshotEvent, 
    SafetyCheckEvent, ActionExecutedEvent
)
from services.cua.environment import Environment
from services.shell_executor_service import ShellExecutorService
from .agent_utils import get_attr_or_key, to_dict
from utils.image_utils import add_overlay_to_screenshot

logger = logging.getLogger(__name__)

class ActionExecutor:
    """Executes Computer and Shell actions."""

    def __init__(self, environment: Environment, image_handler: Any, shell_executor: ShellExecutorService):
        self.env = environment
        self.image_handler = image_handler
        self.shell_executor = shell_executor

    async def execute_computer_action(
        self,
        call: Any,
        iteration: int,
        tenant_id: Optional[str],
        job_id: Optional[str],
        recent_actions: List[str],
        max_recent_actions: int = 15
    ) -> AsyncGenerator[Any, None]:
        """
        Executes a computer action and yields events.
        Returns the computer output item to be sent back to the model.
        """
        call_id = getattr(call, 'call_id', None)
        action = getattr(call, 'action', {})
        # Convert action to dict if it's a model
        if hasattr(action, 'model_dump'):
            action = action.model_dump()
        elif not isinstance(action, dict):
            action = {}
        
        # Check safety checks
        pending_checks = getattr(call, 'pending_safety_checks', [])
        acknowledged_safety_checks = []
        if pending_checks:
            checks_data = [{'code': getattr(c, 'code', ''), 'message': getattr(c, 'message', ''), 'id': getattr(c, 'id', '')} for c in pending_checks]
            yield SafetyCheckEvent(
                type='safety_check', timestamp=time.time(),
                checks=checks_data, action_call_id=call_id, action=action
            )
            # For now, auto-acknowledge
            yield LogEvent(type='log', timestamp=time.time(), level='warning', message='Auto-acknowledging safety checks...')
            acknowledged_safety_checks = checks_data

        # Log action details
        action_type = action.get('type', 'unknown')
        yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'Action: {action_type}')
        
        yield ActionCallEvent(
            type='action_call', timestamp=time.time(),
            call_id=call_id, action=action
        )

        # Execute Computer Action
        action_error = None
        
        try:
            await self.env.execute_action(action)
            yield ActionExecutedEvent(
                type='action_executed', timestamp=time.time(),
                action_type=action_type, success=True
            )
            yield LogEvent(type='log', timestamp=time.time(), level='info', 
                        message=f'✅ Action executed successfully: {action_type}')
            
            # Track action for loop detection
            self._track_action(action, action_type, recent_actions, max_recent_actions)
            
            # Wait after action
            wait_time = 1000
            if action_type in ['click', 'type', 'keypress', 'drag', 'drag_and_drop']:
                wait_time = 1500
            elif action_type == 'navigate':
                wait_time = 2000
            elif action_type == 'scroll':
                wait_time = 800
            elif action_type == 'screenshot':
                wait_time = 0
            
            await asyncio.sleep(wait_time / 1000.0)
            
        except Exception as e:
            action_error = str(e)
            logger.error(f"Action failed: {e}")
            yield ActionExecutedEvent(
                type='action_executed', timestamp=time.time(),
                action_type=action_type, success=False, error=str(e)
            )
            yield LogEvent(type='log', timestamp=time.time(), level='error', 
                        message=f'❌ Action failed: {action_type} - {str(e)}')
            await asyncio.sleep(0.5)
        
        # Capture Screenshot
        screenshot_b64 = None
        current_url = None
        url = None
        
        try:
            screenshot_b64 = await self.env.capture_screenshot()
            current_url = await self.env.get_current_url()
            
            # Upload (using jpeg for faster uploads)
            screenshot_for_s3 = add_overlay_to_screenshot(screenshot_b64, action)
            
            url = self.image_handler.upload_base64_image_to_s3(
                screenshot_for_s3, 'image/jpeg', tenant_id=tenant_id, job_id=job_id
            )
            
            yield ScreenshotEvent(
                type='screenshot', timestamp=time.time(),
                url=url or '', current_url=current_url, base64=screenshot_b64
            )
            
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            yield LogEvent(type='log', timestamp=time.time(), level='error', message=f'Screenshot failed: {e}')

        # Prepare output item
        computer_output_item = {
            'type': 'computer_call_output',
            'call_id': call_id,
            'output': {
                'type': 'computer_screenshot',
                'image_url': f"data:image/jpeg;base64,{screenshot_b64}" if screenshot_b64 else ""
            }
        }

        if acknowledged_safety_checks:
            computer_output_item['acknowledged_safety_checks'] = acknowledged_safety_checks

        # Return tuple of (output_item, notes, screenshot_url)
        # We yield events, but we need to return data for the next input construction
        # Since this is a generator, we can't return easily. 
        # We will yield a special event or just rely on the caller to construct next input?
        # The caller needs the output item.
        # Let's yield a result event.
        
        notes = []
        if action_error:
            notes.append(f"Computer action failed: {action_error}")
        if current_url:
            notes.append(f"Current URL: {current_url}")
            
        yield {
            "type": "result",
            "output_item": computer_output_item,
            "notes": notes,
            "screenshot_url": url
        }

    def _track_action(self, action: Dict, action_type: str, recent_actions: List[str], max_recent_actions: int):
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
        elif action_type == "double_click":
            action_signature = (
                f"dblclick:{action.get('x', '')}:{action.get('y', '')}:{action.get('button', '')}"
            )
        elif action_type in ("drag", "drag_and_drop"):
            sx = action.get("source_x") or action.get("start_x") or action.get("x") or ""
            sy = action.get("source_y") or action.get("start_y") or action.get("y") or ""
            tx = action.get("target_x") or action.get("end_x") or action.get("to_x") or action.get("x2") or ""
            ty = action.get("target_y") or action.get("end_y") or action.get("to_y") or action.get("y2") or ""
            action_signature = f"drag:{sx}:{sy}:{tx}:{ty}"
        elif action_type == "hover":
            action_signature = f"hover:{action.get('x', '')}:{action.get('y', '')}"
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

    async def execute_shell_action(
        self,
        call: Any,
        job_id: Optional[str],
        tenant_id: Optional[str],
        shell_env_overrides: Optional[Dict[str, str]]
    ) -> AsyncGenerator[Any, None]:
        
        call_id = get_attr_or_key(call, "call_id") or get_attr_or_key(call, "id")
        if not call_id:
            yield LogEvent(
                type='log', timestamp=time.time(), level='error',
                message='❌ Shell tool call missing call_id; cannot execute.'
            )
            return

        action = get_attr_or_key(call, "action") or get_attr_or_key(call, "arguments")
        if not action:
             func = get_attr_or_key(call, 'function')
             if func:
                 action = get_attr_or_key(func, 'arguments')
        
        action_dict = to_dict(action)
        commands = action_dict.get("commands") or []
        timeout_ms = action_dict.get("timeout_ms")
        max_output_length = action_dict.get("max_output_length")
        effective_max_len = max_output_length or 4096
        
        if not isinstance(commands, list):
            commands = [str(commands)] if commands else []
        
        if not commands:
            yield {
                "type": "result",
                "output_item": {
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "max_output_length": effective_max_len,
                    "output": [{
                        "stdout": "",
                        "stderr": "No commands provided",
                        "outcome": {"type": "exit", "exit_code": 1}
                    }]
                }
            }
            return

        # Log commands
        for cmd in commands:
            yield LogEvent(type='log', timestamp=time.time(), level='info', message=f'💻 Shell: {cmd}')
        
        workspace_id = job_id or f"temp_{int(time.time())}"

        try:
            env_overrides = dict(shell_env_overrides or {})
            env_overrides["LM_JOB_ID"] = job_id or ""
            env_overrides["LM_TENANT_ID"] = tenant_id or ""
            
            # Run shell job (sync call in existing service, might block loop if not careful, but it's fast enough or we accept it)
            # Ideally this should be async or run in executor if it blocks long
            result = self.shell_executor.run_shell_job(
                commands=commands,
                timeout_ms=timeout_ms or 120000,
                max_output_length=effective_max_len,
                workspace_id=workspace_id,
                reset_workspace=False,
                env=env_overrides
            )
            
            output_list = result.get('output', [])
            result_max_len = result.get("max_output_length") or effective_max_len
            
            for out_item in output_list:
                stdout = out_item.get('stdout', '')
                stderr = out_item.get('stderr', '')
                if stdout.strip():
                    yield LogEvent(type='log', timestamp=time.time(), level='info', 
                                 message=f'📤 Stdout: {stdout[:200]}{"..." if len(stdout)>200 else ""}')
                if stderr.strip():
                    yield LogEvent(type='log', timestamp=time.time(), level='warning', 
                                 message=f'⚠️ Stderr: {stderr[:200]}{"..." if len(stderr)>200 else ""}')
            
            yield {
                "type": "result",
                "output_item": {
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "max_output_length": result_max_len,
                    "output": output_list,
                }
            }
            
        except Exception as e:
            logger.error(f"Shell execution failed: {e}")
            yield LogEvent(type='log', timestamp=time.time(), level='error', message=f'❌ Shell execution error: {e}')
            yield {
                "type": "result",
                "output_item": {
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "max_output_length": effective_max_len,
                    "output": [{
                        "stdout": "",
                        "stderr": str(e),
                        "outcome": {"type": "error", "message": str(e)}
                    }]
                }
            }
