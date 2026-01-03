"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { logger } from "@/utils/logger";
import type { Job } from "@/types/job";
import type { Workflow } from "@/types/workflow";
import type { FormSubmission, Form } from "@/types/form";

type RouterInstance = ReturnType<typeof useRouter>;

export function useJobDetail() {
  const router = useRouter();
  const jobId = useJobIdentifier();
  const jobResource = useJobResource(jobId, router);
  const execution = useJobExecution({
    jobId,
    job: jobResource.job,
    setJob: jobResource.setJob,
    loadJob: jobResource.loadJob,
  });

  return {
    job: jobResource.job,
    workflow: jobResource.workflow,
    submission: jobResource.submission,
    form: jobResource.form,
    loading: jobResource.loading,
    error: jobResource.error,
    resubmitting: jobResource.resubmitting,
    handleResubmit: jobResource.handleResubmit,
    rerunningStep: execution.rerunningStep,
    handleRerunStep: execution.handleRerunStep,
    executionStepsError: execution.executionStepsError,
    refreshJob: jobResource.refreshJob,
    refreshing: jobResource.refreshing,
    lastLoadedAt: jobResource.lastLoadedAt,
  };
}

function useJobIdentifier() {
  const params = useParams();
  const [jobId, setJobId] = useState<string>(() =>
    resolveJobId(params?.id as string | undefined),
  );

  const getJobId = useCallback(
    () => resolveJobId(params?.id as string | undefined),
    [params?.id],
  );

  useEffect(() => {
    const resolved = getJobId();
    setJobId((current) => {
      if (resolved && resolved !== current && resolved !== "_") {
        return resolved;
      }
      return current;
    });
  }, [getJobId]);

  return jobId;
}

function resolveJobId(paramId?: string) {
  if (paramId && paramId.trim() !== "" && paramId !== "_") {
    return paramId;
  }
  if (typeof window !== "undefined") {
    const pathMatch = window.location.pathname.match(
      /\/dashboard\/jobs\/([^/?#]+)/,
    );
    if (
      pathMatch &&
      pathMatch[1] &&
      pathMatch[1].trim() !== "" &&
      pathMatch[1] !== "_"
    ) {
      return pathMatch[1];
    }
    const hashMatch = window.location.hash.match(
      /\/dashboard\/jobs\/([^/?#]+)/,
    );
    if (
      hashMatch &&
      hashMatch[1] &&
      hashMatch[1].trim() !== "" &&
      hashMatch[1] !== "_"
    ) {
      return hashMatch[1];
    }
  }
  return paramId || "";
}

interface UseJobResourceResult {
  job: Job | null;
  setJob: React.Dispatch<React.SetStateAction<Job | null>>;
  workflow: Workflow | null;
  submission: FormSubmission | null;
  form: Form | null;
  loading: boolean;
  error: string | null;
  resubmitting: boolean;
  refreshing: boolean;
  lastLoadedAt: Date | null;
  refreshJob: () => Promise<void>;
  handleResubmit: () => Promise<void>;
  loadJob: () => Promise<void>;
}

export function useJobResource(
  jobId: string | null,
  router: RouterInstance,
): UseJobResourceResult {
  const [job, setJob] = useState<Job | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  // Track loading promise to prevent concurrent loads for the same jobId
  const loadingPromiseRef = useRef<Promise<void> | null>(null);
  // Track latest job value to avoid stale closures
  const jobRef = useRef<Job | null>(null);

  const loadJob = useCallback(async () => {
    if (!jobId || jobId.trim() === "" || jobId === "_") {
      setError("Invalid job ID. Please select a job from the list.");
      setLoading(false);
      return;
    }

    // If there's already a load in progress for this jobId, return the existing promise
    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }

    // Create and IMMEDIATELY store the promise to prevent race conditions
    // We create a promise that wraps the async work
    let promiseResolve: (() => void) | undefined;
    let promiseReject: ((error: unknown) => void) | undefined;
    const loadPromise = new Promise<void>((resolve, reject) => {
      promiseResolve = resolve;
      promiseReject = reject;
    });

    // Store the promise IMMEDIATELY before starting async work
    loadingPromiseRef.current = loadPromise;

    // Now start the async work
    (async () => {
      try {
        const data = await api.getJob(jobId);
        setJob(data);
        jobRef.current = data; // Update ref with latest job value
        setLastLoadedAt(new Date());

        if (data.workflow_id) {
          try {
            const workflowData = await api.getWorkflow(data.workflow_id);
            setWorkflow(workflowData);
          } catch (err) {
            console.error("Failed to load workflow:", err);
          }
        } else {
          setWorkflow(null);
        }

        if (data.submission_id) {
          try {
            const submissionData = await api.getSubmission(data.submission_id);
            setSubmission(submissionData);

            if (submissionData.form_id) {
              try {
                const formData = await api.getForm(submissionData.form_id);
                setForm(formData);
              } catch (err) {
                console.error("Failed to load form:", err);
                setForm(null);
              }
            } else {
              setForm(null);
            }
          } catch (err) {
            console.error("Failed to load submission:", err);
            setSubmission(null);
            setForm(null);
          }
        } else {
          setSubmission(null);
          setForm(null);
        }

        setError(null);
        promiseResolve?.();
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        console.error("Failed to load job:", error);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load lead magnet",
        );
        setLoading(false);
        promiseReject?.(error);
      } finally {
        setLoading(false);
        // Clear the promise ref when done (only if it's still this promise)
        if (loadingPromiseRef.current === loadPromise) {
          loadingPromiseRef.current = null;
        }
      }
    })();

    return loadPromise;
  }, [jobId]);

  const refreshJob = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadJob();
    } finally {
      setRefreshing(false);
    }
  }, [loadJob]);

  const handleResubmit = useCallback(async () => {
    if (!jobId) {
      toast.error("Job ID is missing");
      return;
    }

    setResubmitting(true);
    setError(null);

    try {
      const result = await api.resubmitJob(jobId);
      if (typeof window !== "undefined") {
        window.location.href = `/dashboard/jobs/${result.job_id}`;
      } else {
        router.push(`/dashboard/jobs/${result.job_id}`);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      console.error("Failed to resubmit job:", error);
      setError(
        err.response?.data?.message || err.message || "Failed to resubmit job",
      );
    } finally {
      setResubmitting(false);
    }
  }, [jobId, router]);

  // Track the last jobId we cleared the ref for
  const lastClearedJobIdRef = useRef<string | null>(null);

  // Keep jobRef in sync with job state
  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    // Only clear loading promise when jobId actually changes (not on every render)
    if (lastClearedJobIdRef.current !== jobId) {
      loadingPromiseRef.current = null;
      lastClearedJobIdRef.current = jobId;
      jobRef.current = null; // Clear job ref when jobId changes
    }

    if (jobId && jobId.trim() !== "" && jobId !== "_") {
      loadJob();
    } else {
      setError("Invalid job ID. Please select a job from the list.");
      setLoading(false);
      jobRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]); // Only depend on jobId - loadJob is stable as long as jobId doesn't change

  return {
    job,
    setJob,
    workflow,
    submission,
    form,
    loading,
    error,
    resubmitting,
    refreshing,
    lastLoadedAt,
    refreshJob,
    handleResubmit,
    loadJob,
  };
}

interface UseJobExecutionArgs {
  jobId: string | null;
  job: Job | null;
  setJob: React.Dispatch<React.SetStateAction<Job | null>>;
  loadJob: () => Promise<void>;
}

interface UseJobExecutionResult {
  executionStepsError: string | null;
  rerunningStep: number | null;
  handleRerunStep: (
    stepIndex: number,
    continueAfter?: boolean,
  ) => Promise<void>;
}

export function useJobExecution({
  jobId,
  job,
  setJob,
  loadJob,
}: UseJobExecutionArgs): UseJobExecutionResult {
  const [executionStepsError, setExecutionStepsError] = useState<string | null>(
    null,
  );
  const [rerunningStep, setRerunningStep] = useState<number | null>(null);
  const [hasLoadedExecutionSteps, setHasLoadedExecutionSteps] = useState(false);

  // Track loading promise to prevent concurrent loads for the same jobId
  const loadingExecutionStepsPromiseRef = useRef<Promise<void> | null>(null);
  const lastClearedExecutionStepsJobIdRef = useRef<string | null>(null);

  // Track latest job value to avoid stale closures
  const jobRef = useRef<Job | null>(null);

  // Keep jobRef in sync with job prop
  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  // Extract S3 key as a stable value to avoid re-running effect when job reference changes
  const executionStepsS3Key = useMemo(
    () => job?.execution_steps_s3_key || null,
    [job?.execution_steps_s3_key],
  );

  useEffect(() => {
    setHasLoadedExecutionSteps(false);
    // Clear promise ref when jobId changes
    loadingExecutionStepsPromiseRef.current = null;
    lastClearedExecutionStepsJobIdRef.current = jobId;
  }, [jobId]);

  const loadExecutionSteps = useCallback(
    async (jobSnapshot?: Job | null) => {
      if (!jobId) return;

      // If there's already a load in progress for this jobId, return the existing promise
      if (loadingExecutionStepsPromiseRef.current) {
        return loadingExecutionStepsPromiseRef.current;
      }

      // Create and IMMEDIATELY store the promise to prevent race conditions
      let promiseResolve: (() => void) | undefined;
      let promiseReject: ((error: unknown) => void) | undefined;
      const loadPromise = new Promise<void>((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
      });

      // Store the promise IMMEDIATELY before starting async work
      loadingExecutionStepsPromiseRef.current = loadPromise;

      // Now start the async work
      (async () => {
        // Use jobSnapshot if provided, otherwise fall back to ref (latest value) or job from closure
        const snapshot = jobSnapshot ?? jobRef.current ?? job;
        if (!snapshot) {
          const errorMsg = "No job snapshot provided and job not available";
          setExecutionStepsError(errorMsg);
          setHasLoadedExecutionSteps(true); // Mark as loaded to prevent retries
          if (promiseReject) {
            promiseReject(new Error(errorMsg));
          }
          // Clear the promise ref when done
          if (loadingExecutionStepsPromiseRef.current === loadPromise) {
            loadingExecutionStepsPromiseRef.current = null;
          }
          return;
        }

        try {
          const executionSteps = await api.getExecutionSteps(jobId);
          if (Array.isArray(executionSteps)) {
            setJob((prevJob) =>
              prevJob
                ? { ...prevJob, execution_steps: executionSteps }
                : prevJob,
            );
            setExecutionStepsError(null);
            setHasLoadedExecutionSteps(true);
            promiseResolve?.();
          } else {
            const errorMsg = `Invalid execution steps data format: expected array, got ${typeof executionSteps}`;
            console.error(`❌ ${errorMsg} for job ${jobId}`);
            setExecutionStepsError(errorMsg);
            promiseReject?.(new Error(errorMsg));
          }
        } catch (err: unknown) {
          const error = err as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          let errorMsg = `Error fetching execution steps: ${error.response?.data?.message || error.message || "Unknown error"}`;
          if (snapshot?.execution_steps_s3_key) {
            errorMsg += ` (S3 Key: ${snapshot.execution_steps_s3_key})`;
          }
          console.error(`❌ ${errorMsg} for job ${jobId}`, {
            error: err,
            response: error.response,
          });
          setExecutionStepsError(errorMsg);
          promiseReject?.(err);
        } finally {
          // Clear the promise ref when done (only if it's still this promise)
          if (loadingExecutionStepsPromiseRef.current === loadPromise) {
            loadingExecutionStepsPromiseRef.current = null;
          }
        }
      })();

      return loadPromise;
    },
    [jobId, job, setJob], // Include job to satisfy hook deps; main input still jobSnapshot
  );

  useEffect(() => {
    if (!jobId || !job) {
      return;
    }

    // If we've already loaded execution steps for this jobId, don't reload
    // (even if execution_steps is empty - that's valid data)
    if (hasLoadedExecutionSteps) {
      return;
    }

    const hasExecutionSteps =
      Array.isArray(job.execution_steps) && job.execution_steps.length > 0;
    const shouldLoadFromApi =
      !hasExecutionSteps || (executionStepsS3Key && !hasLoadedExecutionSteps);

    if (shouldLoadFromApi) {
      loadExecutionSteps(job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, executionStepsS3Key, hasLoadedExecutionSteps]); // Use memoized S3 key value instead of job reference

  useEffect(() => {
    if (!job || !jobId) {
      return;
    }

    const shouldPoll = job.status === "processing" || rerunningStep !== null;
    if (!shouldPoll) {
      return;
    }

    let lastStepsFetchAt = 0;
    const pollInterval = setInterval(async () => {
      try {
        const now = Date.now();
        const data = await api.getJob(jobId);
        setJob((prevJob) =>
          prevJob
            ? {
                ...prevJob,
                status: data.status,
                updated_at: data.updated_at,
                live_step: data.live_step ?? null,
              }
            : prevJob,
        );
        // Execution steps come from S3 and are more expensive to fetch; keep them at ~3s cadence.
        if (now - lastStepsFetchAt > 2500) {
          lastStepsFetchAt = now;
          await loadExecutionSteps(data);
        }

        if (rerunningStep !== null && data.status !== "processing") {
          setRerunningStep(null);
        }
      } catch (err) {
        logger.debug("Polling error", {
          context: "useJobExecution",
          error: err,
        });
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [job, jobId, loadExecutionSteps, rerunningStep, setJob]);

  const handleRerunStep = useCallback(
    async (stepIndex: number, continueAfter: boolean = false) => {
      if (!jobId) {
        toast.error("Job ID is missing");
        return;
      }

      setRerunningStep(stepIndex);
      setExecutionStepsError(null);

      try {
        const result = await api.rerunStep(jobId, stepIndex, continueAfter);
        logger.debug("Rerun step response received", {
          context: "useJobExecution",
          data: { result },
        });
        const actionText = continueAfter ? "rerun and continue" : "rerun";
        toast.success(
          `Step ${stepIndex + 1} ${actionText} initiated. The step will be reprocessed shortly.`,
        );

        setTimeout(async () => {
          try {
            // Wait for loadJob to complete to ensure job state is updated
            await loadJob();
            // Wait a tick for React to update the job prop and sync jobRef
            await new Promise((resolve) => setTimeout(resolve, 0));
            // Use jobRef (synced with job prop) or fall back to job prop directly
            const jobToUse = jobRef.current ?? job;
            if (jobToUse) {
              loadExecutionSteps(jobToUse);
            } else {
              logger.debug(
                "No job available after loadJob, skipping loadExecutionSteps",
                { context: "useJobExecution" },
              );
            }
          } catch (error) {
            logger.debug("Error in handleRerunStep timeout", {
              context: "useJobExecution",
              error,
            });
          }
        }, 2000);
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMessage =
          err.response?.data?.message || err.message || "Failed to rerun step";
        logger.debug("Failed to rerun step", {
          context: "useJobExecution",
          error,
        });
        setExecutionStepsError(errorMessage);
        toast.error(`Failed to rerun step: ${errorMessage}`);
      } finally {
        setTimeout(() => {
          setRerunningStep(null);
        }, 5000);
      }
    },
    [job, jobId, loadExecutionSteps, loadJob],
  );

  return {
    executionStepsError,
    rerunningStep,
    handleRerunStep,
  };
}
