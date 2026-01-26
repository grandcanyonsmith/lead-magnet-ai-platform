import os
from typing import Optional

def env_flag_is_true(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("1", "true", "yes", "y", "on")

def env_flag_is_false(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("0", "false", "no", "n", "off")

def running_in_lambda() -> bool:
    return bool(
        os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("AWS_EXECUTION_ENV")
        or os.environ.get("LAMBDA_TASK_ROOT")
    )

def should_use_single_process() -> bool:
    override = os.environ.get("CUA_PLAYWRIGHT_SINGLE_PROCESS")
    if env_flag_is_true(override):
        return True
    if env_flag_is_false(override):
        return False
    return running_in_lambda()

def should_disable_sandbox() -> bool:
    override = os.environ.get("CUA_PLAYWRIGHT_NO_SANDBOX")
    if env_flag_is_true(override):
        return True
    if env_flag_is_false(override):
        return False
    return running_in_lambda()
