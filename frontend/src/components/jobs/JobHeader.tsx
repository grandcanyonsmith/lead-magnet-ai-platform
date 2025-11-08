'use client'

import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi'

interface JobHeaderProps {
  error: string | null
  resubmitting: boolean
  onResubmit: () => void
}

export function JobHeader({ error, resubmitting, onResubmit }: JobHeaderProps) {
  const router = useRouter()

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
        <button
          onClick={onResubmit}
          disabled={resubmitting}
          className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto touch-target"
        >
          <FiRefreshCw className={`w-4 h-4 mr-2 ${resubmitting ? 'animate-spin' : ''}`} />
          {resubmitting ? 'Resubmitting...' : 'Resubmit'}
        </button>
      </div>
    </div>
  )
}

