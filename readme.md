# 🚀 Lead Magnet AI Platform

[![Deployed](https://img.shields.io/badge/status-deployed-success)](https://czp5b77azd.execute-api.us-east-1.amazonaws.com)
[![Tests](https://img.shields.io/badge/tests-passing-success)](./scripts/test-e2e.sh)
[![AWS](https://img.shields.io/badge/AWS-deployed-orange)](https://aws.amazon.com)

A production-ready SaaS platform that helps business owners quickly create and manage AI-powered lead magnets at scale.

## 🎯 What Are Lead Magnets?

**Lead magnets** are free, valuable resources that businesses offer in exchange for contact information (name, email, phone). Examples include:
- Checklists (e.g., "Hospital Checklist for Pregnant Women")
- Reports (e.g., "Market Research Report")
- Audits (e.g., "Website SEO Audit")
- Validators (e.g., "Course Idea Market Validator")

**AI Lead Magnets** take this concept to the next level by using artificial intelligence to personalize the deliverable based on the form submission. Instead of sending a generic PDF, you send a personalized report generated specifically for that lead. This approach is **10x more effective** at converting leads because it solves their specific problems.

## 🎯 What This Platform Does

This platform enables business owners to create and manage AI-powered lead magnets without technical expertise:

1. **Create Workflows** - Define AI instructions, templates, and delivery settings
2. **Build Forms** - Generate public forms with custom fields to collect lead information
3. **Collect Leads** - Share form URLs with your audience
4. **AI Generates Content** - When a lead submits the form, AI creates personalized content:
   - Optional research step: AI can research and generate a report based on submission data
   - Optional HTML styling: AI can convert content to beautifully styled HTML matching your template
5. **Deliver Results** - Lead magnet is sent via webhook to your GHL (GoHighLevel) system, which then sends it via SMS and Email to the lead

**Business Model:** Pay-per-lead-magnet generated. Businesses pay, end customers get it for free.

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
- 🔗 **GHL Integration** - Webhook delivery to GoHighLevel for SMS/Email
- 🔄 **CI/CD Ready** - GitHub Actions workflows included

## 🚀 How It Works

### Complete Flow

```
1. Lead submits form with their information
   ↓
2. System creates job and triggers workflow
   ↓
3. AI Research (Optional)
   - If research_enabled: AI generates personalized research report
   - Stores as report.md for fact-checking/reference
   ↓
4. AI Content Generation
   - If html_enabled: AI generates styled HTML matching your template
   - If html_enabled=false: Stores markdown/text content
   ↓
5. Artifact stored in S3 with public URL
   ↓
6. Webhook sent to GHL (GoHighLevel) with artifact URL
   ↓
7. GHL sends SMS and Email to lead with download link
   ↓
8. Business uses collected contact info for marketing/sales
```

### Workflow Configuration

Each workflow can be configured with:
- **Research Enabled** (`research_enabled`): Generate AI research report first
- **HTML Enabled** (`html_enabled`): Convert content to styled HTML
- **AI Model**: Choose GPT-4o or other models for research generation
- **Rewrite Model**: Choose model for HTML styling
- **Template**: Your custom HTML template for branding
- **Webhook URL**: GHL webhook endpoint for delivery

### Four Processing Modes

1. **Research + HTML**: AI research → Styled HTML (most common)
2. **Research Only**: AI research → Markdown file
3. **HTML Only**: Direct HTML generation from submission data
4. **Text Only**: Simple text output from submission data

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
    │  (7 tables) │   │  Functions  │  │   (Python)    │
    └─────────────┘   └──────┬──────┘  └──────┬───────┘
                             │                 │
                      ┌──────▼─────────────────▼──┐
                      │  S3 + CloudFront (CDN)    │
                      └──────┬────────────────────┘
                              │
                      ┌───────▼────────┐
                      │  GHL Webhook   │
                      │  (SMS/Email)   │
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
- AWS CDK (TypeScript)
- DynamoDB (7 tables)
- API Gateway (HTTP API)
- Step Functions (Workflow orchestration)
- Lambda Functions (Serverless compute)
- S3 + CloudFront (Artifact storage & CDN)

**AI:**
- OpenAI API (GPT-4o, GPT-4 Turbo)

**Integrations:**
- GoHighLevel (GHL) - SMS/Email delivery via webhooks

## 📊 Project Structure

```
lead-magnent-ai/
├── infrastructure/      # AWS CDK (6 stacks)
├── backend/
│   ├── api/            # Node.js Lambda API
│   └── worker/         # Python Lambda worker
├── frontend/           # Next.js admin dashboard
├── .github/workflows/  # CI/CD pipelines
├── scripts/            # Helper scripts
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

## 💰 Business Model

**Pricing:** Pay-per-lead-magnet generated
- Businesses pay for each AI-generated lead magnet
- End customers receive the lead magnet for free
- Usage-based pricing model

**Cost Structure:**
- Platform subscription fee (if applicable)
- Per-lead-magnet generation fee
- AWS infrastructure costs (serverless, pay-per-use)
- OpenAI API costs (varies by model and usage)

## 📖 Documentation

- **[START_HERE.md](./START_HERE.md)** - Quick start guide
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - URLs & commands
- **[DEPLOYMENT_REPORT.md](./DEPLOYMENT_REPORT.md)** - Deployment details
- **[INDEX.md](./INDEX.md)** - Documentation index
- **[FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)** - Complete process flow

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

- **Documentation:** See `/docs` folder
- **Issues:** Open an issue on GitHub
- **Logs:** Check CloudWatch logs

## 🎉 Status

✅ **Production Ready**
- All infrastructure deployed
- Backend API tested
- Worker service ready
- Frontend operational
- Tests passing (100%)
- GHL webhook integration ready

---

**Built with ❤️ using AWS, OpenAI, Next.js, and TypeScript**

*For complete documentation, see [INDEX.md](./INDEX.md)*
