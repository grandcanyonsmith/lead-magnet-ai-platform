# Deploy Worker Changes - Image URL Passing Feature

## Changes Made
- Added `collect_previous_image_urls` to `context_builder.py`
- Modified `build_api_params` in `openai_client.py` to include previous image URLs
- Updated `generate_report` in `ai_service.py` to pass image URLs
- Updated `process_single_step` and `process_step_batch_mode` in `step_processor.py`

## Deployment Steps

### Option 1: Deploy Worker Docker Image (Requires Docker)

1. **Start Docker Desktop**
   ```bash
   # Make sure Docker Desktop is running
   open -a Docker
   ```

2. **Build and Push Worker Image**
   ```bash
   cd /Users/canyonsmith/lead-magnent-ai
   bash scripts/build-and-push-worker-image.sh
   ```

3. **Update Job Processor Lambda to use the new image**
   ```bash
   # IMPORTANT: Lambda container images do NOT auto-refresh when a tag is updated in ECR.
   # Update the Lambda function to point at the latest image.
   ECR_REPO=$(aws cloudformation describe-stacks \
     --stack-name leadmagnet-worker \
     --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
     --output text)

   JOB_PROCESSOR_LAMBDA_ARN=$(aws cloudformation describe-stacks \
     --stack-name leadmagnet-compute \
     --query "Stacks[0].Outputs[?OutputKey=='JobProcessorLambdaArn'].OutputValue" \
     --output text)

   aws lambda update-function-code \
     --function-name "$JOB_PROCESSOR_LAMBDA_ARN" \
     --image-uri "$ECR_REPO:latest" \
     --region us-east-1
   ```

### Option 2: Use Full Deployment Script

```bash
cd /Users/canyonsmith/lead-magnent-ai
bash scripts/deployment/deploy.sh
```

This will deploy:
- Infrastructure (if changed)
- Worker Docker image
- API Lambda
- Frontend

### Option 3: Commit and Use CI/CD (if configured)

```bash
# Commit changes
git add backend/worker/
git commit -m "feat: Pass previous image URLs to image generation steps"

# Push to trigger CI/CD
git push origin 2025-11-12-z5iz-3e92f
```

## Verification

After deployment, verify the changes work:

1. **Check CloudWatch Logs**
   ```bash
   aws logs tail /aws/lambda/leadmagnet-job-processor --follow --region us-east-1
   ```

2. **Look for log messages:**
   - `"Collected previous image URLs for image generation step"`
   - `"Building API params with previous image URLs"`
   - `"previous_image_urls_count"`

3. **Test with a workflow:**
   - Create a workflow with multiple steps
   - First step generates an image
   - Second step uses `image_generation` tool
   - Verify the second step receives the image URL from the first step

## Rollback (if needed)

If you need to rollback:

```bash
# Get previous image tag
aws ecr describe-images \
  --repository-name leadmagnet/worker \
  --region us-east-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-2].imageTags[0]' \
  --output text

# Update Lambda to use previous image tag
JOB_PROCESSOR_LAMBDA_ARN=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-compute \
  --query "Stacks[0].Outputs[?OutputKey=='JobProcessorLambdaArn'].OutputValue" \
  --output text)

aws lambda update-function-code \
  --function-name "$JOB_PROCESSOR_LAMBDA_ARN" \
  --image-uri "471112574622.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker:PREVIOUS_VERSION" \
  --region us-east-1
```

