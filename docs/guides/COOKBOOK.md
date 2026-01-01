# 📖 Developer Cookbook

> **Last Updated**: 2026-01-01  
> **Status**: Current  
> **Related Docs**: [Local Development](./LOCAL_DEVELOPMENT.md), [Architecture](../architecture/ARCHITECTURE.md)

This cookbook contains recipes for common development tasks. Use these quick references to speed up your workflow.

## 📚 Table of Contents

- [Adding a New Tool to the AI Worker](#adding-a-new-tool-to-the-ai-worker)
- [Adding a New Field to a Form](#adding-a-new-field-to-a-form)
- [Debugging a Failed Job](#debugging-a-failed-job)
- [Testing a Workflow Locally](#testing-a-workflow-locally)

---

## Adding a New Tool to the AI Worker

To add a new tool (e.g., `sentiment_analysis`) that the AI can use:

1.  **Define the Tool Logic**:
    Create a new service or method in `backend/worker/services/`.

    ```python
    # backend/worker/services/sentiment_service.py
    class SentimentService:
        def analyze(self, text: str) -> dict:
            # Your implementation here
            return {"score": 0.9, "label": "positive"}
    ```

2.  **Register in `StepProcessor`**:
    Update `backend/worker/services/step_processor.py` to handle the tool execution.

    ```python
    # In StepProcessor class
    def _execute_tool(self, tool_name, tool_args):
        if tool_name == "sentiment_analysis":
            return self.sentiment_service.analyze(tool_args["text"])
        # ... existing tools
    ```

3.  **Update `ToolValidator`**:
    Ensure the tool is allowed in `backend/worker/services/tool_validator.py`.

    ```python
    # In ToolValidator.validate_and_filter_tools
    # Ensure your tool isn't filtered out if necessary
    ```

4.  **Update Tool Builder**:
    Define the OpenAI function schema in `backend/worker/services/tool_builder.py`.

    ```python
    @staticmethod
    def sentiment_analysis_tool():
        return {
            "type": "function",
            "function": {
                "name": "sentiment_analysis",
                "description": "Analyze the sentiment of text",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"}
                    },
                    "required": ["text"]
                }
            }
        }
    ```

---

## Adding a New Field to a Form

To add a custom field (e.g., "Company Size") to a form:

1.  **Update the Form Schema (Frontend)**:
    In the Form Editor UI, you can add fields dynamically. But if you need a *system* field:

2.  **Update Backend Validation**:
    If the field requires special validation, check `backend/api/src/domains/forms/schemas.ts` (or similar validation logic).

3.  **Update Worker Template Rendering**:
    The worker automatically injects form data into `{{submission.field_name}}`.
    - Ensure your HTML template uses `{{submission.company_size}}`.
    - The `AIStepProcessor` automatically puts all form fields into the AI context.

---

## Debugging a Failed Job

When a job fails:

1.  **Find the Job ID**:
    Check the Dashboard or DynamoDB `jobs` table.

2.  **Check Status**:
    ```bash
    aws dynamodb get-item --table-name leadmagnet-jobs --key '{"job_id": {"S": "YOUR_JOB_ID"}}'
    ```

3.  **Inspect Execution Steps (S3)**:
    Execution steps are stored in S3, not DynamoDB.
    ```bash
    # Find the S3 key from the job record
    aws s3 cp s3://leadmagnet-artifacts-ACCOUNT/tenant/jobs/JOB_ID/execution_steps.json .
    cat execution_steps.json | jq .
    ```

4.  **Check CloudWatch Logs**:
    - **API**: `/aws/lambda/leadmagnet-api`
    - **Worker**: `/aws/lambda/leadmagnet-worker`

---

## Testing a Workflow Locally

1.  **Start Local API & Frontend**:
    ```bash
    npm run dev
    ```

2.  **Use the Test Script**:
    The `backend/api/test-webhook.ts` or similar scripts can simulate a submission.
    
    ```bash
    cd backend/api
    npx ts-node test-webhook.ts
    ```

3.  **Run Worker Locally**:
    If you want to debug the Python worker step-by-step:
    ```bash
    cd backend/worker
    python3 runner.py --job-id YOUR_JOB_ID
    ```
    *(Note: You might need to mock the DynamoDB job record first)*

