# Webhook Testing Guide

This guide explains how to test the webhook functionality.

## Prerequisites

1. **Get your webhook token:**
   - Log in to the dashboard
   - Navigate to Settings (`/admin/settings`)
   - Copy your `webhook_url` from the response
   - Extract the token (the part after `/v1/webhooks/`)

2. **Have a workflow ready:**
   - Create a workflow or note an existing `workflow_id` or `workflow_name`

## Testing Methods

### Method 1: Using the Test Script (Recommended)

```bash
# Set your webhook token
export WEBHOOK_TOKEN="your_token_here"

# Run the test script
./scripts/test-webhook.sh
```

Or provide the token interactively:
```bash
./scripts/test-webhook.sh
# Enter your token when prompted
```

### Method 2: Manual Testing with curl

#### Test 1: Webhook with workflow_id

```bash
curl -X POST "https://your-api-url/v1/webhooks/YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_xxxxx",
    "form_data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+14155551234",
      "custom_field": "Custom value"
    }
  }'
```

Expected response:
```json
{
  "message": "Webhook received and job processing started",
  "job_id": "job_xxxxx",
  "status": "pending"
}
```

#### Test 2: Webhook with workflow_name

```bash
curl -X POST "https://your-api-url/v1/webhooks/YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_name": "My Workflow Name",
    "form_data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+14155551234"
    }
  }'
```

#### Test 3: Invalid token (should return 404)

```bash
curl -X POST "https://your-api-url/v1/webhooks/invalid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_xxxxx",
    "form_data": {
      "name": "Test",
      "email": "test@test.com",
      "phone": "+14155551234"
    }
  }'
```

Expected: `404` status with error message

#### Test 4: Missing workflow identifier (should return 400)

```bash
curl -X POST "https://your-api-url/v1/webhooks/YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "form_data": {
      "name": "Test",
      "email": "test@test.com",
      "phone": "+14155551234"
    }
  }'
```

Expected: `400` status with error message about missing workflow_id or workflow_name

### Method 3: Using TypeScript Test (Local Development)

```bash
cd backend/api
npm install  # If not already installed
npm run build
npx ts-node test-webhook.ts
```

Note: This requires:
- Local DynamoDB access or AWS credentials configured
- Environment variables set (see `server-local.js`)

## Testing Admin Endpoints

### Get Webhook URL

```bash
curl -X GET "https://your-api-url/admin/settings/webhook" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Regenerate Webhook Token

```bash
curl -X POST "https://your-api-url/admin/settings/webhook/regenerate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Verification Steps

After triggering a webhook:

1. **Check job status:**
   ```bash
   curl "https://your-api-url/v1/jobs/JOB_ID/status"
   ```

2. **Check job in dashboard:**
   - Navigate to `/admin/jobs`
   - Find the job by `job_id`
   - Verify submission data matches what you sent

3. **Verify submission:**
   - Check `/admin/submissions`
   - Verify the submission record was created
   - Check that `submitter_email`, `submitter_name`, etc. match

## Common Issues

### Issue: 404 Invalid webhook token
**Solution:** 
- Verify you copied the correct token from settings
- Check that the token hasn't been regenerated
- Ensure you're using the full token (no truncation)

### Issue: 404 Workflow not found
**Solution:**
- Verify the `workflow_id` exists and belongs to your tenant
- If using `workflow_name`, ensure it matches exactly (case-sensitive)
- Check that the workflow hasn't been deleted

### Issue: 400 Missing workflow identifier
**Solution:**
- Ensure either `workflow_id` OR `workflow_name` is provided in the request body
- Check JSON syntax is valid

### Issue: Job not processing
**Solution:**
- Check Step Functions execution (if in production)
- Check Lambda logs for errors
- Verify workflow configuration is valid

## Example: Complete Test Flow

```bash
# 1. Get your webhook URL
curl -X GET "https://your-api-url/admin/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq '.webhook_url'

# 2. Extract token from URL
WEBHOOK_TOKEN="extracted_token_here"

# 3. Trigger webhook
RESPONSE=$(curl -s -X POST "https://your-api-url/v1/webhooks/$WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_xxxxx",
    "form_data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+14155551234"
    }
  }')

# 4. Extract job_id
JOB_ID=$(echo $RESPONSE | jq -r '.job_id')

# 5. Check job status
curl "https://your-api-url/v1/jobs/$JOB_ID/status" | jq .
```

## Testing Checklist

- [ ] Webhook URL retrieved from settings
- [ ] Webhook accepts POST requests
- [ ] Webhook with `workflow_id` creates job
- [ ] Webhook with `workflow_name` creates job
- [ ] Invalid token returns 404
- [ ] Missing workflow identifier returns 400
- [ ] Job is created in database
- [ ] Submission record is created
- [ ] Workflow execution is triggered
- [ ] Token regeneration works
- [ ] Form data is preserved in submission

