"""
Editor Overlay Generator
Injects a dormant visual editor overlay into HTML lead magnets.
"""

import json
import logging
import os
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class EditorOverlayGenerator:
    """Generates and injects a visual editor overlay into lead magnet HTML."""

    def __init__(self):
        # Get API URL from environment (preferred for cross-domain calls from CloudFront-served HTML).
        self.api_url = os.environ.get("API_URL") or os.environ.get("API_GATEWAY_URL") or ""
        self.template_path = Path(__file__).parent.parent / "templates" / "editor_overlay.html"

    def generate_editor_overlay_script(
        self, job_id: str, tenant_id: str, api_url: Optional[str] = None
    ) -> str:
        """
        Generate the editor overlay HTML+JS to inject.

        The overlay stays dormant unless the page is opened with `?editMode=true`.
        """

        effective_api_url = (api_url or self.api_url or "").strip().rstrip("/")

        # Escape values to prevent XSS; json.dumps produces JS string literals safely.
        escaped_job_id = json.dumps(job_id)
        escaped_tenant_id = json.dumps(tenant_id)
        escaped_api_url = json.dumps(effective_api_url)

        try:
            template_content = self.template_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.error(f"Failed to read editor overlay template: {e}")
            return ""

        # Replace placeholders
        # Note: The template uses {JOB_ID} etc. (single braces) because we unescaped the f-string double braces.
        script = template_content.replace("{JOB_ID}", escaped_job_id)
        script = script.replace("{TENANT_ID}", escaped_tenant_id)
        script = script.replace("{API_URL}", escaped_api_url)

        return script.strip()

    def inject_editor_overlay(
        self, html_content: str, job_id: str, tenant_id: str, api_url: Optional[str] = None
    ) -> str:
        """
        Inject editor overlay into HTML content (before </body> when present).
        """

        overlay = self.generate_editor_overlay_script(job_id, tenant_id, api_url=api_url)
        if not overlay:
            logger.warning("[EditorOverlayGenerator] No overlay generated; returning original HTML")
            return html_content

        # Insert before closing body tag (case-insensitive).
        if "</body>" in html_content.lower():
            import re

            html_content = re.sub(
                r"</body>",
                overlay + "\n</body>",
                html_content,
                flags=re.IGNORECASE,
            )
        else:
            html_content += "\n" + overlay

        logger.info(
            "[EditorOverlayGenerator] Editor overlay injected into HTML",
            extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "overlay_length": len(overlay),
            },
        )

        return html_content
