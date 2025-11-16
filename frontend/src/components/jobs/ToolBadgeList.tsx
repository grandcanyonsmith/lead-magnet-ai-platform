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
      <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
        {emptyLabel}
      </span>
    )
  }

  return (
    <div className={clsx('flex flex-wrap gap-1 items-center', className)}>
      {toolNames.map((toolName) => (
        <span
          key={toolName}
          className={clsx(
            'px-2 py-0.5 text-xs rounded border whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200',
            badgeClassName
          )}
        >
          {toolName}
        </span>
      ))}
      {toolChoice && (
        <span className="text-xs text-gray-500">({toolChoice})</span>
      )}
    </div>
  )
}

