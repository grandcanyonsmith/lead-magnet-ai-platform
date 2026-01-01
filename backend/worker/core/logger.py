import os
import logging
import json
import sys
import traceback
import datetime
from typing import Any, Dict, Optional

def default_json_serializer(obj: Any) -> Any:
    """Safe JSON serializer for objects not handled by default json.dumps."""
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    try:
        return str(obj)
    except Exception:
        return "<not_serializable>"

class JsonFormatter(logging.Formatter):
    """
    Formatter that outputs JSON strings after parsing the LogRecord.
    """
    def __init__(self, fmt_dict: Optional[Dict[str, str]] = None, datefmt: str = "%Y-%m-%dT%H:%M:%SZ", style: str = '%'):
        super().__init__(datefmt=datefmt, style=style)
        self.fmt_dict = fmt_dict if fmt_dict is not None else {
            'timestamp': 'asctime',
            'level': 'levelname',
            'message': 'message',
            'logger': 'name',
            'module': 'module',
            'function': 'funcName',
            'line': 'lineno',
            # Standard correlation fields (if present in extra/context)
            'job_id': 'job_id',
            'tenant_id': 'tenant_id',
            'step_index': 'step_index',
            'request_id': 'request_id'
        }

    def format(self, record: logging.LogRecord) -> str:
        # Ensure message is formatted (handles %s args)
        record.message = record.getMessage()
        
        # Ensure asctime is set
        if 'asctime' in self.fmt_dict.values():
            record.asctime = self.formatTime(record, self.datefmt)

        record_dict = record.__dict__
        output_dict: Dict[str, Any] = {}

        # 1. Fill base fields from fmt_dict
        for key, value in self.fmt_dict.items():
            if value in record_dict:
                output_dict[key] = record_dict[value]
            elif hasattr(record, value):
                 output_dict[key] = getattr(record, value)

        # 2. Add extras (anything in extra={...} or injected context)
        # We filter out standard LogRecord attributes to find the extras.
        standard_keys = {
            'args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
            'funcName', 'levelname', 'levelno', 'lineno', 'module',
            'msecs', 'message', 'msg', 'name', 'pathname', 'process',
            'processName', 'relativeCreated', 'stack_info', 'thread', 'threadName',
            'taskName' # python 3.12+
        }
        
        for key, value in record_dict.items():
            if key not in standard_keys and key not in output_dict and not key.startswith('_'):
                output_dict[key] = value

        # 3. Handle exceptions structurally
        if record.exc_info:
            exc_type, exc_value, exc_traceback = record.exc_info
            output_dict['exception_type'] = exc_type.__name__ if exc_type else "Unknown"
            output_dict['exception_message'] = str(exc_value)
            # Full stack trace
            output_dict['exception_stack'] = self.formatException(record.exc_info)
            
            # Remove the legacy text blob if we have structured fields, 
            # unless one explicitly wants it. 
            # But standard logging puts it in `exc_text` usually.
            # We'll stick to our structured fields.

        elif record.exc_text:
            output_dict['exception_stack'] = record.exc_text

        return json.dumps(output_dict, default=default_json_serializer)

def setup_logging(level: str = "INFO") -> None:
    """
    Configures the root logger.
    
    Respects LOG_FORMAT environment variable:
    - 'json' (default): JSON output
    - 'text': Standard text format (useful for local dev)
    """
    log_format = os.environ.get('LOG_FORMAT', 'json').lower()
    
    handler = logging.StreamHandler(sys.stdout)
    
    if log_format == 'text':
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    else:
        formatter = JsonFormatter()
        
    handler.setFormatter(formatter)
    
    root_logger = logging.getLogger()
    # Normalize string levels (e.g. "info" -> "INFO") to avoid ValueError in logging._checkLevel
    normalized_level = level
    if isinstance(level, str):
        normalized_level = level.upper()
    root_logger.setLevel(normalized_level)
    
    # Remove existing handlers to avoid duplication
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)
    
    root_logger.addHandler(handler)
    
    # Set levels for some noisy libraries
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    # Try to add context filter if available (circular import check)
    try:
        from core.log_context import ContextFilter
        handler.addFilter(ContextFilter())
    except ImportError:
        pass

def get_logger(name: str) -> logging.Logger:
    """Returns a logger with the given name."""
    return logging.getLogger(name)
