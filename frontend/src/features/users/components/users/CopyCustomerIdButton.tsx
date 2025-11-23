'use client'

import { FiCopy, FiCheck } from 'react-icons/fi'

interface CopyCustomerIdButtonProps {
  customerId: string
  copied: boolean
  onCopy: () => void
  size?: 'sm' | 'md'
}

export function CopyCustomerIdButton({ customerId, copied, onCopy, size = 'md' }: CopyCustomerIdButtonProps) {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const padding = size === 'sm' ? 'p-1.5' : 'p-1.5'

  return (
    <button
      onClick={onCopy}
      className={`${padding} text-ink-500 hover:text-ink-700 hover:bg-white/80 rounded-2xl transition-colors touch-target`}
      title={copied ? 'Copied!' : 'Copy Customer ID'}
      aria-label="Copy Customer ID"
    >
      {copied ? (
        <FiCheck className={`${iconSize} text-emerald-600`} />
      ) : (
        <FiCopy className={iconSize} />
      )}
    </button>
  )
}

