'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiEdit, FiTrash2, FiClock, FiCheckCircle, FiXCircle, FiExternalLink, FiLink, FiZap, FiSettings, FiFileText, FiCalendar, FiCopy } from 'react-icons/fi'
import { useWorkflowId } from '@/hooks/useWorkflowId'

export default function WorkflowDetailPage() {
  const router = useRouter()
  const workflowId = useWorkflowId()
  
  const [workflow, setWorkflow] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingForm, setCreatingForm] = useState(false)

  useEffect(() => {
    if (!workflowId || workflowId.trim() === '' || workflowId === '_') {
      return
    }
    Promise.all([loadWorkflow(workflowId), loadJobs(workflowId)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const loadWorkflow = async (id: string = workflowId) => {
    try {
      const data = await api.getWorkflow(id)
      setWorkflow(data)
      setError(null)
    } catch (error: any) {
      console.error('Failed to load workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load workflow')
      setLoading(false)
    }
  }

  const loadJobs = async (id: string = workflowId) => {
    try {
      const data = await api.getJobs({ workflow_id: id, limit: 10 })
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
            { field_id: 'field_1', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
            { field_id: 'field_2', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
            { field_id: 'field_3', field_type: 'text' as const, label: 'Industry', placeholder: 'Your industry', required: false },
            { field_id: 'field_4', field_type: 'textarea' as const, label: 'Description', placeholder: 'Tell us about your needs', required: false },
            { field_id: 'field_5', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: false },
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-6">
            <FiSettings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Workflow Details</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Template ID</label>
              <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                <p className="text-xs font-mono text-gray-900 break-all">{workflow.template_id || '-'}</p>
                {workflow.template_version && (
                  <p className="text-xs text-gray-500 mt-1">Version {workflow.template_version}</p>
                )}
              </div>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                <FiFileText className="w-3.5 h-3.5" />
                Form
              </label>
              {workflow.form ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-900 break-words">{workflow.form.form_name || 'Form'}</p>
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
                        className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-target"
                      >
                        <FiExternalLink className="w-4 h-4 mr-1.5" />
                        View Form
                      </a>
                    )}
                    {workflow.form.form_id && (
                      <button
                        onClick={() => router.push(`/dashboard/forms/${workflow.form.form_id}/edit`)}
                        className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors touch-target"
                      >
                        <FiEdit className="w-4 h-4 mr-1.5" />
                        Edit Form
                      </button>
                    )}
                  </div>
                  {workflow.form.public_slug && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <label className="block text-xs font-semibold text-blue-900 mb-2">Public Form URL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/v1/forms/${workflow.form.public_slug}` : `/v1/forms/${workflow.form.public_slug}`}
                          className="flex-1 text-xs font-mono bg-white border border-blue-200 rounded px-3 py-2 text-gray-900 break-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            const url = typeof window !== 'undefined' 
                              ? `${window.location.origin}/v1/forms/${workflow.form.public_slug}`
                              : `/v1/forms/${workflow.form.public_slug}`
                            navigator.clipboard.writeText(url)
                          }}
                          className="p-2.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0 touch-target border border-blue-200"
                          title="Copy URL"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600 mb-3">No form attached to this lead magnet yet.</p>
                  <button
                    onClick={handleCreateForm}
                    disabled={creatingForm}
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Webhook URL</label>
                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <p className="text-xs font-mono text-gray-900 break-all">{workflow.delivery_webhook_url}</p>
                </div>
              </div>
            )}

            {workflow.delivery_phone && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Delivery Phone</label>
                <p className="text-sm font-medium text-gray-900 break-words">{workflow.delivery_phone}</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                <FiCalendar className="w-3.5 h-3.5" />
                Timeline
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Created</label>
                  <p className="text-sm font-medium text-gray-900">
                    {workflow.created_at ? new Date(workflow.created_at).toLocaleString() : '-'}
                  </p>
                </div>
                {workflow.updated_at && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Last Updated</label>
                    <p className="text-sm font-medium text-gray-900">{new Date(workflow.updated_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Jobs */}
      <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-6">
          <FiClock className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
        </div>
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No jobs found for this workflow</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => {
                  const duration = job.completed_at
                    ? Math.round(
                        (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000
                      )
                    : null
                  const submission = submissions[job.job_id]

                  return (
                    <tr key={job.job_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                          className="text-xs font-mono text-gray-900 hover:text-primary-600 transition-colors text-left"
                        >
                          {job.job_id}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {duration !== null ? `${duration}s` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {submission && submission.submission_data ? (
                          <div className="max-w-xs">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(submission.submission_data).slice(0, 4).map(([key, value]: [string, any]) => (
                                <div key={key} className="truncate">
                                  <span className="font-medium text-gray-500">{key}:</span>{' '}
                                  <span className="text-gray-900">{String(value).substring(0, 20)}{String(value).length > 20 ? '...' : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                          className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

