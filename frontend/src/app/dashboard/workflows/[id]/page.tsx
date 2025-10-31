'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiEdit, FiTrash2, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi'

export default function WorkflowDetailPage() {
  const router = useRouter()
  const params = useParams()
  const workflowId = params?.id as string
  
  const [workflow, setWorkflow] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (workflowId) {
      Promise.all([loadWorkflow(), loadJobs()])
    }
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
      setJobs(data.jobs || [])
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
            <h1 className="text-2xl font-bold text-gray-900">{workflow.workflow_name}</h1>
            {workflow.workflow_description && (
              <p className="text-gray-600 mt-1">{workflow.workflow_description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => router.push(`/dashboard/workflows/${workflowId}/edit`)}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <FiEdit className="w-4 h-4 mr-2" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FiTrash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Details */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Workflow Details</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div>{getStatusBadge(workflow.status || 'draft')}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
            <p className="text-sm text-gray-900">{workflow.ai_model || 'gpt-4o'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rewrite Model</label>
            <p className="text-sm text-gray-900">{workflow.rewrite_model || 'gpt-4o'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Rewriting</label>
            <p className="text-sm text-gray-900">{workflow.rewrite_enabled ? 'Enabled' : 'Disabled'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template ID</label>
            <p className="text-sm text-gray-900 font-mono">{workflow.template_id || '-'}</p>
            {workflow.template_version && (
              <p className="text-xs text-gray-500 mt-1">Version {workflow.template_version}</p>
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
              <p className="text-sm text-gray-900">{workflow.delivery_phone}</p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Instructions</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
            {workflow.ai_instructions || 'No instructions provided'}
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No jobs found for this workflow</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => {
                  const duration = job.completed_at
                    ? Math.round(
                        (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000
                      )
                    : null

                  return (
                    <tr key={job.job_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {getJobStatusIcon(job.status)}
                          <span className="ml-2 text-sm font-mono text-gray-900">
                            {job.job_id.substring(0, 16)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {duration !== null ? `${duration}s` : '-'}
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

