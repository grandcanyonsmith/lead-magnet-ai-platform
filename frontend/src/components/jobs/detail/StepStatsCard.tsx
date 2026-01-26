"use client";

import type { MergedStep } from "@/types/job";

interface StepStatsCardProps {
  step: MergedStep;
  stepTypeLabel: string;
  toolChoice?: string | null;
  toolLabels: string[];
  durationLabel: string | null;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
  formattedCost: string | null;
  usageRows: { label: string; value: string }[];
  jobStatus?: string;
}

export function StepStatsCard({
  step,
  stepTypeLabel,
  toolChoice,
  toolLabels,
  durationLabel,
  startedAtLabel,
  completedAtLabel,
  formattedCost,
  usageRows,
  jobStatus,
}: StepStatsCardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          Configuration
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Step order</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {step.step_order ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Step type</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100 capitalize">
              {stepTypeLabel}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Model</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {step.model || "—"}
            </dd>
          </div>
          {toolChoice && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500 dark:text-gray-400">Tool choice</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {toolChoice}
              </dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Tools</dt>
            <dd className="flex flex-wrap justify-end gap-1 text-right">
              {toolLabels.length > 0 ? (
                toolLabels.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-md border border-primary-100 dark:border-primary-800/40 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                  >
                    {tool}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 dark:text-gray-400">—</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          Timing & cost
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Duration</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {durationLabel || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Started</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {startedAtLabel || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {completedAtLabel || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">Cost</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {formattedCost || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          Usage
        </h3>
        {usageRows.length > 0 ? (
          <dl className="space-y-2 text-sm">
            {usageRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3"
              >
                <dt className="text-gray-500 dark:text-gray-400">{row.label}</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No usage details recorded for this step yet.
          </p>
        )}
      </div>
    </div>
  );
}
