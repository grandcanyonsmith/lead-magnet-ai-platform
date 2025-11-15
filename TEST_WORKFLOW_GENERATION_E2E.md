# E2E Test Guide: Async Workflow Generation with Webhook

## Quick Start

### Prerequisites
1. Backend API running (default: `http://localhost:3001`)
2. Frontend running (default: `http://localhost:3000`)
3. Valid tenant ID and auth token (if required)

### Option 1: Automated Test (Recommended)

**Using Node.js script:**
```bash
export API_URL=http://localhost:3001
export FRONTEND_URL=http://localhost:3000
export TENANT_ID=your_tenant_id
export AUTH_TOKEN=your_auth_token  # Optional if no auth required

node scripts/test-workflow-generation-e2e.js
```

**Using Bash script:**
```bash
export API_URL=http://localhost:3001
export FRONTEND_URL=http://localhost:3000
export TENANT_ID=your_tenant_id
export AUTH_TOKEN=your_auth_token  # Optional if no auth required

./scripts/test-workflow-generation-e2e.sh
```

### Option 2: Manual Test via UI

1. **Start Services:**
   ```bash
   # Terminal 1: Backend
   cd backend/api
   npm run dev  # or your start command
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

2. **Open Frontend:**
   - Navigate to `http://localhost:3000/dashboard/workflows/new`
   - Make sure you're logged in

3. **Submit Workflow Generation:**
   - Enter description: "A course idea validator that analyzes market demand, competition, target audience, and provides actionable recommendations for course creators"
   - Click "Generate Lead Magnet"
   - **Expected:** You should immediately see "Creating your lead magnet..." screen with a spinner

4. **Wait for Completion:**
   - The page should automatically navigate to `/dashboard/workflows/{workflowId}/edit`
   - **Expected:** Workflow edit page with "Draft" badge visible
   - **Expected:** All generated data should be populated (steps, template, form fields)

5. **Verify Workflow:**
   - Check that workflow has `status: 'draft'`
   - Verify all steps are present
   - Check template HTML is generated
   - Verify form fields are created
   - Test saving the workflow

## What to Verify

### Backend Verification

1. **Job Creation:**
   - Check API logs for: `[Workflow Generation] Created job record`
   - Verify job has `webhook_url` set with `{jobId}` replaced

2. **Job Processing:**
   - Check API logs for: `[Workflow Generation] Job completed successfully`
   - Verify job status changes: `pending` → `processing` → `completed`

3. **Draft Workflow Creation:**
   - Check API logs for: `[Draft Workflow Service] Draft workflow saved`
   - Verify workflow in database has `status: 'draft'`
   - Check that `workflow_id` is stored in job record

4. **Webhook Sent:**
   - Check API logs for: `[Webhook Service] Sending workflow generation webhook`
   - Verify webhook is sent to frontend URL

### Frontend Verification

1. **UI State:**
   - "Creating your lead magnet..." screen appears immediately
   - Job ID is displayed (if shown)
   - No errors in browser console

2. **Webhook Reception:**
   - Check browser Network tab for POST to `/api/webhooks/workflow-completion/{jobId}`
   - Verify response is 200 OK

3. **Navigation:**
   - Page automatically navigates to edit page
   - URL changes to `/dashboard/workflows/{workflowId}/edit`
   - No page refresh errors

4. **Draft Badge:**
   - Yellow "Draft" badge visible on edit page
   - Workflow data is loaded correctly

## Troubleshooting

### Job Stuck in "pending"
- **Check:** Backend Lambda function is running
- **Check:** CloudWatch logs for Lambda execution
- **Check:** Step Functions execution (if using Step Functions)
- **Fix:** Ensure Lambda has proper permissions and is deployed

### Webhook Not Received
- **Check:** Webhook URL format is correct
- **Check:** Frontend webhook endpoint is accessible
- **Check:** CORS settings allow backend to POST to frontend
- **Fix:** Verify `{jobId}` is replaced in webhook URL

### Workflow Not Created
- **Check:** Backend logs for `[Draft Workflow Service]` errors
- **Check:** Database permissions
- **Check:** Template creation errors
- **Fix:** Review `draftWorkflowService.ts` error logs

### Navigation Not Working
- **Check:** Browser console for JavaScript errors
- **Check:** `useWorkflowGenerationStatus` hook is polling
- **Check:** Webhook endpoint returns correct data
- **Fix:** Verify polling interval and webhook data structure

### Draft Badge Not Showing
- **Check:** Workflow status in database is `'draft'`
- **Check:** `useWorkflowEdit` hook loads status correctly
- **Check:** TypeScript types include `'draft'` status
- **Fix:** Verify workflow status is set correctly

## Expected API Responses

### 1. Generate Workflow Request
```json
POST /admin/workflows/generate-with-ai
{
  "description": "...",
  "model": "gpt-5",
  "webhook_url": "http://localhost:3000/api/webhooks/workflow-completion/{jobId}"
}

Response:
{
  "job_id": "wfgen_xxx",
  "status": "pending"
}
```

### 2. Check Job Status
```json
GET /admin/workflows/generation-status/{jobId}

Response (pending):
{
  "job_id": "wfgen_xxx",
  "status": "pending"
}

Response (completed):
{
  "job_id": "wfgen_xxx",
  "status": "completed",
  "workflow_id": "wf_xxx",
  "result": { ... }
}
```

### 3. Webhook Completion
```json
POST /api/webhooks/workflow-completion/{jobId}
{
  "job_id": "wfgen_xxx",
  "status": "completed",
  "workflow_id": "wf_xxx",
  "completed_at": "2025-01-14T..."
}

Response:
{
  "success": true,
  "job_id": "wfgen_xxx",
  "workflow_id": "wf_xxx",
  "status": "completed"
}
```

### 4. Get Workflow
```json
GET /admin/workflows/{workflowId}

Response:
{
  "workflow_id": "wf_xxx",
  "workflow_name": "...",
  "status": "draft",
  "steps": [ ... ],
  "template_id": "tmpl_xxx",
  "form": { ... }
}
```

## Success Criteria

✅ Job is created immediately when request is submitted  
✅ Frontend shows "creating" state without waiting  
✅ Backend processes job asynchronously  
✅ Workflow is saved with `status: 'draft'`  
✅ Webhook is sent to frontend when complete  
✅ Frontend receives webhook and stores completion  
✅ Page automatically navigates to edit page  
✅ Draft badge is visible on edit page  
✅ All generated data is present and editable  

## Next Steps After Testing

1. **If all tests pass:**
   - Deploy to staging/production
   - Monitor webhook delivery rates
   - Set up alerts for failed webhooks

2. **If tests fail:**
   - Review error logs
   - Check implementation against this guide
   - Fix issues and re-test

