# Worker Service

The Worker Service is the engine that processes lead magnet jobs. It is a Python-based Lambda function that executes the workflow steps defined in the job.

## 🧠 Core Responsibilities

- **Job Processing**: Fetches job details and executes steps.
- **AI Integration**: Calls OpenAI (GPT-4o, etc.) to generate content.
- **Tool Execution**: Runs tools like `web_search`, `image_generation`, etc.
- **Artifact Management**: Stores generated reports and HTML in S3.
- **Template Rendering**: Merges AI content into HTML templates.

## 📂 Key Files

- `worker.py`: Local entry point for testing/debugging.
- `lambda_handler.py`: AWS Lambda entry point.
- `processor.py`: Main `JobProcessor` logic (orchestrator).
- `services/`: Specialized services (AI, S3, DynamoDB, Tools).
  - `services/step_processor.py`: Logic for executing a single workflow step.
  - `services/tool_validator.py`: Tool validation and filtering.

## 🛠️ Local Development

To run the worker locally against a specific job:

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the worker
python3 worker.py --job-id <JOB_ID>
```

See [Local Development Guide](../../docs/guides/LOCAL_DEVELOPMENT.md) for full setup.

## 🧪 Testing

```bash
# Run unit tests
pytest

# Run specific test
pytest tests/test_processor.py
```
