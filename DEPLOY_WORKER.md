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

3. **Update ECS Task Definition** (if needed)
   ```bash
   # The ECS service should automatically pick up the new image
   # Or force a new deployment:
   aws ecs update-service \
     --cluster leadmagnet-cluster \
     --service leadmagnet-worker-service \
     --force-new-deployment \
     --region us-east-1
   ```

### Option 2: Use Full Deployment Script

```bash
cd /Users/canyonsmith/lead-magnent-ai
bash scripts/deploy.sh
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
   aws logs tail /ecs/leadmagnet-worker --follow --region us-east-1
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

# Update service to use previous image
aws ecs update-service \
  --cluster leadmagnet-cluster \
  --service leadmagnet-worker-service \
  --task-definition leadmagnet-worker:PREVIOUS_VERSION \
  --region us-east-1
```

