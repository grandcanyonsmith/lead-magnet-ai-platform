"""HTML generation utilities."""
import logging

logger = logging.getLogger(__name__)


class HTMLGenerator:
    """Generates HTML content using OpenAI."""
    
    def __init__(self, openai_client):
        """Initialize HTML generator with OpenAI client."""
        self.openai_client = openai_client
    
    def generate_html(self, content: str, instructions: str = "") -> str:
        """Pass through content as HTML."""
        return content
    
    def rewrite_html(self, html_content: str, model: str = 'gpt-5.2') -> str:
        """Rewrite/enhance HTML content."""
        return html_content
