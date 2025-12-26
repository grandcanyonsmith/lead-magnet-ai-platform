import OpenAI from 'openai';
import { calculateOpenAICost } from '@services/costService';
import { callResponsesWithTimeout } from '@utils/openaiHelpers';

export interface UsageInfo {
  service_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/**
 * Service for generating form fields.
 * Handles AI-powered form field generation for lead capture.
 */
export class FormFieldGenerationService {
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
   * Generate form fields from description
   */
  async generateFormFields(
    description: string,
    workflowName: string,
    _model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string
  ): Promise<{ formData: any; usageInfo: UsageInfo }> {
    let contextSection = '';
    if (brandContext) {
      contextSection += `\n\n## Brand Context\n${brandContext}`;
    }
    if (icpContext) {
      contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
    }
    
    const formPrompt = `You are an expert at creating lead capture forms. Based on this lead magnet: "${description}"${contextSection}, generate appropriate form fields.

The form should collect all necessary information needed to personalize the lead magnet. Think about what data would be useful for:
- Personalizing the AI-generated content
- Contacting the lead
- Understanding their needs
- Aligning with the target audience and brand context if provided

Generate 3-6 form fields. Common field types: text, email, tel, textarea, select, number.

Return JSON format:
{
  "form_name": "...",
  "public_slug": "...",
  "fields": [
    {
      "field_id": "field_1",
      "field_type": "text|email|tel|textarea|select|number",
      "label": "...",
      "placeholder": "...",
      "required": true|false,
      "options": ["option1", "option2"] // only for select fields
    }
  ]
}

The public_slug should be URL-friendly (lowercase, hyphens only, no spaces).`;

    console.log('[Form Field Generation Service] Calling OpenAI for form generation...');
    const formStartTime = Date.now();
    
    const formCompletionParams: any = {
      model: "gpt-5.2",
      instructions: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
      input: formPrompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
    };
    const formCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(formCompletionParams),
      'form generation'
    );

    const formDuration = Date.now() - formStartTime;
    const formModelUsed = (formCompletion as any).model || formCompletionParams.model;
    console.log('[Form Field Generation Service] Form generation completed', {
      duration: `${formDuration}ms`,
      tokensUsed: formCompletion.usage?.total_tokens,
      modelUsed: formModelUsed,
    });

    // Track usage
    const formUsage = formCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_workflow_generate',
      model: formModelUsed,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (formUsage) {
      const inputTokens = formUsage.input_tokens || 0;
      const outputTokens = formUsage.output_tokens || 0;
      const costData = calculateOpenAICost(formModelUsed, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_workflow_generate',
        model: formModelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_workflow_generate',
        formModelUsed,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    // Validate response has output_text
    if (!formCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing for form generation.');
    }
    
    const formContent = formCompletion.output_text;
    let formData = {
      form_name: `Form for ${workflowName}`,
      public_slug: workflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      fields: [
        {
          field_id: 'field_1',
          field_type: 'email',
          label: 'Email Address',
          placeholder: 'your@email.com',
          required: true,
        },
        {
          field_id: 'field_2',
          field_type: 'text',
          label: 'Name',
          placeholder: 'Your Name',
          required: true,
        },
      ],
    };

    try {
      const jsonMatch = formContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        formData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[Form Field Generation Service] Failed to parse form JSON, using defaults', e);
    }

    // Ensure field_id is generated for each field if missing
    formData.fields = formData.fields.map((field: any, index: number) => ({
      ...field,
      field_id: field.field_id || `field_${index + 1}`,
    }));

    return { formData, usageInfo };
  }
}

