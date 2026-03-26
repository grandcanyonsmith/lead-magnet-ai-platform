---
name: optimize-lead-magnet
description: Analyze and optimize an existing lead magnet workflow by consolidating steps, adding structured outputs (json_schema), fixing model selection, and redeploying. Use when the user wants to improve, optimize, refactor, or fix a workflow, lead magnet, or ICP creator — or says something like "make this better", "use fewer steps", or "add structured output".
---

# Optimize Lead Magnet Workflow

## Overview

Take an existing multi-step workflow from DynamoDB, analyze its structure, consolidate into fewer steps with structured outputs, and redeploy. The goal: same output dimensions, fewer API calls, guaranteed schema compliance.

## Step 1: Identify the Workflow

Find the target workflow in DynamoDB:

```bash
# Search by name
aws dynamodb scan --table-name leadmagnet-workflows --region us-east-1 \
  --filter-expression "contains(workflow_name, :name)" \
  --expression-attribute-values '{":name": {"S": "SEARCH_TERM"}}' \
  --projection-expression "workflow_id, tenant_id, workflow_name" --output json

# Get full step details
aws dynamodb get-item --table-name leadmagnet-workflows --region us-east-1 \
  --key '{"workflow_id": {"S": "wf_XXX"}}' \
  --projection-expression "workflow_name, workflow_description, steps" --output json
```

Parse the DynamoDB JSON to extract every step's name, model, tools, and output_format. Map each step to the **data dimension** it produces.

## Step 2: Map Output Dimensions

Create a table mapping every original step to the data it produces. Example:

| Step | Data Dimension |
|------|---------------|
| Market Research | market_size, trends, demand_signals |
| Voice of Customer | fears, pains, problems (ranked) |
| Demographics | age, income, education, location |

Every dimension from the original must appear in the new workflow.

## Step 3: Design the Consolidated Workflow

### Architecture Pattern

Use a **2-step pipeline**:

| Step | Model | Tools | Output Format | Purpose |
|------|-------|-------|--------------|---------|
| 0: Research & Analysis | gpt-5.2 | web_search (required) | `json_schema` (strict) | All research → guaranteed JSON |
| 1: Deliverable + Assets | gpt-5.2 | image_generation | text (HTML) | Consume JSON → final HTML + images |

### Structured Output Schema Rules (OpenAI strict mode)

Every object in the schema must have:
- `"additionalProperties": false`
- All properties listed in `"required"`
- No `enum` on string types unless truly constrained

```json
{
  "type": "json_schema",
  "name": "schema_name_max_64_chars",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": { ... },
    "required": ["every", "single", "property"],
    "additionalProperties": false
  }
}
```

### Token Limits

Set `max_output_tokens` based on schema size:
- Small schema (5-10 fields): 16,000
- Medium schema (10-15 fields): 32,000
- Large schema (15+ fields): 65,536

### Model Selection

- `gpt-5.2` for both steps (supports all tools including shell)
- Do NOT use `gpt-4-turbo` — it doesn't support the `shell` tool which the worker may auto-inject

## Step 4: Build the Workflow JSON

Create the workflow definition in `scripts/workflows/`. See [reference.md](reference.md) for the full `WorkflowStep` schema and a complete example.

Validate the JSON before deploying:

```python
# Verify schema compliance
python3 -c "
import json
with open('scripts/workflows/YOUR_WORKFLOW.json') as f:
    data = json.load(f)
for i, step in enumerate(data['steps']):
    fmt = step.get('output_format', {})
    if isinstance(fmt, dict) and fmt.get('type') == 'json_schema':
        schema = fmt['schema']
        # Check additionalProperties on all nested objects
        def check(obj, path='root'):
            if isinstance(obj, dict) and obj.get('type') == 'object':
                assert obj.get('additionalProperties') == False, f'{path}: missing additionalProperties'
                assert set(obj.get('properties',{}).keys()) == set(obj.get('required',[])), f'{path}: required mismatch'
            for k, v in obj.get('properties', {}).items():
                check(v, f'{path}.{k}')
            if 'items' in obj:
                check(obj['items'], f'{path}[]')
        check(schema)
        print(f'Step {i} schema: VALID')
print('All steps validated.')
"
```

## Step 5: Deploy

```python
# Update existing workflow
python3 scripts/workflows/deploy-WORKFLOW.py --tenant-id TENANT --workflow-id wf_XXX

# Or create new
python3 scripts/workflows/deploy-WORKFLOW.py --tenant-id TENANT
```

If updating an existing workflow, also check if the form fields need updating to match the new step instructions:

```python
# Update form fields via boto3
import boto3
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
forms_table = dynamodb.Table('leadmagnet-forms')
forms_table.update_item(
    Key={'form_id': 'form_XXX'},
    UpdateExpression='SET form_fields_schema = :schema, updated_at = :ts',
    ExpressionAttributeValues={
        ':schema': {'fields': NEW_FIELDS},
        ':ts': datetime.utcnow().isoformat(),
    },
)
```

## Step 6: Test

Submit a test job and validate outputs:

```python
import requests
response = requests.post(
    f"{API_URL}/v1/forms/{FORM_SLUG}/submit",
    json={"submission_data": TEST_DATA},
)
job_id = response.json()["job_id"]
```

Poll via DynamoDB (not the public API — `/v1/jobs/:id` is admin-only):

```python
job = jobs_table.get_item(Key={'job_id': job_id}).get('Item', {})
```

After completion, verify artifacts in S3:

```python
s3.list_objects_v2(Bucket='leadmagnet-artifacts-471112574622',
                   Prefix=f'{tenant_id}/jobs/{job_id}/')
```

Validate Step 0's structured output:
1. File should be valid JSON (not truncated)
2. All schema fields present
3. Arrays populated with substantive items
4. Sources include real URLs

If JSON is truncated → increase `max_output_tokens` and redeploy.

## Known Gotchas

### Shell Tool Auto-Injection

The worker at `backend/worker/services/steps/handlers/ai_generation.py` has a heuristic that replaces all tools with `shell` if step instructions contain keywords like `"pdf"`, `"png"`, `"export"`, `"render"`, or `"file"` (substring match — `"profile"` triggers `"file"`).

**Fix**: Set Lambda env var `SHELL_EXECUTOR_FORCE_SHELL_FOR_FILES=false`:

```python
client = boto3.client('lambda', region_name='us-east-1')
config = client.get_function_configuration(FunctionName=LAMBDA_NAME)
env_vars = config['Environment']['Variables']
env_vars['SHELL_EXECUTOR_FORCE_SHELL_FOR_FILES'] = 'false'
client.update_function_configuration(
    FunctionName=LAMBDA_NAME,
    Environment={'Variables': env_vars}
)
```

Lambda name: `leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG`

### API URL

Production: `https://czp5b77azd.execute-api.us-east-1.amazonaws.com`

### DynamoDB Tables

| Table | Key |
|-------|-----|
| `leadmagnet-workflows` | `workflow_id` |
| `leadmagnet-forms` | `form_id` (GSI: `gsi_public_slug`) |
| `leadmagnet-jobs` | `job_id` |

### S3 Artifacts

Bucket: `leadmagnet-artifacts-471112574622`
Path pattern: `{tenant_id}/jobs/{job_id}/`

## Additional Resources

- Full WorkflowStep schema and example: [reference.md](reference.md)
