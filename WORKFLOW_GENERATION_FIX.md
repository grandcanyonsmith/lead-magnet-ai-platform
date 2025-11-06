# Workflow Generation Job Fix Summary

## Problem
Workflow generation jobs were stuck in "pending" status because:
1. Lambda function was missing dependencies (`ulid`, `openai`, `node-fetch`, etc.)
2. Workspace hoisting was putting dependencies in root `node_modules` instead of `backend/api/node_modules`
3. Lambda deployment wasn't including hoisted dependencies

## Solution Applied

### 1. Updated Lambda Handler (`backend/api/src/index.ts`)
- Added logic to load job data from DynamoDB if missing from event
- Better error handling for async workflow generation jobs

### 2. Fixed Lambda Deployment (`.github/workflows/api-deploy.yml`)
- Added script to copy hoisted dependencies from root `node_modules` to `backend/api/node_modules`
- Includes: `ulid`, `openai`, `zod`, `cors`, `express`, `node-fetch`
- Verifies critical modules are included in deployment package

### 3. Deployed Fixed Lambda
- Manually deployed Lambda with all dependencies included
- Lambda can now process workflow generation jobs

## Testing

To test the fix:

```bash
# Check job status
aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key '{"job_id":{"S":"wfgen_01K9CS4S0S6HRYBVPEPW5ZDP6K"}}' \
  --region us-east-1

# Manually trigger processing (if still pending)
aws lambda invoke \
  --function-name leadmagnet-api-handler \
  --region us-east-1 \
  --payload file://<(echo '{"source":"workflow-generation-job","job_id":"wfgen_01K9CS4S0S6HRYBVPEPW5ZDP6K","tenant_id":"84c8e438-0061-70f2-2ce0-7cb44989a329","description":"a lead mag","model":"gpt-5"}' | base64) \
  /tmp/lambda-response.json
```

## Next Steps

1. **New workflow generation jobs should now work** - The Lambda has all dependencies
2. **Future deployments** will automatically include dependencies via updated workflow
3. **Monitor** new workflow generation jobs to ensure they complete successfully

## Prevention

The GitHub Actions workflow now:
- Copies hoisted dependencies before packaging
- Verifies critical modules are included
- Will prevent this issue in future deployments
