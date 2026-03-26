# Reference: WorkflowStep Schema & Examples

## WorkflowStep Interface

From `backend/api/src/types/resources.ts`:

```typescript
interface WorkflowStep {
  step_name: string;
  step_description?: string;
  model: string;                    // "gpt-5.2", "gpt-4-turbo", etc.
  reasoning_effort?: "none" | "low" | "medium" | "high" | "xhigh";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority";
  text_verbosity?: "low" | "medium" | "high";
  max_output_tokens?: number;       // 16000-65536 typical
  output_format?:
    | { type: "text" }
    | { type: "json_object" }
    | { type: "json_schema"; name: string; description?: string; strict?: boolean; schema: Record<string, any> };
  is_deliverable?: boolean;         // true on the final HTML step
  instructions: string;
  step_order: number;
  depends_on?: number[];            // 0-based indices
  tools?: (string | ToolConfig)[];  // "web_search", "code_interpreter", { type: "image_generation", ... }
  tool_choice?: "auto" | "required" | "none";
}
```

## Validation Pipeline

The `output_format` is validated at three levels:

1. **API** (`backend/api/src/utils/validation.ts`): Zod schema validates `name` (1-64 chars), `schema` (object), optional `description`/`strict`
2. **Worker** (`backend/worker/services/ai_step_processor.py`): Checks `type` is in `['text','json_object','json_schema']`, validates `name` is string, `schema` is dict
3. **OpenAI params** (`backend/worker/services/openai/request_builder/params_builder.py`): Enforces `additionalProperties: false` on all nested objects, sets `strict: true` by default

## Deploy Script Template

```python
#!/usr/bin/env python3
"""Deploy WORKFLOW_NAME to DynamoDB."""

import json, os, re, time, random, string, argparse, boto3
from datetime import datetime
from pathlib import Path
from typing import Optional

REGION = os.environ.get("AWS_REGION", "us-east-1")
WORKFLOWS_TABLE = os.environ.get("WORKFLOWS_TABLE", "leadmagnet-workflows")
FORMS_TABLE = os.environ.get("FORMS_TABLE", "leadmagnet-forms")

SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_JSON = SCRIPT_DIR / "your-workflow.json"

FORM_FIELDS = [
    {"field_id": "name", "field_type": "text", "label": "Your Name", "placeholder": "e.g., Jane Smith", "required": True},
    {"field_id": "email", "field_type": "email", "label": "Email", "placeholder": "you@company.com", "required": True},
    # Add workflow-specific fields here
]


def generate_ulid() -> str:
    timestamp_ms = int(time.time() * 1000)
    random_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"{timestamp_ms:013x}{random_part}"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def deploy(tenant_id: str, workflow_id: Optional[str] = None, dry_run: bool = False):
    with open(WORKFLOW_JSON) as f:
        definition = json.load(f)

    steps = definition["steps"]
    for idx, step in enumerate(steps):
        step.setdefault("step_order", idx)
        step.setdefault("tools", [])
        step.setdefault("tool_choice", "auto")

    wf_id = workflow_id or f"wf_{generate_ulid()}"
    form_id = f"form_{generate_ulid()}"
    now = datetime.utcnow().isoformat()

    if dry_run:
        print(f"[DRY RUN] Workflow: {wf_id} | Steps: {len(steps)}")
        for i, s in enumerate(steps):
            fmt = s.get("output_format", {})
            fmt_label = fmt.get("type", "text") if isinstance(fmt, dict) else "text"
            print(f"  Step {i}: {s['step_name']} ({s['model']}) -> {fmt_label}")
        return

    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)

    if workflow_id:
        workflows_table.update_item(
            Key={"workflow_id": workflow_id},
            UpdateExpression="SET workflow_name = :name, workflow_description = :desc, steps = :steps, updated_at = :ts",
            ExpressionAttributeValues={
                ":name": definition["workflow_name"],
                ":desc": definition["workflow_description"],
                ":steps": steps,
                ":ts": now,
            },
        )
    else:
        workflows_table.put_item(Item={
            "workflow_id": wf_id, "tenant_id": tenant_id,
            "workflow_name": definition["workflow_name"],
            "workflow_description": definition["workflow_description"],
            "steps": steps, "status": "active", "form_id": form_id,
            "created_at": now, "updated_at": now,
        })
        forms_table = dynamodb.Table(FORMS_TABLE)
        forms_table.put_item(Item={
            "form_id": form_id, "tenant_id": tenant_id, "workflow_id": wf_id,
            "form_name": f"{definition['workflow_name']} Form",
            "public_slug": slugify(definition["workflow_name"]),
            "form_fields_schema": {"fields": FORM_FIELDS},
            "created_at": now, "updated_at": now,
        })

    print(f"Deployed: {wf_id} ({len(steps)} steps)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--workflow-id", help="Update existing (omit to create new)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    deploy(args.tenant_id, args.workflow_id, args.dry_run)
```

## Example: 2-Step Workflow with Structured Output

This is the pattern used for ICP Creator V4 — consolidating 23 steps into 2:

```json
{
  "workflow_name": "Example Workflow",
  "workflow_description": "Description of what this produces.",
  "steps": [
    {
      "step_name": "Research & Analysis",
      "step_description": "Web research with structured JSON output.",
      "model": "gpt-5.2",
      "reasoning_effort": "high",
      "service_tier": "auto",
      "max_output_tokens": 65536,
      "instructions": "Act as [ROLE].\n\n## Input\nUse form fields [field_a], [field_b].\n\n## Research\nUse web_search for real data.\n\n## Output\nReturn JSON matching the schema. Fill every field.",
      "step_order": 0,
      "depends_on": [],
      "tools": ["web_search"],
      "tool_choice": "required",
      "output_format": {
        "type": "json_schema",
        "name": "research_output",
        "description": "Structured research data",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "section_a": {
              "type": "object",
              "properties": {
                "field_1": { "type": "string" },
                "field_2": { "type": "array", "items": { "type": "string" } }
              },
              "required": ["field_1", "field_2"],
              "additionalProperties": false
            },
            "section_b": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "item": { "type": "string" },
                  "evidence": { "type": "string" }
                },
                "required": ["item", "evidence"],
                "additionalProperties": false
              }
            }
          },
          "required": ["section_a", "section_b"],
          "additionalProperties": false
        }
      }
    },
    {
      "step_name": "Final Deliverable",
      "step_description": "HTML deliverable from structured data.",
      "model": "gpt-5.2",
      "reasoning_effort": "high",
      "service_tier": "auto",
      "max_output_tokens": 32000,
      "instructions": "Transform the structured JSON from Step 0 into a standalone HTML5 document.\n\n## Requirements\n- <!DOCTYPE html> with Google Fonts\n- CSS custom properties for brand colors\n- Mobile-responsive\n- All sections from the research data\n- No placeholders",
      "step_order": 1,
      "depends_on": [0],
      "tools": [
        { "type": "image_generation", "size": "1024x1024", "quality": "high", "format": "png", "background": "transparent" }
      ],
      "tool_choice": "auto",
      "is_deliverable": true
    }
  ]
}
```

## Test Submission Template

```python
import requests, boto3, json, time

API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

response = requests.post(
    f"{API_URL}/v1/forms/{FORM_SLUG}/submit",
    json={"submission_data": {
        "name": "Test User",
        "email": "test@example.com",
        # workflow-specific fields
    }},
)
job_id = response.json()["job_id"]

# Poll DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
jobs_table = dynamodb.Table('leadmagnet-jobs')
for i in range(60):
    time.sleep(20)
    job = jobs_table.get_item(Key={'job_id': job_id}).get('Item', {})
    status = job.get('status', '?')
    if status in ('completed', 'failed'):
        break

# Verify artifacts
s3 = boto3.client('s3', region_name='us-east-1')
response = s3.list_objects_v2(
    Bucket='leadmagnet-artifacts-471112574622',
    Prefix=f'{TENANT_ID}/jobs/{job_id}/'
)
for obj in response.get('Contents', []):
    print(f"  {obj['Key'].split('/')[-1]}: {obj['Size']:,} bytes")

# Validate structured output from Step 0
for obj in response.get('Contents', []):
    if 'step_1' in obj['Key'] and obj['Key'].endswith('.json'):
        data = s3.get_object(Bucket='leadmagnet-artifacts-471112574622', Key=obj['Key'])
        parsed = json.loads(data['Body'].read().decode('utf-8'))
        print(f"Structured output: {len(parsed)} fields — {list(parsed.keys())}")
```
