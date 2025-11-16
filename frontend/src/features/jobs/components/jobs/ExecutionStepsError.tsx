'use client'

interface ExecutionStepsErrorProps {
  error: string
  s3Key?: string
  title?: string
  showS3Key?: boolean
  className?: string
}

/**
 * Displays execution steps loading error with optional S3 key information
 * 
 * @param error - Error message to display
 * @param s3Key - Optional S3 key for debugging
 * @param title - Optional custom title (default: "Execution Steps Loading Error")
 * @param showS3Key - Whether to show S3 key (default: true if s3Key exists and not in error message)
 */
export function ExecutionStepsError({ 
  error, 
  s3Key, 
  title = 'Execution Steps Loading Error',
  showS3Key = true,
  className = ''
}: ExecutionStepsErrorProps) {
  const shouldShowS3Key = showS3Key && s3Key && !error.includes('S3 Key:')
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className={`bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-sm">{error}</p>
          {(shouldShowS3Key || (isDev && s3Key)) && (
            <p className="mt-2 text-xs font-mono break-all">
              S3 Key: {s3Key}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

