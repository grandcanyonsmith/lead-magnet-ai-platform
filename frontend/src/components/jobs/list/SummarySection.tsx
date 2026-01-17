import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import clsx from "clsx";

export interface SummaryCard {
  label: string;
  value: string;
  subtext?: string;
  icon: ReactNode;
  accentClass: string;
}

interface SummarySectionProps {
  jobCount: number;
  lastRefreshedLabel: string | null;
  hasProcessingJobs: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  summaryCards: SummaryCard[];
}

export function SummarySection({
  jobCount,
  lastRefreshedLabel,
  hasProcessingJobs,
  refreshing,
  onRefresh,
  summaryCards,
}: SummarySectionProps) {
  return (
    <div className="mb-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
            Generated
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Track generation progress, errors, and delivery status for recent
            runs.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <ArrowPathIcon
            className={clsx(
              "h-4 w-4 transition-transform",
              refreshing && "animate-spin",
            )}
          />
          {refreshing ? "Updating..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={clsx(
              "relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-5 shadow-sm transition-all hover:shadow-md",
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {card.label}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {card.value}
                  </p>
                </div>
                {card.subtext && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {card.subtext}
                  </p>
                )}
              </div>
              <div
                className={clsx(
                  "rounded-lg p-2.5 shadow-sm ring-1 ring-inset ring-gray-200/50",
                  card.accentClass.split(" ")[1] || "bg-gray-50",
                )}
              >
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
