/**
 * VisuallyHidden component for accessibility
 * Hides content visually but keeps it available to screen readers
 * Based on Radix UI's VisuallyHidden pattern
 */

import React from 'react'

interface VisuallyHiddenProps {
  children: React.ReactNode
  as?: keyof JSX.IntrinsicElements
  className?: string
}

export function VisuallyHidden({ 
  children, 
  as: Component = 'span',
  className = ''
}: VisuallyHiddenProps) {
  return (
    <Component
      className={`sr-only ${className}`}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
    >
      {children}
    </Component>
  )
}

