import logging
import re
import os
import io
import uuid
import mimetypes
import boto3
import requests
from botocore.exceptions import ClientError
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

    def _get_allowed_s3_upload_buckets(self) -> List[str]:
        raw = (os.environ.get("SHELL_S3_UPLOAD_ALLOWED_BUCKETS") or "cc360-pages").strip()
        return [b.strip() for b in raw.split(",") if b and b.strip()]

    def _get_s3_upload_object_acl(self) -> Optional[str]:
        # Default to bucket-owner-full-control for admin access (if ACLs are enabled).
        raw = (os.environ.get("SHELL_S3_UPLOAD_OBJECT_ACL") or "bucket-owner-full-control").strip()
        return raw or None

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

    def _append_random_suffix_to_key(self, key: str) -> str:
        suffix = uuid.uuid4().hex[:8]
        if "/" in key:
            prefix, filename = key.rsplit("/", 1)
            prefix = f"{prefix}/"
        else:
            prefix, filename = "", key
        base, ext = os.path.splitext(filename)
        return f"{prefix}{base}_{suffix}{ext}"

    def _object_exists(self, s3_client, *, bucket: str, key: str) -> bool:
        try:
            s3_client.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", "")).lower()
            if code in ("404", "notfound", "nosuchkey"):
                return False
            if code == "accessdenied":
                logger.warning(
                    "[S3ContextService] head_object access denied; assuming not exists",
                    extra={"bucket": bucket, "key": key},
                )
                return False
            raise

    def _infer_content_type(
        self,
        *,
        content_type: Optional[str],
        source_path: Optional[str],
        dest_key: str,
        source_type: str,
    ) -> str:
        if content_type:
            if content_type.lower().startswith("text/") and "charset=" not in content_type.lower():
                return f"{content_type}; charset=utf-8"
            return content_type

        guess = None
        if source_path:
            guess, _ = mimetypes.guess_type(source_path)
        if not guess and dest_key:
            guess, _ = mimetypes.guess_type(dest_key)
        if not guess and source_type == "text_content":
            guess = "text/plain"
        if not guess:
            guess = "application/octet-stream"
        if guess.startswith("text/") and "charset=" not in guess.lower():
            return f"{guess}; charset=utf-8"
        return guess

    def resolve_output_config(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve the output configuration for a step.
        Prioritizes explicit 'output_config' if present.
        Falls back to heuristic parsing of instructions if not.
        """
        output_config = step.get("output_config")
        
        # 1. Explicit configuration
        if output_config and isinstance(output_config, dict):
            return {
                "enabled": output_config.get("storage_provider") == "s3",
                "source_type": output_config.get("source_type", "text_content"),
                "source_path": output_config.get("source_path"),
                "destination_path": output_config.get("destination_path"),
                "content_type": output_config.get("content_type"),
                "bucket": (self._get_allowed_s3_upload_buckets() or ["cc360-pages"])[0], # Default to first allowed
                "region": os.environ.get("AWS_REGION", "us-east-1"),
                "explicit": True
            }

        # 2. Legacy Heuristic (Parse instructions)
        instructions = step.get("instructions", "")
        if not isinstance(instructions, str):
            return {"enabled": False}

        target = self._parse_s3_upload_target_from_instructions(instructions)
        if target:
            return {
                "enabled": True,
                "source_type": "text_content", # Legacy default
                "bucket": target["bucket"],
                "region": target["region"],
                "explicit": False
            }
            
        return {"enabled": False}

    def _parse_s3_upload_target_from_instructions(
        self,
        instructions: str,
    ) -> Optional[Dict[str, str]]:
        """
        Best-effort parse of an S3 upload request from a step's instructions.
        """
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
            candidate = m.group(1)
            # Reject placeholder bucket names
            disallowed_buckets = {"bucket", "my-bucket", "your-bucket", "example-bucket", "test-bucket"}
            if candidate.lower() not in disallowed_buckets:
                bucket = candidate
        else:
            # Fallback: "bucket <name>"
            m2 = re.search(r"\bbucket\s+([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\b", lower)
            if m2:
                candidate = m2.group(1)
                # Extended stop word list including placeholder bucket names
                stop_words = ["not", "is", "in", "to", "for", "with", "on", "at", "by", "from", "of", "and", "or", "but", "the", "a", "an", "bucket", "my-bucket", "your-bucket", "example-bucket", "test-bucket"]
                if candidate not in stop_words:
                    bucket = candidate

        if not bucket:
            # Fallback: "<bucket> s3 bucket" (common phrasing)
            m2b = re.search(
                r"\b([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\s+s3\s+bucket\b", lower
            )
            if m2b:
                candidate = m2b.group(1)
                # Extended stop word list including placeholder bucket names
                stop_words = ["not", "is", "in", "to", "for", "with", "on", "at", "by", "from", "of", "and", "or", "but", "the", "a", "an", "bucket", "my-bucket", "your-bucket", "example-bucket", "test-bucket"]
                if candidate not in stop_words:
                    bucket = candidate

        # Final validation: reject placeholder bucket names
        disallowed_buckets = {"bucket", "my-bucket", "your-bucket", "example-bucket", "test-bucket"}
        if bucket and bucket.lower() in disallowed_buckets:
            logger.warning(f"Rejected placeholder bucket name: '{bucket}'")
            return None

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

    def inject_context(
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
        Injects instructions into the prompt based on the output configuration.
        Replaces the old 'maybe_inject_s3_upload_context' with a cleaner approach.
        """
        config = self.resolve_output_config(step)
        if not config["enabled"]:
            return current_step_context

        # If explicit file source, tell the LLM where to write the file.
        if config.get("source_type") == "file":
            path = config.get("source_path") or "/work/output.bin"
            block = "\n".join([
                "=== Output Requirement ===",
                f"You must generate a file at: {path}",
                "The system will automatically upload this file to storage after you complete the step.",
                "Do NOT run any upload commands (like curl or aws s3 cp) yourself.",
                "Just ensure the file exists at that path before finishing."
            ])
            return f"{current_step_context}\n\n{block}" if current_step_context else block

        # If text content (or legacy heuristic), tell LLM to just output the content.
        # We don't need to inject curl commands anymore because we handle it in post-processing.
        if not config.get("explicit"):
             # Legacy mode: If we detected an intent to upload but it wasn't explicit config,
             # we previously injected curl commands. Now we want to shift to "just output the content".
             # However, to be safe with existing prompts, we might want to be gentle.
             # For now, let's just tell them we will handle it.
             block = "\n".join([
                "=== S3 Upload Note ===",
                f"The system will automatically upload your final text output to S3 bucket '{config['bucket']}'.",
                "Please output ONLY the content you want uploaded (e.g. the HTML code).",
                "Do NOT run curl/aws commands."
             ])
             return f"{current_step_context}\n\n{block}" if current_step_context else block

        return current_step_context

    def process_step_upload(
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
        Handles the actual upload of artifacts based on configuration.
        Called AFTER the step has executed.
        """
        config = self.resolve_output_config(step)
        if not config["enabled"]:
            return None

        bucket = config["bucket"]
        region = config["region"]
        
        # Validate bucket
        allowed = set(self._get_allowed_s3_upload_buckets())
        if bucket not in allowed:
            err = f"S3 upload bucket '{bucket}' is not allowed."
            logger.warning(err)
            return {
                "step_name": f"{step_name} — Upload Failed",
                "step_order": step_index + 1,
                "step_type": "s3_upload",
                "success": False,
                "output": {"error": err},
                "timestamp": datetime.utcnow().isoformat(),
            }

        # Determine content to upload
        content_body = None
        source_path = None
        source_type = config.get("source_type", "text_content")
        
        if source_type == "file":
            source_path = config.get("source_path")
            if not source_path or not os.path.exists(source_path):
                err = f"Source file not found at: {source_path}"
                return {
                    "step_name": f"{step_name} — Upload Failed",
                    "step_order": step_index + 1,
                    "step_type": "s3_upload",
                    "success": False,
                    "output": {"error": err},
                    "timestamp": datetime.utcnow().isoformat(),
                }
        else:
            # Default to text content from step output
            output_text = step_output_result.get("output", "")
            if not output_text:
                return None # Nothing to upload
            content_body = output_text.encode("utf-8")

        # Determine destination key
        prefix = self._get_s3_upload_key_prefix(tenant_id=tenant_id, job_id=job_id)
        
        # Try to use configured path or fallback to sensible default
        dest_key = ""
        if config.get("destination_path"):
            content_ext = "html"
            if source_path:
                _, ext = os.path.splitext(source_path)
                if ext:
                    content_ext = ext.lstrip(".")
            # Simple variable substitution
            dest_key = config["destination_path"].format(
                job_id=job_id,
                step_index=step_index,
                date=datetime.utcnow().strftime("%Y%m%d"),
                ext=content_ext
            )
        else:
            # Auto-generate key
            artifact_id = step_output_result.get("artifact_id") or f"step_{step_index}"
            ext = "bin"
            if source_path:
                _, ext_candidate = os.path.splitext(source_path)
                if ext_candidate:
                    ext = ext_candidate.lstrip(".")
            elif source_type == "text_content":
                ext = "html"
            filename = self._sanitize_s3_key_filename(f"{artifact_id}.{ext}")
            dest_key = f"{prefix}{filename}"

        content_type = self._infer_content_type(
            content_type=config.get("content_type"),
            source_path=source_path,
            dest_key=dest_key,
            source_type=source_type,
        )

        # Perform Upload
        publish_started_at = datetime.utcnow()
        s3 = boto3.client("s3", region_name=region)
        acl = self._get_s3_upload_object_acl()

        # Avoid overwrites by checking if the key exists and renaming if needed
        try:
            if self._object_exists(s3, bucket=bucket, key=dest_key):
                dest_key = self._append_random_suffix_to_key(dest_key)
                logger.info(
                    "[S3ContextService] Destination key exists; using randomized key",
                    extra={"bucket": bucket, "key": dest_key},
                )
        except ClientError as exc:
            logger.warning(
                "[S3ContextService] Failed to check key existence; proceeding",
                extra={"bucket": bucket, "key": dest_key, "error": str(exc)},
            )

        def _upload_with_args(key: str, extra_args: Dict[str, Any]) -> None:
            if source_type == "file":
                s3.upload_file(
                    Filename=source_path,
                    Bucket=bucket,
                    Key=key,
                    ExtraArgs=extra_args,
                )
            else:
                with io.BytesIO(content_body) as bio:
                    s3.upload_fileobj(
                        Fileobj=bio,
                        Bucket=bucket,
                        Key=key,
                        ExtraArgs=extra_args,
                    )

        extra_args = {"ContentType": content_type}
        if acl:
            extra_args["ACL"] = acl

        try:
            _upload_with_args(dest_key, extra_args)
            
            duration_ms = int((datetime.utcnow() - publish_started_at).total_seconds() * 1000)
            
            # Determine correct region for bucket (cc360-pages is in us-west-2)
            bucket_region = "us-west-2" if bucket == "cc360-pages" else region
            object_url = f"https://{bucket}.s3.{bucket_region}.amazonaws.com/{dest_key}"

            publish_output = {
                "success": True,
                "bucket": bucket,
                "key": dest_key,
                "object_url": object_url,
                "s3_uri": f"s3://{bucket}/{dest_key}"
            }
            
            # Update the main step result to include this info (for UI)
            step_output_result["published_s3"] = publish_output

            return {
                "step_name": f"{step_name} — Uploaded to S3",
                "step_order": step_index + 1,
                "step_type": "s3_upload",
                "success": True,
                "input": {"bucket": bucket, "key": dest_key},
                "output": publish_output,
                "timestamp": publish_started_at.isoformat(),
                "duration_ms": duration_ms,
            }

        except ClientError as e:
            # Single retry with randomized key if the initial upload fails
            retry_key = self._append_random_suffix_to_key(dest_key)
            logger.warning(
                "[S3ContextService] Upload failed; retrying with randomized key",
                extra={"bucket": bucket, "key": retry_key, "error": str(e)},
            )
            try:
                _upload_with_args(retry_key, extra_args)
                duration_ms = int((datetime.utcnow() - publish_started_at).total_seconds() * 1000)
                bucket_region = "us-west-2" if bucket == "cc360-pages" else region
                object_url = f"https://{bucket}.s3.{bucket_region}.amazonaws.com/{retry_key}"
                publish_output = {
                    "success": True,
                    "bucket": bucket,
                    "key": retry_key,
                    "object_url": object_url,
                    "s3_uri": f"s3://{bucket}/{retry_key}",
                    "retry_used": True,
                }
                step_output_result["published_s3"] = publish_output
                return {
                    "step_name": f"{step_name} — Uploaded to S3",
                    "step_order": step_index + 1,
                    "step_type": "s3_upload",
                    "success": True,
                    "input": {"bucket": bucket, "key": retry_key},
                    "output": publish_output,
                    "timestamp": publish_started_at.isoformat(),
                    "duration_ms": duration_ms,
                }
            except Exception as retry_error:
                logger.error(
                    "[S3ContextService] Upload retry failed",
                    extra={"bucket": bucket, "key": retry_key, "error": str(retry_error)},
                )
                return {
                    "step_name": f"{step_name} — Upload Failed",
                    "step_order": step_index + 1,
                    "step_type": "s3_upload",
                    "success": False,
                    "output": {"error": str(retry_error)},
                    "timestamp": datetime.utcnow().isoformat(),
                }
        except Exception as e:
            logger.error(f"S3 Upload failed: {e}")
            return {
                "step_name": f"{step_name} — Upload Failed",
                "step_order": step_index + 1,
                "step_type": "s3_upload",
                "success": False,
                "output": {"error": str(e)},
                "timestamp": datetime.utcnow().isoformat(),
            }
