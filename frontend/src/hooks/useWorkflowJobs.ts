"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Workflow } from "@/types";

interface UseWorkflowJobsResult {
  workflowJobs: Record<string, any[]>;
  loadingJobs: Record<string, boolean>;
}

const RECENT_JOBS_LIMIT = 200;
const POLL_INTERVAL_MS = 10000;

export function useWorkflowJobs(workflows: Workflow[]): UseWorkflowJobsResult {
  const [workflowJobs, setWorkflowJobs] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchInFlightRef = useRef(false);
  const lastFetchKeyRef = useRef<string>("");

  const workflowIds = useMemo(() => {
    return workflows
      .map((workflow) => workflow.workflow_id)
      .sort()
      .join(",");
  }, [workflows]);

  const workflowIdList = useMemo(() => {
    return workflowIds ? workflowIds.split(",") : [];
  }, [workflowIds]);

  const buildEmptyMap = useCallback(() => {
    const map: Record<string, any[]> = {};
    workflowIdList.forEach((workflowId) => {
      map[workflowId] = [];
    });
    return map;
  }, [workflowIdList]);

  const fetchRecentJobs = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    setLoading(true);
    try {
      const data = await api.getJobs({ limit: RECENT_JOBS_LIMIT });
      const jobs = data.jobs || [];
      const grouped = buildEmptyMap();
      jobs.forEach((job: any) => {
        if (grouped[job.workflow_id]) {
          grouped[job.workflow_id].push(job);
        }
      });
      setWorkflowJobs(grouped);
    } catch (error) {
      console.error("Failed to load recent workflow jobs:", error);
      setWorkflowJobs(buildEmptyMap());
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [buildEmptyMap]);

  useEffect(() => {
    if (!workflowIds) {
      setWorkflowJobs((prev) => {
        return Object.keys(prev).length === 0 ? prev : {};
      });
      return;
    }
    if (lastFetchKeyRef.current === workflowIds) return;
    lastFetchKeyRef.current = workflowIds;
    void fetchRecentJobs();
  }, [workflowIds, fetchRecentJobs]);

  const hasProcessingJobs = useMemo(() => {
    return Object.values(workflowJobs).some((jobs) =>
      jobs.some(
        (job: any) => job.status === "processing" || job.status === "pending",
      ),
    );
  }, [workflowJobs]);

  useEffect(() => {
    if (!hasProcessingJobs) return;
    const interval = setInterval(() => {
      void fetchRecentJobs();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [hasProcessingJobs, fetchRecentJobs]);

  const loadingJobs = useMemo(() => {
    const map: Record<string, boolean> = {};
    workflows.forEach((workflow) => {
      map[workflow.workflow_id] = loading;
    });
    return map;
  }, [workflows, loading]);

  return { workflowJobs, loadingJobs };
}

