"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { useRouter } from "next/navigation";
import {
  FiSearch,
  FiHome,
  FiList,
  FiBarChart2,
  FiFileText,
  FiCommand,
} from "react-icons/fi";
import { api } from "@/lib/api";
import type { FormSubmission } from "@/types/form";
import type { Job } from "@/types/job";

interface SearchResult {
  id: string;
  type: "page" | "workflow" | "job" | "submission";
  title: string;
  subtitle?: string;
  preview?: string;
  href: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchJob extends Job {
  workflow_name?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load workflows and jobs for search
  useEffect(() => {
    if (isOpen) {
      loadSearchData();
    }
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const loadSearchData = async () => {
    setLoading(true);
    try {
      const [workflowsData, jobsData, submissionsData] = await Promise.all([
        api.getWorkflows().catch(() => ({ workflows: [] })),
        api.getJobs({ limit: 50 }).catch(() => ({ jobs: [] })),
        api.getSubmissions({ limit: 50 }).catch(() => ({ submissions: [] })),
      ]);
      setWorkflows(workflowsData.workflows || []);
      setJobs((jobsData.jobs as SearchJob[]) || []);
      setSubmissions(
        (submissionsData.submissions as FormSubmission[] | undefined)?.map(
          (s) => ({
            ...s,
            form_data: (s as any).form_data || (s as any).submission_data || {},
          }),
        ) || [],
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to load search data:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const buildSubmissionPreview = (formData: Record<string, unknown>) => {
    const entries = Object.entries(formData || {});
    if (!entries.length) return undefined;

    const formatted = entries
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
      )
      .join(" • ");

    const truncated =
      formatted.length > 140 ? `${formatted.slice(0, 140)}…` : formatted;
    return truncated;
  };

  const searchResults = useMemo(() => {
    // Navigation items for quick access
    const navItems: SearchResult[] = [
      {
        id: "nav-dashboard",
        type: "page",
        title: "Dashboard",
        href: "/dashboard",
        subtitle: "Overview",
      },
      {
        id: "nav-workflows",
        type: "page",
        title: "Lead Magnets",
        href: "/dashboard/workflows",
        subtitle: "Manage workflows",
      },
      {
        id: "nav-artifacts",
        type: "page",
        title: "Downloads",
        href: "/dashboard/artifacts",
        subtitle: "Downloaded files",
      },
      {
        id: "nav-settings",
        type: "page",
        title: "Settings",
        href: "/dashboard/settings",
        subtitle: "Account settings",
      },
    ];

    if (!query.trim()) {
      return navItems;
    }

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search navigation items
    navItems.forEach((item) => {
      if (
        item.title.toLowerCase().includes(queryLower) ||
        item.subtitle?.toLowerCase().includes(queryLower)
      ) {
        results.push(item);
      }
    });

    // Search workflows
    workflows.forEach((workflow) => {
      const name = (workflow.workflow_name || "").toLowerCase();
      const description = (workflow.workflow_description || "").toLowerCase();
      if (name.includes(queryLower) || description.includes(queryLower)) {
        results.push({
          id: `workflow-${workflow.workflow_id}`,
          type: "workflow",
          title: workflow.workflow_name || "Unnamed Workflow",
          subtitle: workflow.workflow_description || "Workflow",
          href: `/dashboard/workflows/${workflow.workflow_id}`,
        });
      }
    });

    // Search jobs
    jobs.forEach((job) => {
      const jobId = (job.job_id || "").toLowerCase();
      const workflowName = (job.workflow_name || "").toLowerCase();
      if (jobId.includes(queryLower) || workflowName.includes(queryLower)) {
        results.push({
          id: `job-${job.job_id}`,
          type: "job",
          title: job.workflow_name || "Generated Lead Magnet",
          subtitle: `Job ${job.job_id}`,
          href: `/dashboard/jobs/${job.job_id}`,
        });
      }
    });

    // Search form submissions (map to their job/work run)
    submissions.forEach((submission) => {
      const submissionText = JSON.stringify(
        submission.form_data || {},
      ).toLowerCase();
      const submissionId = (submission.submission_id || "").toLowerCase();
      const match =
        submissionText.includes(queryLower) ||
        submissionId.includes(queryLower);

      if (!match) return;

      const job = jobs.find(
        (j) => j.submission_id === submission.submission_id,
      );
      const workflowName = job?.workflow_name || "Generated Lead Magnet";
      const preview = buildSubmissionPreview(submission.form_data);

      results.push({
        id: `submission-${submission.submission_id}`,
        type: "submission",
        title: workflowName,
        subtitle: `Form submission • ${submission.submission_id}`,
        preview,
        href: job
          ? `/dashboard/jobs/${job.job_id}`
          : `/dashboard/workflows/${submission.workflow_id}`,
      });
    });

    return results.slice(0, 10); // Limit to 10 results
  }, [query, workflows, jobs, submissions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      scrollToSelected();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      scrollToSelected();
    } else if (e.key === "Enter" && searchResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(searchResults[selectedIndex]);
    }
  };

  const scrollToSelected = () => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    onClose();
    setQuery("");
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "page":
        return <FiHome className="h-4 w-4" />;
      case "workflow":
        return <FiList className="h-4 w-4" />;
      case "job":
        return <FiBarChart2 className="h-4 w-4" />;
      case "submission":
        return <FiFileText className="h-4 w-4" />;
      default:
        return <FiSearch className="h-4 w-4" />;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="top-[15%] flex max-h-[85vh] w-full max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden border border-gray-200 bg-white p-0 dark:border-border dark:bg-card sm:rounded-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-gray-200 p-4 pr-12 dark:border-border">
          <FiSearch className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, workflows, jobs, form submissions..."
            className="flex-1 bg-transparent text-base text-gray-900 outline-none placeholder-gray-400 dark:text-foreground dark:placeholder-muted-foreground"
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden items-center gap-1 rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500 sm:inline-flex dark:border-border dark:bg-secondary dark:text-muted-foreground">
              <FiCommand className="h-3 w-3" />K
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-muted-foreground">
              Loading...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-muted-foreground">
              <FiSearch className="mx-auto mb-2 h-12 w-12 text-gray-300 dark:text-muted-foreground/40" />
              <p>No results found</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-muted-foreground/70">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-primary-50 text-primary-900 dark:bg-primary/20 dark:text-primary-foreground"
                      : "text-gray-900 hover:bg-gray-50 dark:text-foreground dark:hover:bg-secondary"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 ${index === selectedIndex ? "text-primary-600 dark:text-primary" : "text-gray-400 dark:text-muted-foreground"}`}
                  >
                    {getIcon(result.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{result.title}</div>
                    {result.subtitle && (
                      <div
                        className={`truncate text-sm ${index === selectedIndex ? "text-primary-600 dark:text-primary/80" : "text-gray-500 dark:text-muted-foreground"}`}
                      >
                        {result.subtitle}
                      </div>
                    )}
                    {result.preview && (
                      <div
                        className={`truncate text-xs ${index === selectedIndex ? "text-primary-700 dark:text-primary/70" : "text-gray-500 dark:text-muted-foreground/80"}`}
                      >
                        {result.preview}
                      </div>
                    )}
                  </div>
                  {result.type === "workflow" && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-secondary dark:text-muted-foreground">
                      Workflow
                    </span>
                  )}
                  {result.type === "job" && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-secondary dark:text-muted-foreground">
                      Job
                    </span>
                  )}
                  {result.type === "submission" && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-secondary dark:text-muted-foreground">
                      Submission
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-border dark:bg-secondary/50 dark:text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-700 dark:border-border dark:bg-card dark:text-foreground">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-700 dark:border-border dark:bg-card dark:text-foreground">
                ↵
              </kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-700 dark:border-border dark:bg-card dark:text-foreground">
                Esc
              </kbd>
              Close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
