'use client'

import { useEffect } from 'react'
import { FiAlertCircle } from 'react-icons/fi'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Workflow edit error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <FiAlertCircle className="h-6 w-6 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Something went wrong!</h2>
        </div>
        <p className="text-gray-600 mb-6">
          {error.message || 'An unexpected error occurred while loading the workflow editor.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/dashboard/workflows'}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}

