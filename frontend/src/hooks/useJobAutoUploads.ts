import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { JobAutoUploadItem } from "@/types/job";

interface UseJobAutoUploadsOptions {
  jobId?: string | null;
  enabled?: boolean;
  poll?: boolean;
  pollIntervalMs?: number;
  jobStatus?: string | null;
}

export function useJobAutoUploads({
  jobId,
  enabled = true,
  poll = true,
  pollIntervalMs = 5000,
  jobStatus,
}: UseJobAutoUploadsOptions) {
  const [items, setItems] = useState<JobAutoUploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const lastJobIdRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !jobId) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await api.getJobAutoUploads(jobId);
      setItems(response.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load auto uploads");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [enabled, jobId]);

  useEffect(() => {
    if (!enabled || !jobId) {
      setItems([]);
      setError(null);
      setLoading(false);
      lastJobIdRef.current = null;
      return;
    }

    if (lastJobIdRef.current !== jobId) {
      lastJobIdRef.current = jobId;
      setItems([]);
    }

    refresh();
  }, [enabled, jobId, refresh]);

  useEffect(() => {
    if (!enabled || !jobId || !poll) return;
    if (jobStatus !== "processing") return;

    const interval = setInterval(() => {
      refresh();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, jobId, poll, pollIntervalMs, jobStatus, refresh]);

  useEffect(() => {
    if (!enabled || !jobId) return;
    if (!jobStatus || jobStatus === lastStatusRef.current) return;
    lastStatusRef.current = jobStatus;

    if (jobStatus !== "processing") {
      refresh();
    }
  }, [enabled, jobId, jobStatus, refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}
