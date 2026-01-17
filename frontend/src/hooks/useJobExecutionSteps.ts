"use client";

import { useState } from "react";

/**
 * Hook to manage execution steps state and formatting
 */
export function useJobExecutionSteps() {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (stepOrder: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepOrder)) {
      newExpanded.delete(stepOrder);
    } else {
      newExpanded.add(stepOrder);
    }
    setExpandedSteps(newExpanded);
  };

  return {
    expandedSteps,
    toggleStep,
  };
}
