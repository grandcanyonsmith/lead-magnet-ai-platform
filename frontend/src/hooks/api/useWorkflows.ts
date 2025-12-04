/**
 * Data fetching hooks for workflows
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Workflow, WorkflowCreateRequest, WorkflowUpdateRequest, WorkflowListResponse } from '@/types'

interface UseWorkflowsResult {
  workflows: Workflow[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useWorkflows(params?: Record<string, unknown>): UseWorkflowsResult {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getWorkflows(params)
      setWorkflows(response.workflows || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflows'
      setError(errorMessage)
      console.error('Failed to load workflows:', err)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  return {
    workflows,
    loading,
    error,
    refetch: fetchWorkflows,
  }
}

interface UseWorkflowResult {
  workflow: Workflow | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useWorkflow(id: string | null): UseWorkflowResult {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkflow = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await api.getWorkflow(id)
      setWorkflow(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflow'
      setError(errorMessage)
      console.error('Failed to load workflow:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchWorkflow()
  }, [fetchWorkflow])

  return {
    workflow,
    loading,
    error,
    refetch: fetchWorkflow,
  }
}

interface UseCreateWorkflowResult {
  createWorkflow: (data: WorkflowCreateRequest) => Promise<Workflow | null>
  loading: boolean
  error: string | null
}

export function useCreateWorkflow(): UseCreateWorkflowResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createWorkflow = useCallback(async (data: WorkflowCreateRequest): Promise<Workflow | null> => {
    try {
      setLoading(true)
      setError(null)
      return await api.createWorkflow(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workflow'
      setError(errorMessage)
      console.error('Failed to create workflow:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    createWorkflow,
    loading,
    error,
  }
}

interface UseUpdateWorkflowResult {
  updateWorkflow: (id: string, data: WorkflowUpdateRequest) => Promise<Workflow | null>
  loading: boolean
  error: string | null
}

export function useUpdateWorkflow(): UseUpdateWorkflowResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateWorkflow = useCallback(async (id: string, data: WorkflowUpdateRequest): Promise<Workflow | null> => {
    try {
      setLoading(true)
      setError(null)
      return await api.updateWorkflow(id, data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update workflow'
      setError(errorMessage)
      console.error('Failed to update workflow:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    updateWorkflow,
    loading,
    error,
  }
}

interface UseDeleteWorkflowResult {
  deleteWorkflow: (id: string) => Promise<boolean>
  loading: boolean
  error: string | null
}

export function useDeleteWorkflow(): UseDeleteWorkflowResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteWorkflow = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)
      await api.deleteWorkflow(id)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete workflow'
      setError(errorMessage)
      console.error('Failed to delete workflow:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    deleteWorkflow,
    loading,
    error,
  }
}

