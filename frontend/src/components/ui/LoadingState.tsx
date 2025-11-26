/**
 * Shared loading state component
 * Provides consistent loading UI across the app
 */

import React from 'react'

interface LoadingStateProps {
  message?: string
  fullPage?: boolean
  className?: string
}

export const LoadingState = React.memo(function LoadingState({ 
  message = 'Loading...', 
  fullPage = false, 
  className = '' 
}: LoadingStateProps) {
  const containerClass = fullPage
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-12'

  return (
    <div className={`${containerClass} ${className}`} role="status" aria-live="polite">
      <div className="text-center">
        <div 
          className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"
          aria-hidden="true"
        ></div>
        <p className="text-gray-600" aria-label={message}>{message}</p>
      </div>
    </div>
  )
})

