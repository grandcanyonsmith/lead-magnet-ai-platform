'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { FiRefreshCw, FiAlertCircle, FiCheckCircle, FiClock, FiChevronDown, FiChevronUp, FiCode, FiExternalLink } from 'react-icons/fi'
import type { WebhookLog } from '@/lib/api/webhookLogs.client'
import toast from 'react-hot-toast'

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const formatDuration = (ms?: number) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

const getStatusBadge = (log: WebhookLog) => {
  const hasError = !!log.error_message || (log.response_status && log.response_status >= 400)
  if (hasError) {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
        Error
      </span>
    )
  }
  if (log.response_status && log.response_status < 400) {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
        Success
      </span>
    )
  }
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
      Unknown
    </span>
  )
}

const parseJSON = (str: string | undefined): any => {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [retryingLogs, setRetryingLogs] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [endpointFilter, setEndpointFilter] = useState<string>('all')

  const loadLogs = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      const params: any = {
        limit: 100,
        status: statusFilter,
      }
      if (endpointFilter !== 'all') {
        params.endpoint = endpointFilter
      }
      
      const data = await api.webhookLogs.getWebhookLogs(params)
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to load webhook logs:', error)
      toast.error('Failed to load webhook logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, endpointFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const handleRetry = async (log: WebhookLog) => {
    if (!confirm(`Retry this webhook request to ${log.endpoint}?`)) {
      return
    }

    setRetryingLogs(prev => new Set(prev).add(log.log_id))
    try {
      await api.webhookLogs.retryWebhook(log.log_id)
      toast.success('Webhook retried')
      // Reload logs after a short delay
      setTimeout(() => {
        loadLogs(true)
      }, 1000)
    } catch (error: any) {
      console.error('Failed to retry webhook:', error)
      toast.error(`Failed to retry webhook: ${error.message || 'Unknown error'}`)
    } finally {
      setRetryingLogs(prev => {
        const newSet = new Set(prev)
        newSet.delete(log.log_id)
        return newSet
      })
    }
  }

  const endpoints = Array.from(new Set(logs.map(log => log.endpoint))).sort()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Webhook Logs</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">View and retry webhook requests</p>
          </div>
          <button
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            className="flex items-center px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <FiRefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'error')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Endpoint</label>
            <select
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Endpoints</option>
              {endpoints.map((endpoint) => (
                <option key={endpoint} value={endpoint}>
                  {endpoint}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-gray-600 text-sm sm:text-base">No webhook logs found</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">Webhook requests will appear here once they are received</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {logs.map((log) => {
              const isExpanded = expandedLogs.has(log.log_id)
              const isRetrying = retryingLogs.has(log.log_id)
              const hasError = !!log.error_message || (log.response_status && log.response_status >= 400)
              const requestBody = parseJSON(log.request_body)
              const responseBody = parseJSON(log.response_body)
              const requestHeaders = parseJSON(log.request_headers)

              return (
                <div key={log.log_id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {hasError ? (
                          <FiAlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        ) : (
                          <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{log.endpoint}</span>
                        {getStatusBadge(log)}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          {formatRelativeTime(log.created_at)}
                        </span>
                        {log.processing_time_ms && (
                          <span>Duration: {formatDuration(log.processing_time_ms)}</span>
                        )}
                        {log.response_status && (
                          <span>Status: {log.response_status}</span>
                        )}
                        {log.source_ip && (
                          <span>IP: {log.source_ip}</span>
                        )}
                      </div>
                      {log.error_message && (
                        <div className="mt-2 text-sm text-red-600 line-clamp-1">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRetry(log)}
                        disabled={isRetrying}
                        className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRetrying ? (
                          <>
                            <FiRefreshCw className="w-3 h-3 inline mr-1 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          <>
                            <FiRefreshCw className="w-3 h-3 inline mr-1" />
                            Retry
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => toggleExpand(log.log_id)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <FiChevronUp className="w-4 h-4" />
                        ) : (
                          <FiChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      {/* Request Body */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FiCode className="w-4 h-4 text-gray-500" />
                          <h4 className="text-sm font-medium text-gray-700">Request Body</h4>
                        </div>
                        <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                          {JSON.stringify(requestBody, null, 2)}
                        </pre>
                      </div>

                      {/* Request Headers */}
                      {requestHeaders && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FiCode className="w-4 h-4 text-gray-500" />
                            <h4 className="text-sm font-medium text-gray-700">Request Headers</h4>
                          </div>
                          <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                            {JSON.stringify(requestHeaders, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Response Body */}
                      {responseBody && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FiCode className="w-4 h-4 text-gray-500" />
                            <h4 className="text-sm font-medium text-gray-700">Response Body</h4>
                          </div>
                          <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                            {JSON.stringify(responseBody, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Error Stack */}
                      {log.error_stack && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FiAlertCircle className="w-4 h-4 text-red-500" />
                            <h4 className="text-sm font-medium text-red-700">Error Stack</h4>
                          </div>
                          <pre className="bg-red-50 p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto text-red-800">
                            {log.error_stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

