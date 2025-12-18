#!/usr/bin/env python3
"""
Test: ShellLoopService executes `shell_call` items and returns final output.

This is a unit test that stubs the OpenAI client + shell executor, ensuring the
worker-side tool loop sends `shell_call_output` back using previous_response_id.
"""

import sys
from pathlib import Path

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from services.shell_loop_service import ShellLoopService  # noqa: E402


class DummyResponse:
    def __init__(self, *, resp_id: str, output, output_text: str = ""):
        self.id = resp_id
        self.output = output
        self.output_text = output_text


class DummyOpenAIClient:
    def __init__(self):
        self.calls = []
        self._queue = []

    def enqueue(self, resp):
        self._queue.append(resp)

    def build_api_params(self, **kwargs):
        # Minimal shape compatible with the loop: include model/instructions/input/tools/tool_choice
        params = {
            "model": kwargs.get("model"),
            "instructions": kwargs.get("instructions"),
            "input": kwargs.get("input_text", ""),
        }
        if kwargs.get("tools") is not None:
            params["tools"] = kwargs.get("tools")
        if kwargs.get("tool_choice") is not None:
            params["tool_choice"] = kwargs.get("tool_choice")
        if kwargs.get("reasoning_effort") is not None:
            params["reasoning"] = {"effort": kwargs.get("reasoning_effort")}
        return params

    def make_api_call(self, params):
        self.calls.append(params)
        if not self._queue:
            raise RuntimeError("DummyOpenAIClient queue is empty")
        return self._queue.pop(0)


class DummyShellExecutor:
    def __init__(self):
        self.calls = []

    def run_shell_job(self, commands, timeout_ms=None, max_output_length=None, max_wait_seconds=600):
        self.calls.append({
            "commands": commands,
            "timeout_ms": timeout_ms,
            "max_output_length": max_output_length,
        })
        return {
            "max_output_length": max_output_length or 4096,
            "output": [{
                "stdout": "hello\n",
                "stderr": "",
                "outcome": {"type": "exit", "exit_code": 0},
            }],
        }


def test_shell_loop_executes_shell_call_and_returns_final_output():
    openai_client = DummyOpenAIClient()
    shell_executor = DummyShellExecutor()
    loop = ShellLoopService(shell_executor)

    # First response: model requests shell tool
    openai_client.enqueue(DummyResponse(
        resp_id="resp_1",
        output=[{
            "type": "shell_call",
            "call_id": "call_1",
            "action": {
                "commands": ["echo hello"],
                "timeout_ms": 120000,
                "max_output_length": 4096,
            },
            "status": "in_progress",
        }],
        output_text="",
    ))

    # Second response: model returns final text after we send shell_call_output
    openai_client.enqueue(DummyResponse(
        resp_id="resp_2",
        output=[],
        output_text="done",
    ))

    initial_params = {
        "model": "gpt-5.1",
        "instructions": "test",
        "input": "hello",
        "tools": [{"type": "shell"}],
        "tool_choice": "required",
    }

    final_resp = loop.run_shell_loop(
        openai_client=openai_client,
        model="gpt-5.1",
        instructions="test",
        input_text="hello",
        tools=[{"type": "shell"}],
        tool_choice="required",
        params=initial_params,
        max_iterations=5,
        max_duration_seconds=30,
    )

    assert getattr(final_resp, "output_text", None) == "done"
    assert len(shell_executor.calls) == 1

    # Ensure we sent shell_call_output using previous_response_id
    assert len(openai_client.calls) == 2
    followup = openai_client.calls[1]
    assert followup.get("previous_response_id") == "resp_1"
    assert isinstance(followup.get("input"), list)
    assert followup["input"][0]["type"] == "shell_call_output"
    assert followup["input"][0]["call_id"] == "call_1"


