import { Job, JobDurationInfo } from "@/types/job";
import { formatDuration } from "@/utils/date";

export function getJobDuration(job?: Job | null): JobDurationInfo | null {
  const shouldFallbackToCreatedAt =
    job?.status === "processing" ||
    job?.status === "completed" ||
    job?.status === "failed";

  const startTime =
    job?.started_at || (shouldFallbackToCreatedAt ? job?.created_at : null);

  if (!startTime) return null;

  const start = new Date(startTime).getTime();
  const endTime = job?.completed_at || job?.failed_at;
  const endTimestamp = endTime ? new Date(endTime).getTime() : Date.now();

  const seconds = Math.max(0, Math.round((endTimestamp - start) / 1000));

  return {
    seconds,
    label: formatDuration(seconds),
    isLive:
      !job?.completed_at &&
      !job?.failed_at &&
      !job?.error_message &&
      job?.status === "processing",
  };
}
