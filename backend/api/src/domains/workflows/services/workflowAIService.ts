import OpenAI from 'openai';
import { WorkflowStep, ensureStepDefaults } from './workflow/workflowConfigSupport';
import { validateDependencies } from '@utils/dependencyResolver';
import { logger } from '@utils/logger';
import { stripMarkdownCodeFences } from '@utils/openaiHelpers';

export interface WorkflowAIEditRequest {
  userPrompt: string;
  workflowContext: {
    workflow_id: string;
    workflow_name: string;
    workflow_description: string;
    template_id?: string;
    current_steps: WorkflowStep[];
  };
  // Context from the current job being analyzed
  executionHistory?: {
    submissionData?: any;
    stepExecutionResults?: any[]; // Full or summarized step outputs
    finalArtifactSummary?: string;
  };
  // Context from other successful jobs (few-shot learning)
  referenceExamples?: Array<{
    jobId: string;
    submissionData: any;
    finalArtifactSummary: string;
  }>;
}

export interface WorkflowAIEditResponse {
  workflow_name?: string;
  workflow_description?: string;
  steps: WorkflowStep[];
  changes_summary: string;
}

const AVAILABLE_MODELS = [
  'gpt-5.2',
];

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const WORKFLOW_AI_SYSTEM_PROMPT = `You are an expert AI Lead Magnet Architect and Workflow Optimizer. Your task is to refine, restructure, and optimize the user's lead magnet generation workflow.

## Your Goal
Translate the user's natural language request into a precise, optimized JSON configuration. You should not just make the change, but *improve* the workflow where possible while respecting the user's intent.

## Available Models
${AVAILABLE_MODELS.join(', ')}

## Available Tools
- **web_search**: Essential for research, verification, and gathering live data.
- **code_interpreter**: For data analysis, complex math, or file processing.
- **image_generation**: For creating custom visuals.
- **shell**: For advanced system operations (use sparingly).

## Modification Guidelines

1. **Understand Intent**:
   - "Make it better" -> Improve instructions, ensure all steps use GPT-5.2, add research steps.
   - "Fix the error" -> Analyze the execution history (if provided) and adjust instructions or tools.
   - "Add X" -> Insert the step logically, updating \`depends_on\` for subsequent steps.

2. **Optimize Quality**:
   - Upgrade vague instructions to be specific and persona-driven.
   - Ensure \`gpt-5.2\` is used for high-value creation steps.
   - Ensure \`web_search\` is enabled for research steps.

3. **Manage Dependencies**:
   - \`depends_on\` is CRITICAL.
   - If adding a step at index 0, shift all other indices in \`depends_on\` arrays.
   - Ensure the flow is logical: Research -> Analysis -> Creation -> Formatting.

## Response Format
Return a JSON object:
{
  "workflow_name": string (optional update),
  "workflow_description": string (optional update),
  "steps": [
    {
      "step_name": string,
      "step_description": string,
      "model": string,
      "instructions": string,
      "tools": string[],
      "tool_choice": "auto" | "required" | "none",
      "depends_on": number[]
    }
  ],
  "changes_summary": string (Clear, professional summary of what was improved)
}
`;

export class WorkflowAIService {
  constructor(private openaiClient: OpenAI) {}

  async editWorkflow(request: WorkflowAIEditRequest): Promise<WorkflowAIEditResponse> {
    const { userPrompt, workflowContext, executionHistory, referenceExamples } = request;

    // Build context message for AI
    const contextParts: string[] = [
      `Current Workflow: ${workflowContext.workflow_name}`,
      `Description: ${workflowContext.workflow_description || '(none)'}`,
      workflowContext.template_id ? `Template: Configured (ID: ${workflowContext.template_id})` : 'Template: Not configured',
      '',
      'Current Steps:',
    ];

    if (workflowContext.current_steps.length === 0) {
      contextParts.push('(No steps yet)');
    } else {
      workflowContext.current_steps.forEach((step, index) => {
        const tools = step.tools && Array.isArray(step.tools) && step.tools.length > 0 
          ? ` [Tools: ${step.tools.map((t: any) => typeof t === 'string' ? t : (t?.type || 'unknown')).join(', ')}]`
          : '';
        const deps = step.depends_on && Array.isArray(step.depends_on) && step.depends_on.length > 0
          ? ` [Depends on: ${step.depends_on.map((d: number) => d + 1).join(', ')}]`
          : '';
        contextParts.push(
          `${index + 1}. ${step.step_name} (${step.model})${tools}${deps}`
        );
        if (step.step_description) {
          contextParts.push(`   ${step.step_description}`);
        }
      });
    }

    // Add Reference Examples (Few-Shot Learning)
    if (referenceExamples && referenceExamples.length > 0) {
      contextParts.push('', '---', 'REFERENCE EXAMPLES (Past Successful Jobs):');
      contextParts.push('Use these examples to understand how different inputs should be handled.');
      referenceExamples.forEach((ex, idx) => {
        const inputSummary = JSON.stringify(ex.submissionData || {}, null, 2);
        // Truncate output summary if too long (only add truncation marker when we actually truncate)
        const fullOutcome = String(ex.finalArtifactSummary || "");
        const outputSummary =
          fullOutcome.length > 1000
            ? fullOutcome.slice(0, 1000) + "... [truncated]"
            : fullOutcome;
        contextParts.push(`\nExample #${idx + 1}:`);
        contextParts.push(`Input:\n${inputSummary}`);
        contextParts.push(`Outcome:\n${outputSummary}`);
      });
    }

    // Add Current Execution Context
    if (executionHistory) {
      contextParts.push('', '---', 'CURRENT JOB CONTEXT (The run we are improving):');
      
      if (executionHistory.submissionData) {
        contextParts.push(`Original Input:\n${JSON.stringify(executionHistory.submissionData, null, 2)}`);
      }

      if (executionHistory.stepExecutionResults && executionHistory.stepExecutionResults.length > 0) {
        contextParts.push('\nStep Execution Results:');
        executionHistory.stepExecutionResults.forEach((step: any, idx: number) => {
          const status = step._status || step.status || 'unknown';
          const output = step.output 
            ? (typeof step.output === 'string' ? step.output : JSON.stringify(step.output))
            : '(no output)';
          // Limit output length to avoid token limits, but give enough context
          // Using 4000 chars (~1000 tokens) per step is generous but safe for modern models
          const truncatedOutput = output.length > 4000 ? output.slice(0, 4000) + '... [truncated]' : output;
          
          contextParts.push(`Step ${step.step_order || idx + 1} (${status}):\n${truncatedOutput}\n`);
        });
      }

      if (executionHistory.finalArtifactSummary) {
        const finalDoc = executionHistory.finalArtifactSummary.length > 15000 
          ? executionHistory.finalArtifactSummary.slice(0, 15000) + '... [truncated]' 
          : executionHistory.finalArtifactSummary;
        contextParts.push(`\nFinal Deliverable:\n${finalDoc}`);
      }
    }

    const contextMessage = contextParts.join('\n');

    const userMessage = `${contextMessage}

User Request: ${userPrompt}

Please generate the updated workflow configuration with all necessary changes.`;

    logger.info('[WorkflowAI] Editing workflow', {
      workflow: workflowContext.workflow_name,
      userPrompt: userPrompt.substring(0, 100),
      currentStepCount: workflowContext.current_steps.length,
      hasContext: !!executionHistory,
      referenceCount: referenceExamples?.length || 0
    });

    try {
      // Use the Responses API so we can reliably set reasoning effort + service tier.
      const completion = await (this.openaiClient as any).responses.create({
        model: 'gpt-5.2',
        instructions: WORKFLOW_AI_SYSTEM_PROMPT,
        input: userMessage,
        reasoning: { effort: 'medium' },
        service_tier: 'priority',
      });

      const outputText = String((completion as any)?.output_text || '');
      const cleaned = stripMarkdownCodeFences(outputText).trim();
      if (!cleaned) {
        throw new Error('No response from OpenAI');
      }

      let parsedResponse: WorkflowAIEditResponse;
      try {
        parsedResponse = JSON.parse(cleaned) as WorkflowAIEditResponse;
      } catch {
        // Best-effort recovery if the model wrapped JSON with extra text.
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Invalid response from OpenAI (expected JSON object)');
        }
        parsedResponse = JSON.parse(jsonMatch[0]) as WorkflowAIEditResponse;
      }

      // Validate the response
      if (!parsedResponse.steps || !Array.isArray(parsedResponse.steps)) {
        throw new Error('Invalid response structure from AI - missing steps array');
      }

      // Validate and normalize each step with proper defaults
      const validatedSteps = parsedResponse.steps.map((step: any, index: number) => {
        // Validate required fields
        if (!step.step_name || !step.instructions) {
          throw new Error(`Step ${index + 1} is missing required fields (step_name or instructions)`);
        }

        // Validate model
        if (!AVAILABLE_MODELS.includes(step.model)) {
          logger.warn(
            `[WorkflowAI] Invalid model ${step.model}, defaulting to gpt-5.2`,
          );
          step.model = 'gpt-5.2';
        }

        // Validate and sanitize tools
        if (step.tools && Array.isArray(step.tools)) {
          step.tools = step.tools.filter((tool: string | { type: string }) => {
            const toolName = typeof tool === 'string' ? tool : (tool as { type: string }).type;
            return AVAILABLE_TOOLS.includes(toolName);
          });
        }

        // Validate tool_choice
        if (!['auto', 'required', 'none'].includes(step.tool_choice || '')) {
          step.tool_choice = 'auto';
        }

        // Validate and clean up depends_on
        if (step.depends_on) {
          step.depends_on = step.depends_on.filter((dep: number) => 
            typeof dep === 'number' &&
            dep >= 0 && 
            dep < parsedResponse.steps.length &&
            dep !== index // Cannot depend on itself
          );
        }

        // Set step_order
        step.step_order = index;

        return step;
      });

      // Use ensureStepDefaults to add all required fields (step_id, step_group, etc.)
      const normalizedSteps: WorkflowStep[] = ensureStepDefaults(validatedSteps);

      // Validate dependencies across all steps
      try {
        validateDependencies(normalizedSteps);
      } catch (error: any) {
        logger.error('[WorkflowAI] Dependency validation failed', { error: error.message });
        throw new Error(`Invalid step dependencies: ${error.message}`);
      }

      parsedResponse.steps = normalizedSteps;

      logger.info('[WorkflowAI] Workflow edited successfully', {
        newStepCount: parsedResponse.steps.length,
        nameChanged: !!parsedResponse.workflow_name,
        descriptionChanged: !!parsedResponse.workflow_description,
      });

      return parsedResponse;
    } catch (error: any) {
      logger.error('[WorkflowAI] Error editing workflow', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to edit workflow: ${error.message}`);
    }
  }
}
