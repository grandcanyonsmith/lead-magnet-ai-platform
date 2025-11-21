import clsx from 'clsx'
import Link from 'next/link'
import React from 'react'
import type { IconType } from 'react-icons'
import { useShell } from './Shell'

type ShellRailItemProps = {
  href: string
  icon: IconType
  label: string
  isActive?: boolean
}

export const ShellRailItem: React.FC<ShellRailItemProps> = ({ href, icon: Icon, label, isActive }) => {
  const { setSidebarOpen } = useShell()

  return (
    <Link
      href={href}
      onClick={() => setSidebarOpen(false)}
      className={clsx(
        'group flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium text-ink-400 transition-all duration-200 hover:text-ink-900',
        isActive && 'bg-white/80 text-ink-900 shadow-soft'
      )}
    >
      <span
        className={clsx(
          'flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-base shadow-soft transition-colors duration-200',
          isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-brand-500'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="truncate text-center">{label}</span>
    </Link>
  )
}

