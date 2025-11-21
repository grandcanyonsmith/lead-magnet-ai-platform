import { useState, useEffect, useCallback } from 'react'
import { api } from '@/shared/lib/api'
import { Workflow } from '@/shared/types'

const DEFAULT_LIMIT = 20

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [limit] = useState(DEFAULT_LIMIT)

  const loadWorkflows = useCallback(async (page: number = 1) => {
    try {
      setLoading(true)
      // Temporarily remove agency_selected_customer_id to fetch workflows from user's own customer
      // This ensures workflows are always shown from the user's account, not the selected customer in agency view
      const savedCustomerId = typeof window !== 'undefined' 
        ? localStorage.getItem('agency_selected_customer_id')
        : null
      
      if (savedCustomerId && typeof window !== 'undefined') {
        localStorage.removeItem('agency_selected_customer_id')
      }

      try {
        const offset = (page - 1) * limit
        const data = await api.getWorkflows({ limit, offset })
        const workflowsList = data.workflows || []
        // Sort by created_at DESC (most recent first) as fallback
        workflowsList.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime()
          const dateB = new Date(b.created_at || 0).getTime()
          return dateB - dateA // DESC order
        })
        setWorkflows(workflowsList)
        setTotalItems(data.total || data.count || workflowsList.length)
        setHasMore(data.has_more || false)
      } finally {
        // Restore the saved customer ID if it existed
        if (savedCustomerId && typeof window !== 'undefined') {
          localStorage.setItem('agency_selected_customer_id', savedCustomerId)
        }
      }
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    loadWorkflows(currentPage)
  }, [loadWorkflows, currentPage])

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      await api.deleteWorkflow(id)
      await loadWorkflows(currentPage)
      return true
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      return false
    }
  }, [loadWorkflows, currentPage])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const totalPages = Math.ceil(totalItems / limit)

  return {
    workflows,
    loading,
    loadWorkflows,
    deleteWorkflow,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasMore,
    onPageChange: handlePageChange,
  }
}
