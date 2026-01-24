import json
import logging
import time
from typing import Dict, Any

from services.tools.execution import CUAgent
from services.cua.environment_factory import (
    resolve_cua_environment_config,
    create_async_environment,
)
from services.cua.streaming_request import normalize_stream_request
from services.cua.screenshot_service import S3ScreenshotService
from s3_service import S3Service
from services.openai_client import OpenAIClient
from services.tool_secrets import append_tool_secrets, get_tool_secrets
import dataclasses

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# NOTE: This file is used by the dedicated CUA streaming worker Lambda.

class StreamingHandler:
    def __init__(self):
        self.s3_service = S3Service()
        self.screenshot_service = S3ScreenshotService(self.s3_service)
        # Note: In Lambda, we might want to reuse the environment if possible, 
        # but Playwright usually needs fresh start or careful management.
        # For now, we create fresh per invocation.
    
    async def process_stream(self, event: Dict[str, Any], context: Any):
        """
        Process CUA request and stream events.
        """
        # Explicitly reference json module to avoid UnboundLocalError
        _json = json

        normalized = normalize_stream_request(event)

        job_id = normalized.job_id
        tenant_id = normalized.tenant_id
        model = normalized.model
        requested_model = normalized.requested_model
        instructions = normalized.instructions
        input_text = normalized.input_text
        tools = normalized.tools
        tool_choice = normalized.tool_choice
        params = normalized.params
        max_iterations = normalized.max_iterations
        max_duration = normalized.max_duration_seconds
        aws_env_overrides = normalized.aws_env_overrides

        if normalized.aws_shell_forced:
            yield _json.dumps({
                "type": "log",
                "timestamp": time.time(),
                "level": "info",
                "message": (
                    "AWS/S3 task detected: forcing shell tool and disabling code_interpreter."
                ),
            }) + "\n"

        tool_secrets = get_tool_secrets(None, tenant_id)
        should_inject_tool_secrets = bool(tool_secrets)
        instructions = (
            append_tool_secrets(instructions, tool_secrets)
            if should_inject_tool_secrets
            else instructions
        )

        has_computer_use = normalized.has_computer_use
        has_image_generation = normalized.has_image_generation

        logger.info("[CUA] Request received", extra={
            "job_id": job_id,
            "requested_model": requested_model,
            "tool_choice": tool_choice,
            "tools_count": len(tools) if isinstance(tools, list) else None,
            "tool_types": normalized.tool_types,
            "has_computer_use": has_computer_use,
            "has_image_generation": has_image_generation,
            "image_tool_model": normalized.image_tool_model,
            "instructions_len": len(instructions or ""),
            "input_text_len": len(input_text or ""),
        })

        if has_computer_use and requested_model != model:
            logger.warning(
                "[CUA] Overriding model from %s to computer-use-preview "
                "(required for computer_use_preview tool)",
                requested_model,
            )

        logger.info("[CUA] Model selection", extra={
            "job_id": job_id,
            "requested_model": requested_model,
            "final_model": model,
            "model_overridden": bool(has_computer_use and requested_model != model),
            "has_computer_use": has_computer_use,
        })

        # Initialize deps
        env_config = resolve_cua_environment_config(tools)
        env = create_async_environment(env_config.environment)
        # Initialize OpenAI Client (assuming it handles auth via env vars)
        openai_client = OpenAIClient()
        
        agent = CUAgent(environment=env, image_handler=self.screenshot_service)

        try:
            async for event_obj in agent.run_loop(
                openai_client=openai_client,
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=tools,
                tool_choice=tool_choice,
                max_iterations=max_iterations,
                max_duration_seconds=max_duration,
                tenant_id=tenant_id,
                job_id=job_id,
                params=params,
                shell_env_overrides=(
                    {**tool_secrets, **aws_env_overrides}
                    if (tool_secrets or aws_env_overrides)
                    else None
                ),
            ):
                # Convert dataclass to dict and yield as JSON line
                data = dataclasses.asdict(event_obj)
                yield _json.dumps(data) + "\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield _json.dumps({"type": "error", "message": str(e)}) + "\n"

# Entry point for Lambda
# Note: This requires a runtime wrapper that supports async generators or response streaming
def handler(event, context):
    import asyncio
    
    handler_instance = StreamingHandler()
    
    # Simple synchronous wrapper for now if runtime doesn't support streaming
    # This will buffer everything, which is not ideal, but "Streaming" in Lambda Python is tricky without proper runtime.
    # However, if we assume the user has a way to consume the generator (e.g. FastAPI/Mangum or Function URL wrapper):
    
    loop = asyncio.get_event_loop()
    
    # If using Function URL with RESPONSE_STREAM, this function should return a generator? 
    # Or write to a stream?
    # Standard Python Lambda doesn't support async generator return directly.
    # But let's assume this is the logic and the infrastructure handles the streaming adapter.
    
    results = []
    async def run():
        async for chunk in handler_instance.process_stream(event, context):
            results.append(chunk)
            # In a real streaming runtime, we would write to response_stream here
            
    loop.run_until_complete(run())
    
    # Return buffered result (fallback)
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/x-ndjson"},
        "body": "".join(results)
    }

