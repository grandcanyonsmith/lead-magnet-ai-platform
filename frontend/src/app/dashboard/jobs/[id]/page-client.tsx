'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiClock, FiLoader, FiCopy, FiChevronDown, FiChevronUp, FiExternalLink } from 'react-icons/fi'

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Queued',
    processing: 'Generating',
    completed: 'Ready',
    failed: 'Error',
  }
  return labels[status] || status
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <FiCheckCircle className="w-5 h-5 text-green-600" />
    case 'failed':
      return <FiXCircle className="w-5 h-5 text-red-600" />
    case 'processing':
      return <FiLoader className="w-5 h-5 text-blue-600 animate-spin" />
    default:
      return <FiClock className="w-5 h-5 text-yellow-600" />
  }
}

const getStatusBadge = (status: string) => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {getStatusLabel(status)}
    </span>
  )
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

export default function JobDetailClient() {
  const router = useRouter()
  const params = useParams()
  const jobId = params?.id as string
  
  const [job, setJob] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (jobId) {
      loadJob()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const loadJob = async () => {
    try {
      const data = await api.getJob(jobId)
      setJob(data)
      
      // Load workflow details if workflow_id exists
      if (data.workflow_id) {
        try {
          const workflowData = await api.getWorkflow(data.workflow_id)
          setWorkflow(workflowData)
        } catch (err) {
          console.error('Failed to load workflow:', err)
          // Continue without workflow data
        }
      }
      
      setError(null)
    } catch (error: any) {
      console.error('Failed to load job:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load lead magnet')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  if (!job) {
    return null
  }

  const duration = job.completed_at && job.created_at
    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
    : null

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Magnet Details</h1>
            <p className="text-gray-600 mt-1">View details and status of your generated lead magnet</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Details */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex items-center space-x-3">
              {getStatusIcon(job.status)}
              {getStatusBadge(job.status)}
            </div>
          </div>

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
              <a
                href={job.output_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary-600 hover:text-primary-900 font-medium"
              >
                View Document
                <FiExternalLink className="w-4 h-4 ml-1" />
              </a>
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
              <p className="text-sm text-gray-900">{formatDuration(duration)}</p>
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
        </div>

        {/* AI Instructions (if workflow loaded) */}
        {workflow && workflow.ai_instructions && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Instructions</h2>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
              {workflow.ai_instructions}
            </div>
          </div>
        )}
      </div>

      {/* Technical Details (Collapsible) */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-left mb-4"
        >
          <h2 className="text-lg font-semibold text-gray-900">Technical Details</h2>
          {showTechnicalDetails ? (
            <FiChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <FiChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900">{job.job_id}</p>
                <button
                  onClick={() => copyToClipboard(job.job_id)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Copy Job ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {job.submission_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submission ID</label>
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-mono text-gray-900">{job.submission_id}</p>
                  <button
                    onClick={() => copyToClipboard(job.submission_id)}
                    className="text-gray-500 hover:text-gray-700"
                    title="Copy Submission ID"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {job.workflow_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow ID</label>
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-mono text-gray-900">{job.workflow_id}</p>
                  <button
                    onClick={() => copyToClipboard(job.workflow_id)}
                    className="text-gray-500 hover:text-gray-700"
                    title="Copy Workflow ID"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {job.tenant_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                <p className="text-sm font-mono text-gray-900">{job.tenant_id}</p>
              </div>
            )}

            {job.started_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Started At</label>
                <p className="text-sm text-gray-900">
                  {(() => {
                    try {
                      const date = new Date(job.started_at)
                      return isNaN(date.getTime()) ? job.started_at : date.toLocaleString()
                    } catch {
                      return job.started_at
                    }
                  })()}
                </p>
              </div>
            )}

            {job.updated_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <p className="text-sm text-gray-900">
                  {(() => {
                    try {
                      const date = new Date(job.updated_at)
                      return isNaN(date.getTime()) ? job.updated_at : date.toLocaleString()
                    } catch {
                      return job.updated_at
                    }
                  })()}
                </p>
              </div>
            )}

            {job.artifacts && job.artifacts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Artifacts</label>
                <div className="space-y-2">
                  {job.artifacts.map((artifactId: string, index: number) => (
                    <div key={artifactId} className="flex items-center space-x-2">
                      <span className="text-sm font-mono text-gray-600">{artifactId}</span>
                      <button
                        onClick={() => copyToClipboard(artifactId)}
                        className="text-gray-500 hover:text-gray-700"
                        title="Copy Artifact ID"
                      >
                        <FiCopy className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {job.error_message && job.status === 'failed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Raw Error Details</label>
                <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap break-all">
                  {job.error_message}
                </div>
              </div>
            )}

            {copied && (
              <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
                Copied!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

