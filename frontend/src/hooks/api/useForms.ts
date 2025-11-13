/**
 * Data fetching hooks for forms using React Query
 */

'use client'

import { useMemo } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { useMutation } from '@/hooks/useMutation'
import { api } from '@/lib/api'
import { Form, FormCreateRequest, FormUpdateRequest, FormListResponse } from '@/types'
import { normalizeError, extractListData } from './hookHelpers'

// Query keys factory
export const formKeys = {
  all: ['forms'] as const,
  lists: () => [...formKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...formKeys.lists(), params] as const,
  details: () => [...formKeys.all, 'detail'] as const,
  detail: (id: string) => [...formKeys.details(), id] as const,
}

interface UseFormsResult {
  forms: Form[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useForms(params?: Record<string, unknown>): UseFormsResult {
  const queryKey = useMemo(() => formKeys.list(params), [params])
  
  const { data, isLoading, error, refetch } = useQuery<FormListResponse>(
    queryKey,
    () => api.getForms(params),
    {
      enabled: true,
    }
  )

  return {
    forms: extractListData(data, 'forms'),
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  }
}

interface UseFormResult {
  form: Form | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useForm(id: string | null): UseFormResult {
  const queryKey = useMemo(() => (id ? formKeys.detail(id) : ['forms', 'detail', null]), [id])
  
  const { data, isLoading, error, refetch } = useQuery<Form>(
    queryKey,
    () => {
      if (!id) throw new Error('Form ID is required')
      return api.getForm(id)
    },
    {
      enabled: !!id,
    }
  )

  return {
    form: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  }
}

interface UseCreateFormResult {
  createForm: (data: FormCreateRequest) => Promise<Form | null>
  loading: boolean
  error: string | null
}

export function useCreateForm(): UseCreateFormResult {
  const { mutateAsync, isPending, error } = useMutation<Form, Error, FormCreateRequest>(
    (data: FormCreateRequest) => api.createForm(data),
    {
      showSuccessToast: 'Form created successfully',
      showErrorToast: true,
      invalidateQueries: [formKeys.all],
    }
  )

  return {
    createForm: async (data: FormCreateRequest) => {
      try {
        return await mutateAsync(data)
      } catch {
        return null
      }
    },
    loading: isPending,
    error: normalizeError(error),
  }
}

interface UseUpdateFormResult {
  updateForm: (id: string, data: FormUpdateRequest) => Promise<Form | null>
  loading: boolean
  error: string | null
}

export function useUpdateForm(): UseUpdateFormResult {
  const { mutateAsync, isPending, error } = useMutation<
    Form,
    Error,
    { id: string; data: FormUpdateRequest }
  >(
    ({ id, data }) => api.updateForm(id, data),
    {
      showSuccessToast: 'Form updated successfully',
      showErrorToast: true,
      invalidateQueries: [formKeys.all],
    }
  )

  return {
    updateForm: async (id: string, data: FormUpdateRequest) => {
      try {
        return await mutateAsync({ id, data })
      } catch {
        return null
      }
    },
    loading: isPending,
    error: normalizeError(error),
  }
}

