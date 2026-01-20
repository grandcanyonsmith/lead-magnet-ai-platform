import os
import subprocess
import logging
import time
import errno
import json
import mimetypes
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Default configuration
MOUNT_POINT = os.environ.get("EFS_MOUNT_POINT", "/mnt/shell-executor")
# Fallback if EFS is not writable (e.g., permissions/mount issues)
FALLBACK_ROOT = os.environ.get("SHELL_EXECUTOR_FALLBACK_ROOT", "/tmp/leadmagnet-shell-executor")
# Lambda max timeout is 15 min (900s), and we default to 15 min per command
DEFAULT_TIMEOUT_MS = 900000
DEFAULT_MAX_OUTPUT_LENGTH = 10000000  # 10MB

# Work root + upload configuration
DEFAULT_WORK_ROOT = (os.environ.get("SHELL_EXECUTOR_WORK_ROOT") or "/work").strip() or "/work"
REWRITE_WORK_PATHS = (os.environ.get("SHELL_EXECUTOR_REWRITE_WORK_PATHS") or "true").strip().lower() in ("1", "true", "yes")
UPLOAD_MODE = (os.environ.get("SHELL_EXECUTOR_UPLOAD_MODE") or "").strip().lower()
UPLOAD_BUCKET = (os.environ.get("SHELL_EXECUTOR_UPLOAD_BUCKET") or "").strip()
UPLOAD_PREFIX = (os.environ.get("SHELL_EXECUTOR_UPLOAD_PREFIX") or "").strip()
UPLOAD_PREFIX_TEMPLATE = (os.environ.get("SHELL_EXECUTOR_UPLOAD_PREFIX_TEMPLATE") or "").strip()
UPLOAD_MANIFEST_NAME = (os.environ.get("SHELL_EXECUTOR_MANIFEST_NAME") or "shell_executor_manifest.json").strip()
UPLOAD_MANIFEST_PATH = (os.environ.get("SHELL_EXECUTOR_MANIFEST_PATH") or "").strip()
UPLOAD_DIST_SUBDIR = (os.environ.get("SHELL_EXECUTOR_UPLOAD_DIST_SUBDIR") or "work/dist").strip()
UPLOAD_BUILD_SUBDIR = (os.environ.get("SHELL_EXECUTOR_UPLOAD_BUILD_SUBDIR") or "work/build").strip()

def truncate(text: Optional[str], max_len: int) -> str:
    """Truncate text to max_len characters."""
    if text is None:
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len] + "\n... [truncated]"

def _read_positive_int_env(name: str, default: int) -> int:
    value = (os.environ.get(name) or "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except Exception:
        return default
    return parsed if parsed > 0 else default

def _prepare_workspace_path(workspace_id: str) -> Tuple[str, bool]:
    """
    Create a workspace directory, falling back to /tmp if EFS is not writable.
    Returns (workspace_path, used_fallback).
    """
    safe_workspace_id = "".join(c for c in workspace_id if c.isalnum() or c in "-_") or "default"
    primary_base = os.path.join(MOUNT_POINT, "sessions")
    primary_path = os.path.join(primary_base, safe_workspace_id)

    try:
        os.makedirs(primary_path, exist_ok=True)
        return primary_path, False
    except OSError as e:
        if e.errno not in (errno.EACCES, errno.EPERM, errno.EROFS):
            raise
        logger.error(
            "EFS workspace not writable; falling back to /tmp",
            extra={"mount_point": MOUNT_POINT, "error": str(e)},
        )

    fallback_base = os.path.join(FALLBACK_ROOT, "sessions")
    fallback_path = os.path.join(fallback_base, safe_workspace_id)
    os.makedirs(fallback_path, exist_ok=True)
    return fallback_path, True

def _ensure_work_root(workspace_path: str) -> Tuple[str, bool]:
    """
    Ensure a stable /work root exists for shell commands.
    Returns (work_root, used_fallback).
    """
    desired = (os.environ.get("SHELL_EXECUTOR_WORK_ROOT") or DEFAULT_WORK_ROOT).strip() or "/work"
    workspace_work = os.path.join(workspace_path, "work")
    os.makedirs(workspace_work, exist_ok=True)

    if not os.path.isabs(desired):
        desired = os.path.join(workspace_path, desired)

    if desired == "/work":
        try:
            if os.path.islink(desired):
                if os.readlink(desired) == workspace_work:
                    return desired, False
                os.unlink(desired)
            elif os.path.exists(desired):
                test_path = os.path.join(desired, ".lm_write_test")
                try:
                    with open(test_path, "w", encoding="utf-8") as f:
                        f.write("ok")
                    os.remove(test_path)
                    return desired, False
                except Exception:
                    return workspace_work, True
            os.symlink(workspace_work, desired)
            return desired, False
        except Exception as e:
            logger.warning(
                "Could not create /work symlink; falling back to workspace work dir",
                extra={"error": str(e), "workspace_path": workspace_path},
            )
            return workspace_work, True

    try:
        os.makedirs(desired, exist_ok=True)
        return desired, False
    except Exception as e:
        logger.warning(
            "Could not create work root; falling back to workspace work dir",
            extra={"error": str(e), "desired": desired},
        )
        return workspace_work, True

def _ensure_work_dirs(work_root: str) -> None:
    for rel in ("canon", "src", "build", "dist", os.path.join("dist", "assets")):
        os.makedirs(os.path.join(work_root, rel), exist_ok=True)

def _rewrite_work_paths(cmd: str, work_root: str) -> str:
    if work_root.rstrip("/") == "/work":
        return cmd
    safe_root = work_root.rstrip("/")
    pattern = re.compile(r"(?<![A-Za-z0-9_])(/work)(?=/|\\b)")
    return pattern.sub(safe_root, cmd)

def _resolve_upload_prefix(env_vars: Dict[str, Any], workspace_id: str, manifest_prefix: Optional[str] = None) -> str:
    data = {
        "tenant_id": env_vars.get("TENANT_ID") or env_vars.get("LM_TENANT_ID") or "",
        "job_id": env_vars.get("LM_JOB_ID") or env_vars.get("JOB_ID") or "",
        "step_index": env_vars.get("STEP_INDEX") or env_vars.get("LM_STEP_INDEX") or "",
        "workspace_id": workspace_id or "",
    }

    base_prefix = ""
    if UPLOAD_PREFIX_TEMPLATE:
        try:
            base_prefix = UPLOAD_PREFIX_TEMPLATE.format(**data)
        except Exception:
            base_prefix = UPLOAD_PREFIX
    else:
        base_prefix = UPLOAD_PREFIX

    base_prefix = (base_prefix or "").strip().lstrip("/")
    if not base_prefix and data["tenant_id"] and data["job_id"]:
        base_prefix = f"leadmagnet/{data['tenant_id']}/{data['job_id']}/"

    if base_prefix and not base_prefix.endswith("/"):
        base_prefix += "/"

    manifest_clean = (manifest_prefix or "").strip().lstrip("/")
    if ".." in manifest_clean:
        manifest_clean = ""

    if manifest_clean:
        if base_prefix and manifest_clean.startswith(base_prefix):
            prefix = manifest_clean
        else:
            prefix = f"{base_prefix}{manifest_clean}" if base_prefix else manifest_clean
    else:
        prefix = base_prefix

    prefix = (prefix or "").strip()
    if prefix and not prefix.endswith("/"):
        prefix += "/"
    return prefix

def _load_manifest(manifest_path: str) -> Tuple[List[str], Optional[str], Optional[str]]:
    try:
        raw = Path(manifest_path).read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception as e:
        logger.warning("Failed to load shell executor manifest", extra={"path": manifest_path, "error": str(e)})
        return [], None, None

    if isinstance(data, list):
        return [str(p) for p in data], None, None
    if isinstance(data, dict):
        files = data.get("files") or data.get("paths") or []
        if not isinstance(files, list):
            files = []
        bucket = data.get("bucket")
        prefix = data.get("prefix")
        return [str(p) for p in files], bucket, prefix
    return [], None, None

def _collect_files_under(base_dir: str, rel_base: str) -> List[Tuple[str, str]]:
    collected: List[Tuple[str, str]] = []
    for root, _, files in os.walk(base_dir):
        for name in files:
            abs_path = os.path.join(root, name)
            rel_path = os.path.relpath(abs_path, rel_base).replace(os.sep, "/")
            collected.append((abs_path, rel_path))
    return collected

def _collect_upload_entries(mode: str, work_root: str, workspace_path: str) -> Tuple[List[Tuple[str, str]], Optional[str], Optional[str]]:
    mode = (mode or "").strip().lower()
    if not mode:
        return [], None, None

    if mode == "manifest":
        manifest_path = UPLOAD_MANIFEST_PATH or os.path.join(work_root, UPLOAD_MANIFEST_NAME)
        files, bucket_override, prefix_override = _load_manifest(manifest_path)
        if bucket_override and UPLOAD_BUCKET and bucket_override != UPLOAD_BUCKET:
            logger.warning(
                "Manifest bucket override ignored (does not match configured bucket)",
                extra={"manifest_bucket": bucket_override, "configured_bucket": UPLOAD_BUCKET},
            )
            bucket_override = None
        entries: List[Tuple[str, str]] = []
        for rel in files:
            rel = str(rel).strip()
            if not rel:
                continue
            abs_path = rel if os.path.isabs(rel) else os.path.join(work_root, rel.lstrip("/"))
            if os.path.isabs(abs_path) and abs_path.startswith("/work") and work_root.rstrip("/") != "/work":
                abs_path = os.path.join(work_root, abs_path[len("/work/"):])
            if not os.path.exists(abs_path):
                logger.warning("Manifest file missing on disk", extra={"path": abs_path})
                continue
            rel_path = os.path.relpath(abs_path, work_root).replace(os.sep, "/")
            entries.append((abs_path, rel_path))
        return entries, bucket_override, prefix_override

    if mode in ("dist", "build", "all"):
        if mode == "dist":
            base = UPLOAD_DIST_SUBDIR
        elif mode == "build":
            base = UPLOAD_BUILD_SUBDIR
        else:
            base = work_root

        if not os.path.isabs(base):
            base = os.path.join(work_root, base.lstrip("/"))
        if not os.path.exists(base):
            logger.warning("Upload base directory not found", extra={"base": base, "mode": mode})
            return [], None, None
        return _collect_files_under(base, work_root), None, None

    logger.warning("Unknown upload mode", extra={"mode": mode})
    return [], None, None

def _upload_files(
    *,
    entries: List[Tuple[str, str]],
    bucket: str,
    prefix: str,
    max_bytes: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    uploads: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    if not entries:
        return uploads, errors

    # Initialize S3 client with region from environment or default to us-east-1
    # For cross-region access, boto3 will automatically use the bucket's region
    aws_region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
    s3 = boto3.client("s3", region_name=aws_region)
    for abs_path, rel_path in entries:
        try:
            size = os.path.getsize(abs_path)
            if max_bytes > 0 and size > max_bytes:
                errors.append({
                    "path": abs_path,
                    "error": f"file too large ({size} bytes > {max_bytes})",
                })
                continue
            key = f"{prefix}{rel_path}".replace("//", "/")
            content_type = mimetypes.guess_type(abs_path)[0] or "application/octet-stream"
            s3.upload_file(abs_path, bucket, key, ExtraArgs={"ContentType": content_type})
            uploads.append({
                "path": abs_path,
                "key": key,
                "size": size,
                "content_type": content_type,
            })
        except Exception as e:
            errors.append({"path": abs_path, "error": str(e)})
    return uploads, errors

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for executing shell commands in a persistent environment.
    
    Args:
        event: Dict containing:
            - commands: List[str] of commands to execute
            - workspace_id: Optional str, ID for the persistent session (folder name)
            - timeout_ms: Optional int, max execution time per command
            - max_output_length: Optional int, max characters for stdout/stderr
            - env: Optional Dict[str, str], environment variables to set
            
    Returns:
        Dict containing execution results
    """
    # Log event keys for debugging (avoid logging potentially sensitive command content globally)
    logger.info("Received shell execution request", extra={"event_keys": list(event.keys())})
    
    commands = event.get("commands", [])
    workspace_id = event.get("workspace_id", "default")
    timeout_ms = event.get("timeout_ms", DEFAULT_TIMEOUT_MS)
    max_output_length = event.get("max_output_length", DEFAULT_MAX_OUTPUT_LENGTH)
    try:
        timeout_ms = int(timeout_ms)
    except Exception:
        timeout_ms = DEFAULT_TIMEOUT_MS
    if timeout_ms <= 0:
        timeout_ms = DEFAULT_TIMEOUT_MS
    try:
        max_output_length = int(max_output_length)
    except Exception:
        max_output_length = DEFAULT_MAX_OUTPUT_LENGTH
    if max_output_length <= 0:
        max_output_length = DEFAULT_MAX_OUTPUT_LENGTH
    env_vars = event.get("env", {})
    
    if not commands:
        return {
            "statusCode": 400,
            "error": "No commands provided"
        }
        
    # Setup workspace (EFS preferred; /tmp fallback if EFS not writable)
    try:
        workspace_path, used_fallback = _prepare_workspace_path(workspace_id)
    except Exception as e:
        logger.error(f"Failed to create workspace directory: {e}")
        return {
            "statusCode": 500,
            "error": f"Failed to create workspace: {str(e)}"
        }
    if used_fallback:
        logger.warning("Shell executor using /tmp fallback workspace", extra={"workspace_path": workspace_path})
        
    # Prepare /work root (symlinked to workspace when possible)
    work_root, work_root_fallback = _ensure_work_root(workspace_path)
    _ensure_work_dirs(work_root)

    # Prepare environment (inherit current env but allow overrides)
    cmd_env = os.environ.copy()
    cmd_env.update(env_vars)
    
    # Ensure AWS credentials are available for AWS CLI commands
    # Lambda automatically provides credentials via IAM role, but AWS CLI needs them explicitly
    # Set AWS_REGION if not already set (Lambda sets this automatically, but ensure it's available)
    if "AWS_REGION" not in cmd_env:
        cmd_env["AWS_REGION"] = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
    if "AWS_DEFAULT_REGION" not in cmd_env:
        cmd_env["AWS_DEFAULT_REGION"] = cmd_env["AWS_REGION"]
    
    # AWS CLI will automatically use IAM role credentials in Lambda via instance metadata
    # But we can also ensure AWS_PROFILE is not set (which might interfere)
    if "AWS_PROFILE" in cmd_env:
        # Don't remove it if explicitly set, but ensure it doesn't conflict
        pass
    
    # Set AWS_SDK_LOAD_CONFIG=1 to ensure boto3/botocore can find credentials
    cmd_env["AWS_SDK_LOAD_CONFIG"] = "1"
    cmd_env["HOME"] = workspace_path
    cmd_env["WORK_ROOT"] = work_root
    cmd_env["WORKDIR"] = work_root
    cmd_env["PWD"] = work_root
    
    # Create AWS CLI wrapper script that uses boto3
    # This allows 'aws s3 cp' commands to work even if AWS CLI isn't installed
    aws_wrapper_script = f"""#!/usr/bin/env python3
import sys
import boto3
import os
import re
import shutil

def aws_s3_cp(args):
    '''Wrapper for 'aws s3 cp' using boto3'''
    # Parse: aws s3 cp <source> <dest> [--region <region>]
    source = None
    dest = None
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    i = 0
    while i < len(args):
        if args[i] == '--region' and i + 1 < len(args):
            region = args[i + 1]
            i += 2
        elif args[i].startswith('s3://'):
            if source is None:
                source = args[i]
            else:
                dest = args[i]
            i += 1
        elif not args[i].startswith('-'):
            if source is None:
                source = args[i]
            else:
                dest = args[i]
            i += 1
        else:
            i += 1
    
    if not source or not dest:
        print("Usage: aws s3 cp <source> <dest> [--region <region>]", file=sys.stderr)
        sys.exit(1)
    
    s3 = boto3.client('s3', region_name=region)
    
    # Determine if source or dest is S3
    if source.startswith('s3://'):
        # Download from S3
        bucket_key = source[5:].split('/', 1)
        bucket = bucket_key[0]
        key = bucket_key[1] if len(bucket_key) > 1 else ''
        s3.download_file(bucket, key, dest)
        print(f"download: s3://{{bucket}}/{{key}} to {{dest}}")
    elif dest.startswith('s3://'):
        # Upload to S3
        bucket_key = dest[5:].split('/', 1)
        bucket = bucket_key[0]
        key = bucket_key[1] if len(bucket_key) > 1 else os.path.basename(source)
        s3.upload_file(source, bucket, key)
        print(f"upload: {{source}} to s3://{{bucket}}/{{key}}")
    else:
        print("Either source or destination must be an S3 path (s3://...)", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("AWS CLI wrapper - limited support for 's3 cp' commands", file=sys.stderr)
        sys.exit(1)
    
    if sys.argv[1] == 's3' and len(sys.argv) > 2 and sys.argv[2] == 'cp':
        aws_s3_cp(sys.argv[3:])
    else:
        print(f"AWS CLI wrapper: command '{{' '.join(sys.argv[1:])}}' not supported. Use boto3/Python for other operations.", file=sys.stderr)
        sys.exit(1)
"""
    
    # Write wrapper script to workspace and add to PATH
    aws_wrapper_path = os.path.join(workspace_path, "aws")
    try:
        with open(aws_wrapper_path, "w") as f:
            f.write(aws_wrapper_script)
        os.chmod(aws_wrapper_path, 0o755)
        # Add wrapper directory to PATH so 'aws' command is found
        cmd_env["PATH"] = f"{workspace_path}:{cmd_env.get('PATH', '')}"
    except Exception as e:
        logger.warning(f"Failed to create AWS CLI wrapper: {e}", extra={"workspace_path": workspace_path})
    
    results = []
    
    for cmd in commands:
        start_time = time.time()
        try:
            cmd_to_run = cmd
            if REWRITE_WORK_PATHS:
                cmd_to_run = _rewrite_work_paths(cmd_to_run, work_root)

            logger.info(f"Executing command in {work_root}: {cmd[:50]}...")
            
            # Use subprocess.run for simplicity and better control
            process = subprocess.run(
                cmd_to_run,
                shell=True,
                cwd=work_root,
                env=cmd_env,
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000.0
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            stdout = truncate(process.stdout, max_output_length)
            stderr = truncate(process.stderr, max_output_length)
            
            results.append({
                "command": cmd,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": process.returncode,
                "duration_ms": duration_ms,
                "status": "success" if process.returncode == 0 else "failed"
            })
            
        except subprocess.TimeoutExpired as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning(f"Command timed out: {cmd}")
            
            stdout = truncate(e.stdout.decode('utf-8') if e.stdout else "", max_output_length)
            stderr = truncate(e.stderr.decode('utf-8') if e.stderr else "", max_output_length)
            
            results.append({
                "command": cmd,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": 124, # Standard timeout exit code
                "duration_ms": duration_ms,
                "status": "timeout"
            })
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Command execution error: {e}")
            results.append({
                "command": cmd,
                "stdout": "",
                "stderr": str(e),
                "exit_code": 1,
                "duration_ms": duration_ms,
                "status": "error"
            })

    uploads: List[Dict[str, Any]] = []
    upload_errors: List[Dict[str, Any]] = []
    upload_meta: Dict[str, Any] = {}

    if UPLOAD_MODE and UPLOAD_BUCKET:
        entries, bucket_override, prefix_override = _collect_upload_entries(UPLOAD_MODE, work_root, workspace_path)
        bucket = bucket_override or UPLOAD_BUCKET
        prefix = _resolve_upload_prefix(env_vars, workspace_id, prefix_override)
        max_bytes = _read_positive_int_env("SHELL_EXECUTOR_MAX_UPLOAD_BYTES", 0)
        uploads, upload_errors = _upload_files(entries=entries, bucket=bucket, prefix=prefix, max_bytes=max_bytes)
        upload_meta = {
            "mode": UPLOAD_MODE,
            "bucket": bucket,
            "prefix": prefix,
            "entries": len(entries),
        }

    return {
        "statusCode": 200,
        "results": results,
        "workspace_path": workspace_path,
        "work_root": work_root,
        "work_root_fallback": work_root_fallback,
        "uploads": uploads,
        "upload_errors": upload_errors,
        "upload_meta": upload_meta,
    }
