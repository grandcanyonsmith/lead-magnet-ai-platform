"""
PDF Generator Service
Renders HTML into a PDF using Playwright.
"""

import logging
import os
from typing import Optional

from playwright.sync_api import sync_playwright  # type: ignore

logger = logging.getLogger(__name__)


def _env_flag_is_true(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _env_flag_is_false(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("0", "false", "no", "n", "off")


def _running_in_lambda() -> bool:
    return bool(
        os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("AWS_EXECUTION_ENV")
        or os.environ.get("LAMBDA_TASK_ROOT")
    )


def _should_use_single_process() -> bool:
    override = os.environ.get("CUA_PLAYWRIGHT_SINGLE_PROCESS")
    if _env_flag_is_true(override):
        return True
    if _env_flag_is_false(override):
        return False
    return _running_in_lambda()


def _should_disable_sandbox() -> bool:
    override = os.environ.get("CUA_PLAYWRIGHT_NO_SANDBOX")
    if _env_flag_is_true(override):
        return True
    if _env_flag_is_false(override):
        return False
    return _running_in_lambda()


class PDFGenerator:
    """Generate PDFs from HTML using Playwright."""

    def __init__(self, page_format: Optional[str] = None, margin: Optional[str] = None):
        self.page_format = page_format or os.environ.get("DELIVERABLE_PDF_PAGE_FORMAT", "Letter")
        self.margin = margin or os.environ.get("DELIVERABLE_PDF_MARGIN", "0.5in")

    def generate_pdf(self, html_content: str) -> bytes:
        if not isinstance(html_content, str) or not html_content.strip():
            raise ValueError("html_content must be a non-empty string")

        launch_args = [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-web-security",
        ]
        if _should_disable_sandbox():
            launch_args += ["--no-sandbox", "--disable-setuid-sandbox"]
        if _should_use_single_process():
            launch_args += ["--single-process"]

        browser = None
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, args=launch_args)
                page = browser.new_page()
                page.set_content(html_content, wait_until="networkidle")
                page.emulate_media(media="screen")

                pdf_bytes = page.pdf(
                    format=self.page_format,
                    print_background=True,
                    prefer_css_page_size=True,
                    margin={
                        "top": self.margin,
                        "right": self.margin,
                        "bottom": self.margin,
                        "left": self.margin,
                    },
                )

                logger.info(
                    "[PDFGenerator] Generated PDF",
                    extra={
                        "page_format": self.page_format,
                        "margin": self.margin,
                        "pdf_size_bytes": len(pdf_bytes),
                    },
                )
                return pdf_bytes
        finally:
            if browser:
                try:
                    browser.close()
                except Exception:
                    logger.warning("[PDFGenerator] Failed to close browser", exc_info=True)
