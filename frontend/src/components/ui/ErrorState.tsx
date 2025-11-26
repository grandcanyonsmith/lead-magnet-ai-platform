/**
 * Shared error state component
 * Provides consistent error UI across the app
 */

import React from 'react'
import { FiAlertCircle } from 'react-icons/fi'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export const ErrorState = React.memo(function ErrorState({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Try Again',
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`} role="alert" aria-live="polite">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FiAlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                aria-label={`${retryLabel} - ${title}`}
              >
                {retryLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

