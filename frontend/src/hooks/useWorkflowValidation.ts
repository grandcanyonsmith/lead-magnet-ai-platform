"use client";

import { useMemo } from "react";
import { WorkflowStep } from "@/types/workflow";
import { WorkflowFormData } from "./useWorkflowForm";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}

export function useWorkflowValidation(
  formData: WorkflowFormData,
  steps: WorkflowStep[],
) {
  const validate = useMemo((): ValidationResult => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    if (!formData.workflow_name.trim()) {
      errors.push("Lead magnet name is required");
      fieldErrors.workflow_name = "Lead magnet name is required";
    }

    if (steps.length === 0) {
      errors.push("At least one workflow step is required");
    }

    steps.forEach((step, index) => {
      if (!step.step_name.trim()) {
        errors.push(`Step ${index + 1} name is required`);
      }
      if (!step.instructions.trim()) {
        errors.push(`Step ${index + 1} instructions are required`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      fieldErrors,
    };
  }, [formData, steps]);

  return validate;
}
