import React from "react";
import { FiCheckCircle, FiXCircle, FiLoader, FiClock } from "react-icons/fi";
import { StepStatus } from "@/types/job";
import { cn } from "@/lib/utils";

interface StepStatusIconProps {
  status: StepStatus;
  className?: string;
}

export function StepStatusIcon({ status, className }: StepStatusIconProps) {
  const baseClasses = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border";

  if (status === "completed") {
    return (
      <span className={cn(baseClasses, "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800", className)}>
        <FiCheckCircle className="w-3.5 h-3.5" />
        Success
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className={cn(baseClasses, "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800", className)}>
        <FiXCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className={cn(baseClasses, "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800", className)}>
        <FiLoader className="w-3.5 h-3.5 animate-spin" />
        Running
      </span>
    );
  }

  return (
    <span className={cn(baseClasses, "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700", className)}>
      <FiClock className="w-3.5 h-3.5" />
      Pending
    </span>
  );
}
