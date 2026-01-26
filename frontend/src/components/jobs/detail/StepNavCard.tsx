"use client";

import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MergedStep, StepStatus } from "@/types/job";

interface StepNavCardProps {
  label: string;
  direction: "previous" | "next";
  href?: string | null;
  step: MergedStep | null;
  status?: StepStatus | null;
}

export function StepNavCard({
  label,
  direction,
  href,
  step,
  status,
}: StepNavCardProps) {
  const emptyLabel =
    direction === "previous" ? "Start of workflow" : "End of workflow";
  const title = step?.step_name || (step ? `Step ${step.step_order ?? 0}` : "");
  const subtitle = step?.step_type
    ? step.step_type.replace(/_/g, " ")
    : emptyLabel;

  const content = (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-3 shadow-sm transition-all ${
        href
          ? "hover:border-primary-200 dark:hover:border-primary-800/60 hover:shadow-md"
          : "opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide">
          {direction === "previous" ? (
            <ArrowLeftIcon className="h-3.5 w-3.5" />
          ) : (
            <ArrowRightIcon className="h-3.5 w-3.5" />
          )}
          {label}
        </span>
        {status && (
          <StatusBadge status={status} className="px-2 py-0.5 text-[10px]" />
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {title || "No step available"}
      </div>
      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 capitalize">
        {subtitle}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}
