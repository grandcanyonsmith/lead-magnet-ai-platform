/**
 * Date range picker component with preset buttons
 */

'use client'

import { useState, useEffect } from 'react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  className?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className = '',
}: DateRangePickerProps) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (start > end) {
        setError('Start date must be before end date')
      } else {
        setError(null)
      }
    } else {
      setError(null)
    }
  }, [startDate, endDate])

  const setPreset = (preset: 'currentMonth' | 'lastMonth' | 'last7Days' | 'last30Days') => {
    const now = new Date()
    let start: Date
    let end: Date = new Date(now)

    switch (preset) {
      case 'currentMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        start = lastMonth
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'last7Days':
        start = new Date(now)
        start.setDate(start.getDate() - 7)
        break
      case 'last30Days':
        start = new Date(now)
        start.setDate(start.getDate() - 30)
        break
    }

    onStartDateChange(start.toISOString().split('T')[0])
    onEndDateChange(end.toISOString().split('T')[0])
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            max={endDate || undefined}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            min={startDate || undefined}
          />
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPreset('currentMonth')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Current Month
        </button>
        <button
          type="button"
          onClick={() => setPreset('lastMonth')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Last Month
        </button>
        <button
          type="button"
          onClick={() => setPreset('last7Days')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Last 7 Days
        </button>
        <button
          type="button"
          onClick={() => setPreset('last30Days')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Last 30 Days
        </button>
      </div>
    </div>
  )
}

