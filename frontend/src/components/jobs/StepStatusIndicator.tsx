/**
 * Step Status Indicator Component
 * Displays status icon and badge for a step
 */

import { FiCheckCircle, FiCircle, FiLoader, FiXCircle } from 'react-icons/fi'
import { StepStatus } from '@/types/job'

interface StepStatusIndicatorProps {
  status: StepStatus
  size?: 'sm' | 'md' | 'lg'
  showBadge?: boolean
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function StepStatusIndicator({ status, size = 'md', showBadge = false }: StepStatusIndicatorProps) {
  const iconClass = `${iconSizes[size]} flex-shrink-0`
  
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className={`${iconClass} text-green-600`} />
      case 'in_progress':
        return <FiLoader className={`${iconClass} text-yellow-500 animate-spin`} />
      case 'failed':
        return <FiXCircle className={`${iconClass} text-red-600`} />
      case 'pending':
      default:
        return <FiCircle className={`${iconClass} text-gray-400`} />
    }
  }

  const getStatusBadge = () => {
    if (!showBadge) return null
    
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full animate-pulse">
            Processing...
          </span>
        )
      default:
        return null
    }
  }

  return (
    <>
      {getStatusIcon()}
      {getStatusBadge()}
    </>
  )
}

