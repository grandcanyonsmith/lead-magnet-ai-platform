import React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MergedStep, StepStatus } from "@/types/job";
import type { Status } from "@/types/common";

interface StepHeaderProps {
  jobHref: string;
  jobId?: string;
  stepLabel: string;
  heading: string;
  description: string;
  stepStatus: Status | StepStatus;
  isLiveStep: boolean;
  stepTypeLabel: string;
  step: MergedStep | null;
  toolLabels: string[];
  canEditStep: boolean;
  handleEditStep: () => void;
  isEditingDisabled: boolean;
  prevHref: string | null;
  nextHref: string | null;
}

export function StepHeader({
  jobHref,
  jobId,
  stepLabel,
  heading,
  description,
  stepStatus,
  isLiveStep,
  stepTypeLabel,
  step,
  toolLabels,
  canEditStep,
  handleEditStep,
  isEditingDisabled,
  prevHref,
  nextHref,
}: StepHeaderProps) {
  return (
    <div className="space-y-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      >
        <Link
          href="/dashboard/jobs"
          className="hover:text-gray-900 dark:hover:text-white"
        >
          Jobs
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link
          href={jobHref}
          className="font-mono text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {jobId}
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-gray-700 dark:text-gray-200">
          {stepLabel}
        </span>
      </nav>
      <PageHeader
        heading={heading}
        description={description}
        bottomContent={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                {stepLabel}
              </span>
              <StatusBadge
                status={stepStatus}
                className="px-3 py-1 text-xs"
              />
              {isLiveStep && (
                <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                  Live
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 capitalize">
                {stepTypeLabel}
              </span>
              {step?.model && (
                <span className="inline-flex items-center rounded-full border border-purple-200 dark:border-purple-800/40 bg-purple-50/60 dark:bg-purple-900/20 px-3 py-1 text-xs text-purple-700 dark:text-purple-300">
                  {step.model}
                </span>
              )}
            </div>
            {toolLabels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {toolLabels.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-md border border-primary-100 dark:border-primary-800/40 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        }
      >
        {canEditStep && (
          <button
            type="button"
            onClick={handleEditStep}
            disabled={isEditingDisabled}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PencilSquareIcon className="h-4 w-4" />
            {isEditingDisabled ? "Editing locked" : "Edit step"}
          </button>
        )}
        <Link
          href={jobHref}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job
        </Link>
        {prevHref && (
          <Link
            href={prevHref}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Previous
          </Link>
        )}
        {nextHref && (
          <Link
            href={nextHref}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Next
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
      </PageHeader>
    </div>
  );
}
