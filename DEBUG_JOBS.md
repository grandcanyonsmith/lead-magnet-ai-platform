# Local Job Debugging Guide

This guide explains how to debug job processing locally to investigate why jobs stop after step 3.

## Problem

Jobs are completing after step 3 (image generation) instead of continuing to steps 4-7, even though the workflow defines all the steps.

## Local Debugging Setup

### Method 1: Direct Python Script (Recommended)

Run the Python worker directly with full debug output:

```bash
cd backend/worker
python3 test_local.py <job_id>
```

**Example:**
```bash
cd backend/worker
python3 test_local.py job_01K9TR7WXEC3X17YA4MNBSMQ9S
```

**What this does:**
- Runs the job processor locally with DEBUG-level logging
- Shows you exactly which steps are being processed
- Displays full error messages if any step fails
- Shows execution time and costs for each step

### Method 2: Get a Job ID from the UI

1. Go to the **Generated Lead Magnets** page in your dashboard
2. Find a job that stopped at step 3 (Status: "Ready" with "Step 3/3" or "Step 3/6")
3. Click on the job to view its details
4. Copy the Job ID from the URL (e.g., `job_01K9TR7WXEC3X17YA4MNBSMQ9S`)

### Method 3: Create a Fresh Test Job

1. Go to **Workflows** and select one of your workflows
2. Click **Test Workflow**
3. Fill in the form and submit
4. Copy the Job ID from the resulting page
5. Run the local debugger with that Job ID

## What to Look For

When you run the local debugger, watch for:

1. **Total Steps Defined**: Should match your workflow (e.g., 6 or 7 steps)
2. **Processing Messages**: You should see "Processing step X/Y" for each step
3. **Errors**: Any exceptions or error messages that appear
4. **Where it Stops**: Note which step number is the last one processed

## Common Issues and Solutions

### Issue 1: Job Stops After Step 3 with No Error

**Symptom:** Local debugger shows all steps defined but only processes 1-3
**Likely Cause:** AWS Lambda timeout or Step Functions configuration issue
**Solution:** Check CloudWatch logs for the actual Lambda execution

### Issue 2: Error During Step 3 (Image Generation)

**Symptom:** Error message mentioning image generation or OpenAI API
**Likely Cause:** API rate limits, timeout, or image generation failure
**Solution:** Check the error message for specific API errors

### Issue 3: "Workflow has no steps"

**Symptom:** Debugger shows "Total Steps Defined: 0"
**Likely Cause:** Workflow definition is corrupted or missing
**Solution:** Edit the workflow in the UI and re-save it

## Interpreting the Output

### Successful Processing

```
Workflow: Creator CoBrand
Total Steps Defined: 7

Workflow Steps:
  1. Creator Discovery & Assets (model: gpt-5)
  2. Enhanced Website Brand Kit (model: gpt-5)
  3. Style-Matched Visuals (model: gpt-5)
  4. Enhanced Market Research Report (model: gpt-4o)
  5. Landing Page Copy (model: gpt-5)
  6. Landing Page HTML (model: gpt-5)
  7. Delivery Email + Confirmation Page (model: gpt-4o)

Processing step 1/7...
✅ Step 1 completed in 12.3s
Processing step 2/7...
✅ Step 2 completed in 8.7s
...
✅ Job completed successfully!
```

### Failed Processing

```
Processing step 3/7...
❌ FATAL ERROR: OpenAI API rate limit exceeded
Error Type: RateLimitError
Traceback:
  ... detailed stack trace ...
```

## Next Steps

After running the local debugger:

1. **If all steps complete successfully locally:**
   - The issue is with AWS Lambda/Step Functions configuration
   - Check AWS CloudWatch logs
   - May need to increase Lambda timeout or memory

2. **If you see an error:**
   - Copy the full error message
   - Check if it's an API limit, timeout, or other issue
   - Share the error for further debugging

3. **If steps are missing from the workflow:**
   - Go to the workflow in the UI
   - Re-add the missing steps
   - Save and test again

## Advanced: Checking Python Dependencies

If you get import errors, ensure Python dependencies are installed:

```bash
cd backend/worker
pip install -r requirements.txt
```

## Environment Variables

The local debugger uses the same environment variables as the deployed version:

- `OPENAI_API_KEY` - Must be set (already configured in Replit)
- `DYNAMODB_TABLE_PREFIX` - Defaults to 'leadmagnet-'
- `AWS_REGION` - Defaults to 'us-east-1'
- `S3_ARTIFACTS_BUCKET` - For artifact storage

These are automatically available in your Replit environment.

## Contact

If you continue to have issues:
1. Share the full output from the local debugger
2. Include the workflow definition (copy from the UI)
3. Note which step it stops at and any error messages
