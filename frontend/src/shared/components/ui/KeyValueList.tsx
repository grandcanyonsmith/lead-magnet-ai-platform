'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'
import { FiCopy } from 'react-icons/fi'

export interface KeyValueItem {
  label: string
  value: ReactNode
  helperText?: string
  icon?: ReactNode
  copyValue?: string
  testId?: string
}

interface KeyValueListProps {
  items: KeyValueItem[]
  columns?: 1 | 2 | 3
  dense?: boolean
  className?: string
  onCopy?: (value: string) => void
}

const gridClassMap: Record<NonNullable<KeyValueListProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
}

/**
 * Two-column aware key-value list with optional copy affordances.
 */
export function KeyValueList({
  items,
  columns = 1,
  dense = false,
  className = '',
  onCopy,
}: KeyValueListProps) {
  return (
    <dl
      className={clsx(
        'grid gap-4',
        gridClassMap[columns],
        dense && 'gap-3',
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={clsx(
            'rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3',
            dense && 'px-3 py-2.5'
          )}
          data-testid={item.testId}
        >
          <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {item.icon && <span className="text-gray-400">{item.icon}</span>}
            {item.label}
          </dt>
          <dd className="mt-1 flex items-start justify-between gap-3">
            <div className="text-sm text-gray-900">
              {item.value}
              {item.helperText && <p className="mt-1 text-xs text-gray-500">{item.helperText}</p>}
            </div>
            {item.copyValue && (
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:text-gray-900"
                onClick={() => {
                  if (onCopy) {
                    onCopy(item.copyValue!)
                  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(item.copyValue!).catch(() => {})
                  }
                }}
                aria-label={`Copy ${item.label}`}
                title="Copy value"
              >
                <FiCopy className="h-4 w-4" />
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
