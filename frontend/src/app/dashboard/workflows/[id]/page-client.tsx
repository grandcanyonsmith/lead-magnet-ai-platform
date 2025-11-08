'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiEdit, FiTrash2, FiClock, FiCheckCircle, FiXCircle, FiExternalLink, FiLink } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function WorkflowDetailPage() {
  const router = useRouter()
  const params = useParams()
  // Extract workflow ID from params, or fallback to URL pathname if param is '_' (Vercel rewrite)
  const getWorkflowId = () => {
    const paramId = params?.id as string
    if (paramId && paramId !== '_') {
      return paramId
    }
    // Fallback: extract from browser URL
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/dashboard\/workflows\/([^/]+)/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_') {
        return pathMatch[1]
      }
    }
    return paramId || ''
  }
  const workflowId = getWorkflowId()
  
  const [workflow, setWorkflow] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingForm, setCreatingForm] = useState(false)

  useEffect(() => {
    if (workflowId) {
      Promise.all([loadWorkflow(), loadJobs()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const loadWorkflow = async () => {
    try {
      const data = await api.getWorkflow(workflowId)
      setWorkflow(data)
      setError(null)
    } catch (error: any) {
      console.error('Failed to load workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load workflow')
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    try {
      const data = await api.getJobs({ workflow_id: workflowId, limit: 10 })
      const jobsList = data.jobs || []
      setJobs(jobsList)
      
      // Load submissions for each job
      const submissionsMap: Record<string, any> = {}
      for (const job of jobsList) {
        if (job.submission_id) {
          try {
            const submission = await api.getSubmission(job.submission_id)
            submissionsMap[job.job_id] = submission
          } catch (error) {
            console.error(`Failed to load submission for job ${job.job_id}:`, error)
          }
        }
      }
      setSubmissions(submissionsMap)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${workflow?.workflow_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await api.deleteWorkflow(workflowId)
      router.push('/dashboard/workflows')
    } catch (error: any) {
      console.error('Failed to delete workflow:', error)
      alert(error.response?.data?.message || error.message || 'Failed to delete workflow')
    }
  }

  const handleCreateForm = async () => {
    if (!workflow) return
    
    setCreatingForm(true)
    setError(null)
    
    try {
      // Generate a valid slug (lowercase, alphanumeric and hyphens only)
      const baseSlug = workflow.workflow_name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      
      // Create a form with default fields
      const formData = {
        workflow_id: workflowId,
        form_name: `${workflow.workflow_name} Form`,
        public_slug: baseSlug || `form-${workflowId.slice(-8)}`, // Fallback if slug is empty
        form_fields_schema: {
          fields: [
            { field_id: 'field_1', field_type: 'text', label: 'Name', placeholder: 'Your name', required: true },
            { field_id: 'field_2', field_type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
            { field_id: 'field_3', field_type: 'text', label: 'Industry', placeholder: 'Your industry', required: false },
            { field_id: 'field_4', field_type: 'textarea', label: 'Description', placeholder: 'Tell us about your needs', required: false },
            { field_id: 'field_5', field_type: 'tel', label: 'Phone', placeholder: 'Your phone number', required: false },
          ],
        },
        rate_limit_enabled: true,
        rate_limit_per_hour: 10,
        captcha_enabled: false,
      }
      
      await api.createForm(formData)
      
      // Reload workflow to get the new form
      await loadWorkflow()
    } catch (error: any) {
      console.error('Failed to create form:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create form'
      setError(errorMessage)
    } finally {
      setCreatingForm(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      draft: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <FiXCircle className="w-4 h-4 text-red-600" />
      case 'processing':
        return <FiClock className="w-4 h-4 text-blue-600 animate-spin" />
      default:
        return <FiClock className="w-4 h-4 text-yellow-600" />
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading workflow...</p>
      </div>
    )
  }

  if (error && !workflow) {
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

  if (!workflow) {
    return null
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base py-2 touch-target"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        {error && (
          <div className="mb-3 sm:mb-4 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
            {error}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{workflow.workflow_name}</h1>
            {workflow.workflow_description && (
              <p className="text-sm sm:text-base text-gray-600 mt-1">{workflow.workflow_description}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => router.push(`/dashboard/workflows/${workflowId}/edit`)}
              className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base touch-target"
            >
              <FiEdit className="w-4 h-4 mr-2" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base touch-target"
            >
              <FiTrash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Workflow Details */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4 sm:space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Workflow Details</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div>{getStatusBadge(workflow.status || 'draft')}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
            <p className="text-sm text-gray-900 break-words">{workflow.ai_model || 'gpt-5'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rewrite Model</label>
            <p className="text-sm text-gray-900 break-words">{workflow.rewrite_model || 'gpt-5'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Rewriting</label>
            <p className="text-sm text-gray-900">{workflow.rewrite_enabled ? 'Enabled' : 'Disabled'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template ID</label>
            <p className="text-sm text-gray-900 font-mono break-all">{workflow.template_id || '-'}</p>
            {workflow.template_version && (
              <p className="text-xs text-gray-500 mt-1">Version {workflow.template_version}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Form</label>
            {workflow.form ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-900 font-medium break-words">{workflow.form.form_name || 'Form'}</p>
                  {workflow.form.public_slug && (
                    <p className="text-xs text-gray-500 mt-1 font-mono break-all">/{workflow.form.public_slug}</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {workflow.form.public_slug && (
                    <a
                      href={`/v1/forms/${workflow.form.public_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-3 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-target"
                    >
                      <FiExternalLink className="w-4 h-4 mr-1.5" />
                      View Form
                    </a>
                  )}
                  {workflow.form.form_id && (
                    <button
                      onClick={() => router.push(`/dashboard/forms/${workflow.form.form_id}/edit`)}
                      className="inline-flex items-center justify-center px-4 py-3 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors touch-target"
                    >
                      <FiEdit className="w-4 h-4 mr-1.5" />
                      Edit Form
                    </button>
                  )}
                </div>
                {workflow.form.public_slug && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Public Form URL</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={typeof window !== 'undefined' ? `${window.location.origin}/v1/forms/${workflow.form.public_slug}` : `/v1/forms/${workflow.form.public_slug}`}
                        className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 break-all"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => {
                          const url = typeof window !== 'undefined' 
                            ? `${window.location.origin}/v1/forms/${workflow.form.public_slug}`
                            : `/v1/forms/${workflow.form.public_slug}`
                          navigator.clipboard.writeText(url)
                        }}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0 touch-target"
                        title="Copy URL"
                      >
                        <FiLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">No form attached to this lead magnet yet.</p>
                <button
                  onClick={handleCreateForm}
                  disabled={creatingForm}
                  className="inline-flex items-center justify-center px-4 py-3 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                >
                  {creatingForm ? (
                    <>
                      <FiClock className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FiLink className="w-4 h-4 mr-2" />
                      Create Form
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {workflow.delivery_webhook_url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
              <p className="text-sm text-gray-900 break-all">{workflow.delivery_webhook_url}</p>
            </div>
          )}

          {workflow.delivery_phone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Phone</label>
              <p className="text-sm text-gray-900 break-words">{workflow.delivery_phone}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
            <p className="text-sm text-gray-900">
              {workflow.created_at ? new Date(workflow.created_at).toLocaleString() : '-'}
            </p>
          </div>

          {workflow.updated_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
              <p className="text-sm text-gray-900">{new Date(workflow.updated_at).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* AI Instructions */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Instructions</h2>
          <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-3 sm:p-4 overflow-x-auto break-words">
            {workflow.ai_instructions ? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0 break-words" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1 break-words" {...props} />,
                  code: ({node, ...props}) => <code className="break-all whitespace-pre-wrap" {...props} />,
                }}
              >
                {workflow.ai_instructions}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-500 text-sm">No instructions provided</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No jobs found for this workflow</p>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {jobs.map((job) => {
              const duration = job.completed_at
                ? Math.round(
                    (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000
                  )
                : null
              const submission = submissions[job.job_id]

              return (
                <div key={job.job_id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
                    <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                      {getJobStatusIcon(job.status)}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                          className="text-xs sm:text-sm font-mono text-gray-900 break-all hover:text-primary-600 transition-colors text-left w-full touch-target py-1"
                        >
                          {job.job_id}
                        </button>
                        <div className="text-xs text-gray-500 mt-1">
                          Created: {new Date(job.created_at).toLocaleString()}
                          {duration !== null && ` • Duration: ${duration}s`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                      <button
                        onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                        className="px-3 py-1.5 text-xs sm:text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors touch-target"
                      >
                        View
                      </button>
                    </div>
                  </div>
                  
                  {submission && submission.submission_data && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Form Submission Details</h3>
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(submission.submission_data).map(([key, value]: [string, any]) => (
                            <div key={key}>
                              <dt className="text-xs font-medium text-gray-500 uppercase">{key}</dt>
                              <dd className="mt-1 text-sm text-gray-900 break-words">
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

