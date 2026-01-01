# API Examples Guide

> **Last Updated**: 2026-01-01  
> **Status**: Current  
> **Related Docs**: [API Contracts](../reference/contracts/README.md), [Quick Start Guide](./QUICK_START.md), [Architecture Overview](../architecture/ARCHITECTURE.md)

Practical examples for using the Lead Magnet AI Platform API. This guide provides real-world code examples for common operations.

## Table of Contents

- [Authentication](#authentication)
- [Workflows](#workflows)
- [Forms](#forms)
- [Submissions](#submissions)
- [Jobs](#jobs)
- [Templates](#templates)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)

## Prerequisites

Before using the API, ensure you have:
- API URL (from CloudFormation outputs)
- Cognito credentials (User Pool ID, Client ID)
- Valid JWT token for authenticated endpoints

### Getting Your API URL

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)
echo $API_URL
```

## Authentication

### Get JWT Token

```bash
# Using AWS CLI
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters \
    USERNAME=your-email@example.com,PASSWORD=YourPassword123! \
  --query 'AuthenticationResult.IdToken' \
  --output text
```

### Using Token in Requests

```bash
# Set token
TOKEN="your-jwt-token-here"

# Use in curl requests
curl -H "Authorization: Bearer $TOKEN" \
  "$API_URL/admin/workflows"
```

### JavaScript/TypeScript Example

```typescript
import { CognitoUserPool, AuthenticationDetails, CognitoUser } from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
});

async function getAuthToken(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        resolve(result.getIdToken().getJwtToken());
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}
```

## Workflows

### Create a Workflow

```bash
curl -X POST "$API_URL/admin/workflows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_name": "Market Research Report",
    "workflow_type": "steps",
    "steps": [
      {
        "step_name": "Research",
        "step_order": 0,
        "model": "gpt-4o",
        "instructions": "Research the target market based on the form submission.",
        "tools": ["web_search"],
        "tool_choice": "auto",
        "depends_on": []
      },
      {
        "step_name": "Generate Report",
        "step_order": 1,
        "model": "gpt-4o",
        "instructions": "Generate a comprehensive market research report.",
        "tools": [],
        "tool_choice": "none",
        "depends_on": [0]
      }
    ],
    "template_id": "tmpl_xxx"
  }'
```

### List Workflows

```bash
curl -X GET "$API_URL/admin/workflows" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Workflow by ID

```bash
curl -X GET "$API_URL/admin/workflows/wf_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Workflow

```bash
curl -X PUT "$API_URL/admin/workflows/wf_xxx" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_name": "Updated Workflow Name",
    "steps": [...]
  }'
```

### Delete Workflow

```bash
curl -X DELETE "$API_URL/admin/workflows/wf_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

## Forms

### Create a Form

```bash
curl -X POST "$API_URL/admin/forms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_xxx",
    "form_name": "Market Research Form",
    "public_slug": "market-research",
    "form_fields_schema": {
      "fields": [
        {
          "field_id": "company_name",
          "field_type": "text",
          "label": "Company Name",
          "required": true,
          "placeholder": "Enter your company name"
        },
        {
          "field_id": "industry",
          "field_type": "select",
          "label": "Industry",
          "required": true,
          "options": [
            {"value": "tech", "label": "Technology"},
            {"value": "healthcare", "label": "Healthcare"},
            {"value": "finance", "label": "Finance"}
          ]
        },
        {
          "field_id": "description",
          "field_type": "textarea",
          "label": "Project Description",
          "required": false,
          "placeholder": "Describe your project..."
        }
      ]
    },
    "rate_limit": {
      "enabled": true,
      "max_submissions": 100,
      "window_minutes": 60
    }
  }'
```

### Get Form Configuration (Public)

```bash
curl -X GET "$API_URL/v1/forms/market-research"
```

### Submit Form (Public)

```bash
curl -X POST "$API_URL/v1/forms/market-research/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "company_name": "Acme Corp",
      "industry": "tech",
      "description": "We are building a new SaaS product."
    }
  }'
```

### List Forms (Admin)

```bash
curl -X GET "$API_URL/admin/forms" \
  -H "Authorization: Bearer $TOKEN"
```

## Submissions

### List Submissions

```bash
curl -X GET "$API_URL/admin/submissions?form_id=frm_xxx&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Submission by ID

```bash
curl -X GET "$API_URL/admin/submissions/sub_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

### Export Submissions

```bash
curl -X GET "$API_URL/admin/submissions/export?form_id=frm_xxx&format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o submissions.csv
```

## Jobs

### List Jobs

```bash
curl -X GET "$API_URL/admin/jobs?workflow_id=wf_xxx&status=completed&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Job by ID

```bash
curl -X GET "$API_URL/admin/jobs/job_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Job Execution Steps

```bash
curl -X GET "$API_URL/admin/jobs/job_xxx/steps" \
  -H "Authorization: Bearer $TOKEN"
```

### Retry Failed Job

```bash
curl -X POST "$API_URL/admin/jobs/job_xxx/retry" \
  -H "Authorization: Bearer $TOKEN"
```

## Templates

### Create Template

```bash
curl -X POST "$API_URL/admin/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "Market Research Template",
    "html_content": "<!DOCTYPE html><html><head><title>{{REPORT_TITLE}}</title></head><body><h1>{{REPORT_TITLE}}</h1><div>{{REPORT_CONTENT}}</div></body></html>",
    "is_published": true
  }'
```

### List Templates

```bash
curl -X GET "$API_URL/admin/templates" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Template by ID

```bash
curl -X GET "$API_URL/admin/templates/tmpl_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Template

```bash
curl -X PUT "$API_URL/admin/templates/tmpl_xxx" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "html_content": "<!DOCTYPE html>...",
    "is_published": true
  }'
```

## Webhooks

### Get Webhook Token

```bash
curl -X GET "$API_URL/admin/settings/webhook-token" \
  -H "Authorization: Bearer $TOKEN"
```

### Regenerate Webhook Token

```bash
curl -X POST "$API_URL/admin/settings/webhook-token/regenerate" \
  -H "Authorization: Bearer $TOKEN"
```

### Trigger Workflow via Webhook

```bash
curl -X POST "$API_URL/v1/webhooks/YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_xxx",
    "submission_data": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "custom_field": "value"
    }
  }'
```

## Error Handling

### Common Error Responses

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "statusCode": 401
}
```

```json
{
  "error": "Validation Error",
  "message": "Missing required field: workflow_name",
  "statusCode": 400,
  "details": {
    "field": "workflow_name",
    "reason": "required"
  }
}
```

```json
{
  "error": "Not Found",
  "message": "Workflow not found: wf_xxx",
  "statusCode": 404
}
```

### Error Handling Example (JavaScript)

```typescript
async function apiRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error('API Error:', error.message);
    }
    throw error;
  }
}
```

## Complete Example: End-to-End Workflow

```bash
#!/bin/bash

# Set variables
API_URL="your-api-url"
TOKEN="your-jwt-token"

# 1. Create template
TEMPLATE_RESPONSE=$(curl -s -X POST "$API_URL/admin/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "Example Template",
    "html_content": "<html><body>{{CONTENT}}</body></html>",
    "is_published": true
  }')

TEMPLATE_ID=$(echo $TEMPLATE_RESPONSE | jq -r '.template_id')

# 2. Create workflow
WORKFLOW_RESPONSE=$(curl -s -X POST "$API_URL/admin/workflows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow_name\": \"Example Workflow\",
    \"workflow_type\": \"steps\",
    \"steps\": [{
      \"step_name\": \"Generate Content\",
      \"step_order\": 0,
      \"model\": \"gpt-4o\",
      \"instructions\": \"Generate personalized content.\",
      \"tools\": [],
      \"tool_choice\": \"none\",
      \"depends_on\": []
    }],
    \"template_id\": \"$TEMPLATE_ID\"
  }")

WORKFLOW_ID=$(echo $WORKFLOW_RESPONSE | jq -r '.workflow_id')

# 3. Create form
FORM_RESPONSE=$(curl -s -X POST "$API_URL/admin/forms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow_id\": \"$WORKFLOW_ID\",
    \"form_name\": \"Example Form\",
    \"public_slug\": \"example-form\",
    \"form_fields_schema\": {
      \"fields\": [{
        \"field_id\": \"name\",
        \"field_type\": \"text\",
        \"label\": \"Name\",
        \"required\": true
      }]
    }
  }")

FORM_SLUG=$(echo $FORM_RESPONSE | jq -r '.public_slug')

# 4. Submit form
JOB_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }')

JOB_ID=$(echo $JOB_RESPONSE | jq -r '.job_id')

echo "Job created: $JOB_ID"

# 5. Poll for job completion
while true; do
  JOB_STATUS=$(curl -s -X GET "$API_URL/admin/jobs/$JOB_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')
  
  if [ "$JOB_STATUS" = "completed" ]; then
    echo "Job completed!"
    break
  elif [ "$JOB_STATUS" = "failed" ]; then
    echo "Job failed!"
    break
  fi
  
  sleep 5
done
```

## Related Documentation

- [API Contracts](../reference/contracts/README.md) - Complete API reference
- [Quick Start Guide](./QUICK_START.md) - Getting started guide
- [Architecture Overview](../architecture/ARCHITECTURE.md) - System architecture
- [Webhooks Guide](./WEBHOOKS.md) - Webhook integration guide

---

**💡 Tip**: Use the examples above as starting points and customize them for your specific use case.
