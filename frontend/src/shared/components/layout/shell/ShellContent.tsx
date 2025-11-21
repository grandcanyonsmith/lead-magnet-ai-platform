import clsx from 'clsx'
import React from 'react'

type ShellContentProps = {
  children: React.ReactNode
  className?: string
}

export const ShellContent: React.FC<ShellContentProps> = ({ children, className }) => {
  return (
    <main
      data-shell-content
      className={clsx(
        'shell-container shell-scroll-area relative py-6 sm:py-8 lg:py-10',
        className
      )}
    >
      {children}
    </main>
  )
}

