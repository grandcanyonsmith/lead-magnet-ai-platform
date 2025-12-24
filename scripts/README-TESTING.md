# Workflow Generation E2E Testing Scripts

## Overview

This document details the specific scripts for testing the async workflow generation flow with webhook completion. 
For the broader testing guide, see [docs/testing/README.md](../docs/testing/README.md).

## Test Scripts

These scripts are located in `scripts/` (root of scripts directory):

### 1. Bash Script (`test-workflow-generation-e2e.sh`)

**Usage:**
```bash
# Set environment variables (optional)
export API_URL=http://localhost:3001
export FRONTEND_URL=http://localhost:3000
export TENANT_ID=your_tenant_id
export AUTH_TOKEN=your_auth_token

# Run the test
./scripts/test-workflow-generation-e2e.sh
```

### 2. Node.js Script (`test-workflow-generation-e2e.js`)

**Usage:**
```bash
# Set environment variables (optional)
export API_URL=http://localhost:3001
export FRONTEND_URL=http://localhost:3000
export TENANT_ID=your_tenant_id
export AUTH_TOKEN=your_auth_token

# Run the test
node scripts/test-workflow-generation-e2e.js
```

## Verification Scope

1. **Job Creation**: Submits a workflow generation request and verifies a job is created
2. **Job Status**: Checks that the job status is tracked correctly
3. **Job Completion**: Waits for job completion (with timeout)
4. **Draft Workflow**: Verifies the workflow is saved with `status: 'draft'`
5. **Webhook Endpoint**: Tests that the webhook completion endpoint accepts POST requests
6. **Webhook Status Check**: Tests that the webhook status can be queried via GET

## Expected Flow

1. User submits workflow generation → API returns `job_id` immediately
2. Backend processes generation asynchronously
3. When complete, backend saves workflow as draft and sends webhook to frontend
4. Frontend webhook endpoint receives completion and stores it
5. Frontend polls webhook endpoint and navigates to edit page when complete

## Manual Verification

1. **Start Services**: Backend (3001) + Frontend (3000)
2. **Navigate**: `/dashboard/workflows/new`
3. **Submit**: Enter description, click "Generate"
4. **Wait**: Screen should transition from "Creating..." to Edit page automatically
5. **Verify**: Check for "Draft" badge and populated steps/template
