/**
 * Utility functions for workflow operations
 */

import { FiCheckCircle, FiXCircle, FiLoader, FiClock } from 'react-icons/fi'
import { ReactElement } from 'react'

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatUrl(url: string): string {
  if (url.length > 40) {
    return url.substring(0, 37) + '...'
  }
  return url
}

export function publicUrlFor(form: any): string | null {
  if (!form || !form.public_slug) return null
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/v1/forms/${form.public_slug}`
  }
  return `/v1/forms/${form.public_slug}`
}

export function getJobStatusIcon(status: string): ReactElement {
  switch (status) {
    case 'completed':
      return <FiCheckCircle className="w-3 h-3 text-green-600" />
    case 'failed':
      return <FiXCircle className="w-3 h-3 text-red-600" />
    case 'processing':
      return <FiLoader className="w-3 h-3 text-blue-600 animate-spin" />
    default:
      return <FiClock className="w-3 h-3 text-yellow-600" />
  }
}

