'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'

type SectionPadding = 'sm' | 'md' | 'lg'

const paddingMap: Record<SectionPadding, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

interface SectionCardProps {
  title?: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  padding?: SectionPadding
  stickyHeader?: boolean
}

/**
 * Shared card component to provide consistent containers across dashboard views.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className = '',
  contentClassName = '',
  padding = 'md',
  stickyHeader = false,
}: SectionCardProps) {
  const hasHeader = title || description || icon || actions
  const paddingClass = paddingMap[padding]

  return (
    <section
      className={clsx(
        'rounded-2xl border border-gray-100 bg-white shadow-sm ring-1 ring-black/[0.02]',
        className
      )}
    >
      {hasHeader && (
        <header
          className={clsx(
            'flex flex-col gap-3 border-b border-gray-100',
            paddingClass,
            stickyHeader && 'sticky top-0 z-10 bg-white/95 backdrop-blur'
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {icon && <div className="text-primary-600">{icon}</div>}
              <div>
                {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
                {description && <p className="text-sm text-gray-500">{description}</p>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </header>
      )}

      <div className={clsx(paddingClass, hasHeader && 'pt-4', contentClassName)}>{children}</div>
    </section>
  )
}
