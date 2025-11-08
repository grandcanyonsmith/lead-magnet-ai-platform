# Architecture Overview

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
- Python 3.11 ECS worker service
- API Gateway HTTP API
- AWS Step Functions for orchestration

**Data & Storage:**
- DynamoDB (7 tables)
- S3 + CloudFront for artifact storage
- Secrets Manager for API keys

**AI:**
- OpenAI API (GPT-5, GPT-4.1, GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, O3 Deep Research)
- Streaming support
- Cost tracking
- Multi-step workflow support with context accumulation
- Image generation support (DALL-E integration)
- Tool support (web_search_preview, file_search, computer_use_preview)

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
│   └── worker/              # ECS worker for AI processing
│       ├── worker.py        # Main entry point
│       ├── processor.py     # Job processor (handles multi-step workflows)
│       ├── ai_service.py    # OpenAI integration (refactored with helper methods)
│       ├── db_service.py    # DynamoDB operations
│       ├── s3_service.py    # S3 upload/download
│       ├── template_service.py  # Template rendering
│       ├── artifact_service.py  # Artifact storage service
│       ├── delivery_service.py   # Webhook/SMS delivery service
│       ├── legacy_processor.py  # Legacy workflow processor
│       ├── Dockerfile
│       └── requirements.txt
│
├── infrastructure/          # AWS CDK stacks
│   ├── lib/
│   │   ├── database-stack.ts    # DynamoDB tables
│   │   ├── auth-stack.ts        # Cognito User Pool
│   │   ├── storage-stack.ts     # S3 + CloudFront
│   │   ├── compute-stack.ts     # Step Functions + ECS
│   │   ├── api-stack.ts         # API Gateway + Lambda
│   │   └── worker-stack.ts      # ECS Task Definition
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
- `_is_o3_model()` - Detect if model is O3 Deep Research
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

See [AI_SERVICE_REFACTORING.md](./AI_SERVICE_REFACTORING.md) for detailed refactoring documentation.

## 📊 Database Schema

### DynamoDB Tables

1. **workflows** - Workflow configurations
2. **forms** - Public forms for lead collection
3. **form_submissions** - Form submission records
4. **jobs** - Job processing status
5. **artifacts** - Generated files (reports, HTML)
6. **templates** - HTML templates with versioning
7. **user_settings** - User preferences and config

See [FLOW_DIAGRAM.md](../FLOW_DIAGRAM.md) for detailed process flow.

## 🔒 Security

- Multi-tenant isolation at data layer
- JWT authentication with Cognito
- Secrets stored in AWS Secrets Manager
- Encrypted data at rest (S3, DynamoDB)
- TLS/HTTPS everywhere
- IAM least privilege access
- CloudFront + WAF for protection

## 📈 Monitoring

### CloudWatch Dashboards
- Lambda metrics (invocations, duration, errors)
- DynamoDB metrics (read/write capacity)
- ECS metrics (CPU, memory)
- Step Functions execution metrics

### Logs
```bash
# API logs
aws logs tail /aws/lambda/leadmagnet-api-handler --follow

# Worker logs
aws logs tail /ecs/leadmagnet-worker --follow

# Step Functions logs
aws logs tail /aws/stepfunctions/leadmagnet-job-processor --follow
```

## 💰 Cost Estimation

**Monthly Costs (Light Usage):**
- DynamoDB: $5-10 (on-demand pricing)
- Lambda: $0-5 (within free tier)
- S3 + CloudFront: $5-10
- ECS Fargate: $10-20 (per job execution)
- Step Functions: $1-5
- OpenAI API: $10-100 (varies by usage)

**Total:** ~$50-200/month depending on volume

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

- **Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
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

**Built with ❤️ using AWS, OpenAI, and modern web technologies**

