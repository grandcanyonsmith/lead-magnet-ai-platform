# OpenAI API Request/Response History

This document explains how to view the full history of OpenAI API requests and responses for each workflow execution step.

## Overview

Starting with the latest code changes, the system now stores:
- **Full raw OpenAI API request body** - The exact parameters sent to OpenAI's API
- **Full raw OpenAI API response object** - The complete response received from OpenAI

This data is stored in execution steps in S3, allowing you to see exactly what was sent and received for debugging, auditing, or analysis.

## Where It's Stored

Execution steps are stored in S3 at:
```
{tenant_id}/jobs/{job_id}/execution_steps.json
```

Each step contains:
- `input.raw_api_request` - Full raw API request body
- `response_details.raw_api_response` - Full raw API response object

## How to Access

### Option 1: Using the Script (Recommended)

Use the provided script to view API history:

```bash
# View all steps for a job
python scripts/jobs/view-api-history.py <job_id>

# View a specific step
python scripts/jobs/view-api-history.py <job_id> --step 0

# Output as JSON
python scripts/jobs/view-api-history.py <job_id> --format json
```

**Example:**
```bash
python scripts/jobs/view-api-history.py job_01KAYWC2PSSPBE6PAMQAH5P62Z --step 0
```

### Option 2: Via API Endpoint

Fetch execution steps via the API:

```bash
GET /api/execution-steps/{jobId}
```

Then look for:
- `steps[].input.raw_api_request` - Full request
- `steps[].response_details.raw_api_response` - Full response

### Option 3: Direct S3 Access

1. Get the S3 key from DynamoDB:
   ```python
   job = dynamodb.get_item(Key={"job_id": job_id})
   s3_key = job['Item']['execution_steps_s3_key']
   ```

2. Download from S3:
   ```python
   s3_response = s3_client.get_object(Bucket=bucket, Key=s3_key)
   execution_steps = json.loads(s3_response['Body'].read())
   ```

3. Access raw request/response:
   ```python
   step = execution_steps[0]
   raw_request = step['input']['raw_api_request']
   raw_response = step['response_details']['raw_api_response']
   ```

## What's Included

### Raw API Request (`raw_api_request`)

Contains the exact parameters sent to OpenAI's Responses API:
- `model` - Model name (e.g., "gpt-4o")
- `instructions` - System instructions
- `input` - User input (can be string or list with images)
- `tools` - Array of tool definitions
- `tool_choice` - Tool choice setting ("auto", "required", "none", etc.)

### Raw API Response (`raw_api_response`)

Contains the complete response object from OpenAI:
- `id` - Response ID
- `model` - Model used
- `created` - Timestamp
- `output` - Array of output items
- `output_text` - Extracted text output
- `usage` - Token usage information
- `tool_calls` - Tool calls made (if any)
- All other response fields

## Example Output

```json
{
  "step_order": 0,
  "step_name": "Research and Analysis",
  "input": {
    "model": "gpt-4o",
    "instructions": "You are a helpful assistant...",
    "input": "Create a hospital map",
    "raw_api_request": {
      "model": "gpt-4o",
      "instructions": "You are a helpful assistant...",
      "input": [
        {
          "role": "user",
          "content": [
            {"type": "input_text", "text": "Create a hospital map"}
          ]
        }
      ],
      "tools": [
        {"type": "image_generation", "size": "1536x1024"}
      ],
      "tool_choice": "required"
    }
  },
  "response_details": {
    "output_text": "Here's your hospital map...",
    "raw_api_response": {
      "id": "resp_abc123",
      "model": "gpt-4o",
      "created": 1234567890,
      "output": [
        {
          "type": "output_text",
          "text": "Here's your hospital map..."
        },
        {
          "type": "tool_output",
          "tool_name": "image_generation",
          "output": {
            "image_url": "https://..."
          }
        }
      ],
      "usage": {
        "input_tokens": 150,
        "output_tokens": 200,
        "total_tokens": 350
      }
    }
  }
}
```

## Troubleshooting

### No `raw_api_request` or `raw_api_response` Found

This means the job was executed before the code changes. Only new jobs will have the full raw request/response stored.

### Large Response Objects

Very large responses may be truncated in logs, but the full data is stored in S3. Use the script or direct S3 access to view complete data.

### Response Serialization Errors

If a response can't be fully serialized, a fallback representation will be stored with error details. Check the `raw_api_response` for an `error` field.

## Notes

- The raw request/response is stored **in addition to** the processed versions, so you have both
- Image URLs in requests may be converted to base64 data URLs (this is normal)
- The raw response includes all fields returned by OpenAI, even if not used by the application
- This data is useful for:
  - Debugging API issues
  - Auditing what was sent/received
  - Analyzing token usage patterns
  - Reproducing exact API calls

