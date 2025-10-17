# 🚀 Lead Magnet AI Platform

[![Deployed](https://img.shields.io/badge/status-deployed-success)](https://czp5b77azd.execute-api.us-east-1.amazonaws.com)
[![Tests](https://img.shields.io/badge/tests-passing-success)](./scripts/test-e2e.sh)
[![AWS](https://img.shields.io/badge/AWS-deployed-orange)](https://aws.amazon.com)

A production-ready, multi-tenant SaaS platform for automated AI-powered lead magnet generation using OpenAI, AWS, and modern web technologies.

## 🎯 What This Platform Does

Transform form submissions into personalized AI-generated reports and polished HTML deliverables automatically:

1. **Create Workflows** - Define AI instructions and templates
2. **Build Forms** - Generate public forms with custom fields
3. **Collect Leads** - Share form URLs with your audience
4. **Generate Reports** - AI creates personalized content
5. **Deliver Results** - Beautiful HTML delivered via URL or webhook

## ✨ Features

- 🤖 **AI-Powered Generation** - OpenAI GPT-4o integration
- 🏢 **Multi-Tenant** - Complete tenant isolation
- 📝 **Dynamic Forms** - Schema-driven with validation
- 🎨 **Template Engine** - HTML templates with versioning
- 📊 **Analytics Dashboard** - Track usage and performance
- 🔒 **Secure** - JWT auth, encrypted storage, HTTPS
- ⚡ **Serverless** - Auto-scaling, pay-per-use
- 🔄 **CI/CD Ready** - GitHub Actions workflows included

## 🚀 Quick Start

### Local Development

```bash
# Frontend (already running on http://localhost:3002)
cd frontend
npm install
npm run dev

# Login with:
# Email: test@example.com
# Password: TestPass123!
```

### Test the Live API

```bash
# Get form
curl https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form

# Submit form
curl -X POST "https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{"submission_data":{"name":"Test","email":"test@test.com","project":"Testing"}}'

# Run E2E tests
./scripts/test-e2e.sh
```

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
                    └────────┬──────────┘           │
                             │                      │
           ┌─────────────────┼──────────────┐       │
           │                 │              │       │
    ┌──────▼──────┐   ┌──────▼──────┐  ┌───▼──────▼───┐
    │  DynamoDB   │   │    Step     │  │ ECS Worker   │
    │  (7 tables) │   │  Functions  │  │  (Python)    │
    └─────────────┘   └──────┬──────┘  └──────┬───────┘
                             │                 │
                      ┌──────▼─────────────────▼──┐
                      │  S3 + CloudFront (CDN)    │
                      └───────────────────────────┘
```

## 📦 Technology Stack

**Frontend:**
- Next.js 14 + React 18
- TypeScript
- Tailwind CSS
- Cognito Auth

**Backend:**
- Node.js 20 (Lambda)
- Python 3.11 (Worker)
- AWS SDK v3

**Infrastructure:**
- AWS CDK (TypeScript)
- DynamoDB (7 tables)
- API Gateway (HTTP API)
- Step Functions
- ECS Fargate
- S3 + CloudFront

**AI:**
- OpenAI API (GPT-4o, GPT-4 Turbo)

## 📊 Project Structure

```
lead-magnent-ai/
├── infrastructure/      # AWS CDK (6 stacks)
├── backend/
│   ├── api/            # Node.js Lambda API
│   └── worker/         # Python ECS worker
├── frontend/           # Next.js admin dashboard
├── .github/workflows/  # CI/CD pipelines
├── scripts/            # Helper scripts
└── docs/              # 8 documentation files
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

## 📖 Documentation

- **[START_HERE.md](./START_HERE.md)** - Quick start guide
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - URLs & commands
- **[DEPLOYMENT_REPORT.md](./DEPLOYMENT_REPORT.md)** - Deployment details
- **[INDEX.md](./INDEX.md)** - Documentation index

## 🔐 Security

- Multi-tenant isolation
- JWT authentication (Cognito)
- Encrypted at rest (DynamoDB, S3)
- HTTPS/TLS everywhere
- IAM least privilege
- Secrets in AWS Secrets Manager

## 💰 Cost

Estimated monthly cost: **$50-150**
- AWS Services: $20-50
- OpenAI API: $10-100 (varies by usage)

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

---

**Built with ❤️ using AWS, OpenAI, Next.js, and TypeScript**

*For complete documentation, see [INDEX.md](./INDEX.md)*
