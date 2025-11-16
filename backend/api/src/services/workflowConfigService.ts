import OpenAI from 'openai';
import { calculateOpenAICost } from './costService';
import { buildWorkflowPrompt } from '../utils/workflowPromptBuilder';
import { parseWorkflowConfig } from '../utils/workflowConfigParser';
import { logger } from '../utils/logger';

export interface UsageInfo {
  service_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/**
 * Service for generating workflow configuration.
 * Handles AI-powered workflow step generation.
 */
export class WorkflowConfigService {
  constructor(
    private openai: OpenAI,
    private storeUsageRecord: (
      tenantId: string,
      serviceType: string,
      model: string,
      inputTokens: number,
      outputTokens: number,
      costUsd: number,
      jobId?: string
    ) => Promise<void>
  ) {}

  /**
   * Generate workflow configuration from description
   */
  async generateWorkflowConfig(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string
  ): Promise<{ workflowData: any; usageInfo: UsageInfo }> {
    const workflowPrompt = buildWorkflowPrompt({
      description,
      brandContext,
      icpContext,
    });

    logger.info('[Workflow Config Service] Calling OpenAI for workflow generation...');
    const workflowStartTime = Date.now();
    
    const workflowCompletionParams: any = {
      model,
      instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
      input: workflowPrompt,
    };
    if (model !== 'gpt-5') {
      workflowCompletionParams.temperature = 0.7;
    }
    const workflowCompletion = await this.openai.responses.create(workflowCompletionParams);

    const workflowDuration = Date.now() - workflowStartTime;
    const workflowUsedModel = (workflowCompletion as any).model || model;
    logger.info('[Workflow Config Service] Workflow generation completed', {
      duration: `${workflowDuration}ms`,
      tokensUsed: workflowCompletion.usage?.total_tokens,
      modelUsed: workflowUsedModel,
    });

    // Track usage
    const workflowUsage = workflowCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_workflow_generate',
      model: workflowUsedModel,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (workflowUsage) {
      const inputTokens = workflowUsage.input_tokens || 0;
      const outputTokens = workflowUsage.output_tokens || 0;
      const costData = calculateOpenAICost(workflowUsedModel, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_workflow_generate',
        model: workflowUsedModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_workflow_generate',
        workflowUsedModel,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    // Validate response has output_text
    if (!workflowCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing.');
    }
    
    const workflowContent = workflowCompletion.output_text;
    const workflowData = parseWorkflowConfig(workflowContent, description);

    return { workflowData, usageInfo };
  }

}

