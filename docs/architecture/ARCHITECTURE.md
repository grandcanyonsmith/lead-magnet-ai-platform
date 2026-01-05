# Architecture Overview

> **Last Updated**: 2026-01-05  
> **Status**: Current  
> **Related Docs**: [Flow Diagram](./FLOW_DIAGRAM.md), [Deployment Guide](../guides/DEPLOYMENT.md), [Resources](../reference/RESOURCES.md), [Quick Start](../guides/QUICK_START.md)

A comprehensive multi-tenant SaaS platform for automated AI-powered lead magnet generation.

## 🎯 Overview

This platform enables businesses to create automated workflows that transform form submissions into personalized AI-generated reports and polished HTML deliverables. The system uses OpenAI for content generation, AWS services for scalable infrastructure, and provides a modern web interface for management.

## ✨ Features

### Core Capabilities
- **Multi-Tenant Workflows**: Each customer creates "workflows" that define how to process form submissions
- **Public Forms**: Workflows expose public forms via unique URLs for collecting lead information
- **AI Report Generation**: Form submissions trigger AI-powered report generation using OpenAI with custom instructions
- **HTML Template Rendering**: Reports are injected into HTML templates and further enhanced by AI rewriting
- **Automated Delivery**: Final HTML deliverables are stored in S3 with public URLs and optionally sent via webhook
- **Admin Dashboard**: Modern web UI for managing workflows, forms, templates, viewing runs and analytics
- **Shell Tool Executor**: Secure, isolated environment for AI to run shell commands (Python, curl, git, etc.)

### Use Cases
- Market Research Reports
- Learner Persona Reports
- Brand Style Guides
- Course Outlines
- Any personalized document generation workflow

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- Next.js 14 with TypeScript
- React 18
- Tailwind CSS
- Amazon Cognito for authentication

**Backend:**
- Node.js/TypeScript Lambda functions
- Python 3.11 Lambda container job processor (ECR-based)
- API Gateway HTTP API
- AWS Step Functions for orchestration
- **Shell Executor**: Dedicated Python Lambda with EFS for sandboxed command execution

**Data & Storage:**
- DynamoDB (multiple tables: core + billing/ops)
- S3 + CloudFront for artifact storage
- Secrets Manager for API keys
- EFS (Elastic File System) for persistent shell workspaces

**AI:**
- OpenAI API (GPT-5, GPT-4.1, GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)
- Streaming support
- Cost tracking
- Multi-step workflow support with context accumulation
- Image generation support (DALL-E integration)
- Tool support (web_search, file_search, computer_use_preview, shell_executor)

### Infrastructure
- AWS CDK for Infrastructure as Code
- GitHub Actions for CI/CD
- Multi-environment support (dev, staging, prod)

## 📁 Project Structure

```
lead-magnent-ai/
├── frontend/                 # Next.js admin dashboard
│   ├── src/
│   │   ├── app/             # Next.js 14 app router
│   │   │   ├── auth/        # Authentication pages
│   │   │   └── dashboard/   # Admin dashboard pages
│   │   └── lib/             # Utilities (API client, auth)
│   ├── package.json
│   └── next.config.js
│
├── backend/
│   ├── api/                 # Lambda API functions
│   │   ├── src/
│   │   │   ├── controllers/ # Route controllers
│   │   │   ├── utils/       # DB, validation, logging
│   │   │   ├── routes.ts    # API routing
│   │   │   └── index.ts     # Lambda handler
│   │   └── package.json
│   │
│   └── worker/              # Lambda container worker (Python) for AI processing
│       ├── worker.py        # Main entry point
│       ├── processor.py     # Job processor (handles multi-step workflows)
│       ├── ai_service.py    # OpenAI integration (refactored with helper methods)
│       ├── services/
│       │   └── shell/       # Shell execution services
│       │       └── executor_handler.py # Synchronous Lambda executor
│       ├── Dockerfile
│       └── requirements.txt
│
├── infrastructure/          # AWS CDK stacks
│   ├── lib/
│   │   ├── database-stack.ts    # DynamoDB tables
│   │   ├── auth-stack.ts        # Cognito User Pool
│   │   ├── storage-stack.ts     # S3 + CloudFront
│   │   ├── compute-stack.ts     # Step Functions + Lambda (job processor)
│   │   ├── api-stack.ts         # API Gateway + Lambda
│   │   ├── worker-stack.ts      # ECR repository (Lambda container images)
│   │   └── shell-executor-stack.ts # Lambda + EFS for shell execution
│   ├── bin/app.ts           # CDK app entry point
│   └── package.json
│
├── .github/
│   └── workflows/           # CI/CD pipelines
│       ├── cdk-infra.yml
│       ├── api-deploy.yml
│       ├── worker-ecr.yml
│       └── frontend-deploy.yml
│
├── scripts/
│   ├── deploy.sh            # One-command deployment
│   └── destroy.sh           # Cleanup script
│
└── docs/                    # Documentation
    ├── QUICK_START.md
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    └── RESOURCES.md
```

## 🔧 Development

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

**API Lambda:**
```bash
cd backend/api
npm install
npm run build
# Deploy to AWS for testing
```

**Worker:**
```bash
cd backend/worker
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
# Set environment variables
python worker.py
```

### Testing

```bash
# Run all tests
npm run test:all

# Lint all code
npm run lint:all
```

## 🤖 AI Service Architecture

### Overview
The `ai_service.py` module handles all OpenAI API interactions. It has been refactored to use helper methods for better maintainability and testability.

### Key Components

#### Main Methods
- `generate_report()` - Main method for generating reports (reduced from 638 to ~93 lines)
- `generate_html_from_submission()` - Generate HTML from form submission
- `generate_styled_html()` - Generate styled HTML with template
- `rewrite_html()` - Rewrite existing HTML content

#### Helper Methods (Extracted)
- `_validate_and_filter_tools()` - Single source of truth for tool validation
- `_build_input_text()` - Construct input text from context
- `_build_api_params()` - Build API parameters with safety checks
- `_extract_image_urls()` - Extract image URLs from responses
- `_process_api_response()` - Process API responses and calculate usage
- `_handle_openai_error()` - Centralized error handling with retry logic
- `_clean_html_markdown()` - Remove markdown code blocks from HTML

### Multi-Step Workflow Support
- Each step receives outputs from ALL previous steps
- Image URLs from previous steps are included in context
- Step order is normalized to handle DynamoDB type mismatches
- Context accumulation ensures continuity across workflow steps

See [AI_SERVICE_REFACTORING.md](../archive/AI_SERVICE_REFACTORING.md) for detailed refactoring documentation.

## 🐚 Shell Executor Architecture

The platform includes a dedicated "Shell Executor" service that allows AI agents to execute shell commands securely. This was migrated from a legacy ECS Fargate implementation to a synchronous Lambda-based architecture for lower latency and complexity.

### Key Components

1.  **Lambda Executor (`leadmagnet-shell-executor`)**:
    *   A Python 3.11 Lambda function running in a private VPC subnet.
    *   **Timeout**: 15 minutes (max allowed by Lambda). Note: synchronous invocations cannot exceed this limit.
    *   **Persistence**: Mounts an Elastic File System (EFS) volume to `/mnt/shell-executor`.
    *   **Isolation**: Runs in a sandboxed environment with no public ingress. Outbound internet access is provided via NAT Gateway (for `pip install`, `git clone`, etc.).

2.  **Workspace Persistence**:
    *   Each session gets a unique directory: `/mnt/shell-executor/sessions/{workspace_id}`.
    *   Files persist between command executions, allowing multi-step workflows (e.g., clone repo -> edit file -> run tests).

3.  **Execution Flow**:
    *   The Job Processor (or API) invokes the Shell Executor Lambda synchronously with a JSON payload containing commands.
    *   The Lambda executes the commands using `subprocess.run`.
    *   Results (stdout, stderr, exit code) are returned directly in the JSON response.

### Constraints & Limits
*   **Execution Time**: Max 15 minutes per batch of commands. Long-running processes should be broken down or run asynchronously (though the current implementation is synchronous).
*   **Memory**: Configured to 1024MB (adjustable).
*   **Output Size**: Default limit of ~100KB per command output to prevent payload bloat.

## 📊 Database Schema

### DynamoDB Tables

1. **workflows** - Workflow configurations
2. **forms** - Public forms for lead collection
3. **form_submissions** - Form submission records
4. **jobs** - Job processing status
5. **artifacts** - Generated files (reports, HTML)
6. **templates** - HTML templates with versioning
7. **user_settings** - User preferences and config

See [FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md) for detailed process flow.

## 🔒 Security

### Authentication and Authorization

**Authentication:**
- AWS Cognito User Pool for user authentication
- JWT tokens (ID token, access token, refresh token)
- API Gateway JWT authorizer validates tokens
- Token-based session management

**Authorization:**
- Role-based access control (USER, SUPER_ADMIN)
- Email-based SUPER_ADMIN elevation via allowlist
- Multi-tenant data isolation via customer IDs
- All database queries scoped by customer_id

**Agency View:**
- SUPER_ADMIN users can manage multiple customers
- View switching via HTTP headers (`x-view-mode`, `x-selected-customer-id`)
- Effective customer ID determines data access scope

**Impersonation:**
- Session-based impersonation for support/admin use cases
- Secure session management with expiration
- Only SUPER_ADMIN can create impersonation sessions

See [Authentication Documentation](./AUTHENTICATION.md) for complete details.

### Security Measures

- Multi-tenant isolation at data layer
- Secrets stored in AWS Secrets Manager
- Encrypted data at rest (S3, DynamoDB)
- TLS/HTTPS everywhere
- IAM least privilege access
- CloudFront + WAF for protection

## 📈 Monitoring

### CloudWatch Dashboards
- Lambda metrics (invocations, duration, errors)
- DynamoDB metrics (read/write capacity)
- WAF metrics (blocked requests, rate limiting)
- Step Functions execution metrics
- Shell Executor metrics (Lambda duration, errors)

### Logs
```bash
# API logs
aws logs tail /aws/lambda/leadmagnet-api-handler --follow

# Worker logs
aws logs tail /aws/lambda/leadmagnet-job-processor --follow

# Shell Executor logs
aws logs tail /aws/lambda/leadmagnet-shell-executor --follow

# Step Functions logs
aws logs tail /aws/stepfunctions/leadmagnet-job-processor --follow
```

## 💰 Cost Estimation

**Monthly Costs (Light Usage):**
- DynamoDB: $5-10 (on-demand pricing)
- Lambda: $0-5 (within free tier)
- S3 + CloudFront: $5-10
- Job processor Lambda (container): varies with usage
- WAFv2: $1-10
- Step Functions: $1-5
- OpenAI API: $10-100 (varies by usage)
- **EFS**: ~$0.30/GB-month (minimal cost for small workspaces)
- **NAT Gateway**: ~$30/month (per AZ) - *Cost optimization tip: Use VPC Endpoints for S3/DynamoDB to reduce NAT traffic.*

**Total:** ~$80-230/month depending on volume and NAT usage

## 🎓 Usage Guide

### Creating a Workflow

1. Log in to admin dashboard
2. Navigate to Workflows → Create Workflow
3. Fill in:
   - Workflow name
   - AI model (GPT-4o recommended)
   - AI instructions (system prompt)
   - Template selection
4. Save workflow

### Creating a Form

1. Navigate to Forms → Create Form
2. Select workflow
3. Define form fields (text, textarea, email, etc.)
4. Set public slug (URL path)
5. Configure rate limiting
6. Save form

### Testing the Flow

1. Get form public URL: `https://your-domain.com/v1/forms/{slug}`
2. Fill out and submit form
3. Monitor job in Jobs page
4. View generated report when complete

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 🆘 Support

- **Documentation**: See [DEPLOYMENT.md](../guides/DEPLOYMENT.md) for deployment help
- **Issues**: Open an issue on GitHub
- **Logs**: Check CloudWatch logs for troubleshooting

## 🗺️ Roadmap

- [ ] Custom domain support
- [ ] Multiple AI providers (Anthropic, Cohere)
- [ ] Advanced analytics dashboard
- [ ] Email delivery integration
- [ ] Rate limiting with API keys
- [ ] Webhook retry logic
- [ ] Template marketplace
- [ ] Multi-language support

---

## Related Documentation

- [Flow Diagram](./FLOW_DIAGRAM.md) - Visual process flow diagrams
- [Deployment Guide](../guides/DEPLOYMENT.md) - Complete deployment instructions
- [Quick Start Guide](../guides/QUICK_START.md) - Getting started quickly
- [Resources](../reference/RESOURCES.md) - AWS resource inventory
- [Troubleshooting Guide](../troubleshooting/README.md) - Common issues and solutions
- [AI Service Refactoring](../archive/AI_SERVICE_REFACTORING.md) - AI service architecture details
- [Changelog](../CHANGELOG.md) - Version history and changes

---

**Built with ❤️ using AWS, OpenAI, and modern web technologies**
