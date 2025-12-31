"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { Workflow } from "@/types";

interface UseWorkflowJobsResult {
  workflowJobs: Record<string, any[]>;
  loadingJobs: Record<string, boolean>;
}

export function useWorkflowJobs(workflows: Workflow[]): UseWorkflowJobsResult {
  const [workflowJobs, setWorkflowJobs] = useState<Record<string, any[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({});

  // Track which workflow IDs we've already loaded jobs for
  const loadedWorkflowIdsRef = useRef<Set<string>>(new Set());
  
  // Refs to track state for polling/intervals
  const workflowsRef = useRef<Workflow[]>([]);
  const workflowJobsRef = useRef<Record<string, any[]>>({});
  
  // Track active polling cancellation
  const pollingCancellationRef = useRef<(() => void) | null>(null);
  // Track active initial load cancellation
  const initialLoadCancellationRef = useRef<(() => void) | null>(null);
  
  // Global request queue to ensure only one API request happens at a time
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Track active requests to prevent duplicates
  const activeRequestsRef = useRef<Map<string, Promise<void>>>(new Map());
  // Track batch processing state
  const isProcessingBatchRef = useRef<boolean>(false);
  // Track last processed workflow IDs to prevent duplicate processing
  const lastProcessedWorkflowIdsRef = useRef<string>("");

  // Update refs when state changes
  useEffect(() => {
    workflowsRef.current = workflows;
    workflowJobsRef.current = workflowJobs;
  }, [workflows, workflowJobs]);

  // Reset loaded state if workflows list drastically changes (e.g. empty)
  useEffect(() => {
    if (workflows.length === 0) {
      loadedWorkflowIdsRef.current.clear();
      lastProcessedWorkflowIdsRef.current = "";
    }
  }, [workflows.length]);

  const loadJobsForWorkflow = useCallback(async (workflowId: string) => {
    // Check if there's already an active request for this workflow
    const existingRequest = activeRequestsRef.current.get(workflowId);
    if (existingRequest) {
      return existingRequest;
    }

    // Queue the request
    const requestPromise = requestQueueRef.current.then(async () => {
      setLoadingJobs((prev) => ({ ...prev, [workflowId]: true }));
      try {
        const data = await api.getJobs({ workflow_id: workflowId, limit: 5 });
        setWorkflowJobs((prev) => ({ ...prev, [workflowId]: data.jobs || [] }));
      } catch (error) {
        console.error(`Failed to load jobs for workflow ${workflowId}:`, error);
        setWorkflowJobs((prev) => ({ ...prev, [workflowId]: [] }));
      } finally {
        activeRequestsRef.current.delete(workflowId);
        setLoadingJobs((prev) => ({ ...prev, [workflowId]: false }));
      }
    });

    // Update queue and active requests
    requestQueueRef.current = requestPromise.catch(() => {});
    activeRequestsRef.current.set(workflowId, requestPromise);

    return requestPromise;
  }, []);

  // Create stable workflow IDs string
  const workflowIds = useMemo(() => {
    return workflows
      .map((w) => w.workflow_id)
      .sort()
      .join(",");
  }, [workflows]);

  // Initial load effect
  useEffect(() => {
    if (workflows.length === 0) return;
    if (lastProcessedWorkflowIdsRef.current === workflowIds) return;

    if (initialLoadCancellationRef.current) {
      initialLoadCancellationRef.current();
      initialLoadCancellationRef.current = null;
    }

    if (isProcessingBatchRef.current) return;

    isProcessingBatchRef.current = true;
    lastProcessedWorkflowIdsRef.current = workflowIds;

    const workflowsToLoad = workflows.filter((workflow) => {
      const workflowId = workflow.workflow_id;
      if (!loadedWorkflowIdsRef.current.has(workflowId)) {
        loadedWorkflowIdsRef.current.add(workflowId);
        return true;
      }
      return false;
    });

    if (workflowsToLoad.length === 0) {
      isProcessingBatchRef.current = false;
      return;
    }

    const batchSize = 5;
    let batchIndex = 0;
    let cancelled = false;
    const timeoutIds: NodeJS.Timeout[] = [];

    const cleanupInitialLoad = () => {
      cancelled = true;
      timeoutIds.forEach((id) => clearTimeout(id));
      isProcessingBatchRef.current = false;
      initialLoadCancellationRef.current = null;
    };

    initialLoadCancellationRef.current = cleanupInitialLoad;

    const processBatch = async () => {
      if (cancelled) return;

      const batch = workflowsToLoad.slice(
        batchIndex * batchSize,
        (batchIndex + 1) * batchSize
      );

      for (const workflow of batch) {
        if (cancelled) break;
        await loadJobsForWorkflow(workflow.workflow_id);
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (cancelled) return;

      batchIndex++;
      if (batchIndex * batchSize < workflowsToLoad.length) {
        const timeoutId = setTimeout(processBatch, 100);
        timeoutIds.push(timeoutId);
      } else {
        const timeoutId = setTimeout(() => {
          if (!cancelled) {
            isProcessingBatchRef.current = false;
            initialLoadCancellationRef.current = null;
          }
        }, 200);
        timeoutIds.push(timeoutId);
      }
    };

    processBatch();

    return () => cleanupInitialLoad();
  }, [workflowIds, workflows, loadJobsForWorkflow]);

  // Check for processing jobs
  const hasProcessingJobs = useMemo(() => {
    return Object.values(workflowJobs).some((jobs) =>
      jobs.some(
        (job: any) => job.status === "processing" || job.status === "pending"
      )
    );
  }, [workflowJobs]);

  // Polling effect
  useEffect(() => {
    if (!hasProcessingJobs) {
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current();
        pollingCancellationRef.current = null;
      }
      return;
    }

    const interval = setInterval(() => {
      const currentWorkflows = workflowsRef.current;
      const currentWorkflowJobs = workflowJobsRef.current;

      const workflowsToPoll = currentWorkflows.filter((workflow) => {
        const jobs = currentWorkflowJobs[workflow.workflow_id] || [];
        return jobs.some(
          (job: any) => job.status === "processing" || job.status === "pending"
        );
      });

      if (workflowsToPoll.length === 0) return;

      if (pollingCancellationRef.current) {
        pollingCancellationRef.current();
        pollingCancellationRef.current = null;
      }

      if (isProcessingBatchRef.current) return;

      isProcessingBatchRef.current = true;

      const batchSize = 5;
      let batchIndex = 0;
      let cancelled = false;
      const timeoutIds: NodeJS.Timeout[] = [];

      const cleanupPolling = () => {
        cancelled = true;
        timeoutIds.forEach((id) => clearTimeout(id));
        isProcessingBatchRef.current = false;
        pollingCancellationRef.current = null;
      };

      pollingCancellationRef.current = cleanupPolling;

      const processPollBatch = async () => {
        if (cancelled) return;

        const batch = workflowsToPoll.slice(
          batchIndex * batchSize,
          (batchIndex + 1) * batchSize
        );

        for (const workflow of batch) {
          if (cancelled) break;
          await loadJobsForWorkflow(workflow.workflow_id);
          if (!cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        if (cancelled) return;

        batchIndex++;
        if (batchIndex * batchSize < workflowsToPoll.length) {
          const timeoutId = setTimeout(processPollBatch, 100);
          timeoutIds.push(timeoutId);
        } else {
          const timeoutId = setTimeout(() => {
            if (!cancelled) {
              isProcessingBatchRef.current = false;
              pollingCancellationRef.current = null;
            }
          }, 200);
          timeoutIds.push(timeoutId);
        }
      };

      processPollBatch();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current();
        pollingCancellationRef.current = null;
      }
      isProcessingBatchRef.current = false;
    };
  }, [hasProcessingJobs, loadJobsForWorkflow]);

  return { workflowJobs, loadingJobs };
}

