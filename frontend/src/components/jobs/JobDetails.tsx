'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FiExternalLink, FiLoader } from 'react-icons/fi'
import { formatRelativeTime, formatDurationSeconds } from '@/utils/jobFormatting'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface JobDetailsProps {
  job: any
  workflow: any | null
  hideContainer?: boolean
}

export function JobDetails({ job, workflow, hideContainer = false }: JobDetailsProps) {
  const router = useRouter()
  const [loadingDocument, setLoadingDocument] = useState(false)
  
  const duration = job.completed_at && job.created_at
    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
    : null

  // Calculate total cost from all execution steps
  const totalCost = job.execution_steps && Array.isArray(job.execution_steps)
    ? job.execution_steps.reduce((sum: number, step: any) => {
        const cost = step.usage_info?.cost_usd
        return sum + (typeof cost === 'number' ? cost : 0)
      }, 0)
    : null

  const handleViewDocument = async () => {
    if (loadingDocument) return
    
    setLoadingDocument(true)
    let blobUrl: string | null = null
    
    try {
      console.log('Fetching document for job:', job.job_id)
      blobUrl = await api.getJobDocumentBlobUrl(job.job_id)
      
      if (!blobUrl) {
        throw new Error('Failed to create blob URL')
      }
      
      console.log('Opening document in new window')
      const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')
      
      // Check if popup was blocked
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Popup was blocked, try alternative approach
        toast.error('Popup blocked. Please allow popups for this site and try again.')
        console.warn('Popup blocked, attempting alternative method')
        // Clean up blob URL since we can't use it
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
        }
        return
      }
      
      // Clean up blob URL after a delay (give time for window to load)
      setTimeout(() => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
        }
      }, 5000) // Increased delay to ensure document loads
      
      toast.success('Document opened in new tab')
    } catch (error: any) {
      console.error('Failed to open document:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to open document. Please try again.'
      if (error?.message) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          errorMessage = 'Document not found. It may not have been generated yet.'
        } else if (error.message.includes('403') || error.message.includes('permission')) {
          errorMessage = 'You do not have permission to view this document.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else {
          errorMessage = `Failed to open document: ${error.message}`
        }
      }
      
      toast.error(errorMessage)
    } finally {
      setLoadingDocument(false)
    }
  }

  const content = (
    <>
      {!hideContainer && <h2 className="text-lg font-semibold text-gray-900">Details</h2>}
      
      {workflow && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Workflow</label>
          <button
            onClick={() => router.push(`/dashboard/workflows/${job.workflow_id}`)}
            className="text-primary-600 hover:text-primary-900 font-medium hover:underline"
          >
            {workflow.workflow_name || job.workflow_id}
          </button>
        </div>
      )}

      {!workflow && job.workflow_id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Workflow</label>
          <p className="text-sm text-gray-900">{job.workflow_id}</p>
        </div>
      )}

      {job.output_url && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Document</label>
          <button
            onClick={handleViewDocument}
            disabled={loadingDocument}
            className="inline-flex items-center text-primary-600 hover:text-primary-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingDocument ? (
              <>
                <FiLoader className="w-4 h-4 mr-1 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                View Document
                <FiExternalLink className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
        <p className="text-sm text-gray-900">
          {formatRelativeTime(job.created_at)}
          <span className="text-gray-500 ml-2">({new Date(job.created_at).toLocaleString()})</span>
        </p>
      </div>

      {duration !== null && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Processing Time</label>
          <p className="text-sm text-gray-900">{formatDurationSeconds(duration)}</p>
        </div>
      )}

      {totalCost !== null && totalCost > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Total Cost</label>
          <p className="text-sm text-gray-900">${totalCost.toFixed(2)}</p>
        </div>
      )}

      {job.completed_at && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Completed</label>
          <p className="text-sm text-gray-900">
            {formatRelativeTime(job.completed_at)}
            <span className="text-gray-500 ml-2">({new Date(job.completed_at).toLocaleString()})</span>
          </p>
        </div>
      )}

      {job.status === 'failed' && job.error_message && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Error</label>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              {job.error_message.includes('Error') || job.error_message.includes('error')
                ? job.error_message
                : `Generation failed: ${job.error_message}`}
            </p>
          </div>
        </div>
      )}
    </>
  )

  if (hideContainer) {
    return <div className="space-y-6">{content}</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {content}
    </div>
  )
}

