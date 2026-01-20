import logging
import re
import os
import boto3
import requests
from urllib.parse import urlparse
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class S3ContextService:
    """Service for handling S3 context injection and publishing."""

    def __init__(self, db_service, s3_service, artifact_service):
        self.db = db_service
        self.s3 = s3_service
        self.artifact_service = artifact_service

    def parse_s3_upload_target_from_instructions(
        self,
        instructions: Any,
    ) -> Optional[Dict[str, str]]:
        """
        Best-effort parse of an S3 upload request from a step's instructions.
        """
        if not isinstance(instructions, str):
            return None
        lower = instructions.lower()
        if "s3" not in lower:
            return None
        # Accept common intent verbs beyond "upload" (e.g., "write an html file to an s3 bucket").
        if not any(k in lower for k in ["upload", "write", "save", "put", "copy"]):
            return None

        bucket = None

        # Prefer explicit s3://bucket form
        m = re.search(r"s3://([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])", lower)
        if m:
            bucket = m.group(1)
        else:
            # Fallback: "bucket <name>"
            m2 = re.search(r"\bbucket\s+([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\b", lower)
            if m2:
                bucket = m2.group(1)

        if not bucket:
            # Fallback: "<bucket> s3 bucket" (common phrasing)
            m2b = re.search(
                r"\b([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\s+s3\s+bucket\b", lower
            )
            if m2b:
                bucket = m2b.group(1)

        if not bucket:
            return None

        region = None
        # Prefer canonical region format
        m3 = re.search(r"\b([a-z]{2}-[a-z0-9-]+-\d)\b", lower)
        if m3:
            region = m3.group(1)
        else:
            # Common US region phrases (e.g. "us west 2")
            m4 = re.search(r"\b(us)\s+(east|west)\s+(\d)\b", lower)
            if m4:
                region = f"{m4.group(1)}-{m4.group(2)}-{m4.group(3)}"

        if not region:
            region = os.environ.get("AWS_REGION", "us-east-1")

        return {"bucket": bucket, "region": region}

    def _get_allowed_s3_upload_buckets(self) -> List[str]:
        raw = (os.environ.get("SHELL_S3_UPLOAD_ALLOWED_BUCKETS") or "cc360-pages").strip()
        return [b.strip() for b in raw.split(",") if b and b.strip()]

    def _shell_manifest_enabled(self) -> bool:
        mode = (os.environ.get("SHELL_EXECUTOR_UPLOAD_MODE") or "").strip().lower()
        bucket = (os.environ.get("SHELL_EXECUTOR_UPLOAD_BUCKET") or "").strip()
        return mode == "manifest" and bool(bucket)

    def _shell_manifest_path(self) -> str:
        manifest_path = (os.environ.get("SHELL_EXECUTOR_MANIFEST_PATH") or "").strip()
        if manifest_path:
            return manifest_path
        manifest_name = (os.environ.get("SHELL_EXECUTOR_MANIFEST_NAME") or "shell_executor_manifest.json").strip()
        return f"/work/{manifest_name}"

    def maybe_inject_shell_manifest_context(
        self,
        *,
        step_tools: List[Dict[str, Any]],
        current_step_context: str,
    ) -> str:
        """
        If shell uploads are enabled in manifest mode, inject instructions for creating
        a manifest file listing generated assets to upload.
        """
        if not self._shell_manifest_enabled():
            return current_step_context

        has_shell = any(
            isinstance(t, dict) and t.get("type") == "shell" for t in (step_tools or [])
        )
        if not has_shell:
            return current_step_context

        bucket = (os.environ.get("SHELL_EXECUTOR_UPLOAD_BUCKET") or "cc360-pages").strip()
        manifest_path = self._shell_manifest_path()

        block = "\n".join([
            "=== Shell Upload Manifest (Required for Asset Persistence) ===",
            "When you create files that must persist, write a JSON manifest file at:",
            f"{manifest_path}",
            "",
            "Manifest format:",
            "{",
            f"  \"bucket\": \"{bucket}\",",
            "  \"prefix\": \"{project_slug}/{runtime_date_yyyymmdd}/\",",
            "  \"files\": [",
            "    \"/work/dist/index.html\",",
            "    \"/work/dist/thank-you.html\",",
            "    \"/work/dist/privacy.html\",",
            "    \"/work/dist/terms.html\",",
            "    \"/work/dist/reset-kit.css\",",
            "    \"/work/dist/reset-kit.js\",",
            "    \"/work/dist/assets/pdf/<pdf>.pdf\",",
            "    \"/work/dist/assets/img/previews/<preview>.png\"",
            "  ]",
            "}",
            "",
            "Rules:",
            "- Use absolute /work/... paths in the files list (the executor maps them safely).",
            "- Prefix must use the canonical project_slug + runtime_date_yyyymmdd.",
            "- Include every file you created that should be uploaded.",
            "===============================================",
        ])

        if current_step_context and isinstance(current_step_context, str) and current_step_context.strip():
            return f"{current_step_context}\n\n{block}"
        return block

    def _auto_webhook_from_instructions_enabled(self) -> bool:
        return (os.environ.get("AUTO_WEBHOOK_FROM_INSTRUCTIONS") or "").strip().lower() == "true"

    def _get_auto_webhook_allowed_hosts(self) -> List[str]:
        raw = (os.environ.get("AUTO_WEBHOOK_ALLOWED_HOSTS") or "").strip()
        return [h.strip().lower() for h in raw.split(",") if h and h.strip()]

    def _parse_object_url_webhook_target_from_instructions(self, instructions: Any) -> Optional[str]:
        if not self._auto_webhook_from_instructions_enabled():
            return None
        if not isinstance(instructions, str):
            return None

        lower = instructions.lower()
        if (
            "object url" not in lower
            and "object_url" not in lower
            and "object-url" not in lower
        ):
            return None
        if "send" not in lower and "post" not in lower:
            return None

        urls = re.findall(r"https?://[^\s<>\"]+", instructions)
        if not urls:
            return None

        allowed_hosts = set(self._get_auto_webhook_allowed_hosts())
        if not allowed_hosts:
            return None

        for raw_url in urls:
            url = str(raw_url).rstrip(").,;\"'")
            try:
                parsed = urlparse(url)
                host = (parsed.netloc or "").lower()
                if not host:
                    continue
                # Strip userinfo + port if present
                host = host.split("@")[-1].split(":")[0]
                if host in allowed_hosts:
                    return url
            except Exception:
                continue

        return None

    def _get_s3_upload_key_prefix(self, *, tenant_id: str, job_id: str) -> str:
        # Default prefix keeps uploads scoped and traceable.
        prefix = (os.environ.get("SHELL_S3_UPLOAD_KEY_PREFIX") or f"leadmagnet/{tenant_id}/{job_id}/").strip()
        prefix = prefix.lstrip("/")  # avoid accidental absolute-like keys
        if ".." in prefix:
            raise ValueError("Invalid SHELL_S3_UPLOAD_KEY_PREFIX (must not contain '..')")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        return prefix

    def _sanitize_s3_key_filename(self, filename: str) -> str:
        # Keep it simple/safe for S3 keys and shell usage.
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.strip())
        return safe or "artifact.bin"

    def _find_last_artifact_id(self, step_outputs: List[Dict[str, Any]]) -> Optional[str]:
        for prev in reversed(step_outputs or []):
            aid = prev.get("artifact_id") if isinstance(prev, dict) else None
            if isinstance(aid, str) and aid.strip():
                return aid.strip()
        return None

    def maybe_inject_s3_upload_context(
        self,
        *,
        step: Dict[str, Any],
        step_index: int,
        tenant_id: str,
        job_id: str,
        current_step_context: str,
        step_outputs: List[Dict[str, Any]],
        step_tools: List[Dict[str, Any]],
    ) -> str:
        """
        If the step instructions ask to upload a previous-step artifact to an allowed S3 bucket,
        inject a structured context block containing SOURCE_ARTIFACT_URL + DEST_PUT_URL + DEST_OBJECT_URL.
        """
        has_shell = any(
            isinstance(t, dict) and t.get("type") == "shell" for t in (step_tools or [])
        )
        if not has_shell:
            return current_step_context

        instructions = step.get("instructions", "")
        target = self.parse_s3_upload_target_from_instructions(instructions)
        if not target:
            return current_step_context

        bucket = target["bucket"]
        region = target["region"]

        allowed = set(self._get_allowed_s3_upload_buckets())
        if bucket not in allowed:
            raise ValueError(
                f"S3 upload bucket '{bucket}' is not allowed. "
                f"Set SHELL_S3_UPLOAD_ALLOWED_BUCKETS to include it."
            )

        source_artifact_id = self._find_last_artifact_id(step_outputs)
        if not source_artifact_id:
            logger.warning("[S3ContextService] S3 upload requested but no previous artifact_id found; skipping upload context", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "step_index": step_index,
                "dest_bucket": bucket,
                "dest_region": region,
            })
            return current_step_context

        artifact = self.db.get_artifact(source_artifact_id)  # raises on DB issues
        if not artifact:
            raise ValueError(f"Artifact {source_artifact_id} not found")

        source_url = artifact.get("public_url") or self.artifact_service.get_artifact_public_url(source_artifact_id)
        if not isinstance(source_url, str) or not source_url.strip():
            raise ValueError(f"Artifact {source_artifact_id} has no public_url")

        filename = artifact.get("artifact_name") or f"{source_artifact_id}.bin"
        filename = self._sanitize_s3_key_filename(str(filename))
        content_type = artifact.get("mime_type") or "application/octet-stream"

        prefix = self._get_s3_upload_key_prefix(tenant_id=tenant_id, job_id=job_id)
        # Avoid accidental overwrites if multiple steps/artifacts share the same filename.
        dest_key = f"{prefix}{source_artifact_id}-{filename}"

        expires_in = int(os.environ.get("SHELL_S3_UPLOAD_PUT_EXPIRES_IN", "1800"))
        s3 = boto3.client("s3", region_name=region)
        dest_put_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": bucket, "Key": dest_key, "ContentType": str(content_type)},
            ExpiresIn=max(60, min(7 * 24 * 60 * 60, expires_in)),
        )

        # Public object URL (assumes bucket/object is public via bucket policy/CloudFront).
        dest_object_url = f"https://{bucket}.s3.{region}.amazonaws.com/{dest_key}"

        block = "\n".join([
            "=== S3 Upload (Computer Use / Shell Tool) ===",
            "Use the 'shell' tool (if available) or built-in file upload capability to upload the artifact.",
            "If using 'shell', run:",
            f"curl -X PUT -T <file> -H 'Content-Type: {content_type}' '{dest_put_url}'",
            "",
            "If this step involves capturing a screenshot or generating a file:",
            f"TARGET_BUCKET: {bucket}",
            f"TARGET_KEY: {dest_key}",
            f"PRESIGNED_PUT_URL: {dest_put_url}",
            f"FINAL_OBJECT_URL: {dest_object_url}",
            "",
            "If using 'computer_use_preview' to browse and capture a screenshot:",
            "The screenshot is automatically uploaded. To use a custom bucket/key, you must use the URL below.",
            "However, currently automatic screenshots use a system bucket.",
            "=============================="
        ])

        logger.info("[S3ContextService] Injected S3 upload context", extra={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "step_index": step_index,
            "dest_bucket": bucket,
            "dest_region": region,
            "source_artifact_id": source_artifact_id,
        })

        if current_step_context and isinstance(current_step_context, str) and current_step_context.strip():
            return f"{current_step_context}\n\n{block}"
        return block

    def maybe_inject_s3_publish_output_only_context(
        self,
        *,
        step: Dict[str, Any],
        current_step_context: str,
    ) -> str:
        """
        If the instructions look like "generate an HTML file and publish it to S3",
        inject a note telling the model to output ONLY the HTML (no AWS commands).
        """
        instructions = step.get("instructions", "")
        target = self.parse_s3_upload_target_from_instructions(instructions)
        if not target:
            return current_step_context

        if not isinstance(instructions, str):
            return current_step_context
        lower = instructions.lower()

        # Heuristic: only inject when the step appears to be generating HTML content.
        looks_like_html_generation = (
            ("html" in lower or "website" in lower or "landing page" in lower)
            and any(k in lower for k in ["write", "create", "generate", "build", "design"])
        )
        if not looks_like_html_generation:
            return current_step_context

        bucket = target["bucket"]
        region = target["region"]

        block = "\n".join([
            "=== S3 Publish Note ===",
            "This platform will upload your final HTML output to S3 after you respond.",
            f"Target: s3://{bucket} ({region})",
            "",
            "IMPORTANT:",
            "- Do NOT include AWS CLI commands, curl commands, or webhook calls.",
            "- Output MUST be the complete HTML file contents only (valid HTML5).",
            "- No Markdown, no explanations, no code fences.",
        ])

        if current_step_context and isinstance(current_step_context, str) and current_step_context.strip():
            return f"{current_step_context}\n\n{block}"
        return block

    def maybe_publish_current_step_output_to_s3(
        self,
        *,
        step: Dict[str, Any],
        step_index: int,
        tenant_id: str,
        job_id: str,
        step_name: str,
        step_output_result: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        If this step's instructions ask to upload the *generated HTML output* to an allowed S3 bucket,
        perform the upload server-side.
        """
        instructions = step.get("instructions", "")
        target = self.parse_s3_upload_target_from_instructions(instructions)
        if not target:
            return None

        output_text = step_output_result.get("output")
        if not isinstance(output_text, str) or not output_text.strip():
            return None

        artifact_id = step_output_result.get("artifact_id")
        if not isinstance(artifact_id, str) or not artifact_id.strip():
            return None
        artifact_id = artifact_id.strip()

        artifact: Optional[Dict[str, Any]] = None
        try:
            artifact = self.db.get_artifact(artifact_id)
        except Exception:
            artifact = None

        artifact_name = None
        mime_type = None
        if isinstance(artifact, dict):
            artifact_name = artifact.get("artifact_name") or artifact.get("file_name")
            mime_type = artifact.get("mime_type")

        # Only auto-publish when the current step output is HTML.
        is_html = False
        if isinstance(mime_type, str) and "text/html" in mime_type.lower():
            is_html = True
        else:
            stripped = output_text.lstrip()
            lower_head = stripped[:200].lower()
            is_html = (
                lower_head.startswith("<!doctype")
                or lower_head.startswith("<html")
                or any(tag in lower_head for tag in ["<head", "<body", "<div", "<p>", "<h1", "<h2", "<h3"])
            )
        if not is_html:
            return None

        bucket = target["bucket"]
        region = target["region"]

        allowed = set(self._get_allowed_s3_upload_buckets())
        if bucket not in allowed:
            err = (
                f"S3 upload bucket '{bucket}' is not allowed. "
                f"Set SHELL_S3_UPLOAD_ALLOWED_BUCKETS to include it."
            )
            logger.warning("[S3ContextService] Blocked S3 publish (bucket not allowed)", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "step_index": step_index,
                "dest_bucket": bucket,
                "dest_region": region,
            })
            step_output_result["published_s3"] = {"success": False, "error": err}
            return {
                "step_name": f"{step_name} — Publish to S3",
                "step_order": step_index + 1,
                "step_type": "s3_upload",
                "success": False,
                "input": {"bucket": bucket, "region": region},
                "output": {"success": False, "error": err},
                "timestamp": datetime.utcnow().isoformat(),
                "duration_ms": 0,
            }

        prefix = self._get_s3_upload_key_prefix(tenant_id=tenant_id, job_id=job_id)
        filename = self._sanitize_s3_key_filename(str(artifact_name or f"{artifact_id}.html"))
        if not filename.lower().endswith(".html"):
            filename = f"{filename}.html"

        dest_key = f"{prefix}{artifact_id}-{filename}"
        content_type = str(mime_type or "text/html").strip() or "text/html"
        if content_type.lower().startswith("text/") and "charset=" not in content_type.lower():
            content_type = f"{content_type}; charset=utf-8"

        publish_started_at = datetime.utcnow()
        try:
            s3 = boto3.client("s3", region_name=region)
            s3.put_object(
                Bucket=bucket,
                Key=dest_key,
                Body=output_text.encode("utf-8"),
                ContentType=content_type,
            )

            duration_ms = int(
                (datetime.utcnow() - publish_started_at).total_seconds() * 1000
            )
            object_url = f"https://{bucket}.s3.{region}.amazonaws.com/{dest_key}"

            publish_output = {
                "success": True,
                "bucket": bucket,
                "region": region,
                "key": dest_key,
                "content_type": content_type,
                "s3_uri": f"s3://{bucket}/{dest_key}",
                "object_url": object_url,
                "source_artifact_id": artifact_id,
            }

            webhook_url = self._parse_object_url_webhook_target_from_instructions(instructions)
            if webhook_url:
                webhook_started_at = datetime.utcnow()
                webhook_payload = {"object_url": object_url}
                webhook_headers = {"Content-Type": "application/json"}
                try:
                    resp = requests.post(
                        webhook_url,
                        json=webhook_payload,
                        headers=webhook_headers,
                        timeout=30,
                    )
                    response_body = None
                    try:
                        response_body = resp.text
                        if response_body and len(response_body) > 10000:
                            response_body = response_body[:10000] + "... (truncated)"
                    except Exception:
                        response_body = None

                    webhook_duration_ms = int(
                        (datetime.utcnow() - webhook_started_at).total_seconds() * 1000
                    )
                    webhook_success = 200 <= int(resp.status_code) < 300
                    webhook_result = {
                        "success": webhook_success,
                        "webhook_url": webhook_url,
                        "request": webhook_payload,
                        "response_status": int(resp.status_code),
                        "response_body": response_body,
                        "duration_ms": webhook_duration_ms,
                        "error": None if webhook_success else f"HTTP {resp.status_code}",
                    }
                except Exception as e:
                    webhook_duration_ms = int(
                        (datetime.utcnow() - webhook_started_at).total_seconds() * 1000
                    )
                    webhook_result = {
                        "success": False,
                        "webhook_url": webhook_url,
                        "request": webhook_payload,
                        "response_status": None,
                        "response_body": None,
                        "duration_ms": webhook_duration_ms,
                        "error": str(e),
                    }

                publish_output["webhook"] = webhook_result
                step_output_result["published_webhook"] = webhook_result
            step_output_result["published_s3"] = publish_output

            logger.info("[S3ContextService] Published step output to S3", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "step_index": step_index,
                "dest_bucket": bucket,
                "dest_region": region,
                "dest_key": dest_key,
                "source_artifact_id": artifact_id,
            })

            return {
                "step_name": f"{step_name} — Publish to S3",
                "step_order": step_index + 1,
                "step_type": "s3_upload",
                "success": True,
                "input": {
                    "bucket": bucket,
                    "region": region,
                    "source_artifact_id": artifact_id,
                },
                "output": publish_output,
                "timestamp": publish_started_at.isoformat(),
                "duration_ms": duration_ms,
            }
        except Exception as e:
            duration_ms = int(
                (datetime.utcnow() - publish_started_at).total_seconds() * 1000
            )
            err = str(e)
            logger.warning("[S3ContextService] Failed to publish step output to S3", extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "step_index": step_index,
                "dest_bucket": bucket,
                "dest_region": region,
                "dest_key": dest_key,
                "error_type": type(e).__name__,
                "error_message": err,
            }, exc_info=True)

            publish_output = {
                "success": False,
                "bucket": bucket,
                "region": region,
                "key": dest_key,
                "content_type": content_type,
                "s3_uri": f"s3://{bucket}/{dest_key}",
                "object_url": f"https://{bucket}.s3.{region}.amazonaws.com/{dest_key}",
                "source_artifact_id": artifact_id,
                "error": err,
            }
            step_output_result["published_s3"] = publish_output

            return {
                "step_name": f"{step_name} — Publish to S3",
                "step_order": step_index + 1,
                "step_type": "s3_upload",
                "success": False,
                "input": {
                    "bucket": bucket,
                    "region": region,
                    "source_artifact_id": artifact_id,
                },
                "output": publish_output,
                "timestamp": publish_started_at.isoformat(),
                "duration_ms": duration_ms,
            }

