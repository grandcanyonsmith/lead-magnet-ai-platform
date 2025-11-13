/**
 * Generic Resource Hooks Factory
 * Creates standardized CRUD hooks for any resource type
 */

import { useMemo } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { useMutation } from '@/hooks/useMutation'
import { normalizeError, extractData, extractListData } from './hookHelpers'

/**
 * Configuration for creating resource hooks
 */
export interface ResourceHooksConfig<TItem, TListResponse, TCreateRequest, TUpdateRequest> {
  /**
   * Resource name (e.g., 'jobs', 'workflows', 'forms')
   */
  resourceName: string
  
  /**
   * API methods
   */
  api: {
    list: (params?: Record<string, unknown>) => Promise<TListResponse>
    get: (id: string) => Promise<TItem>
    create: (data: TCreateRequest) => Promise<TItem>
    update: (id: string, data: TUpdateRequest) => Promise<TItem>
    delete: (id: string) => Promise<void>
  }
  
  /**
   * Key to extract list from list response (e.g., 'jobs', 'workflows')
   */
  listKey: keyof TListResponse
  
  /**
   * Success messages for mutations
   */
  messages?: {
    create?: string
    update?: string
    delete?: string
  }
}

/**
 * Query keys factory for a resource
 */
export function createResourceKeys(resourceName: string) {
  return {
    all: [resourceName] as const,
    lists: () => [...createResourceKeys(resourceName).all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...createResourceKeys(resourceName).lists(), params] as const,
    details: () => [...createResourceKeys(resourceName).all, 'detail'] as const,
    detail: (id: string) => [...createResourceKeys(resourceName).details(), id] as const,
  }
}

/**
 * Create standardized CRUD hooks for a resource
 */
export function createResourceHooks<TItem, TListResponse extends Record<string, TItem[]>, TCreateRequest, TUpdateRequest>(
  config: ResourceHooksConfig<TItem, TListResponse, TCreateRequest, TUpdateRequest>
) {
  const resourceKeys = createResourceKeys(config.resourceName)
  const messages = config.messages || {}
  
  /**
   * Hook to fetch a list of items
   */
  function useList(params?: Record<string, unknown>) {
    const queryKey = useMemo(() => resourceKeys.list(params), [params])
    
    const { data, isLoading, error, refetch } = useQuery<TListResponse>(
      queryKey,
      () => config.api.list(params),
      {
        enabled: true,
      }
    )

    return {
      items: extractListData(data, config.listKey as string),
      loading: isLoading,
      error: normalizeError(error),
      refetch: () => refetch(),
    }
  }

  /**
   * Hook to fetch a single item
   */
  function useDetail(id: string | null) {
    const queryKey = useMemo(
      () => (id ? resourceKeys.detail(id) : [config.resourceName, 'detail', null]),
      [id]
    )
    
    const { data, isLoading, error, refetch } = useQuery<TItem>(
      queryKey,
      () => {
        if (!id) throw new Error(`${config.resourceName} ID is required`)
        return config.api.get(id)
      },
      {
        enabled: !!id,
      }
    )

    return {
      item: extractData(data, null as TItem | null),
      loading: isLoading,
      error: normalizeError(error),
      refetch: () => refetch(),
    }
  }

  /**
   * Hook to create an item
   */
  function useCreate() {
    const { mutateAsync, isPending, error } = useMutation<TItem, Error, TCreateRequest>(
      (data: TCreateRequest) => config.api.create(data),
      {
        showSuccessToast: messages.create || `${config.resourceName} created successfully`,
        showErrorToast: true,
        invalidateQueries: [resourceKeys.all],
      }
    )

    return {
      create: async (data: TCreateRequest) => {
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

  /**
   * Hook to update an item
   */
  function useUpdate() {
    const { mutateAsync, isPending, error } = useMutation<
      TItem,
      Error,
      { id: string; data: TUpdateRequest }
    >(
      ({ id, data }) => config.api.update(id, data),
      {
        showSuccessToast: messages.update || `${config.resourceName} updated successfully`,
        showErrorToast: true,
        invalidateQueries: [resourceKeys.all],
      }
    )

    return {
      update: async (id: string, data: TUpdateRequest) => {
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

  /**
   * Hook to delete an item
   */
  function useDelete() {
    const { mutateAsync, isPending, error } = useMutation<void, Error, string>(
      (id: string) => config.api.delete(id),
      {
        showSuccessToast: messages.delete || `${config.resourceName} deleted successfully`,
        showErrorToast: true,
        invalidateQueries: [resourceKeys.all],
      }
    )

    return {
      delete: async (id: string) => {
        try {
          await mutateAsync(id)
          return true
        } catch {
          return false
        }
      },
      loading: isPending,
      error: normalizeError(error),
    }
  }

  return {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
    resourceKeys,
  }
}

