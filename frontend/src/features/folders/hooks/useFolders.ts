/**
 * Data fetching hooks for folders using React Query
 */

'use client'

import { useMemo } from 'react'
import { useQuery } from '@/shared/hooks/useQuery'
import { useMutation } from '@/shared/hooks/useMutation'
import { api } from '@/shared/lib/api'
import { Folder, FolderCreateRequest, FolderUpdateRequest, FolderListResponse } from '@/features/folders/types'
import { normalizeError } from '@/shared/hooks/hookHelpers'

// Query keys factory
export const folderKeys = {
  all: ['folders'] as const,
  lists: () => [...folderKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...folderKeys.lists(), params] as const,
  details: () => [...folderKeys.all, 'detail'] as const,
  detail: (id: string) => [...folderKeys.details(), id] as const,
}

interface UseFoldersResult {
  folders: Folder[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFolders(params?: Record<string, unknown>): UseFoldersResult {
  const queryKey = useMemo(() => folderKeys.list(params), [params])
  
  const { data, isLoading, error, refetch } = useQuery<FolderListResponse>(
    queryKey,
    () => api.getFolders(params),
    {
      enabled: true,
    }
  )

  return {
    folders: data?.folders ?? [],
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  }
}

interface UseFolderResult {
  folder: Folder | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFolder(id: string | null): UseFolderResult {
  const queryKey = useMemo(() => (id ? folderKeys.detail(id) : ['folders', 'detail', null]), [id])
  
  const { data, isLoading, error, refetch } = useQuery<Folder>(
    queryKey,
    () => {
      if (!id) throw new Error('Folder ID is required')
      return api.getFolder(id)
    },
    {
      enabled: !!id,
    }
  )

  return {
    folder: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  }
}

interface UseCreateFolderResult {
  createFolder: (data: FolderCreateRequest) => Promise<Folder | null>
  loading: boolean
  error: string | null
}

export function useCreateFolder(): UseCreateFolderResult {
  const { mutateAsync, isPending, error } = useMutation<Folder, Error, FolderCreateRequest>(
    (data: FolderCreateRequest) => api.createFolder(data),
    {
      showSuccessToast: 'Folder created successfully',
      showErrorToast: true,
      invalidateQueries: [folderKeys.all],
    }
  )

  return {
    createFolder: async (data: FolderCreateRequest) => {
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

interface UseUpdateFolderResult {
  updateFolder: (id: string, data: FolderUpdateRequest) => Promise<Folder | null>
  loading: boolean
  error: string | null
}

export function useUpdateFolder(): UseUpdateFolderResult {
  const { mutateAsync, isPending, error } = useMutation<
    Folder,
    Error,
    { id: string; data: FolderUpdateRequest }
  >(
    ({ id, data }) => api.updateFolder(id, data),
    {
      showSuccessToast: 'Folder updated successfully',
      showErrorToast: true,
      invalidateQueries: [folderKeys.all],
    }
  )

  return {
    updateFolder: async (id: string, data: FolderUpdateRequest) => {
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

interface UseDeleteFolderResult {
  deleteFolder: (id: string) => Promise<boolean>
  loading: boolean
  error: string | null
}

export function useDeleteFolder(): UseDeleteFolderResult {
  const { mutateAsync, isPending, error } = useMutation<void, Error, string>(
    async (id: string) => {
      await api.deleteFolder(id)
    },
    {
      showSuccessToast: 'Folder deleted successfully',
      showErrorToast: true,
      invalidateQueries: [folderKeys.all, ['workflows']],
    }
  )

  return {
    deleteFolder: async (id: string) => {
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

