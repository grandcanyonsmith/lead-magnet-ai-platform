'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/shared/lib/api'
import { FiArrowLeft, FiEdit, FiTrash2, FiClock, FiCheckCircle, FiXCircle, FiExternalLink, FiLink, FiZap, FiSettings, FiFileText, FiCalendar, FiCopy } from 'react-icons/fi'
import { useWorkflowId } from '@/features/workflows/hooks/useWorkflowId'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'

export default function WorkflowDetailPage() {
  const router = useRouter()
  const workflowId = useWorkflowId()
  
  const [workflow, setWorkflow] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingForm, setCreatingForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    setDeleting(true)
    try {
      await api.deleteWorkflow(workflowId)
      router.push('/dashboard/workflows')
    } catch (error: any) {
      console.error('Failed to delete workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to delete workflow')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
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
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-ink-600">Loading workflow...</p>
        </div>
      </div>
    )
  }

  if (error && !workflow) {
    return (
      <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-ink-600 hover:text-ink-900 mb-4"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl">
        {error}
      </div>
    </div>
  )
}

  if (!workflow) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-600">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-white/60 shadow-soft hover:bg-white/80 transition-colors touch-target"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm sm:text-base">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-ink-900">{workflow.workflow_name}</h1>
            {workflow.workflow_description && (
              <p className="text-sm sm:text-base text-ink-600">{workflow.workflow_description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-ink-600">
              {workflow.status && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/60 bg-surface-50 font-medium">
                  Status: {workflow.status}
                </span>
              )}
              {workflow.template_version && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/60 bg-surface-50 font-medium">
                  Template v{workflow.template_version}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => router.push(`/dashboard/workflows/${workflowId}/edit`)}
              className="flex items-center justify-center px-4 py-3 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors text-sm sm:text-base touch-target shadow-soft"
            >
              <FiEdit className="w-4 h-4 mr-2" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-colors text-sm sm:text-base touch-target"
            >
              <FiTrash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Workflow Details */}
        <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-6">
            <FiSettings className="w-5 h-5 text-ink-600" />
            <h2 className="text-lg font-semibold text-ink-900">Workflow Details</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Template ID</label>
              <div className="bg-surface-50 rounded-2xl p-3 border border-white/60">
                <p className="text-xs font-mono text-ink-900 break-all">{workflow.template_id || '-'}</p>
                {workflow.template_version && (
                  <p className="text-xs text-ink-500 mt-1">Version {workflow.template_version}</p>
                )}
              </div>
            </div>

            <div className="pb-4 border-b border-white/60">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">
                <FiFileText className="w-3.5 h-3.5" />
                Form
              </label>
              {workflow.form ? (
                <div className="space-y-3">
                  <div className="bg-surface-50 rounded-2xl p-3 border border-white/60">
                    <p className="text-sm font-semibold text-ink-900 break-words">{workflow.form.form_name || 'Form'}</p>
                    {workflow.form.public_slug && (
                      <p className="text-xs text-ink-500 mt-1 font-mono break-all">/{workflow.form.public_slug}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {workflow.form.public_slug && (
                      <a
                        href={`/v1/forms/${workflow.form.public_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors touch-target shadow-soft"
                      >
                        <FiExternalLink className="w-4 h-4 mr-1.5" />
                        View Form
                      </a>
                    )}
                    {workflow.form.form_id && (
                      <button
                        onClick={() => router.push(`/dashboard/forms/${workflow.form.form_id}/edit`)}
                        className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium border border-white/60 text-ink-700 rounded-2xl hover:bg-surface-100 transition-colors touch-target"
                      >
                        <FiEdit className="w-4 h-4 mr-1.5" />
                        Edit Form
                      </button>
                    )}
                  </div>
                  {workflow.form.public_slug && (
                    <div className="bg-brand-50/70 border border-brand-100 rounded-2xl p-3">
                      <label className="block text-xs font-semibold text-brand-900 mb-2">Public Form URL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/v1/forms/${workflow.form.public_slug}` : `/v1/forms/${workflow.form.public_slug}`}
                          className="flex-1 text-xs font-mono bg-white border border-brand-200 rounded-2xl px-3 py-2 text-ink-900 break-all focus:outline-none focus:ring-2 focus:ring-brand-500"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            const url = typeof window !== 'undefined' 
                              ? `${window.location.origin}/v1/forms/${workflow.form.public_slug}`
                              : `/v1/forms/${workflow.form.public_slug}`
                            navigator.clipboard.writeText(url)
                          }}
                          className="p-2.5 text-brand-700 hover:text-brand-900 hover:bg-brand-100 rounded-2xl transition-colors flex-shrink-0 touch-target border border-brand-200"
                          title="Copy URL"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface-50 rounded-2xl p-4 border border-white/60 text-center">
                  <p className="text-sm text-ink-600 mb-3">No form attached to this lead magnet yet.</p>
                  <button
                    onClick={handleCreateForm}
                    disabled={creatingForm}
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target shadow-soft"
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
                <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Webhook URL</label>
                <div className="bg-surface-50 rounded-2xl p-3 border border-white/60">
                  <p className="text-xs font-mono text-ink-900 break-all">{workflow.delivery_webhook_url}</p>
                </div>
              </div>
            )}

            {workflow.delivery_phone && (
              <div>
                <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Delivery Phone</label>
                <p className="text-sm font-medium text-ink-900 break-words">{workflow.delivery_phone}</p>
              </div>
            )}

            <div className="pt-4 border-t border-white/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">
                <FiCalendar className="w-3.5 h-3.5" />
                Timeline
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-ink-500 mb-1">Created</label>
                  <p className="text-sm font-medium text-ink-900">
                    {workflow.created_at ? new Date(workflow.created_at).toLocaleString() : '-'}
                  </p>
                </div>
                {workflow.updated_at && (
                  <div>
                    <label className="block text-xs text-ink-500 mb-1">Last Updated</label>
                    <p className="text-sm font-medium text-ink-900">{new Date(workflow.updated_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Jobs */}
      <div className="mt-4 sm:mt-6 bg-white rounded-2xl shadow-soft border border-white/60 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-6">
          <FiClock className="w-5 h-5 text-ink-600" />
          <h2 className="text-lg font-semibold text-ink-900">Recent Jobs</h2>
        </div>
        {jobs.length === 0 ? (
          <p className="text-ink-500 text-sm">No jobs found for this workflow</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/60">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Job ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Submission</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-ink-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-white/60">
                {jobs.map((job) => {
                  const duration = job.completed_at
                    ? Math.round(
                        (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000
                      )
                    : null
                  const submission = submissions[job.job_id]

                  return (
                    <tr key={job.job_id} className="hover:bg-surface-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                          className="text-xs font-mono text-ink-900 hover:text-brand-600 transition-colors text-left"
                        >
                          {job.job_id}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-600">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-600">
                        {duration !== null ? `${duration}s` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        {submission && submission.submission_data ? (
                          <div className="max-w-xs">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(submission.submission_data).slice(0, 4).map(([key, value]: [string, any]) => (
                                <div key={key} className="truncate">
                                  <span className="font-medium text-ink-500">{key}:</span>{' '}
                                  <span className="text-ink-900">{String(value).substring(0, 20)}{String(value).length > 20 ? '...' : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                          className="text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-2xl transition-colors"
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
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete lead magnet?"
        description={
          <span>
            This will delete <span className="font-semibold">{workflow.workflow_name}</span> and its associated form.
            This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
