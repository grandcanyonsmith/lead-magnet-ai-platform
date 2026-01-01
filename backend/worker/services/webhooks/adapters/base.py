from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class WebhookAdapter(ABC):
    """Abstract base class for Webhook adapters."""
    
    @abstractmethod
    def send(self, payload: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a webhook payload.
        
        Args:
            payload: The data to send.
            config: Configuration (url, headers, secrets, etc.)
            
        Returns:
            Dict containing response status, body, and success flag.
        """
        pass
