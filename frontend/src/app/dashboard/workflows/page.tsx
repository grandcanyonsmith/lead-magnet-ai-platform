'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FiPlus, FiEdit, FiTrash2, FiEye, FiExternalLink, FiCopy, FiCheck, FiMoreVertical, FiLoader, FiList, FiFileText, FiFolder, FiClock } from 'react-icons/fi'
import { useFolders } from '@/features/folders/hooks/useFolders'
import { useWorkflows } from '@/features/workflows/hooks/workflows-extra/useWorkflows'
import { useWorkflowJobs } from '@/features/workflows/hooks/workflows-extra/useWorkflowJobs'
import { useWorkflowSearch } from '@/features/workflows/hooks/workflows-extra/useWorkflowSearch'
import { useWorkflowFolders } from '@/features/workflows/hooks/workflows-extra/useWorkflowFolders'
import { CreateFolderModal } from '@/features/folders/components/folders/CreateFolderModal'
import { FolderSection } from '@/features/folders/components/folders/FolderSection'
import { MoveToFolderMenu } from '@/features/folders/components/folders/MoveToFolderMenu'
import { WorkflowSearchBar } from '@/features/workflows/components/workflows-extra/WorkflowSearchBar'
import { publicUrlFor, formatUrl, formatRelativeTime, getJobStatusIcon } from '@/features/workflows/utils/workflowUtils'
import { Workflow } from '@/shared/types'

export default function WorkflowsPage() {
  const router = useRouter()
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [moveToFolderMenuId, setMoveToFolderMenuId] = useState<string | null>(null)
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { folders, refetch: refetchFolders } = useFolders()

  const { workflows, loading, loadWorkflows, handleDelete } = useWorkflows()
  const { workflowJobs, loadingJobs } = useWorkflowJobs(workflows)
  const { searchQuery, setSearchQuery, filteredWorkflows } = useWorkflowSearch(workflows)
  const workflowsByFolder = useWorkflowFolders(filteredWorkflows)

  useEffect(() => {
    refetchFolders()
  }, [refetchFolders])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (openMenuId) {
        const menuElement = menuRefs.current[openMenuId]
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [openMenuId])

  const copyToClipboard = async (text: string, workflowId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedUrl(workflowId)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div className="mb-2 sm:mb-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Lead Magnets</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your AI lead magnets and their forms</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-sm text-sm sm:text-base w-full sm:w-auto"
          >
            <FiFolder className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Create Folder
          </button>
          <button
            onClick={() => router.push('/dashboard/workflows/new')}
            className="flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base w-full sm:w-auto"
          >
            <FiPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Create Lead Magnet
          </button>
        </div>
      </div>

      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onSuccess={() => {
          refetchFolders()
          loadWorkflows()
        }}
      />

      {/* Search Bar */}
      <WorkflowSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        workflowsCount={workflows.length}
      />

      {filteredWorkflows.length === 0 && workflows.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-gray-600 mb-4 text-sm sm:text-base">No lead magnets match your search</p>
          <button
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base"
          >
            Clear search
          </button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-gray-600 mb-4 text-sm sm:text-base">No lead magnets yet</p>
          <button
            onClick={() => router.push('/dashboard/workflows/new')}
            className="inline-flex items-center px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
          >
            <FiPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Create your first lead magnet
          </button>
        </div>
      ) : (
        <>
          {/* Folders and Workflows */}
          <div className="block md:hidden space-y-4">
            {/* Folders */}
            {folders
              .filter((folder) => workflowsByFolder.grouped[folder.folder_id]?.length > 0)
              .map((folder) => (
                <FolderSection
                  key={folder.folder_id}
                  folder={folder}
                  workflows={workflowsByFolder.grouped[folder.folder_id] || []}
                  renderWorkflow={(workflow) => {
                    const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
                    return (
                      <div key={workflow.workflow_id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 truncate">{workflow.workflow_name}</h3>
                            {workflow.workflow_description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{workflow.workflow_description}</p>
                            )}
                          </div>
                          <div className="relative ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                              }}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all touch-target"
                              aria-label="Actions"
                            >
                              <FiMoreVertical className="w-4 h-4" />
                            </button>
                            {openMenuId === workflow.workflow_id && (
                              <div
                                ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                                className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        setOpenMenuId(null)
                                        setMoveToFolderMenuId(workflow.workflow_id)
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                    >
                                      <FiFolder className="w-3 h-3 mr-2" />
                                      Move to folder
                                    </button>
                                    {moveToFolderMenuId === workflow.workflow_id && (
                                      <MoveToFolderMenu
                                        workflow={workflow}
                                        onClose={() => setMoveToFolderMenuId(null)}
                                        onMove={() => {
                                          loadWorkflows()
                                          setMoveToFolderMenuId(null)
                                        }}
                                      />
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                      setOpenMenuId(null)
                                      if (typeof window !== 'undefined') {
                                        window.location.href = `/dashboard/workflows/${workflow.workflow_id}`
                                      } else {
                                        router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                      }
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                  >
                                    <FiEye className="w-3 h-3 mr-2" />
                                    View
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                      setOpenMenuId(null)
                                      if (typeof window !== 'undefined') {
                                        window.location.href = `/dashboard/workflows/${workflow.workflow_id}/edit`
                                      } else {
                                        router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                      }
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                  >
                                    <FiEdit className="w-3 h-3 mr-2" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                      setOpenMenuId(null)
                                      handleDelete(workflow.workflow_id)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 active:bg-red-50 flex items-center touch-target"
                                  >
                                    <FiTrash2 className="w-3 h-3 mr-2" />
                                    Delete
                                  </button>
                                  {formUrl && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        copyToClipboard(formUrl, workflow.workflow_id)
                                        setOpenMenuId(null)
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target border-t border-gray-100"
                                    >
                                      <FiCopy className="w-3 h-3 mr-2" />
                                      Copy Form URL
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2.5 text-xs">
                          {/* Form Link */}
                          {workflow.form && formUrl ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={formUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-900 font-medium truncate flex-1 min-w-0 flex items-center gap-1.5"
                                title={formUrl}
                              >
                                <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{workflow.form.form_name}</span>
                              </a>
                            </div>
                          ) : workflow.form ? (
                            <div className="text-gray-400 italic text-xs">No form URL</div>
                          ) : null}
                          
                          {/* Metadata */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-1.5">
                              <FiList className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <div className="flex gap-1 flex-wrap">
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  {workflow.steps?.length || 0} step{workflow.steps?.length !== 1 ? 's' : ''}
                                </span>
                                {workflow.template_id && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    Template
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <FiClock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600 text-xs">{new Date(workflow.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          {/* Generated Documents */}
                          <div className="pt-1.5">
                            {loadingJobs[workflow.workflow_id] ? (
                              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                <FiLoader className="w-3 h-3 animate-spin" />
                                <span>Loading...</span>
                              </div>
                            ) : (() => {
                              const jobs = workflowJobs[workflow.workflow_id] || []
                              const processingJobs = jobs.filter((j: any) => j.status === 'processing' || j.status === 'pending')
                              const completedJobs = jobs.filter((j: any) => j.status === 'completed')
                              
                              if (processingJobs.length > 0) {
                                return (
                                  <div className="text-xs text-blue-600 flex items-center gap-1.5">
                                    <FiLoader className="w-3 h-3 animate-spin" />
                                    <span>Processing...</span>
                                  </div>
                                )
                              } else if (completedJobs.length > 0) {
                                const mostRecentJob = completedJobs[0]
                                return (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <FiFileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                      <span className="text-gray-600 text-xs">
                                        {completedJobs.length} document{completedJobs.length !== 1 ? 's' : ''}
                                      </span>
                                      {mostRecentJob.output_url && (
                                        <a
                                          href={mostRecentJob.output_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 hover:text-primary-900 flex-shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                          title="Open most recent document"
                                        >
                                          <FiExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    {completedJobs.length > 1 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          router.push(`/dashboard/jobs?workflow_id=${workflow.workflow_id}`)
                                        }}
                                        className="text-xs text-primary-600 hover:text-primary-900 flex-shrink-0"
                                      >
                                        View all
                                      </button>
                                    )}
                                  </div>
                                )
                              } else {
                                return (
                                  <div className="text-xs text-gray-400 italic flex items-center gap-1.5">
                                    <FiFileText className="w-3.5 h-3.5" />
                                    <span>No documents yet</span>
                                  </div>
                                )
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
              ))}

            {/* Uncategorized Section */}
            {workflowsByFolder.uncategorized.length > 0 && (
              <div className="mb-4">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-2">
                  <div className="flex items-center gap-2">
                    <FiFolder className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">Uncategorized</span>
                    <span className="text-xs text-gray-500">({workflowsByFolder.uncategorized.length})</span>
                  </div>
                </div>
                <div className="ml-4 space-y-3">
                  {workflowsByFolder.uncategorized.map((workflow) => {
              const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
              return (
                <div key={workflow.workflow_id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">{workflow.workflow_name}</h3>
                      {workflow.workflow_description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{workflow.workflow_description}</p>
                      )}
                    </div>
                    <div className="relative ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                        }}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all touch-target"
                        aria-label="Actions"
                      >
                        <FiMoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === workflow.workflow_id && (
                        <div
                          ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                          className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                setMoveToFolderMenuId(workflow.workflow_id)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                            >
                              <FiFolder className="w-3 h-3 mr-2" />
                              Move to folder
                            </button>
                            {moveToFolderMenuId === workflow.workflow_id && (
                              <MoveToFolderMenu
                                workflow={workflow}
                                onClose={() => setMoveToFolderMenuId(null)}
                                onMove={() => {
                                  loadWorkflows()
                                  setMoveToFolderMenuId(null)
                                }}
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                if (typeof window !== 'undefined') {
                                  window.location.href = `/dashboard/workflows/${workflow.workflow_id}`
                                } else {
                                  router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                }
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation()
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                            >
                              <FiEye className="w-3 h-3 mr-2" />
                              View
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                if (typeof window !== 'undefined') {
                                  window.location.href = `/dashboard/workflows/${workflow.workflow_id}/edit`
                                } else {
                                  router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                }
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation()
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                            >
                              <FiEdit className="w-3 h-3 mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                handleDelete(workflow.workflow_id)
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 active:bg-red-50 flex items-center touch-target"
                            >
                              <FiTrash2 className="w-3 h-3 mr-2" />
                              Delete
                            </button>
                            {formUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  copyToClipboard(formUrl, workflow.workflow_id)
                                  setOpenMenuId(null)
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation()
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target border-t border-gray-100"
                              >
                                <FiCopy className="w-3 h-3 mr-2" />
                                Copy Form URL
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 text-xs">
                    {/* Form Link - Consolidated */}
                    {workflow.form && formUrl ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={formUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900 font-medium truncate flex-1 min-w-0 flex items-center gap-1.5"
                          title={formUrl}
                        >
                          <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{workflow.form.form_name}</span>
                        </a>
                      </div>
                    ) : workflow.form ? (
                      <div className="text-gray-400 italic text-xs">No form URL</div>
                    ) : null}
                    
                    {/* Metadata - Two Column Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-1.5">
                        <FiList className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <div className="flex gap-1 flex-wrap">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {workflow.steps?.length || 0} step{workflow.steps?.length !== 1 ? 's' : ''}
                          </span>
                          {workflow.template_id && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Template
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <FiClock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 text-xs">{new Date(workflow.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {/* Generated Documents - Simplified */}
                    <div className="pt-1.5">
                      {loadingJobs[workflow.workflow_id] ? (
                        <div className="text-xs text-gray-500 flex items-center gap-1.5">
                          <FiLoader className="w-3 h-3 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      ) : (() => {
                        const jobs = workflowJobs[workflow.workflow_id] || []
                        const processingJobs = jobs.filter((j: any) => j.status === 'processing' || j.status === 'pending')
                        const completedJobs = jobs.filter((j: any) => j.status === 'completed')
                        
                        if (processingJobs.length > 0) {
                          return (
                            <div className="text-xs text-blue-600 flex items-center gap-1.5">
                              <FiLoader className="w-3 h-3 animate-spin" />
                              <span>Processing...</span>
                            </div>
                          )
                        } else if (completedJobs.length > 0) {
                          const mostRecentJob = completedJobs[0]
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <FiFileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 text-xs">
                                  {completedJobs.length} document{completedJobs.length !== 1 ? 's' : ''}
                                </span>
                                {mostRecentJob.output_url && (
                                  <a
                                    href={mostRecentJob.output_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-900 flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Open most recent document"
                                  >
                                    <FiExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              {completedJobs.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/jobs?workflow_id=${workflow.workflow_id}`)
                                  }}
                                  className="text-xs text-primary-600 hover:text-primary-900 flex-shrink-0"
                                >
                                  View all
                                </button>
                              )}
                            </div>
                          )
                        } else {
                          return (
                            <div className="text-xs text-gray-400 italic flex items-center gap-1.5">
                              <FiFileText className="w-3.5 h-3.5" />
                              <span>No documents yet</span>
                            </div>
                          )
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block space-y-6">
            {/* Folders */}
            {folders
              .filter((folder) => workflowsByFolder.grouped[folder.folder_id]?.length > 0)
              .map((folder) => (
                <div key={folder.folder_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <FiFolder className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-900">{folder.folder_name}</span>
                      <span className="text-xs text-gray-500">({workflowsByFolder.grouped[folder.folder_id]?.length || 0})</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Lead Magnet Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Form
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Research Model
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Features
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Generated Documents
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {(workflowsByFolder.grouped[folder.folder_id] || []).map((workflow) => {
                  const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
                  const jobs = workflowJobs[workflow.workflow_id] || []
                  const processingJobs = jobs.filter((j: any) => j.status === 'processing' || j.status === 'pending')
                  const completedJobs = jobs.filter((j: any) => j.status === 'completed')
                  
                  return (
                    <tr key={workflow.workflow_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{workflow.workflow_name}</div>
                        {workflow.workflow_description && (
                          <div className="text-sm text-gray-500 mt-1">{workflow.workflow_description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {workflow.form ? (
                          <div className="space-y-1">
                            <div className="text-sm text-gray-900">{workflow.form.form_name}</div>
                            {formUrl && (
                              <div className="flex items-center gap-2">
                                <a
                                  href={formUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary-600 hover:text-primary-900 break-all"
                                  title={formUrl}
                                >
                                  {formatUrl(formUrl)}
                                </a>
                                <button
                                  onClick={() => copyToClipboard(formUrl, workflow.workflow_id)}
                                  className="text-gray-400 hover:text-gray-600 p-2 touch-target"
                                  title="Copy URL"
                                >
                                  {copiedUrl === workflow.workflow_id ? (
                                    <FiCheck className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <FiCopy className="w-3 h-3" />
                                  )}
                                </button>
                                <a
                                  href={formUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-900"
                                  title="Open form"
                                >
                                  <FiExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">No form</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {workflow.steps?.length || 0} step{workflow.steps?.length !== 1 ? 's' : ''}
                          </span>
                          {workflow.template_id && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Template
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {loadingJobs[workflow.workflow_id] ? (
                          <div className="text-xs text-gray-500 flex items-center">
                            <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                            Loading...
                          </div>
                        ) : processingJobs.length > 0 ? (
                          <div className="text-xs text-blue-600 flex items-center">
                            <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                            Processing...
                          </div>
                        ) : completedJobs.length > 0 ? (
                          <div className="space-y-1">
                            {completedJobs.slice(0, 2).map((job: any) => (
                              <div key={job.job_id} className="flex items-center gap-2 text-xs">
                                {getJobStatusIcon(job.status)}
                                <span className="text-gray-600">{formatRelativeTime(job.created_at)}</span>
                                {job.output_url && (
                                  <a
                                    href={job.output_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-900"
                                  >
                                    <FiExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                            {completedJobs.length > 2 && (
                              <button
                                onClick={() => router.push(`/dashboard/jobs?workflow_id=${workflow.workflow_id}`)}
                                className="text-xs text-primary-600 hover:text-primary-900"
                              >
                                View all {completedJobs.length}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No documents yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                            }}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all touch-target"
                            title="Actions"
                          >
                            <FiMoreVertical className="w-5 h-5" />
                          </button>
                          {openMenuId === workflow.workflow_id && (
                            <div
                              ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                              className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setOpenMenuId(null)
                                    setMoveToFolderMenuId(workflow.workflow_id)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                >
                                  <FiFolder className="w-4 h-4 mr-2" />
                                  Move to folder
                                </button>
                                {moveToFolderMenuId === workflow.workflow_id && (
                                  <div className="relative">
                                    <MoveToFolderMenu
                                      workflow={workflow}
                                      onClose={() => setMoveToFolderMenuId(null)}
                                      onMove={() => {
                                        loadWorkflows()
                                        setMoveToFolderMenuId(null)
                                      }}
                                    />
                                  </div>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                    setOpenMenuId(null)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                >
                                  <FiEye className="w-4 h-4 mr-2" />
                                  View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                    setOpenMenuId(null)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                >
                                  <FiEdit className="w-4 h-4 mr-2" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setOpenMenuId(null)
                                    handleDelete(workflow.workflow_id)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-50 flex items-center touch-target"
                                >
                                  <FiTrash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                        )
                      })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

            {/* Uncategorized Section - Desktop */}
            {workflowsByFolder.uncategorized.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <FiFolder className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900">Uncategorized</span>
                    <span className="text-xs text-gray-500">({workflowsByFolder.uncategorized.length})</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Lead Magnet Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Form
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Research Model
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Features
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Generated Documents
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {workflowsByFolder.uncategorized.map((workflow) => {
                        const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
                        const jobs = workflowJobs[workflow.workflow_id] || []
                        const processingJobs = jobs.filter((j: any) => j.status === 'processing' || j.status === 'pending')
                        const completedJobs = jobs.filter((j: any) => j.status === 'completed')
                        
                        return (
                          <tr key={workflow.workflow_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-sm font-semibold text-gray-900">{workflow.workflow_name}</div>
                              {workflow.workflow_description && (
                                <div className="text-sm text-gray-500 mt-1">{workflow.workflow_description}</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {workflow.form ? (
                                <div className="space-y-1">
                                  <div className="text-sm text-gray-900">{workflow.form.form_name}</div>
                                  {formUrl && (
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={formUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary-600 hover:text-primary-900 break-all"
                                        title={formUrl}
                                      >
                                        {formatUrl(formUrl)}
                                      </a>
                                      <button
                                        onClick={() => copyToClipboard(formUrl, workflow.workflow_id)}
                                        className="text-gray-400 hover:text-gray-600 p-2 touch-target"
                                        title="Copy URL"
                                      >
                                        {copiedUrl === workflow.workflow_id ? (
                                          <FiCheck className="w-3 h-3 text-green-600" />
                                        ) : (
                                          <FiCopy className="w-3 h-3" />
                                        )}
                                      </button>
                                      <a
                                        href={formUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-600 hover:text-primary-900"
                                        title="Open form"
                                      >
                                        <FiExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">No form</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-2">
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  {workflow.steps?.length || 0} step{workflow.steps?.length !== 1 ? 's' : ''}
                                </span>
                                {workflow.template_id && (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    Template
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(workflow.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              {loadingJobs[workflow.workflow_id] ? (
                                <div className="text-xs text-gray-500 flex items-center">
                                  <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                                  Loading...
                                </div>
                              ) : processingJobs.length > 0 ? (
                                <div className="text-xs text-blue-600 flex items-center">
                                  <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                                  Processing...
                                </div>
                              ) : completedJobs.length > 0 ? (
                                <div className="space-y-1">
                                  {completedJobs.slice(0, 2).map((job: any) => (
                                    <div key={job.job_id} className="flex items-center gap-2 text-xs">
                                      {getJobStatusIcon(job.status)}
                                      <span className="text-gray-600">{formatRelativeTime(job.created_at)}</span>
                                      {job.output_url && (
                                        <a
                                          href={job.output_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 hover:text-primary-900"
                                        >
                                          <FiExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                  {completedJobs.length > 2 && (
                                    <button
                                      onClick={() => router.push(`/dashboard/jobs?workflow_id=${workflow.workflow_id}`)}
                                      className="text-xs text-primary-600 hover:text-primary-900"
                                    >
                                      View all {completedJobs.length}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No documents yet</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="relative inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                                  }}
                                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all touch-target"
                                  title="Actions"
                                >
                                  <FiMoreVertical className="w-5 h-5" />
                                </button>
                                {openMenuId === workflow.workflow_id && (
                                  <div
                                    ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                  >
                                    <div className="py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          e.preventDefault()
                                          setOpenMenuId(null)
                                          setMoveToFolderMenuId(workflow.workflow_id)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                      >
                                        <FiFolder className="w-4 h-4 mr-2" />
                                        Move to folder
                                      </button>
                                      {moveToFolderMenuId === workflow.workflow_id && (
                                        <div className="relative">
                                          <MoveToFolderMenu
                                            workflow={workflow}
                                            onClose={() => setMoveToFolderMenuId(null)}
                                            onMove={() => {
                                              loadWorkflows()
                                              setMoveToFolderMenuId(null)
                                            }}
                                          />
                                        </div>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          e.preventDefault()
                                          router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                          setOpenMenuId(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                      >
                                        <FiEye className="w-4 h-4 mr-2" />
                                        View
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          e.preventDefault()
                                          router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                          setOpenMenuId(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                      >
                                        <FiEdit className="w-4 h-4 mr-2" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          e.preventDefault()
                                          setOpenMenuId(null)
                                          handleDelete(workflow.workflow_id)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-50 flex items-center touch-target"
                                      >
                                        <FiTrash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

