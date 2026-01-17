# Execution Paths

This document explains the different execution paths for processing jobs in the Lead Magnet AI platform.

## Overview

The platform supports two execution paths:

1. **Step Functions (Production)**: AWS Step Functions orchestrates workflow execution
2. **Direct Processing (Local Development)**: Lambda function processes jobs directly

## Step Functions Path (Production)

### When Used

- Production environment
- When `STEP_FUNCTIONS_ARN` environment variable is set
- When `IS_LOCAL` is not `'true'` and `NODE_ENV` is not `'development'`

### How It Works

1. **Form Submission**: User submits form via API
2. **Job Creation**: API creates job record in DynamoDB
3. **Step Functions Trigger**: API starts Step Functions execution with job details
4. **State Machine Execution**: Step Functions orchestrates the workflow:
   - Resolves step dependencies
   - Processes workflow steps (in parallel if possible)
   - Handles HTML generation
   - Updates job status
   - Handles errors and retries
5. **Completion**: Job status updated to `completed` or `failed`

### Benefits

- **Reliability**: Built-in retry logic and error handling
- **Visibility**: Step Functions console shows execution progress
- **Scalability**: Automatic scaling of Lambda functions
- **Cost Efficiency**: Pay only for execution time
- **State Management**: Step Functions manages workflow state

### Configuration

```typescript
// Environment variables required
STEP_FUNCTIONS_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:JobProcessor
AWS_REGION=us-east-1
```

### Code Location

- **State Machine Definition**: `infrastructure/lib/stepfunctions/job-processor-state-machine.ts`
- **API Trigger**: `backend/api/src/controllers/forms.ts` (lines 297-310)
- **Worker Handler**: `backend/worker/lambda_handler.py`

## Direct Processing Path (Local Development)

### When Used

- Local development environment
- When `IS_LOCAL` is `'true'` OR `NODE_ENV` is `'development'` OR `STEP_FUNCTIONS_ARN` is not set

### How It Works

1. **Form Submission**: User submits form via API
2. **Job Creation**: API creates job record in DynamoDB
3. **Direct Processing**: API imports and calls worker processor directly
4. **Synchronous Execution**: Worker processes job synchronously
5. **Completion**: Job status updated to `completed` or `failed`

### Benefits

- **Fast Iteration**: No need to deploy to test changes
- **Easier Debugging**: Direct access to logs and errors
- **No AWS Dependencies**: Can run entirely locally
- **Simpler Setup**: No Step Functions configuration needed

### Configuration

```typescript
// Environment variables for local development
IS_LOCAL=true
# OR
NODE_ENV=development
# OR omit STEP_FUNCTIONS_ARN
```

### Code Location

- **API Trigger**: `backend/api/src/controllers/forms.ts` (lines 275-296)
- **Local Processor**: `backend/api/src/services/jobProcessor.ts`
- **Worker Logic**: `backend/worker/processor.py`

## Execution Path Detection

The system automatically detects which path to use:

```typescript
// Detection logic (backend/api/src/controllers/forms.ts)
if (process.env.IS_LOCAL === 'true' || 
    process.env.NODE_ENV === 'development' || 
    !STEP_FUNCTIONS_ARN) {
  // Use direct processing path
  processJobLocally(jobId, tenantId, workflowId, submissionId);
} else {
  // Use Step Functions path
  startStepFunctionsExecution(jobId, tenantId, workflowId, submissionId);
}
```

## Comparison

| Feature | Step Functions | Direct Processing |
|---------|---------------|-------------------|
| **Environment** | Production | Local Development |
| **Orchestration** | AWS Step Functions | In-process |
| **Retry Logic** | Built-in | Manual |
| **Error Handling** | Automatic | Manual |
| **Scalability** | Auto-scaling | Single instance |
| **Visibility** | Step Functions Console | Application logs |
| **Setup Complexity** | Higher | Lower |
| **Cost** | Pay per execution | Free (local) |

## Switching Between Paths

### Enable Step Functions (Production)

1. Set `STEP_FUNCTIONS_ARN` environment variable
2. Ensure `IS_LOCAL` is not `'true'`
3. Ensure `NODE_ENV` is not `'development'`
4. Deploy infrastructure (CDK will create Step Functions state machine)

### Enable Direct Processing (Local)

1. Set `IS_LOCAL='true'` OR `NODE_ENV='development'`
2. OR omit `STEP_FUNCTIONS_ARN` environment variable
3. Ensure worker code is available locally

## Environment Variables

### Required for Step Functions

```bash
STEP_FUNCTIONS_ARN=arn:aws:states:...
AWS_REGION=us-east-1
```

### Required for Direct Processing

```bash
IS_LOCAL=true
# OR
NODE_ENV=development
```

### Common Variables (Both Paths)

```bash
JOBS_TABLE=leadmagnet-jobs
WORKFLOWS_TABLE=leadmagnet-workflows
WORKFLOW_VERSIONS_TABLE=leadmagnet-workflow-versions
SUBMISSIONS_TABLE=leadmagnet-submissions
ARTIFACTS_BUCKET=leadmagnet-artifacts
AWS_REGION=us-east-1
```

## Troubleshooting

### Step Functions Not Starting

1. Check `STEP_FUNCTIONS_ARN` is set correctly
2. Verify IAM permissions for Step Functions
3. Check CloudWatch logs for errors
4. Verify state machine exists in AWS Console

### Direct Processing Not Working

1. Check `IS_LOCAL` or `NODE_ENV` is set correctly
2. Verify worker code is available
3. Check application logs for errors
4. Ensure DynamoDB tables are accessible

### Wrong Path Being Used

1. Check environment variables
2. Verify detection logic in code
3. Check logs for path selection messages
4. Ensure environment variables are loaded correctly

## Best Practices

1. **Use Step Functions in Production**: Provides reliability and scalability
2. **Use Direct Processing Locally**: Faster iteration and easier debugging
3. **Test Both Paths**: Ensure code works in both environments
4. **Monitor Execution**: Use CloudWatch for Step Functions, logs for direct processing
5. **Handle Errors**: Both paths should handle errors gracefully

## See Also

- [Architecture Overview](./ARCHITECTURE.md)
- [Workflow Formats](./WORKFLOW_FORMATS.md)
- [Glossary](./GLOSSARY.md)

