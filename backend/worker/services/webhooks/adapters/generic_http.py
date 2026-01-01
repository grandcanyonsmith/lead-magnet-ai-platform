import logging
import requests
from typing import Dict, Any
from services.webhooks.adapters.base import WebhookAdapter

logger = logging.getLogger(__name__)

class GenericHttpAdapter(WebhookAdapter):
    """Adapter for generic HTTP webhooks."""
    
    def send(self, payload: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        url = config.get('url')
        method = config.get('method', 'POST')
        headers = config.get('headers', {})
        
        if not url:
            return {'success': False, 'error': 'No URL provided'}
            
        try:
            response = requests.request(
                method=method,
                url=url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            return {
                'success': response.status_code >= 200 and response.status_code < 300,
                'response_status': response.status_code,
                'response_body': response.text[:1000] # Truncate for safety
            }
        except Exception as e:
            logger.error(f"Generic webhook failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
