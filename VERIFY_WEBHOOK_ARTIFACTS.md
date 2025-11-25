# Webhook Artifacts Verification

## ✅ Deployment Status

**Lambda Function**: `leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG`
**Status**: ✅ Deployed Successfully
**Last Updated**: 2025-11-25T21:XX:XX

## 🔍 Code Verification

The following code has been deployed:

### 1. WebhookStepService (`backend/worker/services/webhook_step_service.py`)

**Lines 239-303**: Artifact querying and inclusion logic
- Queries artifacts using `self.db.query_artifacts_by_job_id(job_id)`
- Categorizes artifacts into: `artifacts`, `images`, `html_files`, `markdown_files`
- Includes artifact metadata: `artifact_id`, `artifact_type`, `artifact_name`, `public_url`, `file_size_bytes`, `mime_type`, `created_at`
- Logs artifact URLs for debugging

### 2. StepProcessor (`backend/worker/services/step_processor.py`)

**Line 63**: Passes `db_service` to `WebhookStepService`
```python
self.webhook_step_service = WebhookStepService(db_service=db_service)
```

## 🧪 How to Verify

### Method 1: Check Logs (After Next Webhook Step Runs)

```bash
# Wait for a webhook step to execute, then check logs
aws logs tail /aws/lambda/leadmagnet-job-processor \
  --region us-east-1 \
  --since 10m \
  | grep -i "Artifact URLs in webhook\|artifacts_count"
```

Look for:
```
[WebhookStepService] Artifact URLs in webhook step payload
artifact_urls_count: X
artifact_urls: [url1, url2, ...]
```

### Method 2: Check Frontend (Recommended)

1. **Go to a job with a webhook step**: 
   - Navigate to: `https://dmydkyj79auy7.cloudfront.net/dashboard/jobs/{job_id}`
   - Or use job: `job_01KAYDBYCJZX8VVD4C1F6W4YSJ` (currently processing)

2. **Find the webhook step**:
   - Look for "Webhook Data Submission" step
   - Click "Details" to expand

3. **Check the Input section**:
   - Should show the full payload JSON
   - Look for these keys:
     - `artifacts` (array)
     - `images` (array)
     - `html_files` (array)
     - `markdown_files` (array)

4. **Verify artifact structure**:
   Each artifact should have:
   ```json
   {
     "artifact_id": "...",
     "artifact_type": "...",
     "artifact_name": "...",
     "public_url": "https://...",
     "file_size_bytes": ...,
     "mime_type": "...",
     "created_at": "..."
   }
   ```

### Method 3: Create New Test Job

1. **Create a workflow** with:
   - Step 1: AI step (generates content/artifacts)
   - Step 2: Webhook step with URL: `https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook`

2. **Submit the form** to trigger the workflow

3. **Wait for completion** (check job status)

4. **Verify**:
   - Check CloudWatch logs for "Artifact URLs in webhook step payload"
   - Check frontend job details - Input section should show artifacts
   - Check webhook receiver - payload should include artifacts arrays

## 📊 Expected Payload Structure

When a webhook step executes, the payload will include:

```json
{
  "submission_data": {
    "name": "...",
    "email": "...",
    ...
  },
  "job_info": {
    "job_id": "...",
    "workflow_id": "...",
    "status": "...",
    "created_at": "...",
    "updated_at": "..."
  },
  "step_outputs": {
    "step_0": {
      "step_name": "...",
      "step_index": 0,
      "output": "...",
      "artifact_id": "...",
      "image_urls": [...]
    }
  },
  "artifacts": [
    {
      "artifact_id": "art_...",
      "artifact_type": "step_output",
      "artifact_name": "step_1_profile_normalization.md",
      "public_url": "https://dmydkyj79auy7.cloudfront.net/...",
      "file_size_bytes": 1234,
      "mime_type": "text/markdown",
      "created_at": "2025-11-25T..."
    }
  ],
  "images": [],
  "html_files": [],
  "markdown_files": [
    {
      "artifact_id": "art_...",
      "artifact_type": "step_output",
      "artifact_name": "step_1_profile_normalization.md",
      "public_url": "https://...",
      ...
    }
  ]
}
```

## ✅ Verification Checklist

- [x] Code deployed to Lambda
- [ ] Logs show "Artifact URLs in webhook step payload" (wait for next webhook step)
- [ ] Frontend shows artifacts in webhook step Input section
- [ ] Payload includes `artifacts` array
- [ ] Payload includes `images` array
- [ ] Payload includes `html_files` array
- [ ] Payload includes `markdown_files` array
- [ ] Each artifact has `public_url` field

## 🐛 Troubleshooting

**No artifacts in payload:**
- Check if job has artifacts: Look for `artifact_id` in step outputs
- Check logs for "Queried artifacts for webhook step" message
- Verify `query_artifacts_by_job_id` is working

**Frontend not showing payload:**
- Refresh the page
- Check browser console for errors
- Verify execution_steps are loaded from S3

**Logs not showing:**
- Wait a few minutes after deployment
- Check if webhook steps are actually executing
- Verify filter pattern is correct

