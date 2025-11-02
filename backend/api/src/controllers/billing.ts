import { db } from '../utils/db';
import { RouteResponse } from '../routes';
import { ApiError } from '../utils/errors';

const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';

interface UsageRecord {
  usage_id: string;
  tenant_id: string;
  job_id?: string | null;
  service_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

interface ServiceUsage {
  service_type: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  actual_cost: number;
  upcharge_cost: number;
}

interface UsageSummary {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_actual_cost: number;
  total_upcharge_cost: number;
  by_service: Record<string, ServiceUsage>;
}

class BillingController {
  async getUsage(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    // Parse date range from query params
    // Default to current month (start of month to today)
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    if (queryParams.start_date && queryParams.end_date) {
      // Parse dates - if they're in YYYY-MM-DD format, set to start/end of day
      const startDateStr = queryParams.start_date;
      const endDateStr = queryParams.end_date;
      
      // Parse and set to start of day (00:00:00)
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      
      // Parse and set to end of day (23:59:59.999)
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ApiError('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)', 400);
    }

    if (startDate > endDate) {
      throw new ApiError('Start date must be before end date', 400);
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    console.log('[Billing] Fetching usage records', {
      tenantId,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    // Query usage records by tenant_id and date range
    // DynamoDB requires BETWEEN for sort key range queries
    let usageRecords: any[] = [];
    try {
      usageRecords = await db.query(
        USAGE_RECORDS_TABLE,
        'gsi_tenant_date',
        'tenant_id = :tenant_id AND created_at BETWEEN :start_date AND :end_date',
        {
          ':tenant_id': tenantId,
          ':start_date': startDateStr,
          ':end_date': endDateStr,
        }
      );
    } catch (error: any) {
      // If table doesn't exist yet, return empty results
      if (error.name === 'ResourceNotFoundException' || error.message?.includes('not found')) {
        console.warn('[Billing] Usage records table does not exist yet', {
          table: USAGE_RECORDS_TABLE,
          message: 'Table needs to be created via CDK deployment',
        });
        usageRecords = [];
      } else {
        console.error('[Billing] Error querying usage records', {
          error: error.message,
          errorName: error.name,
        });
        throw new ApiError(`Failed to fetch usage records: ${error.message}`, 500);
      }
    }

    console.log('[Billing] Found usage records', {
      tenantId,
      count: usageRecords.length,
    });

    // Aggregate usage by service type
    const summary: UsageSummary = {
      total_calls: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      total_actual_cost: 0,
      total_upcharge_cost: 0,
      by_service: {},
    };

    // Process each usage record
    for (const record of usageRecords as UsageRecord[]) {
      const serviceType = record.service_type;
      
      if (!summary.by_service[serviceType]) {
        summary.by_service[serviceType] = {
          service_type: serviceType,
          calls: 0,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          actual_cost: 0,
          upcharge_cost: 0,
        };
      }

      const service = summary.by_service[serviceType];
      service.calls += 1;
      service.input_tokens += record.input_tokens || 0;
      service.output_tokens += record.output_tokens || 0;
      service.total_tokens += (record.input_tokens || 0) + (record.output_tokens || 0);
      service.actual_cost += record.cost_usd || 0;
      service.upcharge_cost += (record.cost_usd || 0) * 2; // Double for upcharge

      // Update totals
      summary.total_calls += 1;
      summary.total_input_tokens += record.input_tokens || 0;
      summary.total_output_tokens += record.output_tokens || 0;
      summary.total_tokens += (record.input_tokens || 0) + (record.output_tokens || 0);
      summary.total_actual_cost += record.cost_usd || 0;
      summary.total_upcharge_cost += (record.cost_usd || 0) * 2;
    }

    // Round costs to 6 decimal places for precision
    summary.total_actual_cost = Math.round(summary.total_actual_cost * 1000000) / 1000000;
    summary.total_upcharge_cost = Math.round(summary.total_upcharge_cost * 1000000) / 1000000;
    
    // Round service-level costs
    Object.values(summary.by_service).forEach(service => {
      service.actual_cost = Math.round(service.actual_cost * 1000000) / 1000000;
      service.upcharge_cost = Math.round(service.upcharge_cost * 1000000) / 1000000;
    });

    return {
      statusCode: 200,
      body: {
        openai: {
          by_service: summary.by_service,
          total_actual: summary.total_actual_cost,
          total_upcharge: summary.total_upcharge_cost,
        },
        period: {
          start: startDateStr,
          end: endDateStr,
        },
        summary: {
          total_calls: summary.total_calls,
          total_tokens: summary.total_tokens,
          total_input_tokens: summary.total_input_tokens,
          total_output_tokens: summary.total_output_tokens,
        },
      },
    };
  }
}

export const billingController = new BillingController();

