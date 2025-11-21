import clsx from 'clsx'
import React from 'react'

type ShellSectionProps = {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export const ShellSection: React.FC<ShellSectionProps> = ({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}) => {
  return (
    <section
      className={clsx(
        'surface-card relative rounded-3xl border border-white/40 bg-white/80 p-6 shadow-soft backdrop-blur-lg',
        className
      )}
    >
      {(title || description || actions) && (
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold text-ink-900">{title}</h2>}
            {description && <p className="text-sm text-ink-500">{description}</p>}
          </div>
          {actions && <div className="ml-auto flex flex-wrap gap-3">{actions}</div>}
        </div>
      )}
      <div className={clsx('space-y-4', contentClassName)}>{children}</div>
    </section>
  )
}

