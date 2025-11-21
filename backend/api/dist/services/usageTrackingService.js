"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageTrackingService = exports.UsageTrackingService = void 0;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
/**
 * Shared service for tracking OpenAI API usage and costs.
 * Centralizes usage record storage to eliminate duplication across controllers.
 */
class UsageTrackingService {
    constructor(usageRecordsTable) {
        const { env } = require('../utils/env');
        this.usageRecordsTable = usageRecordsTable || env.usageRecordsTable;
    }
    /**
     * Store a usage record in DynamoDB.
     * This is called after each OpenAI API call to track costs.
     * Errors are logged but do not fail the request.
     */
    async storeUsageRecord(params) {
        const { tenantId, serviceType, model, inputTokens, outputTokens, costUsd, jobId } = params;
        try {
            const usageId = `usage_${(0, ulid_1.ulid)()}`;
            const usageRecord = {
                usage_id: usageId,
                tenant_id: tenantId,
                job_id: jobId || null,
                service_type: serviceType,
                model,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: costUsd,
                created_at: new Date().toISOString(),
            };
            await db_1.db.put(this.usageRecordsTable, usageRecord);
            logger_1.logger.info('[Usage Tracking] Usage record stored', {
                usageId,
                tenantId,
                serviceType,
                model,
                inputTokens,
                outputTokens,
                costUsd,
            });
        }
        catch (error) {
            // Don't fail the request if usage tracking fails
            logger_1.logger.error('[Usage Tracking] Failed to store usage record', {
                error: error.message,
                tenantId,
                serviceType,
            });
        }
    }
}
exports.UsageTrackingService = UsageTrackingService;
// Export singleton instance for convenience
exports.usageTrackingService = new UsageTrackingService();
//# sourceMappingURL=usageTrackingService.js.map