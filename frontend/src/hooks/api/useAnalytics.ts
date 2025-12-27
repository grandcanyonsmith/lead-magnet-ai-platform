/**
 * Data fetching hooks for analytics using React Query
 */

"use client";

import { useMemo } from "react";
import { useQuery } from "@/hooks/useQuery";
import { api } from "@/lib/api";
import { AnalyticsResponse } from "@/types";
import { normalizeError } from "./hookHelpers";

// Query keys factory
export const analyticsKeys = {
  all: ["analytics"] as const,
  overview: (params?: Record<string, unknown>) =>
    [...analyticsKeys.all, "overview", params] as const,
};

interface UseAnalyticsResult {
  data: AnalyticsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAnalytics(params?: Record<string, unknown>): UseAnalyticsResult {
  const queryKey = useMemo(() => analyticsKeys.overview(params), [params]);

  const { data, isLoading, error, refetch } = useQuery<AnalyticsResponse>(
    queryKey,
    () => api.getAnalytics(params),
    {
      enabled: true,
      // Analytics data doesn't change often, so we can keep it stale for longer
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  return {
    data: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  };
}

