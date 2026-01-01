# 👋 Onboarding Guide

> **Last Updated**: 2026-01-01  
> **Status**: Current  
> **Target Audience**: New Team Members

Welcome to the team! This guide will help you get set up and productive on the Lead Magnet AI Platform.

## 🎯 Day 1 Checklist

### 1. 🛠️ Environment Setup
- [ ] **Install Node.js 20+**: [Download](https://nodejs.org/)
- [ ] **Install Python 3.11+**: [Download](https://www.python.org/)
- [ ] **Install Docker**: [Download](https://www.docker.com/) (Required for Shell Executor)
- [ ] **Install AWS CLI**: [Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [ ] **Configure AWS Credentials**: Run `aws configure`

### 2. 🚀 Repository Setup
- [ ] **Clone the repo**: `git clone <repo-url>`
- [ ] **Install dependencies**: `npm run install:all`
- [ ] **Verify setup**: `npm run test:all` (if available) or `npm run build:all`

### 3. 🏃‍♂️ Run Locally
- [ ] Follow the [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [ ] Start the backend: `npm run dev:api`
- [ ] Start the frontend: `npm run dev:frontend`
- [ ] Visit `http://localhost:3000`

## 📚 Essential Reading

1. **[Architecture Overview](../architecture/ARCHITECTURE.md)**: Understand the system design.
2. **[Project Structure](../reference/REPO_MAP.md)**: Learn where code lives.
3. **[Cookbook](./COOKBOOK.md)**: Common tasks and recipes.

## 🤝 Key Contacts

- **Tech Lead**: [Name]
- **Product Manager**: [Name]

## 📝 Access Requests

You will need access to:
- **AWS Console** (Dev account)
- **OpenAI API Keys** (Check 1Password/LastPass)
- **GitHub Repository**

---
**Next Step**: Try adding a small feature! See [Contributing](./CONTRIBUTING.md).
