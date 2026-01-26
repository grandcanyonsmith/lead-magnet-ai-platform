import os
import time
import shutil
import logging
from .config import WORKSPACE_CLEANUP_LIMIT, WORKSPACE_CLEANUP_BUDGET_SECS

logger = logging.getLogger(__name__)

def cleanup_old_workspaces(base_dir: str, *, current_workspace: str, ttl_seconds: int) -> None:
    if ttl_seconds <= 0:
        return
    try:
        entries = os.listdir(base_dir)
    except Exception:
        return

    now = time.time()
    start = time.time()
    removed = 0

    for name in entries:
        if removed >= WORKSPACE_CLEANUP_LIMIT:
            break
        if (time.time() - start) >= WORKSPACE_CLEANUP_BUDGET_SECS:
            break
        if name == current_workspace:
            continue
        path = os.path.join(base_dir, name)
        try:
            if not os.path.isdir(path):
                continue
            mtime = os.path.getmtime(path)
        except Exception:
            continue
        if (now - mtime) < ttl_seconds:
            continue
        try:
            shutil.rmtree(path, ignore_errors=True)
            removed += 1
        except Exception as e:
            logger.warning("Failed to prune workspace", extra={"path": path, "error": str(e)})
