/**
 * Hook to handle job polling logic
 * Extracted from useJobDetail for better separation of concerns
 */

import { useEffect } from "react";
import { useQuery } from "@/hooks/useQuery";
import { api } from "@/lib/api";
import { Job } from "@/types";
import { jobKeys } from "@/hooks/api/useJobs";

interface UseJobPollingParams {
  jobId: string;
  enabled: boolean;
  interval?: number;
}

/**
 * Polls for job updates when job is processing
 */
export function useJobPolling({
  jobId,
  enabled,
  interval = 3000,
}: UseJobPollingParams) {
  const { data: job, refetch } = useQuery<Job>(
    jobKeys.detail(jobId),
    () => api.getJob(jobId),
    {
      enabled: enabled && !!jobId,
      refetchInterval: (query) => {
        const jobData = query.state.data;
        if (!enabled || !jobData) return false;
        // Poll while the job is queued or processing
        return jobData.status === "processing" || jobData.status === "pending"
          ? interval
          : false;
      },
    },
  );

  return { job, refetch };
}
