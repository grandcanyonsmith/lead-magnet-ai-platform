# Backend Execution Steps Storage Bug

## Issue Summary

Execution steps for workflow steps 2-9 are not being saved to S3, even though the job completes successfully. Only the final `html_generation` step is saved.

## Evidence

From frontend logs (`/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log`):

- **Line 191**: API returns only 1 execution step:
  - `executionStepsCount: 1`
  - `executionStepOrders: [1]`
  - `executionStepTypes: ["html_generation"]`
  - S3 key exists: `"cust_84c8e438/jobs/job_01KC7H6XD8D8J5WMRWSK198F1Y/execution_steps.json"`

- **Line 192**: The single execution step has:
  - `step_order: 1`
  - `step_type: "html_generation"`
  - `hasDuration: true`
  - `hasUsageInfo: true`
  - `hasArtifactId: false`
  - `hasOutput: true`

- **Lines 194-209**: Steps 2-9 have no execution step data:
  - `hasExecutionStep: false` for all steps 2-9
  - No duration, usage info, artifact_id, or output

## Root Cause

**FIXED**: The bug was in `backend/worker/services/job_completion_service.py`. When HTML generation and job finalization occurred, the `execution_steps` list passed as a parameter was not reloaded from S3 before appending new steps. This meant that if the list was stale or incomplete, saving it would overwrite the S3 file and lose workflow steps that were previously saved.

**The Fix**: Added code to reload `execution_steps` from S3 before:
1. Appending the HTML generation step (`generate_html_from_accumulated_context`)
2. Finalizing the job (`finalize_job`)

This ensures that all workflow steps saved during step processing are included before saving the final execution_steps list.

## Impact

- **Frontend**: Steps 2-9 show as "completed" (based on job status) but display no duration, cost, or artifacts
- **Data Loss**: Execution step metadata (duration, usage_info, artifact_id) for steps 2-9 is permanently lost for existing jobs
- **User Experience**: Users cannot see runtime details for most workflow steps

## Files to Investigate

1. `backend/worker/services/execution_step_manager.py` - Manages execution step creation and storage
2. `backend/worker/services/step_processor.py` - Processes individual workflow steps
3. `backend/worker/services/workflow_orchestrator.py` - Orchestrates workflow execution
4. `backend/worker/db_service.py` - Handles S3 storage of execution steps (lines 148-207)

## Expected Behavior

When a workflow step executes:
1. An execution step record should be created with:
   - `step_order` (1-indexed, matching workflow step index + 1)
   - `step_type: "workflow_step"` or `"ai_generation"` (depending on step type)
   - `duration_ms`
   - `usage_info` (with `cost_usd`, `total_tokens`, etc.)
   - `artifact_id` (if step produced an artifact)
   - `output`
   - `started_at` and `completed_at` timestamps

2. The execution step should be added to the `execution_steps` array
3. The entire `execution_steps` array should be saved to S3 via `db_service.update_job()`

## Current Behavior

Only the final `html_generation` step (step_order: 1) is being saved. Workflow steps 2-9 are executed but their execution step records are not persisted.

## Fix Applied

**Files**: 
1. `backend/worker/services/job_completion_service.py`
2. `backend/worker/services/step_processor.py`

**Changes**:
1. **job_completion_service.py**:
   - Added execution_steps reload from S3 in `generate_html_from_accumulated_context()` before appending HTML generation step
   - Added execution_steps reload from S3 in `finalize_job()` before saving final execution_steps

2. **step_processor.py**:
   - Added execution_steps reload from S3 in `process_step_batch_mode()` before processing each AI generation step
   - Added execution_steps reload from S3 in `_process_webhook_step_batch_mode()` before processing each webhook step

**Why This Fixes It**: 
- Each workflow step correctly saves its execution step to S3 during processing
- However, the `execution_steps` list passed between steps could become stale
- When a step saves its execution_steps list to S3, it overwrites the entire file
- If the list is stale (missing previous steps), it would overwrite S3 and lose those steps
- Now, we reload from S3 before processing each step and before HTML generation/finalization, ensuring all steps are preserved

## Next Steps

1. **Deploy Backend Fix**: Deploy the updated `job_completion_service.py` to production
2. **Test**: Run a new job with multiple workflow steps and verify all execution steps are saved
3. **Existing Jobs**: Jobs that already completed will still have missing execution steps (data loss is permanent for those jobs)
4. **Frontend**: No changes needed - frontend will automatically display execution step data once backend saves it correctly
