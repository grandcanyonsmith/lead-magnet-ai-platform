# Worker Observability Guide

This guide explains the structured logging system implemented in the worker service. The system uses JSON logging with automatic context injection to make debugging easier.

## Logging Architecture

The worker uses a structured logging approach where:
1. **All logs are JSON**: This makes them machine-readable and queryable in tools like CloudWatch Logs Insights.
2. **Context is injected**: Correlation IDs (job_id, step_index, request_id) are automatically added to every log line in a scope.
3. **Exceptions are structured**: Stack traces and error types are captured as separate fields, not just text blobs.

## Key Fields

Every log entry will contain these standard fields:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO8601 timestamp of the event |
| `level` | Log level (INFO, WARN, ERROR, DEBUG) |
| `message` | The human-readable log message |
| `logger` | The logger name (module path) |
| `function` | The function name generating the log |
| `line` | Line number in the source code |

### Correlation Fields

These fields are automatically injected when available:

| Field | Description |
|-------|-------------|
| `job_id` | The ID of the job being processed |
| `step_index` | The 0-based index of the current step |
| `step_type` | The type of step (ai_generation, webhook, etc.) |
| `tenant_id` | The tenant ID owning the job |
| `workflow_id` | The workflow ID being executed |
| `request_id` | AWS Request ID (Lambda only) |
| `service` | Service name (`worker-local` or `worker-lambda`) |

### Error Fields

When an exception occurs:

| Field | Description |
|-------|-------------|
| `exception_type` | The class name of the exception |
| `exception_message` | The string representation of the error |
| `exception_stack` | The full stack trace |

## Configuration

You can control logging via environment variables:

- `LOG_LEVEL`: Set to `DEBUG`, `INFO` (default), `WARNING`, or `ERROR`.
- `LOG_FORMAT`: Set to `json` (default) or `text` (for local development readability).

## Debugging with CloudWatch Logs Insights

Use these queries to quickly find what you need.

### 1. Find all logs for a specific job
```
fields @timestamp, level, message, step_index
| filter job_id = "job_12345"
| sort @timestamp asc
```

### 2. Find errors in a specific workflow
```
fields @timestamp, message, exception_type, job_id
| filter level = "ERROR" and workflow_id = "wf_abc123"
| sort @timestamp desc
```

### 3. Trace a specific step execution
```
fields @timestamp, message
| filter job_id = "job_12345" and step_index = 2
| sort @timestamp asc
```

### 4. Find slow steps (if you log duration)
```
fields @timestamp, message, duration_ms
| filter ispresent(duration_ms) and duration_ms > 10000
| sort duration_ms desc
```

## Developing

### Adding Context
To add context to a block of code, use `log_context`:

```python
from core import log_context

with log_context.log_context(custom_field="value"):
    logger.info("This log has custom_field")
```

### Binding Global Context
For context that should persist for the lifecycle of a request/job:

```python
from core import log_context

log_context.bind(job_id="job_123")
logger.info("This log has job_id")
```

