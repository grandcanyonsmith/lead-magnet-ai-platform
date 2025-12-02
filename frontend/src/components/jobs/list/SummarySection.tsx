import { FiRefreshCw } from 'react-icons/fi'
import type { ReactNode } from 'react'

export interface SummaryCard {
  label: string
  value: string
  subtext?: string
  icon: ReactNode
  accentClass: string
}

export interface StatusQuickFilter {
  label: string
  value: string
  count: number
  description: string
}

interface SummarySectionProps {
  jobCount: number
  lastRefreshedLabel: string | null
  hasProcessingJobs: boolean
  refreshing: boolean
  onRefresh: () => void
  summaryCards: SummaryCard[]
  quickFilters: StatusQuickFilter[]
  activeFilter: string
  onQuickFilterChange: (value: string) => void
  onClearFilters: () => void
}

export function SummarySection({
  jobCount,
  lastRefreshedLabel,
  hasProcessingJobs,
  refreshing,
  onRefresh,
  summaryCards,
  quickFilters,
  activeFilter,
  onQuickFilterChange,
  onClearFilters,
}: SummarySectionProps) {
  return (
    <div className="mb-4 sm:mb-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Generated Lead Magnets</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track generation progress, errors, and delivery status.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
            <span>{lastRefreshedLabel ? `Last refreshed ${lastRefreshedLabel}` : 'Waiting for first refresh'}</span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span>{jobCount} {jobCount === 1 ? 'job' : 'jobs'} visible</span>
            {hasProcessingJobs && (
              <>
                <span className="hidden sm:inline text-gray-300">•</span>
                <span className="inline-flex items-center gap-1 text-primary-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
                  Auto-refreshing every 5s
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh data'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border ${card.accentClass} p-4 shadow-sm`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
                {card.subtext && <p className="mt-1 text-sm text-gray-600">{card.subtext}</p>}
              </div>
              <span className="rounded-full bg-white/80 p-3 shadow-sm">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick status filters">
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onQuickFilterChange(filter.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200 hover:text-primary-700'
              }`}
              title={filter.description}
            >
              <span>{filter.label}</span>
              <span className={`text-xs font-semibold ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{filter.count}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900"
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}
