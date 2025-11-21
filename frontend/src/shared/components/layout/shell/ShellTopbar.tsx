import clsx from 'clsx'
import React from 'react'
import { shellConfig } from './shellConfig'

type ShellTopbarProps = {
  children: React.ReactNode
  className?: string
  sticky?: boolean
}

export const ShellTopbar: React.FC<ShellTopbarProps> = ({
  children,
  className,
  sticky = true,
}) => {
  return (
    <header
      data-shell-topbar
      style={{ height: shellConfig.topbarHeight }}
      className={clsx(
        'flex w-full items-center border-b border-white/60 bg-white/70 px-3 shadow-soft backdrop-blur-xl sm:px-6',
        sticky && 'sticky top-0 z-30',
        className
      )}
    >
      {children}
    </header>
  )
}

