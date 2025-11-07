# 🚀 Lead Magnet AI Platform

[![Deployed](https://img.shields.io/badge/status-deployed-success)](https://czp5b77azd.execute-api.us-east-1.amazonaws.com)
[![Tests](https://img.shields.io/badge/tests-passing-success)](./scripts/test-e2e.sh)
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

1. **Create Lead Magnets** - Define what information to collect and how AI should personalize the deliverable
2. **Build Forms** - Generate public forms with custom fields to collect lead information (name, email, and phone are always collected automatically)
3. **Collect Leads** - Share form URLs with your audience
4. **AI Generates Personalized Content** - When a lead submits the form, AI creates personalized content:
   - **Optional Research Step**: AI can research and generate a report based on form answers (this research then becomes context for the final deliverable)
   - **HTML Deliverable**: AI rewrites your HTML template using the user context (form inputs + research outputs if enabled), template, and instructions to create the final personalized lead magnet
5. **Deliver Results** - The lead magnet HTML file is delivered via webhook or SMS to your leads
6. **View Submissions** - Businesses can see all form submission details (name, email, phone, and custom answers) for follow-up marketing/sales

**Business Model:** Pay-per-usage at the end of each billing cycle. No upfront payment, no subscription - you only pay for what you use.

## ✨ Features

- 🤖 **AI-Powered Generation** - OpenAI GPT-4o integration for personalized content
- 📝 **Flexible Workflow Options** - Optional research step and HTML conversion
- 🎨 **Custom Templates** - Create your own HTML templates for branding
- 🏢 **Multi-Tenant** - Complete tenant isolation
- 📝 **Dynamic Forms** - Schema-driven forms with validation
- 🔄 **Template Versioning** - Version control for HTML templates
- 📊 **Analytics Dashboard** - Track usage and performance
- 🔒 **Secure** - JWT auth, encrypted storage, HTTPS
- ⚡ **Serverless** - Auto-scaling Lambda functions, pay-per-use
- 📱 **Flexible Delivery** - Webhook delivery to any endpoint or SMS delivery via Twilio
- 🤖 **AI SMS Generation** - Optionally have AI generate SMS content based on lead magnet context
- 🔄 **CI/CD Ready** - GitHub Actions workflows included

## 🚀 How It Works

### Complete Flow

```
1. Lead submits form with their information (name, email, phone + custom answers)
   ↓
2. System creates job and triggers lead magnet generation
   ↓
3. AI Research (Optional Precursor Step)
   - If research enabled: AI generates personalized research report based on form answers
   - Research output is stored and becomes context for the final deliverable
   ↓
4. AI HTML Generation (Final Deliverable)
   - AI rewrites your HTML template using:
     * User Context: Form inputs + research outputs (if research was performed)
     * HTML Template: Your custom template
     * Instructions: Any special instructions you've configured
   - The result is a beautifully styled, personalized HTML lead magnet
   ↓
5. Lead magnet stored in S3 with public URL
   ↓
6. Delivery (Your Choice)
   - Option A: Webhook delivery - Send to any webhook URL with dynamic values (e.g., {{submission.email}}, {{artifact_url}})
   - Option B: SMS delivery via Twilio - Send directly to lead's phone (manual or AI-generated SMS content)
   ↓
7. Lead receives personalized lead magnet
   ↓
8. Business accesses all form submission details (name, email, phone, custom answers) for marketing/sales
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
    │  (8 tables) │   │  Functions  │  │   (Python)    │
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
- DynamoDB (8 tables) - Multi-tenant data storage
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
│   ├── deploy.sh       # Main deployment script
│   ├── destroy.sh      # Cleanup script
│   ├── test-e2e.sh     # End-to-end tests
│   └── *.py            # Utility scripts
└── docs/              # Documentation files
```

## 🌐 Live Platform

**Status:** ✅ DEPLOYED & TESTED

| Resource | URL |
|----------|-----|
| API | https://czp5b77azd.execute-api.us-east-1.amazonaws.com |
| Test Form | https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form |
| Dashboard | http://localhost:3002 (local dev) |

## 🧪 Testing

**Run E2E tests:**
```bash
./scripts/test-e2e.sh
```

**Test results:** ✅ ALL TESTS PASSING (100%)

**Available Scripts:**
- `scripts/deploy.sh` - Deploy entire platform (infrastructure + backend + frontend)
- `scripts/destroy.sh` - Remove all AWS resources
- `scripts/test-e2e.sh` - Run end-to-end tests
- `scripts/build-lambda-worker.sh` - Build and push worker Docker image
- `scripts/confirm-users.sh` - Confirm Cognito users
- `scripts/setup-github-secrets.sh` - Configure GitHub Actions secrets
- `scripts/find-lead-magnet-jobs.py` - Find and list lead magnet jobs
- `scripts/fix-workflow-tools.py` - Fix workflow tool configuration issues
- `scripts/get-job-output.py` - Retrieve job output from DynamoDB
- `scripts/import-workflow-from-job.py` - Import workflow from job output

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

**Main Documentation:**
- **[docs/QUICK_START.md](./docs/QUICK_START.md)** - Quick start guide with URLs, commands, and getting started steps
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Complete deployment guide with step-by-step instructions
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Architecture overview, technology stack, and development guide
- **[docs/RESOURCES.md](./docs/RESOURCES.md)** - AWS resource inventory and management commands
- **[docs/FLOW_DIAGRAM.md](./docs/FLOW_DIAGRAM.md)** - Complete process flow diagram

**Additional Guides:**
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Root-level deployment reference
- **[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** - Local development setup
- **[FRONTEND_TEST_GUIDE.md](./FRONTEND_TEST_GUIDE.md)** - Frontend testing guide
- **[GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)** - GitHub Actions secrets configuration
- **[QUICK_GITHUB_SETUP.md](./QUICK_GITHUB_SETUP.md)** - Quick GitHub repository setup
- **[LAMBDA_BUILD_OPTIONS.md](./LAMBDA_BUILD_OPTIONS.md)** - Lambda build and deployment options

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

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License

## 🆘 Support

- **Documentation:** See `/docs` folder and root-level `.md` files
- **Issues:** Open an issue on GitHub
- **Logs:** Check CloudWatch logs
- **Local Development:** See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- **Deployment Help:** See [DEPLOYMENT.md](./DEPLOYMENT.md) or [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

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

*For complete documentation, see the [docs](./docs/) folder*
