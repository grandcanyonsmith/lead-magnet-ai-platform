# Worker Context Pack

Reference this pack when editing the Python worker that processes workflow jobs (`backend/worker`).

## Role in the System

- Executes workflow steps produced by the API (AI research, AI generation, HTML rendering, delivery).
- Runs as both a Lambda function (`lambda_handler.py`) and as a local script (`worker.py` / `processor.py`).
- Shares service modules under `backend/worker/services/*` (step processors, OpenAI client, tool builders, retry/error helpers).

## Directory Landmarks

| Path | Notes |
| --- | --- |
| `worker.py` | Local entry point that can poll jobs manually. |
| `lambda_handler.py` | AWS Lambda entry that Step Functions invokes. |
| `processor.py` | Main orchestration loop (loads job, executes steps, persists output). |
| `services/` | Individual helpers (AI step processor, tool builder, webhook step service, etc.). |
| `utils/` | Shared helpers (content detection, decimal utils, error utils). |
| `tests/` (`test_*.py`) | Unit and integration tests for image handling, webhook steps, retries, etc. |

## Commands

```bash
cd backend/worker
python3 -m venv .venv && source .venv/bin/activate  # optional virtualenv
pip install -r requirements.txt

# Run the full pytest suite (includes image + webhook tests)
pytest

# Execute worker locally against a job payload
python worker.py --job-id <job_id>

# Invoke Lambda handler locally with a JSON event
python -c "from lambda_handler import lambda_handler; lambda_handler({'job_id': '...'}, None)"
```

## Implementation Notes

- Secrets (OpenAI keys, bucket names) are pulled from environment variables—see `services/openai_client.py` and `services/dependency_resolver.py`.
- Image-heavy tests rely on fixtures in `tests/`; keep them fast by guarding remote calls with `pytest.mark.skipif`.
- When coordinating with the API, make sure job schema changes are reflected in both `services/workflow_orchestrator.py` and the corresponding TypeScript DTOs.
- The worker honours `workflowGenerationJobService` contracts; any new step types should expose a processor under `services/*` and be wired in `workflow_orchestrator.py`.
