import OpenAI from 'openai';
import { WorkflowStep, ensureStepDefaults } from './workflow/workflowConfigSupport';
import { ToolChoice } from '@utils/types';
import { validateDependencies } from '@utils/dependencyResolver';
import { logger } from '@utils/logger';
import { stripMarkdownCodeFences, callResponsesWithTimeout } from '@utils/openaiHelpers';
import { retryWithBackoff } from '@utils/errorHandling';

export interface WorkflowAIEditRequest {
  userPrompt: string;
  defaultToolChoice?: ToolChoice;
  defaultServiceTier?: string;
  reviewServiceTier?: string;
  reviewReasoningEffort?: string;
  reviewerUser?: {
    user_id: string;
    name?: string;
    email?: string;
    role?: string;
  };
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

import { AVAILABLE_MODELS } from './workflow/modelDescriptions';

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const DEFAULT_TOOL_CHOICE: ToolChoice = 'required';
const VALID_TOOL_CHOICES = new Set<ToolChoice>(['auto', 'required', 'none']);
const VALID_SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'scale', 'priority']);
const VALID_REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh']);

const buildWorkflowAiSystemPrompt = (
  defaultToolChoice: ToolChoice,
  defaultServiceTier?: string,
) => `You are an expert AI Lead Magnet Architect and Workflow Optimizer. Your task is to refine, restructure, and optimize the user's lead magnet generation workflow.

## Your Goal
Translate the user's natural language request into a precise, optimized JSON configuration. You should not just make the change, but *improve* the workflow where possible while respecting the user's intent.

## Available Models
${AVAILABLE_MODELS.join(', ')}

## Available Tools
- **web_search**: Essential for research, verification, and gathering live data.
- **code_interpreter**: For data analysis, complex math, or file processing.
- **image_generation**: For creating custom visuals.
- **computer_use_preview**: (Rare) Only for browser automation.
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

4. **Autonomy (No Human-in-the-Loop)**:
   - The workflow runs end-to-end without pausing for user interaction.
   - Do **NOT** ask for confirmation, ask follow-up questions, or say things like "Let me know if you'd like me to continue".
   - If information is missing, make reasonable assumptions and proceed.

5. **Per-Step Output Controls**:
   - Choose \`reasoning_effort\` per step ("low" for simple transforms, "high/xhigh" for deep strategy/research/synthesis).
   - Choose \`text_verbosity\` per step ("low" for concise outputs, "high" for detailed reports).
   - Choose \`service_tier\` per step when you need speed or cost control.

## Default Tool Choice
- Use \`${defaultToolChoice}\` as the default \`tool_choice\` when tools are present unless the user specifies otherwise.

## Default Service Tier
- Use \`${defaultServiceTier || "auto"}\` for each step unless the user explicitly asks for a different tier.

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
      "service_tier": "auto" | "default" | "flex" | "scale" | "priority",
      "reasoning_effort": "none" | "low" | "medium" | "high" | "xhigh",
      "text_verbosity": "low" | "medium" | "high",
      "max_output_tokens": number (optional),
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
    const {
      userPrompt,
      workflowContext,
      executionHistory,
      referenceExamples,
      defaultToolChoice,
      defaultServiceTier,
      reviewServiceTier,
      reviewReasoningEffort,
      reviewerUser,
    } = request;
    const resolvedDefaultToolChoice = VALID_TOOL_CHOICES.has(defaultToolChoice as ToolChoice)
      ? (defaultToolChoice as ToolChoice)
      : DEFAULT_TOOL_CHOICE;
    const resolvedDefaultServiceTier =
      defaultServiceTier && VALID_SERVICE_TIERS.has(defaultServiceTier)
        ? defaultServiceTier
        : undefined;
    const shouldOverrideServiceTier =
      resolvedDefaultServiceTier !== undefined &&
      resolvedDefaultServiceTier !== "auto";
    const resolvedReviewServiceTier =
      reviewServiceTier && VALID_SERVICE_TIERS.has(reviewServiceTier)
        ? reviewServiceTier
        : "priority";
    const resolvedReviewReasoningEffort =
      reviewReasoningEffort && VALID_REASONING_EFFORTS.has(reviewReasoningEffort)
        ? reviewReasoningEffort
        : "high";

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

    if (reviewerUser) {
      const reviewerLabel =
        reviewerUser.name || reviewerUser.email || reviewerUser.user_id;
      const reviewerMeta = [
        reviewerUser.role ? `Role: ${reviewerUser.role}` : null,
        reviewerUser.email ? `Email: ${reviewerUser.email}` : null,
      ]
        .filter(Boolean)
        .join(" • ");
      contextParts.push("", "Reviewer Context:");
      contextParts.push(
        reviewerMeta ? `${reviewerLabel} (${reviewerMeta})` : reviewerLabel,
      );
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
      // Helper to check if error is retryable (503, 429, timeouts, etc.)
      const isRetryableError = (err: any): boolean => {
        const status =
          typeof err.status === 'number'
            ? err.status
            : typeof err.statusCode === 'number'
              ? err.statusCode
              : typeof err.response?.status === 'number'
                ? err.response.status
                : undefined;
        if (status === 429 || status === 503) return true;
        if (typeof status === 'number' && status >= 500) return true;
        const msg = String(err?.message || '').toLowerCase();
        return (
          msg.includes('timeout') ||
          msg.includes('overloaded') ||
          msg.includes('service unavailable') ||
          msg.includes('rate limit')
        );
      };

      // Use the Responses API with retry logic for reliability (no timeout - can take up to 5 minutes)
      const completion = await retryWithBackoff(
        () =>
          callResponsesWithTimeout(
            () =>
              (this.openaiClient as any).responses.create({
                model: 'gpt-5.2',
                instructions: buildWorkflowAiSystemPrompt(
                  resolvedDefaultToolChoice,
                  resolvedDefaultServiceTier,
                ),
                input: userMessage,
                reasoning: { effort: resolvedReviewReasoningEffort },
                ...(resolvedReviewServiceTier !== "auto"
                  ? { service_tier: resolvedReviewServiceTier }
                  : {}),
              }),
            'Workflow AI Edit',
            0, // No timeout - allow up to 5 minutes for complex workflow edits
          ),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          retryableErrors: isRetryableError,
          onRetry: (attempt, error) => {
            logger.warn('[WorkflowAI] Retrying OpenAI call', {
              attempt,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        },
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
        const hasTools = Array.isArray(step.tools) && step.tools.length > 0;
        if (!VALID_TOOL_CHOICES.has(step.tool_choice as ToolChoice)) {
          step.tool_choice = hasTools ? resolvedDefaultToolChoice : 'none';
        }

        // Validate service_tier (optional)
        if (step.service_tier && !VALID_SERVICE_TIERS.has(step.service_tier)) {
          delete step.service_tier;
        }

        if (shouldOverrideServiceTier) {
          step.service_tier = resolvedDefaultServiceTier;
        }

      // Validate reasoning_effort (optional)
      if (
        step.reasoning_effort &&
        !['none', 'low', 'medium', 'high', 'xhigh'].includes(step.reasoning_effort)
      ) {
        step.reasoning_effort = 'high';
      }

      // Validate text_verbosity (optional)
      if (
        step.text_verbosity &&
        !['low', 'medium', 'high'].includes(step.text_verbosity)
      ) {
        delete step.text_verbosity;
      }

      // Validate max_output_tokens (optional)
      if (step.max_output_tokens !== undefined) {
        if (
          typeof step.max_output_tokens !== 'number' ||
          !Number.isFinite(step.max_output_tokens) ||
          step.max_output_tokens < 1
        ) {
          delete step.max_output_tokens;
        } else {
          // Keep integer semantics
          step.max_output_tokens = Math.floor(step.max_output_tokens);
        }
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
      const normalizedSteps: WorkflowStep[] = ensureStepDefaults(validatedSteps, {
        defaultToolChoice: resolvedDefaultToolChoice,
        defaultServiceTier: resolvedDefaultServiceTier,
      });

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
      // Check if this is a service unavailable error
      const status =
        typeof error.status === 'number'
          ? error.status
          : typeof error.statusCode === 'number'
            ? error.statusCode
            : typeof error.response?.status === 'number'
              ? error.response.status
              : undefined;
      
      const isServiceUnavailable = status === 503 || 
        String(error?.message || '').toLowerCase().includes('service unavailable');

      logger.error('[WorkflowAI] Error editing workflow', {
        error: error.message,
        status,
        isServiceUnavailable,
        stack: error.stack,
      });

      if (isServiceUnavailable) {
        throw new Error(
          'OpenAI service is temporarily unavailable. Please try again in a few moments. ' +
          'If the issue persists, the service may be experiencing high load.'
        );
      }

      throw new Error(`Failed to edit workflow: ${error.message}`);
    }
  }
}
