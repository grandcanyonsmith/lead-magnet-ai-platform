import { BaseApiClient } from './base.client'
import { TokenProvider } from './base.client'

export interface WebhookLog {
  log_id: string
  tenant_id?: string | null
  webhook_token?: string | null
  endpoint: string
  request_body: string
  request_headers?: string
  source_ip?: string
  response_status?: number
  response_body?: string
  error_message?: string
  error_stack?: string
  processing_time_ms?: number
  created_at: string
}

export interface WebhookLogsListParams {
  limit?: number
  offset?: number
  tenant_id?: string
  webhook_token?: string
  endpoint?: string
  status?: 'success' | 'error' | 'all'
}

export interface WebhookLogsListResponse {
  logs: WebhookLog[]
  total: number
  has_more: boolean
}

export class WebhookLogsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  /**
   * List webhook logs with filtering and pagination
   */
  async getWebhookLogs(params?: WebhookLogsListParams): Promise<WebhookLogsListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.endpoint) queryParams.append('endpoint', params.endpoint)
    if (params?.webhook_token) queryParams.append('webhook_token', params.webhook_token)
    if (params?.status) queryParams.append('status', params.status)

    const queryString = queryParams.toString()
    const url = `/admin/webhook-logs${queryString ? `?${queryString}` : ''}`
    
    return this.get<WebhookLogsListResponse>(url)
  }

  /**
   * Get a specific webhook log by ID
   */
  async getWebhookLog(logId: string): Promise<WebhookLog> {
    return this.get<WebhookLog>(`/admin/webhook-logs/${logId}`)
  }

  /**
   * Retry a webhook request
   */
  async retryWebhook(logId: string): Promise<{ message: string; result: any }> {
    return this.post<{ message: string; result: any }>(`/admin/webhook-logs/${logId}/retry`)
  }
}

