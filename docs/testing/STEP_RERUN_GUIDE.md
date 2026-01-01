# Testing Step Rerun Functionality

This guide explains how to test the step rerun feature to ensure that rerunning a step only processes that specific step (not the entire workflow) while preserving previous steps' context.

## Overview

When rerunning a step, the system should:
1. ✅ Process **only** the specified step (not all steps from the beginning)
2. ✅ Include previous steps' outputs as context for the rerun step
3. ✅ Finalize the job correctly after processing the single step
4. ✅ Preserve all other execution steps unchanged

## Prerequisites

1. **Infrastructure Deployed**: The Step Functions state machine must be deployed with the latest changes
2. **Completed Job**: You need a job that has completed successfully with multiple steps
3. **AWS Credentials**: Configured AWS CLI credentials with access to:
   - DynamoDB (leadmagnet-jobs, leadmagnet-workflows tables)
   - Step Functions (leadmagnet-job-processor state machine)
   - CloudWatch Logs (for debugging)

## Testing Steps

### Step 1: Deploy Updated Infrastructure

First, deploy the updated Step Functions state machine:

```bash
cd infrastructure
npm run build  # Verify TypeScript compiles
cdk diff       # Review changes
cdk deploy leadmagnet-compute  # Deploy the compute stack with Step Functions
```

### Step 2: Find or Create a Test Job

You need a completed job with multiple steps. You can:

**Option A: Use an existing completed job**
1. Go to the dashboard and find a completed job
2. Note the Job ID (e.g., `job_01K9TR7WXEC3X17YA4MNBSMQ9S`)
3. Verify it has multiple steps completed

**Option B: Create a new test job**
1. Submit a form through the UI
2. Wait for the job to complete
3. Note the Job ID

### Step 3: Run the Test Script

Use the provided test script to verify step rerun functionality:

```bash
cd scripts/testing
python3 test-step-rerun.py <job_id> <step_index> [tenant_id]
```

**Example:**
```bash
python3 test-step-rerun.py job_01K9TR7WXEC3X17YA4MNBSMQ9S 2
```

This will:
- Get the initial job state
- Call the rerun API for the specified step
- Monitor the Step Functions execution
- Verify that only that step was processed
- Check that previous steps' context is preserved
- Verify the job is finalized correctly

### Step 4: Manual Testing via API

You can also test manually using the API:

**Get an API token** (if needed):
```bash
# Get tenant ID and API token from your environment
export TENANT_ID="your-tenant-id"
export API_TOKEN="your-api-token"
```

**Call the rerun endpoint:**
```bash
curl -X POST "https://your-api-url/admin/jobs/<job_id>/rerun-step" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"step_index": 2}'
```

### Step 5: Verify Results

After running the rerun, verify:

1. **Step Functions Execution**: Check the Step Functions console
   - The execution should go through: `UpdateJobStatus` → `CheckAction` → `ProcessStep` → `CheckStepResultSingleStep` → `FinalizeJob`
   - It should **NOT** go through: `InitializeSteps` → `ComputeStepsLength` → `ResolveDependencies` → `SetupStepLoop`

2. **Job State**: Check DynamoDB or the UI
   - Job status should be `completed`
   - Only the rerun step should have an updated timestamp
   - Previous steps should remain unchanged
   - Execution steps count should be the same (replacing, not adding)

3. **Step Output**: Verify the rerun step output
   - The step output should reflect the rerun (may be different from original)
   - Previous steps' outputs should be included in the context

## Expected Behavior

### ✅ Correct Behavior (What Should Happen)

1. **Single Step Processing**: Only the specified step is processed
2. **Context Preservation**: Previous steps' outputs are included as context
3. **Job Finalization**: Job is finalized immediately after the step completes
4. **No Re-execution**: Other steps are not re-executed

### ❌ Incorrect Behavior (What Should NOT Happen)

1. **Full Workflow Re-execution**: All steps starting from step 0 are processed
2. **Missing Context**: Previous steps' outputs are not included
3. **No Finalization**: Job remains in `processing` status
4. **Step Duplication**: New execution steps are added instead of replacing

## Debugging

If the test fails, check:

1. **Step Functions Execution History**:
   ```bash
   aws stepfunctions describe-execution --execution-arn <execution_arn>
   aws stepfunctions get-execution-history --execution-arn <execution_arn>
   ```

2. **CloudWatch Logs**: Check Lambda function logs for the worker
   - Look for logs indicating which step is being processed
   - Verify context building includes previous steps

3. **DynamoDB Job Record**: Check the job's `execution_steps` array
   - Verify only the rerun step was updated
   - Check timestamps to confirm which step was rerun

4. **State Machine Definition**: Verify the state machine was deployed correctly
   ```bash
   cd infrastructure
   cdk synth
   # Check cdk.out/ for the generated CloudFormation template
   ```

## Test Script Output

The test script provides detailed output:

```
================================================================================
Test: Step Rerun Functionality
================================================================================
Job ID: job_01K9TR7WXEC3X17YA4MNBSMQ9S
Step Index: 2

Step 1: Getting initial job state...
✅ Job found: completed
   Initial execution steps: 5
   Workflow ID: workflow_xxx

Step 2: Checking step 2...
✅ Step 2 found: Step Name

Step 3: Calling rerun API for step 2...
✅ Started Step Functions execution for step rerun
   Execution ARN: arn:aws:states:...

Step 4: Waiting for step rerun to complete...
   (This may take 30-60 seconds)
✅ Step Functions execution completed: SUCCEEDED

Step 5: Checking execution history...
   Lambda invocations: 1

Step 6: Checking final job state...
✅ Final job status: completed
   Final execution steps: 5

Step 7: Verifying results...
✅ Job is completed
✅ Found rerun step: Step Name
   Step order: 3
   Step type: ai_generation
✅ Previous steps preserved: 2 steps
✅ Execution went through CheckAction (single-step path)

================================================================================
✅ TEST PASSED: Step rerun functionality works correctly
================================================================================
```

## Troubleshooting

### Issue: Test script can't find Step Functions execution

**Solution**: Make sure the Step Functions ARN is configured correctly:
```bash
# Check environment variables
echo $STEP_FUNCTIONS_ARN

# Or check config.py
grep STEP_FUNCTIONS_ARN config.py
```

### Issue: Step Functions execution goes through full workflow

**Solution**: Verify the state machine was deployed with the latest changes:
```bash
cd infrastructure
cdk diff  # Should show changes to CheckAction state
cdk deploy leadmagnet-compute
```

### Issue: Previous steps' context not included

**Solution**: This is handled by the worker code. Check:
- `backend/worker/services/step_processor.py` - `process_single_step` method
- `backend/worker/services/context_builder.py` - context building logic
- Verify `execution_steps` are loaded from the job before processing

## Next Steps

After successful testing:
1. ✅ Verify the fix works in production
2. ✅ Monitor for any edge cases
3. ✅ Update documentation if needed
4. ✅ Consider adding automated tests to CI/CD pipeline
