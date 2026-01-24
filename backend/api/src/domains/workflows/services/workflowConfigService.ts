import OpenAI from 'openai';
import { calculateOpenAICost } from '@services/costService';
import { callResponsesWithTimeout } from '@utils/openaiHelpers';
import { buildWorkflowPrompt } from '@domains/workflows/services/workflow/workflowPromptService';
import { parseWorkflowConfig } from '@domains/workflows/services/workflow/workflowConfigSupport';
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from '@services/promptOverrides';
import { formatAllModelDescriptionsMarkdown } from '@domains/workflows/services/workflow/modelDescriptions';

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
    _model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string,
    defaultToolChoice?: "auto" | "required" | "none",
    defaultServiceTier?: string,
    defaultTextVerbosity?: string,
    promptOverrides?: PromptOverrides,
  ): Promise<{ workflowData: any; usageInfo: UsageInfo }> {
    const workflowPrompt = buildWorkflowPrompt({
      description,
      brandContext,
      icpContext,
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
    });
    const contextSection = [
      brandContext ? `\n\n## Brand Context\n${brandContext}` : "",
      icpContext ? `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}` : "",
    ]
      .filter(Boolean)
      .join("");

    const overrides = promptOverrides ?? (await getPromptOverridesForTenant(tenantId));
    const resolved = resolvePromptOverride({
      key: "workflow_generation",
      defaults: {
        instructions:
          "You are an expert AI Lead Magnet Architect. Return only valid JSON without markdown formatting.",
        prompt: workflowPrompt,
      },
      overrides,
      variables: {
        description,
        brand_context: brandContext,
        icp_context: icpContext,
        context_section: contextSection,
        default_tool_choice: defaultToolChoice,
        default_service_tier: defaultServiceTier,
        default_text_verbosity: defaultTextVerbosity,
        model_descriptions_markdown: formatAllModelDescriptionsMarkdown(),
      },
    });

    console.log('[Workflow Config Service] Calling OpenAI for workflow generation...');
    const workflowStartTime = Date.now();
    
    // Force gpt-5.2 with max reasoning + priority tier for best quality and faster throughput.
    const workflowCompletionParams: any = {
      model: resolved.model || "gpt-5.2",
      instructions: resolved.instructions,
      input: resolved.prompt,
      reasoning: { effort: resolved.reasoning_effort || "high" },
      service_tier: resolved.service_tier || "priority",
    };
    const workflowCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(workflowCompletionParams),
      'workflow generation'
    );

    const workflowDuration = Date.now() - workflowStartTime;
    const workflowUsedModel =
      (workflowCompletion as any).model || workflowCompletionParams.model;
    console.log('[Workflow Config Service] Workflow generation completed', {
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
    const workflowData = parseWorkflowConfig(workflowContent, description, {
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
    });

    return { workflowData, usageInfo };
  }

}

