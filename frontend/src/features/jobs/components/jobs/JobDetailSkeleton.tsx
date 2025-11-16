'use client'

/**
 * Loading skeleton component for job detail page
 * 
 * Displays animated placeholder content while job data is loading.
 * Matches the structure of the actual job detail page for smooth transitions.
 * 
 * Sections displayed:
 * - Header with back button and title
 * - Job details cards (4 placeholder cards)
 * - Execution steps list (3 placeholder steps)
 * 
 * Uses Tailwind's animate-pulse for skeleton animation.
 * Responsive design matches the main page layout.
 * 
 * @returns Loading skeleton JSX
 */
export function JobDetailSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-10 bg-gray-200 rounded w-20 mb-4 animate-pulse"></div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div>
            <div className="h-7 sm:h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-4 sm:h-5 bg-gray-200 rounded w-96 max-w-full animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Job Details skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-lg border border-gray-100 p-3">
                <div className="h-3 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Execution Steps skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-48 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  <div className="h-20 bg-gray-100 rounded animate-pulse mt-2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

