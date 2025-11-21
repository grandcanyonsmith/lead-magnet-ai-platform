import clsx from 'clsx'
import React from 'react'
import { shellConfig } from './shellConfig'

type ShellRailProps = {
  children: React.ReactNode
  className?: string
}

export const ShellRail: React.FC<ShellRailProps> = ({ children, className }) => {
  return (
    <div
      data-shell-rail
      className={clsx(
        'fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-transparent/10 bg-white/60 backdrop-blur-xl shadow-soft lg:flex',
        className
      )}
      style={{ width: shellConfig.sidebarRailWidth }}
    >
      {children}
    </div>
  )
}

