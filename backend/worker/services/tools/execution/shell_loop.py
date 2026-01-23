"""
Shell Tool Loop Service (Worker-side)

Implements the OpenAI Responses API tool loop for the `shell` tool:
1) Call Responses API with tools=[{"type":"shell"}]
2) Detect `shell_call` output items
3) Execute the requested commands via the ECS shell executor (Fargate)
4) Send `shell_call_output` back to Responses API using previous_response_id
5) Repeat until the model returns final output_text
"""

import logging
import time
import hashlib
import json
import asyncio
from typing import Any, Dict, List, Optional, AsyncGenerator, Callable

logger = logging.getLogger(__name__)


def _to_dict(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        try:
            return value.model_dump()
        except Exception:
            return {}
    if hasattr(value, "dict"):
        try:
            return value.dict()
        except Exception:
            return {}
    # Best-effort fallback
    try:
        return dict(value)  # type: ignore[arg-type]
    except Exception:
        return {}


def _get_attr_or_key(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)

def _derive_workspace_id(*, tenant_id: Optional[str], job_id: Optional[str], step_index: Optional[int]) -> str:
    """
    Deterministically derive a safe workspace_id for the shell executor.

    This keeps shell tool runs for the same (tenant_id, job_id, step_index) in the same EFS-backed
    directory, while avoiding path traversal issues (hex-only).
    """
    base = f"{tenant_id or 'unknown'}:{job_id or 'unknown'}:{step_index if step_index is not None else 'unknown'}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:32]
    return f"w_{digest}"


class ShellLoopService:
    """Runs the OpenAI `shell` tool loop using an external executor."""

    def __init__(self, shell_executor_service: Any):
        self.shell_executor_service = shell_executor_service

    def _extract_shell_calls(self, response: Any) -> List[Any]:
        shell_calls: List[Any] = []
        output_items = getattr(response, "output", None)
        if not output_items or not isinstance(output_items, list):
            return shell_calls

        for item in output_items:
            item_type = _get_attr_or_key(item, "type")
            if item_type == "shell_call":
                shell_calls.append(item)
                continue

            # Some SDKs represent custom tools as generic tool_call items.
            if item_type == "tool_call":
                tool_name = _get_attr_or_key(item, "tool_name")
                if tool_name == "shell":
                    shell_calls.append(item)
            
            # Standard function calls
            if item_type == "function_call":
                fn_name = _get_attr_or_key(item, "name")
                if not fn_name:
                    func = _get_attr_or_key(item, "function")
                    if func:
                        fn_name = _get_attr_or_key(func, "name")
                if fn_name == "shell":
                    shell_calls.append(item)

        return shell_calls

    def run_shell_loop(
        self,
        *,
        openai_client: Any,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict[str, Any]],
        tool_choice: str,
        params: Dict[str, Any],
        reasoning_effort: Optional[str] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        service_tier: Optional[str] = None,
        output_format: Optional[Dict[str, Any]] = None,
        max_iterations: int = 25,
        max_duration_seconds: int = 300,
        default_command_timeout_ms: Optional[int] = None,
        default_command_max_output_length: Optional[int] = None,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        step_index: Optional[int] = None,
        shell_log_collector: Optional[List[Dict[str, Any]]] = None,
        live_step_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> Any:
        """
        Run the shell tool loop and return the final OpenAI response object.

        Args:
            openai_client: OpenAIClient (worker) instance
            model/instructions/input_text/tools/tool_choice: original step settings
            params: initial Responses API params (dict)
        """

        logger.info("[ShellLoopService] Starting shell loop", extra={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "step_index": step_index,
            "model": model,
            "max_iterations": max_iterations,
            "max_duration_seconds": max_duration_seconds,
            "default_command_timeout_ms": default_command_timeout_ms,
            "default_command_max_output_length": default_command_max_output_length,
        })

        workspace_id = _derive_workspace_id(tenant_id=tenant_id, job_id=job_id, step_index=step_index)
        # Reset the workspace once at the beginning of the loop to avoid stale state across retries.
        reset_workspace_next = True

        start_time = time.time()
        iteration = 0
        live_output = ""
        live_truncated = False
        live_last_ts = 0.0
        live_last_len = 0
        live_max_chars = 100_000
        live_error: Optional[str] = None

        def _append_live_output(
            message: str,
            *,
            status: str = "streaming",
            error: Optional[str] = None,
            force: bool = False,
        ) -> None:
            nonlocal live_output, live_truncated, live_last_ts, live_last_len, live_error
            if not live_step_callback:
                return
            if message:
                live_output += message
            if len(live_output) > live_max_chars:
                live_output = live_output[-live_max_chars:]
                live_truncated = True
            if error:
                live_error = error
            now = time.time()
            if not force:
                if (now - live_last_ts) < 0.5 and (len(live_output) - live_last_len) < 512:
                    return
            live_last_ts = now
            live_last_len = len(live_output)
            try:
                status_value = status
                if live_error and status_value == "final":
                    status_value = "error"
                payload = {
                    "output_text": live_output,
                    "status": status_value,
                }
                if live_truncated:
                    payload["truncated"] = True
                if live_error:
                    payload["error"] = live_error
                live_step_callback(payload)
            except Exception:
                logger.debug("[ShellLoopService] live_step_callback failed", exc_info=True)

        try:
            _append_live_output("Starting shell execution...\n", force=True)
            response = openai_client.make_api_call(params)
            previous_response_id = getattr(response, "id", None)

            while iteration < max_iterations:
                if (time.time() - start_time) > max_duration_seconds:
                    logger.warning("[ShellLoopService] Shell loop timed out", extra={
                        "job_id": job_id,
                        "iterations": iteration,
                    })
                    _append_live_output(
                        "\nShell loop timed out.\n",
                        status="error",
                        error="Shell loop timed out",
                        force=True,
                    )
                    break

                shell_calls = self._extract_shell_calls(response)
                if not shell_calls:
                    break

                iteration += 1
                logger.info("[ShellLoopService] Processing shell_call batch", extra={
                    "job_id": job_id,
                    "iteration": iteration,
                    "shell_calls_count": len(shell_calls),
                })

                tool_outputs: List[Dict[str, Any]] = []
                for call in shell_calls:
                    call_id = _get_attr_or_key(call, "call_id") or _get_attr_or_key(call, "id")
                    
                    # Handle both 'action' (custom) and 'function' (standard) structures
                    action = _get_attr_or_key(call, "action") or _get_attr_or_key(call, "arguments")
                    if not action:
                         func = _get_attr_or_key(call, 'function')
                         if func:
                             action = _get_attr_or_key(func, 'arguments')
                    
                    action_dict = _to_dict(action)

                    commands = action_dict.get("commands") or []
                    timeout_ms = action_dict.get("timeout_ms")
                    max_output_length = action_dict.get("max_output_length")
                    if timeout_ms is None:
                        timeout_ms = default_command_timeout_ms
                    # Enforce a default limit if not provided to prevent context window exhaustion
                    if max_output_length is None:
                        max_output_length = default_command_max_output_length
                    if max_output_length is None:
                        max_output_length = 4096

                    if not isinstance(commands, list) or len(commands) == 0:
                        # Defensive: return an error outcome for an invalid call.
                        tool_outputs.append({
                            "type": "shell_call_output",
                            "call_id": call_id,
                            "max_output_length": max_output_length,
                            "output": [{
                                "stdout": "",
                                "stderr": "",
                                "outcome": {"type": "error", "message": "shell_call had no commands"},
                            }],
                        })
                        _append_live_output(
                            "\nShell tool call had no commands.\n",
                            status="error",
                            error="shell_call had no commands",
                            force=True,
                        )
                        continue

                    # Execute on ECS shell executor
                    exec_env = {
                        "LM_JOB_ID": job_id or "",
                        "LM_TENANT_ID": tenant_id or "",
                        "LM_STEP_INDEX": str(step_index) if step_index is not None else "",
                        "SHELL_EXECUTOR_WORKSPACE_ID": workspace_id,
                    }
                    reset_workspace_flag = reset_workspace_next
                    for cmd in commands:
                        _append_live_output(f"$ {cmd}\n")
                    exec_result = self.shell_executor_service.run_shell_job(
                        commands=[str(c) for c in commands],
                        timeout_ms=int(timeout_ms) if timeout_ms is not None else None,
                        max_output_length=int(max_output_length) if max_output_length is not None else None,
                        workspace_id=workspace_id,
                        reset_workspace=reset_workspace_next,
                        env=exec_env,
                    )
                    reset_workspace_next = False

                    # Contract supports returning max_output_length in result; fall back to the requested value.
                    result_max_len = exec_result.get("max_output_length", max_output_length)
                    output_items = exec_result.get("output") or exec_result.get("results") or []

                    if shell_log_collector is not None:
                        try:
                            shell_log_collector.append({
                                "call_id": call_id,
                                "commands": [str(c) for c in commands],
                                "timeout_ms": int(timeout_ms) if timeout_ms is not None else None,
                                "max_output_length": result_max_len,
                                "output": output_items,
                                "meta": exec_result.get("meta"),
                                "workspace_id": workspace_id,
                                "reset_workspace": reset_workspace_flag,
                                "timestamp": time.time(),
                            })
                        except Exception:
                            logger.debug("[ShellLoopService] Failed to collect shell log entry", exc_info=True)

                    for output in output_items:
                        stdout = output.get("stdout", "")
                        stderr = output.get("stderr", "")
                        if stdout:
                            _append_live_output(stdout if stdout.endswith("\n") else f"{stdout}\n")
                        if stderr:
                            _append_live_output(
                                stderr if stderr.endswith("\n") else f"{stderr}\n",
                                status="streaming",
                            )

                    tool_outputs.append({
                        "type": "shell_call_output",
                        "call_id": call_id,
                        "max_output_length": result_max_len,
                        "output": output_items,
                    })

                # Build follow-up request
                #
                # IMPORTANT: If the original step set tool_choice="required", keep the tool available
                # but relax tool_choice to "auto" for follow-ups. Otherwise the model can get stuck
                # in an endless tool-call-only loop and never produce final output_text.
                next_tool_choice = tool_choice
                if isinstance(tool_choice, str) and tool_choice.strip().lower() == "required":
                    next_tool_choice = "auto"

                next_params = openai_client.build_api_params(
                    model=model,
                    instructions=instructions,
                    input_text="",  # will be replaced
                    tools=tools,
                    tool_choice=next_tool_choice,
                    has_computer_use=False,
                    reasoning_effort=reasoning_effort,
                    text_verbosity=text_verbosity,
                    max_output_tokens=max_output_tokens,
                    service_tier=service_tier,
                    output_format=output_format,
                )

                if previous_response_id:
                    next_params["previous_response_id"] = previous_response_id
                next_params["input"] = tool_outputs

                response = openai_client.make_api_call(next_params)
                previous_response_id = getattr(response, "id", previous_response_id)

            logger.info("[ShellLoopService] Shell loop complete", extra={
                "job_id": job_id,
                "iterations": iteration,
                "final_output_text_length": len(getattr(response, "output_text", "") or ""),
            })
            _append_live_output("\nShell execution complete.\n", status="final", force=True)

            return response
        except Exception as e:
            _append_live_output(
                f"\nShell execution failed: {str(e)}\n",
                status="error",
                error=str(e),
                force=True,
            )
            raise

    async def run_shell_loop_stream(
        self,
        *,
        openai_client: Any,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict[str, Any]],
        tool_choice: str,
        params: Dict[str, Any],
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        output_format: Optional[Dict[str, Any]] = None,
        max_iterations: int = 25,
        max_duration_seconds: int = 300,
        default_command_timeout_ms: Optional[int] = None,
        default_command_max_output_length: Optional[int] = None,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        step_index: Optional[int] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Run the shell tool loop and yield events for streaming.
        
        Yields:
            Dict[str, Any]: Event object (log, etc.)
        """

        yield {"type": "log", "timestamp": time.time(), "level": "info", "message": "Starting shell execution..."}
        if default_command_timeout_ms or default_command_max_output_length:
            timeout_label = (
                f"{default_command_timeout_ms}ms" if default_command_timeout_ms else "executor default"
            )
            output_label = (
                str(default_command_max_output_length)
                if default_command_max_output_length
                else "4096"
            )
            yield {
                "type": "log",
                "timestamp": time.time(),
                "level": "info",
                "message": f"Using defaults: timeout {timeout_label}, output {output_label} chars",
            }
        
        workspace_id = _derive_workspace_id(tenant_id=tenant_id, job_id=job_id, step_index=step_index)
        reset_workspace_next = True

        start_time = time.time()
        iteration = 0

        # We need to run synchronous openai calls in a thread executor to avoid blocking the event loop
        # if this is running in an async context (which it is for streaming).
        loop = asyncio.get_running_loop()

        try:
            yield {"type": "log", "timestamp": time.time(), "level": "info", "message": "Sending initial request to model..."}
            
            response = await loop.run_in_executor(None, lambda: openai_client.make_api_call(params))
            previous_response_id = getattr(response, "id", None)
            
            # Log initial response content
            if hasattr(response, 'output') and response.output:
                for item in response.output:
                     item_type = getattr(item, 'type', '')
                     if item_type == 'text' or item_type == 'output_text':
                        text = getattr(item, 'text', '')
                        if text:
                            yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"📝 {text}"}
                     elif item_type == 'reasoning':
                        summary = getattr(item, 'summary', [])
                        if summary:
                            for s in summary:
                                r_text = getattr(s, 'text', '') if hasattr(s, 'text') else str(s)
                                yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"💭 {r_text}"}

            while iteration < max_iterations:
                if (time.time() - start_time) > max_duration_seconds:
                    yield {"type": "log", "timestamp": time.time(), "level": "warning", "message": "Shell loop timed out"}
                    yield {"type": "error", "message": "Timeout reached"}
                    break

                shell_calls = self._extract_shell_calls(response)
                if not shell_calls:
                    final_text = getattr(response, 'output_text', '')
                    if final_text:
                        yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"✅ Completed: {final_text}"}
                    else:
                        yield {"type": "log", "timestamp": time.time(), "level": "info", "message": "✅ Completed."}
                    yield {"type": "complete"}
                    break

                iteration += 1
                yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"Processing {len(shell_calls)} shell commands (Iteration {iteration})"}

                tool_outputs: List[Dict[str, Any]] = []
                for call in shell_calls:
                    call_id = _get_attr_or_key(call, "call_id") or _get_attr_or_key(call, "id")
                    
                    action = _get_attr_or_key(call, "action") or _get_attr_or_key(call, "arguments")
                    if not action:
                        func = _get_attr_or_key(call, 'function')
                        if func:
                            action = _get_attr_or_key(func, 'arguments')
                    
                    action_dict = _to_dict(action)
                    commands = action_dict.get("commands") or []
                    timeout_ms = action_dict.get("timeout_ms")
                    max_output_length = action_dict.get("max_output_length")
                    if timeout_ms is None:
                        timeout_ms = default_command_timeout_ms
                    # Enforce a default limit if not provided to prevent context window exhaustion
                    if max_output_length is None:
                        max_output_length = default_command_max_output_length
                    if max_output_length is None:
                        max_output_length = 4096


                    if not isinstance(commands, list):
                        commands = [str(commands)] if commands else []

                    if not commands:
                         tool_outputs.append({
                            "type": "shell_call_output",
                            "call_id": call_id,
                            "output": [{
                                "stdout": "",
                                "stderr": "",
                                "outcome": {"type": "error", "message": "No commands"}
                            }]
                        })
                         continue

                    for cmd in commands:
                        yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"💻 {cmd}"}

                    # Execute (potentially blocking, so run in executor if it takes time, but `run_shell_job` might handle sub-process waiting)
                    # `subprocess.run` blocks.
                    exec_env = {
                        "LM_JOB_ID": job_id or "",
                        "LM_TENANT_ID": tenant_id or "",
                        "LM_STEP_INDEX": str(step_index) if step_index is not None else "",
                        "SHELL_EXECUTOR_WORKSPACE_ID": workspace_id,
                    }
                    exec_result = await loop.run_in_executor(
                        None, 
                        lambda: self.shell_executor_service.run_shell_job(
                            commands=[str(c) for c in commands],
                            timeout_ms=int(timeout_ms) if timeout_ms is not None else None,
                            max_output_length=int(max_output_length) if max_output_length is not None else None,
                            workspace_id=workspace_id,
                            reset_workspace=reset_workspace_next,
                            env=exec_env,
                        )
                    )
                    reset_workspace_next = False

                    result_max_len = exec_result.get("max_output_length", max_output_length)
                    output_items = exec_result.get("output") or exec_result.get("results") or []

                    for out_item in output_items:
                        stdout = out_item.get('stdout', '')
                        stderr = out_item.get('stderr', '')
                        if stdout.strip():
                             yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"📤 {stdout[:500]}"}
                        if stderr.strip():
                             yield {"type": "log", "timestamp": time.time(), "level": "warning", "message": f"⚠️ {stderr[:500]}"}

                    tool_outputs.append({
                        "type": "shell_call_output",
                        "call_id": call_id,
                        "max_output_length": result_max_len,
                        "output": output_items,
                    })

                # Build follow-up request
                next_tool_choice = tool_choice
                if isinstance(tool_choice, str) and tool_choice.strip().lower() == "required":
                    next_tool_choice = "auto"

                next_params = openai_client.build_api_params(
                    model=model,
                    instructions=instructions,
                    input_text="",
                    tools=tools,
                    tool_choice=next_tool_choice,
                    has_computer_use=False,
                    reasoning_effort=reasoning_effort,
                    text_verbosity=text_verbosity,
                    max_output_tokens=max_output_tokens,
                    service_tier=service_tier,
                    output_format=output_format,
                )

                if previous_response_id:
                    next_params["previous_response_id"] = previous_response_id
                next_params["input"] = tool_outputs

                yield {"type": "log", "timestamp": time.time(), "level": "info", "message": "Sending feedback to model..."}
                
                response = await loop.run_in_executor(None, lambda: openai_client.make_api_call(next_params))
                previous_response_id = getattr(response, "id", previous_response_id)
                
                # Log response content
                if hasattr(response, 'output') and response.output:
                    for item in response.output:
                        item_type = getattr(item, 'type', '')
                        if item_type == 'text' or item_type == 'output_text':
                            text = getattr(item, 'text', '')
                            if text:
                                yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"📝 {text}"}
                        elif item_type == 'reasoning':
                            summary = getattr(item, 'summary', [])
                            if summary:
                                for s in summary:
                                    r_text = getattr(s, 'text', '') if hasattr(s, 'text') else str(s)
                                    yield {"type": "log", "timestamp": time.time(), "level": "info", "message": f"💭 {r_text}"}

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield {"type": "log", "timestamp": time.time(), "level": "error", "message": f"Error: {str(e)}"}
            yield {"type": "error", "message": str(e)}
