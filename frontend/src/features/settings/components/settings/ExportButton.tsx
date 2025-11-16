/**
 * Export button component for usage data
 */

'use client'

import { FiDownload } from 'react-icons/fi'
import { UsageResponse } from '@/shared/types/usage'
import { downloadCSV, downloadJSON, formatDateForFilename } from '@/shared/utils/exportUtils'
import { ServiceUsage } from '@/shared/types/usage'

interface ExportButtonProps {
  usage: UsageResponse
  startDate: string
  endDate: string
}

export function ExportButton({ usage, startDate, endDate }: ExportButtonProps) {
  const handleExportCSV = () => {
    // Prepare data for CSV export
    const services = Object.values(usage.openai.by_service)
    const csvData = services.map((service: ServiceUsage) => ({
      Service: service.service_type.replace(/openai_/g, '').replace(/_/g, ' '),
      Calls: service.calls,
      'Input Tokens': service.input_tokens,
      'Output Tokens': service.output_tokens,
      'Total Tokens': service.total_tokens,
      'Actual Cost': service.actual_cost.toFixed(4),
      'Upcharge Cost': service.upcharge_cost.toFixed(4),
    }))

    // Add summary row
    csvData.push({
      Service: 'TOTAL',
      Calls: usage.summary.total_calls,
      'Input Tokens': usage.summary.total_input_tokens,
      'Output Tokens': usage.summary.total_output_tokens,
      'Total Tokens': usage.summary.total_tokens,
      'Actual Cost': usage.openai.total_actual.toFixed(4),
      'Upcharge Cost': usage.openai.total_upcharge.toFixed(4),
    })

    const filename = `usage-${startDate}_to_${endDate}.csv`
    downloadCSV(csvData, filename)
  }

  const handleExportJSON = () => {
    const exportData = {
      period: {
        start: startDate,
        end: endDate,
      },
      summary: usage.summary,
      costs: {
        total_actual: usage.openai.total_actual,
        total_upcharge: usage.openai.total_upcharge,
      },
      services: Object.values(usage.openai.by_service).map((service: ServiceUsage) => ({
        service_type: service.service_type,
        service_name: service.service_type.replace(/openai_/g, '').replace(/_/g, ' '),
        calls: service.calls,
        input_tokens: service.input_tokens,
        output_tokens: service.output_tokens,
        total_tokens: service.total_tokens,
        actual_cost: service.actual_cost,
        upcharge_cost: service.upcharge_cost,
      })),
    }

    const filename = `usage-${startDate}_to_${endDate}.json`
    downloadJSON(exportData, filename)
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleExportCSV}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        aria-label="Export usage data as CSV"
      >
        <FiDownload className="w-4 h-4 mr-2" />
        Export CSV
      </button>
      <button
        type="button"
        onClick={handleExportJSON}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        aria-label="Export usage data as JSON"
      >
        <FiDownload className="w-4 h-4 mr-2" />
        Export JSON
      </button>
    </div>
  )
}

