"use client";

import { useState, useEffect } from "react";
import type { MergedStep } from "@/types/job";

/**
 * Hook to manage execution steps state and formatting
 */
export function useJobExecutionSteps(steps?: MergedStep[]) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  // Auto-expand first failed step
  useEffect(() => {
    if (!steps || steps.length === 0 || hasAutoExpanded) return;

    const failedStep = steps.find(step => step.status === "failed");
    if (failedStep && failedStep.step_order !== undefined) {
      setExpandedSteps(new Set([failedStep.step_order]));
      setHasAutoExpanded(true);
    }
  }, [steps, hasAutoExpanded]);

  const toggleStep = (stepOrder: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepOrder)) {
        next.delete(stepOrder);
      } else {
        next.add(stepOrder);
      }
      return next;
    });
  };

  const expandAll = (stepOrders: number[]) => {
    setExpandedSteps(new Set(stepOrders));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  return {
    expandedSteps,
    toggleStep,
    expandAll,
    collapseAll,
  };
}
