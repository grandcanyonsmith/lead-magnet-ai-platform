# 🚀 Lead Magnet AI Platform

[![Deployed](https://img.shields.io/badge/status-deployed-success)](https://czp5b77azd.execute-api.us-east-1.amazonaws.com)
[![Tests](https://img.shields.io/badge/tests-passing-success)](./scripts/testing/test-e2e.sh)
[![AWS](https://img.shields.io/badge/AWS-deployed-orange)](https://aws.amazon.com)

A production-ready SaaS platform that helps business owners create and manage AI-powered lead magnets at scale. **Automated, personalized lead magnets without manual work - increases conversion significantly.**

## 🎯 What Are Lead Magnets?

**Lead magnets** are free, valuable resources that businesses offer in exchange for contact information (name, email, phone). Examples include:
- Checklists (e.g., "Hospital Checklist for Pregnant Women")
- Reports (e.g., "Market Research Report")
- Audits (e.g., "Website SEO Audit")
- Validators (e.g., "Course Idea Market Validator")

**AI Lead Magnets** take this concept to the next level by using artificial intelligence to personalize the deliverable based on the form submission. Instead of sending a generic PDF, you send a personalized report generated specifically for that lead. This approach is **10x more effective** at converting leads because it solves their specific problems.

## 🎯 What This Platform Does

This platform enables business owners to create and manage AI-powered lead magnets without technical expertise:

### The Complete Workflow

1. **Create Lead Magnets** - Define what information to collect and how AI should personalize the deliverable
   - Configure AI instructions and models
   - Design custom HTML templates
   - Set up delivery methods (webhook or SMS)

2. **Build Forms** - Generate public forms with custom fields to collect lead information
   - Name, email, and phone are always collected automatically
   - Add custom fields (text, textarea, select, etc.)
   - Get a unique public URL for each form

3. **Collect Leads** - Share form URLs with your audience
   - Forms are mobile-responsive and SEO-friendly
   - Built-in rate limiting and spam protection
   - Real-time submission tracking

4. **AI Generates Personalized Content** - When a lead submits the form, AI creates personalized content:
   - **Optional Research Step**: AI can research and generate a report based on form answers (this research then becomes context for the final deliverable)
   - **HTML Deliverable**: AI rewrites your HTML template using the user context (form inputs + research outputs if enabled), template, and instructions to create the final personalized lead magnet
   - **Multi-Step Workflows**: Chain multiple AI steps with dependencies and parallel execution

5. **Deliver Results** - The lead magnet HTML file is delivered via webhook or SMS to your leads
   - **Webhook Delivery**: Send to any endpoint with dynamic values (e.g., `{{submission.email}}`, `{{artifact_url}}`)
   - **SMS Delivery**: Send directly to lead's phone via Twilio (manual or AI-generated SMS content)
   - All deliverables stored in S3 with public CloudFront URLs

6. **View Submissions** - Businesses can see all form submission details (name, email, phone, and custom answers) for follow-up marketing/sales
   - Real-time dashboard with analytics
   - Export submission data
   - Track job status and costs

**Business Model:** Pay-per-usage at the end of each billing cycle. No upfront payment, no subscription - you only pay for what you use.

## ✨ Features

### Core Capabilities

- 🤖 **AI-Powered Generation** - OpenAI GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo integration for personalized content
- 📝 **Flexible Workflow Options** - Multi-step workflows with dependencies, parallel execution, and optional research steps
- 🎨 **Custom Templates** - Create your own HTML templates for branding with `{{PLACEHOLDER}}` syntax
- 🏢 **Multi-Tenant** - Complete tenant isolation with secure data separation
- 📝 **Dynamic Forms** - Schema-driven forms with validation, custom fields, and public URLs
- 🔄 **Template Versioning** - Version control for HTML templates with rollback support
- 📊 **Analytics Dashboard** - Track usage, performance, costs, and submission analytics
- 🔒 **Secure** - JWT auth (Cognito), encrypted storage, HTTPS/TLS everywhere, IAM least privilege
- ⚡ **Serverless** - Auto-scaling Lambda functions, pay-per-use, no infrastructure management
- 📱 **Flexible Delivery** - Webhook delivery to any endpoint or SMS delivery via Twilio
- 🤖 **AI SMS Generation** - Optionally have AI generate SMS content based on lead magnet context
- 🖼️ **Image Generation** - DALL-E integration for generating images in workflows
- 🔍 **Web Search** - Built-in web search tool for research workflows
- 💻 **Code Interpreter** - Execute Python code in workflows for data processing
- 🔄 **CI/CD Ready** - GitHub Actions workflows included for automated deployments

### Advanced Features

- **Multi-Step Workflows**: Chain multiple AI steps with dependencies and parallel execution
- **Tool Support**: Web search, file search, code interpreter, image generation, computer use preview
- **Cost Tracking**: Real-time cost tracking per job and workflow
- **Execution History**: Complete execution step history stored in S3
- **Artifact Management**: S3 + CloudFront CDN for fast artifact delivery
- **Rate Limiting**: Built-in rate limiting and spam protection
- **Webhook Logs**: Complete webhook delivery logs for debugging
- **Impersonation**: Support/admin impersonation for customer support
- **Agency View**: Multi-customer management for agencies

## 🧭 Architecture at a Glance

| Pillar | What to read first | Context Pack |
| --- | --- | --- |
| Backend API | `backend/api` TypeScript Lambda powering `/admin/*` and `/v1/forms/*`. | [`docs/reference/context-packs/backend/CONTEXT.md`](docs/reference/context-packs/backend/CONTEXT.md) |
| Worker | Python workflow runner invoked by Step Functions. | [`docs/reference/context-packs/worker/CONTEXT.md`](docs/reference/context-packs/worker/CONTEXT.md) |
| Infrastructure | AWS CDK definitions for API Gateway, DynamoDB, Step Functions, buckets, alarms. | [`docs/reference/context-packs/infrastructure/CONTEXT.md`](docs/reference/context-packs/infrastructure/CONTEXT.md) |
| Workflow Automation | Cross-layer guidance for workflow CRUD + generation flows. | [`docs/reference/context-packs/workflows/CONTEXT.md`](docs/reference/context-packs/workflows/CONTEXT.md) |

For endpoint specifics, see [`docs/reference/contracts/README.md`](docs/reference/contracts/README.md); for typed HTTP mappings, see `frontend/src/lib/api/contracts.ts`. Testing playbooks now live under [`docs/testing/`](docs/testing/README.md).

## 🚀 How It Works

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Lead Submits Form                                            │
│    • Name, email, phone (always collected)                      │
│    • Custom form fields (project, industry, etc.)                │
│    • Form URL: /v1/forms/{slug}                                 │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. System Creates Job                                           │
│    • Job ID generated                                           │
│    • Submission stored in DynamoDB                              │
│    • Step Functions execution triggered                         │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. AI Research (Optional Precursor Step)                        │
│    • If research enabled: AI generates personalized research     │
│    • Uses web_search tool for real-time data                    │
│    • Research output stored and becomes context                 │
│    • Can include multiple parallel research steps               │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. AI HTML Generation (Final Deliverable)                      │
│    • AI rewrites your HTML template using:                      │
│      - User Context: Form inputs + research outputs             │
│      - HTML Template: Your custom template                     │
│      - Instructions: Special instructions configured            │
│    • Can include image generation (DALL-E)                      │
│    • Result: Beautifully styled, personalized HTML              │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Lead Magnet Stored                                           │
│    • HTML file uploaded to S3                                   │
│    • Public CloudFront URL generated                            │
│    • Artifact metadata stored in DynamoDB                       │
│    • Execution steps stored in S3                               │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Delivery (Your Choice)                                      │
│    • Option A: Webhook Delivery                                 │
│      - Send to any webhook URL                                  │
│      - Dynamic values: {{submission.email}}, {{artifact_url}}   │
│      - Custom headers and payload                               │
│    • Option B: SMS Delivery via Twilio                         │
│      - Send directly to lead's phone                            │
│      - Manual SMS or AI-generated SMS content                   │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Lead Receives Personalized Lead Magnet                      │
│    • Via webhook (your system) or SMS                          │
│    • Beautiful HTML file ready to view                         │
└────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Business Accesses Submission Data                            │
│    • View all form submissions in dashboard                     │
│    • Export data for marketing/sales                           │
│    • Track costs and analytics                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Lead Magnet Configuration

When creating a lead magnet, you can choose:

- **Research Enabled**: Generate AI research first, then use it as context for HTML generation
- **Research Disabled**: Convert form answers directly into HTML using your template
- **HTML Template**: Your custom HTML template for branding (uses {{PLACEHOLDER_NAME}} syntax)
- **Delivery Method**: Choose webhook or SMS delivery
  - **Webhook**: Configure URL, headers, and dynamic values from form/research outputs
  - **SMS**: Configure Twilio credentials and choose manual SMS or AI-generated SMS content

### Processing Modes

1. **Research + HTML** (Most Common): AI research → Personalized HTML deliverable
2. **HTML Only**: Direct HTML generation from form submission data

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Public    │      │     Admin    │      │   OpenAI    │
│    Forms    │─────▶│   Dashboard  │◀────▶│     API     │
└─────────────┘      └──────────────┘      └─────────────┘
       │                     │                      │
       │              ┌──────▼──────┐               │
       └─────────────▶│  API Gateway │               │
                      └──────┬──────┘               │
                             │                      │
                    ┌────────▼──────────┐           │
                    │  Lambda Function  │           │
                    │    (Node.js API)   │           │
                    └────────┬──────────┘           │
                             │                      │
           ┌─────────────────┼──────────────┐       │
           │                 │              │       │
    ┌──────▼──────┐   ┌──────▼──────┐  ┌───▼──────▼───┐
    │  DynamoDB   │   │    Step     │  │ Lambda Worker │
    │  (9 tables) │   │  Functions  │  │   (Python)    │
    └─────────────┘   └──────┬──────┘  └──────┬───────┘
                             │                 │
                      ┌──────▼─────────────────▼──┐
                      │  S3 + CloudFront (CDN)    │
                      └──────┬────────────────────┘
                              │
                      ┌───────▼────────┐
                      │  Webhook/SMS   │
                      │   Delivery     │
                      └────────────────┘
```

## 📦 Technology Stack

**Frontend:**
- Next.js 14 + React 18
- TypeScript
- Tailwind CSS
- Cognito Auth

**Backend:**
- Node.js 20 (Lambda API)
- Python 3.11 (Lambda Worker)
- AWS SDK v3

**Infrastructure:**
- AWS CDK (TypeScript) - Infrastructure as Code
- DynamoDB (9 tables) - Multi-tenant data storage
- API Gateway (HTTP API) - RESTful API endpoints
- Step Functions - Workflow orchestration for job processing
- Lambda Functions - Serverless compute (Node.js API + Python Worker)
- S3 + CloudFront - Artifact storage & CDN distribution
- Cognito - User authentication and authorization

**AI:**
- OpenAI API (GPT-4o, GPT-4 Turbo)

**Integrations:**
- Generic Webhook Delivery - Send to any webhook URL with dynamic values
- Twilio SMS Integration - Direct SMS delivery to leads

## 📊 Project Structure

```
lead-magnent-ai/
├── infrastructure/      # AWS CDK (6 stacks)
│   ├── bin/            # CDK app entry point
│   └── lib/            # Stack definitions (TypeScript)
├── backend/
│   ├── api/            # Node.js Lambda API
│   │   ├── src/        # TypeScript source files
│   │   └── build.js    # Build configuration
│   └── worker/         # Python Lambda worker
│       ├── *.py        # Python source files
│       ├── Dockerfile  # Container definition
│       └── requirements.txt
├── frontend/           # Next.js admin dashboard
│   └── src/            # React/Next.js source files
├── .github/workflows/  # CI/CD pipelines
├── scripts/            # Helper scripts
│   ├── deployment/     # Deployment scripts
│   ├── testing/        # Test scripts
│   └── *.py            # Utility scripts
└── docs/              # Documentation files
```

## 🌐 Live Platform

**Status:** ✅ DEPLOYED & TESTED

| Resource | URL |
|----------|-----|
| API | https://czp5b77azd.execute-api.us-east-1.amazonaws.com |
| Test Form | https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form |
| Dashboard | http://localhost:3000 (local dev) |

## 🧪 Testing

**Run E2E tests:**
```bash
./scripts/testing/test-e2e.sh
```

**Test results:** ✅ ALL TESTS PASSING (100%)

**Available Scripts:**
- `scripts/deployment/deploy.sh` - Deploy entire platform (infrastructure + backend + frontend)
- `scripts/deployment/destroy.sh` - Remove all AWS resources
- `scripts/testing/test-e2e.sh` - Run end-to-end tests
- `scripts/deployment/build-lambda-worker.sh` - Build and push worker Docker image
- `scripts/admin/confirm-users.sh` - Confirm Cognito users
- `scripts/setup-github-secrets.sh` - Configure GitHub Actions secrets
- `scripts/utils/find-lead-magnet-jobs.py` - Find and list lead magnet jobs
- `scripts/workflows/fix-workflow-tools.py` - Fix workflow tool configuration issues
- `scripts/jobs/get-job-output.py` - Retrieve job output from DynamoDB
- `scripts/workflows/import-workflow-from-job.py` - Import workflow from job output

## 💰 Business Model

**Pricing:** Pay-per-usage at the end of each billing cycle
- **No upfront payment** - Start using the platform immediately
- **No subscription** - Only pay for what you use
- Businesses pay for each AI-generated lead magnet after it's generated
- End customers receive the lead magnet for free
- Usage-based pricing model

**Billing:**
- Charges accumulate throughout the billing cycle
- Payment is processed at the end of each billing cycle based on actual usage
- AWS infrastructure costs (serverless, pay-per-use)
- OpenAI API costs (varies by model and usage)

## 📖 Documentation

### 🚀 Getting Started

- **[📚 Documentation Index](./docs/README.md)** - Complete documentation navigation and index
- **[⚡ Quick Start Guide](./docs/guides/QUICK_START.md)** - Get up and running in minutes
- **[🚀 Deployment Guide](./docs/guides/DEPLOYMENT.md)** - Complete deployment guide with step-by-step instructions
- **[🏗️ Architecture Overview](./docs/architecture/ARCHITECTURE.md)** - System architecture, technology stack, and development guide

### 📋 Reference Documentation

- **[📊 Resources](./docs/reference/RESOURCES.md)** - AWS resource inventory and management commands
- **[🔄 Flow Diagram](./docs/architecture/FLOW_DIAGRAM.md)** - Complete process flow diagram
- **[📝 API Contracts](./docs/reference/contracts/README.md)** - API endpoint definitions and contracts
- **[📖 Glossary](./docs/reference/GLOSSARY.md)** - Key terms and concepts
- **[🔐 Authentication](./docs/architecture/AUTHENTICATION.md)** - Authentication and authorization details

### 🛠️ Development Guides

- **[💻 Local Development](./docs/guides/LOCAL_DEVELOPMENT.md)** - Local development setup and workflow
- **[📝 API Examples](./docs/guides/API_EXAMPLES.md)** - Practical API usage examples and code snippets
- **[✨ Best Practices](./docs/guides/BEST_PRACTICES.md)** - Recommended practices for workflows, templates, and development
- **[🧪 Frontend Test Guide](./docs/testing/FRONTEND_TEST_GUIDE.md)** - Frontend testing guide
- **[🔧 GitHub Secrets Setup](./docs/guides/GITHUB_SECRETS_SETUP.md)** - GitHub Actions secrets configuration
- **[⚙️ Lambda Build Options](./docs/guides/LAMBDA_BUILD_OPTIONS.md)** - Lambda build and deployment options
- **[🔗 Webhooks Guide](./docs/guides/WEBHOOKS.md)** - Using webhook delivery feature

### 🐛 Troubleshooting

- **[🔍 Troubleshooting Guide](./docs/troubleshooting/README.md)** - Common issues and solutions
- **[📋 Changelog](./docs/CHANGELOG.md)** - Version history and changes

### 📚 Additional Resources

- **[🧪 Testing Documentation](./docs/testing/README.md)** - Complete testing guide
- **[📝 Contributing Guide](./docs/guides/CONTRIBUTING.md)** - Guidelines for contributing
- **[🗺️ Repository Map](./docs/reference/REPO_MAP.md)** - Codebase structure overview

**💡 Tip:** Start with the [Quick Start Guide](./docs/guides/QUICK_START.md) if you're new, or jump to the [Architecture Overview](./docs/architecture/ARCHITECTURE.md) for deep technical details.

## 🔐 Security

- Multi-tenant isolation
- JWT authentication (Cognito)
- Encrypted at rest (DynamoDB, S3)
- HTTPS/TLS everywhere
- IAM least privilege
- Secrets in AWS Secrets Manager

## 💰 Cost

Estimated monthly cost: **$50-150**
- AWS Services: $20-50 (serverless, pay-per-use)
- OpenAI API: $10-100 (varies by usage)
- Cost scales with lead magnet generation volume

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository** - Create your own fork
2. **Create a feature branch** - `git checkout -b feature/amazing-feature`
3. **Make your changes** - Follow our [coding standards](./docs/reference/CODING_STANDARDS.md)
4. **Add tests** - Ensure all tests pass
5. **Update documentation** - Keep docs up to date
6. **Submit a pull request** - We'll review and merge

**Important:** Please read our [Contributing Guide](./docs/guides/CONTRIBUTING.md) for detailed guidelines, especially the critical rule about **NEVER using strict timeouts for AI operations**.

## 📝 License

MIT License

## 🆘 Support

- **Documentation:** See [Documentation Index](./docs/README.md) for complete documentation
- **Issues:** Open an issue on GitHub
- **Logs:** Check CloudWatch logs
- **Local Development:** See [LOCAL_DEVELOPMENT.md](./docs/guides/LOCAL_DEVELOPMENT.md)
- **Deployment Help:** See [Deployment Guide](./docs/guides/DEPLOYMENT.md)

## 🎉 Status

✅ **Production Ready**
- All infrastructure deployed
- Backend API tested
- Worker service ready
- Frontend operational
- Tests passing (100%)
- Webhook and SMS delivery options ready

---

**Built with ❤️ using AWS, OpenAI, Next.js, and TypeScript**

*For complete documentation, see the [Documentation Index](./docs/README.md)*
