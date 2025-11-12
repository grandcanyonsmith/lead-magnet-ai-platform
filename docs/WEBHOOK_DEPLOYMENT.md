# Webhook Feature Deployment Guide

> **Deployment Date**: 2025-11-12  
> **Status**: API Deployed, Frontend Pending

## Deployment Summary

### ✅ API Deployment (Complete)

**Lambda Function**: `leadmagnet-api-handler`
- **Status**: Deployed successfully
- **Code Size**: 229KB
- **Region**: us-east-1
- **Last Modified**: 2025-11-12

**New Endpoints Available**:
- `POST /v1/webhooks/{token}` - Public webhook endpoint
- `GET /admin/settings/webhook` - Get webhook URL
- `POST /admin/settings/webhook/regenerate` - Regenerate token

### ⚠️ Frontend Deployment (Pending)

Frontend changes need to be deployed to see the webhook UI in the settings page.

**To Deploy Frontend**:
```bash
cd frontend
npm install
npm run build
# Deploy to S3/CloudFront (use your deployment script)
```

## Post-Deployment Verification

### 1. Verify API Endpoints

```bash
# Get your webhook token (requires auth)
curl -X GET "https://your-api-url/admin/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq -r '.webhook_url'

# Test webhook endpoint
curl -X POST "https://your-api-url/v1/webhooks/YOUR_TOKEN" \
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

### 2. Verify Frontend (After Deployment)

1. Navigate to Settings page
2. Check "Delivery Settings" section
3. Verify webhook URL is displayed
4. Test Copy button
5. Test Regenerate button

## Rollback Plan

If issues occur, rollback by:

```bash
# Redeploy previous API version
cd backend/api
git checkout HEAD~1 -- src/
npm run build
npm run package:lambda
aws lambda update-function-code \
  --function-name leadmagnet-api-handler \
  --zip-file fileb://api-bundle.zip \
  --region us-east-1
```

## Environment Variables

Ensure these are set in Lambda:
- `API_URL` or `API_GATEWAY_URL` - For constructing full webhook URLs
- All existing table environment variables
- `STEP_FUNCTIONS_ARN` - For workflow execution

## Monitoring

After deployment, monitor:
- Lambda function logs for webhook requests
- DynamoDB metrics for user_settings table queries
- API Gateway logs for webhook endpoint usage
- Error rates for invalid tokens or missing workflows

## Known Issues

- Webhook URL may show relative path if `API_URL` not set in Lambda environment
- User lookup uses table scan (acceptable for MVP, consider GSI for scale)

## Next Steps

1. Deploy frontend changes
2. Test webhook from external system
3. Monitor usage and performance
4. Consider adding GSI on webhook_token if user volume increases

