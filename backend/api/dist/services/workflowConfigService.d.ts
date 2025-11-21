import OpenAI from 'openai';
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
export declare class WorkflowConfigService {
    private openai;
    private storeUsageRecord;
    constructor(openai: OpenAI, storeUsageRecord: (tenantId: string, serviceType: string, model: string, inputTokens: number, outputTokens: number, costUsd: number, jobId?: string) => Promise<void>);
    /**
     * Generate workflow configuration from description
     */
    generateWorkflowConfig(description: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        workflowData: any;
        usageInfo: UsageInfo;
    }>;
}
//# sourceMappingURL=workflowConfigService.d.ts.map