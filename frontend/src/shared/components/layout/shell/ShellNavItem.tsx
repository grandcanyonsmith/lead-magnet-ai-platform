import clsx from 'clsx'
import Link from 'next/link'
import React from 'react'
import type { IconType } from 'react-icons'
import { useShell } from './Shell'

export type ShellNavItemProps = {
  href: string
  label: string
  icon: IconType
  isActive?: boolean
  badge?: number | string
  shortcutHint?: string
  onClick?: () => void
}

export const ShellNavItem: React.FC<ShellNavItemProps> = ({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
  shortcutHint,
  onClick,
}) => {
  const { setSidebarOpen } = useShell()

  const handleClick = () => {
    setSidebarOpen(false)
    onClick?.()
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={clsx(
        'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-brand-50 text-ink-900 shadow-ring'
          : 'text-ink-500 hover:bg-white/60 hover:text-ink-900'
      )}
    >
      <span
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-xl text-base transition-transform duration-200',
          isActive
            ? 'bg-brand-100 text-brand-600 shadow-soft'
            : 'bg-white/60 text-ink-400 group-hover:text-brand-500'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge !== null && badge !== '' && (
        <span className="pill text-xs text-ink-700">{badge}</span>
      )}
      {shortcutHint && (
        <kbd className="hidden rounded-lg border border-white/60 bg-white/70 px-2 py-1 text-xs font-medium text-ink-400 md:flex">
          {shortcutHint}
        </kbd>
      )}
    </Link>
  )
}

