"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormFieldGenerationService = void 0;
const costService_1 = require("./costService");
const logger_1 = require("../utils/logger");
/**
 * Service for generating form fields.
 * Handles AI-powered form field generation for lead capture.
 */
class FormFieldGenerationService {
    constructor(openai, storeUsageRecord) {
        this.openai = openai;
        this.storeUsageRecord = storeUsageRecord;
    }
    /**
     * Generate form fields from description
     */
    async generateFormFields(description, workflowName, model, tenantId, jobId, brandContext, icpContext) {
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
        logger_1.logger.info('[Form Field Generation Service] Calling OpenAI for form generation...');
        const formStartTime = Date.now();
        const formCompletionParams = {
            model,
            instructions: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
            input: formPrompt,
        };
        if (model !== 'gpt-5') {
            formCompletionParams.temperature = 0.7;
        }
        const formCompletion = await this.openai.responses.create(formCompletionParams);
        const formDuration = Date.now() - formStartTime;
        const formModelUsed = formCompletion.model || model;
        logger_1.logger.info('[Form Field Generation Service] Form generation completed', {
            duration: `${formDuration}ms`,
            tokensUsed: formCompletion.usage?.total_tokens,
            modelUsed: formModelUsed,
        });
        // Track usage
        const formUsage = formCompletion.usage;
        let usageInfo = {
            service_type: 'openai_workflow_generate',
            model: formModelUsed,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
        };
        if (formUsage) {
            const inputTokens = formUsage.input_tokens || 0;
            const outputTokens = formUsage.output_tokens || 0;
            const costData = (0, costService_1.calculateOpenAICost)(formModelUsed, inputTokens, outputTokens);
            usageInfo = {
                service_type: 'openai_workflow_generate',
                model: formModelUsed,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: costData.cost_usd,
            };
            await this.storeUsageRecord(tenantId, 'openai_workflow_generate', formModelUsed, inputTokens, outputTokens, costData.cost_usd, jobId);
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
        }
        catch (e) {
            logger_1.logger.warn('[Form Field Generation Service] Failed to parse form JSON, using defaults', { error: e });
        }
        // Ensure field_id is generated for each field if missing
        formData.fields = formData.fields.map((field, index) => ({
            ...field,
            field_id: field.field_id || `field_${index + 1}`,
        }));
        return { formData, usageInfo };
    }
}
exports.FormFieldGenerationService = FormFieldGenerationService;
//# sourceMappingURL=formFieldGenerationService.js.map