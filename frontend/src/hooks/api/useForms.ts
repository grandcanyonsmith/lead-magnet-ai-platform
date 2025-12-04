/**
 * Data fetching hooks for forms
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Form, FormCreateRequest, FormUpdateRequest, FormListResponse } from '@/types'

interface UseFormsResult {
  forms: Form[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useForms(params?: Record<string, unknown>): UseFormsResult {
  const [forms, setForms] = useState<Form[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getForms(params)
      setForms(response.forms || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load forms'
      setError(errorMessage)
      console.error('Failed to load forms:', err)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetchForms()
  }, [fetchForms])

  return {
    forms,
    loading,
    error,
    refetch: fetchForms,
  }
}

interface UseFormResult {
  form: Form | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useForm(id: string | null): UseFormResult {
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchForm = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await api.getForm(id)
      setForm(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load form'
      setError(errorMessage)
      console.error('Failed to load form:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchForm()
  }, [fetchForm])

  return {
    form,
    loading,
    error,
    refetch: fetchForm,
  }
}

interface UseCreateFormResult {
  createForm: (data: FormCreateRequest) => Promise<Form | null>
  loading: boolean
  error: string | null
}

export function useCreateForm(): UseCreateFormResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createForm = useCallback(async (data: FormCreateRequest): Promise<Form | null> => {
    try {
      setLoading(true)
      setError(null)
      return await api.createForm(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create form'
      setError(errorMessage)
      console.error('Failed to create form:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    createForm,
    loading,
    error,
  }
}

interface UseUpdateFormResult {
  updateForm: (id: string, data: FormUpdateRequest) => Promise<Form | null>
  loading: boolean
  error: string | null
}

export function useUpdateForm(): UseUpdateFormResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateForm = useCallback(async (id: string, data: FormUpdateRequest): Promise<Form | null> => {
    try {
      setLoading(true)
      setError(null)
      return await api.updateForm(id, data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update form'
      setError(errorMessage)
      console.error('Failed to update form:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    updateForm,
    loading,
    error,
  }
}

