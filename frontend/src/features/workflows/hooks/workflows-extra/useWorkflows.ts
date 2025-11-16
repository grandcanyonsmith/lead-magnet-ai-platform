import { useState, useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { Workflow } from '@/shared/types'

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  const loadWorkflows = async () => {
    try {
      const data = await api.getWorkflows()
      const workflowsList = data.workflows || []
      // Sort by created_at DESC (most recent first) as fallback
      workflowsList.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA // DESC order
      })
      setWorkflows(workflowsList)
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkflows()
  }, [])

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

  return {
    workflows,
    loading,
    loadWorkflows,
    handleDelete,
  }
}

