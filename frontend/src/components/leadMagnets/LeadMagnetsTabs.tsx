'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ChartBarIcon, QueueListIcon } from '@heroicons/react/24/outline'

interface LeadMagnetsTabsProps {
  className?: string
}

const tabs = [
  {
    key: 'builder',
    label: 'Builder',
    href: '/dashboard/workflows',
    icon: QueueListIcon,
    activePrefixes: ['/dashboard/workflows'],
  },
  {
    key: 'generated',
    label: 'Generated',
    href: '/dashboard/jobs',
    icon: ChartBarIcon,
    activePrefixes: ['/dashboard/jobs'],
  },
] as const

export function LeadMagnetsTabs({ className }: LeadMagnetsTabsProps) {
  const pathname = usePathname()

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm',
        className
      )}
      role="tablist"
      aria-label="Lead magnets views"
    >
      {tabs.map((tab) => {
        const isActive = tab.activePrefixes.some(
          (prefix) => pathname === prefix || pathname?.startsWith(prefix + '/')
        )
        const Icon = tab.icon

        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
              isActive
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className={clsx('h-4 w-4', isActive ? 'text-white' : 'text-gray-400')} />
            <span className="whitespace-nowrap">{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}


