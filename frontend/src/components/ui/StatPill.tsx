'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'

type StatTone = 'neutral' | 'positive' | 'warning' | 'danger'

const toneClasses: Record<StatTone, string> = {
  neutral: 'bg-gray-50 text-gray-900 border-gray-100',
  positive: 'bg-green-50 text-green-900 border-green-100',
  warning: 'bg-amber-50 text-amber-900 border-amber-100',
  danger: 'bg-red-50 text-red-900 border-red-100',
}

interface StatPillProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: StatTone
  helperText?: string
  className?: string
}

/**
 * Small stat component, useful for showing aggregated values inline.
 */
export function StatPill({
  label,
  value,
  icon,
  tone = 'neutral',
  helperText,
  className = '',
}: StatPillProps) {
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        toneClasses[tone],
        className
      )}
    >
      {icon && <div className="text-base">{icon}</div>}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-base font-semibold leading-6">{value}</p>
        {helperText && <p className="text-xs text-gray-500">{helperText}</p>}
      </div>
    </div>
  )
}
