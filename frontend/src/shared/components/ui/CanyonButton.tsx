import React from 'react'
import clsx from 'clsx'

export interface CanyonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  onClick?: React.ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  className?: string
}

export const CanyonButton = React.forwardRef<HTMLButtonElement, CanyonButtonProps>(
  ({ children, className, disabled, onClick, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          'bg-canyon-green text-white font-bold py-2 px-4 rounded transition-transform duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-canyon-green/60',
          'hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

CanyonButton.displayName = 'CanyonButton'


