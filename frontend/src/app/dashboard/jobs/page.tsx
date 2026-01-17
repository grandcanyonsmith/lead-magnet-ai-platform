"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  Fragment,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { LeadMagnetsTabs } from "@/components/leadMagnets/LeadMagnetsTabs";
import {
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { useJobFilters, useJobSorting } from "@/hooks/useJobFilters";
import { JobFiltersProvider } from "@/contexts/JobFiltersContext";
import { formatRelativeTime, formatDuration } from "@/utils/date";
import {
  SummarySection,
  SummaryCard,
  StatusQuickFilter,
} from "@/components/jobs/list/SummarySection";
import { JobsMobileList } from "@/components/jobs/list/MobileList";
import { JobsDesktopTable } from "@/components/jobs/list/DesktopTable";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Job } from "@/types/job";
import type { Workflow } from "@/types/workflow";
import toast from "react-hot-toast";
import clsx from "clsx";

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowMap, setWorkflowMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const inFlightRequestsRef = useRef<Set<string>>(new Set());
  const loadJobsRef = useRef<typeof loadJobs | null>(null);
  const prevFiltersRef = useRef({ statusFilter: "all", workflowFilter: "all" });
  const currentPageRef = useRef(currentPage);

  const filters = useJobFilters(jobs, workflowMap);
  const {
    statusFilter,
    workflowFilter,
    searchQuery,
    setStatusFilter,
    setWorkflowFilter,
    setSearchQuery,
    filteredJobs,
  } = filters;
  const sorting = useJobSorting(filteredJobs);

  const handleNavigate = useCallback(
    (jobId: string) => {
      if (typeof window !== "undefined") {
        window.location.href = `/dashboard/jobs/${jobId}`;
      } else {
        router.push(`/dashboard/jobs/${jobId}`);
      }
    },
    [router],
  );

  const statusCounts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        if (job.status in acc) {
          acc[job.status as keyof typeof acc] += 1;
        }
        return acc;
      },
      { pending: 0, processing: 0, completed: 0, failed: 0 },
    );
  }, [jobs]);

  const summaryStats = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let completedLastDay = 0;
    let totalDuration = 0;
    let durationSamples = 0;
    let latestJobCreatedAt: string | null = null;

    jobs.forEach((job) => {
      const createdAt = job.created_at
        ? new Date(job.created_at).getTime()
        : null;
      if (
        createdAt &&
        (!latestJobCreatedAt ||
          createdAt > new Date(latestJobCreatedAt).getTime())
      ) {
        latestJobCreatedAt = job.created_at;
      }

      if (
        job.status === "completed" &&
        createdAt &&
        now - createdAt <= oneDayMs
      ) {
        completedLastDay += 1;
      }

      if (job.completed_at && job.created_at) {
        const durationSeconds = Math.max(
          0,
          Math.round(
            (new Date(job.completed_at).getTime() -
              new Date(job.created_at).getTime()) /
              1000,
          ),
        );
        totalDuration += durationSeconds;
        durationSamples += 1;
      }
    });

    const avgDurationSeconds = durationSamples
      ? Math.round(totalDuration / durationSamples)
      : 0;

    return {
      activeJobs: statusCounts.processing + statusCounts.pending,
      completedLastDay,
      avgDurationSeconds,
      failedCount: statusCounts.failed,
      latestJobCreatedAt,
    };
  }, [jobs, statusCounts]);

  const lastRefreshedLabel = useMemo(
    () =>
      lastLoadedAt ? formatRelativeTime(lastLoadedAt.toISOString()) : null,
    [lastLoadedAt],
  );

  const statusQuickFilters = useMemo<StatusQuickFilter[]>(
    () => [
      {
        label: "All Leads",
        value: "all",
        count: totalJobs,
        description: "Show everything",
      },
      {
        label: "Waiting",
        value: "pending",
        count: statusCounts.pending,
        description: "Waiting to start",
      },
      {
        label: "In Progress",
        value: "processing",
        count: statusCounts.processing,
        description: "Generating now",
      },
      {
        label: "Completed",
        value: "completed",
        count: statusCounts.completed,
        description: "Reports sent",
      },
      {
        label: "Issues",
        value: "failed",
        count: statusCounts.failed,
        description: "Needs attention",
      },
    ],
    [totalJobs, statusCounts],
  );

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      {
        label: "Active Processes",
        value: summaryStats.activeJobs.toString(),
        subtext: `${statusCounts.processing} running · ${statusCounts.pending} queued`,
        icon: <ArrowPathIcon className="h-5 w-5 text-primary-600" />,
        accentClass: "border-primary-100 bg-primary-50/70",
      },
      {
        label: "New Leads (24h)",
        value: summaryStats.completedLastDay.toString(),
        subtext: summaryStats.latestJobCreatedAt
          ? `Last lead ${formatRelativeTime(summaryStats.latestJobCreatedAt)}`
          : "No leads yet",
        icon: <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-600" />,
        accentClass: "border-emerald-100 bg-emerald-50/80",
      },
      {
        label: "Issues",
        value: summaryStats.failedCount.toString(),
        subtext: jobs.length
          ? `${Math.round((summaryStats.failedCount / jobs.length) * 100)}% failure rate`
          : "No issues",
        icon: <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />,
        accentClass: "border-red-100 bg-red-50/80",
      },
    ],
    [summaryStats, statusCounts, jobs.length],
  );

  const handleQuickFilter = useCallback(
    (value: string) => {
      setStatusFilter(value);
      setCurrentPage(1);
    },
    [setStatusFilter],
  );

  const handleClearFilters = useCallback(() => {
    setStatusFilter("all");
    setWorkflowFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  }, [setStatusFilter, setWorkflowFilter, setSearchQuery]);

  // Initialize workflow filter from URL query parameter on mount
  const hasInitializedFromUrlRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedFromUrlRef.current) {
      const workflowIdFromUrl = searchParams?.get("workflow_id");
      if (workflowIdFromUrl) {
        setWorkflowFilter(workflowIdFromUrl);
      }
      hasInitializedFromUrlRef.current = true;
    }
  }, [searchParams, setWorkflowFilter]);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const data = await api.getWorkflows();
        setWorkflows(data.workflows || []);
        const map: Record<string, string> = {};
        data.workflows?.forEach((wf: Workflow) => {
          map[wf.workflow_id] = wf.workflow_name || wf.workflow_id;
        });
        setWorkflowMap(map);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load workflows:", error);
        }
        toast.error("Failed to load workflows. Please try again.");
      }
    };
    loadWorkflows();
  }, []);

  const loadJobs = useCallback(
    async (showRefreshing = false, page?: number) => {
      // Use provided page or current page from ref
      const targetPage = page ?? currentPageRef.current;
      // Create a unique key for this load request to prevent duplicates
      const loadKey = `${statusFilter}-${workflowFilter}-${targetPage}-${pageSize}`;

      // Prevent duplicate calls with same parameters - atomic check-and-set
      if (inFlightRequestsRef.current.has(loadKey)) {
        return;
      }

      // Mark this request as in-flight immediately (atomic operation)
      inFlightRequestsRef.current.add(loadKey);

      try {
        if (showRefreshing) setRefreshing(true);

        const params: any = {
          limit: pageSize,
          offset: (targetPage - 1) * pageSize,
        };
        if (statusFilter !== "all") {
          params.status = statusFilter;
        }
        if (workflowFilter !== "all") {
          params.workflow_id = workflowFilter;
        }

        const data = await api.getJobs(params);

        setJobs(data.jobs || []);
        setTotalJobs(data.total || 0);
        setHasMore(data.has_more || false);
        setLastLoadedAt(new Date());
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load jobs:", error);
        }
        toast.error("Failed to load jobs. Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        // Remove from in-flight set
        inFlightRequestsRef.current.delete(loadKey);
      }
    },
    [statusFilter, workflowFilter, pageSize],
  );

  // Keep refs updated with latest values
  useEffect(() => {
    loadJobsRef.current = loadJobs;
    currentPageRef.current = currentPage;
  }, [loadJobs, currentPage]);

  // Single effect: Handle filter changes and page changes
  useEffect(() => {
    const filtersChanged =
      prevFiltersRef.current.statusFilter !== statusFilter ||
      prevFiltersRef.current.workflowFilter !== workflowFilter;

    if (filtersChanged) {
      prevFiltersRef.current = { statusFilter, workflowFilter };
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    } else {
      prevFiltersRef.current = { statusFilter, workflowFilter };
    }

    if (loadJobsRef.current) {
      loadJobsRef.current(false, currentPage);
    }
  }, [statusFilter, workflowFilter, currentPage, pageSize]);

  // Poll for updates when there are processing jobs
  useEffect(() => {
    const hasProcessingJobs = jobs.some(
      (job) => job.status === "processing" || job.status === "pending",
    );
    if (!hasProcessingJobs) {
      return;
    }

    const interval = setInterval(() => {
      if (loadJobsRef.current) {
        loadJobsRef.current(true, currentPageRef.current);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [jobs]);

  const hasProcessingJobs = jobs.some(
    (job) => job.status === "processing" || job.status === "pending",
  );

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 dark:bg-secondary rounded w-64"></div>
            <div className="h-4 bg-gray-100 dark:bg-secondary/70 rounded w-96"></div>
          </div>
          <div className="h-10 bg-gray-200 dark:bg-secondary rounded-lg w-32"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-50 dark:bg-secondary/50 border border-gray-100 dark:border-border rounded-xl"
            ></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="h-12 bg-gray-50 border-b border-gray-200"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 border-b border-gray-100 last:border-0"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <JobFiltersProvider
      statusFilter={statusFilter}
      workflowFilter={workflowFilter}
      setStatusFilter={setStatusFilter}
      setWorkflowFilter={setWorkflowFilter}
      workflows={workflows}
    >
      <div className="max-w-7xl mx-auto">
        <PageHeader
          heading="Leads & Results"
          description="Track your collected leads and generated reports."
          bottomContent={<LeadMagnetsTabs />}
        />

        <SummarySection
          jobCount={totalJobs}
          lastRefreshedLabel={lastRefreshedLabel}
          hasProcessingJobs={hasProcessingJobs}
          refreshing={refreshing}
          onRefresh={() => loadJobs(true)}
          summaryCards={summaryCards}
          quickFilters={statusQuickFilters}
          activeFilter={statusFilter}
          onQuickFilterChange={handleQuickFilter}
          onClearFilters={handleClearFilters}
        />

        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by lead magnet name..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg leading-5 bg-white dark:bg-card dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-shadow shadow-sm"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative inline-block w-full md:w-64">
              <select
                value={workflowFilter}
                onChange={(e) => {
                  setWorkflowFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none block w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-card text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer shadow-sm"
              >
                <option value="all">All Lead Magnets</option>
                {workflows.map((wf: Workflow) => (
                  <option key={wf.workflow_id} value={wf.workflow_id}>
                    {wf.workflow_name || wf.workflow_id}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <FunnelIcon className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {sorting.sortedJobs.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center max-w-lg mx-auto mt-8">
            <div className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4">
              <ClockIcon className="h-full w-full" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No leads found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Generated reports will appear here once visitors submit your forms.
            </p>
            {(statusFilter !== "all" ||
              workflowFilter !== "all" ||
              searchQuery !== "") && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <XMarkIcon
                  className="-ml-1 mr-2 h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <JobsMobileList
              jobs={sorting.sortedJobs}
              workflowMap={workflowMap}
              onNavigate={handleNavigate}
            />
            <JobsDesktopTable
              jobs={sorting.sortedJobs}
              workflowMap={workflowMap}
              onNavigate={handleNavigate}
              sortField={sorting.sortField}
              sortDirection={sorting.sortDirection}
              onSort={sorting.handleSort}
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="text-gray-900 dark:text-white">
                  {(currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="text-gray-900 dark:text-white">
                  {Math.min(currentPage * pageSize, totalJobs)}
                </span>{" "}
                of <span className="text-gray-900 dark:text-white">{totalJobs}</span> runs
              </div>
              <div className="flex items-center gap-2">
                <nav
                  className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  </button>

                  {Array.from(
                    { length: Math.min(5, Math.ceil(totalJobs / pageSize)) },
                    (_, i) => {
                      const totalPages = Math.ceil(totalJobs / pageSize) || 1;
                      let displayPage = i + 1;

                      if (totalPages > 5) {
                        if (currentPage <= 3) {
                          displayPage = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          displayPage = totalPages - 4 + i;
                        } else {
                          displayPage = currentPage - 2 + i;
                        }
                      }

                      if (displayPage < 1 || displayPage > totalPages) {
                        return null;
                      }

                      return (
                        <button
                          key={displayPage}
                          onClick={() => {
                            setCurrentPage(displayPage);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          aria-current={
                            currentPage === displayPage ? "page" : undefined
                          }
                          className={clsx(
                            "relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20",
                            currentPage === displayPage
                              ? "z-10 bg-primary-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                              : "text-gray-900 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-offset-0",
                          )}
                        >
                          {displayPage}
                        </button>
                      );
                    },
                  )}

                  <button
                    onClick={() => {
                      if (hasMore || currentPage * pageSize < totalJobs) {
                        setCurrentPage(currentPage + 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    disabled={!hasMore && currentPage * pageSize >= totalJobs}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {hasProcessingJobs && (
          <div className="fixed bottom-6 right-6 z-30">
            <div className="bg-white dark:bg-card rounded-full shadow-lg border border-primary-100 dark:border-primary-900 px-4 py-2 flex items-center gap-2 text-sm font-bold text-primary-700 dark:text-primary-300 animate-in slide-in-from-bottom-4 duration-300">
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Updating progress...
            </div>
          </div>
        )}
      </div>
    </JobFiltersProvider>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <JobsContent />
    </Suspense>
  );
}
