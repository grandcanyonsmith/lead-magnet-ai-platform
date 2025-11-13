/**
 * Hook to merge workflow steps with execution steps
 * Extracted from page-client.tsx for reusability and testability
 */

import { useMemo } from 'react'
import { Job, ExecutionStep, MergedStep, StepStatus } from '@/types'
import { Workflow } from '@/types/workflow'

interface UseMergedStepsParams {
  job: Job | null
  workflow: Workflow | null
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
    
    if (!workflowSteps || !Array.isArray(workflowSteps) || workflowSteps.length === 0) {
      // Fallback to execution steps if no workflow steps available
      return executionSteps.map((step: ExecutionStep) => ({
        ...step,
        _status: (step.output !== null && step.output !== undefined && step.output !== '') 
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
        // Determine step status more accurately
        let stepStatus: StepStatus = 'pending'
        
        if (execStep.output !== null && execStep.output !== undefined && execStep.output !== '') {
          stepStatus = 'completed'
        } else if (job.status === 'processing') {
          // If job is processing and step has no output, check if it's the current step
          const completedStepsCount = executionSteps.filter((s: ExecutionStep) => 
            s.step_order > 0 && 
            s.output !== null && 
            s.output !== undefined && 
            s.output !== ''
          ).length
          // If this step comes right after the last completed step, it's in progress
          if (order === completedStepsCount + 1) {
            stepStatus = 'in_progress'
          }
        } else if (job.status === 'failed') {
          // If job failed and step has no output, it might have failed
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
      
      if (existingStep) {
        // Step has been executed - enrich with workflow step info
        mergedStepsMap.set(executionStepOrder, {
          ...existingStep,
          // Override with workflow step info for consistency
          step_name: workflowStep.step_name || existingStep.step_name,
          model: workflowStep.model || existingStep.model,
          tools: workflowStep.tools || existingStep.input?.tools || existingStep.tools,
          tool_choice: workflowStep.tool_choice || existingStep.input?.tool_choice || existingStep.tool_choice,
          // Preserve image_urls from execution step
          image_urls: existingStep.image_urls
        })
      } else {
        // Step hasn't been executed yet - check if it's currently executing
        const isJobProcessing = job.status === 'processing'
        
        // Count completed workflow steps (have output)
        const completedWorkflowStepsCount = executionSteps.filter((s: ExecutionStep) => 
          s.step_order > 0 && 
          s.step_order <= workflowSteps.length &&
          (s.step_type === 'ai_generation' || s.step_type === 'workflow_step') &&
          s.output !== null && 
          s.output !== undefined && 
          s.output !== ''
        ).length
        
        // Check if there's an execution step for this order that's currently executing (exists but no output)
        const executingStep = executionSteps.find((s: ExecutionStep) => 
          s.step_order === executionStepOrder &&
          (s.step_type === 'ai_generation' || s.step_type === 'workflow_step') &&
          (s.output === null || s.output === undefined || s.output === '')
        )
        
        // Determine if this is the current step being executed
        const isCurrentStep = isJobProcessing && (
          executingStep !== undefined || // Step exists but has no output (currently executing)
          executionStepOrder === completedWorkflowStepsCount + 1 // Next step to execute
        )
        
        // If step exists but has no output, use its data; otherwise create new pending step
        if (executingStep) {
          mergedStepsMap.set(executionStepOrder, {
            ...executingStep,
            step_name: workflowStep.step_name || executingStep.step_name,
            model: workflowStep.model || executingStep.model,
            tools: workflowStep.tools || executingStep.tools || [],
            tool_choice: workflowStep.tool_choice || executingStep.tool_choice || 'auto',
            _status: 'in_progress' as const,
          })
        } else {
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
            _status: isCurrentStep ? 'in_progress' as const : 'pending' as const,
          })
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

