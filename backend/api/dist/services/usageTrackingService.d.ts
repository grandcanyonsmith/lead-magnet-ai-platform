export interface UsageRecord {
    usage_id: string;
    tenant_id: string;
    job_id: string | null;
    service_type: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    created_at: string;
}
export interface UsageTrackingParams {
    tenantId: string;
    serviceType: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    jobId?: string;
}
/**
 * Shared service for tracking OpenAI API usage and costs.
 * Centralizes usage record storage to eliminate duplication across controllers.
 */
export declare class UsageTrackingService {
    private readonly usageRecordsTable;
    constructor(usageRecordsTable?: string);
    /**
     * Store a usage record in DynamoDB.
     * This is called after each OpenAI API call to track costs.
     * Errors are logged but do not fail the request.
     */
    storeUsageRecord(params: UsageTrackingParams): Promise<void>;
}
export declare const usageTrackingService: UsageTrackingService;
//# sourceMappingURL=usageTrackingService.d.ts.map