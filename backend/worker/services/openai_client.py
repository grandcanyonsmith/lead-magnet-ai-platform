"""OpenAI API client wrapper."""
import logging
import openai
from typing import Dict, List, Optional, Any
import warnings

# Suppress Pydantic serialization warnings globally
warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')

from services.api_key_manager import APIKeyManager
from services.openai_request_builder import OpenAIRequestBuilder
from services.openai_image_retry_handler import OpenAIImageRetryHandler
from services.openai_response_service import OpenAIResponseService

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper for OpenAI API calls."""
    
    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        self.openai_api_key = APIKeyManager.get_openai_key()
        self.client = openai.OpenAI(api_key=self.openai_api_key)
        self.image_retry_handler = OpenAIImageRetryHandler(self)

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

        params: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "n": n,
        }

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
            # If OpenAI rejects a param as unknown, retry once without it.
            msg = str(e)
            if "Unknown parameter: 'response_format'" in msg and "response_format" in params:
                params.pop("response_format", None)
                return self.client.images.generate(**params)
            raise
    
    @staticmethod
    def build_input_text(context: str, previous_context: str = "") -> str:
        """
        Build input text for API call.
        Delegates to OpenAIRequestBuilder.
        """
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
        service_tier: Optional[str] = None
    ) -> Dict:
        """
        Build parameters for OpenAI Responses API call.
        Delegates to OpenAIRequestBuilder.
        """
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
            service_tier=service_tier
        )
    
    def create_response(self, **params):
        """
        Create a response using OpenAI Responses API.
        Supports code_interpreter and other modern tools natively.
        """
        job_id = params.get('job_id')
        tenant_id = params.get('tenant_id')
        
        try:
            logger.info("[OpenAI Client] Making Responses API call", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'model': params.get('model'),
                'service_tier': params.get('service_tier'),
                'has_tools': 'tools' in params and params.get('tools'),
            })
            
            # Flush logs before making the API call
            import sys
            sys.stdout.flush()
            sys.stderr.flush()
            
            try:
                response = self.client.responses.create(**params)
                
                logger.info("[OpenAI Client] ✅ RECEIVED RESPONSES API RESPONSE ✅", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'response_type': type(response).__name__,
                })
                return response
                
            except Exception as api_error:
                logger.exception("[OpenAI Client] API call failed", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'error_type': type(api_error).__name__,
                    'error_message': str(api_error)
                })
                sys.stdout.flush()
                sys.stderr.flush()
                raise
            
        except openai.BadRequestError as e:
            # 1. Try capability fallback (reasoning/service_tier)
            retry_result = self._handle_capability_error(e, params)
            if retry_result:
                return retry_result
            
            # 2. Try image download retry
            try:
                return self.image_retry_handler.handle_image_download_error(e, params)
            except openai.BadRequestError:
                # If image retry fails (or isn't applicable), we re-raise the original error
                # unless handle_image_download_error raised a new one
                pass
                
            # Log and raise original error if no recovery strategy worked
            logger.error(f"[OpenAI Client] Error calling OpenAI Responses API: {e}", exc_info=True, extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'error_type': type(e).__name__,
                'error_message': str(e)
            })
            raise
            
        except Exception as e:
            logger.error(f"[OpenAI Client] Error calling OpenAI Responses API: {e}", exc_info=True, extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                'error_type': type(e).__name__,
                'error_message': str(e)
            })
            raise

    def _handle_capability_error(self, error: Exception, params: Dict[str, Any]) -> Optional[Any]:
        """
        Handle capability errors (unsupported reasoning/service_tier) by retrying without them.
        Returns response if retry succeeds, None otherwise.
        """
        error_message = str(error)
        error_body = getattr(error, 'body', {}) or {}
            error_info = error_body.get('error', {}) if isinstance(error_body, dict) else {}

            try:
                retry_params = None
                unsupported = []
                if 'reasoning' in params and ('reasoning' in error_message or (isinstance(error_info, dict) and error_info.get('param') == 'reasoning')):
                    unsupported.append('reasoning')
                if 'service_tier' in params and ('service_tier' in error_message or (isinstance(error_info, dict) and error_info.get('param') == 'service_tier')):
                    unsupported.append('service_tier')

                # Some OpenAI errors use "Unknown parameter" wording
                if 'reasoning' in params and 'Unknown parameter' in error_message and 'reasoning' in error_message:
                    if 'reasoning' not in unsupported:
                        unsupported.append('reasoning')
                if 'service_tier' in params and 'Unknown parameter' in error_message and 'service_tier' in error_message:
                    if 'service_tier' not in unsupported:
                        unsupported.append('service_tier')

                if unsupported:
                    retry_params = params.copy()
                    for key in unsupported:
                        retry_params.pop(key, None)

                    logger.warning("[OpenAI Client] Retrying Responses API call without unsupported params", extra={
                    'job_id': params.get('job_id'),
                    'tenant_id': params.get('tenant_id'),
                        'model': params.get('model'),
                        'removed_params': unsupported,
                        'original_error': error_message,
                    })

                    return self.client.responses.create(**retry_params)
            except Exception:
            # If the retry attempt itself fails unexpectedly, fall through
            pass
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
        step_instructions: Optional[str] = None
    ):
        """
        Process Responses API response and return formatted results.
        Delegates to OpenAIResponseService.
        """
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
            step_instructions=step_instructions
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
        image_handler
    ):
        """Handle OpenAI API errors with retry logic."""
        logger.error(f"OpenAI API error: {error}", exc_info=True)
        raise Exception(f"OpenAI API error ({type(error).__name__}): {str(error)}")
