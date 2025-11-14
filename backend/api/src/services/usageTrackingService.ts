import { ulid } from 'ulid';
import { db } from '../utils/db';
import { logger } from '../utils/logger';

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
export class UsageTrackingService {
  private readonly usageRecordsTable: string;

  constructor(usageRecordsTable?: string) {
    const { env } = require('../utils/env');
    this.usageRecordsTable = usageRecordsTable || env.usageRecordsTable;
  }

  /**
   * Store a usage record in DynamoDB.
   * This is called after each OpenAI API call to track costs.
   * Errors are logged but do not fail the request.
   */
  async storeUsageRecord(params: UsageTrackingParams): Promise<void> {
    const { tenantId, serviceType, model, inputTokens, outputTokens, costUsd, jobId } = params;

    try {
      const usageId = `usage_${ulid()}`;
      const usageRecord: UsageRecord = {
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

      await db.put(this.usageRecordsTable, usageRecord);
      logger.info('[Usage Tracking] Usage record stored', {
        usageId,
        tenantId,
        serviceType,
        model,
        inputTokens,
        outputTokens,
        costUsd,
      });
    } catch (error: any) {
      // Don't fail the request if usage tracking fails
      logger.error('[Usage Tracking] Failed to store usage record', {
        error: error.message,
        tenantId,
        serviceType,
      });
    }
  }
}

// Export singleton instance for convenience
export const usageTrackingService = new UsageTrackingService();

