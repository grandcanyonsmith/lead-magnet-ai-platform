'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiPlus, FiEdit, FiTrash2, FiEye, FiExternalLink, FiCopy, FiCheck, FiMoreVertical } from 'react-icons/fi'

export default function WorkflowsPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    loadWorkflows()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = menuRefs.current[openMenuId]
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const loadWorkflows = async () => {
    try {
      const data = await api.getWorkflows()
      setWorkflows(data.workflows || [])
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead magnet? This will also delete its associated form.')) {
      return
    }

    try {
      await api.deleteWorkflow(id)
      await loadWorkflows()
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      alert('Failed to delete lead magnet')
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

  const publicUrlFor = (form: any) => {
    if (!form || !form.public_slug) return null
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/v1/forms/${form.public_slug}`
    }
    return `/v1/forms/${form.public_slug}`
  }

  const copyToClipboard = async (text: string, workflowId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedUrl(workflowId)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatUrl = (url: string) => {
    if (url.length > 40) {
      return url.substring(0, 37) + '...'
    }
    return url
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
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div className="mb-2 sm:mb-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Lead Magnets</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your AI lead magnets and their forms</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/workflows/new')}
          className="flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base w-full sm:w-auto"
        >
          <FiPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Create Lead Magnet
        </button>
      </div>

      {workflows.length === 0 ? (
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
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {workflows.map((workflow) => {
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
                        onClick={() => setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                        aria-label="Actions"
                      >
                        <FiMoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === workflow.workflow_id && (
                        <div
                          ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                          className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                        >
                          <div className="py-1">
                            <button
                              onClick={() => {
                                router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                setOpenMenuId(null)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <FiEye className="w-3 h-3 mr-2" />
                              View
                            </button>
                            <button
                              onClick={() => {
                                router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                setOpenMenuId(null)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <FiEdit className="w-3 h-3 mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                handleDelete(workflow.workflow_id)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <FiTrash2 className="w-3 h-3 mr-2" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Form:</span>
                      {workflow.form ? (
                        <span className="text-gray-900 font-medium truncate ml-2">{workflow.form.form_name}</span>
                      ) : (
                        <span className="text-gray-400 italic">No form</span>
                      )}
                    </div>
                    
                    {formUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={formUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900 text-xs truncate flex-1 min-w-0"
                          title={formUrl}
                        >
                          {formatUrl(formUrl)}
                        </a>
                        <button
                          onClick={() => copyToClipboard(formUrl, workflow.workflow_id)}
                          className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
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
                          className="text-primary-600 hover:text-primary-900 flex-shrink-0"
                          title="Open form"
                        >
                          <FiExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Model:</span>
                      <span className="text-gray-900 font-medium">{workflow.ai_model}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Features:</span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {workflow.research_enabled && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            Research
                          </span>
                        )}
                        {workflow.html_enabled && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            HTML
                          </span>
                        )}
                        {!workflow.research_enabled && !workflow.html_enabled && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Text
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-gray-500">Created:</span>
                      <span className="text-gray-600">{new Date(workflow.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {workflows.map((workflow) => {
                  const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
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
                                  className="text-gray-400 hover:text-gray-600 p-1"
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
                        <span className="text-sm text-gray-700 font-medium">{workflow.ai_model}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {workflow.research_enabled && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              Research
                            </span>
                          )}
                          {workflow.html_enabled && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              HTML
                            </span>
                          )}
                          {!workflow.research_enabled && !workflow.html_enabled && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                              Text
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                            title="Actions"
                          >
                            <FiMoreVertical className="w-5 h-5" />
                          </button>
                          {openMenuId === workflow.workflow_id && (
                            <div
                              ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                              className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                            >
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <FiEye className="w-4 h-4 mr-2" />
                                  View
                                </button>
                                <button
                                  onClick={() => {
                                    router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <FiEdit className="w-4 h-4 mr-2" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    handleDelete(workflow.workflow_id)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
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
        </>
      )}
    </div>
  )
}

