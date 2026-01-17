"""
OpenAI Image Retry Handler Service

When using the Responses API with image inputs, OpenAI may fail to download certain
URLs (e.g. auth-gated, blocked user-agent, short-lived signed URLs). This handler
recovers by downloading those images locally and converting them to data URLs,
then retrying the OpenAI call.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import openai

from utils.image_utils import clean_image_url, download_image_and_convert_to_data_url

logger = logging.getLogger(__name__)


class OpenAIImageRetryHandler:
    """Retry OpenAI Responses API calls when image URL downloads fail."""

    def __init__(self, openai_client: Any):
        """
        Args:
            openai_client: Either the wrapper OpenAIClient (with `.client`) or the raw
                          OpenAI SDK client. Must support `.responses.create(...)`.
        """
        self._client = getattr(openai_client, "client", openai_client)

    def handle_image_download_error(
        self,
        error: openai.BadRequestError,
        params: Dict[str, Any],
        max_retries: int = 10,
    ) -> Any:
        """
        Attempt to recover from image download errors by converting URL images to data URLs.

        Raises:
            openai.BadRequestError: if the error is not an image download error, or if recovery fails.
        """
        error_message = str(error)
        error_body = getattr(error, "body", {}) or {}
        error_info = error_body.get("error", {}) if isinstance(error_body, dict) else {}

        if not self._is_image_download_error(error_message, error_info):
            raise error

        current_error: openai.BadRequestError = error
        current_params: Dict[str, Any] = dict(params)
        removed_urls: List[str] = []

        for attempt in range(1, max_retries + 1):
            failed_url = self._extract_failed_url(str(current_error), error_info)

            content = self._get_input_content(current_params)
            if content is None:
                break

            image_items = [item for item in content if isinstance(item, dict) and item.get("type") == "input_image"]
            if not image_items:
                # Nothing to fix; re-raise original
                break

            # Mutate content into a new list (don't mutate in place)
            new_content = self._fix_content_images(
                content=content,
                failed_url=failed_url,
                removed_urls=removed_urls,
                job_id=current_params.get("job_id"),
                tenant_id=current_params.get("tenant_id"),
                attempt=attempt,
            )

            current_params["input"] = [{"role": "user", "content": new_content}]

            api_params = self._sanitize_api_params(current_params)

            try:
                return self._client.responses.create(**api_params)
            except openai.BadRequestError as retry_error:
                retry_message = str(retry_error)
                retry_body = getattr(retry_error, "body", {}) or {}
                retry_info = retry_body.get("error", {}) if isinstance(retry_body, dict) else {}

                if self._is_image_download_error(retry_message, retry_info):
                    current_error = retry_error
                    error_info = retry_info if isinstance(retry_info, dict) else {}
                    continue
                raise

        logger.error("[OpenAI Image Retry] Exceeded maximum retries for URL errors", extra={
            "job_id": params.get("job_id"),
            "tenant_id": params.get("tenant_id"),
            "retry_count": max_retries,
            "removed_urls_count": len(removed_urls),
            "removed_urls_preview": removed_urls[:5],
        })
        raise error

    @staticmethod
    def _sanitize_api_params(params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove internal-only keys that should never be sent to OpenAI.
        """
        api_params = dict(params)
        api_params.pop("job_id", None)
        api_params.pop("tenant_id", None)
        if "max_output_tokens" not in api_params:
            if api_params.get("max_completion_tokens") is not None:
                api_params["max_output_tokens"] = api_params.pop("max_completion_tokens")
            elif api_params.get("max_tokens") is not None:
                api_params["max_output_tokens"] = api_params.pop("max_tokens")
        else:
            api_params.pop("max_completion_tokens", None)
            api_params.pop("max_tokens", None)
        return api_params

    @staticmethod
    def _get_input_content(params: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        """
        Returns the `content` list from a Responses API `input` payload, or None if not present.
        """
        input_data = params.get("input")
        if not isinstance(input_data, list) or not input_data:
            return None

        first = input_data[0]
        if not isinstance(first, dict):
            return None

        content = first.get("content")
        if not isinstance(content, list):
            return None

        # Ensure we only return dict items (defensive)
        return [c for c in content if isinstance(c, dict)]

    @staticmethod
    def _is_image_download_error(error_message: str, error_info: Any) -> bool:
        """
        Detect OpenAI 'Error while downloading ...' failures.
        """
        return (
            "Error while downloading" in error_message
            or "downloading" in error_message.lower()
            or (
                isinstance(error_info, dict)
                and error_info.get("code") == "invalid_value"
                and error_info.get("param") == "url"
            )
        )

    @staticmethod
    def _extract_failed_url(error_message: str, error_info: Any) -> Optional[str]:
        """
        Extract the failed image URL from error message (best-effort).
        """
        failed = None
        if "Error while downloading" in error_message:
            # Strategy 1: after "downloading "
            m = re.search(
                r"downloading\s+(https?://[^\s<>\"{}|\\^`\[\]]+)",
                error_message,
                re.IGNORECASE,
            )
            if m:
                failed = clean_image_url(m.group(1))

            # Strategy 2: image extension match
            if not failed:
                m2 = re.search(
                    r"https?://[^\s<>\"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?[^\s<>\"{}|\\^`\[\]]*)?[^\s<>\"{}|\\^`\[\]]*",
                    error_message,
                    re.IGNORECASE,
                )
                if m2:
                    failed = clean_image_url(m2.group(0))

        # Strategy 3: error dict
        if not failed and isinstance(error_info, dict):
            maybe = error_info.get("url") or error_info.get("param")
            if isinstance(maybe, str):
                failed = clean_image_url(maybe)

        return failed

    @staticmethod
    def _fix_content_images(
        *,
        content: List[Dict[str, Any]],
        failed_url: Optional[str],
        removed_urls: List[str],
        job_id: Optional[str],
        tenant_id: Optional[str],
        attempt: int,
    ) -> List[Dict[str, Any]]:
        """
        Return a new content list with failed image URLs replaced by data URLs (or removed).
        """
        if failed_url:
            logger.warning("[OpenAI Image Retry] Attempting to fix failed image URL", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "attempt": attempt,
                "failed_url_preview": failed_url[:120] + "..." if len(failed_url) > 120 else failed_url,
            })

            data_url = download_image_and_convert_to_data_url(
                url=failed_url,
                job_id=job_id,
                tenant_id=tenant_id,
            )

            if data_url:
                replaced = 0
                new_content: List[Dict[str, Any]] = []
                for item in content:
                    if item.get("type") == "input_image":
                        image_url = str(item.get("image_url", ""))
                        if failed_url in image_url or image_url in failed_url:
                            new_content.append({"type": "input_image", "image_url": data_url})
                            replaced += 1
                        else:
                            new_content.append(item)
                    else:
                        new_content.append(item)

                if replaced > 0:
                    logger.info("[OpenAI Image Retry] Replaced failed image URL with data URL", extra={
                        "job_id": job_id,
                        "tenant_id": tenant_id,
                        "attempt": attempt,
                        "replaced_count": replaced,
                    })
                    return new_content

            # If we couldn't convert (or couldn't match), remove the failed image entries
            removed_urls.append(failed_url)
            logger.warning("[OpenAI Image Retry] Removing failed image URL from request", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "attempt": attempt,
                "removed_urls_count": len(removed_urls),
            })
            return [
                item
                for item in content
                if not (
                    item.get("type") == "input_image"
                    and (
                        failed_url in str(item.get("image_url", ""))
                        or str(item.get("image_url", "")) in failed_url
                    )
                )
            ]

        # No specific failed URL -> convert all remaining URL images to data URLs (best effort)
        logger.warning("[OpenAI Image Retry] Could not extract specific URL; converting all images to data URLs", extra={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "attempt": attempt,
        })

        new_content: List[Dict[str, Any]] = []
        for item in content:
            if item.get("type") != "input_image":
                new_content.append(item)
                continue

            image_url = item.get("image_url")
            if isinstance(image_url, str) and image_url.startswith("data:"):
                new_content.append(item)
                continue

            if not isinstance(image_url, str) or not image_url.strip():
                continue

            data_url = download_image_and_convert_to_data_url(
                url=image_url,
                job_id=job_id,
                tenant_id=tenant_id,
            )
            if data_url:
                new_content.append({"type": "input_image", "image_url": data_url})
            else:
                removed_urls.append(image_url)

        return new_content


