# Deploy Webhook Artifacts Feature

## Deployment Method

The Lambda function uses a **Docker container image**, so we need to build and push a new image.

## Quick Deploy (Using Script)

Run the deployment script:

```bash
./deploy-webhook-artifacts.sh
```

## Manual Deploy Steps

### 1. Get ECR Repository URI

```bash
ECR_REPO=$(aws ecr describe-repositories --repository-names leadmagnet/worker --region us-east-1 --query 'repositories[0].repositoryUri' --output text)
echo $ECR_REPO
```

### 2. Login to ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO
```

### 3. Build Docker Image

```bash
cd backend/worker
docker buildx build --platform linux/amd64 -t leadmagnet-worker:latest --load .
```

### 4. Tag and Push Image

```bash
docker tag leadmagnet-worker:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

### 5. Update Lambda Function

```bash
FUNCTION_NAME="leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG"
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --image-uri $ECR_REPO:latest \
  --region us-east-1
```

## Verify Deployment

Check deployment status:

```bash
aws lambda get-function \
  --function-name leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG \
  --region us-east-1 \
  --query 'Configuration.LastUpdateStatus'
```

Should return: `"Successful"`

## Test the Feature

After deployment, trigger a webhook and check CloudWatch logs:

```bash
aws logs tail /aws/lambda/leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG --follow --region us-east-1
```

Look for:
- `"[DeliveryService] Queried artifacts for webhook"` - confirms artifacts were queried
- `"[DeliveryService] Artifact URLs in payload"` - shows URLs included
- `"artifacts_count"`, `"images_count"`, `"html_files_count"`, `"markdown_files_count"` - confirms categorization

## What Was Changed

1. **Added `query_artifacts_by_job_id` method** in `db_service.py` to query artifacts by job_id using GSI
2. **Modified `send_webhook_notification`** in `delivery_service.py` to:
   - Query all artifacts for the job
   - Include artifacts in payload with separate arrays: `artifacts`, `images`, `html_files`, `markdown_files`
   - Each artifact includes: `artifact_id`, `artifact_type`, `artifact_name`, `public_url`, `file_size_bytes`, `mime_type`, `created_at`
3. **Added logging** to track artifact URLs in the payload

## Expected Webhook Payload Structure

```json
{
  "job_id": "...",
  "status": "completed",
  "output_url": "...",
  "artifacts": [
    {
      "artifact_id": "...",
      "artifact_type": "...",
      "artifact_name": "...",
      "public_url": "...",
      "file_size_bytes": ...,
      "mime_type": "...",
      "created_at": "..."
    }
  ],
  "images": [...],
  "html_files": [...],
  "markdown_files": [...]
}
```

