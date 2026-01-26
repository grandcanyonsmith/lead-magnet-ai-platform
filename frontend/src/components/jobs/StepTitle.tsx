import React from "react";
import Link from "next/link";
import { MergedStep, StepStatus } from "@/types/job";
import { cn } from "@/lib/utils";

interface StepTitleProps {
  step: MergedStep;
  status: StepStatus;
  detailsHref?: string;
  className?: string;
}

export function StepTitle({ step, status, detailsHref, className }: StepTitleProps) {
  const isPending = status === "pending";
  const titleText = step.step_name || `Step ${step.step_order ?? 0}`;
  
  const baseClasses = cn(
    "text-base sm:text-lg font-semibold break-words",
    isPending ? "text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-white",
    className
  );

  if (detailsHref) {
    return (
      <h3 className={baseClasses}>
        <Link
          href={detailsHref}
          className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          {titleText}
        </Link>
      </h3>
    );
  }

  return <h3 className={baseClasses}>{titleText}</h3>;
}
