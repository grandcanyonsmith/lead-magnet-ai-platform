'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useSettings } from '@/hooks/api/useSettings'
import { buildPublicFormUrl } from '@/utils/url'
import { 
  ArrowLeftIcon, 
  PencilIcon, 
  TrashIcon, 
  ClockIcon, 
  ArrowTopRightOnSquareIcon, 
  LinkIcon, 
  Cog6ToothIcon, 
  DocumentTextIcon, 
  CalendarIcon,
  ChevronRightIcon,
  FingerPrintIcon,
  IdentificationIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function WorkflowDetailPage() {
  const router = useRouter()
  const params = useParams()
  // Extract workflow ID from params, or fallback to URL pathname if param is '_' (static export edge rewrite)
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
  const { settings } = useSettings()

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
      toast.error(error.response?.data?.message || error.message || 'Failed to delete lead magnet')
    }
  }

  const handleCreateForm = async () => {
    if (!workflow) return
    
    setCreatingForm(true)
    setError(null)
    
    try {
      // Generate a valid slug
      const baseSlug = workflow.workflow_name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      
      const formData = {
        workflow_id: workflowId,
        form_name: `${workflow.workflow_name} Form`,
        public_slug: baseSlug || `form-${workflowId.slice(-8)}`,
        form_fields_schema: {
          fields: [],
        },
        rate_limit_enabled: true,
        rate_limit_per_hour: 10,
        captcha_enabled: false,
      }
      
      await api.createForm(formData)
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
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="flex justify-between items-end">
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="h-4 bg-gray-100 rounded w-96"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 rounded-lg w-24"></div>
            <div className="h-10 bg-gray-200 rounded-lg w-24"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-white border border-gray-200 rounded-xl"></div>
          <div className="h-96 bg-white border border-gray-200 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (error && !workflow) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <button
          onClick={() => router.back()}
          className="group flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm flex items-start gap-3">
          <TrashIcon className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold">Error loading workflow</h3>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!workflow) return null

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="group flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
          Back to Workflows
        </button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight truncate">
              {workflow.workflow_name}
            </h1>
            {workflow.workflow_description ? (
              <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-3xl">
                {workflow.workflow_description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-400 italic">No description provided</p>
            )}
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => router.push(`/dashboard/workflows/${workflowId}/edit`)}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-all shadow-sm text-sm"
            >
              <PencilIcon className="w-4 h-4 mr-2" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 border border-red-100 font-bold rounded-lg hover:bg-red-100 transition-all text-sm"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Info & Form */}
        <div className="lg:col-span-2 space-y-8">
          {/* Form Status Card */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IdentificationIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Public Form</h2>
              </div>
              {workflow.form && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                  Active
                </span>
              )}
            </div>
            
            <div className="p-6">
              {workflow.form ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">{workflow.form.form_name}</h3>
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        {workflow.form.public_slug && buildPublicFormUrl(workflow.form.public_slug, settings?.custom_domain)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                      href={workflow.form.public_slug ? buildPublicFormUrl(workflow.form.public_slug, settings?.custom_domain) : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-md active:scale-[0.98]"
                    >
                      <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                      View Public Form
                    </a>
                    <button
                      onClick={() => router.push(`/dashboard/forms/${workflow.form.form_id}/edit`)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <PencilIcon className="w-5 h-5 text-gray-400" />
                      Configure Fields
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
                  <div className="mx-auto h-12 w-12 text-gray-300 mb-3">
                    <LinkIcon className="h-full w-full" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">No Form Linked</h3>
                  <p className="mt-1 text-sm text-gray-500 mb-6">Create a form to start collecting leads for this magnet.</p>
                  <button
                    onClick={handleCreateForm}
                    disabled={creatingForm}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {creatingForm ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="w-5 h-5" />
                        Create Form
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Configuration Summary */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Cog6ToothIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Asset Configuration</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <FingerPrintIcon className="h-3.5 w-3.5" />
                    Internal IDs
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Template ID</p>
                      <p className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded inline-block">
                        {workflow.template_id || 'None'}
                      </p>
                    </div>
                    {workflow.template_version && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">Template Version</p>
                        <p className="text-sm font-medium text-gray-900">v{workflow.template_version}</p>
                      </div>
                    )}
                  </div>
                </div>

                {workflow.delivery_webhook_url && (
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" />
                      External Integration
                    </h4>
                    <p className="text-[10px] text-gray-400 mb-0.5">Webhook Endpoint</p>
                    <p className="text-xs font-mono text-gray-700 bg-blue-50/50 px-2 py-1 rounded break-all leading-relaxed border border-blue-100">
                      {workflow.delivery_webhook_url}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-6 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Timeline
                  </h4>
                  <div className="space-y-4 mt-3">
                    <div className="relative pl-4 border-l-2 border-gray-100 py-0.5">
                      <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-gray-200 border-2 border-white" />
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Created</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {workflow.created_at ? new Date(workflow.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </p>
                    </div>
                    <div className="relative pl-4 border-l-2 border-primary-100 py-0.5">
                      <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-primary-500 border-2 border-white shadow-sm" />
                      <p className="text-[10px] text-primary-500 uppercase font-bold">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {workflow.updated_at ? new Date(workflow.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {workflow.delivery_phone && (
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                      SMS Alerts
                    </h4>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg inline-block">
                      {workflow.delivery_phone}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar: Recent Runs */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Recent Runs</h2>
              </div>
              <button 
                onClick={() => router.push(`/dashboard/jobs?workflow_id=${workflowId}`)}
                className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-0.5 group"
              >
                View all
                <ChevronRightIcon className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            
            <div className="divide-y divide-gray-100">
              {jobs.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="h-10 w-10 text-gray-200 mx-auto mb-3">
                    <DocumentTextIcon className="h-full w-full" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium tracking-tight">No generation history yet</p>
                </div>
              ) : (
                jobs.map((job) => {
                  const duration = job.completed_at
                    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
                    : null
                  
                  return (
                    <div 
                      key={job.job_id} 
                      onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                      className="group p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-gray-400 group-hover:text-primary-500 transition-colors">
                          {job.job_id.slice(-8).toUpperCase()}
                        </span>
                        <div className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight shadow-sm",
                          job.status === 'completed' ? "bg-green-100 text-green-700" :
                          job.status === 'failed' ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {job.status}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-600 line-clamp-1">
                            {job.created_at ? new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        {duration !== null && (
                          <span className="text-[10px] font-bold text-gray-400 shrink-0">
                            {duration}s
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
