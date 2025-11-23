"""OpenAI API client for making actual API calls."""
import logging
import openai
from typing import Any, Dict

from services.api_key_manager import APIKeyManager

logger = logging.getLogger(__name__)


class OpenAIAPIClient:
    """Handles core OpenAI API interactions."""
    
    def __init__(self, image_handler=None):
        """
        Initialize OpenAI API client.
        
        Args:
            image_handler: Optional OpenAIImageHandler instance for error recovery
        """
        self.openai_api_key = APIKeyManager.get_openai_key()
        self.client = openai.OpenAI(api_key=self.openai_api_key)
        self.image_handler = image_handler
    
    def create_response(self, **params):
        """
        Create a response using OpenAI Responses API.
        Supports code_interpreter and other modern tools natively.
        
        Handles image download timeouts by:
        1. Attempting to download problematic URLs locally and convert to base64
        2. If that fails, skipping the problematic image and retrying
        
        Args:
            **params: Parameters to pass to OpenAI Responses API
            
        Returns:
            OpenAI API response
        """
        # Track retry attempts to prevent infinite loops
        retry_attempted = params.pop('_retry_attempted', False)
        
        try:
            # Log the request parameters for debugging
            job_id = params.get('job_id') if 'job_id' in params else None
            tenant_id = params.get('tenant_id') if 'tenant_id' in params else None
            
            logger.info("[OpenAI API Client] Making Responses API call", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'model': params.get('model'),
                'has_tools': 'tools' in params and params.get('tools'),
                'tools_count': len(params.get('tools', [])) if params.get('tools') else 0,
                'tools': params.get('tools', []),
                'tool_choice': params.get('tool_choice', 'auto'),
                'instructions_length': len(params.get('instructions', '')),
                'input_length': len(params.get('input', '')),
                'retry_attempted': retry_attempted
            })
            
            # ACTUAL API CALL HAPPENS HERE
            logger.info("[OpenAI API Client] ⚡ MAKING OPENAI RESPONSES API CALL NOW ⚡", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'model': params.get('model'),
                'has_tools': 'tools' in params and params.get('tools'),
                'tools': params.get('tools', []),
                'tool_choice': params.get('tool_choice')
            })
            
            response = self.client.responses.create(**params)
            
            # Log response structure immediately after receiving it
            logger.info("[OpenAI API Client] ✅ RECEIVED RESPONSES API RESPONSE ✅", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'response_type': type(response).__name__,
                'has_output': hasattr(response, 'output'),
                'has_output_text': hasattr(response, 'output_text'),
                'has_tool_calls': hasattr(response, 'tool_calls'),
                'output_length': len(response.output) if hasattr(response, 'output') and response.output else 0,
                'output_text_length': len(response.output_text) if hasattr(response, 'output_text') else 0,
                'tool_calls_length': len(response.tool_calls) if hasattr(response, 'tool_calls') and response.tool_calls else 0
            })
            
            # Log each output item type for debugging
            if hasattr(response, 'output') and response.output:
                output_item_types = []
                for item in response.output:
                    item_class = type(item).__name__
                    item_type = getattr(item, 'type', None)
                    output_item_types.append({
                        'class': item_class,
                        'type': str(item_type) if item_type else None,
                        'has_result': hasattr(item, 'result')
                    })
                logger.info("[OpenAI API Client] Response output items breakdown", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'output_items': output_item_types
                })
            
            return response
        except openai.BadRequestError as e:
            # Check if this is an image download timeout error and attempt recovery
            if self.image_handler and self.image_handler._is_image_download_timeout_error(e):
                response = self.image_handler._handle_image_download_timeout_error(
                    error=e,
                    params=params,
                    retry_attempted=retry_attempted,
                    retry_callback=lambda new_params: self.create_response(**new_params),
                    job_id=job_id,
                    tenant_id=tenant_id
                )
                if response is not None:
                    return response
            
            # Not an image download error, recovery failed, or already retried - re-raise
            is_download_error = False
            if self.image_handler:
                try:
                    is_download_error = self.image_handler._is_image_download_timeout_error(e)
                except Exception:
                    pass
            
            logger.error(f"[OpenAI API Client] Error calling OpenAI Responses API: {e}", exc_info=True, extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'model': params.get('model'),
                'tools': params.get('tools', []),
                'error_type': type(e).__name__,
                'error_message': str(e),
                'is_download_error': is_download_error,
                'retry_attempted': retry_attempted
            })
            raise
        except Exception as e:
            logger.error(f"[OpenAI API Client] Error calling OpenAI Responses API: {e}", exc_info=True, extra={
                'job_id': params.get('job_id') if 'job_id' in params else None,
                'tenant_id': params.get('tenant_id') if 'tenant_id' in params else None,
                'model': params.get('model'),
                'tools': params.get('tools', []),
                'error_type': type(e).__name__,
                'error_message': str(e)
            })
            raise
    
    def create_chat_completion(self, **params):
        """Legacy method for backwards compatibility - now uses Responses API."""
        return self.create_response(**params)
    
    def make_api_call(self, params: Dict):
        """Make API call to OpenAI Responses API."""
        return self.create_response(**params)

