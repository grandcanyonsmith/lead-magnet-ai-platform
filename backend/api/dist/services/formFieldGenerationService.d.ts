import OpenAI from 'openai';
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
export declare class FormFieldGenerationService {
    private openai;
    private storeUsageRecord;
    constructor(openai: OpenAI, storeUsageRecord: (tenantId: string, serviceType: string, model: string, inputTokens: number, outputTokens: number, costUsd: number, jobId?: string) => Promise<void>);
    /**
     * Generate form fields from description
     */
    generateFormFields(description: string, workflowName: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        formData: any;
        usageInfo: UsageInfo;
    }>;
}
//# sourceMappingURL=formFieldGenerationService.d.ts.map