/**
 * Shared empty state component
 * Provides consistent empty state UI across the app
 */

import { FiInbox } from 'react-icons/fi'

interface EmptyStateProps {
  title?: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({
  title = 'No items found',
  message,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex justify-center">
        {icon || <FiInbox className="h-12 w-12 text-ink-400" />}
      </div>
      <h3 className="mt-4 text-sm font-medium text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-500">{message}</p>
      {action && (
        <div className="mt-6">
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-white/60 shadow-soft text-sm font-medium rounded-2xl text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  )
}
