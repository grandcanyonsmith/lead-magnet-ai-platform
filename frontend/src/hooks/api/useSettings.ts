/**
 * Data fetching hooks for settings using React Query
 */

"use client";

import { useMemo } from "react";
import { useQuery } from "@/hooks/useQuery";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";
import { PromptDefaults, Settings, SettingsUpdateRequest } from "@/types";
import { normalizeError } from "./hookHelpers";
import { UsageResponse } from "@/types/usage";

// Query keys factory
export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => [...settingsKeys.all, "detail"] as const,
  promptDefaults: () => [...settingsKeys.all, "prompt-defaults"] as const,
  usage: (startDate?: string, endDate?: string) =>
    [...settingsKeys.all, "usage", startDate, endDate] as const,
};

interface UseSettingsResult {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSettings(): UseSettingsResult {
  const queryKey = useMemo(() => settingsKeys.detail(), []);

  const { data, isLoading, error, refetch } = useQuery<Settings>(
    queryKey,
    () => api.getSettings(),
    {
      enabled: true,
    },
  );

  return {
    settings: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  };
}

interface UsePromptDefaultsResult {
  promptDefaults: PromptDefaults | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePromptDefaults(): UsePromptDefaultsResult {
  const queryKey = useMemo(() => settingsKeys.promptDefaults(), []);

  const { data, isLoading, error, refetch } = useQuery<PromptDefaults>(
    queryKey,
    () => api.getPromptDefaults(),
    {
      enabled: true,
    },
  );

  return {
    promptDefaults: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  };
}

interface UseUpdateSettingsResult {
  updateSettings: (data: SettingsUpdateRequest) => Promise<Settings | null>;
  loading: boolean;
  error: string | null;
}

export function useUpdateSettings(): UseUpdateSettingsResult {
  const { mutateAsync, isPending, error } = useMutation<
    Settings,
    Error,
    SettingsUpdateRequest
  >((data: SettingsUpdateRequest) => api.updateSettings(data), {
    showSuccessToast: "Settings saved successfully",
    showErrorToast: true,
    invalidateQueries: [settingsKeys.all],
  });

  return {
    updateSettings: async (data: SettingsUpdateRequest) => {
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

interface UseUsageResult {
  usage: UsageResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUsage(startDate?: string, endDate?: string): UseUsageResult {
  const queryKey = useMemo(
    () => settingsKeys.usage(startDate, endDate),
    [startDate, endDate],
  );

  const { data, isLoading, error, refetch } = useQuery<UsageResponse>(
    queryKey,
    () => api.getUsage(startDate, endDate),
    {
      enabled: !!startDate && !!endDate,
    },
  );

  return {
    usage: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  };
}

interface UseRegenerateWebhookTokenResult {
  regenerateToken: () => Promise<Settings | null>;
  loading: boolean;
  error: string | null;
}

export function useRegenerateWebhookToken(): UseRegenerateWebhookTokenResult {
  const { mutateAsync, isPending, error } = useMutation<Settings, Error, void>(
    () => api.settings.regenerateWebhookToken(),
    {
      showSuccessToast: "Webhook token regenerated successfully",
      showErrorToast: true,
      invalidateQueries: [settingsKeys.all],
    },
  );

  return {
    regenerateToken: async () => {
      try {
        return await mutateAsync(undefined);
      } catch {
        return null;
      }
    },
    loading: isPending,
    error: normalizeError(error),
  };
}
