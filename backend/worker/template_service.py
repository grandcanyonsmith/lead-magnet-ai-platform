"""
Template Service
Handles template rendering with placeholder replacement.
"""

import re
import logging
from typing import Dict, Any
from jinja2 import Template, Environment, BaseLoader

logger = logging.getLogger(__name__)


class TemplateService:
    """Service for template rendering."""
    
    def __init__(self):
        """Initialize template environment."""
        self.jinja_env = Environment(
            loader=BaseLoader(),
            autoescape=True
        )
    
    def render_template(self, html_content: str, context: Dict[str, Any]) -> str:
        """
        Render HTML template with context data.
        
        Supports two rendering modes:
        1. Simple placeholder replacement: {{PLACEHOLDER}}
        2. Jinja2 templates for more complex logic
        
        Args:
            html_content: HTML template content
            context: Dictionary of values to inject
            
        Returns:
            Rendered HTML
        """
        try:
            # First pass: Simple placeholder replacement
            rendered = self._replace_placeholders(html_content, context)
            
            # Second pass: Jinja2 template rendering (if needed)
            if self._has_jinja_syntax(rendered):
                template = self.jinja_env.from_string(rendered)
                rendered = template.render(**context)
            
            logger.info("Template rendered successfully")
            return rendered
            
        except Exception as e:
            logger.error(f"Error rendering template: {e}")
            raise
    
    def _replace_placeholders(self, html: str, context: Dict[str, Any]) -> str:
        """Replace {{PLACEHOLDER}} with context values."""
        
        def replace_match(match):
            placeholder = match.group(1)
            value = context.get(placeholder, match.group(0))  # Keep original if not found
            return str(value)
        
        # Replace {{PLACEHOLDER}} patterns
        pattern = r'\{\{([A-Z_]+)\}\}'
        result = re.sub(pattern, replace_match, html)
        
        return result
    
    def _has_jinja_syntax(self, html: str) -> bool:
        """Check if HTML contains Jinja2 syntax."""
        # Check for Jinja2 control structures
        jinja_patterns = [
            r'\{%\s*(if|for|block|macro|set)',
            r'\{\{\s*[a-z_]',  # Variable references (lowercase)
        ]
        
        for pattern in jinja_patterns:
            if re.search(pattern, html):
                return True
        
        return False
    
    def extract_placeholders(self, html: str) -> list:
        """Extract all {{PLACEHOLDER}} tags from HTML."""
        pattern = r'\{\{([A-Z_]+)\}\}'
        matches = re.findall(pattern, html)
        return list(set(matches))  # Remove duplicates

