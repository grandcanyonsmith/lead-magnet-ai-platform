import logging
import requests
from typing import Dict, Any
from services.webhooks.adapters.base import WebhookAdapter

logger = logging.getLogger(__name__)

class SlackAdapter(WebhookAdapter):
    """Adapter for Slack incoming webhooks."""
    
    def send(self, payload: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        url = config.get('url')
        if not url:
            return {'success': False, 'error': 'No Slack URL provided'}
            
        # Transform payload to Slack format if needed
        slack_payload = {
            "text": payload.get('message', str(payload))
        }
        
        try:
            response = requests.post(url, json=slack_payload, timeout=10)
            return {
                'success': response.status_code == 200,
                'response_status': response.status_code,
                'response_body': response.text
            }
        except Exception as e:
            logger.error(f"Slack webhook failed: {e}")
            return {'success': False, 'error': str(e)}
