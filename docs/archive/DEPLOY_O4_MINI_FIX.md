# Deploy o4-mini-deep-research Web Search Fix

## Overview

This document describes how to deploy the fix that prevents `o4-mini-deep-research` model from automatically adding `web_search` tool.

## Changes Made

1. **Created shared model descriptions** (`backend/api/src/utils/modelDescriptions.ts`)
   - Centralized model descriptions for better maintainability
   - Removed automatic association between o4-mini-deep-research and web_search

2. **Refactored AI services** to use shared descriptions:
   - `backend/api/src/services/workflowStepAIService.ts`
   - `backend/api/src/utils/workflowPromptBuilder.ts`

3. **Added E2E test** (`scripts/testing/test-o4-mini-no-auto-websearch.ts`)
   - Verifies that web_search is not automatically added

## Deployment Steps

### 1. Build Backend API

```bash
cd backend/api
npm install
npm run build
```

Verify the build succeeded:
```bash
ls -la dist/
```

### 2. Deploy Backend API Lambda

The backend API is deployed as a Lambda function. Use one of these methods:

#### Option A: Use Deployment Script (Recommended)

```bash
cd /Users/canyonsmith/lead-magnent-ai
./scripts/deployment/deploy.sh
```

This will deploy:
- Infrastructure (if changed)
- Worker Docker image (if changed)
- API Lambda
- Frontend (if changed)

#### Option B: Deploy API Only (if script supports it)

Check if the deployment script has an option to deploy only the API:
```bash
./scripts/deployment/deploy.sh --api-only
```

#### Option C: Manual Lambda Deployment

If you need to deploy manually:

```bash
# Get Lambda function name
FUNCTION_NAME="leadmagnet-api-YourFunctionName"

# Package the code
cd backend/api
zip -r function.zip dist/ node_modules/ package.json

# Update Lambda function code
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region us-east-1
```

### 3. Verify Deployment

Check deployment status:
```bash
aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region us-east-1 \
  --query 'Configuration.LastUpdateStatus'
```

Should return: `"Successful"`

### 4. Run E2E Test

After deployment, run the E2E test to verify the fix works:

```bash
# Set environment variables
export API_URL=https://your-api-url.execute-api.us-east-1.amazonaws.com
export TENANT_ID=your_tenant_id
export AUTH_TOKEN=your_auth_token  # If required

# Run test
npx tsx scripts/testing/test-o4-mini-no-auto-websearch.ts
```

Expected output:
```
✅ All tests passed! o4-mini-deep-research does not auto-add web_search.
```

### 5. Monitor CloudWatch Logs

Watch for any errors in CloudWatch:
```bash
aws logs tail /aws/lambda/leadmagnet-api-YourFunctionName --follow --region us-east-1
```

Look for:
- Successful API calls to `/admin/workflows/:id/ai-step`
- No errors related to model descriptions
- Step generation working correctly

## Testing Checklist

- [ ] Backend API builds successfully
- [ ] Lambda function deployed successfully
- [ ] E2E test passes
- [ ] Manual test: Generate step with o4-mini-deep-research without mentioning tools
  - [ ] Verify web_search is NOT automatically added
- [ ] Manual test: Generate step explicitly requesting no tools
  - [ ] Verify no tools are added
- [ ] Manual test: Generate step explicitly requesting web_search
  - [ ] Verify web_search IS added (when explicitly requested)

## Rollback Plan

If the deployment causes issues:

1. **Revert the code changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Rebuild and redeploy:**
   ```bash
   cd backend/api
   npm run build
   ./scripts/deployment/deploy.sh
   ```

3. **Verify rollback:**
   ```bash
   # Check Lambda function version
   aws lambda get-function \
     --function-name $FUNCTION_NAME \
     --region us-east-1 \
     --query 'Configuration.Version'
   ```

## Files Changed

- `backend/api/src/utils/modelDescriptions.ts` (new)
- `backend/api/src/services/workflowStepAIService.ts` (refactored)
- `backend/api/src/utils/workflowPromptBuilder.ts` (refactored)
- `scripts/testing/test-o4-mini-no-auto-websearch.ts` (new)
- `docs/DEPLOY_O4_MINI_FIX.md` (this file)

## Notes

- The fix is backward compatible - existing workflows will continue to work
- Users can still manually add web_search tool if needed
- The change only affects AI-generated step configurations, not manual configurations

