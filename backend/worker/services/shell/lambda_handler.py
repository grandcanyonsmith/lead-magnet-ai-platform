import json
import logging
from typing import Dict, Any, AsyncGenerator

from services.shell_executor_service import ShellExecutorService
from services.tools.execution import ShellLoopService
from services.openai_client import OpenAIClient

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class StreamingShellHandler:
    def __init__(self):
        self.shell_executor = ShellExecutorService()
        self.shell_loop = ShellLoopService(self.shell_executor)

    async def process_stream(self, event: Dict[str, Any], context: Any) -> AsyncGenerator[str, None]:
        """
        Process Shell request and stream events.
        """
        # Explicitly reference json module to avoid UnboundLocalError
        _json = json

        job_id = event.get('job_id')
        tenant_id = event.get('tenant_id')
        model = event.get('model', 'gpt-5.2')
        instructions = event.get('instructions', '')
        input_text = event.get('input_text', '')
        tools = event.get('tools', [])
        tool_choice = event.get('tool_choice', 'auto')
        params = event.get('params', {})
        max_iterations = event.get('max_iterations', 50)
        max_duration = event.get('max_duration_seconds', 900)

        # Initialize OpenAI Client (handles auth via env vars)
        openai_client = OpenAIClient()

        try:
            # Build initial Responses API params. The incoming `params` from the frontend step tester
            # is NOT a full OpenAI payload; it's typically user-provided JSON. We only extract
            # known optional knobs from it (best-effort) and build the proper request.
            extra: Dict[str, Any] = params if isinstance(params, dict) else {}
            reasoning_effort = extra.get("reasoning_effort") if isinstance(extra.get("reasoning_effort"), str) else None
            service_tier = extra.get("service_tier") if isinstance(extra.get("service_tier"), str) else None
            text_verbosity = extra.get("text_verbosity") if isinstance(extra.get("text_verbosity"), str) else None

            max_output_tokens = extra.get("max_output_tokens")
            if max_output_tokens is not None and not isinstance(max_output_tokens, int):
                try:
                    max_output_tokens = int(max_output_tokens)
                except Exception:
                    max_output_tokens = None

            initial_params = openai_client.build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                has_computer_use=False,
                reasoning_effort=reasoning_effort,
                service_tier=service_tier,
                text_verbosity=text_verbosity,
                max_output_tokens=max_output_tokens,
                job_id=job_id,
                tenant_id=tenant_id,
            )
            # Match CUA streaming behavior (and reduce prompt-size failures).
            initial_params["truncation"] = "auto"
            # Include internal identifiers for logging (OpenAIClient will strip before sending).
            if job_id:
                initial_params["job_id"] = job_id
            if tenant_id:
                initial_params["tenant_id"] = tenant_id

            async for event_obj in self.shell_loop.run_shell_loop_stream(
                openai_client=openai_client,
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                params=initial_params,
                reasoning_effort=reasoning_effort,
                text_verbosity=text_verbosity,
                max_output_tokens=max_output_tokens,
                max_iterations=max_iterations,
                max_duration_seconds=max_duration,
                tenant_id=tenant_id,
                job_id=job_id
            ):
                # event_obj is a dict
                yield _json.dumps(event_obj) + "\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield _json.dumps({"type": "error", "message": str(e)}) + "\n"


# Entry point for Lambda
def handler(event, context):
    """
    Lambda entrypoint for the Shell streaming worker.

    Note: Standard Python Lambda invocations are JSON-serialized, so we buffer the
    NDJSON output into the `body` field and let the API proxy unwrap it.
    """
    import asyncio

    handler_instance = StreamingShellHandler()
    results = []

    async def run():
        async for chunk in handler_instance.process_stream(event, context):
            results.append(chunk)

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.run_until_complete(run())

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/x-ndjson"},
        "body": "".join(results),
    }

