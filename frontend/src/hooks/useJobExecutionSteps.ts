"use client";

import { useState } from "react";

/**
 * Hook to manage execution steps state and formatting
 */
export function useJobExecutionSteps() {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

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
