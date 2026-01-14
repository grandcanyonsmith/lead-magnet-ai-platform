# Webhook Artifacts Testing Guide

## ✅ Deployment Status

The webhook artifacts feature has been successfully deployed:
- **Lambda Function**: `leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG`
- **Status**: Active and Successful
- **Last Updated**: 2025-11-25T21:09:34
- **Code**: Artifact logging code is deployed in `delivery_service.py`

## 🧪 Testing Instructions

### Prerequisites

1. **Get your webhook token:**
   - Log in to https://forms.mycoursecreator360.com
   - Go to Settings
   - Copy your webhook URL
   - Extract the token (last part after `/v1/webhooks/`)

2. **Create or use a workflow with webhook delivery:**
   - Workflow must have `delivery_method: "webhook"`
   - `delivery_webhook_url` must be set to: `https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook`

### Test Method 1: Using the Script

```bash
# Run the interactive test script
./test-via-webhook-endpoint.sh
```

When prompted:
1. Enter your webhook token
2. Enter a workflow_id that has webhook delivery configured

### Test Method 2: Manual API Testing

**Step 1: Submit via webhook endpoint**

```bash
export WEBHOOK_TOKEN="your_token_here"
export WORKFLOW_ID="wf_xxxxx"
export API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

curl -X POST "$API_URL/v1/webhooks/$WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow_id\": \"$WORKFLOW_ID\",
    \"name\": \"Test User\",
    \"email\": \"test@example.com\",
    \"message\": \"Test webhook artifacts\"
  }"
```

**Step 2: Wait for job completion**

```bash
export JOB_ID="job_xxxxx"  # From step 1 response

# Check status
curl "$API_URL/v1/jobs/$JOB_ID/status"
```

**Step 3: Verify artifacts in CloudWatch logs**

```bash
aws logs tail /aws/lambda/leadmagnet-job-processor \
  --region us-east-1 \
  --since 5m \
  --filter-pattern "$JOB_ID" \
  | grep -i "Artifact URLs\|artifacts_count"
```

Look for log entries like:
```
[DeliveryService] Artifact URLs in payload
artifact_urls_count: X
artifact_urls: [url1, url2, ...]
```

**Step 4: Verify webhook payload**

Check your webhook receiver at `https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook`

The payload should include:
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

## 🔍 Verification Checklist

- [ ] Job completes successfully
- [ ] CloudWatch logs show "Artifact URLs in payload"
- [ ] Webhook receiver receives POST request
- [ ] Payload includes `artifacts` array
- [ ] Payload includes `images` array
- [ ] Payload includes `html_files` array
- [ ] Payload includes `markdown_files` array
- [ ] Each artifact has `public_url` field

## 📝 Code Verification

The deployed code in `delivery_service.py` includes:

```python
# Log artifact URLs for debugging
if artifacts_list:
    artifact_urls = [a.get('public_url') for a in artifacts_list if a.get('public_url')]
    logger.info(f"[DeliveryService] Artifact URLs in payload", extra={
        'job_id': job_id,
        'artifact_urls_count': len(artifact_urls),
        'artifact_urls': artifact_urls[:5]  # Log first 5 URLs
    })
```

This confirms artifacts are:
1. Queried from the database
2. Categorized into types
3. Included in the webhook payload
4. Logged for debugging

## 🐛 Troubleshooting

**No artifact logs found:**
- Job may not have completed yet (wait a few minutes)
- Check job status: `curl "$API_URL/v1/jobs/$JOB_ID/status"`
- Verify workflow has `delivery_method: "webhook"` configured

**Webhook timeout:**
- The webhook receiver may be slow to respond
- Check CloudWatch logs for timeout errors
- Artifacts are still included in the payload even if webhook times out

**No artifacts in payload:**
- Verify artifacts exist for the job: Check S3 or DynamoDB artifacts table
- Check logs for "Queried artifacts for webhook" message
- Verify `query_artifacts_by_job_id` is working correctly

