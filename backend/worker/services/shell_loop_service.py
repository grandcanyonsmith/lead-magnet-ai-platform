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
from typing import Any, Dict, List, Optional

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
        max_iterations: int = 25,
        max_duration_seconds: int = 300,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
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
            "model": model,
            "max_iterations": max_iterations,
            "max_duration_seconds": max_duration_seconds,
        })

        start_time = time.time()
        iteration = 0

        response = openai_client.make_api_call(params)
        previous_response_id = getattr(response, "id", None)

        while iteration < max_iterations:
            if (time.time() - start_time) > max_duration_seconds:
                logger.warning("[ShellLoopService] Shell loop timed out", extra={
                    "job_id": job_id,
                    "iterations": iteration,
                })
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
                call_id = _get_attr_or_key(call, "call_id")
                action = _get_attr_or_key(call, "action") or _get_attr_or_key(call, "arguments")
                action_dict = _to_dict(action)

                commands = action_dict.get("commands") or []
                timeout_ms = action_dict.get("timeout_ms")
                max_output_length = action_dict.get("max_output_length")

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
                    continue

                # Execute on ECS shell executor
                exec_result = self.shell_executor_service.run_shell_job(
                    commands=[str(c) for c in commands],
                    timeout_ms=int(timeout_ms) if timeout_ms is not None else None,
                    max_output_length=int(max_output_length) if max_output_length is not None else None,
                )

                # Contract supports returning max_output_length in result; fall back to the requested value.
                result_max_len = exec_result.get("max_output_length", max_output_length)
                output_items = exec_result.get("output") or exec_result.get("results") or []

                tool_outputs.append({
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "max_output_length": result_max_len,
                    "output": output_items,
                })

            # Build follow-up request
            next_params = openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text="",  # will be replaced
                tools=tools,
                tool_choice=tool_choice,
                has_computer_use=False,
                reasoning_effort=reasoning_effort,
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

        return response


