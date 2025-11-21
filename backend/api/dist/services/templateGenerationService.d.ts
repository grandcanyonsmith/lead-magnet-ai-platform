import OpenAI from 'openai';
export interface UsageInfo {
    service_type: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
}
/**
 * Service for generating template HTML and metadata.
 * Handles AI-powered template generation.
 */
export declare class TemplateGenerationService {
    private openai;
    private storeUsageRecord;
    constructor(openai: OpenAI, storeUsageRecord: (tenantId: string, serviceType: string, model: string, inputTokens: number, outputTokens: number, costUsd: number, jobId?: string) => Promise<void>);
    /**
     * Generate template HTML from description
     */
    generateTemplateHTML(description: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        htmlContent: string;
        usageInfo: UsageInfo;
    }>;
    /**
     * Generate template name and description
     */
    generateTemplateMetadata(description: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        templateName: string;
        templateDescription: string;
        usageInfo: UsageInfo;
    }>;
}
//# sourceMappingURL=templateGenerationService.d.ts.map