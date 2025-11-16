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
        {icon || <FiInbox className="h-12 w-12 text-gray-400" />}
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
      {action && (
        <div className="mt-6">
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  )
}

