/**
 * Hook to merge workflow steps with execution steps
 * Extracted from client.tsx for reusability and testability
 */

import { useMemo } from 'react'
import { Job, ExecutionStep, MergedStep, StepStatus } from '@/types'
import { Workflow } from '@/types/workflow'

interface UseMergedStepsParams {
  job: Job | null
  workflow: Workflow | null
}

/**
 * Check if a step has completed (matches logic from components/jobs/utils.ts)
 * A step is considered completed if it has:
 * - output (non-empty)
 * - completed_at timestamp
 * - duration_ms (indicates execution)
 * - artifact_id (has generated artifact)
 * - image_urls (has generated images)
 * - timestamp (execution step was created/executed)
 */
function hasCompleted(step: ExecutionStep | MergedStep): boolean {
  // Check for explicit output
  if (step.output !== null && step.output !== undefined && step.output !== '') {
    return true
  }
  
  // Check for completion timestamp
  if (step.completed_at) {
    return true
  }
  
  // Check for duration (indicates step ran) - this is the most reliable indicator
  if (step.duration_ms !== undefined && step.duration_ms !== null && step.duration_ms > 0) {
    return true
  }
  
  // Check for artifact (output artifact exists)
  if (step.artifact_id) {
    return true
  }
  
  // Check for image URLs (images were generated)
  if (step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0) {
    return true
  }
  
  // Check if step has started and completed timestamps
  if (step.started_at && step.completed_at) {
    return true
  }
  
  // Check for timestamp (execution steps have timestamp when created)
  if ((step as any).timestamp) {
    return true
  }
  
  return false
}

/**
 * Merge workflow steps with execution steps to display all steps in the UI.
 * 
 * This function:
 * - Maps execution steps to workflow steps by step_order
 * - Includes all execution steps (even those not in workflow, like html_generation)
 * - Creates pending steps for workflow steps that haven't executed yet
 * - Enriches execution steps with workflow step metadata
 */
export function useMergedSteps({ job, workflow }: UseMergedStepsParams): MergedStep[] {
  return useMemo(() => {
    if (!job) return []

    const executionSteps = job.execution_steps || []
    const workflowSteps = workflow?.steps || []
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMergedSteps.ts:77',message:'Execution steps summary',data:{executionStepsCount:executionSteps.length,executionStepOrders:executionSteps.map((s:ExecutionStep)=>s.step_order),executionStepTypes:executionSteps.map((s:ExecutionStep)=>s.step_type),executionStepsDetail:executionSteps.map((s:ExecutionStep)=>({step_order:s.step_order,step_type:s.step_type,hasDuration:!!s.duration_ms,hasUsageInfo:!!s.usage_info,hasArtifactId:!!s.artifact_id,hasOutput:!!s.output})),workflowStepsCount:workflowSteps.length,jobStatus:job.status,jobId:job.job_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!workflowSteps || !Array.isArray(workflowSteps) || workflowSteps.length === 0) {
      // Fallback to execution steps if no workflow steps available
      return executionSteps.map((step: ExecutionStep) => ({
        ...step,
        _status: hasCompleted(step) 
          ? 'completed' as const 
          : 'pending' as const
      }))
    }

    const executionStepsMap = new Map<number, ExecutionStep>()
    const mergedStepsMap = new Map<number, MergedStep>()
    
    // Create a map of execution steps by step_order
    executionSteps.forEach((execStep: ExecutionStep) => {
      const order = execStep.step_order
      if (order !== undefined && order !== null) {
        executionStepsMap.set(order, execStep)
      }
    })

    // First, add ALL execution steps to the merged map
    executionSteps.forEach((execStep: ExecutionStep) => {
      const order = execStep.step_order
      if (order !== undefined && order !== null) {
        // Determine step status more accurately using hasCompleted helper
        let stepStatus: StepStatus = 'pending'
        
        if (hasCompleted(execStep)) {
          stepStatus = 'completed'
        } else if (job.status === 'completed') {
          // If job is completed, all execution steps that exist should be marked as completed
          // The job wouldn't have completed if steps failed, so if an execution step exists,
          // it must have completed successfully (even if output is missing or stored elsewhere)
          // Only mark as failed if there's explicit error information
          if (execStep.error) {
            stepStatus = 'failed'
          } else {
            // Job completed successfully, so this step must have completed
            stepStatus = 'completed'
          }
        } else if (job.status === 'processing') {
          // If job is processing and step has not completed, check if it's the current step
          const completedStepsCount = executionSteps.filter((s: ExecutionStep) => 
            s.step_order > 0 && hasCompleted(s)
          ).length
          // If this step comes right after the last completed step, it's in progress
          if (order === completedStepsCount + 1) {
            stepStatus = 'in_progress'
          }
        } else if (job.status === 'failed') {
          // If job failed and step has not completed, it might have failed
          stepStatus = 'failed'
        }
        
        mergedStepsMap.set(order, {
          ...execStep,
          _status: stepStatus,
          // Preserve image_urls from execution step
          image_urls: execStep.image_urls
        })
      }
    })

    // Then, ensure ALL workflow steps are included (both executed and pending)
    workflowSteps.forEach((workflowStep, index: number) => {
      // Workflow steps are 0-indexed, execution steps for workflow steps are 1-indexed
      const executionStepOrder = index + 1
      const existingStep = mergedStepsMap.get(executionStepOrder)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMergedSteps.ts:145',message:'Processing workflow step',data:{workflowStepIndex:index,executionStepOrder,hasExistingStep:!!existingStep,executionStepsCount:executionSteps.length,executionStepForOrder:!!executionStepsMap.get(executionStepOrder),jobStatus:job.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (existingStep) {
        // Step has been executed - enrich with workflow step info
        // Get tools from workflow step, execution step input, or execution step directly
        const mergedTools = workflowStep.tools || existingStep.input?.tools || existingStep.tools || []
        const mergedToolChoice = workflowStep.tool_choice || existingStep.input?.tool_choice || existingStep.tool_choice || 'auto'
        
        mergedStepsMap.set(executionStepOrder, {
          ...existingStep,
          // Set step_type to 'workflow_step' for workflow steps (required for edit icon)
          step_type: 'workflow_step',
          // Override with workflow step info for consistency
          step_name: workflowStep.step_name || existingStep.step_name,
          model: workflowStep.model || existingStep.model,
          tools: mergedTools,
          tool_choice: mergedToolChoice,
          instructions: workflowStep.instructions || existingStep.instructions,
          // Ensure input object is properly populated
          input: {
            ...existingStep.input,
            tools: mergedTools,
            tool_choice: mergedToolChoice,
          },
          // Preserve execution step fields: duration_ms, usage_info, started_at, completed_at, output, error, artifact_id, image_urls
          duration_ms: existingStep.duration_ms,
          usage_info: existingStep.usage_info,
          started_at: existingStep.started_at,
          completed_at: existingStep.completed_at,
          output: existingStep.output,
          error: existingStep.error,
          artifact_id: existingStep.artifact_id,
          image_urls: existingStep.image_urls
        })
      } else {
        // Step hasn't been executed yet - check if it's currently executing
        const isJobProcessing = job.status === 'processing'
        
        // Count completed workflow steps using hasCompleted helper
        const completedWorkflowStepsCount = executionSteps.filter((s: ExecutionStep) => 
          s.step_order > 0 && 
          s.step_order <= workflowSteps.length &&
          (s.step_type === 'ai_generation' || s.step_type === 'workflow_step') &&
          hasCompleted(s)
        ).length
        
        // Check if there's an execution step for this order that's currently executing (exists but not completed)
        const executingStep = executionSteps.find((s: ExecutionStep) => 
          s.step_order === executionStepOrder &&
          (s.step_type === 'ai_generation' || s.step_type === 'workflow_step') &&
          !hasCompleted(s)
        )
        
        // Determine if this is the current step being executed
        const isCurrentStep = isJobProcessing && (
          executingStep !== undefined || // Step exists but has no output (currently executing)
          executionStepOrder === completedWorkflowStepsCount + 1 // Next step to execute
        )
        
        // If step exists but has no output, use its data; otherwise create new pending step
        if (executingStep) {
          // Get tools from workflow step, execution step input, or execution step directly
          const mergedTools = workflowStep.tools || executingStep.input?.tools || executingStep.tools || []
          const mergedToolChoice = workflowStep.tool_choice || executingStep.input?.tool_choice || executingStep.tool_choice || 'auto'
          
          mergedStepsMap.set(executionStepOrder, {
            ...executingStep,
            // Set step_type to 'workflow_step' for workflow steps (required for edit icon)
            step_type: 'workflow_step',
            step_name: workflowStep.step_name || executingStep.step_name,
            model: workflowStep.model || executingStep.model,
            tools: mergedTools,
            tool_choice: mergedToolChoice,
            instructions: workflowStep.instructions || executingStep.instructions,
            // Ensure input object is properly populated
            input: {
              ...executingStep.input,
              tools: mergedTools,
              tool_choice: mergedToolChoice,
            },
            // Preserve execution step fields
            duration_ms: executingStep.duration_ms,
            usage_info: executingStep.usage_info,
            started_at: executingStep.started_at,
            completed_at: executingStep.completed_at,
            output: executingStep.output,
            error: executingStep.error,
            artifact_id: executingStep.artifact_id,
            image_urls: executingStep.image_urls,
            _status: 'in_progress' as const,
          })
        } else {
          // Step hasn't been executed yet - check if there's an execution step we can use
          // Even if it doesn't have output, it might have duration_ms, usage_info, artifact_id, etc.
          const executionStepForOrder = executionStepsMap.get(executionStepOrder)
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMergedSteps.ts:239',message:'No existing step, checking execution step',data:{executionStepOrder,hasExecutionStep:!!executionStepForOrder,executionStepHasDuration:!!executionStepForOrder?.duration_ms,executionStepHasUsageInfo:!!executionStepForOrder?.usage_info,executionStepHasArtifactId:!!executionStepForOrder?.artifact_id,executionStepHasOutput:!!executionStepForOrder?.output,jobStatus:job.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Determine status
          let stepStatus: StepStatus = 'pending'
          
          // If job is completed, all workflow steps should be marked as completed
          // (the job wouldn't have completed if steps failed)
          if (job.status === 'completed') {
            stepStatus = 'completed'
          } else if (isCurrentStep) {
            stepStatus = 'in_progress'
          }
          
          // If we found an execution step for this order, use its data (duration, cost, artifacts, etc.)
          if (executionStepForOrder) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMergedSteps.ts:239',message:'Using execution step data',data:{executionStepOrder,duration_ms:executionStepForOrder.duration_ms,hasUsageInfo:!!executionStepForOrder.usage_info,cost_usd:executionStepForOrder.usage_info?.cost_usd,artifact_id:executionStepForOrder.artifact_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            const mergedTools = workflowStep.tools || executionStepForOrder.input?.tools || executionStepForOrder.tools || []
            const mergedToolChoice = workflowStep.tool_choice || executionStepForOrder.input?.tool_choice || executionStepForOrder.tool_choice || 'auto'
            
            mergedStepsMap.set(executionStepOrder, {
              ...executionStepForOrder,
              step_type: 'workflow_step',
              step_name: workflowStep.step_name || executionStepForOrder.step_name,
              model: workflowStep.model || executionStepForOrder.model,
              tools: mergedTools,
              tool_choice: mergedToolChoice,
              instructions: workflowStep.instructions || executionStepForOrder.instructions,
              input: {
                ...executionStepForOrder.input,
                tools: mergedTools,
                tool_choice: mergedToolChoice,
              },
              // Preserve all execution step fields (duration_ms, usage_info, artifact_id, etc.)
              duration_ms: executionStepForOrder.duration_ms,
              usage_info: executionStepForOrder.usage_info,
              started_at: executionStepForOrder.started_at,
              completed_at: executionStepForOrder.completed_at,
              output: executionStepForOrder.output,
              error: executionStepForOrder.error,
              artifact_id: executionStepForOrder.artifact_id,
              image_urls: executionStepForOrder.image_urls,
              _status: stepStatus,
            })
          } else {
            // No execution step found - create new step with workflow step data only
            mergedStepsMap.set(executionStepOrder, {
              step_name: workflowStep.step_name,
              step_order: executionStepOrder,
              step_type: 'workflow_step',
              model: workflowStep.model,
              tools: workflowStep.tools || [],
              tool_choice: workflowStep.tool_choice || 'auto',
              instructions: workflowStep.instructions,
              input: {
                tools: workflowStep.tools || [],
                tool_choice: workflowStep.tool_choice || 'auto',
              },
              output: null,
              _status: stepStatus,
            })
          }
        }
      }
    })

    // Also include any execution steps that don't map to workflow steps (like form_submission, html_generation, final_output)
    // Only add if they're not already in the map (to avoid overwriting enriched workflow steps)
    executionSteps.forEach((execStep: ExecutionStep) => {
      const order = execStep.step_order
      if (order !== undefined && order !== null && !mergedStepsMap.has(order)) {
        // If it's not a workflow step (step_order > workflowSteps.length or step_order === 0), ensure it's included
        if (order === 0 || order > workflowSteps.length || 
            (execStep.step_type !== 'ai_generation' && execStep.step_type !== 'workflow_step')) {
          mergedStepsMap.set(order, {
            ...execStep,
            _status: execStep.output !== null && execStep.output !== undefined && execStep.output !== '' 
              ? 'completed' as const 
              : 'pending' as const
          })
        }
      }
    })

    // Convert map to array and sort by step_order
    return Array.from(mergedStepsMap.values()).sort((a: MergedStep, b: MergedStep) => (a.step_order || 0) - (b.step_order || 0))
  }, [job, workflow])
}

