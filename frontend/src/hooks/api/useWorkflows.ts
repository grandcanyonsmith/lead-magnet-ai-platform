/**
 * Data fetching hooks for workflows using React Query
 */

"use client";

import { useMemo } from "react";
import { useQuery } from "@/hooks/useQuery";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";
import {
  Workflow,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  WorkflowListResponse,
  AIModelConfig,
} from "@/types";
import { normalizeError, extractListData } from "./hookHelpers";

// Query keys factory
export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...workflowKeys.lists(), params] as const,
  details: () => [...workflowKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
  models: () => [...workflowKeys.all, "models"] as const,
};

interface UseWorkflowsResult {
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkflows(
  params?: Record<string, unknown>,
): UseWorkflowsResult {
  const queryKey = useMemo(() => workflowKeys.list(params), [params]);

  const { data, isLoading, error, refetch } = useQuery<WorkflowListResponse>(
    queryKey,
    () => api.getWorkflows(params),
    {
      enabled: true,
    },
  );

  return {
    workflows: data?.workflows ?? [],
    loading: isLoading,
    error: normalizeError(error),
    refetch: async () => {
      await refetch();
    },
  };
}

interface UseWorkflowResult {
  workflow: Workflow | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkflow(id: string | null): UseWorkflowResult {
  const queryKey = useMemo(
    () => (id ? workflowKeys.detail(id) : ["workflows", "detail", null]),
    [id],
  );

  const { data, isLoading, error, refetch } = useQuery<Workflow>(
    queryKey,
    () => {
      if (!id) throw new Error("Workflow ID is required");
      return api.getWorkflow(id);
    },
    {
      enabled: !!id,
    },
  );

  return {
    workflow: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: async () => {
      await refetch();
    },
  };
}

interface UseCreateWorkflowResult {
  createWorkflow: (data: WorkflowCreateRequest) => Promise<Workflow | null>;
  loading: boolean;
  error: string | null;
}

export function useCreateWorkflow(): UseCreateWorkflowResult {
  const { mutateAsync, isPending, error } = useMutation<
    Workflow,
    Error,
    WorkflowCreateRequest
  >((data: WorkflowCreateRequest) => api.createWorkflow(data), {
    showSuccessToast: "Workflow created successfully",
    showErrorToast: true,
    invalidateQueries: [workflowKeys.all],
  });

  return {
    createWorkflow: async (data: WorkflowCreateRequest) => {
      try {
        return await mutateAsync(data);
      } catch {
        return null;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}

interface UseUpdateWorkflowResult {
  updateWorkflow: (
    id: string,
    data: WorkflowUpdateRequest,
  ) => Promise<Workflow | null>;
  loading: boolean;
  error: string | null;
}

export function useUpdateWorkflow(): UseUpdateWorkflowResult {
  const { mutateAsync, isPending, error } = useMutation<
    Workflow,
    Error,
    { id: string; data: WorkflowUpdateRequest }
  >(({ id, data }) => api.updateWorkflow(id, data), {
    showSuccessToast: "Workflow updated successfully",
    showErrorToast: true,
    invalidateQueries: [workflowKeys.all],
  });

  return {
    updateWorkflow: async (id: string, data: WorkflowUpdateRequest) => {
      try {
        return await mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}

interface UseDeleteWorkflowResult {
  deleteWorkflow: (id: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useDeleteWorkflow(): UseDeleteWorkflowResult {
  const { mutateAsync, isPending, error } = useMutation<void, Error, string>(
    (id: string) => api.deleteWorkflow(id),
    {
      showSuccessToast: "Workflow deleted successfully",
      showErrorToast: true,
      invalidateQueries: [workflowKeys.all],
    },
  );

  return {
    deleteWorkflow: async (id: string) => {
      try {
        await mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}

interface UseAIModelsResult {
  models: AIModelConfig[];
  loading: boolean;
  error: string | null;
}

export function useAIModels(): UseAIModelsResult {
  const queryKey = useMemo(() => workflowKeys.models(), []);

  const { data, isLoading, error } = useQuery<{ models: AIModelConfig[] }>(
    queryKey,
    () => api.getModels(),
    {
      staleTime: 1000 * 60 * 60, // 1 hour
    },
  );

  return {
    models: data?.models ?? [],
    loading: isLoading,
    error: normalizeError(error),
  };
}
