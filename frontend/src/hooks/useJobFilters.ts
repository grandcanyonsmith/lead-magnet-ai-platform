"use client";

import { useState, useMemo, useCallback } from "react";
import { Job } from "@/types/job";

export type SortField = "date" | "status" | "duration";
export type SortDirection = "asc" | "desc";

export function useJobFilters(
  jobs: Job[],
  workflowMap: Record<string, string>,
) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Status filter
      if (statusFilter !== "all" && job.status !== statusFilter) {
        return false;
      }

      // Workflow filter
      if (workflowFilter !== "all" && job.workflow_id !== workflowFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const workflowName = (workflowMap[job.workflow_id] || "").toLowerCase();
        const jobId = (job.job_id || "").toLowerCase();
        if (!workflowName.includes(query) && !jobId.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, statusFilter, workflowFilter, searchQuery, workflowMap]);

  return {
    statusFilter,
    workflowFilter,
    searchQuery,
    setStatusFilter,
    setWorkflowFilter,
    setSearchQuery,
    filteredJobs,
  };
}

export function useJobSorting(filteredJobs: Job[]) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField, sortDirection],
  );

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "duration":
          const durationA =
            a.completed_at && a.created_at
              ? Math.round(
                  (new Date(a.completed_at).getTime() -
                    new Date(a.created_at).getTime()) /
                    1000,
                )
              : 0;
          const durationB =
            b.completed_at && b.created_at
              ? Math.round(
                  (new Date(b.completed_at).getTime() -
                    new Date(b.created_at).getTime()) /
                    1000,
                )
              : 0;
          comparison = durationA - durationB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredJobs, sortField, sortDirection]);

  return {
    sortField,
    sortDirection,
    handleSort,
    sortedJobs,
  };
}
