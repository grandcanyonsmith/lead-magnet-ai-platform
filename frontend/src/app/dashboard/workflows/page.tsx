'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Transition } from '@headlessui/react'
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiMoreVertical,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiActivity,
  FiClock,
  FiFileText,
} from 'react-icons/fi'
import { Workflow } from '@/features/workflows/types'
import { useWorkflows } from '@/features/workflows/hooks/workflows-extra/useWorkflows'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { api } from '@/shared/lib/api'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

export default function WorkflowsPage() {
  const router = useRouter()
  const { 
    workflows, 
    loading, 
    loadWorkflows, 
    deleteWorkflow,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
  } = useWorkflows()
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set())
  const [workflowJobs, setWorkflowJobs] = useState<Record<string, any[]>>({})
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({})
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const toggleWorkflow = async (workflowId: string) => {
    const newExpanded = new Set(expandedWorkflows)
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId)
    } else {
      newExpanded.add(workflowId)
      // Load jobs for this workflow if not already loaded
      if (!workflowJobs[workflowId] && !loadingJobs[workflowId]) {
        setLoadingJobs(prev => ({ ...prev, [workflowId]: true }))
        try {
          const data = await api.getJobs({ workflow_id: workflowId, limit: 50 })
          setWorkflowJobs(prev => ({ ...prev, [workflowId]: data.jobs || [] }))
        } catch (error) {
          console.error('Failed to load jobs:', error)
        } finally {
          setLoadingJobs(prev => ({ ...prev, [workflowId]: false }))
        }
      }
    }
    setExpandedWorkflows(newExpanded)
  }

  const workflowStatusStyles = useMemo(
    () => ({
      active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      inactive: 'bg-ink-100 text-ink-700 border-ink-200',
      draft: 'bg-amber-50 text-amber-700 border-amber-100',
    }),
    []
  )

  const jobStatusStyles = useMemo(
    () => ({
      completed: {
        label: 'Ready',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
      processing: {
        label: 'Generating...',
        classes: 'bg-brand-50 text-brand-700 border-brand-100',
      },
      failed: {
        label: 'Error',
        classes: 'bg-red-50 text-red-700 border-red-100',
      },
      queued: {
        label: 'Queued',
        classes: 'bg-amber-50 text-amber-700 border-amber-100',
      },
      pending: {
        label: 'Queued',
        classes: 'bg-amber-50 text-amber-700 border-amber-100',
      },
    }),
    []
  )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteError('')
    setDeleting(true)
    const success = await deleteWorkflow(deleteTarget.workflow_id)
    setDeleting(false)
    if (!success) {
      setDeleteError('Failed to delete lead magnet. Please try again.')
      return
    }
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-8 bg-ink-200 rounded w-48 mb-6 animate-pulse" />
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl shadow-soft border border-white/60 animate-pulse" />
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Lead Magnets</h1>
          <p className="text-ink-600 mt-1 text-sm">
            Organize your workflows, review runs, and manage delivery for each magnet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push('/dashboard/workflows/new')}
            className="flex items-center px-4 py-3 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            <FiPlus className="w-5 h-5 mr-2" />
            Create lead magnet
          </button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-white/60 shadow-soft p-12 text-center">
          <p className="text-ink-600 mb-4">No lead magnets yet.</p>
          <button
            onClick={() => router.push('/dashboard/workflows/new')}
            className="px-5 py-3 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors shadow-soft"
          >
            Create Lead Magnet
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {deleteError && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl px-4 py-3">
              {deleteError}
                              </div>
                            )}

          {workflows.map((workflow) => {
            const isExpanded = expandedWorkflows.has(workflow.workflow_id)
                              const jobs = workflowJobs[workflow.workflow_id] || []
            const isLoading = loadingJobs[workflow.workflow_id]
            const statusClass =
              workflowStatusStyles[
                workflow.status as keyof typeof workflowStatusStyles
              ] || workflowStatusStyles.active
            const formLabel = workflow.form?.public_slug
              ? `Form: ${workflow.form.public_slug}`
              : workflow.form?.form_name
                ? `Form: ${workflow.form.form_name}`
                : 'No form attached'

                                return (
              <div
                key={workflow.workflow_id}
                className="bg-white rounded-2xl border border-white/60 shadow-soft overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex items-start gap-3">
                                      <button
                    onClick={() => toggleWorkflow(workflow.workflow_id)}
                    className="p-3 rounded-2xl bg-surface-100 text-ink-700 hover:text-ink-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                    aria-label={isExpanded ? 'Collapse workflow' : 'Expand workflow'}
                  >
                    {isExpanded ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
                                      </button>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)}
                        className="text-left"
                      >
                        <div className="text-base font-semibold text-ink-900 truncate">
                          {workflow.workflow_name}
                        </div>
                      </button>
                      <span
                        className={`w-fit px-3 py-1 text-xs font-medium rounded-full border ${statusClass}`}
                      >
                        {workflow.status === 'draft'
                          ? 'Draft'
                          : workflow.status === 'inactive'
                            ? 'Paused'
                            : 'Active'}
                      </span>
                  </div>
                  
                    {workflow.workflow_description && (
                      <p className="text-sm text-ink-600 line-clamp-2">{workflow.workflow_description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-600">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-100 border border-white/60">
                        <FiFileText className="w-4 h-4" />
                        {formLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-100 border border-white/60">
                        <FiActivity className="w-4 h-4" />
                        Steps: {workflow.steps?.length ?? 0}
                          </span>
                      {workflow.template_version && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-100 border border-white/60">
                          v{workflow.template_version}
                            </span>
                          )}
                        </div>
                      </div>
                      
                  <Menu as="div" className="relative">
                    <Menu.Button className="p-2 text-ink-500 hover:text-ink-900 hover:bg-white/80 rounded-2xl transition-colors">
                      <FiMoreVertical className="w-5 h-5" />
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-lg border border-white/60 z-10 py-1">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                              active ? 'bg-surface-100' : ''
                            }`}
                                >
                                  <FiEdit className="w-4 h-4 mr-2" />
                                  Edit
                                </button>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                                <button
                            onClick={() => setDeleteTarget(workflow)}
                            className={`w-full text-left px-4 py-2 text-sm text-red-600 flex items-center ${
                              active ? 'bg-red-50/60' : ''
                            }`}
                                >
                                  <FiTrash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Menu>
                </div>

                <Transition
                  show={isExpanded}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 max-h-0"
                  enterTo="opacity-100 max-h-screen"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 max-h-screen"
                  leaveTo="opacity-0 max-h-0"
                >
                  <div className="border-t border-white/60 px-4 py-3">
                    {isLoading ? (
                      <div className="text-sm text-ink-500 py-2 flex items-center gap-2">
                        <FiClock className="w-4 h-4" />
                        Loading runs...
                      </div>
                    ) : jobs.length === 0 ? (
                      <div className="text-sm text-ink-500 py-2">No runs yet</div>
                    ) : (
                      <div className="space-y-2">
                        {jobs.map((job) => (
                                      <button
                            key={job.job_id}
                            onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                            className="w-full text-left p-3 bg-white/50 rounded-2xl border border-white/60 hover:bg-white/80 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                    jobStatusStyles[job.status as keyof typeof jobStatusStyles]?.classes ||
                                    jobStatusStyles.pending.classes
                                  }`}
                                >
                                  {jobStatusStyles[job.status as keyof typeof jobStatusStyles]?.label ||
                                    jobStatusStyles.pending.label}
                                </div>
                                {job.created_at && (
                                  <div className="text-xs text-ink-500 mt-1">
                                    {new Date(job.created_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              {job.output_url && job.status === 'completed' && (
                                        <a
                                          href={job.output_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                          className="text-brand-600 hover:text-brand-700"
                                        >
                                  <FiExternalLink className="w-4 h-4" />
                                </a>
                              )}
                                        </div>
                                      </button>
                        ))}
                                  </div>
                                )}
                              </div>
                </Transition>
              </div>
                        )
                      })}
              </div>
            )}

      {totalPages > 1 && (
        <div className="bg-white rounded-2xl border border-white/60 shadow-soft px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-ink-600">
              Showing <span className="font-medium text-ink-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium text-ink-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
              <span className="font-medium text-ink-900">{totalItems}</span> lead magnets
            </div>

            <nav className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-2xl border border-surface-200 text-ink-500 hover:bg-surface-100 hover:text-ink-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                aria-label="Previous page"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>

              {(() => {
                const pages: (number | string)[] = []
                const maxVisible = 7

                if (totalPages <= maxVisible) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else {
                  if (currentPage <= 3) {
                    for (let i = 1; i <= 5; i++) {
                      pages.push(i)
                    }
                    pages.push('...')
                    pages.push(totalPages)
                  } else if (currentPage >= totalPages - 2) {
                    pages.push(1)
                    pages.push('...')
                    for (let i = totalPages - 4; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    pages.push(1)
                    pages.push('...')
                    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                      pages.push(i)
                    }
                    pages.push('...')
                    pages.push(totalPages)
                  }
                }

                return pages.map((page, idx) =>
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-3 py-2 text-ink-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => onPageChange(page as number)}
                      className={`min-w-[2.5rem] px-3 py-2 rounded-2xl font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-brand-600 text-white'
                          : 'border border-surface-200 text-ink-700 hover:bg-surface-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )
              })()}

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-2xl border border-surface-200 text-ink-500 hover:bg-surface-100 hover:text-ink-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                aria-label="Next page"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </nav>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete lead magnet?"
        description={
          deleteTarget ? (
            <span>
              This will remove <span className="font-semibold">{deleteTarget.workflow_name}</span> and its associated
              form. This action cannot be undone.
            </span>
          ) : (
            'This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />
    </div>
  )
}
