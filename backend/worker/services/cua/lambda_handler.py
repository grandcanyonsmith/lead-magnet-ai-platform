import json
import logging
import time
from typing import Dict, Any

from services.tools.execution import CUAgent
from services.cua.environment_factory import (
    resolve_cua_environment_config,
    create_async_environment,
)
from services.cua.screenshot_service import S3ScreenshotService
from s3_service import S3Service
from services.openai_client import OpenAIClient
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
        
        job_id = event.get('job_id')
        tenant_id = event.get('tenant_id')
        model = event.get('model', 'computer-use-preview')
        requested_model = model
        instructions = event.get('instructions', '')
        input_text = event.get('input_text', '')
        tools = event.get('tools', [])
        if not isinstance(tools, list):
            tools = [tools] if tools else []
        tool_choice = event.get('tool_choice', 'auto')
        params = event.get('params', {})
        max_iterations = event.get('max_iterations', 100)
        max_duration = event.get('max_duration_seconds', 900)
        aws_credentials = event.get("aws_credentials") if isinstance(event, dict) else None

        aws_env_overrides: Dict[str, str] = {}
        if isinstance(aws_credentials, dict):
            for key in (
                "AWS_ACCESS_KEY_ID",
                "AWS_SECRET_ACCESS_KEY",
                "AWS_SESSION_TOKEN",
                "AWS_REGION",
                "AWS_DEFAULT_REGION",
                "AWS_PROFILE",
            ):
                value = aws_credentials.get(key)
                if isinstance(value, str) and value.strip():
                    aws_env_overrides[key] = value.strip()

        def _is_aws_task(text: str) -> bool:
            if not text:
                return False
            lowered = text.lower()
            return any(
                token in lowered
                for token in (
                    "aws",
                    "s3",
                    "s3://",
                    "bucket",
                    "presigned",
                    "iam",
                    "aws_access_key",
                    "aws_secret_access_key",
                    "aws session token",
                    "upload to s3",
                    "s3 upload",
                )
            )

        aws_shell_forced = False
        if _is_aws_task(f"{instructions}\n{input_text}"):
            has_shell = any(
                (isinstance(t, str) and t == "shell")
                or (isinstance(t, dict) and t.get("type") == "shell")
                for t in (tools or [])
            )
            had_code_interpreter = any(
                (isinstance(t, str) and t == "code_interpreter")
                or (isinstance(t, dict) and t.get("type") == "code_interpreter")
                for t in (tools or [])
            )
            if had_code_interpreter or not has_shell:
                tools = [
                    t
                    for t in (tools or [])
                    if not (
                        (isinstance(t, str) and t == "code_interpreter")
                        or (isinstance(t, dict) and t.get("type") == "code_interpreter")
                    )
                ]
                if not has_shell:
                    tools.append({"type": "shell"})
                aws_shell_forced = True

        if aws_shell_forced:
            yield _json.dumps({
                "type": "log",
                "timestamp": time.time(),
                "level": "info",
                "message": (
                    "AWS/S3 task detected: forcing shell tool and disabling code_interpreter."
                ),
            }) + "\n"

        # Validate model compatibility: computer_use_preview tool requires computer-use-preview model
        has_computer_use = any(
            (isinstance(t, str) and t == 'computer_use_preview') or
            (isinstance(t, dict) and t.get('type') == 'computer_use_preview')
            for t in tools
        )

        # #region agent log
        try:
            tool_types = []
            image_tool_model = None
            for t in tools or []:
                if isinstance(t, dict):
                    tt = t.get("type")
                    tool_types.append(tt)
                    if tt == "image_generation" and isinstance(t.get("model"), str):
                        image_tool_model = t.get("model")
                else:
                    tool_types.append(t)
            has_image_generation = any(tt == "image_generation" for tt in tool_types)
            with open("/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log", "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": job_id or "cua-unknown",
                    "hypothesisId": "H1",
                    "location": "cua/lambda_handler.py:process_stream",
                    "message": "CUA request received",
                    "data": {
                        "job_id": job_id,
                        "requested_model": requested_model,
                        "tool_choice": tool_choice,
                        "tools_count": len(tools) if isinstance(tools, list) else None,
                        "tool_types": tool_types,
                        "has_computer_use": has_computer_use,
                        "has_image_generation": has_image_generation,
                        "image_tool_model": image_tool_model,
                        "instructions_len": len(instructions or ""),
                        "input_text_len": len(input_text or ""),
                    },
                    "timestamp": int(time.time() * 1000),
                }) + "\n")
        except Exception:
            pass
        # #endregion

        if has_computer_use and model != 'computer-use-preview':
            logger.warning(f"[CUA] Overriding model from {model} to computer-use-preview (required for computer_use_preview tool)")
            model = 'computer-use-preview'

        # #region agent log
        try:
            with open("/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log", "a") as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": job_id or "cua-unknown",
                    "hypothesisId": "H2",
                    "location": "cua/lambda_handler.py:process_stream",
                    "message": "CUA model selection",
                    "data": {
                        "job_id": job_id,
                        "requested_model": requested_model,
                        "final_model": model,
                        "model_overridden": bool(has_computer_use and requested_model != model),
                        "has_computer_use": has_computer_use,
                    },
                    "timestamp": int(time.time() * 1000),
                }) + "\n")
        except Exception:
            pass
        # #endregion

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
                shell_env_overrides=aws_env_overrides or None,
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

