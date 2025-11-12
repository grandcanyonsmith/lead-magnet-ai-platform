# Glossary

This document defines key terms and concepts used throughout the Lead Magnet AI platform.

## Core Concepts

### Lead Magnet
A free, valuable resource that businesses offer in exchange for contact information (name, email, phone). Examples include checklists, reports, audits, and validators.

### AI Lead Magnet
A lead magnet that uses artificial intelligence to personalize the deliverable based on form submission data. Instead of sending a generic PDF, the system generates personalized content specific to each lead.

### Workflow
A configuration that defines how a lead magnet is generated. Workflows specify:
- What information to collect (via forms)
- How AI should process the information (via steps)
- What deliverable to create (HTML, markdown, etc.)
- How to deliver the result (webhook, SMS)

### Form
A public-facing form that collects lead information. Forms are linked to workflows and trigger job creation when submitted.

### Submission
A single form submission containing:
- Lead information (name, email, phone)
- Custom form field answers
- Metadata (IP address, timestamp)

### Job
A single execution of a workflow for a specific submission. Jobs track:
- Status (pending, processing, completed, failed)
- Execution steps (what happened during processing)
- Artifacts (generated files)
- Output URL (final deliverable)

## Workflow Concepts

### Workflow Step (Configuration)
A step definition in a workflow configuration. Defines:
- What the step should do (`instructions`)
- Which AI model to use (`model`)
- What tools are available (`tools`)
- Dependencies on other steps (`depends_on`)
- Execution order (`step_order`)

**Example:**
```typescript
{
  step_name: "Market Research",
  step_order: 0,
  model: "gpt-5",
  instructions: "Research the target market...",
  tools: ["web_search_preview"],
  depends_on: []
}
```

### Execution Step (Runtime)
A record of what actually happened during job processing. Contains:
- Step name and type
- Input and output
- AI model used
- Usage information (tokens, cost)
- Duration
- Timestamp
- Artifact ID (if step produced an artifact)

**Example:**
```json
{
  "step_name": "Market Research",
  "step_order": 0,
  "step_type": "ai_generation",
  "model": "gpt-5",
  "input": {...},
  "output": "Market research report content...",
  "usage_info": {
    "input_tokens": 1500,
    "output_tokens": 2000,
    "cost_usd": 0.05
  },
  "duration_ms": 3500,
  "timestamp": "2025-01-15T10:30:00Z",
  "artifact_id": "art_123"
}
```

**Key Difference**: Workflow steps are configuration (what should happen), execution steps are runtime records (what actually happened).

### Step Dependencies
A relationship between workflow steps where one step must complete before another can start. Steps with the same `step_order` and no dependencies can run in parallel.

**Example:**
```typescript
// Step 0: Can run in parallel
{ step_order: 0, depends_on: [] }
{ step_order: 0, depends_on: [] }

// Step 1: Must wait for step 0
{ step_order: 1, depends_on: [0] }
```

### Step Order
A number indicating when a step should execute relative to other steps. Steps with the same order can run in parallel (if they have no dependencies).

## Storage Concepts

### Execution Steps Storage
Execution steps are **always stored in S3** (never in DynamoDB) to ensure complete data storage without size limitations. Only the S3 key reference (`execution_steps_s3_key`) is stored in DynamoDB.

### Artifact
A file generated during job processing. Examples:
- Research reports (markdown)
- HTML deliverables
- Step outputs

Artifacts are stored in S3 and referenced via:
- `artifact_id` (DynamoDB primary key)
- `s3_key` (S3 location)
- `public_url` (CloudFront or presigned URL)

### Artifact URL Types

#### CloudFront URL
- Non-expiring URL
- Preferred method
- Requires CloudFront distribution configured
- Format: `https://{cloudfront-domain}/{s3-key}`

#### Presigned URL
- Expiring URL (max 7 days)
- Fallback when CloudFront not available
- Format: `https://{bucket}.s3.amazonaws.com/{key}?X-Amz-Signature=...`

## Execution Concepts

### Step Functions (Production)
AWS Step Functions orchestrates workflow execution in production. Provides:
- Automatic retry logic
- Error handling
- State management
- Visibility in AWS Console

### Direct Processing (Local)
Lambda function processes jobs directly in local development. Provides:
- Fast iteration
- Easier debugging
- No AWS dependencies

See [Execution Paths](./EXECUTION_PATHS.md) for details.

## Workflow Formats

### Legacy Format
Simple boolean flags (`research_enabled`, `html_enabled`) with single instruction field. Limited to 2 steps maximum.

### Steps Format (New)
Flexible multi-step workflow with dependencies and parallel execution support. Recommended for new workflows.

See [Workflow Formats](./WORKFLOW_FORMATS.md) for details.

## Delivery Concepts

### Webhook Delivery
Sends job results to a configured webhook URL with dynamic values (e.g., `{{submission.email}}`, `{{artifact_url}}`).

### SMS Delivery
Sends job results via Twilio SMS directly to the lead's phone. Can use manual SMS content or AI-generated content.

## Technical Terms

### Tenant
A customer account. All resources (workflows, forms, jobs) are isolated by tenant ID.

### DynamoDB
AWS NoSQL database used for storing:
- Workflows
- Forms
- Submissions
- Jobs (metadata only)
- Artifacts (metadata only)

### S3
AWS object storage used for storing:
- Execution steps (always)
- Artifacts (always)
- Large job data

### CloudFront
AWS CDN used for serving:
- Artifact URLs (non-expiring)
- Execution steps URLs (non-expiring)

## Common Abbreviations

- **API**: Application Programming Interface
- **CDN**: Content Delivery Network
- **IAM**: Identity and Access Management
- **S3**: Simple Storage Service
- **DynamoDB**: Dynamo Database
- **Step Functions**: AWS Step Functions
- **Lambda**: AWS Lambda (serverless compute)
- **CloudFront**: AWS CloudFront (CDN)
- **SMS**: Short Message Service
- **HTML**: HyperText Markup Language
- **JSON**: JavaScript Object Notation
- **URL**: Uniform Resource Locator
- **TTL**: Time To Live

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Workflow Formats](./WORKFLOW_FORMATS.md)
- [Execution Paths](./EXECUTION_PATHS.md)

