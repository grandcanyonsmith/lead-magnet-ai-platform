import logging
import time
import re
from typing import Dict, Any, List, Optional, Tuple

from services.cua.types import LogEvent, ScreenshotEvent
from services.cua.environment import Environment
from .agent_utils import is_likely_filename_domain
from core.prompts import COMPUTER_AGENT_TOOL_GUIDANCE

logger = logging.getLogger(__name__)

class AgentLoopHandler:
    """Helper class to handle initialization and setup for the CUAgent loop."""

    def __init__(self, environment: Environment, image_handler: Any):
        self.env = environment
        self.image_handler = image_handler

    async def initialize_environment(self, tools: List[Dict]) -> Tuple[int, int]:
        """Initialize the environment with appropriate display settings."""
        display_width = 1024
        display_height = 768
        for tool in tools:
            t_type = tool.get('type') if isinstance(tool, dict) else tool
            if t_type == 'computer_use_preview' and isinstance(tool, dict):
                display_width = int(tool.get('display_width', 1024))
                display_height = int(tool.get('display_height', 768))
                break

        await self.env.initialize(display_width, display_height)
        return display_width, display_height

    async def perform_initial_navigation(self, instructions: str, input_text: str) -> Tuple[str, Optional[str]]:
        """
        Detect URL in instructions/input and navigate to it.
        Returns (target_url, error_message).
        """
        url_search_text = f"{instructions or ''}\n{input_text or ''}".strip()
        url_pattern = r'https?://[^\s<>"\'\)]+'
        url_match = re.search(url_pattern, url_search_text)
        initial_url = None
        
        if url_match:
            initial_url = url_match.group(0).rstrip('.,;!?)')
        else:
            domain_pattern = r'(?:go to |visit |navigate to |open )?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(?:\.[a-zA-Z]{2,}))'
            domain_match = re.search(domain_pattern, url_search_text, re.IGNORECASE)
            if domain_match:
                domain = domain_match.group(1)
                if domain and not domain.lower() in ['com', 'org', 'net', 'io', 'ai', 'the', 'and', 'for']:
                    if is_likely_filename_domain(domain):
                        domain = None
                if domain:
                    initial_url = f"https://{domain}"
        
        target_url = initial_url if initial_url else "https://www.bing.com"
        error_msg = None

        try:
            await self.env.execute_action({'type': 'navigate', 'url': target_url})
        except Exception as e:
            logger.warning(f"Failed to navigate to {target_url}: {e}")
            error_msg = str(e)
        
        return target_url, error_msg

    async def capture_initial_screenshot(self, tenant_id: Optional[str], job_id: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Capture initial screenshot and upload to S3.
        Returns (screenshot_b64, current_url, s3_url).
        """
        try:
            screenshot_b64 = await self.env.capture_screenshot()
            current_url = await self.env.get_current_url()
            url = self.image_handler.upload_base64_image_to_s3(
                screenshot_b64, 'image/jpeg', tenant_id=tenant_id, job_id=job_id
            )
            return screenshot_b64, current_url, url
        except Exception as e:
            logger.error(f"Initial screenshot failed: {e}")
            return None, None, None

    def prepare_instructions(self, instructions: str, has_computer_use: bool, has_shell: bool) -> str:
        """Prepare instructions with tool guidance if needed."""
        instructions_for_model = instructions or ""
        if has_computer_use and has_shell:
            hint = COMPUTER_AGENT_TOOL_GUIDANCE
            if hint not in instructions_for_model:
                instructions_for_model = (instructions_for_model or "").rstrip()
                instructions_for_model = (
                    f"{instructions_for_model}\n\n{hint}"
                    if instructions_for_model
                    else hint
                )
        return instructions_for_model

    def build_initial_user_message(
        self,
        input_text: str,
        target_url: str,
        current_url: Optional[str],
        nav_error: Optional[str]
    ) -> str:
        """Build the initial user message text."""
        user_text = (input_text or "").strip() or "Start the task."
        if current_url:
            user_text = f"{user_text}\n\n(Current URL: {current_url})"

        if nav_error:
            user_text = (
                f"{user_text}\n\nWARNING: Initial navigation to {target_url} failed with error: "
                f"{nav_error}. Please check the URL or try a different one."
            )
        return user_text
