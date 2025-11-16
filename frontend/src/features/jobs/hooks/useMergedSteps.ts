/**
 * Hook to merge workflow steps with execution steps
 * 
 * This hook combines workflow template steps with actual execution steps to create
 * a unified view that shows both executed and pending steps. It handles:
 * - Mapping execution steps to workflow steps by step_order
 * - Including all execution steps (even those not in workflow, like html_generation)
 * - Creating pending steps for workflow steps that haven't executed yet
 * - Enriching execution steps with workflow step metadata
 * 
 * Extracted from page-client.tsx for reusability and testability
 */

import { useMemo } from 'react'
import { Job, ExecutionStep, MergedStep, StepStatus } from '@/shared/types'
import { Workflow, WorkflowStep } from '@/features/workflows/types'

interface UseMergedStepsParams {
  job: Job | null
  workflow: Workflow | null
  rerunningStep?: number | null
}

/**
 * Determine step status based on job status and step output
 * 
 * Status determination logic:
 * - 'completed': Step has output
 * - 'in_progress': Job is processing and this is the next step to execute, OR step is being rerun
 * - 'failed': Job failed and step has no output
 * - 'pending': Default state
 * 
 * @param execStep - Execution step to determine status for
 * @param job - Job containing status information
 * @param executionSteps - All execution steps for context
 * @param rerunningStep - Zero-based index of step being rerun (optional)
 * @returns Step status
 */
function determineStepStatus(
  execStep: ExecutionStep,
  job: Job,
  executionSteps: ExecutionStep[],
  rerunningStep?: number | null
): StepStatus {
  // Check if this step is being rerun (Bug 2.1, 2.3 fix)
  const stepOrder = execStep.step_order ?? 0
  const isBeingRerun = rerunningStep !== null && rerunningStep !== undefined && stepOrder > 0 && rerunningStep === stepOrder - 1
  
  // If step is being rerun, show as in_progress (Bug 2.1, 2.3 fix)
  if (isBeingRerun) {
    return 'in_progress'
  }

  if (execStep.output !== null && execStep.output !== undefined && execStep.output !== '') {
    return 'completed'
  }
  
  if (job.status === 'processing') {
    const completedStepsCount = executionSteps.filter((s: ExecutionStep) => 
      s.step_order > 0 && 
      s.output !== null && 
      s.output !== undefined && 
      s.output !== ''
    ).length
    // If this step comes right after the last completed step, it's in progress
    if (execStep.step_order === completedStepsCount + 1) {
      return 'in_progress'
    }
  }
  
  if (job.status === 'failed') {
    return 'failed'
  }
  
  return 'pending'
}

/**
 * Count completed workflow steps (steps with output)
 * 
 * Filters execution steps to count only workflow-related steps that have completed.
 * Used to determine which step is currently executing.
 * 
 * @param executionSteps - All execution steps
 * @param workflowStepsLength - Number of workflow steps
 * @returns Count of completed workflow steps
 */
function countCompletedWorkflowSteps(
  executionSteps: ExecutionStep[],
  workflowStepsLength: number
): number {
  return executionSteps.filter((s: ExecutionStep) => 
    s.step_order > 0 && 
    s.step_order <= workflowStepsLength &&
    (s.step_type === 'ai_generation' || s.step_type === 'workflow_step') &&
    s.output !== null && 
    s.output !== undefined && 
    s.output !== ''
  ).length
}

/**
 * Merge tools and tool_choice with priority: workflow step > execution step input > execution step
 * 
 * Ensures consistent tool configuration by preferring workflow template values,
 * falling back to execution step values if workflow values are not available.
 * 
 * @param workflowStep - Workflow step template
 * @param execStep - Optional execution step for fallback values
 * @returns Merged tools array and tool_choice string
 */
function mergeToolsAndChoice(
  workflowStep: WorkflowStep,
  execStep?: ExecutionStep
): { tools: unknown[], tool_choice: string } {
  const tools = workflowStep.tools || execStep?.input?.tools || execStep?.tools || []
  const toolChoice = workflowStep.tool_choice || execStep?.input?.tool_choice || execStep?.tool_choice || 'auto'
  return { tools, tool_choice: toolChoice }
}

/**
 * Enrich execution step with workflow step metadata
 * 
 * Combines execution step data (output, timing, usage) with workflow step
 * configuration (name, model, instructions, tools) to create a complete merged step.
 * Preserves all execution step fields while overriding with workflow template values.
 * 
 * @param execStep - Execution step with runtime data
 * @param workflowStep - Workflow step template with configuration
 * @returns Merged step with both execution and workflow data
 */
function enrichExecutionStepWithWorkflow(
  execStep: ExecutionStep,
  workflowStep: WorkflowStep
): MergedStep {
  const { tools, tool_choice } = mergeToolsAndChoice(workflowStep, execStep)
  
  return {
    ...execStep,
    step_type: 'workflow_step',
    step_name: workflowStep.step_name || execStep.step_name,
    model: workflowStep.model || execStep.model,
    tools,
    tool_choice,
    instructions: workflowStep.instructions || execStep.instructions,
    input: {
      ...execStep.input,
      tools,
      tool_choice,
    },
    // Preserve execution step fields
    duration_ms: execStep.duration_ms,
    usage_info: execStep.usage_info,
    started_at: execStep.started_at,
    completed_at: execStep.completed_at,
    output: execStep.output,
    error: execStep.error,
    artifact_id: execStep.artifact_id,
    image_urls: execStep.image_urls,
    _status: execStep._status || 'pending',
  }
}

/**
 * Create a pending step from workflow step template
 * 
 * Creates a step object for workflow steps that haven't executed yet.
 * Status is set to 'in_progress' if this is the current step being executed,
 * otherwise 'pending'.
 * 
 * @param workflowStep - Workflow step template
 * @param executionStepOrder - Step order (1-indexed for execution steps)
 * @param isCurrentStep - Whether this is the step currently being executed
 * @returns Pending merged step
 */
function createPendingStep(
  workflowStep: WorkflowStep,
  executionStepOrder: number,
  isCurrentStep: boolean
): MergedStep {
  const { tools, tool_choice } = mergeToolsAndChoice(workflowStep)
  
  return {
    step_name: workflowStep.step_name,
    step_order: executionStepOrder,
    step_type: 'workflow_step',
    model: workflowStep.model,
    tools,
    tool_choice,
    instructions: workflowStep.instructions,
    input: {
      tools,
      tool_choice,
    },
    output: null,
    _status: isCurrentStep ? 'in_progress' : 'pending',
  }
}

/**
 * Hook to merge workflow steps with execution steps
 * 
 * Algorithm:
 * 1. Add all execution steps to merged map with status determination
 * 2. For each workflow step:
 *    - If executed: enrich execution step with workflow metadata
 *    - If not executed: create pending step or use executing step data
 * 3. Include non-workflow execution steps (form_submission, html_generation, etc.)
 * 4. Sort by step_order and return as array
 * 
 * @param params - Job and workflow data
 * @returns Array of merged steps sorted by step_order
 */
export function useMergedSteps({ job, workflow, rerunningStep }: UseMergedStepsParams): MergedStep[] {
  return useMemo(() => {
    if (!job) return []

    const executionSteps = job.execution_steps || []
    const workflowSteps = workflow?.steps || []
    
    if (!workflowSteps || !Array.isArray(workflowSteps) || workflowSteps.length === 0) {
      // Fallback to execution steps if no workflow steps available
      return executionSteps.map((step: ExecutionStep) => {
        const stepOrder = step.step_order ?? 0
        const isBeingRerun = rerunningStep !== null && rerunningStep !== undefined && stepOrder > 0 && rerunningStep === stepOrder - 1
        return {
          ...step,
          _status: isBeingRerun 
            ? 'in_progress' as const
            : (step.output !== null && step.output !== undefined && step.output !== '') 
              ? 'completed' as const 
              : 'pending' as const
        }
      })
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
        const stepStatus = determineStepStatus(execStep, job, executionSteps, rerunningStep)
        
        mergedStepsMap.set(order, {
          ...execStep,
          _status: stepStatus,
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
        mergedStepsMap.set(executionStepOrder, enrichExecutionStepWithWorkflow(existingStep, workflowStep))
      } else {
        // Step hasn't been executed yet - check if it's currently executing
        const isJobProcessing = job.status === 'processing'
        const completedWorkflowStepsCount = countCompletedWorkflowSteps(executionSteps, workflowSteps.length)
        
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
          const enriched = enrichExecutionStepWithWorkflow(executingStep, workflowStep)
          mergedStepsMap.set(executionStepOrder, {
            ...enriched,
            _status: 'in_progress' as const,
          })
        } else {
          mergedStepsMap.set(executionStepOrder, createPendingStep(workflowStep, executionStepOrder, isCurrentStep))
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
  }, [job, workflow, rerunningStep])
}

