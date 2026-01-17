"use client";

import { Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatRelativeTime } from "@/utils/date";
import type { Status } from "@/types/common";
import type { Job } from "@/types/job";
import type { Workflow } from "@/types/workflow";
import type { FormSubmission } from "@/types/form";

interface JobHeaderProps {
  error: string | null;
  resubmitting: boolean;
  onResubmit: () => void;
  job?: Job | null;
  workflow?: Workflow | null;
  submission?: FormSubmission | null;
  lastUpdatedLabel?: string | null;
  lastRefreshedLabel?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

interface LeadHighlight {
  label: string;
  value: string;
}

const STATUS_DOT_CLASS: Record<Status, string> = {
  pending: "bg-gray-400",
  processing: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export function JobHeader({
  error,
  resubmitting,
  onResubmit,
  job,
  workflow,
  submission,
  lastUpdatedLabel,
  lastRefreshedLabel,
  refreshing,
  onRefresh,
}: JobHeaderProps) {
  const router = useRouter();
  const { leadName } = useMemo(
    () => buildLeadHighlights(submission?.form_data),
    [submission?.form_data],
  );

  const submittedLabel = submission?.created_at
    ? formatRelativeTime(submission.created_at)
    : null;
  const updatedLabel =
    lastUpdatedLabel ||
    (job?.updated_at ? formatRelativeTime(job.updated_at) : null) ||
    (job?.created_at ? formatRelativeTime(job.created_at) : null);

  const heading = leadName || workflow?.workflow_name || "Lead report";
  const description = [
    workflow?.workflow_name && heading !== workflow.workflow_name
      ? `Workflow: ${workflow.workflow_name}`
      : null,
    submittedLabel ? `Submitted ${submittedLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Generated lead report and execution details.";

  const statusLabel = job?.status ? STATUS_LABELS[job.status] : null;
  const statusDotClass = job?.status ? STATUS_DOT_CLASS[job.status] : null;
  const headingMaxLength = 60;
  const truncatedHeading = truncateValue(heading, headingMaxLength);
  const headingContent = (
    <span className="flex items-center gap-2 min-w-0">
      {statusDotClass && statusLabel && (
        <span
          className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`}
          role="img"
          aria-label={`Status: ${statusLabel}`}
          title={statusLabel}
        />
      )}
      <span className="min-w-0 truncate" title={heading}>
        {truncatedHeading}
      </span>
    </span>
  );

  const timelineLabel = [
    updatedLabel ? `Updated ${updatedLabel}` : null,
    lastRefreshedLabel ? `Viewed ${lastRefreshedLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const getMenuItemClass = (active: boolean, disabled?: boolean) => {
    const base =
      "group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors";
    if (disabled) {
      return `${base} text-gray-400 dark:text-gray-500 cursor-not-allowed`;
    }
    return active
      ? `${base} bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300`
      : `${base} text-gray-700 dark:text-gray-300`;
  };

  const hasActions = Boolean(workflow?.workflow_id || onRefresh || onResubmit);

  return (
    <div className="mb-8 space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-red-700 dark:text-red-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Unable to update this job</p>
            <p className="text-sm text-red-700/90 dark:text-red-200/90">
              {error}
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-200 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      )}

      <PageHeader
        heading={headingContent}
        description={description}
        className="mb-0 pb-4"
        bottomContent={
          timelineLabel ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {timelineLabel}
            </p>
          ) : null
        }
      >
        {hasActions && (
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button
              aria-label="Job actions"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-50">
                <div className="px-1 py-1">
                  {workflow?.workflow_id && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/dashboard/workflows/${workflow.workflow_id}/edit`,
                            )
                          }
                          className={getMenuItemClass(active)}
                        >
                          <PencilSquareIcon className="mr-2 h-4 w-4" />
                          Edit lead magnet
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  {onRefresh && (
                    <Menu.Item disabled={refreshing}>
                      {({ active, disabled }) => (
                        <button
                          type="button"
                          onClick={onRefresh}
                          disabled={disabled}
                          className={getMenuItemClass(active, disabled)}
                        >
                          <ArrowPathIcon
                            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                          />
                          {refreshing ? "Refreshing..." : "Refresh data"}
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  <Menu.Item disabled={resubmitting}>
                    {({ active, disabled }) => (
                      <button
                        type="button"
                        onClick={onResubmit}
                        disabled={disabled}
                        className={getMenuItemClass(active, disabled)}
                      >
                        <ArrowUturnLeftIcon className="mr-2 h-4 w-4" />
                        {resubmitting ? "Resubmitting..." : "Resubmit"}
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        )}
      </PageHeader>
    </div>
  );
}

function buildLeadHighlights(
  formData?: Record<string, unknown> | null,
): { leadName: string | null; leadHighlights: LeadHighlight[] } {
  if (!formData || typeof formData !== "object") {
    return { leadName: null, leadHighlights: [] };
  }

  const data = formData as Record<string, unknown>;
  const usedKeys = new Set<string>();

  const leadName = findValueForKeys(
    data,
    ["name", "full_name", "first_name", "submitter_name", "contact_name"],
    usedKeys,
  );

  const highlights: LeadHighlight[] = [];
  if (leadName) {
    highlights.push({ label: "Lead", value: leadName });
  }

  const fields = [
    {
      label: "Company",
      keys: ["company", "company_name", "organization", "business_name"],
    },
    { label: "Email", keys: ["email", "email_address", "work_email"] },
    {
      label: "Phone",
      keys: ["phone", "phone_number", "mobile", "contact_number"],
    },
    { label: "Website", keys: ["website", "company_website", "url"] },
  ];

  fields.forEach((field) => {
    const value = findValueForKeys(data, field.keys, usedKeys);
    if (value) {
      highlights.push({ label: field.label, value });
    }
  });

  if (highlights.length === 0) {
    const fallbackEntries = Object.entries(data).slice(0, 2);
    fallbackEntries.forEach(([key, value]) => {
      const formatted = formatFieldValue(value);
      if (!formatted) return;
      const label = key.replace(/_/g, " ");
      highlights.push({ label, value: formatted });
    });
  }

  return {
    leadName,
    leadHighlights: highlights.map((item) => ({
      ...item,
      value: truncateValue(item.value, 120),
    })),
  };
}

function findValueForKeys(
  data: Record<string, unknown>,
  keys: string[],
  usedKeys: Set<string>,
): string | null {
  const keySet = new Set(keys.map((key) => key.toLowerCase()));
  const entry = Object.entries(data).find(([key, value]) => {
    if (usedKeys.has(key.toLowerCase())) return false;
    if (!keySet.has(key.toLowerCase())) return false;
    return value !== null && value !== undefined;
  });

  if (!entry) return null;

  const [key, value] = entry;
  const formatted = formatFieldValue(value);
  if (!formatted) return null;

  usedKeys.add(key.toLowerCase());
  return formatted;
}

function formatFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncateValue(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
