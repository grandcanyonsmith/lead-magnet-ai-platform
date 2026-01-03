"""OpenAI API client wrapper."""

import logging
import warnings
from typing import Any, Dict, List, Optional

import openai

from services.api_key_manager import APIKeyManager
from services.openai_image_retry_handler import OpenAIImageRetryHandler
from services.openai_request_builder import OpenAIRequestBuilder
from services.openai_response_service import OpenAIResponseService

# Suppress Pydantic serialization warnings globally
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")
warnings.filterwarnings("ignore", message=".*PydanticSerializationUnexpectedValue.*")

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper for OpenAI API calls."""

    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        self.openai_api_key = APIKeyManager.get_openai_key()
        self.client = openai.OpenAI(api_key=self.openai_api_key)
        self.image_retry_handler = OpenAIImageRetryHandler(self)

    @staticmethod
    def _sanitize_api_params(params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove internal-only keys that should never be sent to OpenAI.
        """
        def _strip_key_recursive(obj: Any, key_to_strip: str) -> Any:
            if isinstance(obj, dict):
                return {
                    k: _strip_key_recursive(v, key_to_strip)
                    for k, v in obj.items()
                    if k != key_to_strip
                }
            if isinstance(obj, list):
                return [_strip_key_recursive(v, key_to_strip) for v in obj]
            return obj

        api_params = dict(params)
        api_params.pop("job_id", None)
        api_params.pop("tenant_id", None)
        # The Responses API rejects unknown fields on input items; we sometimes annotate
        # internal events with `is_error`, so strip it defensively before sending.
        api_params = _strip_key_recursive(api_params, "is_error")
        return api_params

    def generate_images(
        self,
        *,
        model: str,
        prompt: str,
        n: int = 1,
        size: str = "auto",
        quality: str = "auto",
        background: Optional[str] = None,
        output_format: Optional[str] = None,
        output_compression: Optional[int] = None,
        response_format: str = "b64_json",
        user: Optional[str] = None,
    ):
        """
        Generate images using the OpenAI Images API.

        NOTE: Some image models (e.g., gpt-image-1.5) are supported via Images API,
        not via the Responses API image_generation tool.
        """
        # The Images API has model-specific parameter support.
        # - gpt-image-* models support output_format/output_compression/background and return b64_json.
        #   They do NOT accept the legacy `response_format` param (OpenAI returns: Unknown parameter).
        # - dalle-* models support legacy `response_format` ("url" | "b64_json") and do not support
        #   output_format/output_compression/background.
        is_gpt_image = isinstance(model, str) and model.strip().lower().startswith("gpt-image")

        params: Dict[str, Any] = {"model": model, "prompt": prompt, "n": n}

        # Optional/legacy: only send when not "auto" to avoid unsupported values on older models.
        if size and size != "auto":
            params["size"] = size
        if quality and quality != "auto":
            params["quality"] = quality

        if is_gpt_image:
            if background is not None:
                params["background"] = background
            if output_format is not None:
                params["output_format"] = output_format
            if output_compression is not None:
                params["output_compression"] = output_compression
        else:
            # Legacy models (e.g., dalle-*) use response_format.
            if response_format:
                params["response_format"] = response_format

        if user is not None:
            params["user"] = user

        try:
            return self.client.images.generate(**params)
        except Exception as e:
            # Defensive fallback for real-world OpenAI param differences.
            msg = str(e)
            if "Unknown parameter: 'response_format'" in msg and "response_format" in params:
                params.pop("response_format", None)
                return self.client.images.generate(**params)
            raise

    @staticmethod
    def build_input_text(context: str, previous_context: str = "") -> str:
        """Build input text for API call (delegates to OpenAIRequestBuilder)."""
        return OpenAIRequestBuilder.build_input_text(context, previous_context)

    def build_api_params(
        self,
        model: str,
        instructions: str,
        input_text: str,
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        has_computer_use: bool = False,
        reasoning_level: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
    ) -> Dict:
        """Build Responses API params (delegates to OpenAIRequestBuilder)."""
        return OpenAIRequestBuilder.build_api_params(
            model=model,
            instructions=instructions,
            input_text=input_text,
            tools=tools,
            tool_choice=tool_choice,
            has_computer_use=has_computer_use,
            reasoning_level=reasoning_level,
            previous_image_urls=previous_image_urls,
            job_id=job_id,
            tenant_id=tenant_id,
            reasoning_effort=reasoning_effort,
            service_tier=service_tier,
            text_verbosity=text_verbosity,
            max_output_tokens=max_output_tokens,
        )

    def create_response(self, **params):
        """
        Create a response using OpenAI Responses API.
        Supports code_interpreter and other modern tools natively.
        """
        job_id = params.get("job_id")
        tenant_id = params.get("tenant_id")

        logger.info("[OpenAI Client] Making Responses API call", extra={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "model": params.get("model"),
            "service_tier": params.get("service_tier"),
            "has_tools": bool(params.get("tools")),
        })

        # Flush logs before making the API call to ensure they're captured
        import sys
        sys.stdout.flush()
        sys.stderr.flush()

        api_params = self._sanitize_api_params(params)

        # #region agent log
        try:
            import json
            import time
            with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "repro-1",
                    "hypothesisId": "check-api-call",
                    "location": "openai_client.py:create_response",
                    "timestamp": int(time.time() * 1000),
                    "message": "Making OpenAI API call",
                    "data": {
                        "model": api_params.get("model"),
                        "tools": [t.get('type') for t in api_params.get("tools", [])],
                        "has_shell": any(t.get('type') == 'shell' for t in api_params.get("tools", [])),
                        "has_computer": any(t.get('type') == 'computer_use_preview' for t in api_params.get("tools", []))
                    }
                }) + '\n')
        except Exception:
            pass
        # #endregion

        try:
            response = self.client.responses.create(**api_params)
            logger.info("[OpenAI Client] ✅ RECEIVED RESPONSES API RESPONSE ✅", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "response_type": type(response).__name__,
            })
            return response
        except openai.BadRequestError as e:
            # #region agent log
            try:
                import json
                import time
                with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({
                        "sessionId": "debug-session",
                        "runId": "repro-4",
                        "hypothesisId": "api-error",
                        "location": "openai_client.py:create_response",
                        "timestamp": int(time.time() * 1000),
                        "message": "OpenAI API BadRequestError",
                        "data": {
                            "error": str(e),
                            "body": getattr(e, "body", {})
                        }
                    }) + '\n')
            except Exception:
                pass
            # #endregion

            # Check for incompatible tool errors (e.g., shell with computer_use_preview)
            error_message = str(e)
            error_body = getattr(e, "body", {}) or {}
            error_info = error_body.get("error", {}) if isinstance(error_body, dict) else {}
            
            # Check if error is about incompatible tools
            if "not supported with computer use" in error_message.lower() or \
               ("tool" in error_message.lower() and "not supported" in error_message.lower()):
                tool_name = None
                if isinstance(error_info, dict):
                    tool_name = error_info.get("param", "").replace("tools[", "").replace("]", "").split(".")[0]
                logger.error(f"[OpenAI Client] Incompatible tool error: {error_message}", extra={
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "error_info": error_info,
                })
                # Re-raise with clearer message
                raise ValueError(f"Incompatible tool detected: {error_message}. Please remove incompatible tools (like 'shell') when using computer_use_preview.")
            
            # 1) Capability fallback (unsupported reasoning/service_tier)
            retry_result = self._handle_capability_error(e, params)
            if retry_result is not None:
                return retry_result

            # 2) Image download recovery (raises if not applicable)
            return self.image_retry_handler.handle_image_download_error(e, params)
        except Exception as api_error:
            logger.exception("[OpenAI Client] API call failed", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "error_type": type(api_error).__name__,
                "error_message": str(api_error),
            })
            sys.stdout.flush()
            sys.stderr.flush()
            raise

    def _handle_capability_error(
        self, error: Exception, params: Dict[str, Any]
    ) -> Optional[Any]:
        """
        If OpenAI rejects newer optional params (e.g., reasoning/service_tier),
        retry once without them. Returns response if retry succeeds, None otherwise.
        """
        error_message = str(error)
        error_body = getattr(error, "body", {}) or {}
        error_info = error_body.get("error", {}) if isinstance(error_body, dict) else {}
        error_param = error_info.get("param") if isinstance(error_info, dict) else None

        unsupported: List[str] = []

        if "reasoning" in params and (
            "reasoning" in error_message
            or (isinstance(error_info, dict) and error_info.get("param") == "reasoning")
            or ("Unknown parameter" in error_message and "reasoning" in error_message)
        ):
            unsupported.append("reasoning")

        if "service_tier" in params and (
            "service_tier" in error_message
            or (isinstance(error_info, dict) and error_info.get("param") == "service_tier")
            or ("Unknown parameter" in error_message and "service_tier" in error_message)
        ):
            unsupported.append("service_tier")

        # Tool schema drift: OpenAI rejects `tools[*].container` for computer_use_preview.
        # If we see that exact failure, strip `container` from all tools and retry once.
        if (
            isinstance(error_param, str)
            and error_param.startswith("tools[")
            and error_param.endswith(".container")
        ) or ("Unknown parameter" in error_message and "tools[" in error_message and ".container" in error_message):
            unsupported.append("tools.container")

        if not unsupported:
            return None

        retry_params = dict(params)
        for key in unsupported:
            if key == "tools.container":
                tools = retry_params.get("tools")
                if isinstance(tools, list):
                    for t in tools:
                        if isinstance(t, dict) and "container" in t:
                            t.pop("container", None)
            else:
                retry_params.pop(key, None)

        logger.warning("[OpenAI Client] Retrying without unsupported params", extra={
            "job_id": params.get("job_id"),
            "tenant_id": params.get("tenant_id"),
            "model": params.get("model"),
            "removed_params": unsupported,
            "original_error": error_message,
        })

        api_retry_params = self._sanitize_api_params(retry_params)
        try:
            return self.client.responses.create(**api_retry_params)
        except Exception:
            return None

    def process_api_response(
        self,
        response,
        model: str,
        instructions: str,
        input_text: str,
        previous_context: str,
        context: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        step_name: Optional[str] = None,
        step_instructions: Optional[str] = None,
    ):
        """Process Responses API response (delegates to OpenAIResponseService)."""
        return OpenAIResponseService.process_api_response(
            response=response,
            model=model,
            instructions=instructions,
            input_text=input_text,
            previous_context=previous_context,
            context=context,
            tools=tools,
            tool_choice=tool_choice,
            params=params,
            image_handler=image_handler,
            tenant_id=tenant_id,
            job_id=job_id,
            step_name=step_name,
            step_instructions=step_instructions,
        )

    def create_chat_completion(self, **params):
        """Legacy method for backwards compatibility - now uses Responses API."""
        return self.create_response(**params)

    def make_api_call(self, params: Dict):
        """Make API call to OpenAI Responses API."""
        return self.create_response(**params)

    def handle_openai_error(
        self,
        error: Exception,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        full_context: str,
        previous_context: str,
        image_handler,
    ):
        """Handle OpenAI API errors with retry logic."""
        logger.error(f"OpenAI API error: {error}", exc_info=True)
        raise Exception(f"OpenAI API error ({type(error).__name__}): {str(error)}")


