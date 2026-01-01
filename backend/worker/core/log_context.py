import logging
import contextvars
from contextlib import contextmanager
from typing import Dict, Any, Iterator

# Context variable to hold the dictionary of bound context fields
_log_context_var = contextvars.ContextVar("log_context", default={})

def bind(**kwargs: Any) -> None:
    """
    Bind key/value pairs to the current execution context's logging context.
    These fields will be added to every log record.
    """
    ctx = _log_context_var.get().copy()
    ctx.update(kwargs)
    _log_context_var.set(ctx)

def unbind(*keys: str) -> None:
    """
    Remove keys from the current execution context's logging context.
    """
    ctx = _log_context_var.get().copy()
    for key in keys:
        ctx.pop(key, None)
    _log_context_var.set(ctx)

def clear() -> None:
    """
    Clear all bound logging context.
    """
    _log_context_var.set({})

def get_context() -> Dict[str, Any]:
    """
    Get a copy of the currently bound logging context.
    """
    return _log_context_var.get().copy()

@contextmanager
def log_context(**kwargs: Any) -> Iterator[None]:
    """
    Context manager that binds fields for a specific scope and restores 
    the previous context upon exit.
    
    Usage:
        with log_context(step_index=5, model="gpt-4"):
            logger.info("Processing step")
    """
    token = _log_context_var.set(_log_context_var.get().copy())
    bind(**kwargs)
    try:
        yield
    finally:
        _log_context_var.reset(token)

class ContextFilter(logging.Filter):
    """
    Logging filter that injects bound context variables into the LogRecord.
    Does not overwrite existing fields on the record (e.g. from extra={...}).
    """
    def filter(self, record: logging.LogRecord) -> bool:
        context = get_context()
        for key, value in context.items():
            # Only set if not already present (explicit extra takes precedence)
            if not hasattr(record, key):
                setattr(record, key, value)
        return True

