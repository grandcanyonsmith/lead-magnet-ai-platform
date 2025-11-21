import clsx from 'clsx'
import React from 'react'
import { useShell } from './Shell'

type ShellSidebarProps = {
  children: React.ReactNode
  className?: string
}

export const ShellSidebar: React.FC<ShellSidebarProps> = ({ children, className }) => {
  const { sidebarOpen, setSidebarOpen } = useShell()

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-overlay/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
          sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />
      <aside
        data-shell-sidebar
        className={clsx(
          'fixed top-0 left-0 z-40 flex h-full w-full max-w-xs flex-col bg-white shadow-soft transition-transform duration-300 ease-snappy sm:max-w-sm lg:border-r lg:border-surface-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
          className
        )}
      >
        {children}
      </aside>
    </>
  )
}

