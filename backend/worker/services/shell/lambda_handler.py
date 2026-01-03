import json
import logging
from typing import Dict, Any, AsyncGenerator

from services.shell_executor_service import ShellExecutorService
from services.shell_loop_service import ShellLoopService
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
        max_duration = event.get('max_duration_seconds', 300)

        # Initialize OpenAI Client (handles auth via env vars)
        openai_client = OpenAIClient()

        try:
            async for event_obj in self.shell_loop.run_shell_loop_stream(
                openai_client=openai_client,
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                params=params,
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

