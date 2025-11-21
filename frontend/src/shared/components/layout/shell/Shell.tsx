import clsx from 'clsx'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ShellContextValue = {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

const ShellContext = createContext<ShellContextValue | undefined>(undefined)

type ShellProps = {
  children: React.ReactNode
  className?: string
  sidebarOpen?: boolean
  onSidebarOpenChange?: (open: boolean) => void
}

export const Shell: React.FC<ShellProps> = ({
  children,
  className,
  sidebarOpen,
  onSidebarOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof sidebarOpen === 'boolean'
  const resolvedSidebarOpen = isControlled ? sidebarOpen : internalOpen

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onSidebarOpenChange?.(next)
      } else {
        setInternalOpen(next)
      }
    },
    [isControlled, onSidebarOpenChange]
  )

  const value = useMemo(
    () => ({
      sidebarOpen: resolvedSidebarOpen,
      setSidebarOpen: handleOpenChange,
    }),
    [resolvedSidebarOpen, handleOpenChange]
  )

  return (
    <ShellContext.Provider value={value}>
      <div
        data-shell-root
        className={clsx(
          'relative flex min-h-screen bg-transparent text-ink-900 selection:bg-brand-100 selection:text-ink-900',
          className
        )}
      >
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </div>
    </ShellContext.Provider>
  )
}

export const useShell = () => {
  const context = useContext(ShellContext)
  if (!context) {
    throw new Error('useShell must be used within <Shell>')
  }
  return context
}

