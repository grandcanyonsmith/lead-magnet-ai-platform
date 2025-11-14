/**
 * Billing and usage display section
 */

'use client'

import { useState, useEffect } from 'react'
import { FiDollarSign, FiActivity, FiFileText } from 'react-icons/fi'
import { useUsage } from '@/hooks/api/useSettings'
import { DateRangePicker } from './DateRangePicker'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ServiceUsage } from '@/types/usage'
import { UsageCharts } from './UsageCharts'
import { ExportButton } from './ExportButton'

export function BillingUsage() {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Initialize date range to current month
  useEffect(() => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setStartDate(firstDayOfMonth.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }, [])

  const { usage, loading, error, refetch } = useUsage(startDate, endDate)

  const formatServiceName = (serviceType: string): string => {
    return serviceType
      .replace(/openai_/g, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing & Usage</h3>
        <p className="text-sm text-gray-600">Track your OpenAI API usage and costs</p>
      </div>

      {/* Date Range Selector */}
      <div className="mb-6 pb-6 border-b">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div className="flex-1">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>
          {usage && (
            <div className="flex-shrink-0">
              <ExportButton usage={usage} startDate={startDate} endDate={endDate} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading usage data..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : usage ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiDollarSign className="w-6 h-6 text-blue-600" />
                <span className="text-xs text-blue-600 font-medium">Upcharge</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                ${(usage.openai?.total_upcharge || 0).toFixed(2)}
              </div>
              <div className="text-xs text-blue-600 mt-1">Total Cost</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiDollarSign className="w-6 h-6 text-green-600" />
                <span className="text-xs text-green-600 font-medium">Actual</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                ${(usage.openai?.total_actual || 0).toFixed(2)}
              </div>
              <div className="text-xs text-green-600 mt-1">Before Upcharge</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiActivity className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {usage.summary?.total_tokens?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-purple-600 mt-1">Total Tokens</div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiFileText className="w-6 h-6 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {usage.summary?.total_calls || 0}
              </div>
              <div className="text-xs text-orange-600 mt-1">API Calls</div>
            </div>
          </div>

          {/* Usage Charts */}
          {usage.openai?.by_service && Object.keys(usage.openai.by_service).length > 0 && (
            <UsageCharts usage={usage} />
          )}

          {/* Breakdown Table */}
          {usage.openai?.by_service && Object.keys(usage.openai.by_service).length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="block md:hidden mb-4">
                <p className="text-sm text-gray-600">Scroll horizontally to view all columns</p>
              </div>
              <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Usage breakdown by service">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Calls
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Input Tokens
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Output Tokens
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual Cost
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upcharge Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.values(usage.openai.by_service).map((service: ServiceUsage) => (
                    <tr key={service.service_type}>
                      <th scope="row" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatServiceName(service.service_type)}
                      </th>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {service.calls.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {service.input_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {service.output_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        ${service.actual_cost.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        ${service.upcharge_cost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-2">No usage data found</p>
              <p className="text-sm">No OpenAI API calls were recorded for the selected date range.</p>
              <p className="text-sm mt-2">
                Try generating a template, form CSS, or workflow instruction to see usage data.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Select a date range to view usage data</p>
        </div>
      )}
    </div>
  )
}

