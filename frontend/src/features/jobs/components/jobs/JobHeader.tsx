'use client'

import { useRouter } from 'next/navigation'
import { FiArrowLeft } from 'react-icons/fi'
import type { Job } from '@/features/jobs/types'

interface JobHeaderProps {
  error: string | null
  resubmitting: boolean
  onResubmit: () => void
  job?: Job | null
}

export function JobHeader({ error, job }: JobHeaderProps) {
  const router = useRouter()

  const totalCost = (() => {
    if (!job?.execution_steps || !Array.isArray(job.execution_steps)) {
      return null
    }
    
    const sum = job.execution_steps.reduce((acc: number, step) => {
      const cost = step.usage_info?.cost_usd
      if (cost === undefined || cost === null) {
        return acc
      }
      if (typeof cost === 'number') {
        return acc + cost
      }
      if (typeof cost === 'string') {
        const parsed = parseFloat(cost)
        return acc + (isNaN(parsed) ? 0 : parsed)
      }
      return acc
    }, 0)
    
    
    return sum
  })()

  return (
    <div className="mb-6">
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4 py-2 touch-target"
      >
        <FiArrowLeft className="w-4 h-4 mr-2" />
        Back
      </button>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lead Magnet Details</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">View details and status of your generated lead magnet</p>
        </div>
        {totalCost !== null && (
          <div className="sm:text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Cost</div>
            <div className="text-sm sm:text-base text-gray-900 mt-1">${totalCost.toFixed(2)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

