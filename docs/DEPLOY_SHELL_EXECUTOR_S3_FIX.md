# Deployment Guide: Shell Executor S3-Based Job Request Fix

This guide walks through deploying the fix for the shell executor container overrides size limit issue.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 20+ installed
- Docker installed (for building shell executor image)
- Access to deploy to AWS account `471112574622` in `us-east-1`

## Deployment Order

The changes are backward compatible, but recommended order:

1. **Infrastructure** (Shell Executor Stack) - Adds lifecycle rule and rebuilds runner image
2. **Worker** (Python Lambda) - Updates Python code that calls shell executor
3. **API** (TypeScript Lambda) - Updates TypeScript code that calls shell executor

## Step 1: Deploy Infrastructure (Shell Executor Stack)

The shell executor stack will automatically rebuild the Docker image with the updated `runner.js`.

### Option A: Deploy via GitHub Actions (Recommended)

1. Commit and push the changes to `main` branch:
   ```bash
   git add infrastructure/lib/shell-executor-stack.ts
   git commit -m "fix: add S3-based job request for shell executor to avoid size limits"
   git push origin main
   ```

2. The GitHub workflow `.github/workflows/cdk-infra.yml` will automatically:
   - Build the infrastructure
   - Deploy all stacks including the shell executor stack
   - Rebuild the shell executor Docker image with new `runner.js`

### Option B: Deploy Locally via CDK

```bash
cd infrastructure

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy just the shell executor stack
npx cdk deploy leadmagnet-shell-executor --require-approval never

# Or deploy all stacks
npx cdk deploy --all --require-approval never
```

**What this does:**
- Updates the S3 bucket lifecycle rules to include `shell-jobs/` prefix
- Rebuilds the shell executor Docker image with updated `runner.js` (contract version `2025-12-29`)
- Creates a new ECS task definition revision with the new image
- The new task definition will automatically be used for new tasks

**Verification:**
```bash
# Check that the lifecycle rule was added
aws s3api get-bucket-lifecycle-configuration \
  --bucket leadmagnet-artifacts-shell-results-471112574622 \
  --region us-east-1

# Check the latest task definition revision
aws ecs describe-task-definition \
  --task-definition leadmagnet-shell-executor \
  --region us-east-1 \
  --query 'taskDefinition.revision'
```

## Step 2: Deploy Worker (Python Lambda)

The worker Lambda contains the Python code that calls the shell executor.

### Option A: Deploy via GitHub Actions (Recommended)

1. Commit and push the changes:
   ```bash
   git add backend/worker/services/shell_executor_service.py
   git commit -m "fix: use S3 for shell executor job requests to avoid size limits"
   git push origin main
   ```

2. The GitHub workflow `.github/workflows/worker-ecr.yml` will automatically:
   - Build and push the Docker image to ECR
   - Update the job processor Lambda function

### Option B: Deploy Locally

```bash
# Build and push worker image
cd backend/worker

# Build Docker image (Linux x86_64 for Lambda)
docker build --platform linux/amd64 \
  -t leadmagnet/worker:latest \
  -t leadmagnet/worker:$(git rev-parse --short HEAD) .

# Get ECR repository URL
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker"

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Tag and push
docker tag leadmagnet/worker:latest $ECR_REGISTRY:latest
docker tag leadmagnet/worker:latest $ECR_REGISTRY:$(git rev-parse --short HEAD)
docker push $ECR_REGISTRY:latest
docker push $ECR_REGISTRY:$(git rev-parse --short HEAD)

# Update Lambda function
JOB_PROCESSOR_LAMBDA=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-compute \
  --query "Stacks[0].Outputs[?OutputKey=='JobProcessorLambdaArn'].OutputValue" \
  --output text)

aws lambda update-function-code \
  --function-name "$JOB_PROCESSOR_LAMBDA" \
  --image-uri "$ECR_REGISTRY:latest" \
  --region us-east-1
```

**Verification:**
```bash
# Check Lambda function was updated
aws lambda get-function \
  --function-name <JOB_PROCESSOR_LAMBDA_ARN> \
  --region us-east-1 \
  --query 'Configuration.LastModified'
```

## Step 3: Deploy API (TypeScript Lambda)

The API Lambda contains the TypeScript code that also calls the shell executor.

### Option A: Deploy via GitHub Actions (Recommended)

1. Commit and push the changes:
   ```bash
   git add backend/api/src/services/shellExecutorService.ts
   git commit -m "fix: use S3 for shell executor job requests to avoid size limits"
   git push origin main
   ```

2. The GitHub workflow `.github/workflows/cdk-infra.yml` will automatically deploy the API stack

### Option B: Deploy Locally

```bash
cd infrastructure

# Build and deploy API stack
npm run build
npx cdk deploy leadmagnet-api --require-approval never
```

**Verification:**
```bash
# Check API Lambda was updated
aws lambda get-function \
  --function-name <API_LAMBDA_ARN> \
  --region us-east-1 \
  --query 'Configuration.LastModified'
```

## Testing After Deployment

### Test 1: Verify Shell Executor Can Fetch from S3

Create a test job that uses the shell tool with a large command set:

```bash
# Use the diagnostic script to check if new tasks are using the GET URL
python3 scripts/jobs/diagnose-shell-executor.py \
  --job-id <test_job_id> \
  --start-time "2025-12-29T12:00:00" \
  --end-time "2025-12-29T12:30:00"
```

### Test 2: Test Large Screenshot Plan

Run a workflow that generates a large screenshot plan (like the one that failed):

1. Submit a job with Step 5 (Automated Screenshot Capture)
2. Check CloudWatch logs for the shell executor task
3. Verify it successfully fetches the job request from S3
4. Verify screenshots are captured successfully

### Test 3: Check S3 Cleanup

After a job completes, verify both result and job request are cleaned up:

```bash
# List objects in shell-jobs prefix (should be empty or very few)
aws s3 ls s3://leadmagnet-artifacts-shell-results-471112574622/shell-jobs/ \
  --region us-east-1

# List objects in shell-results prefix (should be empty or very few)
aws s3 ls s3://leadmagnet-artifacts-shell-results-471112574622/shell-results/ \
  --region us-east-1
```

## Rollback Plan

If issues occur, you can rollback:

1. **Rollback Infrastructure**: Revert the CDK stack to previous version
   ```bash
   cd infrastructure
   git checkout <previous-commit>
   npm run build
   npx cdk deploy leadmagnet-shell-executor --require-approval never
   ```

2. **Rollback Worker**: Revert to previous Docker image
   ```bash
   # Find previous image tag
   aws ecr describe-images \
     --repository-name leadmagnet/worker \
     --region us-east-1 \
     --query 'sort_by(imageDetails,&imagePushedAt)[-2].imageTags[0]'
   
   # Update Lambda to previous image
   aws lambda update-function-code \
     --function-name <JOB_PROCESSOR_LAMBDA_ARN> \
     --image-uri "${ECR_REGISTRY}:<previous-tag>" \
     --region us-east-1
   ```

3. **Rollback API**: Revert CDK stack
   ```bash
   cd infrastructure
   git checkout <previous-commit>
   npm run build
   npx cdk deploy leadmagnet-api --require-approval never
   ```

## Monitoring

After deployment, monitor:

1. **CloudWatch Logs**: `/aws/ecs/leadmagnet-shell-executor`
   - Look for errors fetching job requests
   - Verify tasks are completing successfully

2. **Lambda Logs**: `/aws/lambda/leadmagnet-job-processor`
   - Check for shell executor errors
   - Verify job requests are being uploaded to S3

3. **S3 Metrics**: Monitor bucket size and object count
   - Should see temporary spikes during job execution
   - Should return to baseline after cleanup

## Troubleshooting

### Issue: Tasks failing to fetch job request

**Symptoms**: Tasks fail immediately with "Failed to fetch job request from URL"

**Check:**
- Presigned URL is valid (not expired)
- S3 bucket permissions allow GET from presigned URL
- Network connectivity from ECS task to S3

**Fix:**
- Verify presigned URL expiration (should be 15 minutes)
- Check security group allows HTTPS egress (port 443)
- Verify VPC has NAT gateway for internet access

### Issue: Job requests not cleaned up

**Symptoms**: Objects accumulating in `shell-jobs/` prefix

**Check:**
- Lifecycle rule is active
- Objects are older than 1 day
- Bucket has proper permissions

**Fix:**
- Verify lifecycle rule in S3 console
- Manually delete old objects if needed
- Check IAM permissions for cleanup operations

### Issue: Backward compatibility broken

**Symptoms**: Legacy jobs (using `SHELL_EXECUTOR_JOB_B64`) fail

**Check:**
- Runner.js still supports legacy env vars
- Contract version check allows both versions

**Fix:**
- Verify `runner.js` has backward compatibility code
- Check contract version validation logic

## Success Criteria

✅ Shell executor tasks successfully fetch job requests from S3  
✅ Large job requests (e.g., screenshot plans) work without size limit errors  
✅ Job requests and results are cleaned up after execution  
✅ Legacy jobs still work (backward compatibility maintained)  
✅ No increase in error rates or task failures  

## Next Steps

After successful deployment:

1. Monitor for 24-48 hours to ensure stability
2. Update documentation if needed
3. Consider removing legacy support after migration period (optional)
4. Add monitoring/alerts for shell executor failures
