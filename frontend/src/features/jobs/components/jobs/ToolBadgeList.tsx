'use client'

import clsx from 'clsx'
import { normalizeTools } from './step-utils'

interface ToolBadgeListProps {
  tools?: unknown[]
  toolChoice?: string
  className?: string
  badgeClassName?: string
  emptyLabel?: string
  showEmptyState?: boolean
}

export function ToolBadgeList({
  tools,
  toolChoice,
  className,
  badgeClassName,
  emptyLabel = 'None',
  showEmptyState = true,
}: ToolBadgeListProps) {
  const toolNames = normalizeTools(tools as unknown[])

  if (toolNames.length === 0 && !toolChoice) {
    if (!showEmptyState) {
      return null
    }
    return (
      <span className="px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg border border-gray-200/60 shadow-sm ring-1 ring-gray-100/40">
        {emptyLabel}
      </span>
    )
  }

  return (
    <div className={clsx('flex flex-wrap gap-2 items-center', className)}>
      {toolNames.map((toolName) => (
        <span
          key={toolName}
          className={clsx(
            'px-3 py-1 text-xs font-semibold rounded-xl border whitespace-nowrap bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-700 border-blue-200/60 shadow-sm ring-1 ring-blue-100/40 transition-all duration-200 hover:shadow-md hover:border-blue-300/60',
            badgeClassName
          )}
        >
          {toolName}
        </span>
      ))}
      {toolChoice && (
        <span className="text-xs text-gray-500 font-medium">({toolChoice})</span>
      )}
    </div>
  )
}

