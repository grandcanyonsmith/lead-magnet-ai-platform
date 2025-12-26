# 🚀 Local Development Guide

This guide will help you run the Lead Magnet AI platform locally for development.

## Prerequisites

1. **Node.js 20+** installed
2. **AWS CLI** configured with credentials
3. **AWS Account** with DynamoDB tables deployed (or use local DynamoDB)
4. **npm** or **yarn** package manager

## Quick Start

### Option 1: Run Everything Together (Recommended)

```bash
# Install all dependencies
npm run install:all

# Run both frontend and backend together
npm run dev
```

This will start:
- **API Server**: http://localhost:3001
- **Frontend**: http://localhost:3000

### Option 2: Run Separately

**Terminal 1 - Backend API:**
```bash
cd backend/api
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Configuration

### Frontend Environment

The frontend is configured to use the local API via `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend Environment

The backend uses environment variables for AWS resources. Make sure you have:
- AWS credentials configured (`aws configure`)
- DynamoDB tables deployed (or use local DynamoDB)
- AWS region set (defaults to `us-east-1`)

You can override these by setting environment variables:
```bash
export AWS_REGION=us-east-1
export WORKFLOWS_TABLE=leadmagnet-workflows
# ... etc
```

## Local API Server

The local API server (`backend/api/server-local.js`) wraps the Lambda handler in an Express server. It:

- Converts Express requests to API Gateway events
- Provides mock JWT claims for authentication
- Handles CORS for local development
- Runs on port 3001 by default

### Large Request Bodies (HTML Editor / Patch)

The HTML editor patch flow can send large HTML payloads. The local server increases Express body limits (defaults to `20mb`), and you can override it if needed:

```bash
export BODY_LIMIT=50mb
```

### Mock Authentication

For local development, the server uses mock JWT claims:
- `sub`: `84c8e438-0061-70f2-2ce0-7cb44989a329`
- `custom:tenant_id`: `84c8e438-0061-70f2-2ce0-7cb44989a329`
- `email`: `test@example.com`

**Note:** In production, these come from AWS Cognito via API Gateway authorizer.

## Troubleshooting

### Port Already in Use

If port 3001 is already in use:
```bash
PORT=3002 npm run dev:api
```

Then update `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### AWS Credentials Not Found

Make sure AWS credentials are configured:
```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_REGION=us-east-1
```

### DynamoDB Tables Not Found

The local server expects DynamoDB tables to exist. Make sure they're deployed:
```bash
cd infrastructure
npm run deploy
```

Or use local DynamoDB with DynamoDB Local.

### Build Errors

If you see TypeScript errors:
```bash
cd backend/api
npm run build
```

### Frontend Not Connecting to API

1. Check that the API server is running on port 3001
2. Verify `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3001`
3. Restart the Next.js dev server after changing `.env.local`

## Development Workflow

1. **Start the API server** - `npm run dev:api` or `npm run dev`
2. **Start the frontend** - `npm run dev:frontend` or `npm run dev`
3. **Make changes** - Edit files in `backend/api/src` or `frontend/src`
4. **API changes** - Rebuild: `cd backend/api && npm run build`
5. **Frontend changes** - Hot reloads automatically

## Testing

### Test API Locally
```bash
cd backend/api
npm run build
node test-local.js
```

### Test Frontend
```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

## Notes

- The local API server connects to **real AWS resources** (DynamoDB, S3, etc.)
- Make sure you have proper AWS credentials configured
- The mock JWT claims allow you to test admin routes locally
- CORS is enabled for local development
- All API routes are available at `http://localhost:3001`

## Next Steps

- See [README.md](../README.md) for full project documentation
- See [DEPLOYMENT.md](../DEPLOYMENT.md) for deployment instructions
- See [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) for API endpoints

