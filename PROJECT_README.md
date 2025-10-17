# Lead Magnet AI Platform

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
- OpenAI API (GPT-4o, GPT-4 Turbo)
- Streaming support
- Cost tracking

### Infrastructure
- AWS CDK for Infrastructure as Code
- GitHub Actions for CI/CD
- Multi-environment support (dev, staging, prod)

## 🚀 Quick Start

### Prerequisites
- AWS Account with admin access
- Node.js 20+
- Docker Desktop
- Python 3.11+
- OpenAI API key

### One-Command Deployment

```bash
# Clone repository
git clone <your-repo-url>
cd lead-magnent-ai

# Run deployment script
./scripts/deploy.sh
```

This will:
1. Deploy all AWS infrastructure
2. Build and push Docker images
3. Deploy Lambda functions
4. Deploy frontend to CloudFront
5. Provide access URLs

**Alternative:** Follow the detailed step-by-step guide in [DEPLOYMENT.md](./DEPLOYMENT.md)

### Initial Setup

After deployment, create your first user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <your-user-pool-id> \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=name,Value="Admin User" \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

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
│       ├── processor.py     # Job processor
│       ├── ai_service.py    # OpenAI integration
│       ├── db_service.py    # DynamoDB operations
│       ├── s3_service.py    # S3 operations
│       ├── template_service.py  # Template rendering
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
├── DEPLOYMENT.md            # Detailed deployment guide
├── package.json             # Root package (monorepo)
├── .env.example             # Environment template
└── readme.md                # Original requirements
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

## 📊 Database Schema

### DynamoDB Tables

1. **workflows** - Workflow configurations
2. **forms** - Public forms for lead collection
3. **form_submissions** - Form submission records
4. **jobs** - Job processing status
5. **artifacts** - Generated files (reports, HTML)
6. **templates** - HTML templates with versioning
7. **user_settings** - User preferences and config

See [readme.md](./readme.md) for detailed schema documentation.

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

## 📞 Contact

For questions or support, please open an issue in the GitHub repository.

---

**Built with ❤️ using AWS, OpenAI, and modern web technologies**

