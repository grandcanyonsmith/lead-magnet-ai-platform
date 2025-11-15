# Workflow Generation E2E Testing

## Overview
This directory contains end-to-end test scripts for the async workflow generation flow with webhook completion.

## Test Scripts

### 1. Bash Script (`test-workflow-generation-e2e.sh`)
A bash script that tests the complete workflow generation flow.

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
A Node.js script with the same functionality.

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

## What the Tests Verify

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

## Manual Testing Steps

1. **Start the services:**
   - Backend API (usually on port 3001)
   - Frontend (usually on port 3000)

2. **Open the frontend:**
   - Navigate to `/dashboard/workflows/new`

3. **Submit a workflow generation:**
   - Enter a description (e.g., "A course idea validator...")
   - Click "Generate Lead Magnet"
   - You should see "Creating your lead magnet..." screen

4. **Wait for completion:**
   - The page should automatically navigate to `/dashboard/workflows/{workflowId}/edit`
   - The workflow should have a "Draft" badge

5. **Verify the workflow:**
   - Check that all generated data is present (steps, template, form fields)
   - Verify the workflow can be edited and saved

## Troubleshooting

- **Job stuck in pending**: Check backend logs for Lambda execution issues
- **Webhook not received**: Verify the webhook URL is correctly formatted
- **Workflow not created**: Check backend logs for draft workflow service errors
- **Navigation not working**: Check browser console for JavaScript errors
