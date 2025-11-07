'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiClock, FiLoader, FiCopy, FiChevronDown, FiChevronUp, FiExternalLink, FiRefreshCw } from 'react-icons/fi'

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

const formatDurationSeconds = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

const formatDurationMs = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function JobDetailClient() {
  const router = useRouter()
  const params = useParams()
  const jobId = params?.id as string
  
  const [job, setJob] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showExecutionSteps, setShowExecutionSteps] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
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
      
      // Load submission details if submission_id exists
      if (data.submission_id) {
        try {
          const submissionData = await api.getSubmission(data.submission_id)
          setSubmission(submissionData)
          
          // Load form details if form_id exists
          if (submissionData.form_id) {
            try {
              const formData = await api.getForm(submissionData.form_id)
              setForm(formData)
            } catch (err) {
              console.error('Failed to load form:', err)
              // Continue without form data
            }
          }
        } catch (err) {
          console.error('Failed to load submission:', err)
          // Continue without submission data
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

  const handleResubmit = async () => {
    if (!confirm('Are you sure you want to resubmit this lead magnet? This will create a new job with the same submission data.')) {
      return
    }

    setResubmitting(true)
    setError(null)

    try {
      const result = await api.resubmitJob(jobId)
      // Redirect to the new job
      router.push(`/dashboard/jobs/${result.job_id}`)
    } catch (error: any) {
      console.error('Failed to resubmit job:', error)
      setError(error.response?.data?.message || error.message || 'Failed to resubmit job')
    } finally {
      setResubmitting(false)
    }
  }

  const toggleStep = (stepOrder: number) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepOrder)) {
      newExpanded.delete(stepOrder)
    } else {
      newExpanded.add(stepOrder)
    }
    setExpandedSteps(newExpanded)
  }

  const isJSON = (str: string): boolean => {
    try {
      JSON.parse(str)
      return true
    } catch {
      return false
    }
  }

  const isMarkdown = (str: string): boolean => {
    if (typeof str !== 'string') return false
    // Check for common markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s+.+/m,           // Headers
      /\*\*.*?\*\*/,            // Bold
      /\*.*?\*/,                // Italic
      /\[.*?\]\(.*?\)/,         // Links
      /^[-*+]\s+/m,             // Lists
      /^\d+\.\s+/m,             // Numbered lists
      /```[\s\S]*?```/,         // Code blocks
      /`[^`]+`/,                // Inline code
    ]
    return markdownPatterns.some(pattern => pattern.test(str))
  }

  const formatStepInput = (step: any): { content: string | any, type: 'json' | 'markdown' | 'text', structure?: 'ai_input' } => {
    if (step.step_type === 'form_submission') {
      return { content: step.input, type: 'json' }
    }
    if (step.input && typeof step.input === 'object') {
      // For AI steps, show instructions and input
      const inputObj = step.input as any
      const inputText = inputObj.input || ''
      
      // Check if input text is markdown
      if (typeof inputText === 'string' && isMarkdown(inputText)) {
        return {
          content: {
            model: step.model || 'N/A',
            instructions: inputObj.instructions || 'N/A',
            input: inputText
          },
          type: 'markdown',
          structure: 'ai_input'
        }
      }
      
      // Otherwise return as JSON
      return {
        content: {
          model: step.model || 'N/A',
          instructions: inputObj.instructions || 'N/A',
          input: inputObj.input || inputObj
        },
        type: 'json',
        structure: 'ai_input'
      }
    }
    return { content: step.input, type: 'json' }
  }

  const formatStepOutput = (step: any): { content: string | any, type: 'json' | 'markdown' | 'text' } => {
    if (step.step_type === 'final_output') {
      return { content: step.output, type: 'json' }
    }
    if (typeof step.output === 'string') {
      // Check if it's JSON
      if (isJSON(step.output)) {
        try {
          return { content: JSON.parse(step.output), type: 'json' }
        } catch {
          // If parsing fails, treat as text
        }
      }
      // Check if it's Markdown
      if (isMarkdown(step.output)) {
        return { content: step.output, type: 'markdown' }
      }
      return { content: step.output, type: 'text' }
    }
    return { content: step.output, type: 'json' }
  }

  const renderContent = (formatted: { content: any, type: 'json' | 'markdown' | 'text', structure?: 'ai_input' }) => {
    if (formatted.type === 'json') {
      // For AI input structure, show model and instructions separately, then formatted JSON input
      if (formatted.structure === 'ai_input' && typeof formatted.content === 'object') {
        return (
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-gray-700">Model:</span>
              <span className="text-xs text-gray-900 ml-2">{formatted.content.model}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-700">Instructions:</span>
              <div className="text-xs text-gray-900 mt-1 whitespace-pre-wrap bg-gray-100 p-2 rounded max-h-48 overflow-y-auto">
                {formatted.content.instructions}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-700">Input:</span>
              <pre className="text-xs font-mono mt-1 bg-gray-100 p-2 rounded max-h-96 overflow-y-auto">
                <code>{typeof formatted.content.input === 'string' ? formatted.content.input : JSON.stringify(formatted.content.input, null, 2)}</code>
              </pre>
            </div>
          </div>
        )
      }
      return (
        <pre className="text-xs font-mono">
          <code>{JSON.stringify(formatted.content, null, 2)}</code>
        </pre>
      )
    }
    if (formatted.type === 'markdown') {
      // For AI input structure, show model and instructions separately, then render markdown input
      if (formatted.structure === 'ai_input' && typeof formatted.content === 'object') {
        const markdownContent = formatted.content.input || ''
        return (
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-gray-700">Model:</span>
              <span className="text-xs text-gray-900 ml-2">{formatted.content.model}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-700">Instructions:</span>
              <div className="text-xs text-gray-900 mt-1 whitespace-pre-wrap bg-gray-100 p-2 rounded">
                {formatted.content.instructions}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-700">Input:</span>
              <div className="prose prose-sm max-w-none mt-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdownContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )
      }
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {typeof formatted.content === 'string' ? formatted.content : formatted.content.input || JSON.stringify(formatted.content, null, 2)}
          </ReactMarkdown>
        </div>
      )
    }
    return <pre className="text-xs whitespace-pre-wrap font-mono">{formatted.content}</pre>
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
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
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lead Magnet Details</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">View details and status of your generated lead magnet</p>
          </div>
          <button
            onClick={handleResubmit}
            disabled={resubmitting}
            className="flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
          >
            <FiRefreshCw className={`w-4 h-4 mr-2 ${resubmitting ? 'animate-spin' : ''}`} />
            {resubmitting ? 'Resubmitting...' : 'Resubmit'}
          </button>
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
              <p className="text-sm text-gray-900">{formatDurationSeconds(duration)}</p>
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

      {/* Execution Steps */}
      {job.execution_steps && Array.isArray(job.execution_steps) && job.execution_steps.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <button
            onClick={() => setShowExecutionSteps(!showExecutionSteps)}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Execution Steps</h2>
            {showExecutionSteps ? (
              <FiChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <FiChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showExecutionSteps && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              {job.execution_steps.map((step: any, index: number) => {
                const isExpanded = expandedSteps.has(step.step_order)
                const stepTypeColors: Record<string, string> = {
                  form_submission: 'bg-blue-100 text-blue-800',
                  ai_generation: 'bg-purple-100 text-purple-800',
                  html_generation: 'bg-green-100 text-green-800',
                  final_output: 'bg-gray-100 text-gray-800',
                }
                const stepTypeColor = stepTypeColors[step.step_type] || 'bg-gray-100 text-gray-800'

                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${stepTypeColor}`}>
                          Step {step.step_order}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-900">{step.step_name}</h3>
                        {step.model && (
                          <span className="text-xs text-gray-500">({step.model})</span>
                        )}
                        {/* Display tools and tool_choice */}
                        {step.input?.tools && Array.isArray(step.input.tools) && step.input.tools.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">Tools:</span>
                            <div className="flex flex-wrap gap-1">
                              {step.input.tools.map((tool: any, toolIdx: number) => {
                                const toolName = typeof tool === 'string' ? tool : tool.type || 'unknown'
                                return (
                                  <span key={toolIdx} className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
                                    {toolName}
                                  </span>
                                )
                              })}
                            </div>
                            {step.input.tool_choice && (
                              <span className="text-xs text-gray-500">
                                ({step.input.tool_choice})
                              </span>
                            )}
                          </div>
                        )}
                        {step.input?.tool_choice === 'none' && (!step.input?.tools || (Array.isArray(step.input.tools) && step.input.tools.length === 0)) && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
                            No tools
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        {step.duration_ms !== undefined && (
                          <span>{formatDurationMs(step.duration_ms)}</span>
                        )}
                        {step.usage_info && (
                          <span>
                            {step.usage_info.input_tokens + step.usage_info.output_tokens} tokens
                            {step.usage_info.cost_usd && ` • $${step.usage_info.cost_usd.toFixed(4)}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => toggleStep(step.step_order)}
                        className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900"
                      >
                        <span className="font-medium">Input</span>
                        {isExpanded ? (
                          <FiChevronUp className="w-4 h-4" />
                        ) : (
                          <FiChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">Input</span>
                              <button
                                onClick={() => {
                                  const formatted = formatStepInput(step)
                                  const text = formatted.type === 'json' 
                                    ? JSON.stringify(formatted.content, null, 2)
                                    : typeof formatted.content === 'string' 
                                      ? formatted.content 
                                      : formatted.content.input || JSON.stringify(formatted.content, null, 2)
                                  copyToClipboard(text)
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                              >
                                <FiCopy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto max-h-96 overflow-y-auto">
                              {renderContent(formatStepInput(step))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">Output</span>
                              <button
                                onClick={() => {
                                  const formatted = formatStepOutput(step)
                                  const text = formatted.type === 'json' 
                                    ? JSON.stringify(formatted.content, null, 2)
                                    : typeof formatted.content === 'string' 
                                      ? formatted.content 
                                      : JSON.stringify(formatted.content, null, 2)
                                  copyToClipboard(text)
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                              >
                                <FiCopy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto max-h-96 overflow-y-auto">
                              {renderContent(formatStepOutput(step))}
                            </div>
                            {/* Display image URLs if present */}
                            {step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0 && (
                              <div className="mt-3">
                                <span className="text-xs font-medium text-gray-700 mb-2 block">Generated Images:</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {step.image_urls.map((imageUrl: string, imgIdx: number) => (
                                    <div key={imgIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                                      <img 
                                        src={imageUrl} 
                                        alt={`Generated image ${imgIdx + 1}`}
                                        className="w-full h-auto"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none'
                                        }}
                                      />
                                      <div className="p-2 bg-gray-100">
                                        <a 
                                          href={imageUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:text-blue-800 break-all"
                                        >
                                          {imageUrl}
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {step.artifact_id && (
                            <div className="text-xs text-gray-500">
                              Artifact ID: <span className="font-mono">{step.artifact_id}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
                  {form?.public_slug ? (
                    <a
                      href={`/v1/forms/${form.public_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-primary-600 hover:text-primary-900 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {job.submission_id}
                      <FiExternalLink className="w-3 h-3 ml-1 inline" />
                    </a>
                  ) : (
                    <p className="text-sm font-mono text-gray-900">{job.submission_id}</p>
                  )}
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
                      <a
                        href="/dashboard/artifacts"
                        className="text-sm font-mono text-primary-600 hover:text-primary-900 hover:underline"
                        onClick={(e) => {
                          e.preventDefault()
                          router.push('/dashboard/artifacts')
                        }}
                      >
                        {artifactId}
                        <FiExternalLink className="w-3 h-3 ml-1 inline" />
                      </a>
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

