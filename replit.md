# Lead Magnet AI Platform - Replit Migration

## Overview
Multi-tenant AI-powered lead magnet generation platform built with Next.js, AWS services (Cognito, DynamoDB, S3, Lambda, Step Functions), and OpenAI. Successfully migrated from Vercel to Replit on November 10, 2025.

## Project Architecture

### Frontend (Next.js 14)
- **Location**: `frontend/`
- **Framework**: Next.js 14.1.0 with React 18
- **Port**: 5000 (configured for Replit)
- **Key Features**:
  - AWS Cognito authentication
  - Dashboard for workflows, forms, jobs, and artifacts
  - Real-time job execution tracking
  - Workflow visualization with React Flow
  - Analytics and billing management

### Backend API (Node.js/TypeScript)
- **Location**: `backend/api/`
- **Type**: AWS Lambda functions (local dev server available)
- **Services**: Express-based API with AWS SDK integrations
- **Key Services**:
  - Workflow management
  - Form and template handling
  - Job processing coordination
  - S3 artifact management
  - DynamoDB operations

### Worker (Python)
- **Location**: `backend/worker/`
- **Type**: AWS Lambda/ECS workers
- **Purpose**: AI-powered job processing with OpenAI integration

### Infrastructure (AWS CDK)
- **Location**: `infrastructure/`
- **Type**: TypeScript-based CDK definitions
- **Manages**: Auth, API, Database, Storage, Compute stacks

## Replit Migration Changes

### Configuration Updates
1. **Frontend Scripts** (`frontend/package.json`):
   - Updated `dev` script: `next dev -p 5000 -H 0.0.0.0`
   - Updated `start` script: `next start -p 5000 -H 0.0.0.0`
   - Ensures proper binding to port 5000 for Replit environment

2. **Next.js Configuration** (`frontend/next.config.js`):
   - Removed Vercel-specific `output: 'export'` setting
   - Retained image optimization and environment variable passing
   - Enabled full Next.js dev server functionality

3. **Workflow Configuration**:
   - Configured single workflow: `dev` running Next.js on port 5000
   - Output type: webview for frontend preview

## Environment Variables

### Required Secrets (Configured in Replit)
- `NEXT_PUBLIC_API_URL`: AWS API Gateway endpoint
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`: Cognito Client ID
- `NEXT_PUBLIC_AWS_REGION`: AWS region (e.g., us-east-1)

### Additional Variables (See `.env.example`)
The application requires additional AWS credentials and configuration for backend services when running locally or in production deployment.

## Development Workflow

### Running the Application
The workflow is pre-configured and runs automatically:
```bash
npm run dev  # From root (via workflow)
```

### Manual Development
```bash
# Install dependencies
npm install

# Frontend development
cd frontend && npm run dev

# Backend API development (local)
cd backend/api && npm run dev
```

### Monorepo Structure
This is an npm workspaces monorepo with:
- Root package.json managing workspace scripts
- Individual packages: frontend, backend/api, backend/worker, infrastructure

## Key Technologies

### Frontend Stack
- Next.js 14.1.0
- React 18
- TypeScript
- Tailwind CSS
- React Hook Form with Zod validation
- Axios for API calls
- React Flow for workflow visualization
- Recharts for analytics

### Backend Stack
- AWS Lambda + Express
- AWS SDK v3 (DynamoDB, S3, Step Functions)
- OpenAI API
- TypeScript
- Zod for validation

### Authentication
- AWS Cognito with amazon-cognito-identity-js
- JWT token-based authentication
- Client-side auth state management

## Security Practices

### Client/Server Separation
- Frontend runs on Replit (port 5000)
- Backend APIs run on AWS infrastructure
- Authentication via AWS Cognito
- API calls secured with Bearer tokens
- Environment variables managed through Replit Secrets

### Best Practices
- No hardcoded credentials
- Public environment variables prefixed with `NEXT_PUBLIC_`
- Secure token storage in localStorage
- Proper CORS handling between frontend and AWS API Gateway

## Recent Changes (November 10, 2025)

### Migration Tasks Completed
1. ✓ Verified Node.js installation (nodejs-20)
2. ✓ Updated frontend package.json for Replit compatibility
3. ✓ Modified Next.js config to remove static export
4. ✓ Installed all dependencies for monorepo
5. ✓ Configured environment variables
6. ✓ Set up workflow for Next.js dev server
7. ✓ Verified application runs without errors

### Application Status
- Development server running successfully on port 5000
- Next.js compilation completed without errors
- All frontend routes accessible
- AWS service integration ready (requires valid credentials)

## Troubleshooting

### Common Issues
1. **Port conflicts**: Application is configured for port 5000 only
2. **Environment variables**: Ensure all required secrets are set in Replit
3. **AWS connectivity**: Verify AWS credentials and API Gateway accessibility
4. **Build errors**: Check workflow logs via Replit interface

### Log Access
- Workflow logs available in Replit console
- Next.js build output visible during compilation
- Browser console available in webview

## Production Deployment

This application was originally designed for AWS deployment via CDK:
- Frontend: Static export to S3 + CloudFront
- Backend: Lambda functions behind API Gateway
- Database: DynamoDB tables
- Storage: S3 buckets for artifacts

For Replit deployment, consider using Replit's deployment features or maintaining the AWS infrastructure while using Replit for development.

## Documentation
Additional documentation available in `docs/`:
- ARCHITECTURE.md - Detailed architecture overview
- LOCAL_DEVELOPMENT.md - Local development setup
- DEPLOYMENT.md - AWS deployment guide
- TROUBLESHOOTING.md - Common issues and solutions

## User Preferences
None documented yet - this section will be updated as preferences are established.
