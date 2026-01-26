# 📖 Glossary

> **Last Updated**: 2026-01-01  
> **Status**: Current  
> **Related Docs**: [Architecture Overview](../architecture/ARCHITECTURE.md), [Workflow Formats](./WORKFLOW_FORMATS.md), [Execution Paths](../architecture/EXECUTION_PATHS.md)

This document defines key terms and concepts used throughout the Lead Magnet AI platform. Use this glossary to understand terminology and concepts.

## 📚 Table of Contents

- [Core Concepts](#core-concepts)
- [Workflow Concepts](#workflow-concepts)
- [Storage Concepts](#storage-concepts)
- [Execution Concepts](#execution-concepts)
- [Delivery Concepts](#delivery-concepts)
- [AI & Model Concepts](#ai--model-concepts)
- [Technical Terms](#technical-terms)
- [Common Abbreviations](#common-abbreviations)

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
- **Status**: `pending`, `processing`, `completed`, `failed`
- **Execution steps**: What happened during processing (stored in S3)
- **Artifacts**: Generated files (reports, HTML deliverables)
- **Output URL**: Final deliverable URL (CloudFront or presigned)
- **Cost**: Total cost of AI API calls
- **Duration**: Total processing time

**Example Job Status Flow:**
```
pending → processing → completed
                    ↓
                 failed (on error)
```

### Template
An HTML template used for generating final deliverables. Templates use placeholder syntax (`{{PLACEHOLDER_NAME}}`) that gets replaced with AI-generated content.

**Example Template:**
```html
<!DOCTYPE html>
<html>
<head><title>{{REPORT_TITLE}}</title></head>
<body>
  <h1>{{REPORT_TITLE}}</h1>
  <div>{{REPORT_CONTENT}}</div>
</body>
</html>
```

### Tenant / Customer
A customer account with complete data isolation. All resources (workflows, forms, jobs) are scoped by tenant ID to ensure multi-tenant security.

**Key Points:**
- Each tenant has a unique `tenant_id` (usually matches Cognito user ID)
- Data is completely isolated between tenants
- SUPER_ADMIN users can view multiple tenants (agency view)

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
  tools: ["web_search"],
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

**Rules:**
- `depends_on` is the source of truth for execution and context inclusion
- `depends_on` uses **step indices (0-based)** from the workflow `steps` array
- If `depends_on` is omitted, the system falls back to `step_order` (legacy behavior)

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

**Rules:**
- Lower numbers execute first
- Steps with the same `step_order` can run in parallel
- Dependencies override step order (step waits for dependencies even if order is lower)
- If `depends_on` is present, `step_order` only affects scheduling among independent steps

**Example:**
```typescript
// These run first, in parallel
{ step_order: 0, depends_on: [] }  // Step A
{ step_order: 0, depends_on: [] }  // Step B

// This runs after Step A and B complete
{ step_order: 1, depends_on: [0] }  // Step C (depends on order 0)
```

### Step Output
The result produced when a step executes. Stored in the execution step record (`execution_steps[].output`) along with metadata like artifacts and image URLs. Step outputs are the **inputs** used to build context for dependency steps.

### Context Instructions (Step Instructions)
The `instructions` field on a workflow step. This is the directive for the AI (what to do), and it is **combined with context** (form submission + dependency step outputs) to create the final prompt for that step.

### Tool Choice
Controls whether AI must use tools (`required`), can use tools (`auto`), or cannot use tools (`none`).

**Options:**
- `auto` (default): AI decides whether to use tools
- `required`: AI must use at least one tool (fails if no tools available)
- `none`: AI cannot use tools (for HTML generation, formatting)

**Best Practice:** Use `auto` for most steps, `none` for HTML generation.

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
Sends job results to a configured webhook URL with dynamic values. Supports custom headers and payload formatting.

**Dynamic Values:**
- `{{submission.email}}` - Lead's email address
- `{{submission.name}}` - Lead's name
- `{{submission.phone}}` - Lead's phone number
- `{{artifact_url}}` - URL to the generated lead magnet
- `{{job_id}}` - Job identifier
- `{{workflow_name}}` - Workflow name

**Example Webhook Payload:**
```json
{
  "email": "{{submission.email}}",
  "name": "{{submission.name}}",
  "lead_magnet_url": "{{artifact_url}}",
  "job_id": "{{job_id}}"
}
```

### SMS Delivery
Sends job results via Twilio SMS directly to the lead's phone. Can use manual SMS content or AI-generated content.

**Options:**
- **Manual SMS**: Fixed message template with dynamic values
- **AI-Generated SMS**: AI generates SMS content based on lead magnet context

**Example SMS:**
```
Hi {{submission.name}}! Your personalized market research report is ready: {{artifact_url}}
```

### Delivery Status
Tracks the delivery status of webhooks and SMS:
- `pending`: Delivery not yet attempted
- `delivered`: Successfully delivered
- `failed`: Delivery failed (with retry logic)

## AI & Model Concepts

### AI Model
The OpenAI model used for generating content. Available models include:
- `gpt-4o`: Best for research and complex tasks (recommended)
- `gpt-4-turbo`: Good balance of quality and cost
- `gpt-3.5-turbo`: Cost-effective for simple tasks
- `gpt-5`: Latest model (when available)

**Model Selection Guide:**
- Use GPT-4o for research, analysis, and final deliverables
- Use GPT-3.5 Turbo for simple formatting and transformations
- Consider cost vs. quality trade-offs

### Tools
Capabilities available to AI models during workflow execution.

**Available Tools:**
- `web_search`: Search the web for real-time information
- `image_generation`: Generate images using DALL-E
- `code_interpreter`: Execute Python code for data processing
- `file_search`: Search uploaded files (requires vector store)
- `computer_use_preview`: Preview computer interactions (requires container)

**Tool Configuration:**
```typescript
{
  tools: ["web_search", "image_generation"],
  tool_choice: "auto"  // or "required" or "none"
}
```

### Token Usage
Measures of AI API consumption:
- **Input Tokens**: Tokens in the prompt/context sent to AI
- **Output Tokens**: Tokens in the AI's response
- **Total Tokens**: Sum of input and output tokens
- **Cost**: Calculated based on model pricing and token usage

**Cost Calculation:**
- Different models have different pricing per token
- Input and output tokens may have different rates
- Cost tracked per step and per job

### Context Accumulation
The process of building context for each workflow step by including outputs from **dependency steps**.

**How It Works:**
1. Step 0 receives form submission data
2. Step 1 receives form data + outputs from its dependencies
3. Step 2 receives form data + outputs from its dependencies
4. And so on...

**Notes:**
- If a step does not define `depends_on`, the system uses `step_order` to infer dependencies (legacy fallback)
- Only dependency step outputs are added to the prompt context

**Benefits:**
- Each step has full context
- Enables multi-step reasoning
- Maintains continuity across steps

## Technical Terms

### Tenant / Customer ID
A unique identifier for a customer account. All resources are scoped by tenant ID for multi-tenant isolation.

**Format:** Usually matches Cognito user ID (UUID)

### DynamoDB
AWS NoSQL database used for storing:
- **Workflows**: Workflow configurations
- **Forms**: Form definitions and schemas
- **Submissions**: Form submission records
- **Jobs**: Job metadata (status, timestamps, references)
- **Artifacts**: Artifact metadata (S3 keys, URLs)
- **Templates**: HTML template definitions
- **User Settings**: User preferences and configuration

**Key Features:**
- Multi-tenant isolation via partition keys
- Global Secondary Indexes (GSIs) for querying
- On-demand pricing (pay-per-use)

### S3 (Simple Storage Service)
AWS object storage used for storing:
- **Execution Steps**: Always stored in S3 (never DynamoDB)
- **Artifacts**: Generated files (HTML, markdown, images)
- **Large Job Data**: Large payloads that exceed DynamoDB limits

**Key Features:**
- Unlimited storage
- Versioning support
- Lifecycle policies
- Encryption at rest

### CloudFront
AWS CDN (Content Delivery Network) used for serving:
- **Artifact URLs**: Non-expiring public URLs
- **Execution Steps URLs**: Non-expiring URLs for step data
- **Frontend Assets**: Static frontend files

**Benefits:**
- Fast global delivery
- Non-expiring URLs
- HTTPS/TLS encryption
- Caching for performance

### Step Functions
AWS service that orchestrates workflow execution in production.

**Features:**
- Automatic retry logic
- Error handling and recovery
- State management
- Visibility in AWS Console
- Integration with Lambda functions

### Lambda Functions
AWS serverless compute service:
- **API Lambda**: Node.js/TypeScript API handler
- **Worker Lambda**: Python container for AI processing

**Benefits:**
- Auto-scaling
- Pay-per-use pricing
- No infrastructure management

## Common Abbreviations

| Abbreviation | Full Name | Description |
|--------------|-----------|-------------|
| **API** | Application Programming Interface | RESTful API endpoints |
| **CDN** | Content Delivery Network | CloudFront for fast content delivery |
| **IAM** | Identity and Access Management | AWS access control |
| **S3** | Simple Storage Service | AWS object storage |
| **DynamoDB** | Dynamo Database | AWS NoSQL database |
| **Step Functions** | AWS Step Functions | Workflow orchestration |
| **Lambda** | AWS Lambda | Serverless compute functions |
| **CloudFront** | AWS CloudFront | CDN service |
| **SMS** | Short Message Service | Text messaging |
| **HTML** | HyperText Markup Language | Web page markup |
| **JSON** | JavaScript Object Notation | Data format |
| **URL** | Uniform Resource Locator | Web address |
| **TTL** | Time To Live | Expiration time |
| **JWT** | JSON Web Token | Authentication token |
| **ECR** | Elastic Container Registry | Docker image registry |
| **GSI** | Global Secondary Index | DynamoDB query index |
| **CDK** | Cloud Development Kit | Infrastructure as code |
| **CI/CD** | Continuous Integration/Deployment | Automated pipelines |
| **WAF** | Web Application Firewall | Security protection |
| **Cognito** | Amazon Cognito | Authentication service |

## 🔍 Finding Terms

### Search Tips
- Use **Ctrl+F** (Cmd+F on Mac) to search this page
- Terms are organized by category
- Related terms are cross-referenced

### Common Searches
- **"How do workflows work?"** → See [Workflow Concepts](#workflow-concepts)
- **"What is an artifact?"** → See [Artifact](#artifact)
- **"How are steps executed?"** → See [Execution Concepts](#execution-concepts)
- **"What models are available?"** → See [AI Model](#ai-model)

## 📚 Related Documentation

- **[🏗️ Architecture Overview](../architecture/ARCHITECTURE.md)** - System architecture and design
- **[📋 Workflow Formats](./WORKFLOW_FORMATS.md)** - Workflow format specifications
- **[🛤️ Execution Paths](../architecture/EXECUTION_PATHS.md)** - Execution flow details
- **[📝 API Examples](../guides/API_EXAMPLES.md)** - API usage examples
- **[✨ Best Practices](../guides/BEST_PRACTICES.md)** - Recommended practices

---

**💡 Tip**: Bookmark this page for quick reference to platform terminology!

