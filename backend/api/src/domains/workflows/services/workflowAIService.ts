import OpenAI from 'openai';
import { WorkflowStep, ensureStepDefaults } from './workflow/workflowConfigSupport';
import { validateDependencies } from '@utils/dependencyResolver';
import { logger } from '@utils/logger';
import { callResponsesWithTimeout, stripMarkdownCodeFences } from '@utils/openaiHelpers';

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
  'gpt-5',
  'gpt-5.1',
  'gpt-5.2',
  'gpt-4o',
  'gpt-4o-mini',
  'o4-mini-deep-research',
];

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const WORKFLOW_AI_SYSTEM_PROMPT = `You are an AI assistant that helps users restructure and optimize their entire workflow configuration for an AI-powered lead magnet generation platform.

The user will describe how they want to change their workflow in natural language. Your job is to generate a complete, optimized workflow configuration.

Available Models:
${AVAILABLE_MODELS.join(', ')}

Available Tools:
- web_search: For web research and information gathering
- code_interpreter: For data analysis, calculations, file processing
- computer_use_preview: For browser automation and UI interaction
- image_generation: For generating images with DALL-E
- shell: For running shell commands (executed via AWS shell executor)

You must respond with a JSON object that follows this schema:
{
  "workflow_name": string (optional - only if user wants to rename),
  "workflow_description": string (optional - only if user wants to change description),
  "steps": [
    {
      "step_name": string,
      "step_description": string,
      "model": string,
      "instructions": string,
      "tools": string[],
      "tool_choice": "auto" | "required" | "none",
      "depends_on": number[] | undefined
    }
  ],
  "changes_summary": string (describe what changed in 2-3 sentences)
}

Guidelines:
1. If user wants to add steps, include them in the right order
2. If user wants to remove steps, exclude them from the steps array
3. If user wants to reorder steps, rearrange them and update depends_on accordingly
4. If user wants to change multiple steps, apply all changes
5. Keep existing steps unchanged unless user specifically asks to modify them
6. Choose appropriate models and tools based on each step's purpose
7. Ensure step dependencies (depends_on) make logical sense
8. Provide a clear summary of what changed

Examples of requests:
- "Add a research step at the beginning"
- "Remove the third step"
- "Swap step 1 and step 2"
- "Change all steps to use GPT-5"
- "Add web search to all research-related steps"
- "Simplify this to just 3 steps: research, write, format"`;

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
      const completion = await callResponsesWithTimeout(
        () =>
          (this.openaiClient as any).responses.create({
            model: 'gpt-5.2',
            instructions: WORKFLOW_AI_SYSTEM_PROMPT,
            input: userMessage,
            reasoning: { effort: 'high' },
            service_tier: 'priority',
          }),
        'workflow ai edit',
      );

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
          logger.warn(`[WorkflowAI] Invalid model ${step.model}, defaulting to gpt-5`);
          step.model = 'gpt-5';
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
