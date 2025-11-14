/**
 * Usage charts component for visualizing usage trends
 */

'use client'

import { UsageResponse } from '@/types/usage'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ServiceUsage } from '@/types/usage'

interface UsageChartsProps {
  usage: UsageResponse
}

export function UsageCharts({ usage }: UsageChartsProps) {
  const formatServiceName = (serviceType: string): string => {
    return serviceType
      .replace(/openai_/g, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Prepare data for service breakdown charts
  const serviceData = Object.values(usage.openai.by_service).map((service: ServiceUsage) => ({
    name: formatServiceName(service.service_type),
    calls: service.calls,
    tokens: service.total_tokens,
    actualCost: parseFloat(service.actual_cost.toFixed(2)),
    upchargeCost: parseFloat(service.upcharge_cost.toFixed(2)),
  }))

  if (serviceData.length === 0) {
    return null
  }

  return (
    <div className="space-y-6 mt-6">
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-4">Usage Breakdown by Service</h4>
        
        {/* API Calls Chart */}
        <div className="mb-6">
          <h5 className="text-sm font-medium text-gray-700 mb-2">API Calls by Service</h5>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="calls" fill="#3b82f6" name="API Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tokens Chart */}
        <div className="mb-6">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Tokens by Service</h5>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip formatter={(value) => value.toLocaleString()} />
              <Legend />
              <Bar dataKey="tokens" fill="#8b5cf6" name="Total Tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Comparison Chart */}
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Cost Comparison</h5>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                formatter={(value: unknown) => {
                  if (typeof value === 'number') {
                    return `$${value.toFixed(4)}`
                  }
                  if (typeof value === 'string') {
                    const numValue = parseFloat(value)
                    return isNaN(numValue) ? '$0.0000' : `$${numValue.toFixed(4)}`
                  }
                  if (Array.isArray(value)) {
                    const numValue = parseFloat(String(value[0] || 0))
                    return isNaN(numValue) ? '$0.0000' : `$${numValue.toFixed(4)}`
                  }
                  return '$0.0000'
                }}
              />
              <Legend />
              <Bar dataKey="actualCost" fill="#10b981" name="Actual Cost" />
              <Bar dataKey="upchargeCost" fill="#3b82f6" name="Upcharge Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

