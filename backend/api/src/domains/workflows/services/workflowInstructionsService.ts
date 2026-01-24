import { getOpenAIClient } from '@services/openaiService';
import { callResponsesWithTimeout } from '@utils/openaiHelpers';
import { calculateOpenAICost } from '@services/costService';
import { usageTrackingService } from '@services/usageTrackingService';
import { logger } from '@utils/logger';
import { ApiError } from '@utils/errors';
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
} from '@services/promptOverrides';

export interface WorkflowInstructionsRefinementRequest {
  current_instructions: string;
  edit_prompt: string;
  model?: string;
  tenantId: string;
}

/**
 * Service for refining workflow instructions using AI.
 */
export class WorkflowInstructionsService {
  /**
   * Refine workflow instructions using AI.
   */
  async refineInstructions(request: WorkflowInstructionsRefinementRequest): Promise<string> {
    const { current_instructions, edit_prompt, tenantId } = request;
    const model = "gpt-5.2";

    if (!current_instructions || !current_instructions.trim()) {
      throw new ApiError('Current instructions are required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    logger.info('[Workflow Instructions Refinement] Starting refinement', {
      tenantId,
      model,
      currentInstructionsLength: current_instructions.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      logger.info('[Workflow Instructions Refinement] OpenAI client initialized');

      const prompt = this.buildRefinementPrompt(current_instructions, edit_prompt);
      const overrides = await getPromptOverridesForTenant(tenantId);
      const resolved = resolvePromptOverride({
        key: "workflow_instructions_refine",
        defaults: {
          instructions:
            "You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.",
          prompt,
        },
        overrides,
        variables: {
          current_instructions,
          edit_prompt,
        },
      });

      logger.info('[Workflow Instructions Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: resolved.prompt?.length || 0,
      });

      const refineStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: resolved.instructions,
        input: resolved.prompt,
        reasoning: { effort: "high" },
        service_tier: "priority",
      };
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        'workflow instructions refinement'
      );

      const refineDuration = Date.now() - refineStartTime;
      const refinementModel = (completion as any).model || model;
      logger.info('[Workflow Instructions Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: refinementModel,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const costData = calculateOpenAICost(refinementModel, inputTokens, outputTokens);
        
        await usageTrackingService.storeUsageRecord({
          tenantId,
          serviceType: 'openai_workflow_refine',
          model: refinementModel,
          inputTokens,
          outputTokens,
          costUsd: costData.cost_usd,
        });
      }

      // Validate response has output_text
      if (!completion.output_text) {
        throw new ApiError('OpenAI Responses API returned empty response. output_text is missing for workflow instructions refinement.', 500);
      }
      
      const refinedContent = completion.output_text;
      
      // Clean up markdown code blocks if present
      const cleanedContent = this.cleanMarkdownCodeBlocks(refinedContent);

      return cleanedContent;
    } catch (error: any) {
      logger.error('[Workflow Instructions Refinement] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to refine instructions',
        500
      );
    }
  }

  /**
   * Build the refinement prompt with comprehensive guidance.
   */
  private buildRefinementPrompt(current_instructions: string, edit_prompt: string): string {
    return WORKFLOW_INSTRUCTIONS_REFINE_PROMPT
      .replace('{{edit_prompt}}', edit_prompt)
      .replace('{{current_instructions}}', current_instructions);
  }

  /**
   * Clean markdown code blocks from content.
   */
  private cleanMarkdownCodeBlocks(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\w*\s*/i, '').replace(/\s*```$/i, '');
    }
    return cleaned;
  }
}

export const workflowInstructionsService = new WorkflowInstructionsService();

