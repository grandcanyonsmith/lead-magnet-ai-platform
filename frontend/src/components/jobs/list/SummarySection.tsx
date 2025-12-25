import { ArrowPathIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import clsx from 'clsx'

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
    <div className="mb-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">Generated</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Track generation progress, errors, and delivery status for recent runs.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className={clsx("h-1.5 w-1.5 rounded-full", refreshing ? "bg-primary-500 animate-pulse" : "bg-gray-300")} />
              {lastRefreshedLabel ? `Refreshed ${lastRefreshedLabel}` : 'Waiting for refresh'}
            </span>
            <span className="h-3 w-px bg-gray-200" />
            <span>{jobCount} {jobCount === 1 ? 'job' : 'jobs'} visible</span>
            {hasProcessingJobs && (
              <>
                <span className="h-3 w-px bg-gray-200" />
                <span className="inline-flex items-center gap-1.5 text-primary-600">
                  <ArrowPathIcon className="h-3 w-3 animate-spin" />
                  Auto-refreshing
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <ArrowPathIcon className={clsx("h-4 w-4 transition-transform", refreshing && "animate-spin")} />
          {refreshing ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={clsx("relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{card.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
                {card.subtext && <p className="mt-1 text-xs text-gray-500 font-medium">{card.subtext}</p>}
              </div>
              <div className={clsx("rounded-lg p-2.5 shadow-sm ring-1 ring-inset ring-gray-200/50", card.accentClass.split(' ')[1] || 'bg-gray-50')}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-100" role="group" aria-label="Quick status filters">
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onQuickFilterChange(filter.value)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all border",
                isActive
                  ? "border-primary-600 bg-primary-600 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
              title={filter.description}
            >
              <span>{filter.label}</span>
              <span className={clsx("ml-1 rounded-full px-1.5 py-0.5 text-[10px]", isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
                {filter.count}
              </span>
            </button>
          )
        })}
        {activeFilter !== 'all' && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 px-2 py-1.5 transition-colors"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  )
}
