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
    
    const formPrompt = `You are a Conversion Rate Optimization (CRO) Expert.
    Task: Design the optimal lead capture form for this lead magnet: "${description}"${contextSection}

    ## Strategy
    Your goal is to balance **Lead Quality** with **Conversion Rate**.
    - Ask enough to allow for *deep personalization* of the AI output.
    - Do not ask for irrelevant data.
    - Every field must have a purpose for the subsequent AI generation.

    ## Field Guidelines
    1. **Contact fields**: If you include Email / Name / Phone, they must be **optional** (set "required": false).
    2. **Personalization**: Ask specific questions (e.g., "What is your biggest challenge with X?", "Which industry are you in?").
    3. **Labeling**: Use clear, conversational labels (e.g., instead of "Industry", use "What industry describes you best?").
    4. **Quantity**: Aim for 3-5 high-impact fields.

## Output Format (JSON Only)
{
  "form_name": "...",
  "public_slug": "...",
  "fields": [
    {
      "field_id": "field_1", // unique ID
      "field_type": "text|email|tel|textarea|select|number",
      "label": "...",
      "placeholder": "...",
      "required": true|false,
      "options": ["option1", "option2"] // if type is select
    }
  ]
}

The public_slug should be URL-friendly (lowercase, hyphens only). Return ONLY valid JSON.`;

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
          required: false,
        },
        {
          field_id: 'field_2',
          field_type: 'text',
          label: 'Name',
          placeholder: 'Your Name',
          required: false,
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

    // Ensure contact fields are never required (even if the model sets them required=true)
    formData.fields = formData.fields.map((field: any) => {
      const fieldType = String(field.field_type || "").toLowerCase();
      const fieldId = String(field.field_id || "").toLowerCase();
      const label = String(field.label || "").trim().toLowerCase();

      const isEmailField = fieldType === "email" || fieldId === "email";
      const isPhoneField = fieldType === "tel" || fieldId === "phone";
      const isNameField = fieldId === "name" || label === "name" || label === "full name" || label === "your name";

      if (isEmailField || isPhoneField || isNameField) {
        return { ...field, required: false };
      }

      return field;
    });

    return { formData, usageInfo };
  }
}

