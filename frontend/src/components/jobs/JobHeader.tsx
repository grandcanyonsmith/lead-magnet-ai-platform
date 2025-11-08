'use client'

import { useRouter } from 'next/navigation'
import { FiArrowLeft } from 'react-icons/fi'

interface JobHeaderProps {
  error: string | null
  resubmitting: boolean
  onResubmit: () => void
}

export function JobHeader({ error }: JobHeaderProps) {
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
      </div>
    </div>
  )
}

