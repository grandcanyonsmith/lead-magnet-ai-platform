/**
 * Shared loading state component
 * Provides consistent loading UI across the app
 */

interface LoadingStateProps {
  message?: string
  fullPage?: boolean
  className?: string
}

export function LoadingState({ message = 'Loading...', fullPage = false, className = '' }: LoadingStateProps) {
  const containerClass = fullPage
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-12'

  return (
    <div className={`${containerClass} ${className}`}>
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

