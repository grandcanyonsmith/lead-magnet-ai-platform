import os

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
UPLOAD_DIST_SUBDIR = (os.environ.get("SHELL_EXECUTOR_UPLOAD_DIST_SUBDIR") or "dist").strip()
UPLOAD_BUILD_SUBDIR = (os.environ.get("SHELL_EXECUTOR_UPLOAD_BUILD_SUBDIR") or "build").strip()
UPLOAD_ACL = (os.environ.get("SHELL_EXECUTOR_UPLOAD_ACL") or "").strip()

def read_positive_int_env(name: str, default: int) -> int:
    value = (os.environ.get(name) or "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except Exception:
        return default
    return parsed if parsed > 0 else default

WORKSPACE_TTL_HOURS = read_positive_int_env("SHELL_EXECUTOR_WORKSPACE_TTL_HOURS", 0)
WORKSPACE_CLEANUP_LIMIT = read_positive_int_env("SHELL_EXECUTOR_WORKSPACE_CLEANUP_LIMIT", 200)
_CLEANUP_BUDGET_RAW = (os.environ.get("SHELL_EXECUTOR_WORKSPACE_CLEANUP_BUDGET_SECS") or "1.0").strip()
try:
    WORKSPACE_CLEANUP_BUDGET_SECS = max(float(_CLEANUP_BUDGET_RAW), 0.1)
except Exception:
    WORKSPACE_CLEANUP_BUDGET_SECS = 1.0
