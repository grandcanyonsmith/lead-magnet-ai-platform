import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Job } from "@/types/job";
import { Workflow } from "@/types/workflow";

interface UseJobRelatedDataProps {
  job: Job | null;
  activeWorkflowVersion: number | null;
}

export function useJobRelatedData({
  job,
  activeWorkflowVersion,
}: UseJobRelatedDataProps) {
  const [totalWorkflowRuns, setTotalWorkflowRuns] = useState<number | null>(
    null,
  );
  const [loadingTotalWorkflowRuns, setLoadingTotalWorkflowRuns] =
    useState(false);
  const [versionRunCount, setVersionRunCount] = useState<number | null>(null);
  const [loadingVersionRunCount, setLoadingVersionRunCount] = useState(false);
  const [workflowJobs, setWorkflowJobs] = useState<Job[]>([]);
  const [workflowJobsLoading, setWorkflowJobsLoading] = useState(false);
  const [workflowOptions, setWorkflowOptions] = useState<Workflow[]>([]);
  const [workflowOptionsLoading, setWorkflowOptionsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;
    setWorkflowOptionsLoading(true);
    api
      .getWorkflows()
      .then((data) => {
        if (!isActive) return;
        setWorkflowOptions(Array.isArray(data.workflows) ? data.workflows : []);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Failed to load lead magnets:", error);
        setWorkflowOptions([]);
      })
      .finally(() => {
        if (!isActive) return;
        setWorkflowOptionsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const workflowId = job?.workflow_id;
    if (!workflowId) {
      setTotalWorkflowRuns(null);
      setLoadingTotalWorkflowRuns(false);
      setVersionRunCount(null);
      setLoadingVersionRunCount(false);
      setWorkflowJobs([]);
      setWorkflowJobsLoading(false);
      return;
    }

    setLoadingTotalWorkflowRuns(true);
    setLoadingVersionRunCount(true);
    setWorkflowJobsLoading(true);
    api
      .getJobs({ workflow_id: workflowId, all: true })
      .then((data) => {
        if (!isActive) return;
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const sortedJobs = [...jobs].sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          if (aTime !== bTime) return aTime - bTime;
          return a.job_id.localeCompare(b.job_id);
        });
        setWorkflowJobs(sortedJobs);
        const total =
          typeof data.total === "number"
            ? data.total
            : typeof data.count === "number"
              ? data.count
              : jobs.length;
        setTotalWorkflowRuns(total);
        if (typeof activeWorkflowVersion === "number") {
          const versionCount = jobs.filter(
            (jobItem) => jobItem.workflow_version === activeWorkflowVersion,
          ).length;
          setVersionRunCount(versionCount);
        } else {
          setVersionRunCount(null);
        }
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Failed to load workflow run count:", error);
        setTotalWorkflowRuns(null);
        setVersionRunCount(null);
        setWorkflowJobs([]);
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingTotalWorkflowRuns(false);
        setLoadingVersionRunCount(false);
        setWorkflowJobsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [job?.workflow_id, activeWorkflowVersion]);

  return {
    totalWorkflowRuns,
    loadingTotalWorkflowRuns,
    versionRunCount,
    loadingVersionRunCount,
    workflowJobs,
    workflowJobsLoading,
    workflowOptions,
    workflowOptionsLoading,
  };
}
